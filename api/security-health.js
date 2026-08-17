const { json, rateLimit, adminRequest } = require('./_lib');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return json(res, 405, { ok: false });
    await rateLimit(req, 'security-health', 15, 10 * 60 * 1000);
    const tables = await adminRequest('rpc/luar_tables_without_rls', {
      method: 'POST',
      body: '{}',
    });
    if (!Array.isArray(tables) || tables.length) return json(res, 503, { ok: false, rls: false });
    return json(res, 200, { ok: true, rls: true });
  } catch (error) {
    if (error.message === 'RATE_LIMITED') return json(res, 429, { ok: false });
    return json(res, 503, { ok: false, rls: false });
  }
};
