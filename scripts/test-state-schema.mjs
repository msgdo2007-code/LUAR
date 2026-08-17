import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { sanitizeAccountState } = require('../api/_state-schema.js');

const emptyState = {
  transactions: [], tasks: [], habits: [], goals: [], subscriptions: [],
  wishlist: [], investments: [], events: [], moods: [], notes: [],
  focusSessions: [], portfolioHistory: [], profile: {},
};

const safe = sanitizeAccountState(emptyState, { lifetime: false, previousState: null });
assert.equal(Object.getPrototypeOf(safe), null);
assert.deepEqual(safe.tasks, []);

assert.throws(
  () => sanitizeAccountState({ ...emptyState, tasks: Array.from({ length: 4 }, (_, id) => ({ id: String(id), title: 'Task' })) }, { lifetime: false }),
  (error) => error?.publicCode === 'PLAN_LIMIT',
);

const legacy = { ...emptyState, tasks: Array.from({ length: 4 }, (_, id) => ({ id: String(id), title: 'Task' })) };
assert.doesNotThrow(() => sanitizeAccountState(legacy, { lifetime: false, previousState: legacy }));

const hostile = JSON.parse('{"transactions":[],"tasks":[],"habits":[],"goals":[],"subscriptions":[],"wishlist":[],"investments":[],"events":[],"moods":[],"notes":[],"focusSessions":[],"portfolioHistory":[],"profile":{"constructor":{"polluted":true}}}');
assert.throws(
  () => sanitizeAccountState(hostile, { lifetime: true }),
  (error) => error?.publicCode === 'STATE_INVALID',
);

const unsafeUrl = { ...emptyState, wishlist: [{ id: '1', name: 'Bad', link: 'javascript:alert(1)' }] };
const cleaned = sanitizeAccountState(unsafeUrl, { lifetime: true });
assert.equal(cleaned.wishlist[0].link, '');

console.log('Account-state schema security tests passed.');
