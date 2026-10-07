// IMPORTANT: this file only mirrors the tables for TypeScript typing. The database itself is built from the
// SQL files in db/sql (001..006): sequences for codes, triggers, functions (fn_*), views (v_*) and constraints
// live there. Do NOT run `drizzle-kit push` against the production database, it would not create them
// and could drop objects it does not know about.
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  uuid,
  timestamp,
  date,
  time,
  bigserial,
  serial,
  pgEnum,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";

// Enums
export const classTypeEnum = pgEnum("class_type", ["private", "group"]);
export const leadStageEnum = pgEnum("lead_stage", [
  "new",
  "contacted",
  "trial_booked",
  "trial_attended",
  "offer_made",
  "converted",
  "lost",
]);
export const studentStatusEnum = pgEnum("student_status", ["active", "postponed", "churned"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "sent", "paid", "void"]);
export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "held",
  "teacher_absent",
  "cancelled",
  "rescheduled",
]);
export const attendanceOutcomeEnum = pgEnum("attendance_outcome", [
  "expected",
  "attended",
  "no_show",
  "cancelled_notice",
  "void",
]);
export const trialOutcomeEnum = pgEnum("trial_outcome", [
  "scheduled",
  "attended",
  "no_show",
  "cancelled",
  "rescheduled",
]);

// Application users. Rows are created by invitation (master_admin) or MASTER_ADMIN_EMAILS bootstrap;
// `uid` (Firebase) is linked on the user's first verified login. No role default: access is deny-by-default.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").unique(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role"), // master_admin | admin | teacher | viewer
  teacherId: uuid("teacher_id").references(() => teachers.id),
  active: boolean("active").notNull().default(true),
  invitedBy: text("invited_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Append-only audit trail of API mutations (personal fields redacted)
export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  actorEmail: text("actor_email"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  payload: jsonb("payload"),
  ok: boolean("ok").notNull(),
  error: text("error"),
});

// Config
export const config = pgTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Holidays
export const holidays = pgTable("holidays", {
  day: date("day").primaryKey(),
  note: text("note"),
});

// Subjects
export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  active: boolean("active").default(true),
});

// Curricula
export const curricula = pgTable("curricula", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  active: boolean("active").default(true),
});

// Levels
export const levels = pgTable(
  "levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    curriculumId: uuid("curriculum_id")
      .notNull()
      .references(() => curricula.id),
    name: text("name").notNull(),
    active: boolean("active").default(true),
  },
  (table) => [unique().on(table.curriculumId, table.name)]
);

// Teachers
export const teachers = pgTable("teachers", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
});

// Teacher Rates
export const teacherRates = pgTable(
  "teacher_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    curriculumId: uuid("curriculum_id")
      .notNull()
      .references(() => curricula.id),
    levelId: uuid("level_id")
      .notNull()
      .references(() => levels.id),
    classType: classTypeEnum("class_type").notNull(),
    rate: integer("rate").notNull(),
    effectiveFrom: date("effective_from").notNull(),
  },
  (table) => [
    unique().on(
      table.teacherId,
      table.subjectId,
      table.curriculumId,
      table.levelId,
      table.classType,
      table.effectiveFrom
    ),
  ]
);

// Trial Rates
export const trialRates = pgTable(
  "trial_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    curriculumId: uuid("curriculum_id")
      .notNull()
      .references(() => curricula.id),
    levelId: uuid("level_id")
      .notNull()
      .references(() => levels.id),
    rate: integer("rate").notNull(),
    effectiveFrom: date("effective_from").notNull(),
  },
  (table) => [
    unique().on(
      table.teacherId,
      table.subjectId,
      table.curriculumId,
      table.levelId,
      table.effectiveFrom
    ),
  ]
);

// Packages
export const packages = pgTable("packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  sessionsCount: integer("sessions_count").notNull(),
  active: boolean("active").default(true),
});

// Package Prices
export const packagePrices = pgTable(
  "package_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packages.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    curriculumId: uuid("curriculum_id")
      .notNull()
      .references(() => curricula.id),
    levelId: uuid("level_id")
      .notNull()
      .references(() => levels.id),
    classType: classTypeEnum("class_type").notNull(),
    price: integer("price").notNull(),
    effectiveFrom: date("effective_from").notNull(),
  },
  (table) => [
    unique().on(
      table.packageId,
      table.subjectId,
      table.curriculumId,
      table.levelId,
      table.classType,
      table.effectiveFrom
    ),
  ]
);

// Campaigns
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  channel: text("channel").notNull(),
  spend: integer("spend").default(0),
});

// Leads
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  guardianName: text("guardian_name"),
  contact: text("contact"),
  sourceChannel: text("source_channel").notNull(),
  campaignId: uuid("campaign_id").references(() => campaigns.id),
  currentStage: leadStageEnum("current_stage").notNull().default("new"),
  lostReason: text("lost_reason"),
  studentId: uuid("student_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Lead Events
export const leadEvents = pgTable("lead_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id),
  fromStage: leadStageEnum("from_stage"),
  toStage: leadStageEnum("to_stage").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  note: text("note"),
});

// Trials
export const trials = pgTable("trials", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => teachers.id),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id),
  curriculumId: uuid("curriculum_id")
    .notNull()
    .references(() => curricula.id),
  levelId: uuid("level_id")
    .notNull()
    .references(() => levels.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  outcome: trialOutcomeEnum("outcome").notNull().default("scheduled"),
  payAmount: integer("pay_amount"),
  feedback: text("feedback"),
  payrollRunId: uuid("payroll_run_id"),
});

// Students
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  leadId: uuid("lead_id").references(() => leads.id),
  name: text("name").notNull(),
  guardianName: text("guardian_name"),
  status: studentStatusEnum("status").notNull().default("active"),
  expectedReturnDate: date("expected_return_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Student Status History
export const studentStatusHistory = pgTable("student_status_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  status: studentStatusEnum("status").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  reason: text("reason"),
  actor: text("actor").default("admin"),
});

// Classes
export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  classType: classTypeEnum("class_type").notNull(),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => teachers.id),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id),
  curriculumId: uuid("curriculum_id")
    .notNull()
    .references(() => curricula.id),
  levelId: uuid("level_id")
    .notNull()
    .references(() => levels.id),
  capacity: integer("capacity").notNull(),
  status: text("status").notNull().default("active"),
});

// Class Slots
export const classSlots = pgTable("class_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id),
  weekday: integer("weekday").notNull(),
  startTime: time("start_time").notNull(),
  durationMin: integer("duration_min").notNull().default(60),
  validFrom: date("valid_from").notNull().default("2000-01-01"),
  validTo: date("valid_to"),
});

// Enrollments
export const enrollments = pgTable("enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id),
  startDate: date("start_date").notNull().defaultNow(),
  endDate: date("end_date"),
});

// Invoices
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => enrollments.id),
  packageId: uuid("package_id")
    .notNull()
    .references(() => packages.id),
  sessionsSnapshot: integer("sessions_snapshot").notNull(),
  listPriceSnapshot: integer("list_price_snapshot").notNull(),
  discountAmount: integer("discount_amount").notNull().default(0),
  discountReason: text("discount_reason"),
  amountDue: integer("amount_due").generatedAlwaysAs(sql`list_price_snapshot - discount_amount`),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  dueAt: date("due_at"),
  externalRef: text("external_ref"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paidAmount: integer("paid_amount"),
  slotsGeneratedAt: timestamp("slots_generated_at", { withTimezone: true }),
  voidReason: text("void_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Invoice Events
export const invoiceEvents = pgTable("invoice_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id),
  fromStatus: invoiceStatusEnum("from_status"),
  toStatus: invoiceStatusEnum("to_status").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

// Credit Adjustments
export const creditAdjustments = pgTable("credit_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => enrollments.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
});

// Payroll Runs
export const payrollRuns = pgTable("payroll_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  status: text("status").notNull().default("draft"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
});

// Sessions
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull(),
    status: sessionStatusEnum("status").notNull().default("scheduled"),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => teachers.id),
    subjectId: uuid("subject_id").notNull(),
    curriculumId: uuid("curriculum_id").notNull(),
    levelId: uuid("level_id").notNull(),
    classType: classTypeEnum("class_type").notNull(),
    teacherPayAmount: integer("teacher_pay_amount"),
    outcomeAt: timestamp("outcome_at", { withTimezone: true }),
    payrollRunId: uuid("payroll_run_id").references(() => payrollRuns.id),
    note: text("note"),
  },
  (table) => [unique().on(table.classId, table.scheduledStart)]
);

// Session Attendance
export const sessionAttendance = pgTable(
  "session_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    sequenceNo: integer("sequence_no").notNull(),
    outcome: attendanceOutcomeEnum("outcome").notNull().default("expected"),
    noticeReceivedAt: timestamp("notice_received_at", { withTimezone: true }),
    makeUpOf: uuid("make_up_of"),
    consumesCredit: boolean("consumes_credit").generatedAlwaysAs(sql`outcome in ('attended', 'no_show')`),
  },
  (table) => [
    unique().on(table.invoiceId, table.sequenceNo),
    unique().on(table.sessionId, table.studentId, table.invoiceId),
  ]
);

// Payroll Lines
export const payrollLines = pgTable("payroll_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => payrollRuns.id),
  teacherId: uuid("teacher_id")
    .notNull()
    .references(() => teachers.id),
  sessionId: uuid("session_id").unique().references(() => sessions.id),
  trialId: uuid("trial_id").unique().references(() => trials.id),
  kind: text("kind").notNull(),
  amount: integer("amount").notNull(),
  note: text("note"),
});
