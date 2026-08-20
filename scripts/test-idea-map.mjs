import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { sanitizeAccountState } = require("../api/_state-schema.js");
const client = readFileSync(new URL("../features/ideas/idea-map.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../features/ideas/idea-map.css", import.meta.url), "utf8");
const base = () => ({ profile: { ideaMap: { theme: "free", connections: [], positions: {} } }, transactions: [], tasks: [], habits: [], goals: [], subscriptions: [], wishlist: [], investments: [], events: [], moods: [], notes: [{ id: "idea-a", title: "A" }, { id: "idea-b", title: "B" }], focusSessions: [], portfolioHistory: [] });

test("conexões só usam ideias da mesma conta", () => { const state = base(); state.profile.ideaMap.connections = [{ sourceId: "idea-a", targetId: "outra-conta" }]; assert.throws(() => sanitizeAccountState(state, { lifetime: true }), /IDEA_CONNECTION_INVALID/); });
test("conexões duplicadas e autorrelações são bloqueadas", () => { const self = base(); self.profile.ideaMap.connections = [{ sourceId: "idea-a", targetId: "idea-a" }]; assert.throws(() => sanitizeAccountState(self, { lifetime: true }), /IDEA_CONNECTION_INVALID/); const duplicate = base(); duplicate.profile.ideaMap.connections = [{ sourceId: "idea-a", targetId: "idea-b" }, { sourceId: "idea-b", targetId: "idea-a" }]; assert.throws(() => sanitizeAccountState(duplicate, { lifetime: true }), /IDEA_CONNECTION_DUPLICATE/); });
test("posições são separadas e validadas por tema", () => { const state = base(); state.profile.ideaMap.positions = { free: { "idea-a": { x: 10, y: 20, locked: true } }, earth: { "idea-a": { x: 30, y: 40 } } }; const clean = sanitizeAccountState(state, { lifetime: true }); assert.equal(clean.profile.ideaMap.positions.free["idea-a"].locked, true); assert.equal(clean.profile.ideaMap.positions.earth["idea-a"].x, 30); });
test("quatro temas, categorias, Canvas e mobile estão presentes", () => { for (const theme of ["free", "blackhole", "earth", "brain"]) assert.match(client, new RegExp(theme)); assert.match(client, /connections\.push/); assert.match(client, /getContext\("2d"\)/); assert.match(client, /selectedCategory/); assert.match(css, /@media\(max-width:620px\)/); assert.match(css, /prefers-reduced-motion/); });
