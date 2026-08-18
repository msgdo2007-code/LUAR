begin;
set local role postgres;

alter table public.luar_accounts
  add column if not exists state_revision bigint not null default 0,
  add column if not exists state_schema_version integer not null default 1,
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_sync_device_label text;

alter table public.luar_accounts
  drop constraint if exists luar_accounts_state_revision_check,
  add constraint luar_accounts_state_revision_check check (state_revision >= 0),
  drop constraint if exists luar_accounts_state_schema_version_check,
  add constraint luar_accounts_state_schema_version_check check (state_schema_version between 1 and 1000),
  drop constraint if exists luar_accounts_sync_device_label_check,
  add constraint luar_accounts_sync_device_label_check
    check (last_sync_device_label is null or last_sync_device_label in ('Celular', 'Computador', 'Outro dispositivo'));

create table if not exists public.luar_account_state_operations (
  account_email text not null references public.luar_accounts(email) on update cascade on delete cascade,
  operation_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  base_revision bigint not null check (base_revision >= 0),
  applied_revision bigint not null check (applied_revision > 0),
  state_schema_version integer not null check (state_schema_version between 1 and 1000),
  device_label text not null check (device_label in ('Celular', 'Computador', 'Outro dispositivo')),
  created_at timestamptz not null default now(),
  primary key (account_email, operation_id)
);

create index if not exists luar_account_state_operations_created_idx
  on public.luar_account_state_operations(account_email, created_at desc);

alter table public.luar_account_state_operations enable row level security;
alter table public.luar_account_state_operations force row level security;
revoke all on public.luar_account_state_operations from public, anon, authenticated;

create or replace function public.save_luar_account_state_v2(
  p_email text,
  p_user_id uuid,
  p_operation_id uuid,
  p_operation_fingerprint text,
  p_expected_revision bigint,
  p_state jsonb,
  p_backups jsonb,
  p_state_schema_version integer,
  p_device_label text
)
returns table(
  result_status text,
  result_revision bigint,
  result_state_updated_at timestamptz,
  result_last_synced_at timestamptz,
  result_device_label text,
  result_state jsonb,
  result_backups jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_account public.luar_accounts%rowtype;
  v_operation public.luar_account_state_operations%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_email = '' or p_user_id is null or p_operation_id is null then
    raise exception 'SYNC_INPUT_INVALID';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'SYNC_REVISION_INVALID';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'SYNC_STATE_INVALID';
  end if;
  if p_backups is null or jsonb_typeof(p_backups) <> 'array' then
    raise exception 'SYNC_BACKUPS_INVALID';
  end if;
  if p_state_schema_version is null or p_state_schema_version not between 1 and 1000 then
    raise exception 'SYNC_SCHEMA_INVALID';
  end if;
  if p_device_label not in ('Celular', 'Computador', 'Outro dispositivo') then
    raise exception 'SYNC_DEVICE_INVALID';
  end if;
  if p_operation_fingerprint is null or p_operation_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'SYNC_FINGERPRINT_INVALID';
  end if;

  select * into v_account
  from public.luar_accounts
  where email = v_email
  for update;

  if not found then
    raise exception 'SYNC_ACCOUNT_NOT_FOUND';
  end if;
  if not (p_user_id = any(v_account.user_ids)) then
    raise exception 'SYNC_ACCOUNT_FORBIDDEN';
  end if;

  select * into v_operation
  from public.luar_account_state_operations
  where account_email = v_email and operation_id = p_operation_id;

  if found then
    if v_operation.request_fingerprint <> p_operation_fingerprint then
      raise exception 'SYNC_IDEMPOTENCY_MISMATCH';
    end if;
    return query select
      'duplicate'::text,
      v_account.state_revision,
      v_account.state_updated_at,
      v_account.last_synced_at,
      v_account.last_sync_device_label,
      v_account.state,
      v_account.backups;
    return;
  end if;

  if v_account.state_revision <> p_expected_revision then
    return query select
      'conflict'::text,
      v_account.state_revision,
      v_account.state_updated_at,
      v_account.last_synced_at,
      v_account.last_sync_device_label,
      v_account.state,
      v_account.backups;
    return;
  end if;

  update public.luar_accounts
  set state = p_state,
      backups = p_backups,
      state_revision = state_revision + 1,
      state_schema_version = p_state_schema_version,
      state_updated_at = v_now,
      last_synced_at = v_now,
      last_sync_device_label = p_device_label,
      updated_at = v_now
  where email = v_email
  returning * into v_account;

  insert into public.luar_account_state_operations (
    account_email,
    operation_id,
    actor_user_id,
    request_fingerprint,
    base_revision,
    applied_revision,
    state_schema_version,
    device_label,
    created_at
  ) values (
    v_email,
    p_operation_id,
    p_user_id,
    p_operation_fingerprint,
    p_expected_revision,
    v_account.state_revision,
    p_state_schema_version,
    p_device_label,
    v_now
  );

  return query select
    'applied'::text,
    v_account.state_revision,
    v_account.state_updated_at,
    v_account.last_synced_at,
    v_account.last_sync_device_label,
    v_account.state,
    v_account.backups;
end;
$$;

revoke all on function public.save_luar_account_state_v2(text, uuid, uuid, text, bigint, jsonb, jsonb, integer, text)
  from public, anon, authenticated;
grant execute on function public.save_luar_account_state_v2(text, uuid, uuid, text, bigint, jsonb, jsonb, integer, text)
  to service_role;

commit;
