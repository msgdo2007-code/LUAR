-- Manual rollback. Export landing versions and audit data before use.
begin;
drop function if exists public.admin_restore_landing(bigint);
drop function if exists public.admin_publish_landing(integer,text);
drop function if exists public.admin_save_landing_draft(jsonb,integer);
drop function if exists public.admin_get_landing_editor();
drop function if exists public.admin_review_referral(bigint,text,text,text,jsonb);
drop function if exists public.admin_referral_history(bigint);
drop function if exists public.admin_list_referrals(text,text,integer,integer,boolean);
drop function if exists public.has_admin_permission(text,uuid);
drop table if exists public.landing_page_versions;
drop table if exists public.landing_page_documents;
drop table if exists public.admin_permissions;
alter table public.luar_referrals drop column if exists reviewed_by,drop column if exists reviewed_at,drop column if exists fraud_flags;
commit;
