import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../supabase/migrations/20260818180000_account_sync_revision.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../supabase/rollbacks/20260818180000_account_sync_revision.rollback.sql', import.meta.url), 'utf8');
const endpoint = await readFile(new URL('../api/account-state.js', import.meta.url), 'utf8');
const client = await readFile(new URL('../app.js', import.meta.url), 'utf8');

test('migracao e inicialmente aditiva e preserva state/state_updated_at', () => {
  assert.match(migration, /begin;\s*set local role postgres;/i);
  assert.match(migration, /add column if not exists state_revision bigint not null default 0/i);
  assert.match(migration, /add column if not exists state_schema_version integer not null default 1/i);
  assert.doesNotMatch(migration, /drop column[^;]*(?:state|state_updated_at)/i);
});

test('operacoes idempotentes possuem chave unica por conta e UUID', () => {
  assert.match(migration, /primary key \(account_email, operation_id\)/i);
  assert.match(migration, /operation_id uuid not null/i);
  assert.match(migration, /request_fingerprint text not null/i);
  assert.match(migration, /SYNC_IDEMPOTENCY_MISMATCH/);
});

test('RPC valida propriedade e incrementa revisao atomicamente', () => {
  assert.match(migration, /for update/i);
  assert.match(migration, /p_user_id = any\(v_account\.user_ids\)/i);
  assert.match(migration, /state_revision = state_revision \+ 1/i);
  assert.match(migration, /v_account\.state_revision <> p_expected_revision/i);
  assert.match(migration, /'conflict'::text/i);
});

test('tabela de operacoes continua inacessivel ao navegador', () => {
  assert.match(migration, /force row level security/i);
  assert.match(migration, /revoke all on public\.luar_account_state_operations from public, anon, authenticated/i);
  assert.match(migration, /grant execute[^;]+to service_role/is);
  assert.doesNotMatch(migration, /grant execute[^;]+to (?:anon|authenticated)/is);
});

test('rotulo de dispositivo e generico e nao usa fingerprinting', () => {
  assert.match(migration, /'Celular', 'Computador', 'Outro dispositivo'/);
  assert.doesNotMatch(client, /canvas.*fingerprint|audioContext.*fingerprint|deviceMemory.*hardwareConcurrency/is);
});

test('endpoint usa RPC atomica e revisao numerica', () => {
  assert.match(endpoint, /ACCOUNT_SYNC_V2_ENABLED/);
  assert.match(endpoint, /SYNC_V2_ENABLED/);
  assert.match(endpoint, /rpc\/save_luar_account_state_v2/);
  assert.match(endpoint, /body\.baseRevision/);
  assert.match(endpoint, /operationId/);
  assert.match(endpoint, /syncStatus === "conflict"/);
  assert.match(endpoint, /stateHasContent\(account\.state\).*state_revision.*=== 0/is);
  assert.match(endpoint, /upsertLuarAccount\(\{ email, state_revision: 1 \}\)/);
});

test('cliente nao mescla automaticamente depois de conflito 409', () => {
  const pushStart = client.indexOf('async function pushCloudState');
  const pushEnd = client.indexOf('async function sessionHeaders', pushStart);
  const pushSource = client.slice(pushStart, pushEnd);
  assert.match(pushSource, /response\.status===409&&result\.conflict/);
  assert.match(pushSource, /cloudSyncBlocked=true/);
  assert.doesNotMatch(pushSource, /mergeAccountStates\(/);
  assert.doesNotMatch(pushSource, /applyAccountState\(/);
});

test('interface so mostra salvo depois de resposta bem sucedida', () => {
  const pushStart = client.indexOf('async function pushCloudState');
  const pushEnd = client.indexOf('async function sessionHeaders', pushStart);
  const pushSource = client.slice(pushStart, pushEnd);
  assert.ok(pushSource.indexOf("if(!response.ok)") < pushSource.indexOf("setCloudSyncStatus('saved'"));
  assert.match(client, /Salvando/);
  assert.match(client, /Altera(?:c|ç)(?:o|õ)es pendentes/iu);
  assert.match(client, /Erro ao sincronizar/);
});

test('login nao envia recuperacao local antes de confirmar o estado oficial', () => {
  assert.match(client, /cloudBootstrapConfirmed=false/);
  assert.match(client, /cloudBootstrapConfirmed=true;cloudAccount=result/);
  assert.match(client, /cloudBootstrapConfirmed&&stateHasContent\(state\)&&\(choice\.upload\|\|accountEncodingRepaired\)/);
});

test('revalidacao nao substitui alteracoes ainda pendentes', () => {
  const start = client.indexOf('async function revalidateCloudState');
  const end = client.indexOf('function stopCloudRevalidation', start);
  const source = client.slice(start, end);
  assert.match(source, /await refreshOfflineQueueStatus/);
  assert.match(source, /if\(offlineQueueCount>0\)/);
  assert.ok(source.indexOf('if(offlineQueueCount>0)') < source.indexOf("accountApiFetch('/api/account-state'"));
});

test('rate limit vira espera recuperavel sem reduzir a protecao do servidor', () => {
  assert.match(endpoint, /Retry-After", "60"/);
  assert.match(client, /error\.status===429\?'pending':'error'/);
  assert.match(endpoint, /rateScope, req\.method === "GET" \? 90 : 35/);
  assert.match(endpoint, /`\$\{rateScope\}:user`, req\.method === "GET" \? 120 : 40/);
  assert.match(endpoint, /categoryRequest \? "account-categories" : "account-state"/);
  assert.match(endpoint, /req\.method\.toLowerCase\(\)/);
  assert.match(endpoint, /user\.id/);
});

test('rollback remove somente estruturas adicionadas nesta fase', () => {
  assert.match(rollback, /drop function if exists public\.save_luar_account_state_v2/i);
  assert.match(rollback, /drop table if exists public\.luar_account_state_operations/i);
  assert.match(rollback, /drop column if exists state_revision/i);
  assert.doesNotMatch(rollback, /drop (?:table|column)[^;]*(?:luar_accounts|\bstate\b)/i);
});
