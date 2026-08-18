import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_only';

let transitionAvailable = true;
const calls = [];
global.fetch = async (input, options = {}) => {
  const url = String(input);
  calls.push({ url, method: options.method || 'GET', body: options.body || '' });
  if (url.includes('paid_at=is.null')) {
    const rows = transitionAvailable ? [{ paid_at: '2026-08-18T12:00:00.000Z', status: 'paid' }] : [];
    transitionAvailable = false;
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('select=paid_at,status')) {
    return new Response(JSON.stringify([{ paid_at: '2026-08-18T12:00:00.000Z', status: 'paid' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(null, { status: 204 });
};

const require = createRequire(import.meta.url);
const { recordPaymentVerification } = require('../api/_lib.js');
const storedPayment = { amount_cents: 3990, paid_at: null };

const first = await recordPaymentVerification({ transactionId: 'txn_secure_123', storedPayment, providerStatus: 'paid', providerAmountCents: 3990 });
assert.deepEqual(first, { paid: true, newlyPaid: true, status: 'paid', paidAt: '2026-08-18T12:00:00.000Z' });

const repeated = await recordPaymentVerification({ transactionId: 'txn_secure_123', storedPayment, providerStatus: 'paid', providerAmountCents: 3990 });
assert.equal(repeated.paid, true);
assert.equal(repeated.newlyPaid, false);
assert.equal(calls.filter((call) => call.url.includes('paid_at=is.null')).length, 2);

const wrongAmount = await recordPaymentVerification({ transactionId: 'txn_other_123', storedPayment, providerStatus: 'paid<script>', providerAmountCents: 1 });
assert.deepEqual(wrongAmount, { paid: false, newlyPaid: false, status: 'unknown', paidAt: null });

console.log('Payment confirmation is amount-bound, atomic and idempotent.');
