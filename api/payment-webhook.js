const { json, readBody, rateLimit, getAuthUserById, sendDiscordEvent, adminRequest, getLuarAccount, upsertLuarAccountCompat } = require("./_lib");

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
    await rateLimit(req, "payment-webhook", 120, 10 * 60 * 1000);
    if (!process.env.PUSHINPAY_TOKEN) throw new Error("SERVER_CONFIG");
    const body = await readBody(req, 32_768);
    const transactionId = String(body.id || body.transaction_id || body.transactionId || body.data?.id || body.data?.transaction_id || "");
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(transactionId)) return json(res, 200, { received: true });
    const rows = await adminRequest(`luar_payments?transaction_id=eq.${encodeURIComponent(transactionId)}&select=*&limit=1`);
    const stored = Array.isArray(rows) ? rows[0] : null;
    if (!stored) return json(res, 200, { received: true });
    const response = await fetch(`https://api.pushinpay.com.br/api/transactions/${encodeURIComponent(transactionId)}`, { headers: { Authorization: `Bearer ${process.env.PUSHINPAY_TOKEN}`, Accept: "application/json", "Content-Type": "application/json" } });
    const payment = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("PAYMENT_LOOKUP_FAILED");
    const status = String(payment.status || "created").toLowerCase();
    const paid = status === "paid" && amountInCents(payment) === stored.amount_cents && stored.amount_cents === 3990;
    const now = new Date().toISOString();
    await adminRequest(`luar_payments?transaction_id=eq.${encodeURIComponent(transactionId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status, updated_at: now, ...(paid ? { paid_at: stored.paid_at || now } : {}) }) });
    if (paid) {
      const account = await getLuarAccount(stored.account_email);
      await upsertLuarAccountCompat(
        { email: stored.account_email, user_ids: [...new Set([...(account?.user_ids || []), stored.user_id])], plan: "lifetime", lifetime_paid_at: account?.lifetime_paid_at || stored.paid_at || now, lifetime_transaction_id: account?.lifetime_transaction_id || transactionId, updated_at: now },
        { lifetime_source: "purchase" },
      );
      if (!stored.paid_at) {
        const user = await getAuthUserById(stored.user_id);
        await sendDiscordEvent({ type: "payment_paid", user, email: stored.account_email, transactionId, amountCents: stored.amount_cents });
      }
    }
    return json(res, 200, { received: true });
  } catch (error) {
    if (error.message === "RATE_LIMITED") return json(res, 429, { error: "Muitas notificações." });
    if (error.message === "BODY_TOO_LARGE" || error.message === "BODY_INVALID") return json(res, 400, { error: "Notificação inválida." });
    console.error("Payment webhook error", error.message);
    return json(res, 500, { error: "Falha ao processar notificação." });
  }
};
