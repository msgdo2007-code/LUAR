begin;

create or replace function public.admin_record_security_event(p_action text)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_actor uuid;
  v_action text := lower(btrim(coalesce(p_action, '')));
begin
  v_actor := public.require_luar_admin(true);
  if v_action not in ('password_changed') then
    raise exception 'ACTION_INVALID' using errcode = '22023';
  end if;
  insert into public.admin_audit_logs(actor_user_id, action, target_type, target_id, metadata)
  values(v_actor, v_action, 'admin_user', v_actor::text, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_record_security_event(text) from public, anon;
grant execute on function public.admin_record_security_event(text) to authenticated;

commit;
