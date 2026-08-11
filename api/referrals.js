const crypto = require('crypto');
const { json, readBody, requireUser, requireSameOrigin, rateLimit, canonicalEmail, adminRequest, grantReferralLifetimeIfEligible } = require('./_lib');

const referralCode = userId => crypto.createHash('sha256').update(`luar-referral:${userId}`).digest('hex').slice(0, 10).toUpperCase();
const maskEmail = email => {
  const [name = '', domain = ''] = String(email).split('@');
  return `${name.slice(0, 2)}${'*'.repeat(Math.min(6, Math.max(2, name.length - 2)))}@${domain}`;
};
const safeSource = value => String(value || 'link').toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 64) || 'link';

async function ensureProfile(user) {
  const email = canonicalEmail(user);
  const code = referralCode(user.id);
  const rows = await adminRequest('luar_referral_profiles?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ user_id: user.id, email, code, updated_at: new Date().toISOString() }) });
  return Array.isArray(rows) ? rows[0] : { code };
}

module.exports = async function handler(req, res) {
  try {
    requireSameOrigin(req);
    rateLimit(req, 'referrals', req.method === 'POST' ? 15 : 60, 10 * 60 * 1000);
    const user = await requireUser(req);
    const profile = await ensureProfile(user);
    if (req.method === 'POST') {
      const body = await readBody(req, 4096);
      const code = String(body.code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{8,16}$/.test(code)) return json(res, 400, { error: 'Código de indicação inválido.' });
      const referrers = await adminRequest(`luar_referral_profiles?code=eq.${encodeURIComponent(code)}&select=user_id&limit=1`);
      const referrer = Array.isArray(referrers) ? referrers[0] : null;
      if (!referrer) return json(res, 404, { error: 'Código de indicação não encontrado.' });
      if (referrer.user_id === user.id) return json(res, 409, { error: 'Você não pode indicar a própria conta.' });
      const existing = await adminRequest(`luar_referrals?referred_user_id=eq.${encodeURIComponent(user.id)}&select=id,referrer_user_id&limit=1`);
      if (!existing?.length) await adminRequest('luar_referrals', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ referrer_user_id: referrer.user_id, referred_user_id: user.id, referred_email: canonicalEmail(user), source: safeSource(body.source), status: 'verified', verified_at: new Date().toISOString() }) });
    } else if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, POST');
      return json(res, 405, { error: 'Método não permitido.' });
    }
    const referrals = await adminRequest(`luar_referrals?referrer_user_id=eq.${encodeURIComponent(user.id)}&status=eq.verified&select=referred_user_id,referred_email,source,verified_at&order=verified_at.desc&limit=100`);
    const verified = Array.isArray(referrals) ? referrals.length : 0;
    const reward = await grantReferralLifetimeIfEligible(user.id);
    const referredIds = [...new Set((referrals || []).map(item => item.referred_user_id).filter(Boolean))];
    let paidIds = new Set();
    if (referredIds.length) {
      const ids = referredIds.map(value => `"${String(value).replace(/["\\]/g, '')}"`).join(',');
      const paid = await adminRequest(`luar_payments?user_id=in.(${encodeURIComponent(ids)})&status=eq.paid&select=user_id&limit=100`);
      paidIds = new Set((paid || []).map(item => item.user_id));
    }
    return json(res, 200, { code: profile.code, inviteUrl: `https://luarhub.site/?ref=${profile.code}&utm_source=referral&utm_medium=invite&utm_campaign=member_get_member`, verified, purchased: reward.purchased, goal: reward.goal, rewardUnlocked: reward.rewardUnlocked, rewardXp: verified * 25, rewardPerReferral: 25, invitations: (referrals || []).map(item => ({ email: maskEmail(item.referred_email), source: item.source, verifiedAt: item.verified_at, purchased: paidIds.has(item.referred_user_id) })) });
  } catch (error) {
    if (error.message === 'AUTH_REQUIRED' || error.message === 'AUTH_INVALID') return json(res, 401, { error: 'Entre na conta para acessar indicações.' });
    if (error.message === 'EMAIL_REQUIRED') return json(res, 403, { error: 'Confirme seu e-mail antes de usar indicações.' });
    if (error.message === 'RATE_LIMITED') return json(res, 429, { error: 'Muitas tentativas. Aguarde e tente novamente.' });
    if (error.message === 'ORIGIN_INVALID') return json(res, 403, { error: 'Origem não autorizada.' });
    console.error('Referral API error', error.message);
    return json(res, 503, { error: 'Indicações aguardando ativação da estrutura no banco.' });
  }
};
