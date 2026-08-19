const crypto = require('crypto');
const { json, readBody, requireUser, requireSameOrigin, rateLimit, canonicalEmail, adminRequest, grantReferralLifetimeIfEligible } = require('./_lib');

const ATTRIBUTION_WINDOW_DAYS = 30;
const ACTIVE_STATUSES = new Set(['pending', 'verified', 'approved']);
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

async function auditTransition({ referralId, actorUserId, actorType, previousStatus, newStatus, reason }) {
  await adminRequest('luar_referral_audit', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ referral_id: referralId, actor_user_id: actorUserId || null, actor_type: actorType, previous_status: previousStatus || null, new_status: newStatus, reason }) });
}

const attributionDeadline = user => {
  const created = Date.parse(user.created_at || '');
  return Number.isFinite(created) ? new Date(created + ATTRIBUTION_WINDOW_DAYS * 86400000) : null;
};

async function hasPaidLifetime(userId) {
  const rows = await adminRequest(`luar_payments?user_id=eq.${encodeURIComponent(userId)}&status=eq.paid&select=id&limit=1`);
  return Boolean(rows?.length);
}

async function verifyAttribution(referral, user, now = new Date().toISOString()) {
  if (referral.status !== 'pending') return referral;
  const verified = await adminRequest(`luar_referrals?id=eq.${encodeURIComponent(referral.id)}&status=eq.pending`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'verified', verified_at: now, updated_at: now, status_reason: 'authenticated_email_confirmed' }) });
  if (!verified?.[0]) return referral;
  try {
    await auditTransition({ referralId: referral.id, actorUserId: user.id, actorType: 'system', previousStatus: 'pending', newStatus: 'verified', reason: 'authenticated_email_confirmed' });
  } catch (error) {
    console.error('Referral verification audit failed', error.message);
  }
  return verified[0];
}

async function createAttribution(user, code, source) {
  const deadline = attributionDeadline(user);
  if (!deadline || deadline.getTime() < Date.now()) throw new Error('ATTRIBUTION_EXPIRED');
  if (await hasPaidLifetime(user.id)) throw new Error('ATTRIBUTION_AFTER_PURCHASE');
  const referrers = await adminRequest(`luar_referral_profiles?code=eq.${encodeURIComponent(code)}&select=user_id&limit=1`);
  const referrer = Array.isArray(referrers) ? referrers[0] : null;
  if (!referrer) throw new Error('REFERRAL_NOT_FOUND');
  if (referrer.user_id === user.id) throw new Error('SELF_REFERRAL');
  const existing = await adminRequest(`luar_referrals?referred_user_id=eq.${encodeURIComponent(user.id)}&select=id,referrer_user_id,status&limit=1`);
  if (existing?.length) {
    if (existing[0].referrer_user_id !== referrer.user_id) throw new Error('REFERRAL_LOCKED');
    return verifyAttribution(existing[0], user);
  }
  const now = new Date().toISOString();
  const created = await adminRequest('luar_referrals', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ referrer_user_id: referrer.user_id, referred_user_id: user.id, referred_email: canonicalEmail(user), source: safeSource(source), status: 'pending', attributed_at: now, updated_at: now, verified_at: now }) });
  const referral = created?.[0];
  if (!referral) throw new Error('REFERRAL_CREATE_FAILED');
  await auditTransition({ referralId: referral.id, actorUserId: user.id, actorType: 'user', previousStatus: null, newStatus: 'pending', reason: 'code_confirmed_by_referred_user' });
  return verifyAttribution(referral, user, now);
}

module.exports = async function handler(req, res) {
  try {
    requireSameOrigin(req, req.method === 'POST');
    await rateLimit(req, 'referrals', req.method === 'POST' ? 10 : 60, 10 * 60 * 1000);
    const user = await requireUser(req);
    await rateLimit(req, 'referrals-user', req.method === 'POST' ? 5 : 30, 10 * 60 * 1000, user.id);
    const profile = await ensureProfile(user);
    if (req.method === 'POST') {
      const body = await readBody(req, 4096);
      const code = String(body.code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{8,16}$/.test(code)) return json(res, 400, { error: 'Código de indicação inválido.' });
      await createAttribution(user, code, body.source);
    } else if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, POST');
      return json(res, 405, { error: 'Método não permitido.' });
    }
    const [referrals, ownAttribution, paidLifetime, clicks] = await Promise.all([
      adminRequest(`luar_referrals?referrer_user_id=eq.${encodeURIComponent(user.id)}&status=in.(pending,verified,approved)&select=referred_email,source,status,verified_at,approved_at&order=created_at.desc&limit=100`),
      adminRequest(`luar_referrals?referred_user_id=eq.${encodeURIComponent(user.id)}&select=status,created_at&limit=1`),
      hasPaidLifetime(user.id),
      adminRequest(`luar_referral_clicks?referrer_user_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1000`),
    ]);
    const active = (referrals || []).filter(item => ACTIVE_STATUSES.has(item.status));
    const verified = active.filter(item => item.status === 'verified' || item.status === 'approved').length;
    const reward = await grantReferralLifetimeIfEligible(user.id);
    const deadline = attributionDeadline(user);
    const canApplyCode = !ownAttribution?.length && !paidLifetime && Boolean(deadline && deadline.getTime() >= Date.now());
    return json(res, 200, { code: profile.code, inviteUrl: `https://luarhub.site/?ref=${profile.code}&utm_source=referral&utm_medium=invite&utm_campaign=member_get_member`, clicks: Array.isArray(clicks) ? clicks.length : 0, verified, purchased: reward.purchased, goal: reward.goal, rewardUnlocked: reward.rewardUnlocked, rewardXp: verified * 25, rewardPerReferral: 25, attribution: ownAttribution?.[0] ? { status: ownAttribution[0].status } : null, canApplyCode, attributionDeadline: canApplyCode ? deadline.toISOString() : null, invitations: active.map(item => ({ email: maskEmail(item.referred_email), source: item.source, status: item.status, verifiedAt: item.verified_at, approvedAt: item.approved_at, purchased: item.status === 'approved' })) });
  } catch (error) {
    const known = { AUTH_REQUIRED: [401, 'Entre na conta para acessar indicações.'], AUTH_INVALID: [401, 'Entre na conta para acessar indicações.'], EMAIL_REQUIRED: [403, 'Confirme seu e-mail antes de usar indicações.'], RATE_LIMITED: [429, 'Muitas tentativas. Aguarde e tente novamente.'], ORIGIN_INVALID: [403, 'Origem não autorizada.'], REFERRAL_NOT_FOUND: [404, 'Código de indicação não encontrado.'], SELF_REFERRAL: [409, 'Você não pode indicar a própria conta.'], REFERRAL_LOCKED: [409, 'Esta conta já possui uma indicação confirmada.'], ATTRIBUTION_EXPIRED: [409, 'O prazo para informar um código de indicação terminou.'], ATTRIBUTION_AFTER_PURCHASE: [409, 'Não é possível vincular uma indicação depois da compra.'] };
    if (known[error.message]) return json(res, known[error.message][0], { error: known[error.message][1] });
    console.error('Referral API error', error.message);
    return json(res, 503, { error: 'Indicações aguardando ativação da estrutura segura no banco.' });
  }
};
