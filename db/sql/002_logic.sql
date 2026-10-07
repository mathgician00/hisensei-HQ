-- 002_logic.sql : all business rules live here (PRD NFR-6). Every function takes an optional time
-- parameter (p_at / p_now) so history can be simulated with synthetic data.

create or replace function cfg(k text) returns text language sql stable as $$ select value from config where key = k $$;
create or replace function tz() returns text language sql stable as $$ select cfg('timezone') $$;
create or replace function local_day(t timestamptz) returns date language sql stable as $$ select (t at time zone tz())::date $$;

create or replace function fn_rate(p_teacher uuid, p_subject uuid, p_curr uuid, p_level uuid, p_type class_type, p_on date)
returns int language sql stable as $$
  select rate from teacher_rates where teacher_id=p_teacher and subject_id=p_subject and curriculum_id=p_curr
    and level_id=p_level and class_type=p_type and effective_from <= p_on order by effective_from desc limit 1 $$;

create or replace function fn_trial_rate(p_teacher uuid, p_subject uuid, p_curr uuid, p_level uuid, p_on date)
returns int language sql stable as $$
  select rate from trial_rates where teacher_id=p_teacher and subject_id=p_subject and curriculum_id=p_curr
    and level_id=p_level and effective_from <= p_on order by effective_from desc limit 1 $$;

create or replace function fn_price(p_package uuid, p_subject uuid, p_curr uuid, p_level uuid, p_type class_type, p_on date)
returns int language sql stable as $$
  select price from package_prices where package_id=p_package and subject_id=p_subject and curriculum_id=p_curr
    and level_id=p_level and class_type=p_type and effective_from <= p_on order by effective_from desc limit 1 $$;

-- ---------- integrity triggers ----------
create or replace function trg_append_only() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create trigger lead_events_ro   before update or delete on lead_events           for each row execute function trg_append_only();
create trigger status_hist_ro   before update or delete on student_status_history for each row execute function trg_append_only();
create trigger invoice_evt_ro   before update or delete on invoice_events         for each row execute function trg_append_only();
create trigger payroll_lines_ro before update or delete on payroll_lines          for each row execute function trg_append_only();

create or replace function trg_class_rules() returns trigger language plpgsql as $$
begin
  if new.class_type='group' and new.capacity > cfg('max_group_capacity')::int then
    raise exception 'group capacity % exceeds max_group_capacity %', new.capacity, cfg('max_group_capacity'); end if;
  if fn_rate(new.teacher_id,new.subject_id,new.curriculum_id,new.level_id,new.class_type,current_date) is null then
    raise exception 'teacher has no active rate for this subject/curriculum/level/class type'; end if;
  return new;
end $$;
create trigger class_rules before insert or update on classes for each row execute function trg_class_rules();

create or replace function trg_enrollment_capacity() returns trigger language plpgsql as $$
declare v_cap int; v_n int;
begin
  select capacity into v_cap from classes where id=new.class_id;
  select count(*) into v_n from enrollments where class_id=new.class_id and (end_date is null or end_date >= new.start_date);
  if v_n >= v_cap then raise exception 'class is full (capacity %)', v_cap; end if;
  return new;
end $$;
create trigger enrollment_capacity before insert on enrollments for each row execute function trg_enrollment_capacity();

create or replace function trg_freeze_sessions() returns trigger language plpgsql as $$
begin
  if old.payroll_run_id is not null and (new.status, new.teacher_pay_amount, new.teacher_id) is distinct from (old.status, old.teacher_pay_amount, old.teacher_id) then
    raise exception 'session % is in a locked payroll run', old.code; end if;
  return new;
end $$;
create trigger freeze_sessions before update on sessions for each row execute function trg_freeze_sessions();

create or replace function trg_freeze_attendance() returns trigger language plpgsql as $$
begin
  if new.outcome is distinct from old.outcome and exists (select 1 from sessions s where s.id=old.session_id and s.payroll_run_id is not null) then
    raise exception 'attendance belongs to a session in a locked payroll run'; end if;
  return new;
end $$;
create trigger freeze_attendance before update on session_attendance for each row execute function trg_freeze_attendance();

-- ---------- funnel ----------
create or replace function fn_new_lead(p_name text, p_guardian text, p_contact text, p_source text,
  p_campaign text default null, p_at timestamptz default now()) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into leads(name,guardian_name,contact,source_channel,campaign_id,created_at)
  values (p_name,p_guardian,p_contact,p_source,(select id from campaigns where name=p_campaign),p_at) returning id into v;
  insert into lead_events(lead_id,from_stage,to_stage,occurred_at) values (v,null,'new',p_at);
  return v;
end $$;

create or replace function fn_lead_stage(p_lead uuid, p_to lead_stage, p_note text default null,
  p_at timestamptz default now(), p_lost_reason text default null) returns void language plpgsql as $$
declare v_from lead_stage;
begin
  select current_stage into v_from from leads where id=p_lead for update;
  if v_from = p_to then return; end if;
  if p_to='lost' and coalesce(p_lost_reason,'')='' then raise exception 'lost_reason is mandatory'; end if;
  update leads set current_stage=p_to, lost_reason = case when p_to='lost' then p_lost_reason end where id=p_lead;
  insert into lead_events(lead_id,from_stage,to_stage,occurred_at,note) values (p_lead,v_from,p_to,p_at,p_note);
end $$;

create or replace function fn_book_trial(p_lead uuid, p_teacher uuid, p_subject uuid, p_curr uuid, p_level uuid,
  p_when timestamptz, p_now timestamptz default now()) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into trials(lead_id,teacher_id,subject_id,curriculum_id,level_id,scheduled_at,pay_amount)
  values (p_lead,p_teacher,p_subject,p_curr,p_level,p_when, fn_trial_rate(p_teacher,p_subject,p_curr,p_level,local_day(p_now)))
  returning id into v;
  perform fn_lead_stage(p_lead,'trial_booked',null,p_now);
  return v;
end $$;

create or replace function fn_trial_outcome(p_trial uuid, p_outcome trial_outcome, p_feedback text default null,
  p_now timestamptz default now()) returns void language plpgsql as $$
declare v_lead uuid;
begin
  update trials set outcome=p_outcome, feedback=p_feedback where id=p_trial returning lead_id into v_lead;
  if p_outcome='attended' then perform fn_lead_stage(v_lead,'trial_attended',null,p_now); end if;
end $$;

-- ---------- students ----------
create or replace function fn_convert_lead(p_lead uuid, p_at timestamptz default now()) returns uuid language plpgsql as $$
declare l leads%rowtype; v uuid;
begin
  select * into l from leads where id=p_lead for update;
  if l.student_id is not null then return l.student_id; end if;           -- idempotent (AC-1)
  insert into students(lead_id,name,guardian_name,created_at) values (l.id,l.name,l.guardian_name,p_at) returning id into v;
  insert into student_status_history(student_id,status,effective_from,reason) values (v,'active',local_day(p_at),'converted');
  update leads set student_id=v where id=l.id;
  perform fn_lead_stage(l.id,'converted','deal',p_at);
  return v;
end $$;

create or replace function fn_set_student_status(p_student uuid, p_status student_status, p_effective date default current_date,
  p_reason text default null, p_return date default null, p_actor text default 'admin') returns void language plpgsql as $$
begin
  if p_status='postponed' then
    if p_return is null then raise exception 'expected_return_date is mandatory for postponed'; end if;
    if p_return > (p_effective + (cfg('postponement_max_months')||' months')::interval)::date then
      raise exception 'postponement exceeds % months', cfg('postponement_max_months'); end if;
  end if;
  update students set status=p_status, expected_return_date = case when p_status='postponed' then p_return end where id=p_student;
  insert into student_status_history(student_id,status,effective_from,reason,actor) values (p_student,p_status,p_effective,p_reason,p_actor);
end $$;

-- daily job (FR-4.7): postponement older than the maximum becomes churned, dated at the expiry day
create or replace function fn_expire_postponements(p_today date default current_date) returns int language plpgsql as $$
declare r record; n int := 0;
begin
  for r in
    select s.id, (h.effective_from + (cfg('postponement_max_months')||' months')::interval)::date as expiry
    from students s
    join lateral (select effective_from from student_status_history where student_id=s.id and status='postponed'
                  order by effective_from desc, id desc limit 1) h on true
    where s.status='postponed' and (h.effective_from + (cfg('postponement_max_months')||' months')::interval)::date <= p_today
  loop
    perform fn_set_student_status(r.id,'churned',r.expiry,'postponement expired',null,'system'); n := n+1;
  end loop;
  return n;
end $$;

-- ---------- invoices and generation ----------
create or replace function fn_create_invoice(p_enrollment uuid, p_package uuid, p_discount int default 0,
  p_reason text default null, p_at timestamptz default now()) returns uuid language plpgsql as $$
declare c classes%rowtype; e enrollments%rowtype; v_price int; v_n int; v uuid;
begin
  select * into e from enrollments where id=p_enrollment;
  select * into c from classes where id=e.class_id;
  v_price := fn_price(p_package,c.subject_id,c.curriculum_id,c.level_id,c.class_type,local_day(p_at));
  if v_price is null then raise exception 'no package price for this subject/curriculum/level/class type'; end if;
  select sessions_count into v_n from packages where id=p_package;
  insert into invoices(student_id,enrollment_id,package_id,sessions_snapshot,list_price_snapshot,discount_amount,discount_reason,created_at)
  values (e.student_id,p_enrollment,p_package,v_n,v_price,p_discount,p_reason,p_at) returning id into v;
  insert into invoice_events(invoice_id,from_status,to_status,occurred_at) values (v,null,'draft',p_at);
  return v;
end $$;

create or replace function fn_generate_slots(p_invoice uuid) returns int language plpgsql as $$
declare inv invoices%rowtype; enr enrollments%rowtype; cls classes%rowtype; stu students%rowtype;
        v_tz text := tz(); v_start timestamptz; v_last timestamptz; v_n int := 0; r record; v_sess uuid; v_pay int;
begin
  select * into inv from invoices where id=p_invoice for update;
  if inv.status <> 'paid' or inv.slots_generated_at is not null then return 0; end if;   -- idempotent (AC-3)
  select * into enr from enrollments where id=inv.enrollment_id;
  select * into cls from classes where id=enr.class_id;
  select * into stu from students where id=inv.student_id;
  if stu.status = 'postponed' then return 0; end if;                                      -- shows in v_exceptions
  select max(s.scheduled_start) into v_last from session_attendance sa join sessions s on s.id=sa.session_id
   where sa.enrollment_id=enr.id and sa.outcome <> 'void';
  v_start := greatest(inv.paid_at, coalesce(v_last,'-infinity'));                         -- renewals append (AC-4)
  v_pay := fn_rate(cls.teacher_id,cls.subject_id,cls.curriculum_id,cls.level_id,cls.class_type,local_day(inv.paid_at));
  for r in
    select c.ts, c.duration_min, row_number() over (order by c.ts) as rn
    from (select ((days.d + cs.start_time) at time zone v_tz) as ts, cs.duration_min
          from (select (local_day(v_start) + g) as d from generate_series(0,400) g) days
          join class_slots cs on cs.class_id=cls.id and cs.weekday = extract(isodow from days.d)::int
           and days.d >= cs.valid_from and days.d <= coalesce(cs.valid_to,'infinity'::date)
          where not exists (select 1 from holidays h where h.day = days.d)) c
    where c.ts > v_start
      and not exists (select 1 from sessions x where x.class_id=cls.id and x.scheduled_start=c.ts and x.status in ('cancelled','teacher_absent'))
    order by c.ts limit inv.sessions_snapshot
  loop
    insert into sessions(class_id,scheduled_start,duration_min,teacher_id,subject_id,curriculum_id,level_id,class_type,teacher_pay_amount)
    values (cls.id,r.ts,r.duration_min,cls.teacher_id,cls.subject_id,cls.curriculum_id,cls.level_id,cls.class_type,v_pay)
    on conflict (class_id,scheduled_start) do nothing returning id into v_sess;
    if v_sess is null then select id into v_sess from sessions where class_id=cls.id and scheduled_start=r.ts; end if;
    insert into session_attendance(session_id,student_id,enrollment_id,invoice_id,sequence_no)
    values (v_sess,inv.student_id,enr.id,inv.id,r.rn);
    v_n := v_n + 1;
  end loop;
  if v_n > 0 then update invoices set slots_generated_at = now() where id = inv.id; end if;
  return v_n;
end $$;

create or replace function trg_invoice_paid() returns trigger language plpgsql as $$
begin perform fn_generate_slots(new.id); return new; end $$;
create trigger invoice_paid after update of status on invoices
  for each row when (new.status='paid' and old.status is distinct from 'paid') execute function trg_invoice_paid();

create or replace function fn_set_invoice_status(p_invoice uuid, p_to invoice_status, p_at timestamptz default now(),
  p_reason text default null) returns void language plpgsql as $$
declare v_from invoice_status;
begin
  select status into v_from from invoices where id=p_invoice for update;
  if not ((v_from,p_to) in (('draft','sent'),('draft','void'),('sent','paid'),('sent','void'),('paid','void'))) then
    raise exception 'invalid invoice transition % -> %', v_from, p_to; end if;
  if p_to='void' then
    if exists (select 1 from session_attendance where invoice_id=p_invoice and consumes_credit) then
      raise exception 'invoice has consumed credits; use a credit adjustment instead'; end if;
    update session_attendance set outcome='void' where invoice_id=p_invoice and outcome='expected';
    update invoices set status='void', void_reason=p_reason where id=p_invoice;
  elsif p_to='paid' then
    update invoices set status='paid', paid_at=p_at, paid_amount=amount_due where id=p_invoice;   -- full payment only
  else
    update invoices set status=p_to where id=p_invoice;
  end if;
  insert into invoice_events(invoice_id,from_status,to_status,occurred_at) values (p_invoice,v_from,p_to,p_at);
end $$;

-- run after a postponed student returns, or after class slots are added to an enrollment
create or replace function fn_generate_pending() returns int language plpgsql as $$
declare r record; n int := 0;
begin
  for r in select i.id from invoices i join students s on s.id=i.student_id
           where i.status='paid' and i.slots_generated_at is null and s.status='active' loop
    n := n + fn_generate_slots(r.id);
  end loop; return n;
end $$;

-- ---------- notice, check-in ----------
create or replace function fn_autocancel(p_session uuid) returns void language plpgsql as $$
begin
  update sessions set status='cancelled' where id=p_session and status='scheduled'
    and exists (select 1 from session_attendance where session_id=p_session)
    and not exists (select 1 from session_attendance where session_id=p_session and outcome in ('expected','attended','no_show'));
end $$;

create or replace function fn_record_notice(p_att uuid, p_received timestamptz) returns attendance_outcome language plpgsql as $$
declare a session_attendance%rowtype; s sessions%rowtype; v_out attendance_outcome;
begin
  select * into a from session_attendance where id=p_att for update;
  select * into s from sessions where id=a.session_id;
  if a.outcome <> 'expected' then raise exception 'attendance already %', a.outcome; end if;
  update session_attendance set notice_received_at=p_received,
    outcome = case when s.scheduled_start - p_received >= (cfg('notice_hours')||' hours')::interval
                   then 'cancelled_notice'::attendance_outcome else 'expected'::attendance_outcome end
  where id=p_att returning outcome into v_out;
  perform fn_autocancel(a.session_id);
  return v_out;
end $$;

create or replace function fn_checkin(p_session uuid, p_outcome text, p_attendees jsonb default null,
  p_now timestamptz default now(), p_admin boolean default false) returns void language plpgsql as $$
declare s sessions%rowtype; a record; v_o text;
begin
  select * into s from sessions where id=p_session for update;
  if s.status <> 'scheduled' then raise exception 'session is already %', s.status; end if;
  if not p_admin and not (p_now >= s.scheduled_start - interval '15 minutes'
       and local_day(p_now) <= local_day(s.scheduled_start) + cfg('checkin_grace_days')::int) then
    raise exception 'outside check-in window'; end if;
  if p_outcome = 'teacher_absent' then
    update sessions set status='teacher_absent', outcome_at=p_now where id=p_session;
    update session_attendance set outcome='void' where session_id=p_session and outcome='expected';
    return;
  elsif p_outcome <> 'held' then raise exception 'outcome must be held or teacher_absent'; end if;
  for a in select * from session_attendance where session_id=p_session and outcome='expected' loop
    v_o := coalesce(p_attendees->>(a.student_id::text), case when a.notice_received_at is not null then 'no_show' else 'attended' end);
    if v_o not in ('attended','no_show') then raise exception 'attendee outcome must be attended or no_show'; end if;
    update session_attendance set outcome=v_o::attendance_outcome where id=a.id;
  end loop;
  if not exists (select 1 from session_attendance where session_id=p_session and consumes_credit) then
    raise exception 'a held session needs at least one attended/no_show attendee'; end if;
  update sessions set status='held', outcome_at=p_now where id=p_session;
end $$;

-- ---------- payroll ----------
create or replace function fn_payroll_preview(p_start date, p_end date)
returns table (teacher_id uuid, kind text, ref_id uuid, amount int, day date) language sql stable as $$
  select s.teacher_id, 'session', s.id, s.teacher_pay_amount, local_day(s.scheduled_start)
  from sessions s where s.status='held' and s.payroll_run_id is null
    and local_day(s.scheduled_start) between p_start and p_end
    and exists (select 1 from session_attendance a where a.session_id=s.id and a.consumes_credit)
  union all
  select t.teacher_id, 'trial', t.id, t.pay_amount, local_day(t.scheduled_at)
  from trials t where t.outcome='attended' and t.payroll_run_id is null and local_day(t.scheduled_at) between p_start and p_end
$$;

create or replace function fn_lock_payroll(p_start date, p_end date, p_at timestamptz default now()) returns uuid language plpgsql as $$
declare v uuid;
begin
  if exists (select 1 from fn_payroll_preview(p_start,p_end) where amount is null) then
    raise exception 'payable items without a pay amount; fix rates first'; end if;
  insert into payroll_runs(period_start,period_end,status,locked_at) values (p_start,p_end,'locked',p_at) returning id into v;
  insert into payroll_lines(run_id,teacher_id,session_id,trial_id,kind,amount)
    select v, teacher_id, case when kind='session' then ref_id end, case when kind='trial' then ref_id end, kind, amount
    from fn_payroll_preview(p_start,p_end);
  update sessions set payroll_run_id=v where id in (select session_id from payroll_lines where run_id=v and session_id is not null);
  update trials   set payroll_run_id=v where id in (select trial_id   from payroll_lines where run_id=v and trial_id   is not null);
  return v;
end $$;

-- ---------- reporting views and functions ----------
create or replace view v_enrollment_balance as
select e.id as enrollment_id, e.student_id,
  coalesce((select sum(i.sessions_snapshot) from invoices i where i.enrollment_id=e.id and i.status='paid'),0)
  + coalesce((select sum(c.delta) from credit_adjustments c where c.enrollment_id=e.id),0) as purchased,
  (select count(*) from session_attendance a where a.enrollment_id=e.id and a.consumes_credit) as consumed,
  coalesce((select sum(i.sessions_snapshot) from invoices i where i.enrollment_id=e.id and i.status='paid'),0)
  + coalesce((select sum(c.delta) from credit_adjustments c where c.enrollment_id=e.id),0)
  - (select count(*) from session_attendance a where a.enrollment_id=e.id and a.consumes_credit) as balance
from enrollments e;

create or replace view v_renewal_due as
select b.*, s.code as student_code, s.name
from v_enrollment_balance b join students s on s.id=b.student_id
where s.status='active' and b.purchased > 0 and b.balance <= cfg('renewal_threshold')::int
  and not exists (select 1 from invoices i where i.enrollment_id=b.enrollment_id and i.status in ('draft','sent'));

create or replace view v_exceptions as
select 'paid_no_slots' as kind, i.code as ref, 'paid invoice without generated slots (no schedule, or student postponed)' as detail
  from invoices i where i.status='paid' and i.slots_generated_at is null
union all
select 'no_pay_rate', s.code, 'session without teacher pay amount' from sessions s where s.teacher_pay_amount is null and s.status <> 'cancelled'
union all
select 'negative_balance', st.code, 'attendance beyond paid credits (balance '||b.balance||')'
  from v_enrollment_balance b join students st on st.id=b.student_id where b.balance < 0
union all
select 'no_checkin', s.code, 'session ended without check-in'
  from sessions s where s.status='scheduled' and s.scheduled_start + make_interval(mins => s.duration_min) < now();

create or replace view v_funnel_cohort as
select date_trunc('month', l.created_at at time zone tz())::date as cohort_month, l.source_channel,
  count(*) as leads,
  count(*) filter (where exists (select 1 from lead_events e where e.lead_id=l.id and e.to_stage='contacted'))      as contacted,
  count(*) filter (where exists (select 1 from lead_events e where e.lead_id=l.id and e.to_stage='trial_booked'))   as trial_booked,
  count(*) filter (where exists (select 1 from lead_events e where e.lead_id=l.id and e.to_stage='trial_attended')) as trial_attended,
  count(*) filter (where exists (select 1 from lead_events e where e.lead_id=l.id and e.to_stage='offer_made'))     as offer_made,
  count(*) filter (where exists (select 1 from lead_events e where e.lead_id=l.id and e.to_stage='converted'))      as converted,
  count(*) filter (where exists (select 1 from students s join invoices i on i.student_id=s.id and i.status='paid' where s.lead_id=l.id)) as paid,
  count(*) filter (where l.current_stage='lost') as lost
from leads l group by 1,2;

create or replace view v_funnel_period as
select date_trunc('month', occurred_at at time zone tz())::date as month, to_stage as stage, count(*) as events
from lead_events group by 1,2;

create or replace view v_student_first_paid as
select student_id, min(paid_at) as first_paid_at from invoices where status='paid' group by student_id;

create or replace function fn_student_status_on(p_student uuid, p_day date) returns student_status language sql stable as $$
  select status from student_status_history where student_id=p_student and effective_from <= p_day
  order by effective_from desc, id desc limit 1 $$;

create or replace function fn_in_population(p_student uuid, p_day date) returns boolean language plpgsql stable as $$
declare fp timestamptz; st student_status; v_from date;
begin
  select first_paid_at into fp from v_student_first_paid where student_id=p_student;
  if fp is null or local_day(fp) > p_day then return false; end if;
  st := fn_student_status_on(p_student, p_day);
  if st is null or st='churned' then return false; end if;
  if st='postponed' then return true; end if;
  v_from := (date_trunc('month', p_day) - ((cfg('inactivity_months')::int - 1)||' months')::interval)::date;
  return exists (select 1 from invoices i where i.student_id=p_student and i.status='paid' and local_day(i.paid_at) between v_from and p_day)
      or exists (select 1 from session_attendance a join sessions s on s.id=a.session_id
                 where a.student_id=p_student and a.outcome='attended' and local_day(s.scheduled_start) between v_from and p_day);
end $$;

create or replace function fn_waterfall(p_from date, p_to date)
returns table (month date, opening int, new_students int, reactivated int, dropped int, closing int,
               ongoing int, of_which_postponed int, identity_ok boolean) language sql stable as $$
  with months as (
    select (date_trunc('month', p_from)::date + (g||' months')::interval)::date as m
    from generate_series(0, (extract(year from age(date_trunc('month',p_to), date_trunc('month',p_from)))*12
                            + extract(month from age(date_trunc('month',p_to), date_trunc('month',p_from))))::int) g),
  per as (
    select mo.m, f.student_id,
      fn_in_population(f.student_id, (mo.m - 1)) as prev,
      fn_in_population(f.student_id, (mo.m + interval '1 month')::date - 1) as cur,
      date_trunc('month', local_day(f.first_paid_at))::date = mo.m as first_in_month,
      fn_student_status_on(f.student_id, (mo.m + interval '1 month')::date - 1) = 'postponed' as postponed_now
    from months mo cross join v_student_first_paid f),
  agg as (
    select m,
      count(*) filter (where prev)::int as opening,
      count(*) filter (where cur and not prev and first_in_month)::int as new_students,
      count(*) filter (where cur and not prev and not first_in_month)::int as reactivated,
      count(*) filter (where prev and not cur)::int as dropped,
      count(*) filter (where cur)::int as closing,
      count(*) filter (where prev and cur)::int as ongoing,
      count(*) filter (where prev and cur and postponed_now)::int as of_which_postponed
    from per group by m)
  select m, opening, new_students, reactivated, dropped, closing, ongoing, of_which_postponed,
         closing = opening + new_students + reactivated - dropped
  from agg order by m
$$;

create or replace view v_teacher_month as
select t.code as teacher, date_trunc('month', s.scheduled_start at time zone tz())::date as month,
  count(*) filter (where s.status='held') as held, count(*) filter (where s.status='teacher_absent') as absent,
  count(*) filter (where s.status='cancelled') as cancelled, count(*) filter (where s.status='scheduled') as upcoming,
  coalesce(sum(s.teacher_pay_amount) filter (where s.status='held'),0) as pay_estimate
from sessions s join teachers t on t.id=s.teacher_id group by 1,2;

-- ---------- make-up (FR-7.9, admin only) ----------
create or replace function fn_make_up(p_orig uuid, p_when timestamptz) returns uuid language plpgsql as $$
declare o session_attendance%rowtype; os sessions%rowtype; cls classes%rowtype; inv invoices%rowtype;
        v_sess uuid; v uuid; v_used int; v_seq int; v_status session_status;
begin
  select * into o from session_attendance where id=p_orig for update;
  if o.outcome not in ('cancelled_notice','void') then
    raise exception 'make-up requires a released slot (cancelled_notice or void)'; end if;
  select * into inv from invoices where id=o.invoice_id for update;
  select count(*) into v_used from session_attendance where invoice_id=inv.id and outcome in ('expected','attended','no_show');
  if v_used >= inv.sessions_snapshot then raise exception 'no unconsumed credit left on invoice %', inv.code; end if;
  select * into os from sessions where id=o.session_id;
  select * into cls from classes where id=os.class_id;
  insert into sessions(class_id,scheduled_start,duration_min,teacher_id,subject_id,curriculum_id,level_id,class_type,teacher_pay_amount)
  values (cls.id,p_when,os.duration_min,cls.teacher_id,cls.subject_id,cls.curriculum_id,cls.level_id,cls.class_type,
          fn_rate(cls.teacher_id,cls.subject_id,cls.curriculum_id,cls.level_id,cls.class_type,local_day(p_when)))
  on conflict (class_id,scheduled_start) do nothing returning id into v_sess;
  if v_sess is null then select id, status into v_sess, v_status from sessions where class_id=cls.id and scheduled_start=p_when;
    if v_status <> 'scheduled' then raise exception 'target session is not open (%)', v_status; end if; end if;
  select coalesce(max(sequence_no),0)+1 into v_seq from session_attendance where invoice_id=inv.id;
  insert into session_attendance(session_id,student_id,enrollment_id,invoice_id,sequence_no,make_up_of)
  values (v_sess,o.student_id,o.enrollment_id,inv.id,v_seq,o.id) returning id into v;
  return v;
end $$;
