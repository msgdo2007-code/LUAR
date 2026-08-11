alter table public.luar_accounts
  drop constraint if exists luar_accounts_lifetime_source_check;

alter table public.luar_accounts
  add constraint luar_accounts_lifetime_source_check
  check (lifetime_source in ('none', 'purchase', 'legacy', 'bootstrap', 'admin', 'referral'));

comment on column public.luar_accounts.lifetime_source is
  'Origem auditável do Vitalício: compra, legado, bootstrap, admin ou recompensa por indicação.';
