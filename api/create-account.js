const { json, readBody, requireSameOrigin, rateLimit } = require('./_lib');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
    requireSameOrigin(req);
    rateLimit(req, 'create-account', 8, 15 * 60 * 1000);
    const body = await readBody(req, 8_192);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(body.password || '');
    const name = String(body.name || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Informe um e-mail válido.' });
    if (password.length < 8 || password.length > 128) return json(res, 400, { error: 'A senha deve ter entre 8 e 128 caracteres.' });
    if (!name) return json(res, 400, { error: 'Informe seu nome.' });

    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey) return json(res, 503, { error: 'Cadastro temporariamente indisponível.' });
    const publicSite = new URL(process.env.PUBLIC_SITE_URL || 'https://luarhub.site');
    if (publicSite.protocol !== 'https:') throw new Error('SERVER_CONFIG');

    const response = await fetch(`${url}/auth/v1/signup?redirect_to=${encodeURIComponent(publicSite.origin)}`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, data: { name, onboarding_completed: false } }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(data.msg || data.message || data.error_description || '');
      const duplicate = response.status === 422 || /already|registered|exists/i.test(detail);
      return json(res, duplicate ? 409 : 400, { error: duplicate ? 'Este e-mail já possui uma conta no LUAR.' : 'Não foi possível criar a conta.' });
    }
    const duplicate = Array.isArray(data.user?.identities) && data.user.identities.length === 0;
    if (duplicate) return json(res, 409, { error: 'Este e-mail já possui uma conta no LUAR.' });
    return json(res, 201, { created: true, requiresConfirmation: !data.access_token });
  } catch (error) {
    if (error.message === 'ORIGIN_INVALID') return json(res, 403, { error: 'Origem não autorizada.' });
    if (error.message === 'RATE_LIMITED') return json(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
    if (error.message === 'BODY_TOO_LARGE' || error.message === 'BODY_INVALID') return json(res, 400, { error: 'Requisição inválida.' });
    return json(res, 500, { error: 'Cadastro temporariamente indisponível.' });
  }
};
