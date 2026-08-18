import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const accountSource = await readFile(new URL('../api/account-state.js', import.meta.url), 'utf8');

const collections = ['transactions', 'tasks', 'habits', 'goals', 'subscriptions', 'wishlist', 'investments', 'events', 'moods', 'notes', 'focusSessions', 'portfolioHistory'];

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function contentCount(value) {
  return collections.reduce((total, key) => total + (Array.isArray(value?.[key]) ? value[key].length : 0), 0);
}

function timestamp(value) {
  const parsed = Date.parse(value?.profile?.localUpdatedAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

// Modelo fiel ao algoritmo que continua em producao durante a Fase 1.
function chooseCurrentState(candidates, remoteUpdatedAt, userId, storage = memoryStorage()) {
  const valid = candidates.filter(item => item?.state && typeof item.state === 'object');
  const remote = valid.find(item => item.source === 'cloud');
  const remoteCount = contentCount(remote?.state);
  const migrationKey = `luar-state-recovery-v3:${userId}`;
  const migrationDone = storage.getItem(migrationKey) === '1';
  if (remoteCount) {
    const newer = valid
      .filter(item => item.source !== 'cloud' && timestamp(item.state) > Date.parse(remoteUpdatedAt || '') && contentCount(item.state))
      .sort((a, b) => timestamp(b.state) - timestamp(a.state))[0];
    if (newer) return { ...newer, upload: true };
    if (!migrationDone) {
      const richer = valid
        .filter(item => item.source !== 'cloud' && contentCount(item.state) > remoteCount)
        .sort((a, b) => contentCount(b.state) - contentCount(a.state))[0];
      storage.setItem(migrationKey, '1');
      if (richer) return { ...richer, upload: true };
    }
    return remote;
  }
  const richest = valid.filter(item => contentCount(item.state)).sort((a, b) => contentCount(b.state) - contentCount(a.state) || timestamp(b.state) - timestamp(a.state))[0];
  return richest ? { ...richest, upload: richest.source !== 'cloud' } : remote || valid[0];
}

function mergeCurrentStates(remote, local) {
  const merged = { ...structuredClone(remote || {}), ...structuredClone(local || {}) };
  merged.profile = { ...(remote?.profile || {}), ...(local?.profile || {}) };
  for (const key of collections) {
    const byId = new Map();
    const anonymous = [];
    for (const item of [...(Array.isArray(remote?.[key]) ? remote[key] : []), ...(Array.isArray(local?.[key]) ? local[key] : [])]) {
      const id = item && typeof item === 'object' && item.id != null ? String(item.id) : '';
      if (id) byId.set(id, item);
      else anonymous.push({ item, signature: JSON.stringify(item) });
    }
    const seen = new Set();
    merged[key] = [...byId.values(), ...anonymous.filter(entry => !seen.has(entry.signature) && seen.add(entry.signature)).map(entry => entry.item)];
  }
  return merged;
}

test('Fase 1: existe uma unica implementacao ativa de handleSignedIn', () => {
  const declarations = appSource.match(/(?:async\s+function\s+handleSignedIn|handleSignedIn\s*=\s*async\s+function)/g) || [];
  assert.equal(declarations.length, 1);
});

test('Fase 1: existe uma unica implementacao ativa de syncReferralProgram', () => {
  const declarations = appSource.match(/(?:async\s+function\s+syncReferralProgram|syncReferralProgram\s*=\s*async\s+function)/g) || [];
  assert.equal(declarations.length, 1);
});

test('Diagnostico: a sessao B nao recebe automaticamente a alteracao da sessao A', () => {
  const sessionA = { tasks: [{ id: 'nova', name: 'Criada no celular' }] };
  const sessionB = { tasks: [] };
  sessionA.tasks.push({ id: 'segunda', name: 'Outra alteracao' });
  assert.equal(sessionB.tasks.length, 0);
  const focusHandler = appSource.match(/window\.addEventListener\('focus',[^\n]+/)?.[0] || '';
  assert.match(focusHandler, /render\(\)/);
  assert.doesNotMatch(focusHandler, /accountApiFetch|verifyLifetimeStatus|pushCloudState/);
  assert.doesNotMatch(appSource, /addEventListener\('online'/);
});

test('Diagnostico: uma exclusao reaparece na mesclagem atual', () => {
  const remote = { profile: {}, tasks: [{ id: 't1', name: 'Excluida no celular' }] };
  const localAfterDelete = { profile: {}, tasks: [] };
  const merged = mergeCurrentStates(remote, localAfterDelete);
  assert.equal(merged.tasks.some(item => item.id === 't1'), true);
});

test('Diagnostico: objeto local antigo sobrescreve campos mais recentes do servidor', () => {
  const remote = { profile: {}, notes: [{ id: 'n1', title: 'Versao nova', content: 'servidor' }] };
  const local = { profile: {}, notes: [{ id: 'n1', title: 'Versao antiga', content: 'navegador' }] };
  const merged = mergeCurrentStates(remote, local);
  assert.equal(merged.notes[0].title, 'Versao antiga');
});

test('Diagnostico: relogio adiantado do dispositivo influencia a escolha e agenda upload', () => {
  const cloud = { profile: { localUpdatedAt: '2026-08-18T10:00:00.000Z' }, tasks: [{ id: 'server' }] };
  const local = { profile: { localUpdatedAt: '2099-01-01T00:00:00.000Z' }, tasks: [{ id: 'old-local' }] };
  const selected = chooseCurrentState([{ source: 'cloud', state: cloud }, { source: 'local', state: local }], '2026-08-18T10:00:00.000Z', 'user-1');
  assert.equal(selected.source, 'local');
  assert.equal(selected.upload, true);
});

test('Diagnostico: falha de salvamento fica no console sem estado visivel persistente', () => {
  assert.match(appSource, /console\.warn\('LUAR cloud save:'/);
  assert.doesNotMatch(appSource, /syncStatus\s*=|cloudSyncStatus\s*=|ALTERA(?:C|Ç)(?:O|Õ)ES PENDENTES/iu);
});

test('Diagnostico: recarregar durante envio nao possui fila duravel nem protecao de saida', () => {
  assert.match(appSource, /cloudSaveInFlight/);
  const unloadHandler = appSource.match(/window\.addEventListener\('beforeunload',[^\n]+/)?.[0] || '';
  assert.match(unloadHandler, /writeLocalState\(\)/);
  assert.doesNotMatch(unloadHandler, /await\s+pushCloudState|sendBeacon/);
  assert.doesNotMatch(appSource, /objectStoreNames\.contains\(['"](?:sync|outbox|pending)/);
  assert.match(accountSource, /baseUpdatedAt/);
});

test('Diagnostico: indicacao capturada em um navegador nao existe em outro', () => {
  const mobile = memoryStorage();
  const desktop = memoryStorage();
  mobile.setItem('luar-referral-code', 'ABCDEF1234');
  assert.equal(mobile.getItem('luar-referral-code'), 'ABCDEF1234');
  assert.equal(desktop.getItem('luar-referral-code'), null);
  assert.match(appSource, /localStorage\.setItem\('luar-referral-code'/);
});

test('Diagnostico: cache de Indicacoes pode manter resultado antigo por 60 segundos', () => {
  assert.match(appSource, /now-syncReferralProgram\.fetchedAt<60000/);
  const fetchedAt = 1_000_000;
  const now = fetchedAt + 59_999;
  assert.equal(now - fetchedAt < 60_000, true);
});
