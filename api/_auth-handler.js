const crypto = require('crypto');
const { json, readBody, requireSameOrigin, rateLimit, requestCookies, authCookieNames } = require('./_lib');

const siteOrigin = () => {
  const url = new URL(process.env.PUBLIC_SITE_URL || 'https://luarhub.site');
  if (url.protocol !== 'https:' && process.env.VERCEL_ENV === 'production') throw new Error('SERVER_CONFIG');
  return url.origin;
};

const authConfig = () => {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(process.env.SUPABASE_ANON_KEY || '');
  if (!url || !key) throw new Error('SERVER_CONFIG');
  return { url, key };
};

const authRequest = async (path, options = {}) => {
  const { url, key } = authConfig();
  return fetch(`${url}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${options.accessToken || key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
};

const cookie = (name, value, maxAge) => {
  const secure = process.env.VERCEL_ENV === 'production' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${Math.max(0, Math.floor(maxAge))}`;
};
const setCookies = (res, values) => res.setHeader('Set-Cookie', values.filter(Boolean));
const clearSession = (res) => {
  const names = authCookieNames();
  setCookies(res, [cookie(names.access, '', 0), cookie(names.refresh, '', 0), cookie(names.verifier, '', 0)]);
};
const storeSession = (res, payload, extraCookies = []) => {
  if (!payload?.access_token || !payload?.refresh_token) throw new Error('AUTH_INVALID');
  const names = authCookieNames();
  setCookies(res, [
    cookie(names.access, payload.access_token, Math.min(Number(payload.expires_in) || 3600, 3600)),
    cookie(names.refresh, payload.refresh_token, 60 * 60 * 24 * 30),
    ...extraCookies,
  ]);
};
const decodeClaims = (token) => {
  try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8')); } catch { return {}; }
};
const publicSession = (payload, user = payload?.user) => {
  if (!user) return null;
  const claims = decodeClaims(payload?.access_token || '');
  return { user, expires_at: Number(claims.exp) || Math.floor(Date.now() / 1000) + 3600, amr: Array.isArray(claims.amr) ? claims.amr : [] };
};
const verifierPair = () => {
  const verifier = crypto.randomBytes(48).toString('base64url');
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') };
};
const validEmail = (value) => {
  const email = String(value || '').trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
};
const refreshSession = async (req, res) => {
  const names = authCookieNames();
  const refreshToken = requestCookies(req)[names.refresh] || '';
  if (!refreshToken) return null;
  const response = await authRequest('token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) });
  if (!response.ok) { clearSession(res); return null; }
  const payload = await response.json();
  storeSession(res, payload);
  return payload;
};
const currentSession = async (req, res) => {
  const names = authCookieNames();
  const accessToken = requestCookies(req)[names.access] || '';
  if (accessToken) {
    const response = await authRequest('user', { method: 'GET', accessToken });
    if (response.ok) return { access_token: accessToken, user: await response.json() };
  }
  return refreshSession(req, res);
};
const redirect = (res, location) => {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
};

module.exports = async function handler(req, res) {
  const requestUrl = new URL(req.url || '/api/create-account', siteOrigin());
  const action = requestUrl.searchParams.get('action') || 'signup';
  try {
    if (action === 'callback') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
      await rateLimit(req, 'auth-callback', 30, 15 * 60 * 1000);
      const code = String(requestUrl.searchParams.get('code') || '');
      const names = authCookieNames();
      const verifier = requestCookies(req)[names.verifier] || '';
      if (!code || !verifier) { clearSession(res); return redirect(res, `${siteOrigin()}/?auth=failed`); }
      const response = await authRequest('token?grant_type=pkce', { method: 'POST', body: JSON.stringify({ auth_code: code, code_verifier: verifier }) });
      if (!response.ok) { clearSession(res); return redirect(res, `${siteOrigin()}/?auth=failed`); }
      const payload = await response.json();
      storeSession(res, payload, [cookie(names.verifier, '', 0)]);
      return redirect(res, `${siteOrigin()}/${requestUrl.searchParams.get('mode') === 'recovery' ? '#reset-password' : ''}`);
    }

    if (action === 'oauth') {
      if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });
      await rateLimit(req, 'auth-oauth', 20, 15 * 60 * 1000);
      const provider = String(requestUrl.searchParams.get('provider') || '').toLowerCase();
      if (!['google', 'discord'].includes(provider)) return json(res, 400, { error: 'Provedor inválido.' });
      const { url } = authConfig(), { verifier, challenge } = verifierPair(), names = authCookieNames();
      setCookies(res, [cookie(names.verifier, verifier, 600)]);
      const authorize = new URL(`${url}/auth/v1/authorize`);
      authorize.searchParams.set('provider', provider);
      authorize.searchParams.set('redirect_to', `${siteOrigin()}/api/create-account?action=callback`);
      authorize.searchParams.set('code_challenge', challenge);
      authorize.searchParams.set('code_challenge_method', 's256');
      if (provider === 'google') authorize.searchParams.set('prompt', 'select_account');
      if (provider === 'discord') authorize.searchParams.set('scopes', 'identify email');
      return redirect(res, authorize.href);
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
    requireSameOrigin(req, true);
    const body = await readBody(req, 8_192);

    if (action === 'session') {
      await rateLimit(req, 'auth-session', 120, 15 * 60 * 1000);
      const payload = await currentSession(req, res);
      return json(res, 200, { session: payload ? publicSession(payload) : null });
    }
    if (action === 'refresh') {
      await rateLimit(req, 'auth-refresh', 60, 15 * 60 * 1000);
      const payload = await refreshSession(req, res);
      return payload ? json(res, 200, { session: publicSession(payload) }) : json(res, 401, { error: 'Sessão expirada.' });
    }
    if (action === 'login') {
      await rateLimit(req, 'auth-login', 10, 15 * 60 * 1000);
      const email = validEmail(body.email), password = String(body.password || '');
      if (!email || password.length < 8 || password.length > 128) return json(res, 400, { error: 'E-mail ou senha incorretos.' });
      await rateLimit(req, 'auth-login-account', 5, 15 * 60 * 1000, email);
      const response = await authRequest('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (!response.ok) return json(res, 400, { error: 'E-mail ou senha incorretos.' });
      const payload = await response.json();
      storeSession(res, payload);
      return json(res, 200, { user: payload.user, session: publicSession(payload) });
    }
    if (action === 'recovery') {
      await rateLimit(req, 'auth-recovery', 6, 15 * 60 * 1000);
      const email = validEmail(body.email);
      if (email) await rateLimit(req, 'auth-recovery-account', 3, 15 * 60 * 1000, email);
      if (!email) return json(res, 400, { error: 'Informe um e-mail válido.' });
      const { verifier, challenge } = verifierPair(), names = authCookieNames();
      setCookies(res, [cookie(names.verifier, verifier, 900)]);
      await authRequest('recover', {
        method: 'POST',
        body: JSON.stringify({ email, code_challenge: challenge, code_challenge_method: 's256', redirect_to: `${siteOrigin()}/api/create-account?action=callback&mode=recovery` }),
      });
      return json(res, 202, { accepted: true });
    }
    if (action === 'update') {
      await rateLimit(req, 'auth-update', 20, 15 * 60 * 1000);
      const payload = await currentSession(req, res);
      if (!payload?.access_token) return json(res, 401, { error: 'Sessão expirada.' });
      const update = {};
      if (body.data && typeof body.data === 'object' && !Array.isArray(body.data)) update.data = body.data;
      if (body.password !== undefined) {
        const password = String(body.password || '');
        if (password.length < 8 || password.length > 128) return json(res, 400, { error: 'A senha deve ter entre 8 e 128 caracteres.' });
        update.password = password;
      }
      if (!Object.keys(update).length) return json(res, 400, { error: 'Atualização inválida.' });
      const response = await authRequest('user', { method: 'PUT', accessToken: payload.access_token, body: JSON.stringify(update) });
      if (!response.ok) return json(res, 400, { error: 'Não foi possível atualizar a conta.' });
      return json(res, 200, { user: await response.json() });
    }
    if (action === 'signout') {
      await rateLimit(req, 'auth-signout', 30, 15 * 60 * 1000);
      const payload = await currentSession(req, res);
      if (payload?.access_token) await authRequest('logout', { method: 'POST', accessToken: payload.access_token }).catch(() => null);
      clearSession(res);
      return json(res, 200, { signedOut: true });
    }
    if (action !== 'signup') return json(res, 400, { error: 'Ação inválida.' });
    await rateLimit(req, 'create-account', 8, 15 * 60 * 1000);
    const email = validEmail(body.email), password = String(body.password || '');
    const name = String(body.name || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80);
    if (email) await rateLimit(req, 'create-account-email', 4, 15 * 60 * 1000, email);
    if (!email) return json(res, 400, { error: 'Informe um e-mail válido.' });
    if (password.length < 8 || password.length > 128) return json(res, 400, { error: 'A senha deve ter entre 8 e 128 caracteres.' });
    if (!name) return json(res, 400, { error: 'Informe seu nome.' });
    const { verifier, challenge } = verifierPair(), names = authCookieNames();
    setCookies(res, [cookie(names.verifier, verifier, 60 * 60 * 24)]);
    const response = await authRequest(`signup?redirect_to=${encodeURIComponent(`${siteOrigin()}/api/create-account?action=callback`)}`, {
      method: 'POST',
      body: JSON.stringify({ email, password, data: { name, onboarding_completed: false }, code_challenge: challenge, code_challenge_method: 's256' }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const detail = String(data.msg || data.message || data.error_description || '');
      if (!(response.status === 422 || /already|registered|exists/i.test(detail))) return json(res, 400, { error: 'Não foi possível processar o cadastro.' });
    }
    return json(res, 202, { accepted: true, requiresConfirmation: true });
  } catch (error) {
    if (error.message === 'ORIGIN_INVALID') return json(res, 403, { error: 'Origem não autorizada.' });
    if (error.message === 'RATE_LIMITED') return json(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
    if (error.message === 'BODY_TOO_LARGE' || error.message === 'BODY_INVALID') return json(res, 400, { error: 'Solicitação inválida.' });
    return json(res, 500, { error: 'A autenticação está temporariamente indisponível.' });
  }
};
