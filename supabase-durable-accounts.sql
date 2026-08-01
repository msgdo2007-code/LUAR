create table if not exists public.luar_accounts (
  email text primary key check (email = lower(btrim(email))),
  user_ids uuid[] not null default '{}',
  plan text not null default 'free' check (plan in ('free', 'lifetime')),
  lifetime_paid_at timestamptz,
  lifetime_transaction_id text unique,
  state jsonb not null default '{}'::jsonb,
  state_updated_at timestamptz,
  backups jsonb not null default '[]'::jsonb check (jsonb_typeof(backups) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.luar_payments (
  transaction_id text primary key,
  account_email text not null references public.luar_accounts(email) on update cascade on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'created',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists luar_payments_account_email_idx on public.luar_payments(account_email);

alter table public.luar_accounts enable row level security;
alter table public.luar_payments enable row level security;
revoke all on public.luar_accounts from anon, authenticated;
revoke all on public.luar_payments from anon, authenticated;

create or replace function public.preserve_luar_lifetime()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.plan = 'lifetime' then
    new.plan := 'lifetime';
    new.lifetime_paid_at := coalesce(old.lifetime_paid_at, new.lifetime_paid_at);
    new.lifetime_transaction_id := coalesce(old.lifetime_transaction_id, new.lifetime_transaction_id);
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_luar_lifetime_trigger on public.luar_accounts;
create trigger preserve_luar_lifetime_trigger
before update on public.luar_accounts
for each row execute function public.preserve_luar_lifetime();

insert into public.luar_accounts (email, user_ids, state, state_updated_at, backups)
select lower(btrim(email)), array_agg(id order by created_at),
       coalesce((array_agg(raw_user_meta_data->'luar_state' order by updated_at desc)
         filter (where jsonb_typeof(raw_user_meta_data->'luar_state') = 'object'))[1], '{}'::jsonb),
       max(nullif(raw_user_meta_data->>'luar_updated_at', '')::timestamptz),
       coalesce((array_agg(raw_user_meta_data->'luar_backups' order by updated_at desc)
         filter (where jsonb_typeof(raw_user_meta_data->'luar_backups') = 'array'))[1], '[]'::jsonb)
from auth.users
where email is not null and btrim(email) <> ''
group by lower(btrim(email))
on conflict (email) do update set
  user_ids = (select array_agg(distinct value) from unnest(public.luar_accounts.user_ids || excluded.user_ids) value),
  state = case when excluded.state_updated_at > public.luar_accounts.state_updated_at then excluded.state else public.luar_accounts.state end,
  state_updated_at = greatest(public.luar_accounts.state_updated_at, excluded.state_updated_at),
  backups = case when excluded.state_updated_at > public.luar_accounts.state_updated_at then excluded.backups else public.luar_accounts.backups end,
  updated_at = now();

-- Compra confirmada antes da adoção deste armazenamento durável.
update public.luar_accounts
set plan = 'lifetime', lifetime_paid_at = coalesce(lifetime_paid_at, now()), updated_at = now()
where email = 'msgdo.2007@gmail.com';

-- O estado e os backups antigos já estão em luar_accounts. Removê-los do JWT
-- evita cabeçalhos de autenticação grandes demais para Vercel e navegadores.
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'luar_state' - 'luar_backups',
    updated_at = now()
where raw_user_meta_data ? 'luar_state' or raw_user_meta_data ? 'luar_backups';
