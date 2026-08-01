const crypto = require("crypto");

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
};

const readBody = async (req, maxBytes = 16_384) => {
  if (req.body && typeof req.body === "object") {
    if (Buffer.byteLength(JSON.stringify(req.body)) > maxBytes) throw new Error("BODY_TOO_LARGE");
    return req.body;
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > maxBytes) throw new Error("BODY_TOO_LARGE");
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("BODY_INVALID");
  }
};

const requestOriginAllowed = (req) => {
  const origin = String(req.headers.origin || "");
  if (!origin) return true;
  const allowed = new Set([
    "https://luarhub.site",
    "https://www.luarhub.site",
    ...(process.env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean),
  ]);
  if (process.env.VERCEL_ENV !== "production") {
    allowed.add("http://localhost:8765");
    allowed.add("http://127.0.0.1:8765");
  }
  return allowed.has(origin);
};

const requireSameOrigin = (req) => {
  if (!requestOriginAllowed(req)) throw new Error("ORIGIN_INVALID");
};

const buckets = new Map();
const rateLimit = (req, namespace, limit = 20, windowMs = 60_000) => {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const key = `${namespace}:${ip}`;
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((time) => now - time < windowMs);
  if (hits.length >= limit) throw new Error("RATE_LIMITED");
  hits.push(now);
  buckets.set(key, hits);
};

const requireUser = async (req) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) throw new Error("SERVER_CONFIG");
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
const signingSecret = () => {
  const secret = process.env.LIFETIME_SIGNING_SECRET || "";
  if (secret.length < 32) throw new Error("SERVER_CONFIG");
  return secret;
};
const signature = (value) =>
  crypto.createHmac("sha256", signingSecret()).update(value).digest("base64url");

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

module.exports = { json, readBody, requireUser, requireSameOrigin, rateLimit, signPayload, verifyPayload };
