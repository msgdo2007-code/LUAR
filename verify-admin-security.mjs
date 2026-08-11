import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('./config.js', import.meta.url), 'utf8');
const url = config.match(/url:\s*"([^"]+)"/)?.[1];
const anon = config.match(/anonKey:\s*"([^"]+)"/)?.[1];
if (!url || !anon) throw new Error('Configuração pública do Supabase ausente.');
const headers = { apikey: anon, authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' };

const roles = await fetch(`${url}/rest/v1/user_roles?select=user_id&limit=1`, { headers });
const rolesBody = await roles.text();
const metrics = await fetch(`${url}/rest/v1/rpc/admin_dashboard_metrics`, { method: 'POST', headers, body: '{}' });
const insert = await fetch(`${url}/rest/v1/admin_feedback`, { method: 'POST', headers, body: JSON.stringify({ user_id: crypto.randomUUID(), user_email: 'intruso@example.com', kind: 'suggestion', message: 'Tentativa anônima deve ser bloqueada.' }) });

const report = {
  anonymousRoleRead: { status: roles.status, exposesRows: rolesBody !== '[]' },
  anonymousAdminRpcBlocked: [401, 403].includes(metrics.status),
  anonymousFeedbackInsertBlocked: [401, 403].includes(insert.status),
};
console.log(JSON.stringify(report, null, 2));
if (report.anonymousRoleRead.exposesRows || !report.anonymousAdminRpcBlocked || !report.anonymousFeedbackInsertBlocked) process.exitCode = 1;
