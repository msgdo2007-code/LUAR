import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { dashboardView } = require("../server/dashboard-view.js");
const endpoint = readFileSync(new URL("../api/account-state.js", import.meta.url), "utf8");
const client = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("servidor calcula totais financeiros sem confiar no navegador", () => {
  const view = dashboardView({
    transactions: [{ type: "income", amount: 1000 }, { type: "expense", amount: 250 }, { type: "purchase", amount: 50 }],
    goals: [{ current: 200 }], tasks: [], habits: [],
  });
  assert.deepEqual(view.totals, { income: 1000, expense: 300, goalSaved: 200, balance: 700, wealth: 900 });
});

test("view-model não duplica os registros privados completos", () => {
  const view = dashboardView({ tasks: [{ id: "t1", name: "segredo", completed: false }], habits: [], transactions: [], goals: [] });
  assert.equal(JSON.stringify(view).includes("segredo"), false);
  assert.equal(view.activity.total, 1);
});

test("endpoint entrega view-model autenticado e cliente apenas o apresenta", () => {
  assert.match(endpoint, /viewModel: \{ dashboard: dashboardView\(/);
  assert.match(endpoint, /requireUser\(req\)/);
  assert.match(client, /cloudAccount\?\.viewModel\?\.dashboard/);
});
