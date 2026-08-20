const accountStateHandler = require("./account-state");
const { json, requireUser, requireSameOrigin, rateLimit } = require("./_lib");
const { sanitizeDashboardCustomization } = require("./_state-schema");

module.exports = async function customizationHandler(req, res) {
  try {
    if (!["GET", "PUT"].includes(req.method)) return json(res, 405, { error: "Método não permitido." });
    requireSameOrigin(req, req.method !== "GET");
    await rateLimit(req, `customization:${req.method.toLowerCase()}`, req.method === "GET" ? 60 : 20, 10 * 60 * 1000);
    const user = await requireUser(req);
    await rateLimit(req, `customization:user:${req.method.toLowerCase()}`, req.method === "GET" ? 90 : 30, 10 * 60 * 1000, user.id);
    const account = await accountStateHandler.ensureAccount(user);
    const entitled = account?.plan === "lifetime" && Array.isArray(account.user_ids) && account.user_ids.includes(user.id);
    if (!entitled) return json(res, 403, { error: "Personalização completa disponível somente no LUAR Vitalício." });
    if (req.method === "GET") return json(res, 200, { lifetime: true, customization: sanitizeDashboardCustomization(account.state?.profile?.dashboardCustomization), updatedAt: account.state_updated_at || null, revision: Math.max(0, Number(account.state_revision) || 0) });
    return accountStateHandler(req, res);
  } catch (error) {
    if (error.message === "ORIGIN_INVALID") return json(res, 403, { error: "Origem não autorizada." });
    if (error.message === "RATE_LIMITED") { res.setHeader("Retry-After", "60"); return json(res, 429, { error: "Muitas solicitações. Aguarde alguns minutos." }); }
    const auth = String(error.message).startsWith("AUTH_") || error.message === "EMAIL_REQUIRED";
    return json(res, auth ? 401 : 500, { error: auth ? "Sessão ou e-mail não confirmado." : "Não foi possível acessar a personalização." });
  }
};
