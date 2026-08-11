const { json, readBody, requireUser, requireSameOrigin, rateLimit, canonicalEmail, authProvider, sendDiscordEvent, adminRequest } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    requireSameOrigin(req);
    rateLimit(req, "activity-event", 20, 60 * 60 * 1000);
    const [user, body] = await Promise.all([requireUser(req), readBody(req, 2_048)]);
    if (!["login", "feedback"].includes(body.event)) return json(res, 400, { error: "Evento inválido." });
    const email = canonicalEmail(user);
    if (body.event === "feedback") {
      const kind = String(body.kind || "");
      const message = String(body.message || "").trim();
      const rating = Math.max(0, Math.min(5, Number(body.rating) || 0));
      if (!["suggestion", "problem", "review"].includes(kind) || message.length < 10 || message.length > 1800) return json(res, 400, { error: "Preencha a mensagem com 10 a 1.800 caracteres." });
      const webhook = String(process.env.DISCORD_FEEDBACK_WEBHOOK_URL || "");
      if (!/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(webhook)) throw new Error("SERVER_CONFIG");
      const labels = { suggestion: "Sugestão", problem: "Problema", review: "Avaliação" };
      const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ embeds: [{ title: `${labels[kind]} enviada pelo LUAR`, color: kind === "problem" ? 15158332 : 3342206, fields: [{ name: "Usuário", value: String(user.user_metadata?.name || user.email?.split("@")[0] || "Usuário").slice(0, 200), inline: true }, { name: "E-mail", value: email.slice(0, 200), inline: true }, ...(kind === "review" ? [{ name: "Nota", value: rating ? `${rating}/5` : "Não informada", inline: true }, { name: "Autorizou publicação", value: body.publishAuthorized === true ? "Sim" : "Não", inline: true }] : []), { name: "Mensagem", value: message.slice(0, 1024) }], timestamp: new Date().toISOString() }] }) });
      if (!response.ok) throw new Error("WEBHOOK_FAILED");
      return json(res, 200, { sent: true });
    }
    const recorded = await adminRequest("rpc/record_luar_login", { method: "POST", body: JSON.stringify({ p_email: email, p_user_id: user.id }) });
    const login = Array.isArray(recorded) ? recorded[0] : recorded;
    const loginCount = Math.max(1, Number(login?.login_count) || 1);
    const firstLogin = login?.first_login === true;
    await sendDiscordEvent({ type: "login", user, email, provider: authProvider(user), firstLogin, loginCount });
    return json(res, 200, { notified: true, firstLogin, loginCount });
  } catch (error) {
    if (error.message === "ORIGIN_INVALID") return json(res, 403, { error: "Origem não autorizada." });
    if (error.message === "RATE_LIMITED") return json(res, 429, { error: "Muitas notificações." });
    if (error.message === "BODY_TOO_LARGE" || error.message === "BODY_INVALID") return json(res, 400, { error: "Requisição inválida." });
    const auth = String(error.message).startsWith("AUTH_") || error.message === "EMAIL_REQUIRED";
    return json(res, auth ? 401 : 500, { error: auth ? "Sessão inválida." : "Não foi possível registrar o evento." });
  }
};
