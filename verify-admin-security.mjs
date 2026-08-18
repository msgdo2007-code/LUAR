const origin = 'https://luarhub.site';
const health = await fetch(`${origin}/api/security-health`);
const healthBody = await health.json().catch(() => ({}));
const anonymousAccount = await fetch(`${origin}/api/account-state`);
const crossOriginAdmin = await fetch(`${origin}/api/admin-lifetime`, {
  method: 'POST',
  headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'grant', email: 'intruso@example.com' }),
});

const report = {
  rlsEnabled: health.ok && healthBody.ok === true && healthBody.rls === true,
  anonymousAccountBlocked: anonymousAccount.status === 401,
  crossOriginAdminBlocked: crossOriginAdmin.status === 403,
};
console.log(JSON.stringify(report, null, 2));
if (Object.values(report).some(value => value !== true)) process.exitCode = 1;
