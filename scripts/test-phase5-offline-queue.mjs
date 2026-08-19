import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('fila duravel usa IndexedDB versionado e indice por usuario', () => {
  assert.match(app, /BROWSER_SYNC_QUEUE_STORE='syncQueue'/);
  assert.match(app, /indexedDB\.open\(BROWSER_STATE_DB,2\)/);
  assert.match(app, /createIndex\('userId','userId',\{unique:false\}\)/);
});

test('operacao possui ID idempotente e sobrevive antes da rede', () => {
  assert.match(app, /function createCloudOperation\([^\n]+return\{id:cloudOperationId\(\),userId:currentUser\.id/);
  assert.match(app, /await enqueueCloudOperation\(operation[^;]+;setCloudSyncStatus/);
  assert.match(app, /operationId:operation\.id/);
});

test('operacao so e removida apos resposta confirmada', () => {
  const removal = app.indexOf('await removeSyncQueueItem(operation.id)');
  const responseCheck = app.indexOf("if(!response.ok){let error=new Error");
  assert.ok(removal > responseCheck);
  assert.match(app, /if\(!response\.ok\)[^\n]+await removeSyncQueueItem\(operation\.id\)/);
});

test('erros temporarios usam backoff e validacao nao repete indefinidamente', () => {
  assert.match(app, /let permanent=\[400,403,413\]\.includes\(error\.status\)/);
  assert.match(app, /Math\.min\(cloudRetryDelay\*2,30000\)/);
  assert.match(app, /operation\.status=permanent\?'invalid':'retry'/);
  assert.match(app, /if\(permanent\)cloudPendingOperation=null/);
});

test('reconexao drena fila e interface informa quantidade pendente', () => {
  assert.match(app, /revalidateCloudState\('online',\{force:true\}\)/);
  assert.match(app, /await drainOfflineQueue\(\)/);
  assert.match(app, /offlineQueueCount=active\.length/);
  assert.match(app, /alteração.*pendente/);
});
