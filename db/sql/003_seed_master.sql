-- 003_seed_master.sql : SYNTHETIC master data. All rates/prices are placeholders, editable by master_admin.
insert into config values
 ('timezone','Asia/Makassar'),('notice_hours','4'),('max_group_capacity','3'),('checkin_grace_days','2'),
 ('postponement_max_months','3'),('postponement_warning_days','14'),('renewal_threshold','1'),('inactivity_months','3');

insert into holidays values ('2026-08-17','Independence Day'),('2026-10-15','synthetic holiday'),('2026-12-25','Christmas');

insert into curricula(name) values ('National (Indonesia)'),('IB'),('Cambridge'),('IGCSE'),('AS/A Level');
insert into levels(curriculum_id,name)
select c.id, l.name from curricula c join (values
 ('National (Indonesia)','SD'),('National (Indonesia)','SMP'),('National (Indonesia)','SMA/SMK'),
 ('IB','PYP'),('IB','MYP'),('IB','DP'),('Cambridge','Primary'),('Cambridge','Lower Secondary'),
 ('IGCSE','IGCSE'),('AS/A Level','AS Level'),('AS/A Level','A2 Level')) l(cur,name) on l.cur=c.name;

insert into subjects(name) values ('Mathematics'),('Additional Mathematics'),('Further Mathematics'),('Mathematics AA (IB)'),
 ('Mathematics AI (IB)'),('Physics'),('Chemistry'),('Biology'),('Integrated Science (IPA)'),('English'),('English Literature'),
 ('Bahasa Indonesia'),('Economics'),('Accounting'),('Business Studies'),('Business Management (IB)'),('History'),('Geography'),
 ('Sociology'),('Psychology'),('Social Studies (IPS)'),('Computer Science'),('ICT/Informatika'),('Mandarin'),('Japanese'),('French'),
 ('Pancasila and Civics (PPKn)'),('Religious Education'),('Physical Education (PJOK)'),('Arts and Culture (Seni Budaya)'),
 ('Theory of Knowledge'),('Extended Essay'),('Art and Design'),('Music');

insert into teachers(name) values ('Rina (synthetic)'),('Budi (synthetic)'),('Sari (synthetic)'),('Dewi (synthetic)');

-- rates: (teacher name prefix, subject, curriculum, level, class_type, rate)
insert into teacher_rates(teacher_id,subject_id,curriculum_id,level_id,class_type,rate,effective_from)
select t.id, s.id, c.id, l.id, r.ct::class_type, r.rate, date '2026-01-01'
from (values
 ('Rina','Mathematics','National (Indonesia)','SMP','private',90000),
 ('Rina','Mathematics','National (Indonesia)','SMA/SMK','private',110000),
 ('Rina','Mathematics','National (Indonesia)','SMA/SMK','group',120000),
 ('Rina','Mathematics','IB','MYP','private',150000),
 ('Rina','Mathematics','IB','DP','private',200000),
 ('Budi','Physics','AS/A Level','AS Level','private',180000),
 ('Budi','Physics','AS/A Level','A2 Level','private',190000),
 ('Budi','Physics','IGCSE','IGCSE','private',160000),
 ('Sari','English','National (Indonesia)','SMP','private',85000),
 ('Sari','English','IGCSE','IGCSE','private',150000),
 ('Sari','English','Cambridge','Lower Secondary','private',130000),
 ('Dewi','Mathematics','National (Indonesia)','SMA/SMK','private',105000),
 ('Dewi','Mathematics','National (Indonesia)','SMA/SMK','group',115000),
 ('Dewi','Chemistry','National (Indonesia)','SMA/SMK','private',105000)
) r(tn,sn,cn,ln,ct,rate)
join teachers t on t.name like r.tn||'%' join subjects s on s.name=r.sn
join curricula c on c.name=r.cn join levels l on l.curriculum_id=c.id and l.name=r.ln;

-- trial rate = 50% of the private rate (synthetic)
insert into trial_rates(teacher_id,subject_id,curriculum_id,level_id,rate,effective_from)
select teacher_id,subject_id,curriculum_id,level_id,rate/2,effective_from from teacher_rates where class_type='private';

insert into packages(name,sessions_count) values ('4-session pack',4),('8-session pack',8);

-- price = avg teacher rate x sessions x factor (private 1.6, group 0.8 per student), rounded to 1000 (synthetic)
insert into package_prices(package_id,subject_id,curriculum_id,level_id,class_type,price,effective_from)
select p.id, tr.subject_id, tr.curriculum_id, tr.level_id, tr.class_type,
       (round(avg(tr.rate) * p.sessions_count * case tr.class_type when 'private' then 1.6 else 0.8 end / 1000) * 1000)::int,
       date '2026-01-01'
from teacher_rates tr cross join packages p
group by p.id, p.sessions_count, tr.subject_id, tr.curriculum_id, tr.level_id, tr.class_type;

insert into campaigns(name,channel,spend) values ('Instagram Jul-Sep','instagram',3000000),('Referral','referral',0),('School fair Aug','event',1500000);
