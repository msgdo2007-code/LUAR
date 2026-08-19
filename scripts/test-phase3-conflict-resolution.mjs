import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const strategy = fs.readFileSync(new URL('../PHASE-3-CONFLICT-STRATEGY.md', import.meta.url), 'utf8');

test('conflito preserva snapshots local e remoto sem mesclagem', () => {
  assert.match(app, /cloudConflict=\{local:structuredClone\(operation\.snapshot\),remote:structuredClone\(result\.state\|\|\{\}\)/);
  assert.doesNotMatch(app.match(/if\(response\.status===409&&result\.conflict\)\{[^}]+\}/)?.[0] || '', /mergeAccountStates/);
});

test('usar nuvem exporta a versao local antes de substituir', () => {
  assert.match(app, /downloadConflictSnapshot\(conflict\.local/);
  assert.match(app, /applyAccountState\(conflict\.remote\)/);
});

test('usar dispositivo parte da revisao confirmada pelo servidor e cria backup', () => {
  assert.match(app, /baseRevision:Math\.max\(0,\+conflict\.revision\|\|0\)/);
  assert.match(app, /createBackup:true/);
});

test('estrategia proibe relogio e mesclagem silenciosa', () => {
  assert.match(strategy, /relógio do dispositivo não determinam precedência/i);
  assert.match(strategy, /nenhuma mesclagem automática/i);
  assert.match(strategy, /Tombstones só serão introduzidos junto das tabelas normalizadas/i);
});

