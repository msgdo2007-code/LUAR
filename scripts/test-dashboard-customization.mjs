import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { sanitizeDashboardCustomization, sanitizeAccountState } = require("../api/_state-schema.js");
const client = readFileSync(new URL("../features/personalization/dashboard-customization.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../features/personalization/dashboard-customization.css", import.meta.url), "utf8");
const endpoint = readFileSync(new URL("../api/account-state.js", import.meta.url), "utf8");
const vercel = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");
const collections = { transactions: [], tasks: [], habits: [], goals: [], subscriptions: [], wishlist: [], investments: [], events: [], moods: [], notes: [], focusSessions: [], portfolioHistory: [] };

test("schema aceita somente opções visuais controladas", () => {
  const clean = sanitizeDashboardCustomization({ globalTheme: { preset: "custom", accent: "red", text: "#ffffff" }, background: { type: "image", image: "javascript:alert(1)" }, layouts: [{ id: "Meu Layout!", name: "Principal", blocks: { wealth: { size: "gigante", style: { accent: "url(x)", opacity: 500 } } } }] });
  assert.equal(clean.globalTheme.accent, "#25f47d");
  assert.equal(clean.background.image, "");
  assert.equal(clean.layouts[0].id, "meu-layout-");
  assert.equal(clean.layouts[0].blocks.wealth.size, "medium");
  assert.equal(clean.layouts[0].blocks.wealth.style.opacity, 100);
});

test("histórico e perfis possuem limites", () => {
  const layouts = Array.from({ length: 9 }, (_, index) => ({ id: `layout-${index}`, name: `Layout ${index}`, blocks: {} }));
  const history = Array.from({ length: 9 }, (_, index) => ({ savedAt: new Date().toISOString(), layoutId: "layout-0", layout: layouts[0] }));
  const clean = sanitizeDashboardCustomization({ layouts, history });
  assert.equal(clean.layouts.length, 5);
  assert.equal(clean.history.length, 5);
});

test("conta gratuita não substitui personalização Vitalícia existente", () => {
  const previous = { profile: { dashboardCustomization: sanitizeDashboardCustomization({ layouts: [{ id: "cloud", name: "Nuvem", blocks: {} }] }) }, ...structuredClone(collections) };
  const incoming = { profile: { dashboardCustomization: { layouts: [{ id: "forged", name: "DevTools", blocks: {} }] } }, ...structuredClone(collections) };
  const clean = sanitizeAccountState(incoming, { lifetime: false, previousState: previous });
  assert.equal(clean.profile.dashboardCustomization.activeLayoutId, "cloud");
});

test("editor possui preview real, drag, undo, presets e salvamento explícito", () => {
  for (const token of ["customizationPreview", "ondragstart", "undoStack", "PRESETS", "pushCloudState({createBackup:true})", "luar-layout"]) assert.match(client, new RegExp(token.replace(/[{}()]/g, "\\$&")));
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /dashboard-editing/);
});

test("endpoint deriva usuário da sessão e exige entitlement", () => {
  assert.match(endpoint, /requireUser\(req\)/);
  assert.match(endpoint, /account\?\.plan === "lifetime"/);
  assert.doesNotMatch(endpoint, /body\.userId|req\.body\.userId/);
  assert.match(vercel, /\/api\/customization/);
  assert.match(vercel, /account-state\?resource=customization/);
});
