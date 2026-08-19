const { json, readBody, requireSameOrigin, rateLimit, adminRequest } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido.' });
  try {
    requireSameOrigin(req, true);
    await rateLimit(req, 'referral-click', 20, 10 * 60 * 1000);
    const body = await readBody(req, 2048);
    const code = String(body.code || '').trim().toUpperCase();
    const eventId = String(body.eventId || '').trim().toLowerCase();
    const source = String(body.source || 'link').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 64) || 'link';
    if (!/^[A-Z0-9]{8,16}$/.test(code) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(eventId)) return json(res, 400, { error: 'Convite inválido.' });
    const profiles = await adminRequest(`luar_referral_profiles?code=eq.${encodeURIComponent(code)}&select=user_id&limit=1`);
    if (!profiles?.[0]) return json(res, 204, {});
    await adminRequest('luar_referral_clicks?on_conflict=event_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ event_id: eventId, referrer_user_id: profiles[0].user_id, source }) });
    return json(res, 204, {});
  } catch (error) {
    if (error.message === 'RATE_LIMITED') return json(res, 429, { error: 'Muitas tentativas.' });
    if (error.message === 'ORIGIN_INVALID') return json(res, 403, { error: 'Origem não autorizada.' });
    return json(res, 204, {});
  }
};
