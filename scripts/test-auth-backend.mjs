import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_ANON_KEY = 'anon-test-key-that-is-long-enough-for-the-test-only-environment';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_only';
process.env.PUBLIC_SITE_URL = 'https://luarhub.site';
process.env.VERCEL_ENV = 'production';

const testUser = { id: '11111111-1111-4111-8111-111111111111', email: 'qa@example.com', email_confirmed_at: '2026-08-17T00:00:00Z', app_metadata: { role: 'authenticated' }, user_metadata: { name: 'QA' } };
const tokenPayload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] })).toString('base64url');
const accessToken = `header.${tokenPayload}.signature`;
global.fetch = async (url) => {
  const target = String(url);
  if (target.includes('/rest/v1/rpc/consume_luar_rate_limit')) return new Response('true', { status: 200 });
  if (target.includes('/auth/v1/token?grant_type=password')) return Response.json({ access_token: accessToken, refresh_token: 'refresh-test', expires_in: 3600, user: testUser });
  if (target.endsWith('/auth/v1/user')) return Response.json(testUser);
  throw new Error(`Unexpected fetch: ${target}`);
};

const require = createRequire(import.meta.url);
const handler = require('../api/create-account');
const invoke = async ({ url, method = 'POST', body = {}, origin = 'https://luarhub.site', cookie = '' }) => {
  const headers = { origin, cookie, 'x-forwarded-for': '203.0.113.40' };
  const req = { url, method, body, headers, socket: { remoteAddress: '203.0.113.40' } };
  let payload = '', statusCode = 200;
  const responseHeaders = new Map();
  const res = {
    set statusCode(value) { statusCode = value; },
    get statusCode() { return statusCode; },
    setHeader(name, value) { responseHeaders.set(String(name).toLowerCase(), value); },
    end(value = '') { payload = value; },
  };
  await handler(req, res);
  return { statusCode, headers: responseHeaders, body: payload ? JSON.parse(payload) : null };
};

const login = await invoke({ url: '/api/create-account?action=login', body: { email: 'qa@example.com', password: 'correct-password' } });
assert.equal(login.statusCode, 200);
assert.equal(login.body.user.email, 'qa@example.com');
assert.equal(JSON.stringify(login.body).includes('access_token'), false);
assert.equal(JSON.stringify(login.body).includes('refresh-test'), false);
const setCookie = login.headers.get('set-cookie');
assert.ok(Array.isArray(setCookie) && setCookie.length === 2);
assert.ok(setCookie.every(value => value.includes('HttpOnly') && value.includes('Secure') && value.includes('SameSite=Lax')));

const accessCookie = setCookie[0].split(';')[0];
const session = await invoke({ url: '/api/create-account?action=session', cookie: accessCookie });
assert.equal(session.statusCode, 200);
assert.equal(session.body.session.user.email, 'qa@example.com');
assert.equal(JSON.stringify(session.body).includes('access_token'), false);

const blocked = await invoke({ url: '/api/create-account?action=login', origin: 'https://evil.example', body: { email: 'qa@example.com', password: 'correct-password' } });
assert.equal(blocked.statusCode, 403);

const anonymous = await invoke({ url: '/api/create-account?action=session' });
assert.equal(anonymous.statusCode, 200);
assert.equal(anonymous.body.session, null);

console.log('Backend auth keeps tokens in HttpOnly cookies and out of browser JSON.');
