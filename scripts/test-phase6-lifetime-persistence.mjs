import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sanitizeAccountState } = require('../api/_state-schema.js');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const collections = ['transactions','tasks','habits','goals','subscriptions','wishlist','investments','events','moods','notes','focusSessions','portfolioHistory'];
const state = (profile = {}) => Object.fromEntries([['profile', profile], ...collections.map(key => [key, []])]);

test('plano gratuito nao apaga preferencias Vitalicias ja armazenadas', () => {
  const previous = state({ appearanceTemplate: 'halloween', accent: '#ff8a24', animationsEnabled: false, financeLineMode: 'separate', financeSeries: ['income','expense'], playlistUrl: 'https://open.spotify.com/playlist/example', lifetimePreferencesMigration: { version: 1, completed: true } });
  const incoming = state({ appearanceTemplate: 'carnival', accent: '#ff4fd8', animationsEnabled: true, financeLineMode: 'combined', financeSeries: ['combined'], playlistUrl: '' });
  const clean = sanitizeAccountState(incoming, { lifetime: false, previousState: previous });
  assert.equal(clean.profile.appearanceTemplate, 'halloween');
  assert.equal(clean.profile.accent, '#ff8a24');
  assert.equal(clean.profile.animationsEnabled, false);
  assert.equal(clean.profile.financeLineMode, 'separate');
  assert.deepEqual(clean.profile.financeSeries, ['income','expense']);
  assert.equal(clean.profile.lifetimePreferencesMigration.version, 1);
});

test('conta gratuita nova nao consegue introduzir template premium', () => {
  const incoming = state({ appearanceTemplate: 'carnival', accent: '#ff4fd8', animationsEnabled: false, financeLineMode: 'separate' });
  const clean = sanitizeAccountState(incoming, { lifetime: false, previousState: state({}) });
  assert.equal(clean.profile.appearanceTemplate, 'luar');
  assert.equal(clean.profile.accent, '#32ff7e');
  assert.equal(clean.profile.animationsEnabled, true);
  assert.equal(clean.profile.financeLineMode, 'combined');
});

test('migracao copia somente campos premium permitidos e cria snapshot', () => {
  assert.match(app, /function extractLifetimePreferences\(profile=\{\}\)/);
  assert.match(app, /prepareLifetimePreferencesMigration\(remote,recoveryCandidates/);
  assert.match(app, /pushCloudState\(\{createBackup:true\}\)/);
  assert.match(app, /lifetimePreferencesMigration=\{version:LIFETIME_PREFERENCE_VERSION/);
});

test('servidor com conteúdo vence, mas nuvem vazia não apaga recuperação local', () => {
  assert.match(app, /if\(remoteCount\)/);
  assert.match(app, /choice=chooseSafestAccountState\(recoveryCandidates/);
  assert.doesNotMatch(app, /stateHasContent\(remote\)\|\|cloudAccount\?\.updatedAt/);
});

test('preferencias divergentes exigem escolha e preservam alternativa local', () => {
  assert.match(app, /localStorage\.setItem\(lifetimePreferenceConflictKey\(\),JSON\.stringify\(candidate\)\)/);
  assert.match(app, /openLifetimePreferenceConflict/);
  assert.match(app, /Usar personalização da nuvem/);
  assert.match(app, /Usar deste dispositivo/);
});
