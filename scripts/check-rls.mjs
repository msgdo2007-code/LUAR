const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const direct = Boolean(url && serviceKey);
const response = direct
  ? await fetch(`${url}/rest/v1/rpc/luar_security_posture`, {
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
  if (!result || result.ok !== true || !Array.isArray(result.violations)) throw new Error('Authorization audit returned an invalid or unsafe response.');
  if (result.violations.length) {
    const codes = result.violations.map((entry) => `${entry.code}:${entry.object || entry.count || 'unknown'}`).join(', ');
    throw new Error(`Supabase authorization violations: ${codes}`);
  }
} else if (result?.ok !== true || result?.rls !== true || result?.authorization !== true) {
  throw new Error('Public authorization health check did not confirm protection.');
}

console.log('RLS, grants, SECURITY DEFINER functions and storage exposure passed the authorization audit.');
