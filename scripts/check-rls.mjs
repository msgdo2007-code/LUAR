const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const direct = Boolean(url && serviceKey);
const response = direct
  ? await fetch(`${url}/rest/v1/rpc/luar_tables_without_rls`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        ...(!serviceKey.startsWith('sb_secret_') ? { Authorization: `Bearer ${serviceKey}` } : {}),
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
  : await fetch(String(process.env.SECURITY_HEALTH_URL || 'https://luarhub.site/api/security-health'));

if (!response.ok) {
  throw new Error(`RLS audit failed with HTTP ${response.status}. Apply the latest Supabase migration first.`);
}

const result = await response.json();
if (direct) {
  if (!Array.isArray(result)) throw new Error('RLS audit returned an invalid response.');
  if (result.length) {
    const names = result.map((entry) => entry.table_name).filter(Boolean).join(', ');
    throw new Error(`RLS is disabled on public tables: ${names || 'unknown'}.`);
  }
} else if (result?.ok !== true || result?.rls !== true) {
  throw new Error('Public RLS health check did not confirm protection.');
}

console.log('RLS is enabled on every public table.');
