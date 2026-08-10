const { json, readBody, requireUser, requireSameOrigin, rateLimit, canonicalEmail, getLuarAccount } = require("./_lib");

const cleanState = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
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
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate) || candidate.manual !== true) continue;
    const backup = { savedAt: candidate.savedAt || null, state: snapshotState(candidate.state), manual: true };
    const bytes = Buffer.byteLength(JSON.stringify(backup));
    if (bytes > 1_600_000 || totalBytes + bytes > 16_000_000) break;
    kept.push(backup);
    totalBytes += bytes;
  }
  return kept;
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    requireSameOrigin(req);
    rateLimit(req, "cloud-backup", 30, 10 * 60 * 1000);
    const [user, body] = await Promise.all([requireUser(req), readBody(req, 4_096)]);
    const account = await getLuarAccount(canonicalEmail(user));
    if (!account || account.plan !== "lifetime" || !account.user_ids?.includes(user.id)) return json(res, 403, { error: "Backup disponível somente no LUAR Vitalício." });
    const savedAt = String(body.savedAt || "");
    const backup = cleanBackups(account.backups).find((item) => item.savedAt === savedAt);
    if (!backup) return json(res, 404, { error: "Esta versão não foi encontrada." });
    return json(res, 200, { savedAt: backup.savedAt, state: backup.state });
  } catch (error) {
    if (error.message === "ORIGIN_INVALID") return json(res, 403, { error: "Origem não autorizada." });
    if (error.message === "RATE_LIMITED") return json(res, 429, { error: "Muitas solicitações. Aguarde alguns minutos." });
    if (error.message === "BODY_TOO_LARGE" || error.message === "BODY_INVALID") return json(res, 400, { error: "Solicitação inválida." });
    const auth = String(error.message).startsWith("AUTH_") || error.message === "EMAIL_REQUIRED";
    return json(res, auth ? 401 : 500, { error: auth ? "Sessão inválida." : "Não foi possível abrir o backup." });
  }
};
