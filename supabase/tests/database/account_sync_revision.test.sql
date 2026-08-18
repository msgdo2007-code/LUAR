begin;
select plan(10);

select has_column('public', 'luar_accounts', 'state_revision', 'accounts has numeric state revision');
select has_column('public', 'luar_accounts', 'state_schema_version', 'accounts has state schema version');
select has_column('public', 'luar_accounts', 'last_synced_at', 'accounts has server sync timestamp');
select has_column('public', 'luar_accounts', 'last_sync_device_label', 'accounts has generic device label');
select has_table('public', 'luar_account_state_operations', 'idempotent operation table exists');
select col_is_pk('public', 'luar_account_state_operations', array['account_email', 'operation_id'], 'operation id is unique inside account');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.luar_account_state_operations'::regclass), 'operation table forces RLS');
select ok(not has_table_privilege('anon', 'public.luar_account_state_operations', 'SELECT,INSERT,UPDATE,DELETE'), 'anon cannot access operations');
select ok(not has_table_privilege('authenticated', 'public.luar_account_state_operations', 'SELECT,INSERT,UPDATE,DELETE'), 'users cannot access operations directly');
select has_function('public', 'save_luar_account_state_v2', array['text','uuid','uuid','text','bigint','jsonb','jsonb','integer','text'], 'atomic state save RPC exists');

select * from finish();
rollback;
