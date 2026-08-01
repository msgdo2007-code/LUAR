const recentAttempts = new Map();

function allowAttempt(ip) {
  const now = Date.now();
  const attempts = (recentAttempts.get(ip) || []).filter(time => now - time < 15 * 60 * 1000);
  if (attempts.length >= 8) return false;
  attempts.push(now);
  recentAttempts.set(ip, attempts);
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const expectedHost = String(req.headers.host || '').toLowerCase();
  const requestOrigin = String(req.headers.origin || '');
  try {
    if (requestOrigin && expectedHost && new URL(requestOrigin).host.toLowerCase() !== expectedHost) {
      return res.status(403).json({ error: 'Origem não autorizada.' });
    }
  } catch {
    return res.status(403).json({ error: 'Origem não autorizada.' });
  }

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (!allowAttempt(ip)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (password.length < 6 || password.length > 128) return res.status(400).json({ error: 'A senha deve ter entre 6 e 128 caracteres.' });
  if (!name) return res.status(400).json({ error: 'Informe seu nome.' });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(503).json({ error: 'Cadastro temporariamente indisponível.' });

  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, onboarding_completed: false }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = String(data.msg || data.message || data.error_description || '');
    const duplicate = response.status === 422 || /already|registered|exists/i.test(detail);
    return res.status(duplicate ? 409 : 400).json({
      error: duplicate ? 'Este e-mail já possui uma conta no LUAR.' : 'Não foi possível criar a conta.'
    });
  }

  return res.status(201).json({ created: true, userId: data.id });
};
