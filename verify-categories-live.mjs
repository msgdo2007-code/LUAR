import assert from "node:assert/strict";
import crypto from "node:crypto";

const base = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const anon = String(process.env.SUPABASE_ANON_KEY || "");
const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
assert.ok(base && anon && service, "Variáveis do Supabase não disponíveis.");

const elevated = {
  apikey: service,
  ...(!service.startsWith("sb_secret_") ? { authorization: `Bearer ${service}` } : {}),
  "Content-Type": "application/json",
};
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const password = `Luar-${crypto.randomBytes(24).toString("base64url")}!9`;
const users = [];

const request = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
};

const createUser = async (number) => {
  const email = `luar-category-test-${number}-${suffix}@example.invalid`;
  const { response, body } = await request(`${base}/auth/v1/admin/users`, {
    method: "POST", headers: elevated, body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert.equal(response.status, 200, "Não foi possível criar usuário temporário.");
  users.push(body.id);
  const login = await request(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  assert.equal(login.response.status, 200, "Login temporário falhou.");
  return { id: body.id, token: login.body.access_token };
};

const userHeaders = (token, prefer = "return=representation") => ({
  apikey: anon, authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: prefer,
});

try {
  const tableCheck = await request(`${base}/rest/v1/luar_categories?select=id&limit=1`, { headers: elevated });
  assert.equal(tableCheck.response.status, 200, "Tabela luar_categories não encontrada.");

  const anonymous = await request(`${base}/rest/v1/luar_categories?select=id&limit=1`, { headers: { apikey: anon } });
  assert.ok([401, 403].includes(anonymous.response.status), "Acesso anônimo não foi bloqueado.");

  const a = await createUser(1), b = await createUser(2);
  const created = await request(`${base}/rest/v1/luar_categories`, {
    method: "POST", headers: userHeaders(a.token),
    body: JSON.stringify({ user_id: a.id, domain: "knowledge", name: "  Estudos  ", normalized_name: "ignorado-pelo-trigger", color: "#32FF7E", icon: "✦", is_default: true }),
  });
  assert.equal(created.response.status, 201, "Usuário A não conseguiu criar a própria categoria.");
  const category = created.body?.[0];
  assert.ok(category?.id, "Categoria criada sem ID.");
  assert.equal(category.normalized_name, "estudos", "Trigger não normalizou o nome.");
  assert.equal(category.color, "#32ff7e", "Trigger não normalizou a cor.");

  const ownRead = await request(`${base}/rest/v1/luar_categories?id=eq.${category.id}&select=id`, { headers: userHeaders(a.token) });
  assert.equal(ownRead.response.status, 200);
  assert.equal(ownRead.body.length, 1, "Usuário A não leu a própria categoria.");

  const crossRead = await request(`${base}/rest/v1/luar_categories?id=eq.${category.id}&select=id`, { headers: userHeaders(b.token) });
  assert.equal(crossRead.response.status, 200);
  assert.equal(crossRead.body.length, 0, "RLS permitiu leitura cruzada.");

  const crossUpdate = await request(`${base}/rest/v1/luar_categories?id=eq.${category.id}`, { method: "PATCH", headers: userHeaders(b.token), body: JSON.stringify({ name: "Invadida" }) });
  assert.equal(crossUpdate.response.status, 200);
  assert.equal(crossUpdate.body.length, 0, "RLS permitiu edição cruzada.");

  const crossDelete = await request(`${base}/rest/v1/luar_categories?id=eq.${category.id}`, { method: "DELETE", headers: userHeaders(b.token), body: "{}" });
  assert.equal(crossDelete.response.status, 200);
  assert.equal(crossDelete.body.length, 0, "RLS permitiu exclusão cruzada.");

  const duplicate = await request(`${base}/rest/v1/luar_categories`, {
    method: "POST", headers: userHeaders(a.token),
    body: JSON.stringify({ user_id: a.id, domain: "knowledge", name: "ESTUDOS", normalized_name: "outro", color: "#32ff7e", icon: "◇" }),
  });
  assert.equal(duplicate.response.status, 409, "Nome equivalente criou categoria duplicada.");

  const financeSameName = await request(`${base}/rest/v1/luar_categories`, {
    method: "POST", headers: userHeaders(a.token),
    body: JSON.stringify({ user_id: a.id, domain: "finance", name: "Estudos", normalized_name: "estudos", color: "#57a9ff", icon: "◇" }),
  });
  assert.equal(financeSameName.response.status, 201, "Domínios independentes não aceitaram o mesmo nome.");

  console.log(JSON.stringify({ table: true, anonymousBlocked: true, ownCrud: true, crossUserBlocked: true, caseInsensitiveUnique: true, domainsSeparated: true }));
} finally {
  for (const id of users.reverse()) {
    await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", headers: elevated }).catch(() => null);
  }
}
