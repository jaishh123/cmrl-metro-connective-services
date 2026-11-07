-- =====================================================================
-- Metro Connect PMS  |  Migration 001  |  NEW schema "pms"
-- =====================================================================
-- SAFETY
--   * Creates ONLY new objects inside the new schema "pms".
--   * Does NOT drop, alter, truncate, update or delete anything.
--   * Does NOT touch the "public" schema or auth.users.
--   * Only READS public.profiles / public.current_app_role() so the
--     existing admin/officer logins keep working.
--   * Seeds ONLY the 8 domains and their metric definitions
--     (reference setup, not performance data). No Excel data is imported.
-- =====================================================================

create schema if not exists pms;

-- ---------- Domains ----------
create table if not exists pms.domains (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  is_enabled  boolean not null default true,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now()
);
create unique index if not exists domains_name_unique on pms.domains (lower(trim(name)));

-- ---------- Metric definitions (what each domain measures) ----------
create table if not exists pms.metric_definitions (
  id             uuid primary key default gen_random_uuid(),
  domain_id      uuid not null references pms.domains (id) on delete cascade,
  code           text not null check (code ~ '^[a-z0-9_]+$'),
  label          text not null,
  unit           text not null check (unit in ('count', 'inr', 'ratio')),
  frequency      text not null check (frequency in ('daily', 'monthly')),
  allow_negative boolean not null default false,
  allow_decimal  boolean not null default false,
  sort_order     integer not null default 0,
  unique (domain_id, code),
  unique (id, domain_id, frequency)
);

-- ---------- Daily records: one value per metric per date ----------
create table if not exists pms.daily_records (
  id          uuid primary key default gen_random_uuid(),
  domain_id   uuid not null,
  metric_id   uuid not null,
  frequency   text not null default 'daily' check (frequency = 'daily'),
  record_date date not null check (record_date >= date '2020-01-01'),
  value       numeric(20,6) not null,
  remarks     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_by  uuid,
  foreign key (metric_id, domain_id, frequency)
    references pms.metric_definitions (id, domain_id, frequency),
  unique (metric_id, record_date)
);
create index if not exists daily_records_date_idx   on pms.daily_records (record_date);
create index if not exists daily_records_domain_idx on pms.daily_records (domain_id, record_date);

-- ---------- Monthly records: one value per metric per month ----------
create table if not exists pms.monthly_records (
  id          uuid primary key default gen_random_uuid(),
  domain_id   uuid not null,
  metric_id   uuid not null,
  frequency   text not null default 'monthly' check (frequency = 'monthly'),
  month_start date not null check (month_start = date_trunc('month', month_start)::date),
  value       numeric(20,6) not null,
  remarks     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_by  uuid,
  foreign key (metric_id, domain_id, frequency)
    references pms.metric_definitions (id, domain_id, frequency),
  unique (metric_id, month_start)
);

-- ---------- Validation: negatives / decimals follow the metric definition ----------
create or replace function pms.check_value() returns trigger
language plpgsql set search_path = pms, public as $$
declare m pms.metric_definitions;
begin
  select * into m from pms.metric_definitions where id = new.metric_id;
  if new.value < 0 and not m.allow_negative then
    raise exception 'Negative values are not allowed for "%".', m.label using errcode = 'check_violation';
  end if;
  if not m.allow_decimal and new.value <> trunc(new.value) then
    raise exception 'Only whole numbers are allowed for "%".', m.label using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace function pms.touch_row() returns trigger
language plpgsql as $$
begin new.updated_at = now(); new.updated_by = auth.uid(); return new; end $$;

drop trigger if exists daily_check   on pms.daily_records;
drop trigger if exists monthly_check on pms.monthly_records;
drop trigger if exists daily_touch   on pms.daily_records;
drop trigger if exists monthly_touch on pms.monthly_records;
create trigger daily_check   before insert or update on pms.daily_records   for each row execute function pms.check_value();
create trigger monthly_check before insert or update on pms.monthly_records for each row execute function pms.check_value();
create trigger daily_touch   before update on pms.daily_records   for each row execute function pms.touch_row();
create trigger monthly_touch before update on pms.monthly_records for each row execute function pms.touch_row();

-- ---------- Views. Cumulative is CALCULATED (month-to-date), never stored ----------
create or replace view pms.v_daily with (security_invoker = true) as
select r.id, r.domain_id, d.name as domain_name, d.sort_order as domain_sort,
       r.metric_id, m.code as metric_code, m.label as metric_label, m.unit,
       m.sort_order as metric_sort, r.record_date, r.value,
       sum(r.value) over (partition by r.metric_id, date_trunc('month', r.record_date)
                          order by r.record_date) as cumulative_value,
       r.remarks, r.created_at, r.updated_at
from pms.daily_records r
join pms.domains d            on d.id = r.domain_id
join pms.metric_definitions m on m.id = r.metric_id;

create or replace view pms.v_monthly with (security_invoker = true) as
select r.id, r.domain_id, d.name as domain_name, d.sort_order as domain_sort,
       r.metric_id, m.code as metric_code, m.label as metric_label, m.unit,
       m.sort_order as metric_sort, r.month_start, r.value,
       r.remarks, r.created_at, r.updated_at
from pms.monthly_records r
join pms.domains d            on d.id = r.domain_id
join pms.metric_definitions m on m.id = r.metric_id;

-- ---------- Add a domain together with its default daily metric (one transaction) ----------
create or replace function pms.add_domain(p_name text) returns uuid
language plpgsql set search_path = pms, public as $$
declare v_id uuid; v_name text := trim(p_name);
begin
  if v_name = '' then raise exception 'Domain name cannot be empty.'; end if;
  insert into pms.domains (name, sort_order)
  values (v_name, coalesce((select max(sort_order) + 10 from pms.domains), 10))
  returning id into v_id;
  insert into pms.metric_definitions (domain_id, code, label, unit, frequency, sort_order)
  values (v_id, 'daily_performance', 'Daily Performance', 'count', 'daily', 1);
  return v_id;
end $$;

-- ---------- Security: only signed-in users with an active profile ----------
alter table pms.domains            enable row level security;
alter table pms.metric_definitions enable row level security;
alter table pms.daily_records      enable row level security;
alter table pms.monthly_records    enable row level security;

revoke all on schema pms from public, anon;
revoke all on all tables in schema pms from public, anon, authenticated;
grant usage on schema pms to authenticated;
grant select, insert, update, delete on pms.domains, pms.metric_definitions,
      pms.daily_records, pms.monthly_records to authenticated;
grant select on pms.v_daily, pms.v_monthly to authenticated;
revoke all on function pms.add_domain(text) from public, anon;
grant execute on function pms.add_domain(text) to authenticated;

drop policy if exists "domains read"    on pms.domains;
drop policy if exists "domains write"   on pms.domains;
drop policy if exists "metrics read"    on pms.metric_definitions;
drop policy if exists "metrics write"   on pms.metric_definitions;
drop policy if exists "daily read"      on pms.daily_records;
drop policy if exists "daily insert"    on pms.daily_records;
drop policy if exists "daily update"    on pms.daily_records;
drop policy if exists "daily delete"    on pms.daily_records;
drop policy if exists "monthly read"    on pms.monthly_records;
drop policy if exists "monthly insert"  on pms.monthly_records;
drop policy if exists "monthly update"  on pms.monthly_records;
drop policy if exists "monthly delete"  on pms.monthly_records;

-- Same role rules as the old project: admin = everything; officer = read, add, edit records.
create policy "domains read"  on pms.domains for select to authenticated using (public.current_app_role() is not null);
create policy "domains write" on pms.domains for all    to authenticated using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');
create policy "metrics read"  on pms.metric_definitions for select to authenticated using (public.current_app_role() is not null);
create policy "metrics write" on pms.metric_definitions for all    to authenticated using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy "daily read"   on pms.daily_records for select to authenticated using (public.current_app_role() is not null);
create policy "daily insert" on pms.daily_records for insert to authenticated with check (public.current_app_role() in ('admin','officer'));
create policy "daily update" on pms.daily_records for update to authenticated using (public.current_app_role() in ('admin','officer')) with check (public.current_app_role() in ('admin','officer'));
create policy "daily delete" on pms.daily_records for delete to authenticated using (public.current_app_role() = 'admin');

create policy "monthly read"   on pms.monthly_records for select to authenticated using (public.current_app_role() is not null);
create policy "monthly insert" on pms.monthly_records for insert to authenticated with check (public.current_app_role() in ('admin','officer'));
create policy "monthly update" on pms.monthly_records for update to authenticated using (public.current_app_role() in ('admin','officer')) with check (public.current_app_role() in ('admin','officer'));
create policy "monthly delete" on pms.monthly_records for delete to authenticated using (public.current_app_role() = 'admin');

-- ---------- Seed: the 8 official domains ----------
insert into pms.domains (name, sort_order) values
  ('DLF Cybercity', 10), ('ITPC', 20), ('Kosmo One', 30), ('Keppel', 40),
  ('MTC', 50), ('Pallavaram Parking', 60), ('Thirumangalam Parking', 70), ('SC-GBS', 80)
on conflict do nothing;

-- ---------- Seed: metric definitions taken from the Excel workbook ----------
insert into pms.metric_definitions (domain_id, code, label, unit, frequency, allow_negative, allow_decimal, sort_order)
select d.id, v.code, v.label, v.unit, v.freq, v.is_neg, v.is_dec, v.ord
from (values
  ('DLF Cybercity','daily_performance','Daily Performance','count','daily',false,false,1),
  ('ITPC','daily_performance','Daily Performance','count','daily',false,false,1),
  ('Kosmo One','daily_performance','Daily Performance','count','daily',false,false,1),
  ('Keppel','daily_performance','Daily Performance','count','daily',false,false,1),
  ('SC-GBS','daily_performance','Daily Performance','count','daily',false,false,1),
  ('MTC','ridership','Ridership','count','daily',false,false,1),
  ('MTC','revenue','Revenue','inr','daily',false,true,2),
  ('MTC','gap','GAP','inr','daily',true,true,3),
  ('Pallavaram Parking','vehicle_count','Vehicle Count','count','daily',false,false,1),
  ('Pallavaram Parking','revenue','Revenue','inr','daily',false,true,2),
  ('Thirumangalam Parking','vehicle_count','Vehicle Count','count','daily',false,false,1),
  ('Thirumangalam Parking','revenue','Revenue','inr','daily',false,true,2),
  ('Pallavaram Parking','monthly_vehicle_count','Vehicle Count (monthly)','count','monthly',false,false,10),
  ('Pallavaram Parking','monthly_revenue','Revenue Generated (monthly)','inr','monthly',false,true,11),
  ('Pallavaram Parking','connectivity_expenditure','Connectivity Expenditure','inr','monthly',false,true,12),
  ('Pallavaram Parking','difference','Difference','inr','monthly',true,true,13),
  ('Pallavaram Parking','avg_days','Days counted for Average per Day','count','monthly',false,false,14),
  ('SC-GBS','monthly_users','Monthly Users','count','monthly',false,false,10),
  ('SC-GBS','daily_average_rider','Daily Average Rider','count','monthly',false,true,11),
  ('SC-GBS','alandur_entry_monthly','Monthly Alandur Ridership - Entry','count','monthly',false,false,12),
  ('SC-GBS','alandur_exit_monthly','Monthly Alandur Ridership - Exit','count','monthly',false,false,13),
  ('SC-GBS','alandur_entry_avg_day','Average Alandur Ridership per Day - Entry','count','monthly',false,true,14),
  ('SC-GBS','alandur_exit_avg_day','Average Alandur Ridership per Day - Exit','count','monthly',false,true,15),
  ('SC-GBS','cmrl_ridership_entry_monthly','Monthly CMRL Ridership - Entry','count','monthly',false,false,16),
  ('SC-GBS','alandur_contribution_a','Alandur Contribution to CMRL Ridership % (column 1)','ratio','monthly',false,true,17),
  ('SC-GBS','alandur_contribution_b','Alandur Contribution to CMRL Ridership % (column 2)','ratio','monthly',false,true,18)
) as v(dname, code, label, unit, freq, is_neg, is_dec, ord)
join pms.domains d on lower(d.name) = lower(v.dname)
on conflict (domain_id, code) do nothing;

notify pgrst, 'reload schema';
