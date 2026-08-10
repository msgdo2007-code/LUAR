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

const canonicalEmail = (user) => {
  const email = String(user?.email || "").trim().toLowerCase();
  if (!email || !user?.email_confirmed_at) throw new Error("EMAIL_REQUIRED");
  return email;
};

const displayName = (user, fallbackEmail = "") => {
  const metadata = user?.user_metadata || {};
  const raw = metadata.name || metadata.full_name || metadata.user_name || metadata.preferred_username || String(fallbackEmail || user?.email || "").split("@")[0] || "Usuário LUAR";
  return String(raw).trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80) || "Usuário LUAR";
};

const authProvider = (user) => {
  const identities = Array.isArray(user?.identities) ? user.identities : [];
  const latestIdentity = identities
    .filter((identity) => identity?.provider)
    .map((identity) => ({ provider: identity.provider, timestamp: Date.parse(identity.last_sign_in_at || identity.updated_at || identity.created_at || "") || 0 }))
    .sort((left, right) => right.timestamp - left.timestamp)[0];
  const provider = latestIdentity?.provider || user?.app_metadata?.provider || "email";
  const normalized = String(provider).trim().toLowerCase();
  return normalized === "google" ? "Google" : normalized === "discord" ? "Discord" : "E-mail e senha";
};

const getAuthUserById = async (userId) => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || !/^[0-9a-f-]{20,64}$/i.test(String(userId || ""))) return null;
  const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, { headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` } });
  if (!response.ok) return null;
  return response.json().catch(() => null);
};

const sendDiscordEvent = async ({ type, user, email, transactionId = "", amountCents = 0, provider = "", firstLogin = false, loginCount = 0 }) => {
  try {
    const configured = String(
      type === "login"
        ? process.env.DISCORD_LOGIN_WEBHOOK_URL || process.env.DISCORD_ACTIVITY_WEBHOOK_URL || ""
        : process.env.DISCORD_PAYMENT_WEBHOOK_URL || process.env.DISCORD_ACTIVITY_WEBHOOK_URL || ""
    ).trim();
    if (!configured) return false;
    const webhook = new URL(configured);
    if (webhook.protocol !== "https:" || !["discord.com", "discordapp.com"].includes(webhook.hostname) || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(webhook.pathname)) return false;
    const safeEmail = String(email || user?.email || "").trim().toLowerCase().slice(0, 254);
    const labels = { login: { title: firstLogin ? "Primeiro login no LUAR" : "Login realizado novamente", color: firstLogin ? 0xff4d5e : 0x32ff7e }, payment_created: { title: "Página de pagamento criada", color: 0xf4c95d }, payment_paid: { title: "Pagamento confirmado", color: 0x57a9ff } };
    const event = labels[type];
    if (!event || !safeEmail) return false;
    const fields = [{ name: "Usuário", value: displayName(user, safeEmail), inline: true }, { name: "E-mail", value: safeEmail, inline: true }];
    if (type === "login") {
      fields.push({ name: "Plataforma", value: provider || authProvider(user), inline: true });
      fields.push({ name: "Acessos registrados", value: String(Math.max(1, Number(loginCount) || 1)), inline: true });
    }
    if (type.startsWith("payment_")) {
      fields.push({ name: "Valor", value: `R$ ${(Number(amountCents || 0) / 100).toFixed(2).replace(".", ",")}`, inline: true });
      if (transactionId) fields.push({ name: "Transação", value: String(transactionId).slice(0, 128), inline: false });
    }
    const response = await fetch(webhook.href, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "LUAR", allowed_mentions: { parse: [] }, embeds: [{ title: event.title, color: event.color, fields, timestamp: new Date().toISOString(), footer: { text: "luarhub.site" } }] }) });
    if (!response.ok) console.error("Discord activity notification failed", response.status);
    return response.ok;
  } catch (error) {
    console.error("Discord activity notification failed", error?.message || "unknown");
    return false;
  }
};

const adminRequest = async (path, options = {}) => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SERVER_CONFIG");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    console.error("Supabase admin request failed", response.status, typeof body === "string" ? body.slice(0, 300) : body?.code || body?.message || "unknown");
    const error = new Error("STORAGE_ERROR");
    error.storageStatus = response.status;
    error.storageCode = typeof body === "object" && body ? body.code : "";
    error.storageMessage = typeof body === "object" && body ? String(body.message || body.details || "") : String(body || "");
    throw error;
  }
  return body;
};

const authenticatedRpcRequest = async (req, functionName, args = {}) => {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const authorization = String(req.headers.authorization || "");
  if (!url || !anonKey) throw new Error("SERVER_CONFIG");
  if (!authorization.startsWith("Bearer ")) throw new Error("AUTH_REQUIRED");
  if (!/^[a-z0-9_]+$/.test(functionName)) throw new Error("RPC_INVALID");
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: response.ok, status: response.status, body };
};

const getLuarAccount = async (email) => {
  const rows = await adminRequest(`luar_accounts?email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
};

const upsertLuarAccount = async (account) => {
  const rows = await adminRequest("luar_accounts?on_conflict=email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(account) });
  return Array.isArray(rows) ? rows[0] || null : null;
};

const PROVENANCE_COLUMNS = ["lifetime_source", "lifetime_provider", "lifetime_granted_by", "lifetime_granted_at", "lifetime_revoked_at"];
const missingProvenanceColumn = (error) => {
  if (!error || !["PGRST204", "42703"].includes(error.storageCode)) return false;
  const message = String(error.storageMessage || "").toLowerCase();
  return PROVENANCE_COLUMNS.some((column) => message.includes(column));
};

const upsertLuarAccountCompat = async (account, provenance = {}) => {
  const cleanProvenance = Object.fromEntries(Object.entries(provenance).filter(([key]) => PROVENANCE_COLUMNS.includes(key)));
  if (!Object.keys(cleanProvenance).length) return upsertLuarAccount(account);
  try {
    return await upsertLuarAccount({ ...account, ...cleanProvenance });
  } catch (error) {
    // Permite publicar a API antes da migração sem interromper pagamentos.
    if (!missingProvenanceColumn(error)) throw error;
    return upsertLuarAccount(account);
  }
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

module.exports = { json, readBody, requireUser, requireSameOrigin, rateLimit, signPayload, verifyPayload, canonicalEmail, displayName, authProvider, getAuthUserById, sendDiscordEvent, adminRequest, authenticatedRpcRequest, getLuarAccount, upsertLuarAccount, upsertLuarAccountCompat };
