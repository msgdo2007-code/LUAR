import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const validators = require("./server/categories.js");

assert.equal(validators.cleanDomain(" KNOWLEDGE "), "knowledge");
assert.equal(validators.cleanDomain("finance"), "finance");
assert.throws(() => validators.cleanDomain("profile"), /CATEGORY_DOMAIN_INVALID/);
assert.equal(validators.cleanName("  Projetos   pessoais  "), "Projetos pessoais");
assert.equal(validators.cleanName("Ｅｓｔｕｄｏｓ"), "Estudos");
assert.throws(() => validators.cleanName("<script>"), /CATEGORY_NAME_INVALID/);
assert.throws(() => validators.cleanName(""), /CATEGORY_NAME_INVALID/);
assert.equal(validators.cleanColor("#32FF7E"), "#32ff7e");
assert.throws(() => validators.cleanColor("red"), /CATEGORY_COLOR_INVALID/);
assert.equal(validators.cleanIcon(" ✦ "), "✦");
assert.throws(() => validators.cleanIcon("<svg>"), /CATEGORY_ICON_INVALID/);
assert.equal(validators.cleanId(""), null);
assert.equal(validators.cleanId("89b5122a-82da-4f47-8ea7-684e21fbb7de"), "89b5122a-82da-4f47-8ea7-684e21fbb7de");
assert.throws(() => validators.cleanId("1"), /CATEGORY_ID_INVALID/);

const migration = await readFile("supabase/migrations/20260819120000_reusable_categories.sql", "utf8");
for (const expected of [
  "alter table public.luar_categories enable row level security",
  "alter table public.luar_categories force row level security",
  "luar_categories_select_own",
  "luar_categories_insert_own",
  "luar_categories_update_own",
  "luar_categories_delete_own",
  "(select auth.uid()) = user_id",
  "luar_categories_active_name_uidx",
  "luar_categories_one_default_uidx",
  "security definer set search_path = public, pg_temp",
  "grant execute on function public.save_luar_category",
]) assert.ok(migration.includes(expected), `Migração sem proteção obrigatória: ${expected}`);
assert.ok(!migration.includes("grant all on public.luar_categories to anon"));

const route = await readFile("api/account-state.js", "utf8");
assert.match(route, /resource"\) === "categories"/);
assert.match(route, /handleCategories\(req, res, user, requestUrl\)/);
assert.match(route, /CATEGORY_DUPLICATE/);
assert.match(route, /luar_categories\?select=id&limit=1/);
assert.match(route, /validateStateCategoryOwnership\(user, incoming\)/);

const stateSchema = await readFile("api/_state-schema.js", "utf8");
assert.match(stateSchema, /clean\.categoryId/);
assert.match(stateSchema, /\[1-5\]\[0-9a-f\]\{3\}/);

const ui = await readFile("features/categories/categories.js", "utf8");
assert.ok(ui.includes("window.LuarCategories"));
assert.ok(ui.includes("createPicker"));
assert.ok(ui.includes("enhanceNoteForm"));
assert.ok(ui.includes("data-note-category-filter"));
assert.ok(ui.includes("luar:categories-changed"));
assert.ok(ui.includes("textContent = category.name"), "Nome do usuário deve ser renderizado como texto, não HTML.");
assert.ok(!/innerHTML\s*=.*category\.(?:name|icon)/.test(ui), "Conteúdo da categoria não pode entrar em innerHTML.");

const html = await readFile("index.html", "utf8");
assert.ok(html.includes("features/categories/categories.css"));
assert.ok(html.includes("features/categories/categories.js"));
assert.ok(html.includes("features/categories/notes-categories.css"));

console.log("Categorias: validação, RLS, API, CSP local e interface reutilizável verificados.");
