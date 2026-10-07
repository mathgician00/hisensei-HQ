-- 006_auth_audit_conflicts.sql : run after 001-003 (and after any schema you already have). Idempotent.
-- Adds: role-aware users table, append-only audit log, conflict checks, renewal view fix.

-- ---------- users (Firebase uid is linked on first login by verified email) ----------
create table if not exists users (
  id serial primary key, uid text unique, email text not null, name text, role text,
  created_at timestamptz default now());
alter table users alter column uid drop not null;
alter table users alter column role drop default;
alter table users add column if not exists teacher_id uuid references teachers(id);
alter table users add column if not exists active boolean not null default true;
alter table users add column if not exists invited_by text;
create unique index if not exists users_email_lower_uq on users (lower(email));
alter table users drop constraint if exists users_role_chk;
alter table users add constraint users_role_chk check (role in ('master_admin','admin','teacher','viewer'));
alter table users drop constraint if exists users_teacher_chk;
alter table users add constraint users_teacher_chk check (role <> 'teacher' or teacher_id is not null);

-- ---------- audit log (API-level: every mutating request, success or failure) ----------
create or replace function trg_append_only() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create table if not exists audit_log (
  id bigserial primary key, at timestamptz not null default now(),
  actor_email text, actor_role text, action text not null, payload jsonb, ok boolean not null, error text);
drop trigger if exists audit_log_ro on audit_log;
create trigger audit_log_ro before update or delete on audit_log for each row execute function trg_append_only();
create index if not exists audit_log_at_idx on audit_log (at desc);

-- ---------- conflict checks (finding #4) ----------
create or replace function fn_check_conflicts(p_teacher uuid, p_student uuid, p_start timestamptz, p_duration int default 60)
returns table (session_code text, kind text) language sql stable as $$
  select s.code, 'teacher_session'::text from sessions s
   where s.teacher_id = p_teacher and s.status in ('scheduled','held')
     and tstzrange(s.scheduled_start, s.scheduled_start + make_interval(mins => s.duration_min))
      && tstzrange(p_start, p_start + make_interval(mins => p_duration))
  union all
  select 'TRIAL'::text, 'teacher_trial'::text from trials t
   where t.teacher_id = p_teacher and t.outcome = 'scheduled'
     and tstzrange(t.scheduled_at, t.scheduled_at + interval '60 minutes')
      && tstzrange(p_start, p_start + make_interval(mins => p_duration))
  union all
  select s.code, 'student_session'::text from session_attendance a join sessions s on s.id = a.session_id
   where p_student is not null and a.student_id = p_student
     and a.outcome in ('expected','attended','no_show') and s.status in ('scheduled','held')
     and tstzrange(s.scheduled_start, s.scheduled_start + make_interval(mins => s.duration_min))
      && tstzrange(p_start, p_start + make_interval(mins => p_duration))
$$;

create or replace function fn_check_slot_conflicts(p_teacher uuid, p_weekday int, p_start time, p_duration int,
  p_exclude_class uuid default null)
returns table (class_code text) language sql stable as $$
  select c.code from class_slots cs join classes c on c.id = cs.class_id
   where c.teacher_id = p_teacher and c.status = 'active' and cs.weekday = p_weekday
     and (p_exclude_class is null or c.id <> p_exclude_class)
     and (cs.valid_to is null or cs.valid_to >= current_date)
     and (cs.start_time, cs.start_time + make_interval(mins => cs.duration_min))
         overlaps (p_start, p_start + make_interval(mins => p_duration))
$$;

-- ---------- renewal view: exclude students outside the active population (finding #2) ----------
create or replace view v_renewal_due as
select b.*, s.code as student_code, s.name
from v_enrollment_balance b join students s on s.id = b.student_id
where s.status = 'active' and b.purchased > 0 and b.balance <= cfg('renewal_threshold')::int
  and fn_in_population(b.student_id, local_day(now()))
  and not exists (select 1 from invoices i where i.enrollment_id = b.enrollment_id and i.status in ('draft','sent'));
