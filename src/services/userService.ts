import { pool } from '../db/index';
import { UserError } from '@/lib/errors';
import { ROLES, type Actor, type Role } from './auth';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const userService = {
  async listUsers() {
    const res = await pool.query(`
      SELECT u.id, u.email, u.name, u.role, u.teacher_id, u.active, (u.uid IS NOT NULL) AS linked,
             t.name AS teacher_name, t.code AS teacher_code
      FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id
      ORDER BY u.active DESC, u.role, u.email
    `);
    return res.rows;
  },

  async inviteUser(data: { email: string; role: Role; teacher_id?: string | null; name?: string | null }, actor: Actor) {
    const email = String(data.email || '').trim().toLowerCase();
    if (!EMAIL.test(email)) throw new UserError('Enter a valid email address');
    if (!ROLES.includes(data.role)) throw new UserError('Invalid role');
    if (data.role === 'teacher' && !data.teacher_id) throw new UserError('A teacher account must be linked to a teacher record');
    try {
      const res = await pool.query(
        `INSERT INTO users (email, name, role, teacher_id, invited_by, active)
         VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
        [email, data.name || null, data.role, data.role === 'teacher' ? data.teacher_id : null, actor.email]
      );
      return res.rows[0].id as number;
    } catch (e: any) {
      if (e.code === '23505') throw new UserError('A user with this email already exists');
      throw e;
    }
  },

  async updateUser(data: { id: number; role?: Role; teacher_id?: string | null; active?: boolean }, actor: Actor) {
    const target = (await pool.query(`SELECT * FROM users WHERE id = $1`, [data.id])).rows[0];
    if (!target) throw new UserError('User not found');

    const newRole = data.role ?? target.role;
    const newActive = data.active ?? target.active;
    if (!ROLES.includes(newRole)) throw new UserError('Invalid role');
    const newTeacher = newRole === 'teacher' ? (data.teacher_id ?? target.teacher_id) : null;
    if (newRole === 'teacher' && !newTeacher) throw new UserError('A teacher account must be linked to a teacher record');

    const losesMaster = target.role === 'master_admin' && (newRole !== 'master_admin' || !newActive);
    if (losesMaster) {
      if (target.email.toLowerCase() === actor.email) throw new UserError('You cannot remove your own master admin access');
      const others = await pool.query(
        `SELECT count(*)::int AS n FROM users WHERE role = 'master_admin' AND active AND id <> $1`,
        [data.id]
      );
      if (others.rows[0].n < 1) throw new UserError('At least one active master admin must remain');
    }

    await pool.query(`UPDATE users SET role = $2, teacher_id = $3, active = $4 WHERE id = $1`, [
      data.id, newRole, newTeacher, newActive,
    ]);
  },
};
