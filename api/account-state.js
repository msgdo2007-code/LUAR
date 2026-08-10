const { json, readBody, requireUser, requireSameOrigin, rateLimit, verifyPayload, canonicalEmail, getLuarAccount, upsertLuarAccount, upsertLuarAccountCompat } = require("./_lib");

const cleanState = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const stateHasContent = (state) => ["transactions", "tasks", "habits", "goals", "subscriptions", "wishlist", "investments", "events", "moods", "notes", "focusSessions"].some((key) => Array.isArray(state?.[key]) && state[key].length);
const embeddedImage = (value) => /^data:image\/(?:png|jpe?g|webp);base64,/i.test(String(value || ""));
const snapshotState = (value) => {
  const state = cleanState(value);
  const profile = cleanState(state.profile);
  if (!embeddedImage(profile.avatar) && !embeddedImage(profile.customBanner)) return state;
  const safeProfile = { ...profile };
  if (embeddedImage(safeProfile.avatar)) delete safeProfile.avatar;
  if (embeddedImage(safeProfile.customBanner)) delete safeProfile.customBanner;
  return { ...state, profile: safeProfile };
};
const cleanBackups = (value) => {
  if (!Array.isArray(value)) return [];
  const kept = [];
  let totalBytes = 0;
  for (const candidate of value.slice(0, 10)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const backup = { savedAt: candidate.savedAt || null, state: snapshotState(candidate.state), manual: candidate.manual === true };
    const bytes = Buffer.byteLength(JSON.stringify(backup));
    if (bytes > 1_600_000 || totalBytes + bytes > 16_000_000) break;
    kept.push(backup);
    totalBytes += bytes;
  }
  return kept;
};
const backupSummaries = (value) => cleanBackups(value).filter((backup) => backup.manual).map((backup) => ({ savedAt: backup.savedAt, manual: true, size: Buffer.byteLength(JSON.stringify(backup.state)) }));

const ensureAccount = async (user) => {
  const email = canonicalEmail(user);
  const metadata = user.user_metadata || {};
  const legacyLicense = verifyPayload(metadata.luar_lifetime_license);
  const legacyLifetime = Boolean(legacyLicense && legacyLicense.type === "lifetime" && legacyLicense.uid === user.id && (!legacyLicense.email || String(legacyLicense.email).trim().toLowerCase() === email) && legacyLicense.plan === "LUAR_VITALICIO");
  let account = await getLuarAccount(email);
  const userIds = [...new Set([...(Array.isArray(account?.user_ids) ? account.user_ids : []), user.id])];
  if (!account || legacyLifetime || !account.user_ids?.includes(user.id)) {
    account = await upsertLuarAccountCompat({
      email,
      user_ids: userIds,
      plan: account?.plan === "lifetime" || legacyLifetime ? "lifetime" : "free",
      lifetime_paid_at: account?.lifetime_paid_at || (legacyLifetime ? legacyLicense.paidAt || new Date().toISOString() : null),
      lifetime_transaction_id: account?.lifetime_transaction_id || (legacyLifetime ? legacyLicense.transactionId || null : null),
      state: Object.keys(cleanState(account?.state)).length ? account.state : cleanState(metadata.luar_state),
      state_updated_at: account?.state_updated_at || metadata.luar_updated_at || null,
      backups: cleanBackups(account?.backups?.length ? account.backups : metadata.luar_backups),
      updated_at: new Date().toISOString(),
    }, legacyLifetime ? { lifetime_source: "legacy" } : {});
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
      const body = await readBody(req, 2_000_000);
      const incoming = cleanState(body.state);
      if (!incoming.profile || !Array.isArray(incoming.transactions) || !Array.isArray(incoming.tasks)) return json(res, 400, { error: "Estado da conta inválido." });
      const serialized = JSON.stringify(incoming);
      if (Buffer.byteLength(serialized) > 1_500_000) return json(res, 413, { error: "O backup excedeu o tamanho permitido." });
      const updatedAt = new Date().toISOString();
      const previous = cleanState(account.state);
      if (stateHasContent(previous) && !stateHasContent(incoming) && body.allowEmpty !== true) return json(res, 409, { error: "O salvamento vazio foi bloqueado para proteger seus dados." });
      const lifetime = account?.plan === "lifetime";
      const existingBackups = cleanBackups(account.backups);
      const backups = lifetime ? cleanBackups(body.createBackup === true ? [{ savedAt: updatedAt, state: incoming, manual: true }, ...existingBackups] : existingBackups) : [];
      account = await upsertLuarAccount({ email: canonicalEmail(user), user_ids: [...new Set([...(account.user_ids || []), user.id])], plan: lifetime ? "lifetime" : "free", state: incoming, state_updated_at: updatedAt, backups, updated_at: updatedAt });
    }

    const lifetime = account?.plan === "lifetime";
    return json(res, 200, { email: canonicalEmail(user), lifetime, paidAt: lifetime ? account.lifetime_paid_at : null, state: cleanState(account.state), updatedAt: account.state_updated_at || null, backups: lifetime ? backupSummaries(account.backups) : [] });
  } catch (error) {
    if (error.message === "ORIGIN_INVALID") return json(res, 403, { error: "Origem não autorizada." });
    if (error.message === "RATE_LIMITED") return json(res, 429, { error: "Muitas solicitações. Aguarde alguns minutos." });
    if (error.message === "BODY_TOO_LARGE") return json(res, 413, { error: "Backup muito grande." });
    const auth = String(error.message).startsWith("AUTH_") || error.message === "EMAIL_REQUIRED";
    return json(res, auth ? 401 : 500, { error: auth ? "Sessão ou e-mail não confirmado." : "Não foi possível acessar os dados da conta." });
  }
};
