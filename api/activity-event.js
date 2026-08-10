const { json, readBody, requireUser, requireSameOrigin, rateLimit, canonicalEmail, authProvider, sendDiscordEvent } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    requireSameOrigin(req);
    rateLimit(req, "activity-event", 20, 60 * 60 * 1000);
    const [user, body] = await Promise.all([requireUser(req), readBody(req, 2_048)]);
    if (body.event !== "login") return json(res, 400, { error: "Evento inválido." });
    const email = canonicalEmail(user);
    await sendDiscordEvent({ type: "login", user, email, provider: authProvider(user) });
    return json(res, 200, { notified: true });
  } catch (error) {
    if (error.message === "ORIGIN_INVALID") return json(res, 403, { error: "Origem não autorizada." });
    if (error.message === "RATE_LIMITED") return json(res, 429, { error: "Muitas notificações." });
    if (error.message === "BODY_TOO_LARGE" || error.message === "BODY_INVALID") return json(res, 400, { error: "Requisição inválida." });
    const auth = String(error.message).startsWith("AUTH_") || error.message === "EMAIL_REQUIRED";
    return json(res, auth ? 401 : 500, { error: auth ? "Sessão inválida." : "Não foi possível registrar o evento." });
  }
};
