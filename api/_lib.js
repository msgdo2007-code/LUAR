const crypto = require("crypto");

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const requireUser = async (req) => {
  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("AUTH_REQUIRED");
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      authorization,
    },
  });
  if (!response.ok) throw new Error("AUTH_INVALID");
  return response.json();
};

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const signature = (value) =>
  crypto.createHmac("sha256", process.env.LIFETIME_SIGNING_SECRET).update(value).digest("base64url");

const signPayload = (payload) => {
  const encoded = encode(payload);
  return `${encoded}.${signature(encoded)}`;
};

const verifyPayload = (token) => {
  const [encoded, received] = String(token || "").split(".");
  if (!encoded || !received) return null;
  const expected = signature(encoded);
  if (expected.length !== received.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

module.exports = { json, readBody, requireUser, signPayload, verifyPayload };
