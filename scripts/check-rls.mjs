const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

if (!url || !serviceKey) {
  throw new Error('Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as protected GitHub Actions secrets.');
}

const response = await fetch(`${url}/rest/v1/rpc/luar_tables_without_rls`, {
  method: 'POST',
  headers: {
    apikey: serviceKey,
    ...(!serviceKey.startsWith('sb_secret_') ? { Authorization: `Bearer ${serviceKey}` } : {}),
    'Content-Type': 'application/json',
  },
  body: '{}',
});

if (!response.ok) {
  throw new Error(`RLS audit failed with HTTP ${response.status}. Apply the latest Supabase migration first.`);
}

const tables = await response.json();
if (!Array.isArray(tables)) throw new Error('RLS audit returned an invalid response.');
if (tables.length) {
  const names = tables.map((entry) => entry.table_name).filter(Boolean).join(', ');
  throw new Error(`RLS is disabled on public tables: ${names || 'unknown'}.`);
}

console.log('RLS is enabled on every public table.');
