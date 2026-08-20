# Auditoria de segurança do LUAR

Data: 20 de agosto de 2026. Escopo: frontend estático, funções Node.js/Vercel, painel Next.js, Supabase, pagamentos, CI e configuração de produção.

## Arquitetura encontrada

- Frontend: HTML/CSS/JavaScript sem framework, servido pela Vercel; dados locais em LocalStorage/IndexedDB são cache não confiável.
- Backend: funções CommonJS em `api/`, Node.js serverless, autoridade sobre autenticação, plano, pagamentos, limites e sincronização.
- Admin: Next.js 16/React 19 em `admin-console`, Supabase SSR e autorização server-side/RPC.
- Auth/banco: Supabase Auth com PKCE e cookies `HttpOnly`, `Secure` em produção e `SameSite=Lax`; PostgreSQL com RLS/FORCE RLS e RPCs.
- Pagamentos: PushinPay; preço fixo de R$ 39,90 no servidor, consulta server-to-server e transição idempotente.
- CI: Gitleaks, Opengrep, npm audit, SBOM, teste RLS e OWASP ZAP agendado.
- Hospedagem: Vercel; CSP, HSTS, nosniff, referrer policy, permissions policy e no-store para APIs.

## Achados

| Severidade | Achado | Arquivo | Correção/status |
|---|---|---|---|
| HIGH | Mass assignment permitia gravar campos arbitrários em `user_metadata` | `api/_auth-handler.js` | Corrigido com allowlist e validação criptográfica da licença |
| HIGH | Requests externos privilegiados não possuíam timeout central | `api/_lib.js`, pagamentos | Corrigido com limite de 5–10 s e teto de 30 s |
| MEDIUM | Log do Supabase podia incluir mensagem/detalhe interno | `api/_lib.js` | Corrigido; registra somente status e código curto |
| MEDIUM | Documentação operacional e inventário estavam incompletos | raiz | Corrigido com auditoria, endpoints, threat model, relatório e checklist |
| LOW | `security.txt` não existia | `.well-known/security.txt` | Corrigido usando o formulário de contato existente |
| INFO | `.env.local` contém `VERCEL_OIDC_TOKEN` | arquivo local ignorado | Não versionado; manter fora do Git e apagar/rotacionar quando não for necessário |

## Controles já existentes e confirmados

- Ownership deriva do usuário autenticado; APIs não aceitam `userId` como autoridade.
- Estado é validado com esquema fechado, limites de payload e limites de plano server-side.
- Tabelas privadas possuem RLS, FORCE RLS e grants públicos revogados nas migrations.
- Admin requer usuário autorizado, sessão Google recente e RPC com role/MFA no banco.
- Checkout ignora preço do cliente; webhook é confirmado por consulta autenticada ao provedor.
- CSP não usa `unsafe-eval`; `script-src-attr` está bloqueado; APIs privadas não usam CORS `*`.

## Riscos residuais

- Aplicação das migrations, configurações Vercel/Supabase, MFA, WAF e proteção de branch exigem confirmação fora do código.
- A visibilidade atual do repositório e os rulesets/proteções da branch não puderam ser consultados nesta estação porque a GitHub CLI/API autenticada não está disponível; esses itens permanecem explicitamente pendentes no checklist.
- Cookies reduzem exposição de tokens, mas XSS continua sendo risco relevante; CSP e escaping devem permanecer testados.
- O rate limit tem fallback em memória quando o RPC distribuído falha; em indisponibilidade prolongada, múltiplas instâncias reduzem sua eficácia.
- Dados financeiros ficam criptografados pelo provedor em repouso conforme sua configuração; não há criptografia de campo adicional no app.
