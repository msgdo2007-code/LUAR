const {
  json,
  readBody,
  requireUser,
  requireSameOrigin,
  rateLimit,
  canonicalEmail,
  authenticatedRpcRequest,
  requestAccessToken,
} = require("./_lib");

const OWNER_EMAIL = "msgdo.2007@gmail.com";
const ACTIONS = new Set(["grant", "revoke"]);
const PROVIDERS = new Set(["google", "discord", "email"]);

const currentIdentityProvider = (user) => {
  const identities = (Array.isArray(user?.identities) ? user.identities : [])
    .filter((identity) => identity?.provider)
    .map((identity) => ({
      provider: String(identity.provider).toLowerCase(),
      lastSignIn: Date.parse(identity.last_sign_in_at || identity.updated_at || identity.created_at || "") || 0,
    }))
    .sort((a, b) => b.lastSignIn - a.lastSignIn);
  if (identities.length) return identities[0].provider;
  return String(user?.app_metadata?.provider || "").toLowerCase();
};

const bearerClaims = (req) => {
  try {
    const token = requestAccessToken(req);
    const encoded = token.split(".")[1];
    return encoded ? JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) : {};
  } catch {
    return {};
  }
};

const isCurrentGoogleSession = (req, user) => {
  const methods = Array.isArray(bearerClaims(req).amr) ? bearerClaims(req).amr : [];
  const currentMethod = methods
    .map((entry) => ({ method: String(entry?.method || "").toLowerCase(), timestamp: Number(entry?.timestamp) || 0 }))
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (currentMethod?.method !== "oauth" || !currentMethod.timestamp) return false;
  const identities = (Array.isArray(user?.identities) ? user.identities : [])
    .filter((identity) => identity?.provider)
    .map((identity) => ({
      provider: String(identity.provider).toLowerCase(),
      timestamp: Math.floor((Date.parse(identity.last_sign_in_at || identity.updated_at || identity.created_at || "") || 0) / 1000),
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
  const currentIdentity = identities[0];
  return currentIdentity?.provider === "google" && currentIdentity.timestamp > 0 && Math.abs(currentIdentity.timestamp - currentMethod.timestamp) <= 300;
};

const requireOwner = (req, user) => {
  if (canonicalEmail(user) !== OWNER_EMAIL || currentIdentityProvider(user) !== "google" || !isCurrentGoogleSession(req, user)) throw new Error("ADMIN_FORBIDDEN");
};

const normalizeTargetEmail = (value) => {
  const email = String(value || "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("TARGET_INVALID");
  return email;
};

const rpcErrorMessage = (result) => {
  if (!result || typeof result.body !== "object" || !result.body) return String(result?.body || "");
  return String(result.body.message || result.body.details || result.body.hint || "");
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    // Esta rota existe apenas para o painel web; uma origem ausente também é rejeitada.
    if (!String(req.headers.origin || "")) throw new Error("ORIGIN_INVALID");
    requireSameOrigin(req);
    await rateLimit(req, "admin-lifetime-auth", 60, 10 * 60 * 1000);

    const user = await requireUser(req);
    requireOwner(req, user);
    await rateLimit(req, `admin-lifetime:${user.id}`, 12, 10 * 60 * 1000);
    const body = await readBody(req, 2_048);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("TARGET_INVALID");
    const action = String(body.action || "").trim().toLowerCase();
    const provider = String(body.provider || "").trim().toLowerCase();
    const email = normalizeTargetEmail(body.email);
    if (!ACTIONS.has(action) || !PROVIDERS.has(provider)) throw new Error("TARGET_INVALID");

    // Encaminha o JWT do dono, não a service role. A RPC valida auth.uid() novamente.
    const result = await authenticatedRpcRequest(req, "admin_manage_luar_lifetime", {
      p_action: action,
      p_target_email: email,
      p_provider: provider,
    });
    if (!result.ok) {
      const message = rpcErrorMessage(result);
      const code = typeof result.body === "object" && result.body ? String(result.body.code || "") : "";
      if (result.status === 401) throw new Error("AUTH_INVALID");
      if (result.status === 403 || code === "42501" || message.includes("ADMIN_FORBIDDEN")) throw new Error("ADMIN_FORBIDDEN");
      if (["PGRST202", "42883"].includes(code) || message.toLowerCase().includes("admin_manage_luar_lifetime")) throw new Error("MIGRATION_REQUIRED");
      if (message.includes("PERMANENT_LIFETIME")) throw new Error("PERMANENT_LIFETIME");
      if (message.includes("PROVIDER_MISMATCH")) throw new Error("PROVIDER_MISMATCH");
      if (message.includes("TARGET_INVALID") || code === "22023") throw new Error("TARGET_INVALID");
      throw new Error("ADMIN_STORAGE_ERROR");
    }

    const value = result.body && typeof result.body === "object" ? result.body : {};
    return json(res, 200, {
      email: String(value.email || email),
      provider: String(value.provider || provider),
      action,
      lifetime: Boolean(value.lifetime),
      source: String(value.source || (value.lifetime ? "admin" : "none")),
      changed: Boolean(value.changed),
    });
  } catch (error) {
    if (error.message === "ORIGIN_INVALID") return json(res, 403, { error: "Origem não autorizada." });
    if (error.message === "RATE_LIMITED") return json(res, 429, { error: "Muitas alterações. Aguarde alguns minutos." });
    if (error.message === "ADMIN_FORBIDDEN") return json(res, 403, { error: "Esta ação é exclusiva do administrador autorizado." });
    if (error.message === "TARGET_INVALID" || error.message === "BODY_INVALID") return json(res, 400, { error: "Informe uma ação, um e-mail e uma plataforma válidos." });
    if (error.message === "BODY_TOO_LARGE") return json(res, 413, { error: "Requisição muito grande." });
    if (error.message === "PERMANENT_LIFETIME") return json(res, 409, { error: "Este Vitalício é permanente e não pode ser removido." });
    if (error.message === "PROVIDER_MISMATCH") return json(res, 409, { error: "A plataforma escolhida não corresponde à concessão registrada." });
    if (error.message === "MIGRATION_REQUIRED") return json(res, 503, { error: "A migração administrativa ainda não foi aplicada ao banco." });
    if (String(error.message).startsWith("AUTH_") || error.message === "EMAIL_REQUIRED") return json(res, 401, { error: "Sessão expirada ou e-mail não confirmado." });
    console.error("Admin lifetime error", error.message);
    return json(res, 500, { error: "Não foi possível alterar o plano agora." });
  }
};
