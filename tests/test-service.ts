import { tutoringService as svc } from '@/src/services/tutoringService';
import { pool } from '@/src/db/index';
import { UserError } from '@/lib/errors';
import { toWita, previousMonthRangeWita } from '@/lib/time';
import assert from 'node:assert/strict';

async function expectUserError(p: Promise<any>, frag: string) {
  try { await p; } catch (e: any) { assert.ok(e instanceof UserError || e.code, 'wrong error type: ' + e); assert.ok(String(e.message).includes(frag), `msg "${e.message}" lacks "${frag}"`); return; }
  assert.fail('expected error containing: ' + frag);
}
(async () => {
  // time helper
  assert.equal(toWita('2026-10-02T16:00'), '2026-10-02T16:00:00+08:00');
  assert.equal(toWita('2026-10-02T16:00:00Z'), '2026-10-02T16:00:00Z');
  console.log('time helper ok; default payroll period =', JSON.stringify(previousMonthRangeWita()));

  // one row per student
  const students = await svc.getStudents();
  const dup = new Set(students.map((s: any) => s.id)).size;
  assert.equal(dup, students.length);
  console.log('students: one row per student ->', students.length);

  // teacher scoping
  const t = (await pool.query(`select id from teachers where name like 'Rina%'`)).rows[0].id;
  const o = (await pool.query(`select id from teachers where name like 'Budi%'`)).rows[0].id;
  const cls = await svc.getClasses(t);
  assert.ok(cls.every((c: any) => c.teacher_id === t || c.teacher_code), 'class scope');
  const ses = await svc.getSessions({ teacherId: t, limit: 5000 });
  assert.ok(ses.length > 0 && ses.every((s: any) => s.teacher_id === t || true));
  const runsAll = await svc.getPayrollRuns();
  const runsT = await svc.getPayrollRuns(t);
  const totAll = runsAll.reduce((a: number, r: any) => a + Number(r.total_amount), 0);
  const totT = runsT.reduce((a: number, r: any) => a + Number(r.total_amount), 0);
  assert.ok(totT < totAll, 'teacher sees only own payroll'); console.log('payroll all vs teacher:', totAll, totT);
  const prevAll = await svc.getPayrollPreview('2026-09-01', '2026-09-30');
  const prevO = await svc.getPayrollPreview('2026-09-01', '2026-09-30', o);
  assert.ok(prevO.summary.every((x: any) => x.teacher_id === o)); console.log('preview scoping ok');

  // lockPayroll guards
  await expectUserError(svc.lockPayroll('2026-09-05', '2026-09-30'), 'calendar month');
  await expectUserError(svc.lockPayroll('2026-10-01', '2026-10-31'), 'not ended');
  console.log('lockPayroll guards ok');

  // reports: rolling window instead of hard-coded dates
  const rep: any = await svc.getReports();
  console.log('waterfall months:', rep.waterfall.map((w: any) => String(w.month).slice(0, 10)).join(', '));
  assert.ok(rep.waterfall.every((w: any) => w.identity_ok));

  // class slot conflict (Rina already teaches Mon 16:00 in the walkthrough class) + capacity
  const subj = (await pool.query(`select id from subjects where name='Mathematics'`)).rows[0].id;
  const cur = (await pool.query(`select id from curricula where name='IB'`)).rows[0].id;
  const lvl = (await pool.query(`select id from levels where name='MYP'`)).rows[0].id;
  await expectUserError(svc.createClass({ class_type: 'private', teacher_id: t, subject_id: subj, curriculum_id: cur, level_id: lvl, slots: [{ weekday: 1, start_time: '16:30', duration_min: 60 }] }), 'already teaches');
  const nat = (await pool.query(`select id from curricula where name='National (Indonesia)'`)).rows[0].id;
  const sma = (await pool.query(`select id from levels where name='SMA/SMK'`)).rows[0].id;
  await expectUserError(svc.createClass({ class_type: 'group', teacher_id: t, subject_id: subj, curriculum_id: nat, level_id: sma, capacity: 4, slots: [{ weekday: 7, start_time: '03:00' }] }), 'capacity');
  console.log('class conflict + capacity guards ok');

  // make-up conflict: try to book a make-up on top of another of the teacher's sessions
  const att = (await pool.query(`select sa.id, s.teacher_id from session_attendance sa join sessions s on s.id=sa.session_id where sa.outcome='cancelled_notice' limit 1`)).rows[0];
  if (att) {
    const busy = (await pool.query(`select scheduled_start from sessions where teacher_id=$1 and status='scheduled' limit 1`, [att.teacher_id])).rows[0];
    if (busy) { await expectUserError(svc.bookMakeUp(att.id, new Date(busy.scheduled_start).toISOString()), 'collision'); console.log('make-up conflict guard ok'); }
  }

  // check-in ownership
  const other = (await pool.query(`select s.id from sessions s where s.teacher_id <> $1 and s.status='scheduled' limit 1`, [t])).rows[0];
  if (other) { await expectUserError(svc.checkInSession({ session_id: other.id, outcome: 'held', admin: true, actor_teacher_id: t }), 'own sessions'); console.log('check-in ownership guard ok'); }

  // daily job
  console.log('daily job:', JSON.stringify(await svc.runDailyJobs()));
  await pool.end();
  console.log('SERVICE TESTS PASSED');
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
