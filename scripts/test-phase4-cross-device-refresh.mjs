import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('revalida nos eventos autorizados sem Supabase Realtime', () => {
  assert.match(app, /visibilitychange[^\n]+revalidateCloudState\('visibility'\)/);
  assert.match(app, /addEventListener\('focus'[^\n]+revalidateCloudState\('focus'\)/);
  assert.match(app, /addEventListener\('online'[^\n]+revalidateCloudState\('online',\{force:true\}\)/);
  assert.match(app, /setInterval\([^\n]+revalidateCloudState\('periodic'\)[^\n]+60000/);
  assert.doesNotMatch(app, /\.channel\(|postgres_changes|supabase.*realtime/i);
});

test('deduplica consultas e cancela resposta obsoleta', () => {
  assert.match(app, /if\(cloudRefreshInFlight\)return cloudRefreshInFlight/);
  assert.match(app, /cloudRefreshController\?\.abort\(\)/);
  assert.match(app, /sequence!==cloudRefreshSequence\|\|userId!==currentUser\?\.id/);
});

test('salvamento pendente termina antes da leitura remota', () => {
  assert.match(app, /if\(cloudSaveTimer\)\{clearTimeout\(cloudSaveTimer\);cloudSaveTimer=null;await pushCloudState\(\)\}else if\(cloudSaveInFlight\)await cloudSaveInFlight/);
  assert.match(app, /if\(cloudSyncBlocked\|\|userId!==currentUser\?\.id\)return false/);
});

test('mudancas simultaneas viram conflito e nao sobrescrita', () => {
  assert.match(app, /if\(remoteChanged&&localChanged\)\{cloudConflict=/);
  assert.match(app, /cloudSyncBlocked=true;setCloudSyncStatus\('conflict'/);
});

test('loop para ao sair e inicia depois do login', () => {
  assert.match(app, /enterApp\(\);startCloudRevalidation\(\);refreshOfflineQueueStatus[^\n]+revalidateCloudState\('login',\{force:true\}\)/);
  assert.match(app, /function resolveGuestSession\(\)[^\n]+stopCloudRevalidation\(\)/);
});
