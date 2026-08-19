const { adminRequest, json, readBody } = require("../api/_lib");

const CATEGORY_DOMAINS = new Set(["knowledge", "finance"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLOR = /^#[0-9a-f]{6}$/i;

const categoryError = (code) => {
  const error = new Error(code);
  error.categoryCode = code;
  return error;
};

const cleanDomain = (value) => {
  const domain = String(value || "").trim().toLowerCase();
  if (!CATEGORY_DOMAINS.has(domain)) throw categoryError("CATEGORY_DOMAIN_INVALID");
  return domain;
};

const cleanName = (value) => {
  const name = String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f<>]/.test(name)) throw categoryError("CATEGORY_NAME_INVALID");
  return name;
};

const cleanColor = (value) => {
  const color = String(value || "#32ff7e").trim().toLowerCase();
  if (!COLOR.test(color)) throw categoryError("CATEGORY_COLOR_INVALID");
  return color;
};

const cleanIcon = (value) => {
  const icon = String(value || "◇").normalize("NFKC").trim();
  if (!icon || [...icon].length > 8 || /[\u0000-\u001f\u007f<>"'`]/.test(icon)) throw categoryError("CATEGORY_ICON_INVALID");
  return icon;
};

const cleanId = (value, required = false) => {
  const id = String(value || "").trim();
  if (!id && !required) return null;
  if (!UUID.test(id)) throw categoryError("CATEGORY_ID_INVALID");
  return id;
};

const listCategories = async (user, domain) => {
  const rows = await adminRequest(`luar_categories?user_id=eq.${encodeURIComponent(user.id)}&domain=eq.${encodeURIComponent(domain)}&deleted_at=is.null&select=id,domain,name,color,icon,is_default,created_at,updated_at&order=is_default.desc,name.asc`);
  return Array.isArray(rows) ? rows : [];
};

const saveCategory = async (user, body) => {
  let rows;
  try {
    rows = await adminRequest("rpc/save_luar_category", {
      method: "POST",
      body: JSON.stringify({
        p_actor_user_id: user.id,
        p_category_id: cleanId(body.id),
        p_domain: cleanDomain(body.domain),
        p_name: cleanName(body.name),
        p_color: cleanColor(body.color),
        p_icon: cleanIcon(body.icon),
        p_is_default: body.isDefault === true,
      }),
    });
  } catch (error) {
    if (error.storageCode === "23505") throw categoryError("CATEGORY_DUPLICATE");
    if (String(error.storageMessage || "").includes("CATEGORY_NOT_FOUND")) throw categoryError("CATEGORY_NOT_FOUND");
    throw error;
  }
  const category = Array.isArray(rows) ? rows[0] : null;
  if (!category) throw categoryError("CATEGORY_NOT_FOUND");
  return category;
};

const removeCategory = async (user, body) => {
  const rows = await adminRequest("rpc/delete_luar_category", {
    method: "POST",
    body: JSON.stringify({ p_actor_user_id: user.id, p_category_id: cleanId(body.id, true) }),
  });
  const result = Array.isArray(rows) ? rows[0] : rows;
  if (result !== true) throw categoryError("CATEGORY_NOT_FOUND");
};

const handleCategories = async (req, res, user, requestUrl) => {
  if (req.method === "GET") {
    const domain = cleanDomain(requestUrl.searchParams.get("domain"));
    return json(res, 200, { categories: await listCategories(user, domain) });
  }
  if (req.method === "POST" || req.method === "PUT") {
    const body = await readBody(req, 4_096);
    const category = await saveCategory(user, body);
    return json(res, req.method === "POST" ? 201 : 200, { category });
  }
  if (req.method === "DELETE") {
    const body = await readBody(req, 1_024);
    await removeCategory(user, body);
    return json(res, 200, { removed: true });
  }
  return json(res, 405, { error: "Método não permitido." });
};

module.exports = { CATEGORY_DOMAINS, cleanDomain, cleanName, cleanColor, cleanIcon, cleanId, handleCategories };
