begin;
set local role postgres;

create table if not exists public.luar_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on update cascade on delete cascade,
  domain text not null check (domain in ('knowledge', 'finance')),
  name text not null check (char_length(name) between 1 and 60),
  normalized_name text not null check (char_length(normalized_name) between 1 and 60),
  color text not null default '#32ff7e' check (color ~ '^#[0-9a-f]{6}$'),
  icon text not null default '◇' check (char_length(icon) between 1 and 16),
  is_default boolean not null default false,
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists luar_categories_active_name_uidx
  on public.luar_categories(user_id, domain, normalized_name)
  where deleted_at is null;

create unique index if not exists luar_categories_one_default_uidx
  on public.luar_categories(user_id, domain)
  where is_default and deleted_at is null;

create index if not exists luar_categories_owner_domain_idx
  on public.luar_categories(user_id, domain, updated_at desc)
  where deleted_at is null;

alter table public.luar_categories enable row level security;
alter table public.luar_categories force row level security;

drop policy if exists luar_categories_select_own on public.luar_categories;
create policy luar_categories_select_own on public.luar_categories
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists luar_categories_insert_own on public.luar_categories;
create policy luar_categories_insert_own on public.luar_categories
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists luar_categories_update_own on public.luar_categories;
create policy luar_categories_update_own on public.luar_categories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists luar_categories_delete_own on public.luar_categories;
create policy luar_categories_delete_own on public.luar_categories
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.luar_categories from public, anon;
grant select, insert, update, delete on public.luar_categories to authenticated;
grant all on public.luar_categories to service_role;

create or replace function public.normalize_luar_category_name(value text)
returns text language sql immutable strict set search_path = pg_catalog
as $$ select lower(regexp_replace(btrim(value), '[[:space:]]+', ' ', 'g')); $$;

create or replace function public.prepare_luar_category_row()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  new.name := regexp_replace(btrim(new.name), '[[:space:]]+', ' ', 'g');
  new.normalized_name := public.normalize_luar_category_name(new.name);
  new.color := lower(new.color);
  new.icon := btrim(new.icon);
  if tg_op = 'UPDATE' then
    new.updated_at := clock_timestamp();
    if new.name is distinct from old.name or new.domain is distinct from old.domain or new.color is distinct from old.color or new.icon is distinct from old.icon or new.is_default is distinct from old.is_default or new.deleted_at is distinct from old.deleted_at then
      new.revision := old.revision + 1;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prepare_luar_category_row_trigger on public.luar_categories;
create trigger prepare_luar_category_row_trigger
before insert or update on public.luar_categories
for each row execute function public.prepare_luar_category_row();

create or replace function public.save_luar_category(
  p_actor_user_id uuid,
  p_category_id uuid,
  p_domain text,
  p_name text,
  p_color text,
  p_icon text,
  p_is_default boolean default false
)
returns setof public.luar_categories
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_id uuid := coalesce(p_category_id, gen_random_uuid());
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '[[:space:]]+', ' ', 'g');
  v_normalized text;
  v_now timestamptz := clock_timestamp();
begin
  if p_actor_user_id is null or not exists(select 1 from auth.users where id = p_actor_user_id) then raise exception 'CATEGORY_ACTOR_INVALID'; end if;
  if p_domain not in ('knowledge', 'finance') then raise exception 'CATEGORY_DOMAIN_INVALID'; end if;
  if char_length(v_name) not between 1 and 60 or v_name ~ '[[:cntrl:]<>]' then raise exception 'CATEGORY_NAME_INVALID'; end if;
  if p_color is null or lower(p_color) !~ '^#[0-9a-f]{6}$' then raise exception 'CATEGORY_COLOR_INVALID'; end if;
  if p_icon is null or char_length(btrim(p_icon)) not between 1 and 16 or p_icon ~ '[[:cntrl:]<>]' then raise exception 'CATEGORY_ICON_INVALID'; end if;
  v_normalized := public.normalize_luar_category_name(v_name);

  if p_category_id is not null and not exists(
    select 1 from public.luar_categories where id = p_category_id and user_id = p_actor_user_id and deleted_at is null
  ) then raise exception 'CATEGORY_NOT_FOUND'; end if;

  if coalesce(p_is_default, false) then
    update public.luar_categories
       set is_default = false, revision = revision + 1, updated_at = v_now
     where user_id = p_actor_user_id and domain = p_domain and is_default and deleted_at is null and id <> v_id;
  end if;

  insert into public.luar_categories(id, user_id, domain, name, normalized_name, color, icon, is_default, created_at, updated_at)
  values(v_id, p_actor_user_id, p_domain, v_name, v_normalized, lower(p_color), btrim(p_icon), coalesce(p_is_default, false), v_now, v_now)
  on conflict (id) do update
    set domain = excluded.domain,
        name = excluded.name,
        normalized_name = excluded.normalized_name,
        color = excluded.color,
        icon = excluded.icon,
        is_default = excluded.is_default,
        revision = public.luar_categories.revision + 1,
        updated_at = v_now
    where public.luar_categories.user_id = p_actor_user_id and public.luar_categories.deleted_at is null;

  return query select * from public.luar_categories where id = v_id and user_id = p_actor_user_id and deleted_at is null;
end;
$$;

create or replace function public.delete_luar_category(p_actor_user_id uuid, p_category_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_changed integer := 0;
begin
  if p_actor_user_id is null or p_category_id is null then raise exception 'CATEGORY_INPUT_INVALID'; end if;
  update public.luar_categories
     set deleted_at = clock_timestamp(), is_default = false, revision = revision + 1, updated_at = clock_timestamp()
   where id = p_category_id and user_id = p_actor_user_id and deleted_at is null;
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end;
$$;

revoke all on function public.normalize_luar_category_name(text) from public, anon, authenticated;
revoke all on function public.prepare_luar_category_row() from public, anon, authenticated;
revoke all on function public.save_luar_category(uuid, uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.delete_luar_category(uuid, uuid) from public, anon, authenticated;
grant execute on function public.save_luar_category(uuid, uuid, text, text, text, text, boolean) to service_role;
grant execute on function public.delete_luar_category(uuid, uuid) to service_role;

commit;

-- Rollback seguro antes de existirem vínculos em produção:
-- begin;
-- drop function if exists public.delete_luar_category(uuid, uuid);
-- drop function if exists public.save_luar_category(uuid, uuid, text, text, text, text, boolean);
-- drop function if exists public.normalize_luar_category_name(text);
-- drop function if exists public.prepare_luar_category_row();
-- drop table if exists public.luar_categories;
-- commit;
