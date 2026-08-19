-- Rollback for 20260818170000_referral_state_machine.sql.
-- Normalize new states before restoring the legacy constraint.

update public.luar_referrals
set status = case
  when status in ('pending', 'approved') then 'verified'
  when status = 'rejected' then 'cancelled'
  else status
end;

drop table if exists public.luar_referral_audit;
drop table if exists public.luar_referral_clicks;

drop index if exists public.luar_referrals_referrer_status_idx;
drop index if exists public.luar_referrals_referred_status_idx;

alter table public.luar_referrals
  drop column if exists updated_at,
  drop column if exists attributed_at,
  drop column if exists approved_at,
  drop column if exists rejected_at,
  drop column if exists cancelled_at,
  drop column if exists status_reason;

alter table public.luar_referrals
  drop constraint if exists luar_referrals_status_check;

alter table public.luar_referrals
  add constraint luar_referrals_status_check
  check (status in ('verified', 'cancelled'));
