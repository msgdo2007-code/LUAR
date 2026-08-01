const crypto = require("crypto");
const { json, requireUser, requireSameOrigin, rateLimit, signPayload } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    requireSameOrigin(req);
    rateLimit(req, "create-payment", 6, 10 * 60 * 1000);
    if (!process.env.PUSHINPAY_TOKEN) throw new Error("SERVER_CONFIG");
    const user = await requireUser(req);
    const publicSite = new URL(process.env.PUBLIC_SITE_URL || "https://luarhub.site");
    if (publicSite.protocol !== "https:") throw new Error("SERVER_CONFIG");
    const now = Date.now();
    const response = await fetch("https://api.pushinpay.com.br/api/pix/cashIn", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PUSHINPAY_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        value: 3990,
        webhook_url: `${publicSite.origin}/api/payment-webhook`,
        split_rules: [],
      }),
    });
    const payment = await response.json().catch(() => ({}));
    if (!response.ok || !payment.id) {
      console.error("Pushin Pay create error", response.status, payment);
      return json(res, 502, { error: payment.message || "Não foi possível gerar o Pix agora." });
    }
    return json(res, 200, {
      id: payment.id,
      status: payment.status,
      value: payment.value,
      qrCode: payment.qr_code,
      qrCodeBase64: payment.qr_code_base64,
      checkoutToken: signPayload({ type: "checkout", uid: user.id, transactionId: payment.id, issuedAt: now, expiresAt: now + 2 * 60 * 60 * 1000 }),
    });
  } catch (error) {
    if (error.message === "ORIGIN_INVALID") return json(res, 403, { error: "Origem não autorizada." });
    if (error.message === "RATE_LIMITED") return json(res, 429, { error: "Muitas tentativas. Aguarde antes de gerar outro Pix." });
    const auth = String(error.message).startsWith("AUTH_");
    return json(res, auth ? 401 : 500, { error: auth ? "Entre na sua conta para continuar." : "Falha ao iniciar pagamento." });
  }
};
