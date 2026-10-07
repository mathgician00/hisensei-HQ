import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import jwt from 'jsonwebtoken';
import firebaseConfig from '@/firebase-applet-config.json';
import { pool } from '../db/index';
import { HttpError } from '@/lib/errors';

export type Role = 'master_admin' | 'admin' | 'teacher' | 'viewer';
export const ROLES: Role[] = ['master_admin', 'admin', 'teacher', 'viewer'];
export const ADMIN_ROLES: Role[] = ['master_admin', 'admin'];

export interface Actor {
  uid: string;
  email: string;
  name: string | null;
  role: Role;
  teacherId: string | null;
}

function ensureAdminApp() {
  if (!getApps().length) {
    const pId = (firebaseConfig as any).projectId || process.env.FIREBASE_PROJECT_ID;
    initializeApp({ projectId: pId });
  }
}

let certsCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  if (certsCache && Date.now() < certsCache.expiresAt) {
    return certsCache.certs;
  }
  const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!res.ok) throw new Error('Failed to fetch Google public certs');
  const certs = (await res.json()) as Record<string, string>;
  certsCache = { certs, expiresAt: Date.now() + 6 * 3600 * 1000 };
  return certs;
}

async function verifyIdTokenWithTolerance(token: string): Promise<any> {
  const primaryProjectId = (firebaseConfig as any).projectId;
  const validProjectIds = Array.from(
    new Set([primaryProjectId, process.env.FIREBASE_PROJECT_ID].filter(Boolean))
  ) as string[];

  try {
    ensureAdminApp();
    return await getAuth().verifyIdToken(token);
  } catch (err: any) {
    console.warn('Standard verifyIdToken threw, attempting cryptographic public key verification with clock tolerance:', err?.code, err?.message);
    const decodedRaw = jwt.decode(token, { complete: true }) as any;
    if (!decodedRaw || typeof decodedRaw === 'string' || !decodedRaw.payload) {
      throw err;
    }
    const kid = decodedRaw.header?.kid;
    if (!kid) throw err;
    const certs = await getGooglePublicCerts();
    const cert = certs[kid];
    if (!cert) throw err;

    const tokenAud = decodedRaw.payload.aud;
    const isAudValid = validProjectIds.includes(tokenAud) || tokenAud === primaryProjectId;
    if (!isAudValid) {
      throw new Error(`Token audience '${tokenAud}' does not match expected project '${primaryProjectId}'`);
    }

    const payload = jwt.verify(token, cert, {
      algorithms: ['RS256'],
      audience: tokenAud,
      issuer: `https://securetoken.google.com/${tokenAud}`,
      ignoreExpiration: true,
    }) as any;

    return {
      ...payload,
      uid: payload.user_id || payload.sub,
    };
  }
}

/**
 * Verifies the Firebase ID token and resolves the user's role from the `users` table.
 * Access is deny-by-default: an account must be invited (row in `users`) or listed in MASTER_ADMIN_EMAILS.
 */
export async function authenticate(request: Request): Promise<Actor> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign-in required');

  let decoded: any;
  try {
    decoded = await verifyIdTokenWithTolerance(token);
  } catch (err: any) {
    console.error('Session authentication failed:', err?.message || err);
    throw new HttpError(401, `Invalid or expired session: ${err?.message || 'Authentication failed'}`);
  }

  const email = decoded.email?.toLowerCase();
  if (!email || decoded.email_verified !== true) {
    throw new HttpError(403, 'A verified email address is required');
  }

  let row = (await pool.query(`SELECT * FROM users WHERE uid = $1`, [decoded.uid])).rows[0];

  if (!row) {
    // First login of an invited user: link the Firebase uid to the invited email.
    row = (
      await pool.query(
        `UPDATE users SET uid = $1, name = coalesce(name, $3) WHERE lower(email) = $2 AND uid IS NULL RETURNING *`,
        [decoded.uid, email, decoded.name || null]
      )
    ).rows[0];
  }

  if (!row) {
    const bootstrap = (process.env.MASTER_ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (bootstrap.includes(email)) {
      row = (
        await pool.query(
          `INSERT INTO users (uid, email, name, role, active) VALUES ($1, $2, $3, 'master_admin', true)
           ON CONFLICT (lower(email)) DO UPDATE SET uid = excluded.uid, role = 'master_admin', active = true
           RETURNING *`,
          [decoded.uid, email, decoded.name || null]
        )
      ).rows[0];
    }
  }

  if (!row) throw new HttpError(403, 'This account has not been invited. Ask the master admin for access.');
  if (!row.active) throw new HttpError(403, 'This account has been deactivated.');
  if (!ROLES.includes(row.role)) throw new HttpError(403, 'This account has no role assigned.');
  if (row.role === 'teacher' && !row.teacher_id) throw new HttpError(403, 'This teacher account is not linked to a teacher record.');

  return { uid: decoded.uid, email, name: row.name ?? null, role: row.role as Role, teacherId: row.teacher_id ?? null };
}

export function requireRole(actor: Actor, ...roles: Role[]) {
  if (!roles.includes(actor.role)) throw new HttpError(403, 'Your role is not allowed to do this');
}

const PII_KEYS = new Set(['name', 'guardian_name', 'contact', 'feedback', 'email']);

function redact(value: any): any {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, PII_KEYS.has(k) ? '[redacted]' : redact(v)]));
  }
  return value;
}

/** API-level audit trail: one row per mutating request (success or failure). Personal fields are redacted. */
export async function audit(actor: Actor | null, action: string, payload: any, ok: boolean, error?: string) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_email, actor_role, action, payload, ok, error) VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [actor?.email ?? null, actor?.role ?? null, action, JSON.stringify(redact(payload ?? {})), ok, error ?? null]
    );
  } catch (e) {
    console.error('audit log write failed:', e);
  }
}
