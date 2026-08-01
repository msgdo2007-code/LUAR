const { json, readBody, requireUser, requireSameOrigin, rateLimit, verifyPayload, canonicalEmail, getLuarAccount, upsertLuarAccountCompat } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    requireSameOrigin(req);
    rateLimit(req, "verify-lifetime", 60, 10 * 60 * 1000);
    const [user, body] = await Promise.all([requireUser(req), readBody(req)]);
    const email = canonicalEmail(user);
    let account = await getLuarAccount(email);
    if (account?.plan === "lifetime") return json(res, 200, { lifetime: true, paidAt: account.lifetime_paid_at });
    const rawLicense = String(body.license || "");
    if (rawLicense.length > 4096) return json(res, 400, { lifetime: false });
    const license = verifyPayload(rawLicense);
    const lifetime = Boolean(license && license.type === "lifetime" && license.uid === user.id && (!license.email || String(license.email).trim().toLowerCase() === email) && license.plan === "LUAR_VITALICIO");
    if (lifetime) account = await upsertLuarAccountCompat(
      { email, user_ids: [...new Set([...(account?.user_ids || []), user.id])], plan: "lifetime", lifetime_paid_at: account?.lifetime_paid_at || license.paidAt || new Date().toISOString(), lifetime_transaction_id: account?.lifetime_transaction_id || license.transactionId || null, updated_at: new Date().toISOString() },
      { lifetime_source: "legacy" },
    );
    return json(res, 200, { lifetime, paidAt: lifetime ? license.paidAt : null });
  } catch (error) {
    if (error.message === "ORIGIN_INVALID") return json(res, 403, { lifetime: false });
    if (error.message === "RATE_LIMITED") return json(res, 429, { lifetime: false });
    return json(res, 401, { lifetime: false });
  }
};
