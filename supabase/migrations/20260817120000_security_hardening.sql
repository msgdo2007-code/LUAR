begin;

-- Limite compartilhado entre todas as instâncias serverless. Nenhum cliente
-- acessa esta tabela diretamente; apenas a service role usada pelas APIs.
create table if not exists public.luar_api_rate_limits (
  bucket_key text primary key check (bucket_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  hits integer not null check (hits >= 0),
  expires_at timestamptz not null
);

create index if not exists luar_api_rate_limits_expires_idx
on public.luar_api_rate_limits(expires_at);

alter table public.luar_api_rate_limits enable row level security;
revoke all on public.luar_api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.luar_api_rate_limits to service_role;

create or replace function public.consume_luar_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_hits integer;
  v_window interval;
begin
  if p_key !~ '^[a-f0-9]{64}$'
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'RATE_LIMIT_INPUT_INVALID' using errcode = '22023';
  end if;

  v_window := make_interval(secs => p_window_seconds);
  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));

  -- Limpeza probabilística mantém a tabela pequena sem penalizar toda chamada.
  if random() < 0.01 then
    delete from public.luar_api_rate_limits
    where expires_at < v_now - interval '1 day';
  end if;

  insert into public.luar_api_rate_limits(bucket_key, window_started_at, hits, expires_at)
  values(p_key, v_now, 1, v_now + v_window)
  on conflict(bucket_key) do update set
    window_started_at = case
      when public.luar_api_rate_limits.expires_at <= v_now then v_now
      else public.luar_api_rate_limits.window_started_at
    end,
    hits = case
      when public.luar_api_rate_limits.expires_at <= v_now then 1
      else public.luar_api_rate_limits.hits + 1
    end,
    expires_at = case
      when public.luar_api_rate_limits.expires_at <= v_now then v_now + v_window
      else public.luar_api_rate_limits.expires_at
    end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_luar_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_luar_rate_limit(text, integer, integer) to service_role;

-- Mantém o acesso negado por padrão em tabelas futuras. Cada nova tabela deve
-- receber RLS e políticas explícitas em sua própria migração.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Reafirma RLS em todas as tabelas atuais do LUAR.
alter table public.luar_accounts enable row level security;
alter table public.luar_payments enable row level security;
alter table public.luar_lifetime_admin_audit enable row level security;
alter table public.luar_referral_profiles enable row level security;
alter table public.luar_referrals enable row level security;
alter table public.user_roles enable row level security;
alter table public.admin_feedback enable row level security;
alter table public.admin_audit_logs enable row level security;

create or replace function public.luar_tables_without_rls()
returns table(table_name text)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select c.relname::text
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity
  order by c.relname;
$$;

revoke all on function public.luar_tables_without_rls() from public, anon, authenticated;
grant execute on function public.luar_tables_without_rls() to service_role;

commit;
