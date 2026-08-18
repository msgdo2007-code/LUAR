begin;
set local role postgres;

revoke all on function public.save_luar_account_state_v2(text, uuid, uuid, text, bigint, jsonb, jsonb, integer, text)
  from public, anon, authenticated, service_role;
drop function if exists public.save_luar_account_state_v2(text, uuid, uuid, text, bigint, jsonb, jsonb, integer, text);

drop table if exists public.luar_account_state_operations;

alter table public.luar_accounts
  drop constraint if exists luar_accounts_state_revision_check,
  drop constraint if exists luar_accounts_state_schema_version_check,
  drop constraint if exists luar_accounts_sync_device_label_check,
  drop column if exists state_revision,
  drop column if exists state_schema_version,
  drop column if exists last_synced_at,
  drop column if exists last_sync_device_label;

commit;
