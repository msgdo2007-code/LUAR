const { json, readBody, requireUser, requireSameOrigin, rateLimit, verifyPayload, canonicalEmail, getLuarAccount, upsertLuarAccount } = require("./_lib");

const cleanState = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const cleanBackups = (value) => Array.isArray(value) ? value.slice(0, 8) : [];

const ensureAccount = async (user) => {
  const email = canonicalEmail(user);
  const metadata = user.user_metadata || {};
  const legacyLicense = verifyPayload(metadata.luar_lifetime_license);
  const legacyLifetime = Boolean(legacyLicense && legacyLicense.type === "lifetime" && legacyLicense.uid === user.id && legacyLicense.plan === "LUAR_VITALICIO");
  let account = await getLuarAccount(email);
  const userIds = [...new Set([...(Array.isArray(account?.user_ids) ? account.user_ids : []), user.id])];
  if (!account || legacyLifetime || !account.user_ids?.includes(user.id)) {
    account = await upsertLuarAccount({
      email,
      user_ids: userIds,
      plan: account?.plan === "lifetime" || legacyLifetime ? "lifetime" : "free",
      lifetime_paid_at: account?.lifetime_paid_at || (legacyLifetime ? legacyLicense.paidAt || new Date().toISOString() : null),
      lifetime_transaction_id: account?.lifetime_transaction_id || (legacyLifetime ? legacyLicense.transactionId || null : null),
      state: Object.keys(cleanState(account?.state)).length ? account.state : cleanState(metadata.luar_state),
      state_updated_at: account?.state_updated_at || metadata.luar_updated_at || null,
      backups: cleanBackups(account?.backups?.length ? account.backups : metadata.luar_backups),
      updated_at: new Date().toISOString(),
    });
  }
  return account;
};

module.exports = async (req, res) => {
  try {
    if (!["GET", "PUT"].includes(req.method)) return json(res, 405, { error: "Método não permitido." });
    requireSameOrigin(req);
    rateLimit(req, "account-state", req.method === "GET" ? 90 : 45, 10 * 60 * 1000);
    const user = await requireUser(req);
    let account = await ensureAccount(user);

    if (req.method === "PUT") {
      if (account?.plan !== "lifetime") return json(res, 403, { error: "O salvamento na nuvem é exclusivo do Vitalício." });
      const body = await readBody(req, 2_000_000);
      const incoming = cleanState(body.state);
      if (!incoming.profile || !Array.isArray(incoming.transactions) || !Array.isArray(incoming.tasks)) return json(res, 400, { error: "Estado da conta inválido." });
      const serialized = JSON.stringify(incoming);
      if (Buffer.byteLength(serialized) > 1_500_000) return json(res, 413, { error: "O backup excedeu o tamanho permitido." });
      const updatedAt = new Date().toISOString();
      const previous = cleanState(account.state);
      const backups = cleanBackups([...(Object.keys(previous).length && JSON.stringify(previous) !== serialized ? [{ savedAt: account.state_updated_at || updatedAt, state: previous }] : []), ...cleanBackups(account.backups)]);
      account = await upsertLuarAccount({ email: canonicalEmail(user), user_ids: [...new Set([...(account.user_ids || []), user.id])], plan: "lifetime", state: incoming, state_updated_at: updatedAt, backups, updated_at: updatedAt });
    }

    const lifetime = account?.plan === "lifetime";
    return json(res, 200, { email: canonicalEmail(user), lifetime, paidAt: lifetime ? account.lifetime_paid_at : null, state: lifetime ? cleanState(account.state) : null, updatedAt: lifetime ? account.state_updated_at : null, backups: lifetime ? cleanBackups(account.backups) : [] });
  } catch (error) {
    if (error.message === "ORIGIN_INVALID") return json(res, 403, { error: "Origem não autorizada." });
    if (error.message === "RATE_LIMITED") return json(res, 429, { error: "Muitas solicitações. Aguarde alguns minutos." });
    if (error.message === "BODY_TOO_LARGE") return json(res, 413, { error: "Backup muito grande." });
    const auth = String(error.message).startsWith("AUTH_") || error.message === "EMAIL_REQUIRED";
    return json(res, auth ? 401 : 500, { error: auth ? "Sessão ou e-mail não confirmado." : "Não foi possível acessar os dados da conta." });
  }
};
