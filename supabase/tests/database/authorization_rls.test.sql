begin;

select plan(18);

select ok((select bool_and(c.relrowsecurity)
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')), 'all public tables have RLS');

select ok((select bool_and(c.relforcerowsecurity)
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('luar_accounts','luar_payments','luar_lifetime_admin_audit','luar_referral_profiles','luar_referrals','luar_api_rate_limits')), 'backend-only tables force RLS');

select ok(not has_table_privilege('anon', 'public.luar_accounts', 'SELECT,INSERT,UPDATE,DELETE'), 'anon cannot access accounts');
select ok(not has_table_privilege('authenticated', 'public.luar_accounts', 'SELECT,INSERT,UPDATE,DELETE'), 'users cannot access accounts directly');
select ok(not has_table_privilege('anon', 'public.luar_payments', 'SELECT,INSERT,UPDATE,DELETE'), 'anon cannot access payments');
select ok(not has_table_privilege('authenticated', 'public.luar_payments', 'SELECT,INSERT,UPDATE,DELETE'), 'users cannot access payments directly');
select ok(not has_table_privilege('anon', 'public.luar_referrals', 'SELECT,INSERT,UPDATE,DELETE'), 'anon cannot access referrals');
select ok(not has_table_privilege('authenticated', 'public.luar_referrals', 'SELECT,INSERT,UPDATE,DELETE'), 'users cannot access referrals directly');
select ok(not has_table_privilege('anon', 'public.luar_referral_profiles', 'SELECT,INSERT,UPDATE,DELETE'), 'anon cannot access referral profiles');
select ok(not has_table_privilege('authenticated', 'public.luar_referral_profiles', 'SELECT,INSERT,UPDATE,DELETE'), 'users cannot access referral profiles directly');
select ok(not has_table_privilege('anon', 'public.user_roles', 'SELECT,INSERT,UPDATE,DELETE'), 'anon cannot access roles');
select ok(not has_table_privilege('authenticated', 'public.user_roles', 'INSERT,UPDATE,DELETE'), 'users cannot promote themselves');
select ok(not has_function_privilege('anon', 'public.admin_set_lifetime(text,text)', 'EXECUTE'), 'anon cannot change plans');
select ok(not has_function_privilege('anon', 'public.admin_update_feedback(bigint,text,text)', 'EXECUTE'), 'anon cannot run admin feedback mutation');
select ok(not has_function_privilege('authenticated', 'public.record_luar_login(text,uuid)', 'EXECUTE'), 'users cannot forge login audit events');
select ok(not has_function_privilege('authenticated', 'public.consume_luar_rate_limit(text,integer,integer)', 'EXECUTE'), 'users cannot manipulate rate limits');
select ok(not has_function_privilege('authenticated', 'public.luar_security_posture()', 'EXECUTE'), 'users cannot inspect the private security audit');
select is((public.luar_security_posture()->>'ok')::boolean, true, 'authorization posture has no violations');

select * from finish();
rollback;
