import assert from 'node:assert/strict';
import { pool } from '@/src/db/index';
import { GET, POST } from '@/app/api/data/route';
import { GET as CRON } from '@/app/api/cron/route';

const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(email: string, verified = true) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: 'https://securetoken.google.com/stub-project', aud: 'stub-project', sub: 'uid-' + email, user_id: 'uid-' + email,
    auth_time: now, iat: now, exp: now + 3600, email, email_verified: verified,
    firebase: { sign_in_provider: 'google.com', identities: {} },
  })}.`;
}
const req = (url: string, tok?: string, body?: any) =>
  new Request('http://x' + url, { method: body ? 'POST' : 'GET', headers: { ...(tok ? { authorization: 'Bearer ' + tok } : {}), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const get = async (url: string, tok?: string) => { const r = await GET(req(url, tok)); return { status: r.status, json: await r.json() }; };
const post = async (action: string, payload: any, tok?: string) => { const r = await POST(req('/api/data', tok, { action, payload })); return { status: r.status, json: await r.json() }; };

// Minimal stand-in for the Firebase Auth emulator: the Admin SDK looks the user up in emulator mode.
import http from 'node:http';
const emu = http.createServer((q, r) => {
  let body = '';
  q.on('data', (c) => (body += c));
  q.on('end', () => {
    const uid: string = (JSON.parse(body || '{}').localId || [''])[0];
    r.setHeader('content-type', 'application/json');
    r.end(JSON.stringify({ kind: 'identitytoolkit#GetAccountInfoResponse', users: [{ localId: uid, email: uid.replace(/^uid-/, ''), emailVerified: true, disabled: false, createdAt: '1', lastLoginAt: '1', providerUserInfo: [] }] }));
  });
});

(async () => {
  await new Promise<void>((res) => emu.listen(9099, res));
  const boss = token('boss@example.com');
  assert.equal((await get('/api/data?type=me')).status, 401, 'no token'); 
  assert.equal((await get('/api/data?type=me', 'garbage')).status, 401, 'bad token');
  assert.equal((await get('/api/data?type=me', token('stranger@example.com'))).status, 403, 'uninvited');
  assert.equal((await get('/api/data?type=me', token('boss@example.com', false))).status, 403, 'unverified email');
  const me = await get('/api/data?type=me', boss); assert.equal(me.json.role, 'master_admin'); console.log('auth: 401/403/bootstrap ok');

  const rina = (await pool.query(`select id from teachers where name like 'Rina%'`)).rows[0].id;
  for (const [email, role, teacher_id] of [['admin@example.com', 'admin', undefined], ['rina@example.com', 'teacher', rina], ['view@example.com', 'viewer', undefined]] as const) {
    const r = await post('invite_user', { email, role, teacher_id }, boss); assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  assert.equal((await post('invite_user', { email: 'x@example.com', role: 'teacher' }, boss)).status, 400, 'teacher needs link');
  const adm = token('admin@example.com'), tch = token('rina@example.com'), vw = token('view@example.com');

  // --- teacher ---
  for (const t of ['leads', 'students', 'invoices', 'master', 'reports', 'users', 'waterfall_students']) assert.equal((await get(`/api/data?type=${t}`, tch)).status, 403, 'teacher ' + t);
  const tAll = await get('/api/data?type=all', tch); assert.equal(tAll.status, 200);
  assert.equal(tAll.json.students.length, 0); assert.equal(tAll.json.leads.length, 0); assert.equal(tAll.json.invoices.length, 0);
  assert.ok(tAll.json.sessions.length > 0 && tAll.json.sessions.every((s: any) => s.teacher_id === rina || s.teacher_id === undefined));
  assert.deepEqual(tAll.json.master.teacherRates, []); assert.equal(tAll.json.master.teachers.length, 1);
  const teachersSeen = new Set(tAll.json.sessions.map((s: any) => s.teacher_code)); assert.equal(teachersSeen.size, 1);
  const pay = await get('/api/data?type=payroll&start=2026-09-01&end=2026-09-30', tch); assert.ok(pay.json.preview.summary.every((x: any) => x.teacher_id === rina));
  for (const a of ['lock_payroll', 'create_lead', 'convert_lead', 'book_makeup', 'record_notice', 'invite_user', 'create_invoice']) assert.equal((await post(a, {}, tch)).status, 403, 'teacher POST ' + a);
  const foreign = (await pool.query(`select id from sessions where teacher_id <> $1 and status='scheduled' limit 1`, [rina])).rows[0].id;
  const f = await post('checkin_session', { session_id: foreign, outcome: 'held', admin: true }, tch); assert.equal(f.status, 400); assert.match(f.json.error, /own sessions/);
  const own = (await pool.query(`select id from sessions where teacher_id = $1 and status='scheduled' and scheduled_start > now() + interval '3 days' limit 1`, [rina])).rows[0].id;
  const early = await post('checkin_session', { session_id: own, outcome: 'held', admin: true }, tch); assert.equal(early.status, 400); assert.match(early.json.error, /window/);
  console.log('teacher: scoping, 403s, ownership, admin-flag ignored ok');

  // --- viewer ---
  assert.equal((await get('/api/data?type=reports', vw)).status, 200);
  for (const t of ['students', 'leads', 'classes', 'sessions', 'payroll', 'master', 'waterfall_students']) assert.equal((await get(`/api/data?type=${t}`, vw)).status, 403, 'viewer ' + t);
  const vAll = await get('/api/data?type=all', vw); assert.ok(vAll.json.counts.students > 0 && vAll.json.students.length === 0 && vAll.json.sessions.length === 0);
  assert.equal((await post('create_lead', { name: 'x', source_channel: 'y' }, vw)).status, 403);
  console.log('viewer: read-only aggregates ok');

  // --- admin ---
  const aMaster = await get('/api/data?type=master', adm); assert.equal(aMaster.status, 200); assert.deepEqual(aMaster.json.teacherRates, []);
  assert.equal((await post('invite_user', { email: 'z@example.com', role: 'admin' }, adm)).status, 403);
  assert.equal((await get('/api/data?type=users', adm)).status, 403);
  assert.equal((await post('lock_payroll', { start: '2026-10-01', end: '2026-10-31' }, adm)).status, 400);
  assert.equal((await post('lock_payroll', { start: '2026-09-03', end: '2026-09-30' }, adm)).status, 400);
  const lead = await post('create_lead', { name: 'Api Test Lead', guardian_name: 'Parent', source_channel: 'referral' }, adm); assert.equal(lead.status, 200);
  assert.equal((await post('create_lead', { name: '', source_channel: 'y' }, adm)).status, 400);
  assert.equal((await get('/api/data?type=sessions&limit=1;drop%20table%20leads', adm)).status, 400, 'limit injection');
  assert.equal((await get('/api/data?type=lead_details&id=not-a-uuid', adm)).status, 400);
  assert.equal((await get('/api/data?type=waterfall_students&bucket=x%27;--', adm)).status, 400);
  console.log('admin: allowed/blocked actions, validation ok');

  // --- master admin ---
  const mm = await get('/api/data?type=master', boss); assert.ok(mm.json.teacherRates.length > 0);
  assert.equal((await post('update_user', { id: (me.json && (await pool.query(`select id from users where email='boss@example.com'`)).rows[0].id), role: 'admin' }, boss)).status, 400, 'self-demotion blocked');
  const tid = (await pool.query(`select id from users where email='view@example.com'`)).rows[0].id;
  assert.equal((await post('update_user', { id: tid, active: false }, boss)).status, 200);
  assert.equal((await get('/api/data?type=me', vw)).status, 403, 'deactivated user loses access immediately');
  console.log('master_admin: rates visible, self-lockout blocked, deactivation immediate ok');

  // --- audit + cron ---
  const au = (await pool.query(`select count(*)::int n, count(*) filter (where not ok)::int fail, bool_or(payload::text like '%Api Test Lead%') leaked from audit_log`)).rows[0];
  assert.ok(au.n > 10 && au.fail > 5 && !au.leaked); console.log('audit rows:', au.n, 'failed:', au.fail, 'PII leaked:', au.leaked);
  await assert.rejects(pool.query(`update audit_log set ok = true`), /append-only/);
  assert.equal((await CRON(new Request('http://x/api/cron'))).status, 401);
  const c = await CRON(new Request('http://x/api/cron', { headers: { authorization: 'Bearer test-secret' } })); assert.equal(c.status, 200); console.log('cron:', JSON.stringify(await c.json()));
  await pool.end(); emu.close(); console.log('API TESTS PASSED');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
