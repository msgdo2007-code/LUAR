import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

let tracked = [];
try {
  tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
} catch {
  tracked = readdirSync('.').filter((name) => /\.(?:html|js)$/i.test(name) && existsSync(name));
  if (existsSync('pesquisa')) tracked.push(...readdirSync('pesquisa').filter((name) => /\.(?:html|js)$/i.test(name)).map((name) => `pesquisa/${name}`));
}
const unsafeFile = /(^|\/)(?:\.env(?:\.|$)|[^/]+\.(?:bak|old|dump|zip|tar|tar\.gz|tgz|map)|backup\.json|database\.sql)$/i;
const allowedSql = /^(?:supabase\/migrations\/|security\/|supabase-durable-accounts\.sql$)/i;
const badFiles = tracked.filter((file) => unsafeFile.test(file) && !(file.endsWith('.sql') && allowedSql.test(file)));

const publicFiles = tracked.filter((file) => /^(?:[^/]+\.(?:html|js)|pesquisa\/.*\.(?:html|js))$/i.test(file));
const forbidden = [
  ['Supabase endpoint', /https:\/\/[a-z0-9-]+\.supabase\.co/i],
  ['embedded Supabase key', /(?:anonKey|service_role|sb_secret_)\s*[:=]/i],
  ['Discord webhook', /discord(?:app)?\.com\/api\/webhooks\//i],
  ['JWT-like credential', /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/],
  ['session token field', /(?:access_token|refresh_token)\s*[:=]/i],
  ['legacy public configuration', /window\.LUAR_CONFIG|(?:["'\/])config\.js(?:[?"'])/i],
];
const findings = [];
for (const file of publicFiles) {
  const source = readFileSync(file, 'utf8');
  for (const [label, pattern] of forbidden) if (pattern.test(source)) findings.push(`${file}: ${label}`);
}

if (badFiles.length || findings.length) {
  if (badFiles.length) console.error(`Unsafe tracked files:\n${badFiles.join('\n')}`);
  if (findings.length) console.error(`Sensitive public-bundle patterns:\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`Public exposure guard passed (${publicFiles.length} browser files checked).`);
