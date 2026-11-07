-- READ-ONLY checks. These statements only SELECT; they change nothing.

-- 1. The role function the new schema relies on must exist (expect 1 row; security_definer = true).
select p.proname, p.prosecdef as security_definer, pg_get_function_result(p.oid) as returns
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'current_app_role';

-- 2. Your profiles: every row you want to log in with needs role admin/officer and is_active = true.
select id, role, is_active, full_name from public.profiles order by created_at;

-- 3. The new schema must not exist yet (expect 0 rows before you run the migration).
select schema_name from information_schema.schemata where schema_name = 'pms';

-- 4. Old tables still untouched (counts for reference).
select 'locations' t, count(*) from public.locations
union all select 'metric_types', count(*) from public.metric_types
union all select 'performance_records', count(*) from public.performance_records
union all select 'profiles', count(*) from public.profiles;
