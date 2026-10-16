import { NextResponse } from 'next/server';
import { tutoringService } from '@/src/services/tutoringService';
import { userService } from '@/src/services/userService';
import { authenticate, audit, requireRole, ADMIN_ROLES, ROLES, type Actor, type Role } from '@/src/services/auth';
import { HttpError, UserError } from '@/lib/errors';
import { previousMonthRangeWita, witaToday } from '@/lib/time';

export const dynamic = 'force-dynamic';

// ---------- input validation ----------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

const uuid = (v: any, name: string): string => {
  if (typeof v !== 'string' || !UUID.test(v)) throw new UserError(`Invalid ${name}`);
  return v;
};
const date = (v: any, name: string): string => {
  if (typeof v !== 'string' || !DATE.test(v) || Number.isNaN(Date.parse(v))) throw new UserError(`Invalid ${name}`);
  return v;
};
const optDate = (v: any, name: string) => (v ? date(v, name) : undefined);
const str = (v: any, name: string, max = 500): string => {
  if (typeof v !== 'string' || v.trim() === '' || v.length > max) throw new UserError(`Invalid ${name}`);
  return v.trim();
};
const optStr = (v: any, name: string, max = 500) => (v === undefined || v === null || v === '' ? undefined : str(v, name, max));
const int = (v: any, name: string, min: number, max: number): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new UserError(`Invalid ${name}`);
  return n;
};
function oneOf<T extends string>(v: any, allowed: readonly T[], name: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw new UserError(`Invalid ${name}`);
  return v as T;
}

const LEAD_STAGES = ['new', 'contacted', 'trial_booked', 'trial_attended', 'offer_made', 'converted', 'lost'] as const;
const TRIAL_OUTCOMES = ['scheduled', 'attended', 'no_show', 'cancelled', 'rescheduled'] as const;
const STUDENT_STATUSES = ['active', 'postponed', 'churned'] as const;
const INVOICE_TARGETS = ['sent', 'paid', 'void'] as const;
const BUCKETS = ['opening', 'new_students', 'reactivated', 'dropped', 'closing', 'ongoing', 'of_which_postponed'] as const;

// ---------- role helpers ----------
const isAdminRole = (a: Actor) => ADMIN_ROLES.includes(a.role);

/** Master data each role may see. Pay rates are restricted to master_admin (PRD section 4). */
async function masterFor(actor: Actor) {
  const master: any = await tutoringService.getMasterData();
  if (actor.role === 'master_admin') return master;
  if (actor.role === 'admin') return { ...master, teacherRates: [] };
  return {
    ...master,
    teachers: actor.role === 'teacher' ? master.teachers.filter((t: any) => t.id === actor.teacherId) : [],
    packages: [],
    packagePrices: [],
    teacherRates: [],
    campaigns: [],
  };
}

const EMPTY_REPORTS = { waterfall: [], cohort: [], renewals: [], exceptions: [], teacherMonth: [] };

function errorResponse(error: any) {
  if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof UserError) return NextResponse.json({ error: error.message }, { status: 400 });
  const code = typeof error?.code === 'string' ? error.code : '';
  // P0001 = RAISE EXCEPTION from our SQL rules, 23xxx = constraint violations, 22xxx = invalid input
  if (code === 'P0001' || code.startsWith('23') || code.startsWith('22')) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error('API error:', error);
  return NextResponse.json({ error: 'Internal error. The problem has been logged.' }, { status: 500 });
}

// ---------- GET ----------
export async function GET(request: Request) {
  try {
    const actor = await authenticate(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'me';

    switch (type) {
      case 'me':
        return NextResponse.json({ email: actor.email, name: actor.name, role: actor.role, teacher_id: actor.teacherId });

      case 'master':
        requireRole(actor, 'master_admin', 'admin');
        return NextResponse.json(await masterFor(actor));

      case 'users':
        requireRole(actor, 'master_admin');
        return NextResponse.json(await userService.listUsers());

      case 'leads':
        requireRole(actor, 'master_admin', 'admin');
        return NextResponse.json(await tutoringService.getLeads());

      case 'lead_flow': {
        requireRole(actor, 'master_admin', 'admin', 'viewer');
        const channel = searchParams.get('channel') || 'all';
        return NextResponse.json(await tutoringService.getLeadFlow(channel));
      }

      case 'lead_details':
        requireRole(actor, 'master_admin', 'admin');
        return NextResponse.json(await tutoringService.getLeadDetails(uuid(searchParams.get('id'), 'lead id')));

      case 'students':
        requireRole(actor, 'master_admin', 'admin');
        return NextResponse.json(await tutoringService.getStudents());

      case 'student_details':
        requireRole(actor, 'master_admin', 'admin');
        return NextResponse.json(await tutoringService.getStudentDetails(uuid(searchParams.get('id'), 'student id')));

      case 'classes':
        requireRole(actor, 'master_admin', 'admin', 'teacher');
        return NextResponse.json(await tutoringService.getClasses(actor.role === 'teacher' ? actor.teacherId! : undefined));

      case 'invoices':
        requireRole(actor, 'master_admin', 'admin');
        return NextResponse.json(await tutoringService.getInvoices());

      case 'sessions': {
        requireRole(actor, 'master_admin', 'admin', 'teacher');
        const teacherId = actor.role === 'teacher' ? actor.teacherId! : searchParams.get('teacherId') ? uuid(searchParams.get('teacherId'), 'teacher id') : undefined;
        const classId = searchParams.get('classId') ? uuid(searchParams.get('classId'), 'class id') : undefined;
        const status = searchParams.get('status') || undefined;
        const from = searchParams.get('from') || undefined;
        const to = searchParams.get('to') || undefined;
        if (from && Number.isNaN(Date.parse(from))) throw new UserError('Invalid from');
        if (to && Number.isNaN(Date.parse(to))) throw new UserError('Invalid to');
        const limit = searchParams.get('limit') ? int(searchParams.get('limit'), 'limit', 1, 2000) : undefined;
        return NextResponse.json(await tutoringService.getSessions({ teacherId, classId, status, from, to, limit }));
      }

      case 'payroll': {
        requireRole(actor, 'master_admin', 'admin', 'teacher');
        const def = previousMonthRangeWita();
        const start = optDate(searchParams.get('start'), 'start') || def.start;
        const end = optDate(searchParams.get('end'), 'end') || def.end;
        const scope = actor.role === 'teacher' ? actor.teacherId! : undefined; // teachers only ever see their own pay
        const [preview, runs] = await Promise.all([
          tutoringService.getPayrollPreview(start, end, scope),
          tutoringService.getPayrollRuns(scope),
        ]);
        return NextResponse.json({ preview, runs });
      }

      case 'reports':
        requireRole(actor, 'master_admin', 'admin', 'viewer');
        return NextResponse.json(await tutoringService.getReports());

      case 'waterfall_students': {
        requireRole(actor, 'master_admin', 'admin'); // returns student names and guardians
        const rawMonth = searchParams.get('month');
        const normalizedMonth = rawMonth ? rawMonth.slice(0, 10) : undefined;
        const month = optDate(normalizedMonth, 'month') || `${witaToday().slice(0, 7)}-01`;
        const bucket = oneOf(searchParams.get('bucket') || 'new_students', BUCKETS, 'bucket');
        return NextResponse.json(await tutoringService.getWaterfallStudents(month, bucket));
      }

      case 'all': {
        const now = Date.now();
        const from = new Date(now - 45 * 864e5).toISOString();
        const to = new Date(now + 60 * 864e5).toISOString();

        if (isAdminRole(actor)) {
          const [master, leads, students, classes, invoices, sessions, reports, leadFlow] = await Promise.all([
            masterFor(actor),
            tutoringService.getLeads(),
            tutoringService.getStudents(),
            tutoringService.getClasses(),
            tutoringService.getInvoices(),
            tutoringService.getSessions({ from, to, limit: 1500 }),
            tutoringService.getReports(),
            tutoringService.getLeadFlow(),
          ]);
          return NextResponse.json({ master, leads, students, classes, invoices, sessions, reports, leadFlow });
        }

        if (actor.role === 'teacher') {
          const [master, classes, sessions] = await Promise.all([
            masterFor(actor),
            tutoringService.getClasses(actor.teacherId!),
            tutoringService.getSessions({ teacherId: actor.teacherId!, from, to, limit: 1500 }),
          ]);
          return NextResponse.json({ master, leads: [], students: [], classes, invoices: [], sessions, reports: EMPTY_REPORTS });
        }

        // viewer: aggregate reports and counts only, no personal records
        const [master, reports, counts] = await Promise.all([
          masterFor(actor),
          tutoringService.getReports(),
          tutoringService.getCounts(),
        ]);
        return NextResponse.json({ master, leads: [], students: [], classes: [], invoices: [], sessions: [], reports, counts });
      }

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}

// ---------- POST ----------
const ADMINS: Role[] = ['master_admin', 'admin'];
const ACTION_ROLES: Record<string, Role[]> = {
  create_lead: ADMINS,
  update_lead_stage: ADMINS,
  book_trial: ADMINS,
  set_trial_outcome: ADMINS,
  convert_lead: ADMINS,
  set_student_status: ADMINS,
  create_class: ADMINS,
  enroll_student: ADMINS,
  create_invoice: ADMINS,
  set_invoice_status: ADMINS,
  record_notice: ADMINS, // admin records when a cancellation notice arrived (decision D2a)
  book_makeup: ADMINS, // make-ups are admin-only (decision D5)
  lock_payroll: ADMINS,
  checkin_session: ['master_admin', 'admin', 'teacher'],
  invite_user: ['master_admin'],
  update_user: ['master_admin'],
};

async function execute(action: string, p: any, actor: Actor): Promise<Record<string, unknown>> {
  switch (action) {
    case 'create_lead': {
      const id = await tutoringService.createLead({
        name: str(p.name, 'name', 200),
        guardian_name: optStr(p.guardian_name, 'guardian name', 200),
        contact: optStr(p.contact, 'contact', 200),
        source_channel: str(p.source_channel, 'source channel', 100),
        campaign_name: optStr(p.campaign_name, 'campaign', 200),
      });
      return { lead_id: id };
    }
    case 'update_lead_stage':
      await tutoringService.updateLeadStage(
        uuid(p.lead_id, 'lead id'),
        oneOf(p.to_stage, LEAD_STAGES, 'stage'),
        optStr(p.note, 'note', 1000),
        optStr(p.lost_reason, 'lost reason', 500)
      );
      return {};
    case 'book_trial':
      return {
        trial_id: await tutoringService.bookTrial({
          lead_id: uuid(p.lead_id, 'lead id'),
          teacher_id: uuid(p.teacher_id, 'teacher id'),
          subject_id: uuid(p.subject_id, 'subject id'),
          curriculum_id: uuid(p.curriculum_id, 'curriculum id'),
          level_id: uuid(p.level_id, 'level id'),
          scheduled_at: str(p.scheduled_at, 'trial date/time', 40),
        }),
      };
    case 'set_trial_outcome':
      await tutoringService.setTrialOutcome(uuid(p.trial_id, 'trial id'), oneOf(p.outcome, TRIAL_OUTCOMES, 'outcome'), optStr(p.feedback, 'feedback', 2000));
      return {};
    case 'convert_lead':
      return { student_id: await tutoringService.convertLead(uuid(p.lead_id, 'lead id')) };
    case 'set_student_status':
      await tutoringService.setStudentStatus({
        student_id: uuid(p.student_id, 'student id'),
        status: oneOf(p.status, STUDENT_STATUSES, 'status'),
        effective_from: optDate(p.effective_from, 'effective date'),
        reason: optStr(p.reason, 'reason', 500),
        expected_return_date: optDate(p.expected_return_date, 'expected return date'),
        actor: actor.email,
      });
      return {};
    case 'create_class': {
      const slots = Array.isArray(p.slots) ? p.slots : [];
      if (slots.length < 1 || slots.length > 10) throw new UserError('A class needs between 1 and 10 weekly slots');
      return {
        class: await tutoringService.createClass({
          class_type: oneOf(p.class_type, ['private', 'group'] as const, 'class type'),
          teacher_id: uuid(p.teacher_id, 'teacher id'),
          subject_id: uuid(p.subject_id, 'subject id'),
          curriculum_id: uuid(p.curriculum_id, 'curriculum id'),
          level_id: uuid(p.level_id, 'level id'),
          capacity: p.capacity === undefined || p.capacity === null ? undefined : int(p.capacity, 'capacity', 1, 50),
          slots: slots.map((s: any) => {
            if (typeof s?.start_time !== 'string' || !TIME.test(s.start_time)) throw new UserError('Invalid slot start time');
            return {
              weekday: int(s.weekday, 'weekday', 1, 7),
              start_time: s.start_time,
              duration_min: s.duration_min === undefined ? undefined : int(s.duration_min, 'duration', 15, 240),
            };
          }),
        }),
      };
    }
    case 'enroll_student':
      return {
        enrollment_id: await tutoringService.enrollStudent({
          student_id: uuid(p.student_id, 'student id'),
          class_id: uuid(p.class_id, 'class id'),
          start_date: optDate(p.start_date, 'start date'),
        }),
      };
    case 'create_invoice':
      return {
        invoice_id: await tutoringService.createInvoice({
          enrollment_id: uuid(p.enrollment_id, 'enrollment id'),
          package_id: uuid(p.package_id, 'package id'),
          discount_amount: p.discount_amount ? int(p.discount_amount, 'discount', 0, 1_000_000_000) : 0,
          discount_reason: optStr(p.discount_reason, 'discount reason', 500),
        }),
      };
    case 'set_invoice_status':
      await tutoringService.updateInvoiceStatus(uuid(p.invoice_id, 'invoice id'), oneOf(p.to_status, INVOICE_TARGETS, 'status'), optStr(p.reason, 'reason', 500));
      return {};
    case 'checkin_session': {
      const outcome = oneOf(p.outcome, ['held', 'teacher_absent'] as const, 'outcome');
      let attendees: Record<string, 'attended' | 'no_show'> | undefined;
      if (outcome === 'held' && p.attendees && typeof p.attendees === 'object') {
        attendees = {};
        for (const [k, v] of Object.entries(p.attendees)) attendees[uuid(k, 'student id')] = oneOf(v, ['attended', 'no_show'] as const, 'attendee outcome');
      }
      await tutoringService.checkInSession({
        session_id: uuid(p.session_id, 'session id'),
        outcome,
        attendees,
        // The client flag is only honoured for admin roles. Teachers can never bypass the check-in window.
        admin: isAdminRole(actor) && p.admin === true,
        actor_teacher_id: actor.role === 'teacher' ? actor.teacherId : null,
      });
      return {};
    }
    case 'record_notice':
      return { outcome: await tutoringService.recordNotice(uuid(p.attendance_id, 'attendance id'), optStr(p.received_at, 'notice time', 40)) };
    case 'book_makeup':
      return { attendance_id: await tutoringService.bookMakeUp(uuid(p.orig_attendance_id, 'attendance id'), str(p.scheduled_at, 'make-up date/time', 40)) };
    case 'lock_payroll': {
      const start = date(p.start, 'start');
      const end = date(p.end, 'end');
      if (start > end) throw new UserError('Start must be before end');
      return { run_id: await tutoringService.lockPayroll(start, end) };
    }
    case 'invite_user':
      return {
        user_id: await userService.inviteUser(
          { email: str(p.email, 'email', 200), role: oneOf(p.role, ROLES, 'role'), teacher_id: p.teacher_id ? uuid(p.teacher_id, 'teacher id') : null, name: optStr(p.name, 'name', 200) },
          actor
        ),
      };
    case 'update_user':
      await userService.updateUser(
        {
          id: int(p.id, 'user id', 1, 2_147_483_647),
          role: p.role === undefined ? undefined : oneOf(p.role, ROLES, 'role'),
          teacher_id: p.teacher_id === undefined ? undefined : p.teacher_id ? uuid(p.teacher_id, 'teacher id') : null,
          active: p.active === undefined ? undefined : Boolean(p.active),
        },
        actor
      );
      return {};
    default:
      throw new HttpError(400, `Unknown action: ${action}`);
  }
}

export async function POST(request: Request) {
  let actor: Actor | null = null;
  let action = 'unknown';
  let payload: any = {};
  try {
    actor = await authenticate(request);
    const body = await request.json();
    action = String(body?.action ?? '');
    payload = body?.payload ?? {};
    const allowed = ACTION_ROLES[action];
    if (!allowed) throw new HttpError(400, `Unknown action: ${action}`);
    if (!allowed.includes(actor.role)) throw new HttpError(403, 'Your role is not allowed to do this');
    const result = await execute(action, payload, actor);
    await audit(actor, action, payload, true);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    if (actor) await audit(actor, action, payload, false, String(error?.message ?? error).slice(0, 500));
    return errorResponse(error);
  }
}
