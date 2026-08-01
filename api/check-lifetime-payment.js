const { json, readBody, requireUser, requireSameOrigin, rateLimit, signPayload, verifyPayload } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    requireSameOrigin(req);
    rateLimit(req, "check-payment", 30, 10 * 60 * 1000);
    if (!process.env.PUSHINPAY_TOKEN) throw new Error("SERVER_CONFIG");
    const [user, body] = await Promise.all([requireUser(req), readBody(req)]);
    const transactionId = String(body.id || "");
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(transactionId)) return json(res, 400, { error: "Identificador de cobrança inválido." });
    const claim = verifyPayload(body.checkoutToken);
    if (!claim || claim.type !== "checkout" || claim.uid !== user.id || claim.transactionId !== transactionId || !Number.isFinite(claim.expiresAt) || claim.expiresAt < Date.now()) {
      return json(res, 403, { error: "Cobrança inválida para esta conta." });
    }
    const response = await fetch(`https://api.pushinpay.com.br/api/transactions/${encodeURIComponent(transactionId)}`, {
      headers: {
        Authorization: `Bearer ${process.env.PUSHINPAY_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    const payment = await response.json().catch(() => ({}));
    if (!response.ok) return json(res, 502, { error: "Não foi possível consultar o pagamento." });
    const paid = String(payment.status || "").toLowerCase() === "paid" && Number(payment.value || payment.amount) === 3990;
    if (!paid) return json(res, 200, { paid: false, status: payment.status || "created" });
    const license = signPayload({
      type: "lifetime",
      uid: user.id,
      transactionId,
      paidAt: new Date().toISOString(),
      plan: "LUAR_VITALICIO",
    });
    return json(res, 200, { paid: true, status: "paid", license });
  } catch (error) {
    if (error.message === "ORIGIN_INVALID") return json(res, 403, { error: "Origem não autorizada." });
    if (error.message === "RATE_LIMITED") return json(res, 429, { error: "Muitas verificações. Aguarde alguns minutos." });
    if (error.message === "BODY_TOO_LARGE" || error.message === "BODY_INVALID") return json(res, 400, { error: "Requisição inválida." });
    const auth = String(error.message).startsWith("AUTH_");
    return json(res, auth ? 401 : 500, { error: auth ? "Sessão expirada. Entre novamente." : "Falha ao consultar pagamento." });
  }
};
