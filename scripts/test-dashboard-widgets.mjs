import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { sanitizeAccountState, FREE_WIDGET_LIMIT, LIFETIME_WIDGET_LIMIT } = require("../api/_state-schema.js");
const collections = { transactions: [], tasks: [], habits: [], goals: [], subscriptions: [], wishlist: [], investments: [], events: [], moods: [], notes: [], focusSessions: [], portfolioHistory: [] };
const base = () => ({ profile: { dashboardWidgets: [] }, ...structuredClone(collections) });
const client = readFileSync(new URL("../features/widgets/widgets.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../features/widgets/widgets.css", import.meta.url), "utf8");

test("limites de widgets possuem defaults seguros", () => {
  assert.equal(FREE_WIDGET_LIMIT, 1);
  assert.ok(LIFETIME_WIDGET_LIMIT >= 1 && LIFETIME_WIDGET_LIMIT <= 12);
});

test("usuário gratuito não adiciona segundo widget", () => {
  const state = base();
  state.tasks = [{ id: "task-1", name: "Uma" }, { id: "task-2", name: "Duas" }];
  state.profile.dashboardWidgets = [{ id: "w1", type: "task", recordId: "task-1" }, { id: "w2", type: "task", recordId: "task-2" }];
  assert.throws(() => sanitizeAccountState(state, { lifetime: false }), /PLAN_LIMIT/);
});

test("widget só aponta para tarefa ou hábito da própria conta", () => {
  const state = base();
  state.profile.dashboardWidgets = [{ id: "w1", type: "habit", recordId: "habit-de-outra-conta" }];
  assert.throws(() => sanitizeAccountState(state, { lifetime: true }), /WIDGET_RECORD_INVALID/);
});

test("não permite fixar o mesmo registro duas vezes", () => {
  const state = base();
  state.habits = [{ id: "habit-1", name: "Água" }];
  state.profile.dashboardWidgets = [{ id: "w1", type: "habit", recordId: "habit-1" }, { id: "w2", type: "habit", recordId: "habit-1" }];
  assert.throws(() => sanitizeAccountState(state, { lifetime: true }), /WIDGET_DUPLICATE/);
});

test("widget órfão previamente válido é preservado após exclusão", () => {
  const previous = base();
  previous.tasks = [{ id: "task-1", name: "Removida" }];
  previous.profile.dashboardWidgets = [{ id: "w1", type: "task", recordId: "task-1" }];
  const next = base();
  next.profile.dashboardWidgets = structuredClone(previous.profile.dashboardWidgets);
  const clean = sanitizeAccountState(next, { lifetime: false, previousState: previous });
  assert.equal(clean.profile.dashboardWidgets[0].recordId, "task-1");
});

test("resumo diário e personalização segura são sincronizados", () => {
  const state = base();
  state.habits = [{ id: "habit-1", name: "Água" }];
  state.profile.dashboardWidgets = [{ id: "daily", type: "habit", recordId: "all", size: "large", mascotId: "lumi", background: "violet", phrase: "Ainda dá tempo.", showStreak: true, showXP: false, showProgress: true, showHabitList: true }];
  const clean = sanitizeAccountState(state, { lifetime: true });
  assert.equal(clean.profile.dashboardWidgets[0].recordId, "all");
  assert.equal(clean.profile.dashboardWidgets[0].size, "large");
  assert.equal(clean.profile.dashboardWidgets[0].background, "violet");
  assert.equal(clean.profile.dashboardWidgets[0].showXP, false);
});

test("interface oferece tarefas, hábitos, ordenação e mobile", () => {
  assert.match(client, /data-widget-tab="task"/);
  assert.match(client, /data-widget-tab="habit"/);
  assert.match(client, /data-widget-move/);
  assert.match(client, /showPremiumGate/);
  assert.match(styles, /@media\(max-width:620px\)/);
  assert.match(styles, /grid-template-columns:1fr/);
  assert.ok(existsSync(new URL("../widget-luar-companion-v1.webp", import.meta.url)));
});
