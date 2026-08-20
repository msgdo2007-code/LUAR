# Threat model do LUAR

## Assets

Contas, sessões, PII, hábitos, tarefas, notas, mapa de ideias, dados financeiros, pagamentos, plano Vitalício, XP, backups, secrets e administração.

## Fronteiras e superfícies

Navegador não confiável → HTTPS/Vercel → funções autenticadas → Supabase/PushinPay/Discord. Superfícies adicionais: OAuth, admin Next.js, CI/CD, GitHub, DNS, dependências e dispositivo/local storage.

## Ameaças e controles

| Ameaça | Controle real |
|---|---|
| Account takeover/brute force | Supabase Auth, PKCE, cookie HttpOnly, resposta genérica e rate limit por IP/e-mail |
| Roubo/replay de sessão | Secure/SameSite, expiração curta de access token, refresh server-side e logout no provedor |
| IDOR/BOLA | identidade derivada do token; estado e RPC vinculados a uid/e-mail; RLS e testes entre usuários |
| XSS | escaping, CSP sem eval/atributos inline, nosniff e Opengrep |
| CSRF | SameSite + origem obrigatória em mutações |
| Mass assignment/elevação | esquemas fechados, allowlist de metadata, plano/admin calculados no backend |
| Abuso de XP/limites | ledger idempotente e sanitização/limites server-side; evolução futura deve mover eventos de XP integralmente ao backend |
| Fraude de pagamento | preço fixo, checkout assinado, ownership, consulta ao provedor e transição atômica/idempotente |
| Webhook forjado | payload não concede benefício sozinho; transação é buscada no provedor com secret server-side |
| SQL injection | PostgREST/RPC parametrizada, IDs codificados e nomes de RPC em allowlist |
| SSRF | URLs externas são constantes ou allowlists estritas (Discord HTTPS); timeouts obrigatórios |
| Vazamento de secrets | env server-side, Gitleaks no histórico, exposure guard, `.env*` ignorado |
| Supply-chain/CI | lockfile, npm ci/audit, Dependabot, Opengrep, SBOM e permissões read-only por padrão |
| DoS lógico | limites de corpo/coleções, paginação/limits internos, rate limit distribuído e timeouts |
| Admin abuse | role no banco, MFA/AAL2, Google recente, audit logs e CODEOWNERS |

## Assunções/riscos

Vercel, Supabase, PushinPay, GitHub e DNS devem permanecer com MFA e menor privilégio. Configuração externa divergente pode invalidar controles presentes no repositório.
