# Relatório de hardening de produção

## 1. Visão geral

O hardening reforçou a fronteira navegador/backend, fechou mass assignment de autenticação, adicionou timeout a integrações privilegiadas, reduziu dados em logs, documentou endpoints/threat model e ampliou testes. Isso reduz risco; não torna o sistema invulnerável.

## 2. Vulnerabilidades corrigidas

### HIGH — Mass assignment de metadata

- Arquivo: `api/_auth-handler.js`
- Risco: cliente gravar `role`, `isAdmin`, `plan`, `xp` ou flags arbitrárias em `user_metadata`.
- Correção: allowlist para nome/onboarding; licença somente com HMAC válido, uid/e-mail e plano esperados.
- Validação: `node scripts/test-auth-backend.mjs` envia campos maliciosos e confirma que são descartados.

### HIGH — Integrações sem timeout

- Arquivos: `api/_lib.js`, `api/create-lifetime-payment.js`, `api/check-lifetime-payment.js`, `api/payment-webhook.js`.
- Risco: exaustão de execução/conexões por dependência lenta.
- Correção: `externalFetch` com AbortSignal, padrão 8 s, Discord 5 s e pagamentos 10 s.
- Validação: syntax/tests e análise estática.

### MEDIUM — Logs internos excessivos

- Arquivo: `api/_lib.js`
- Risco: detalhes do PostgREST/Supabase chegarem à observabilidade.
- Correção: log apenas de status e código curto, sem corpo/mensagem/dados.

## 3. Autenticação

Supabase Auth é chamado apenas pelo backend. Access/refresh tokens ficam em cookies HttpOnly; o JSON público contém sessão sanitizada. OAuth usa PKCE e callback fixo. Login/recovery têm limites por IP e e-mail.

## 4. Autorização

APIs obtêm uid/e-mail da sessão validada. Estado, categorias, pagamentos e referrals verificam ownership. Admin é revalidado no backend e novamente por RPC/role/MFA no banco.

## 5. Banco

Migrations ativam RLS/FORCE RLS, removem grants de tabelas backend-only, fixam `search_path` em security-definer e possuem pgTAP de autorização entre perfis. A aplicação efetiva deve ser confirmada no projeto Supabase.

## 6. GitHub

Código inclui Gitleaks, Opengrep, npm audit, SBOM, ZAP, Dependabot e CODEOWNERS. Em 2026-08-20, a API autenticada confirmou repositório público, secret scanning e push protection ativos. Também foram ativados vulnerability alerts, Dependabot security updates e proteção da `main` contra force-push/exclusão, com histórico linear e resolução de conversas. PR obrigatório não foi imposto para não bloquear o mantenedor único; 2FA, environment approvals e revisão de apps continuam manuais.

## 7. Hospedagem

Vercel aplica CSP, HSTS, nosniff, frame protection, referrer/permissions policy e no-store/noindex em APIs. Confirmar env somente server-side, logs redigidos, domínio canônico e WAF/rate limit de borda.

## 8. Nomes de secrets

Consulte `.env.example`. Nenhum valor é documentado. Secrets críticos: service role, PushinPay, HMAC/idempotência/rate-limit, webhooks Discord e credenciais de deploy.

## 9. Pendências manuais

- Aplicar/verificar migrations e executar testes pgTAP no Supabase.
- Ativar MFA obrigatório no admin, GitHub, Vercel, Supabase, registrador e provedor de pagamento.
- Decidir se PR obrigatório é viável quando houver outro revisor; a proteção básica da `main` já está ativa.
- Revisar/limitar PATs, GitHub Apps e integrações OAuth. O token Vercel OIDC local não possui acesso administrativo à API (HTTP 403) e deve ser removido/rotacionado depois do uso.
- Confirmar backups/restauração, retenção, WAF e alertas de 401/403/429/5xx/pagamento.
- Revisão jurídica de LGPD, retenção e fornecedores.

## 10. Riscos residuais

O estado rico ainda é enviado pelo cliente e validado como snapshot; regras de XP granular são parcialmente calculadas no navegador. O esquema impede escaladas óbvias e o ledger evita repetição, mas a evolução recomendada é persistir eventos de domínio e calcular XP exclusivamente no backend. O fallback local do rate limit é menos forte que o RPC distribuído.
