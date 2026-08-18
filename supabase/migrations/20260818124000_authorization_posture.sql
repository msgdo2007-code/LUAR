begin;

-- Preserve the public signature used by existing policies, but deliberately
-- ignore the caller-provided UUID. Authorization always derives from auth.uid().
create or replace function public.is_luar_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.user_roles role_row
    where role_row.user_id = (select auth.uid()) and role_row.role = 'admin'
  );
$$;

revoke all on function public.is_luar_admin(uuid) from public, anon;
grant execute on function public.is_luar_admin(uuid) to authenticated;

drop policy if exists user_roles_admin_select on public.user_roles;
create policy user_roles_admin_select on public.user_roles for select to authenticated
using ((select public.is_luar_admin()));

drop policy if exists admin_feedback_admin_select on public.admin_feedback;
create policy admin_feedback_admin_select on public.admin_feedback for select to authenticated
using ((select public.is_luar_admin()));

drop policy if exists admin_feedback_admin_update on public.admin_feedback;
create policy admin_feedback_admin_update on public.admin_feedback for update to authenticated
using ((select public.is_luar_admin())) with check ((select public.is_luar_admin()));

create or replace function public.require_luar_admin(p_require_aal2 boolean default true)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_aal text := coalesce((select auth.jwt())->>'aal', 'aal1');
begin
  if not public.is_luar_admin(v_user_id) then
    raise exception 'ADMIN_FORBIDDEN' using errcode = '42501';
  end if;
  if p_require_aal2 and v_aal <> 'aal2' then
    raise exception 'MFA_REQUIRED' using errcode = '42501';
  end if;
  return v_user_id;
end;
$$;

revoke all on function public.require_luar_admin(boolean) from public, anon;
grant execute on function public.require_luar_admin(boolean) to authenticated;

-- Backend-only tables stay inaccessible through the public Data API. FORCE
-- also protects against accidental access by a table owner without BYPASSRLS.
alter table public.luar_accounts force row level security;
alter table public.luar_payments force row level security;
alter table public.luar_lifetime_admin_audit force row level security;
alter table public.luar_referral_profiles force row level security;
alter table public.luar_referrals force row level security;
alter table public.luar_api_rate_limits force row level security;
alter table public.user_roles force row level security;
alter table public.admin_feedback force row level security;
alter table public.admin_audit_logs force row level security;

revoke all on public.luar_accounts from public, anon, authenticated;
revoke all on public.luar_payments from public, anon, authenticated;
revoke all on public.luar_lifetime_admin_audit from public, anon, authenticated;
revoke all on public.luar_referral_profiles from public, anon, authenticated;
revoke all on public.luar_referrals from public, anon, authenticated;
revoke all on public.luar_api_rate_limits from public, anon, authenticated;

create or replace function public.luar_security_posture()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_table text;
  v_function record;
  v_public_buckets bigint := 0;
  v_violations jsonb := '[]'::jsonb;
  v_backend_tables constant text[] := array[
    'luar_accounts', 'luar_payments', 'luar_lifetime_admin_audit',
    'luar_referral_profiles', 'luar_referrals', 'luar_api_rate_limits'
  ];
begin
  for v_table in
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = format('public.%I', v_table)::regclass) then
      v_violations := v_violations || jsonb_build_array(jsonb_build_object('code', 'RLS_DISABLED', 'object', v_table));
    end if;
  end loop;

  foreach v_table in array v_backend_tables loop
    if pg_catalog.to_regclass(format('public.%I', v_table)) is null then
      v_violations := v_violations || jsonb_build_array(jsonb_build_object('code', 'TABLE_MISSING', 'object', v_table));
    else
      if pg_catalog.has_table_privilege('anon', format('public.%I', v_table), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        v_violations := v_violations || jsonb_build_array(jsonb_build_object('code', 'ANON_TABLE_GRANT', 'object', v_table));
      end if;
      if pg_catalog.has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
        v_violations := v_violations || jsonb_build_array(jsonb_build_object('code', 'AUTH_TABLE_GRANT', 'object', v_table));
      end if;
    end if;
  end loop;

  for v_function in
    select p.oid, p.oid::regprocedure::text as identity
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and (p.proname like 'luar_%' or p.proname like 'admin_%' or p.proname in ('is_luar_admin', 'require_luar_admin', 'preserve_luar_lifetime', 'consume_luar_rate_limit', 'record_luar_login'))
  loop
    if not exists (
      select 1 from unnest(coalesce((select p.proconfig from pg_catalog.pg_proc p where p.oid = v_function.oid), array[]::text[])) setting
      where setting like 'search_path=%'
    ) then
      v_violations := v_violations || jsonb_build_array(jsonb_build_object('code', 'DEFINER_WITHOUT_SEARCH_PATH', 'object', v_function.identity));
    end if;
  end loop;

  if pg_catalog.to_regclass('storage.buckets') is not null then
    execute 'select count(*) from storage.buckets where public is true' into v_public_buckets;
    if v_public_buckets > 0 then
      v_violations := v_violations || jsonb_build_array(jsonb_build_object('code', 'PUBLIC_STORAGE_BUCKET', 'count', v_public_buckets));
    end if;
  end if;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_violations) = 0,
    'checked_at', clock_timestamp(),
    'violations', v_violations
  );
end;
$$;

revoke all on function public.luar_security_posture() from public, anon, authenticated;
grant execute on function public.luar_security_posture() to service_role;

notify pgrst, 'reload schema';
commit;
