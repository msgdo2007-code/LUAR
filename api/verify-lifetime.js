const { json, readBody, requireUser, verifyPayload } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    const [user, body] = await Promise.all([requireUser(req), readBody(req)]);
    const license = verifyPayload(body.license);
    const lifetime = Boolean(license && license.type === "lifetime" && license.uid === user.id && license.plan === "LUAR_VITALICIO");
    return json(res, 200, { lifetime, paidAt: lifetime ? license.paidAt : null });
  } catch {
    return json(res, 401, { lifetime: false });
  }
};
