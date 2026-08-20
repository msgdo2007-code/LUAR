begin;

create table if not exists public.admin_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('referrals.review','referrals.correct','landing_page.manage')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission)
);

alter table public.admin_permissions enable row level security;
alter table public.admin_permissions force row level security;
revoke all on public.admin_permissions from public, anon, authenticated;

insert into public.admin_permissions(user_id, permission, granted_by)
select r.user_id, p.permission, r.granted_by
from public.user_roles r
cross join (values ('referrals.review'),('referrals.correct'),('landing_page.manage')) p(permission)
where r.role = 'admin'
on conflict do nothing;

create or replace function public.has_admin_permission(p_permission text, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.is_luar_admin(p_user_id) and exists (
    select 1 from public.admin_permissions ap where ap.user_id=p_user_id and ap.permission=p_permission
  );
$$;
revoke all on function public.has_admin_permission(text,uuid) from public,anon;
grant execute on function public.has_admin_permission(text,uuid) to authenticated;

create table if not exists public.admin_action_rate_limits (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (char_length(action) between 3 and 80),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key(actor_user_id,action,window_started_at)
);
alter table public.admin_action_rate_limits enable row level security;
alter table public.admin_action_rate_limits force row level security;
revoke all on public.admin_action_rate_limits from public,anon,authenticated;

create or replace function public.consume_admin_rate_limit(p_action text,p_limit integer default 20,p_window_seconds integer default 60)
returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_actor uuid:=public.require_luar_admin(true); v_window timestamptz; v_count integer;
begin
  if p_action !~ '^[a-z0-9_.-]{3,80}$' or p_limit not between 1 and 100 or p_window_seconds not between 10 and 3600 then raise exception 'RATE_CONFIG_INVALID'; end if;
  v_window:=to_timestamp(floor(extract(epoch from now())/p_window_seconds)*p_window_seconds);
  insert into public.admin_action_rate_limits(actor_user_id,action,window_started_at,request_count) values(v_actor,p_action,v_window,1)
  on conflict(actor_user_id,action,window_started_at) do update set request_count=public.admin_action_rate_limits.request_count+1
  returning request_count into v_count;
  if v_count>p_limit then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
  delete from public.admin_action_rate_limits where window_started_at<now()-interval '2 hours';
end; $$;
revoke all on function public.consume_admin_rate_limit(text,integer,integer) from public,anon,authenticated;

alter table public.luar_referrals
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists fraud_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(fraud_flags)='array');

create or replace function public.admin_list_referrals(
  p_search text default '', p_status text default 'all', p_page integer default 1,
  p_page_size integer default 20, p_fraud_only boolean default false
) returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_actor uuid; v_search text:=left(lower(btrim(coalesce(p_search,''))),120);
  v_status text:=lower(coalesce(p_status,'all')); v_page integer:=greatest(1,least(coalesce(p_page,1),100000));
  v_size integer:=greatest(5,least(coalesce(p_page_size,20),100)); v_total bigint; v_items jsonb;
begin
  v_actor:=public.require_luar_admin(true);
  perform public.consume_admin_rate_limit('referrals.review',12,60);
  if not public.has_admin_permission('referrals.review',v_actor) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  if v_status not in ('all','pending','verified','approved','rejected','cancelled') then raise exception 'FILTER_INVALID'; end if;
  with base as (
    select r.id,r.status,r.source,r.created_at,r.updated_at,r.verified_at,r.approved_at,r.rejected_at,r.cancelled_at,
      r.status_reason,r.fraud_flags,r.reviewed_at,
      rp.code,lower(rp.email) referrer_email,
      left(split_part(lower(r.referred_email),'@',1),2)||'***@'||split_part(lower(r.referred_email),'@',2) referred_email_masked,
      coalesce((select count(*) from public.luar_referral_clicks c where c.referrer_user_id=r.referrer_user_id),0) clicks,
      exists(select 1 from public.luar_payments p where p.user_id=r.referred_user_id and p.status='paid') has_paid_purchase
    from public.luar_referrals r join public.luar_referral_profiles rp on rp.user_id=r.referrer_user_id
    where (v_status='all' or r.status=v_status)
      and (not p_fraud_only or jsonb_array_length(r.fraud_flags)>0)
      and (v_search='' or lower(rp.email) like '%'||v_search||'%' or lower(rp.code) like '%'||v_search||'%' or r.id::text=v_search)
  ), counted as (select count(*) total from base), paged as (
    select * from base order by created_at desc offset (v_page-1)*v_size limit v_size
  )
  select counted.total,coalesce((select jsonb_agg(to_jsonb(paged)) from paged),'[]'::jsonb) into v_total,v_items from counted;
  return jsonb_build_object('items',v_items,'total',v_total,'page',v_page,'pageSize',v_size);
end; $$;

create or replace function public.admin_referral_history(p_referral_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_actor uuid; v_items jsonb;
begin
  v_actor:=public.require_luar_admin(true);
  perform public.consume_admin_rate_limit('referrals.mutate',12,60);
  if not public.has_admin_permission('referrals.review',v_actor) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'actorType',a.actor_type,'previousStatus',a.previous_status,
    'newStatus',a.new_status,'reason',a.reason,'createdAt',a.created_at) order by a.created_at desc),'[]'::jsonb)
  into v_items from public.luar_referral_audit a where a.referral_id=p_referral_id;
  return v_items;
end; $$;

create or replace function public.admin_review_referral(p_referral_id bigint,p_action text,p_reason text,p_new_code text default null,p_fraud_flags jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_actor uuid; v_action text:=lower(btrim(coalesce(p_action,''))); v_reason text:=left(btrim(coalesce(p_reason,'')),500);
  v_row public.luar_referrals%rowtype; v_previous text; v_new_referrer uuid; v_code text:=upper(btrim(coalesce(p_new_code,'')));
begin
  v_actor:=public.require_luar_admin(true);
  if not public.has_admin_permission('referrals.review',v_actor) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  if char_length(v_reason)<5 or jsonb_typeof(p_fraud_flags)<>'array' or jsonb_array_length(p_fraud_flags)>10 then raise exception 'INPUT_INVALID'; end if;
  select * into v_row from public.luar_referrals where id=p_referral_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_previous:=v_row.status;
  if v_action='approve' then
    if v_row.status not in ('pending','verified') then raise exception 'TRANSITION_INVALID'; end if;
    update public.luar_referrals set status='approved',approved_at=now(),status_reason=v_reason,fraud_flags=p_fraud_flags,reviewed_by=v_actor,reviewed_at=now(),updated_at=now() where id=p_referral_id returning * into v_row;
  elsif v_action='reject' then
    if v_row.status='approved' then raise exception 'APPROVED_IRREVERSIBLE'; end if;
    update public.luar_referrals set status='rejected',rejected_at=now(),status_reason=v_reason,fraud_flags=p_fraud_flags,reviewed_by=v_actor,reviewed_at=now(),updated_at=now() where id=p_referral_id returning * into v_row;
  elsif v_action='flag' then
    update public.luar_referrals set status_reason=v_reason,fraud_flags=p_fraud_flags,reviewed_by=v_actor,reviewed_at=now(),updated_at=now() where id=p_referral_id returning * into v_row;
  elsif v_action='correct' then
    if not public.has_admin_permission('referrals.correct',v_actor) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
    if v_row.status='approved' or v_code !~ '^[A-Z0-9]{8,16}$' then raise exception 'CORRECTION_INVALID'; end if;
    select user_id into v_new_referrer from public.luar_referral_profiles where code=v_code;
    if v_new_referrer is null or v_new_referrer=v_row.referred_user_id then raise exception 'CORRECTION_INVALID'; end if;
    update public.luar_referrals set referrer_user_id=v_new_referrer,status_reason=v_reason,reviewed_by=v_actor,reviewed_at=now(),updated_at=now() where id=p_referral_id returning * into v_row;
  else raise exception 'ACTION_INVALID'; end if;
  insert into public.luar_referral_audit(referral_id,actor_user_id,actor_type,previous_status,new_status,reason)
  values(p_referral_id,v_actor,'admin',v_previous,v_row.status,v_action||': '||v_reason);
  insert into public.admin_audit_logs(actor_user_id,action,target_type,target_id,metadata)
  values(v_actor,'referral_'||v_action,'referral',p_referral_id::text,jsonb_build_object('from',v_previous,'to',v_row.status,'reason',v_reason,'flags',p_fraud_flags));
  return to_jsonb(v_row)-'referred_email'-'referred_user_id'-'referrer_user_id';
end; $$;

create table if not exists public.landing_page_documents (
  slug text primary key check (slug='home'),
  draft jsonb not null default '{"sections":[]}'::jsonb check (jsonb_typeof(draft)='object'),
  published jsonb not null default '{"sections":[]}'::jsonb check (jsonb_typeof(published)='object'),
  draft_revision integer not null default 0, published_revision integer not null default 0,
  draft_updated_by uuid references auth.users(id) on delete set null,
  published_by uuid references auth.users(id) on delete set null,
  draft_updated_at timestamptz not null default now(), published_at timestamptz
);
create table if not exists public.landing_page_versions (
  id bigint generated by default as identity primary key, slug text not null default 'home' check(slug='home'),
  revision integer not null, previous_content jsonb not null default '{}'::jsonb check(jsonb_typeof(previous_content)='object'), content jsonb not null check(jsonb_typeof(content)='object'), summary text not null check(char_length(summary) between 3 and 200),
  status text not null default 'published' check(status in ('published','restored')),
  published_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(), unique(slug,revision)
);
insert into public.landing_page_documents(slug) values('home') on conflict do nothing;
alter table public.landing_page_documents enable row level security; alter table public.landing_page_documents force row level security;
alter table public.landing_page_versions enable row level security; alter table public.landing_page_versions force row level security;
revoke all on public.landing_page_documents,public.landing_page_versions from public,anon,authenticated;
revoke all on sequence public.landing_page_versions_id_seq from public,anon,authenticated;

create or replace function public.admin_get_landing_editor()
returns jsonb language plpgsql stable security definer set search_path=public,auth,pg_temp as $$
declare v_actor uuid; v_doc public.landing_page_documents%rowtype; v_versions jsonb;
begin
 v_actor:=public.require_luar_admin(true); if not public.has_admin_permission('landing_page.manage',v_actor) then raise exception 'PERMISSION_DENIED'; end if;
 select * into v_doc from public.landing_page_documents where slug='home';
 select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at desc),'[]'::jsonb) into v_versions from (select lv.id,lv.revision,lv.summary,lv.status,lv.created_at,lv.published_by,lower(coalesce(u.email,'')) published_by_email,lv.previous_content,lv.content from public.landing_page_versions lv left join auth.users u on u.id=lv.published_by where lv.slug='home' order by lv.revision desc limit 20) v;
 return jsonb_build_object('draft',v_doc.draft,'published',v_doc.published,'draftRevision',v_doc.draft_revision,'publishedRevision',v_doc.published_revision,'publishedAt',v_doc.published_at,'versions',v_versions);
end; $$;

create or replace function public.admin_save_landing_draft(p_content jsonb,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_actor uuid; v_revision integer;
begin
 v_actor:=public.require_luar_admin(true); if not public.has_admin_permission('landing_page.manage',v_actor) then raise exception 'PERMISSION_DENIED'; end if;
 perform public.consume_admin_rate_limit('landing.draft',20,60);
 if jsonb_typeof(p_content)<>'object' or jsonb_typeof(p_content->'sections')<>'array' or jsonb_array_length(p_content->'sections')>30 then raise exception 'CONTENT_INVALID'; end if;
 update public.landing_page_documents set draft=p_content,draft_revision=draft_revision+1,draft_updated_by=v_actor,draft_updated_at=now()
 where slug='home' and draft_revision=p_expected_revision returning draft_revision into v_revision;
 if not found then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 insert into public.admin_audit_logs(actor_user_id,action,target_type,target_id,metadata) values(v_actor,'landing_draft_save','landing_page','home',jsonb_build_object('revision',v_revision));
 return jsonb_build_object('revision',v_revision);
end; $$;

create or replace function public.admin_publish_landing(p_expected_revision integer,p_summary text)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_actor uuid; v_doc public.landing_page_documents%rowtype; v_summary text:=left(btrim(coalesce(p_summary,'')),200);
begin
 v_actor:=public.require_luar_admin(true); if not public.has_admin_permission('landing_page.manage',v_actor) then raise exception 'PERMISSION_DENIED'; end if;
 perform public.consume_admin_rate_limit('landing.publish',5,60);
 if char_length(v_summary)<3 then raise exception 'SUMMARY_REQUIRED'; end if;
 select * into v_doc from public.landing_page_documents where slug='home' for update;
 if v_doc.draft_revision<>p_expected_revision then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 update public.landing_page_documents set published=v_doc.draft,published_revision=published_revision+1,published_by=v_actor,published_at=now() where slug='home' returning * into v_doc;
 insert into public.landing_page_versions(slug,revision,previous_content,content,summary,status,published_by) values('home',v_doc.published_revision,v_doc.published,v_doc.draft,v_summary,'published',v_actor);
 delete from public.landing_page_versions where id in (select id from public.landing_page_versions where slug='home' order by revision desc offset 20);
 insert into public.admin_audit_logs(actor_user_id,action,target_type,target_id,metadata) values(v_actor,'landing_publish','landing_page','home',jsonb_build_object('revision',v_doc.published_revision,'summary',v_summary));
 return jsonb_build_object('revision',v_doc.published_revision,'publishedAt',v_doc.published_at);
end; $$;

create or replace function public.admin_restore_landing(p_version_id bigint)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_actor uuid; v_content jsonb; v_revision integer;
begin
 v_actor:=public.require_luar_admin(true); if not public.has_admin_permission('landing_page.manage',v_actor) then raise exception 'PERMISSION_DENIED'; end if;
 perform public.consume_admin_rate_limit('landing.restore',5,60);
 select content into v_content from public.landing_page_versions where id=p_version_id and slug='home'; if not found then raise exception 'NOT_FOUND'; end if;
 update public.landing_page_documents set draft=v_content,draft_revision=draft_revision+1,draft_updated_by=v_actor,draft_updated_at=now() where slug='home' returning draft_revision into v_revision;
 insert into public.admin_audit_logs(actor_user_id,action,target_type,target_id,metadata) values(v_actor,'landing_restore_to_draft','landing_page','home',jsonb_build_object('versionId',p_version_id,'draftRevision',v_revision));
 return jsonb_build_object('revision',v_revision);
end; $$;

create or replace function public.admin_cancel_landing_draft(p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_actor uuid; v_revision integer;
begin
 v_actor:=public.require_luar_admin(true); if not public.has_admin_permission('landing_page.manage',v_actor) then raise exception 'PERMISSION_DENIED'; end if;
 perform public.consume_admin_rate_limit('landing.cancel',5,60);
 update public.landing_page_documents set draft=published,draft_revision=draft_revision+1,draft_updated_by=v_actor,draft_updated_at=now()
 where slug='home' and draft_revision=p_expected_revision returning draft_revision into v_revision;
 if not found then raise exception 'REVISION_CONFLICT' using errcode='40001'; end if;
 insert into public.admin_audit_logs(actor_user_id,action,target_type,target_id,metadata) values(v_actor,'landing_draft_cancel','landing_page','home',jsonb_build_object('revision',v_revision));
 return jsonb_build_object('revision',v_revision);
end; $$;

revoke all on function public.admin_list_referrals(text,text,integer,integer,boolean),public.admin_referral_history(bigint),public.admin_review_referral(bigint,text,text,text,jsonb),public.admin_get_landing_editor(),public.admin_save_landing_draft(jsonb,integer),public.admin_publish_landing(integer,text),public.admin_restore_landing(bigint),public.admin_cancel_landing_draft(integer) from public,anon;
grant execute on function public.admin_list_referrals(text,text,integer,integer,boolean),public.admin_referral_history(bigint),public.admin_review_referral(bigint,text,text,text,jsonb),public.admin_get_landing_editor(),public.admin_save_landing_draft(jsonb,integer),public.admin_publish_landing(integer,text),public.admin_restore_landing(bigint),public.admin_cancel_landing_draft(integer) to authenticated;

commit;
