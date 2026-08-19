import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const referrals = await readFile(new URL('../api/referrals.js', import.meta.url), 'utf8');
const payment = await readFile(new URL('../api/check-lifetime-payment.js', import.meta.url), 'utf8');
const lib = await readFile(new URL('../api/_lib.js', import.meta.url), 'utf8');
const click = await readFile(new URL('../api/referral-click.js', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20260818170000_referral_state_machine.sql', import.meta.url), 'utf8');
const rollback = await readFile(new URL('../supabase/rollbacks/20260818170000_referral_state_machine.rollback.sql', import.meta.url), 'utf8');

test('ha uma unica implementacao de compartilhamento e sincronizacao', () => {
  assert.equal((app.match(/async function shareReferral\(/g) || []).length, 1);
  assert.equal((app.match(/async function syncReferralProgram\(/g) || []).length, 1);
  assert.doesNotMatch(app, /shareReferral\s*=\s*async function/);
});

test('OAuth preserva o codigo no redirect e outro aparelho aceita entrada manual', () => {
  assert.match(app, /function authRedirectUrl\(\)/);
  assert.match(app, /target\.searchParams\.set\('ref',code\)/);
  assert.match(app, /redirectTo:authRedirectUrl\(\)/);
  assert.match(app, /id="manualReferralForm"/);
  assert.match(app, /source:'manual_cross_device'/);
});

test('codigo pendente so e removido depois de confirmacao do servidor', () => {
  const sync = app.match(/async function syncReferralProgram[\s\S]+?function ensureAdminGrowthCard/)?.[0] || '';
  assert.match(sync, /if\(!registered\.ok\)throw new Error/);
  assert.match(sync, /localStorage\.removeItem\('luar-referral-code'\)/);
  assert.doesNotMatch(sync, /\[404,409\]\.includes/);
});

test('backend impede autoindicacao, troca de indicador, pos-compra e prazo expirado', () => {
  assert.match(referrals, /SELF_REFERRAL/);
  assert.match(referrals, /REFERRAL_LOCKED/);
  assert.match(referrals, /ATTRIBUTION_AFTER_PURCHASE/);
  assert.match(referrals, /ATTRIBUTION_EXPIRED/);
  assert.match(referrals, /ATTRIBUTION_WINDOW_DAYS = 30/);
  assert.match(referrals, /rateLimit\(req, 'referrals-user'/);
});

test('cadastro nasce pending, email confirmado vira verified e compra vira approved', () => {
  assert.match(referrals, /status: 'pending'/);
  assert.match(referrals, /previousStatus: null, newStatus: 'pending'/);
  assert.match(referrals, /status: 'verified'/);
  assert.match(payment, /status: 'approved'/);
  assert.match(payment, /actor_type: 'payment'/);
  assert.match(referrals, /if \(referral\.status !== 'pending'\) return referral/);
  assert.match(payment, /status=in\.\(verified,approved\)/);
  assert.match(payment, /await grantReferralLifetimeIfEligible\(referral\.referrer_user_id\)/);
});

test('recompensa considera apenas compras aprovadas e exige duas', () => {
  assert.match(lib, /status=eq\.approved/);
  assert.match(lib, /if \(purchased < 2\)/);
  assert.doesNotMatch(click, /grantReferralLifetimeIfEligible/);
  assert.doesNotMatch(referrals, /status: 'approved'/);
});

test('cliques sao idempotentes, nao armazenam IP e nao concedem recompensa', () => {
  assert.match(click, /on_conflict=event_id/);
  assert.match(click, /resolution=ignore-duplicates/);
  assert.doesNotMatch(migration, /^\s*(ip_address|fingerprint)\s+/im);
  assert.match(migration, /event_id uuid not null unique/);
});

test('RLS, bloqueio ao cliente e auditoria estao previstos na migracao', () => {
  assert.match(migration, /luar_referral_audit enable row level security/);
  assert.match(migration, /luar_referral_audit force row level security/);
  assert.match(migration, /luar_referral_clicks force row level security/);
  assert.match(migration, /revoke all on public\.luar_referral_audit from anon, authenticated/);
  assert.match(migration, /revoke all on public\.luar_referral_clicks from anon, authenticated/);
});

test('migracao preserva cadastros e promove somente pagamentos existentes; rollback existe', () => {
  assert.match(migration, /r\.status = 'verified' and p\.status = 'paid'/);
  assert.match(migration, /set status = 'approved'/);
  assert.match(rollback, /when status in \('pending', 'approved'\) then 'verified'/);
  assert.match(rollback, /drop table if exists public\.luar_referral_audit/);
  assert.match(rollback, /drop table if exists public\.luar_referral_clicks/);
});
