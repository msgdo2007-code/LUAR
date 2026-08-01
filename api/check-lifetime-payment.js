const { json, readBody, requireUser, signPayload, verifyPayload } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    const [user, body] = await Promise.all([requireUser(req), readBody(req)]);
    const claim = verifyPayload(body.checkoutToken);
    if (!claim || claim.type !== "checkout" || claim.uid !== user.id || claim.transactionId !== body.id) {
      return json(res, 403, { error: "Cobrança inválida para esta conta." });
    }
    const response = await fetch(`https://api.pushinpay.com.br/api/transactions/${encodeURIComponent(body.id)}`, {
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
      transactionId: body.id,
      paidAt: new Date().toISOString(),
      plan: "LUAR_VITALICIO",
    });
    return json(res, 200, { paid: true, status: "paid", license });
  } catch (error) {
    const auth = String(error.message).startsWith("AUTH_");
    return json(res, auth ? 401 : 500, { error: auth ? "Sessão expirada. Entre novamente." : "Falha ao consultar pagamento." });
  }
};
