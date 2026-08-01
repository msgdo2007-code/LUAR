const { json, readBody, requireUser, requireSameOrigin, rateLimit, signPayload, verifyPayload, canonicalEmail, adminRequest, getLuarAccount, upsertLuarAccount } = require("./_lib");

const amountInCents = (payment) => {
  const raw = payment.value ?? payment.amount ?? payment.amount_cents;
  const numeric = Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(numeric)) return 0;
  if (payment.amount_cents !== undefined || Number.isInteger(numeric) && numeric >= 100) return Math.round(numeric);
  return Math.round(numeric * 100);
};

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    requireSameOrigin(req);
    rateLimit(req, "check-payment", 30, 10 * 60 * 1000);
    if (!process.env.PUSHINPAY_TOKEN) throw new Error("SERVER_CONFIG");
    const [user, body] = await Promise.all([requireUser(req), readBody(req)]);
    const email = canonicalEmail(user);
    const transactionId = String(body.id || "");
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(transactionId)) return json(res, 400, { error: "Identificador de cobrança inválido." });
    const claim = verifyPayload(body.checkoutToken);
    if (!claim || claim.type !== "checkout" || claim.uid !== user.id || claim.email !== email || claim.transactionId !== transactionId || !Number.isFinite(claim.expiresAt) || claim.expiresAt < Date.now()) {
      return json(res, 403, { error: "Cobrança inválida para esta conta." });
    }
    const storedRows = await adminRequest(`luar_payments?transaction_id=eq.${encodeURIComponent(transactionId)}&account_email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
    const storedPayment = Array.isArray(storedRows) ? storedRows[0] : null;
    if (!storedPayment || storedPayment.user_id !== user.id || storedPayment.amount_cents !== 3990) return json(res, 403, { error: "Cobrança não pertence a esta conta." });
    const response = await fetch(`https://api.pushinpay.com.br/api/transactions/${encodeURIComponent(transactionId)}`, {
      headers: {
        Authorization: `Bearer ${process.env.PUSHINPAY_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    const payment = await response.json().catch(() => ({}));
    if (!response.ok) return json(res, 502, { error: "Não foi possível consultar o pagamento." });
    const status = String(payment.status || "created").toLowerCase();
    const paid = status === "paid" && amountInCents(payment) === 3990;
    await adminRequest(`luar_payments?transaction_id=eq.${encodeURIComponent(transactionId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status, updated_at: new Date().toISOString(), ...(paid ? { paid_at: new Date().toISOString() } : {}) }) });
    if (!paid) return json(res, 200, { paid: false, status });
    const account = await getLuarAccount(email);
    const paidAt = storedPayment.paid_at || new Date().toISOString();
    await upsertLuarAccount({ email, user_ids: [...new Set([...(account?.user_ids || []), user.id])], plan: "lifetime", lifetime_paid_at: account?.lifetime_paid_at || paidAt, lifetime_transaction_id: account?.lifetime_transaction_id || transactionId, updated_at: paidAt });
    const license = signPayload({
      type: "lifetime",
      uid: user.id,
      transactionId,
      paidAt,
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
