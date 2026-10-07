-- 001_schema.sql : prototype schema (PRD v0.4). Plain Postgres, no RLS/auth yet (Phase 0 item).
-- Business time zone is fixed by config key 'timezone' (GMT+8, Asia/Makassar).

create type class_type        as enum ('private','group');
create type lead_stage        as enum ('new','contacted','trial_booked','trial_attended','offer_made','converted','lost');
create type student_status    as enum ('active','postponed','churned');
create type invoice_status    as enum ('draft','sent','paid','void');
create type session_status    as enum ('scheduled','held','teacher_absent','cancelled','rescheduled');
create type attendance_outcome as enum ('expected','attended','no_show','cancelled_notice','void');
create type trial_outcome     as enum ('scheduled','attended','no_show','cancelled','rescheduled');

create sequence seq_student; create sequence seq_lead; create sequence seq_teacher;
create sequence seq_class;   create sequence seq_invoice; create sequence seq_session;

create table config (key text primary key, value text not null);
create table holidays (day date primary key, note text);

-- master lists
create table subjects  (id uuid primary key default gen_random_uuid(), name text unique not null, active boolean default true);
create table curricula (id uuid primary key default gen_random_uuid(), name text unique not null, active boolean default true);
create table levels    (id uuid primary key default gen_random_uuid(), curriculum_id uuid not null references curricula, name text not null, active boolean default true, unique (curriculum_id, name));

create table teachers (id uuid primary key default gen_random_uuid(),
  code text unique not null default ('T-'||lpad(nextval('seq_teacher')::text,3,'0')),
  name text not null, status text not null default 'active');

create table teacher_rates (id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers, subject_id uuid not null references subjects,
  curriculum_id uuid not null references curricula, level_id uuid not null references levels,
  class_type class_type not null, rate int not null check (rate >= 0), effective_from date not null,
  unique (teacher_id, subject_id, curriculum_id, level_id, class_type, effective_from));

create table trial_rates (id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers, subject_id uuid not null references subjects,
  curriculum_id uuid not null references curricula, level_id uuid not null references levels,
  rate int not null check (rate >= 0), effective_from date not null,
  unique (teacher_id, subject_id, curriculum_id, level_id, effective_from));

create table packages (id uuid primary key default gen_random_uuid(), name text unique not null,
  sessions_count int not null check (sessions_count > 0), active boolean default true);

create table package_prices (id uuid primary key default gen_random_uuid(),
  package_id uuid not null references packages, subject_id uuid not null references subjects,
  curriculum_id uuid not null references curricula, level_id uuid not null references levels,
  class_type class_type not null, price int not null check (price >= 0), effective_from date not null,
  unique (package_id, subject_id, curriculum_id, level_id, class_type, effective_from));

-- marketing / funnel
create table campaigns (id uuid primary key default gen_random_uuid(), name text unique not null, channel text not null, spend int default 0);

create table leads (id uuid primary key default gen_random_uuid(),
  code text unique not null default ('L-'||lpad(nextval('seq_lead')::text,5,'0')),
  name text not null, guardian_name text, contact text, source_channel text not null,
  campaign_id uuid references campaigns, current_stage lead_stage not null default 'new',
  lost_reason text, student_id uuid, created_at timestamptz not null default now(),
  check (current_stage <> 'lost' or lost_reason is not null));

create table lead_events (id bigserial primary key, lead_id uuid not null references leads,
  from_stage lead_stage, to_stage lead_stage not null, occurred_at timestamptz not null default now(), note text);

create table trials (id uuid primary key default gen_random_uuid(), lead_id uuid not null references leads,
  teacher_id uuid not null references teachers, subject_id uuid not null references subjects,
  curriculum_id uuid not null references curricula, level_id uuid not null references levels,
  scheduled_at timestamptz not null, outcome trial_outcome not null default 'scheduled',
  pay_amount int, feedback text, payroll_run_id uuid);

-- students, classes, enrollments
create table students (id uuid primary key default gen_random_uuid(),
  code text unique not null default ('S-'||lpad(nextval('seq_student')::text,5,'0')),
  lead_id uuid unique references leads, name text not null, guardian_name text,
  status student_status not null default 'active', expected_return_date date,
  created_at timestamptz not null default now());
alter table leads add constraint leads_student_fk foreign key (student_id) references students;

create table student_status_history (id bigserial primary key, student_id uuid not null references students,
  status student_status not null, effective_from date not null, reason text, actor text default 'admin');

create table classes (id uuid primary key default gen_random_uuid(),
  code text unique not null default ('C-'||lpad(nextval('seq_class')::text,3,'0')),
  class_type class_type not null, teacher_id uuid not null references teachers,
  subject_id uuid not null references subjects, curriculum_id uuid not null references curricula,
  level_id uuid not null references levels, capacity int not null check (capacity >= 1),
  status text not null default 'active',
  check ((class_type='private' and capacity=1) or (class_type='group' and capacity>=2)));

create table class_slots (id uuid primary key default gen_random_uuid(), class_id uuid not null references classes,
  weekday int not null check (weekday between 1 and 7),  -- ISO: 1=Mon
  start_time time not null, duration_min int not null default 60,
  valid_from date not null default '2000-01-01', valid_to date);

create table enrollments (id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students, class_id uuid not null references classes,
  start_date date not null default current_date, end_date date);

-- invoices (payment tracking only) and credits
create table invoices (id uuid primary key default gen_random_uuid(),
  code text unique not null default ('INV-'||lpad(nextval('seq_invoice')::text,5,'0')),
  student_id uuid not null references students, enrollment_id uuid not null references enrollments,
  package_id uuid not null references packages, sessions_snapshot int not null check (sessions_snapshot > 0),
  list_price_snapshot int not null check (list_price_snapshot >= 0),
  discount_amount int not null default 0, discount_reason text,
  amount_due int generated always as (list_price_snapshot - discount_amount) stored,
  status invoice_status not null default 'draft', due_at date, external_ref text,
  paid_at timestamptz, paid_amount int, slots_generated_at timestamptz, void_reason text,
  created_at timestamptz not null default now(),
  check (discount_amount between 0 and list_price_snapshot),
  check (discount_amount = 0 or coalesce(discount_reason,'') <> ''),
  check (status <> 'paid' or (paid_at is not null and paid_amount = list_price_snapshot - discount_amount)));

create table invoice_events (id bigserial primary key, invoice_id uuid not null references invoices,
  from_status invoice_status, to_status invoice_status not null, occurred_at timestamptz not null default now());

create table credit_adjustments (id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references enrollments,
  invoice_id uuid references invoices, delta int not null, reason text not null);

-- payroll
create table payroll_runs (id uuid primary key default gen_random_uuid(), period_start date not null, period_end date not null,
  status text not null default 'draft' check (status in ('draft','locked')), locked_at timestamptz);

-- sessions (class occurrences) and per-student attendance
create table sessions (id uuid primary key default gen_random_uuid(),
  code text unique not null default ('SES-'||lpad(nextval('seq_session')::text,6,'0')),
  class_id uuid not null references classes, scheduled_start timestamptz not null, duration_min int not null,
  status session_status not null default 'scheduled', teacher_id uuid not null references teachers,
  subject_id uuid not null, curriculum_id uuid not null, level_id uuid not null, class_type class_type not null,
  teacher_pay_amount int, outcome_at timestamptz, payroll_run_id uuid references payroll_runs,
  note text, unique (class_id, scheduled_start));

create table session_attendance (id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions, student_id uuid not null references students,
  enrollment_id uuid not null references enrollments, invoice_id uuid not null references invoices,
  sequence_no int not null, outcome attendance_outcome not null default 'expected',
  notice_received_at timestamptz, make_up_of uuid references session_attendance,
  consumes_credit boolean generated always as (outcome in ('attended','no_show')) stored,
  unique (invoice_id, sequence_no), unique (session_id, student_id, invoice_id));

alter table trials add constraint trials_run_fk foreign key (payroll_run_id) references payroll_runs;

create table payroll_lines (id uuid primary key default gen_random_uuid(), run_id uuid not null references payroll_runs,
  teacher_id uuid not null references teachers, session_id uuid unique references sessions, trial_id uuid unique references trials,
  kind text not null check (kind in ('session','trial','adjustment')), amount int not null, note text,
  check ((kind='session' and session_id is not null) or (kind='trial' and trial_id is not null) or kind='adjustment'));

create index on session_attendance (enrollment_id);
create index on session_attendance (session_id);
create index on sessions (scheduled_start);
create index on sessions (teacher_id, scheduled_start);
create index on lead_events (lead_id, to_stage);
create index on invoices (student_id, status);
