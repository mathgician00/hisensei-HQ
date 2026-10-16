import { pool } from '../db/index';
import { UserError } from '@/lib/errors';
import { toWita } from '@/lib/time';
import { calculateLeadFlow } from '@/lib/leadFlow';

export interface Lead {
  id: string;
  code: string;
  name: string;
  guardian_name: string | null;
  contact: string | null;
  source_channel: string;
  campaign_id: string | null;
  campaign_name: string | null;
  current_stage: string;
  lost_reason: string | null;
  student_id: string | null;
  student_code: string | null;
  created_at: string;
  trials_count?: number;
}

export interface Student {
  id: string;
  code: string;
  lead_id: string | null;
  name: string;
  guardian_name: string | null;
  status: 'active' | 'postponed' | 'churned';
  expected_return_date: string | null;
  created_at: string;
  purchased?: number;
  consumed?: number;
  balance?: number;
  enrollment_id?: string;
  class_code?: string;
  class_type?: string;
}

export interface ClassItem {
  id: string;
  code: string;
  class_type: 'private' | 'group';
  teacher_id: string;
  teacher_name: string;
  teacher_code: string;
  subject_id: string;
  subject_name: string;
  curriculum_id: string;
  curriculum_name: string;
  level_id: string;
  level_name: string;
  capacity: number;
  enrolled_count: number;
  status: string;
  slots: {
    id: string;
    weekday: number;
    start_time: string;
    duration_min: number;
  }[];
  enrolled_students?: {
    student_id: string;
    student_name: string;
    student_code: string;
    enrollment_id: string;
    start_date: string;
  }[];
}

export interface InvoiceItem {
  id: string;
  code: string;
  student_id: string;
  student_name: string;
  student_code: string;
  enrollment_id: string;
  class_code: string;
  package_id: string;
  package_name: string;
  sessions_snapshot: number;
  list_price_snapshot: number;
  discount_amount: number;
  discount_reason: string | null;
  amount_due: number;
  status: 'draft' | 'sent' | 'paid' | 'void';
  due_at: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  slots_generated_at: string | null;
  void_reason: string | null;
  created_at: string;
  consumed_credits?: number;
}

export interface SessionItem {
  id: string;
  code: string;
  class_id: string;
  class_code: string;
  scheduled_start: string;
  duration_min: number;
  status: 'scheduled' | 'held' | 'teacher_absent' | 'cancelled' | 'rescheduled';
  teacher_id: string;
  teacher_name: string;
  subject_name: string;
  curriculum_name: string;
  level_name: string;
  class_type: 'private' | 'group';
  teacher_pay_amount: number | null;
  outcome_at: string | null;
  payroll_run_id: string | null;
  note: string | null;
  attendees: {
    attendance_id: string;
    student_id: string;
    student_name: string;
    student_code: string;
    invoice_id: string;
    sequence_no: number;
    outcome: 'expected' | 'attended' | 'no_show' | 'cancelled_notice' | 'void';
    notice_received_at: string | null;
    consumes_credit: boolean;
  }[];
}

export const tutoringService = {
  // Master lists
  async getMasterData() {
    const [
      teachers,
      subjects,
      curricula,
      levels,
      packages,
      packagePrices,
      teacherRates,
      campaigns,
      configRows,
      holidays,
    ] = await Promise.all([
      pool.query(`SELECT id, code, name, status FROM teachers ORDER BY name`),
      pool.query(`SELECT id, name, active FROM subjects ORDER BY name`),
      pool.query(`SELECT id, name, active FROM curricula ORDER BY name`),
      pool.query(`SELECT l.id, l.curriculum_id, l.name, c.name as curriculum_name FROM levels l JOIN curricula c ON c.id = l.curriculum_id ORDER BY c.name, l.name`),
      pool.query(`SELECT id, name, sessions_count, active FROM packages ORDER BY sessions_count`),
      pool.query(`SELECT pp.*, p.name as package_name FROM package_prices pp JOIN packages p ON p.id = pp.package_id ORDER BY pp.effective_from DESC`),
      pool.query(`SELECT tr.*, t.name as teacher_name FROM teacher_rates tr JOIN teachers t ON t.id = tr.teacher_id ORDER BY tr.effective_from DESC`),
      pool.query(`SELECT id, name, channel, spend FROM campaigns ORDER BY name`),
      pool.query(`SELECT key, value FROM config`),
      pool.query(`SELECT day, note FROM holidays ORDER BY day`),
    ]);

    const configMap: Record<string, string> = {};
    configRows.rows.forEach((r) => {
      configMap[r.key] = r.value;
    });

    return {
      teachers: teachers.rows,
      subjects: subjects.rows,
      curricula: curricula.rows,
      levels: levels.rows,
      packages: packages.rows,
      packagePrices: packagePrices.rows,
      teacherRates: teacherRates.rows,
      campaigns: campaigns.rows,
      config: configMap,
      holidays: holidays.rows,
    };
  },

  // Leads & Funnel
  async getLeads(): Promise<Lead[]> {
    const res = await pool.query(`
      SELECT l.*, c.name as campaign_name, s.code as student_code,
        (SELECT count(*) FROM trials t WHERE t.lead_id = l.id) as trials_count
      FROM leads l
      LEFT JOIN campaigns c ON c.id = l.campaign_id
      LEFT JOIN students s ON s.id = l.student_id
      ORDER BY l.created_at DESC
    `);
    return res.rows;
  },

  async getLeadDetails(leadId: string) {
    const [lead, events, trials] = await Promise.all([
      pool.query(`SELECT l.*, c.name as campaign_name FROM leads l LEFT JOIN campaigns c ON c.id = l.campaign_id WHERE l.id = $1`, [leadId]),
      pool.query(`SELECT * FROM lead_events WHERE lead_id = $1 ORDER BY occurred_at ASC`, [leadId]),
      pool.query(`
        SELECT t.*, tc.name as teacher_name, s.name as subject_name, c.name as curriculum_name, l.name as level_name
        FROM trials t
        JOIN teachers tc ON tc.id = t.teacher_id
        JOIN subjects s ON s.id = t.subject_id
        JOIN curricula c ON c.id = t.curriculum_id
        JOIN levels l ON l.id = t.level_id
        WHERE t.lead_id = $1
        ORDER BY t.scheduled_at DESC
      `, [leadId]),
    ]);
    return {
      lead: lead.rows[0] || null,
      events: events.rows,
      trials: trials.rows,
    };
  },

  async createLead(data: { name: string; guardian_name?: string; contact?: string; source_channel: string; campaign_name?: string }) {
    const res = await pool.query(
      `SELECT fn_new_lead($1, $2, $3, $4, $5) as lead_id`,
      [data.name, data.guardian_name || null, data.contact || null, data.source_channel, data.campaign_name || null]
    );
    return res.rows[0].lead_id;
  },

  async updateLeadStage(leadId: string, toStage: string, note?: string, lostReason?: string) {
    await pool.query(
      `SELECT fn_lead_stage($1, $2::lead_stage, $3, now(), $4)`,
      [leadId, toStage, note || null, lostReason || null]
    );
  },

  async bookTrial(data: {
    lead_id: string;
    teacher_id: string;
    subject_id: string;
    curriculum_id: string;
    level_id: string;
    scheduled_at: string;
  }) {
    const scheduledAt = toWita(data.scheduled_at);
    // Conflict check
    const conflict = await pool.query(`
      SELECT * FROM fn_check_conflicts($1, null, $2::timestamptz, 60)
    `, [data.teacher_id, scheduledAt]);

    if (conflict.rows.length > 0) {
      const c = conflict.rows[0];
      throw new UserError(`Schedule collision! Teacher already has session ${c.session_code} at that time.`);
    }

    const res = await pool.query(
      `SELECT fn_book_trial($1, $2, $3, $4, $5, $6::timestamptz, now()) as trial_id`,
      [data.lead_id, data.teacher_id, data.subject_id, data.curriculum_id, data.level_id, scheduledAt]
    );
    return res.rows[0].trial_id;
  },

  async setTrialOutcome(trialId: string, outcome: string, feedback?: string) {
    await pool.query(
      `SELECT fn_trial_outcome($1, $2::trial_outcome, $3, now())`,
      [trialId, outcome, feedback || null]
    );
  },

  async convertLead(leadId: string) {
    const res = await pool.query(`SELECT fn_convert_lead($1) as student_id`, [leadId]);
    return res.rows[0].student_id;
  },

  async getLeadFlow(channel?: string) {
    let whereClause = '';
    const params: any[] = [];
    if (channel && channel !== 'all') {
      params.push(channel);
      whereClause = `WHERE l.source_channel = $1`;
    }

    const { rows: leads } = await pool.query(`
      SELECT l.id, l.code, l.name, l.guardian_name, l.contact, l.source_channel, l.current_stage, l.lost_reason, l.student_id,
        c.name as campaign_name, s.code as student_code,
        EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.to_stage = 'contacted') as was_contacted,
        EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.to_stage = 'trial_booked') as was_booked,
        EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.to_stage = 'trial_attended') as was_attended,
        EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.to_stage = 'offer_made') as was_offered,
        EXISTS (SELECT 1 FROM lead_events e WHERE e.lead_id = l.id AND e.to_stage = 'converted') as was_converted
      FROM leads l
      LEFT JOIN campaigns c ON c.id = l.campaign_id
      LEFT JOIN students s ON s.id = l.student_id
      ${whereClause}
      ORDER BY l.created_at DESC
    `, params);

    return calculateLeadFlow(leads);
  },

  // Students
  async getStudents(): Promise<Student[]> {
    // One row per student. Totals are summed across enrollments; enrollment_id is the enrollment with the
    // lowest balance (the one most likely to need a renewal invoice). Per-enrollment detail is in getStudentDetails.
    const res = await pool.query(`
      SELECT s.*,
        coalesce(sum(b.purchased), 0)::int AS purchased,
        coalesce(sum(b.consumed), 0)::int AS consumed,
        coalesce(sum(b.balance), 0)::int AS balance,
        (array_agg(e.id ORDER BY b.balance ASC NULLS LAST, e.start_date DESC) FILTER (WHERE e.id IS NOT NULL))[1] AS enrollment_id,
        string_agg(DISTINCT c.code, ', ') AS class_code,
        CASE WHEN count(DISTINCT c.class_type) > 1 THEN 'mixed' ELSE min(c.class_type::text) END AS class_type,
        count(e.id)::int AS enrollments_count
      FROM students s
      LEFT JOIN enrollments e ON e.student_id = s.id AND (e.end_date IS NULL OR e.end_date >= current_date)
      LEFT JOIN classes c ON c.id = e.class_id
      LEFT JOIN v_enrollment_balance b ON b.enrollment_id = e.id
      GROUP BY s.id
      ORDER BY s.name ASC, s.code ASC
    `);
    return res.rows;
  },

  async getStudentDetails(studentId: string) {
    const [student, history, enrollments, invoices, attendances] = await Promise.all([
      pool.query(`SELECT * FROM students WHERE id = $1`, [studentId]),
      pool.query(`SELECT * FROM student_status_history WHERE student_id = $1 ORDER BY effective_from DESC, id DESC`, [studentId]),
      pool.query(`
        SELECT e.*, c.code as class_code, c.class_type, t.name as teacher_name, sub.name as subject_name,
               b.purchased, b.consumed, b.balance
        FROM enrollments e
        JOIN classes c ON c.id = e.class_id
        JOIN teachers t ON t.id = c.teacher_id
        JOIN subjects sub ON sub.id = c.subject_id
        LEFT JOIN v_enrollment_balance b ON b.enrollment_id = e.id
        WHERE e.student_id = $1
        ORDER BY e.start_date DESC
      `, [studentId]),
      pool.query(`SELECT * FROM invoices WHERE student_id = $1 ORDER BY created_at DESC`, [studentId]),
      pool.query(`
        SELECT sa.*, s.scheduled_start, s.duration_min, s.status as session_status,
               c.code as class_code, t.name as teacher_name, sub.name as subject_name
        FROM session_attendance sa
        JOIN sessions s ON s.id = sa.session_id
        JOIN classes c ON c.id = s.class_id
        JOIN teachers t ON t.id = s.teacher_id
        JOIN subjects sub ON sub.id = s.subject_id
        WHERE sa.student_id = $1
        ORDER BY s.scheduled_start DESC
      `, [studentId]),
    ]);

    return {
      student: student.rows[0] || null,
      history: history.rows,
      enrollments: enrollments.rows,
      invoices: invoices.rows,
      attendances: attendances.rows,
    };
  },

  async setStudentStatus(data: {
    student_id: string;
    status: 'active' | 'postponed' | 'churned';
    effective_from?: string;
    reason?: string;
    expected_return_date?: string;
    actor?: string;
  }) {
    await pool.query(
      `SELECT fn_set_student_status($1, $2::student_status, coalesce($3::date, current_date), $4, $5::date, $6)`,
      [
        data.student_id,
        data.status,
        data.effective_from || null,
        data.reason || null,
        data.expected_return_date || null,
        data.actor || 'admin',
      ]
    );

    // If resuming to active, generate pending slots if any
    if (data.status === 'active') {
      await pool.query(`SELECT fn_generate_pending()`);
    }
  },

  // Classes & Scheduling
  async getClasses(teacherId?: string): Promise<ClassItem[]> {
    const res = await pool.query(`
      SELECT c.*,
        t.name as teacher_name, t.code as teacher_code,
        s.name as subject_name,
        cur.name as curriculum_name,
        l.name as level_name,
        (SELECT count(*) FROM enrollments e WHERE e.class_id = c.id AND (e.end_date IS NULL OR e.end_date >= current_date)) as enrolled_count
      FROM classes c
      JOIN teachers t ON t.id = c.teacher_id
      JOIN subjects s ON s.id = c.subject_id
      JOIN curricula cur ON cur.id = c.curriculum_id
      JOIN levels l ON l.id = c.level_id
      WHERE ($1::uuid IS NULL OR c.teacher_id = $1::uuid)
      ORDER BY c.code ASC
    `, [teacherId || null]);

    const classIds = res.rows.map((r) => r.id);
    if (classIds.length === 0) return [];

    const [slotsRes, enrolledRes] = await Promise.all([
      pool.query(
        `SELECT * FROM class_slots WHERE class_id = ANY($1) ORDER BY weekday ASC, start_time ASC`,
        [classIds]
      ),
      pool.query(`
        SELECT e.id as enrollment_id, e.class_id, e.student_id, e.start_date,
               st.name as student_name, st.code as student_code
        FROM enrollments e
        JOIN students st ON st.id = e.student_id
        WHERE e.class_id = ANY($1) AND (e.end_date IS NULL OR e.end_date >= current_date)
        ORDER BY st.name ASC
      `, [classIds]),
    ]);

    const slotsMap: Record<string, any[]> = {};
    slotsRes.rows.forEach((s) => {
      if (!slotsMap[s.class_id]) slotsMap[s.class_id] = [];
      slotsMap[s.class_id].push(s);
    });

    const enrolledMap: Record<string, any[]> = {};
    enrolledRes.rows.forEach((e) => {
      if (!enrolledMap[e.class_id]) enrolledMap[e.class_id] = [];
      enrolledMap[e.class_id].push(e);
    });

    return res.rows.map((c) => ({
      ...c,
      slots: slotsMap[c.id] || [],
      enrolled_students: enrolledMap[c.id] || [],
    }));
  },

  async createClass(data: {
    class_type: 'private' | 'group';
    teacher_id: string;
    subject_id: string;
    curriculum_id: string;
    level_id: string;
    capacity?: number;
    slots: { weekday: number; start_time: string; duration_min?: number }[];
  }) {
    const capacity = data.class_type === 'private' ? 1 : data.capacity || 3;

    // Check teacher rates
    const rateCheck = await pool.query(
      `SELECT fn_rate($1, $2, $3, $4, $5::class_type, current_date) as rate`,
      [data.teacher_id, data.subject_id, data.curriculum_id, data.level_id, data.class_type]
    );

    if (!rateCheck.rows[0].rate) {
      throw new UserError('Teacher has no active rate for this subject, curriculum, level, and class type!');
    }

    if (data.class_type === 'group') {
      const max = parseInt((await pool.query(`SELECT value FROM config WHERE key = 'max_group_capacity'`)).rows[0]?.value || '3', 10);
      if (capacity < 2 || capacity > max) throw new UserError(`Group capacity must be between 2 and ${max}`);
    }
    for (const slot of data.slots) {
      const clash = await pool.query(
        `SELECT class_code FROM fn_check_slot_conflicts($1, $2::int, $3::time, $4::int)`,
        [data.teacher_id, slot.weekday, slot.start_time, slot.duration_min || 60]
      );
      if (clash.rows.length > 0) {
        throw new UserError(`Teacher already teaches ${clash.rows[0].class_code} at that weekly time`);
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const classRes = await client.query(
        `INSERT INTO classes(class_type, teacher_id, subject_id, curriculum_id, level_id, capacity)
         VALUES ($1::class_type, $2, $3, $4, $5, $6) RETURNING id, code`,
        [data.class_type, data.teacher_id, data.subject_id, data.curriculum_id, data.level_id, capacity]
      );
      const classId = classRes.rows[0].id;

      for (const slot of data.slots) {
        await client.query(
          `INSERT INTO class_slots(class_id, weekday, start_time, duration_min)
           VALUES ($1, $2, $3, $4)`,
          [classId, slot.weekday, slot.start_time, slot.duration_min || 60]
        );
      }

      await client.query('COMMIT');
      return classRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async enrollStudent(data: { student_id: string; class_id: string; start_date?: string }) {
    const res = await pool.query(
      `INSERT INTO enrollments(student_id, class_id, start_date)
       VALUES ($1, $2, coalesce($3::date, current_date))
       RETURNING id`,
      [data.student_id, data.class_id, data.start_date || null]
    );
    return res.rows[0].id;
  },

  // Invoices & Billing
  async getInvoices(): Promise<InvoiceItem[]> {
    const res = await pool.query(`
      SELECT i.*,
        st.name as student_name, st.code as student_code,
        c.code as class_code,
        p.name as package_name,
        coalesce((SELECT count(*)::int FROM session_attendance a WHERE a.invoice_id = i.id AND a.consumes_credit), 0) as consumed_credits
      FROM invoices i
      JOIN students st ON st.id = i.student_id
      JOIN enrollments e ON e.id = i.enrollment_id
      JOIN classes c ON c.id = e.class_id
      JOIN packages p ON p.id = i.package_id
      ORDER BY st.name ASC, i.created_at DESC
    `);
    return res.rows;
  },

  async createInvoice(data: {
    enrollment_id: string;
    package_id: string;
    discount_amount?: number;
    discount_reason?: string;
  }) {
    const res = await pool.query(
      `SELECT fn_create_invoice($1, $2, $3, $4, now()) as invoice_id`,
      [data.enrollment_id, data.package_id, data.discount_amount || 0, data.discount_reason || null]
    );
    return res.rows[0].invoice_id;
  },

  async updateInvoiceStatus(invoiceId: string, toStatus: 'sent' | 'paid' | 'void', reason?: string) {
    await pool.query(
      `SELECT fn_set_invoice_status($1, $2::invoice_status, now(), $3)`,
      [invoiceId, toStatus, reason || null]
    );
  },

  // Sessions & Attendance
  async getSessions(options: {
    teacherId?: string;
    classId?: string;
    status?: string;
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<SessionItem[]> {
    let whereClauses: string[] = [];
    let params: any[] = [];

    if (options.teacherId) {
      params.push(options.teacherId);
      whereClauses.push(`s.teacher_id = $${params.length}`);
    }
    if (options.classId) {
      params.push(options.classId);
      whereClauses.push(`s.class_id = $${params.length}`);
    }
    if (options.status) {
      params.push(options.status);
      whereClauses.push(`s.status = $${params.length}::session_status`);
    }
    if (options.from) {
      params.push(options.from);
      whereClauses.push(`s.scheduled_start >= $${params.length}::timestamptz`);
    }
    if (options.to) {
      params.push(options.to);
      whereClauses.push(`s.scheduled_start <= $${params.length}::timestamptz`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const limit = Math.min(Math.max(Math.trunc(Number(options.limit)) || 300, 1), 2000);
    params.push(limit);
    const limitStr = `LIMIT $${params.length}`;

    const res = await pool.query(`
      SELECT s.*,
        c.code as class_code,
        t.name as teacher_name,
        sub.name as subject_name,
        cur.name as curriculum_name,
        l.name as level_name
      FROM sessions s
      JOIN classes c ON c.id = s.class_id
      JOIN teachers t ON t.id = s.teacher_id
      JOIN subjects sub ON sub.id = s.subject_id
      JOIN curricula cur ON cur.id = s.curriculum_id
      JOIN levels l ON l.id = s.level_id
      ${whereStr}
      ORDER BY s.scheduled_start DESC
      ${limitStr}
    `, params);

    const sessionIds = res.rows.map((r) => r.id);
    if (sessionIds.length === 0) return [];

    const attRes = await pool.query(`
      SELECT sa.*,
        st.name as student_name, st.code as student_code
      FROM session_attendance sa
      JOIN students st ON st.id = sa.student_id
      WHERE sa.session_id = ANY($1)
      ORDER BY sa.sequence_no ASC
    `, [sessionIds]);

    const attMap: Record<string, any[]> = {};
    attRes.rows.forEach((a) => {
      if (!attMap[a.session_id]) attMap[a.session_id] = [];
      attMap[a.session_id].push({
        attendance_id: a.id,
        student_id: a.student_id,
        student_name: a.student_name,
        student_code: a.student_code,
        invoice_id: a.invoice_id,
        sequence_no: a.sequence_no,
        outcome: a.outcome,
        notice_received_at: a.notice_received_at,
        consumes_credit: a.consumes_credit,
      });
    });

    return res.rows.map((s) => ({
      ...s,
      attendees: attMap[s.id] || [],
    }));
  },

  async checkInSession(data: {
    session_id: string;
    outcome: 'held' | 'teacher_absent';
    attendees?: Record<string, 'attended' | 'no_show'>;
    admin?: boolean;
    actor_teacher_id?: string | null;
  }) {
    if (data.actor_teacher_id) {
      const own = await pool.query(`SELECT 1 FROM sessions WHERE id = $1 AND teacher_id = $2`, [
        data.session_id,
        data.actor_teacher_id,
      ]);
      if (own.rows.length === 0) throw new UserError('You can only check in your own sessions');
    }
    await pool.query(
      `SELECT fn_checkin($1, $2, $3::jsonb, now(), $4)`,
      [data.session_id, data.outcome, data.attendees ? JSON.stringify(data.attendees) : null, data.admin || false]
    );
  },

  async recordNotice(attendanceId: string, receivedAt?: string) {
    const res = await pool.query(
      `SELECT fn_record_notice($1, coalesce($2::timestamptz, now())) as outcome`,
      [attendanceId, toWita(receivedAt)]
    );
    return res.rows[0].outcome;
  },

  async bookMakeUp(origAttendanceId: string, scheduledAt: string) {
    const at = toWita(scheduledAt);
    if (!at) throw new UserError('Make-up date and time are required');
    const ctx = await pool.query(
      `SELECT s.class_id, s.teacher_id, s.duration_min, sa.student_id
       FROM session_attendance sa JOIN sessions s ON s.id = sa.session_id WHERE sa.id = $1`,
      [origAttendanceId]
    );
    if (ctx.rows.length === 0) throw new UserError('Attendance record not found');
    const c = ctx.rows[0];
    // Joining an existing session of the same class (group) is fine; any other overlap is a conflict.
    const clash = await pool.query(
      `SELECT x.session_code, x.kind FROM fn_check_conflicts($1, $2, $3::timestamptz, $4::int) x
       WHERE x.session_code NOT IN (SELECT code FROM sessions WHERE class_id = $5 AND scheduled_start = $3::timestamptz)`,
      [c.teacher_id, c.student_id, at, c.duration_min, c.class_id]
    );
    if (clash.rows.length > 0) {
      const who = clash.rows[0].kind === 'student_session' ? 'Student' : 'Teacher';
      throw new UserError(`Schedule collision! ${who} already has ${clash.rows[0].session_code} at that time.`);
    }
    const res = await pool.query(`SELECT fn_make_up($1, $2::timestamptz) as attendance_id`, [origAttendanceId, at]);
    return res.rows[0].attendance_id;
  },

  // Payroll
  async getPayrollPreview(start: string, end: string, teacherId?: string) {
    const res = await pool.query(`
      SELECT p.*, t.name as teacher_name, t.code as teacher_code
      FROM fn_payroll_preview($1::date, $2::date) p
      JOIN teachers t ON t.id = p.teacher_id
      WHERE ($3::uuid IS NULL OR p.teacher_id = $3::uuid)
      ORDER BY p.day ASC, t.code ASC
    `, [start, end, teacherId || null]);

    const summary = await pool.query(`
      SELECT t.id as teacher_id, t.code as teacher_code, t.name as teacher_name,
        count(*) filter (where p.kind = 'session') as sessions_count,
        count(*) filter (where p.kind = 'trial') as trials_count,
        sum(p.amount) as total_amount
      FROM fn_payroll_preview($1::date, $2::date) p
      JOIN teachers t ON t.id = p.teacher_id
      WHERE ($3::uuid IS NULL OR p.teacher_id = $3::uuid)
      GROUP BY t.id, t.code, t.name
      ORDER BY t.code ASC
    `, [start, end, teacherId || null]);

    return {
      items: res.rows,
      summary: summary.rows,
    };
  },

  async getPayrollRuns(teacherId?: string) {
    const res = await pool.query(`
      SELECT r.*,
        (SELECT count(*) FROM payroll_lines l WHERE l.run_id = r.id AND ($1::uuid IS NULL OR l.teacher_id = $1::uuid)) as lines_count,
        (SELECT coalesce(sum(amount),0) FROM payroll_lines l WHERE l.run_id = r.id AND ($1::uuid IS NULL OR l.teacher_id = $1::uuid)) as total_amount
      FROM payroll_runs r
      WHERE ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM payroll_lines l2 WHERE l2.run_id = r.id AND l2.teacher_id = $1::uuid))
      ORDER BY r.period_start DESC
    `, [teacherId || null]);
    return res.rows;
  },

  async lockPayroll(start: string, end: string) {
    const v = await pool.query(
      `SELECT ($1::date = date_trunc('month', $1::date)::date)
              AND ($2::date = (date_trunc('month', $1::date) + interval '1 month - 1 day')::date) AS is_month,
              ($2::date <= local_day(now())) AS ended`,
      [start, end]
    );
    if (!v.rows[0].is_month) throw new UserError('Payroll period must be exactly one calendar month');
    if (!v.rows[0].ended) throw new UserError('That period has not ended yet');
    const res = await pool.query(
      `SELECT fn_lock_payroll($1::date, $2::date, now()) as run_id`,
      [start, end]
    );
    return res.rows[0].run_id;
  },

  async getCounts() {
    const res = await pool.query(`
      SELECT (SELECT count(*) FROM leads)::int AS leads,
             (SELECT count(*) FROM students)::int AS students,
             (SELECT count(*) FROM invoices)::int AS invoices
    `);
    return res.rows[0];
  },

  // Scheduled job (FR-4.7): expire postponements older than the limit, then generate slots that were waiting
  async runDailyJobs() {
    const expired = await pool.query(`SELECT fn_expire_postponements(local_day(now())) AS n`);
    const generated = await pool.query(`SELECT fn_generate_pending() AS n`);
    return { postponements_expired: expired.rows[0].n, slots_generated: generated.rows[0].n };
  },

  // Reports & Analytics
  async getReports() {
    const [waterfall, cohort, renewals, exceptions, teacherMonth] = await Promise.all([
      pool.query(`SELECT * FROM fn_waterfall((date_trunc('month', now() AT TIME ZONE tz())::date - interval '5 months')::date, date_trunc('month', now() AT TIME ZONE tz())::date)`),
      pool.query(`
        SELECT cohort_month, source_channel,
          sum(leads) as leads,
          sum(contacted) as contacted,
          sum(trial_booked) as trial_booked,
          sum(trial_attended) as trial_attended,
          sum(offer_made) as offer_made,
          sum(converted) as converted,
          sum(paid) as paid,
          sum(lost) as lost
        FROM v_funnel_cohort
        GROUP BY cohort_month, source_channel
        ORDER BY cohort_month DESC, source_channel ASC
      `),
      pool.query(`SELECT * FROM v_renewal_due ORDER BY balance ASC, student_code ASC`),
      pool.query(`SELECT * FROM v_exceptions ORDER BY kind ASC, ref ASC`),
      pool.query(`SELECT * FROM v_teacher_month ORDER BY month DESC, teacher ASC`),
    ]);

    return {
      waterfall: waterfall.rows,
      cohort: cohort.rows,
      funnelCohort: cohort.rows,
      renewals: renewals.rows,
      exceptions: exceptions.rows,
      teacherMonth: teacherMonth.rows,
    };
  },

  async getWaterfallStudents(month: string, bucket: string) {
    const res = await pool.query(`
      WITH per AS (
        SELECT $1::date AS m, f.student_id,
          fn_in_population(f.student_id, ($1::date - 1)) AS prev,
          fn_in_population(f.student_id, ($1::date + interval '1 month')::date - 1) AS cur,
          date_trunc('month', local_day(f.first_paid_at))::date = $1::date AS first_in_month,
          fn_student_status_on(f.student_id, ($1::date + interval '1 month')::date - 1) = 'postponed' AS postponed_now
        FROM v_student_first_paid f
      )
      SELECT s.id, s.code, s.name, s.guardian_name, s.status, s.expected_return_date,
             f.first_paid_at, p.prev, p.cur, p.first_in_month, p.postponed_now
      FROM per p
      JOIN students s ON s.id = p.student_id
      JOIN v_student_first_paid f ON f.student_id = s.id
      WHERE (
        ($2 = 'opening' AND p.prev) OR
        ($2 = 'new_students' AND p.cur AND NOT p.prev AND p.first_in_month) OR
        ($2 = 'reactivated' AND p.cur AND NOT p.prev AND NOT p.first_in_month) OR
        ($2 = 'dropped' AND p.prev AND NOT p.cur) OR
        ($2 = 'closing' AND p.cur) OR
        ($2 = 'ongoing' AND p.prev AND p.cur) OR
        ($2 = 'of_which_postponed' AND p.prev AND p.cur AND p.postponed_now)
      )
      ORDER BY s.code ASC
    `, [month, bucket]);
    return res.rows;
  },
};
