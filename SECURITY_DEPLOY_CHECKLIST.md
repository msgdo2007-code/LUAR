# Checklist de deploy seguro

## Código e CI

- [x] `main` protegida contra force-push/exclusão, com histórico linear e resolução de conversas (confirmado via API em 2026-08-20)
- [ ] PR obrigatório e CODEOWNERS exigido para API/admin/Supabase/workflows
- [ ] 2FA/passkey habilitado no GitHub; recovery codes fora do repositório
- [x] Gitleaks, Opengrep, npm audit, SBOM e testes configurados; testes locais verdes
- [x] Dependabot security updates ativado; lockfile instalado com `npm ci`
- [x] Secret scanning e push protection habilitados (confirmado via API em 2026-08-20)
- [ ] Actions de terceiros revisadas e permissões mínimas

## Secrets e hospedagem

- [ ] `.env*`, logs, dumps, backups e source maps privados não estão publicados
- [ ] Secrets configurados apenas como env server-side na Vercel
- [ ] `VERCEL_OIDC_TOKEN` local removido/rotacionado após uso
- [ ] Service role, PushinPay, HMAC e webhooks com escopo mínimo e rotação documentada
- [ ] Preview deployments não usam secrets/produção sem proteção
- [x] CSP, HSTS, no-store de APIs, HTTPS e bloqueio de origem verificados em produção
- [ ] WAF/rate limit de borda e alertas 401/403/429/5xx configurados

## Auth e banco

- [ ] Redirects OAuth exatos; sem wildcard desnecessário
- [ ] MFA/AAL2 obrigatório para administração
- [x] Postura das migrations e `node scripts/check-rls.mjs` aprovados em produção
- [ ] pgTAP de ownership/RLS executado com usuário A e B
- [ ] Tabelas backend-only sem grants anon/authenticated
- [ ] Backups criptografados, acesso limitado e restore testado

## Pagamentos/admin

- [x] Preço oficial confirmado server-side
- [x] Checkout, consulta ao provedor e idempotência testados
- [x] Webhook falso/repetido não concede benefício nos testes automatizados
- [ ] Usuário comum recebe 403 em RPC/API admin
- [ ] Audit logs administrativos e alertas de pagamento revisados

## Privacidade/operação

- [ ] Analytics não recebe e-mail, notas, hábitos, valores financeiros ou tokens
- [ ] Exportação contém somente dados do usuário autenticado
- [ ] Exclusão de conta possui confirmação/reautenticação conforme risco
- [ ] Retenção, consentimentos, exportação/correção/exclusão revisados para LGPD
- [ ] Registrador/DNS com 2FA, auto-renew, registrar lock e contatos atualizados
- [ ] SPF, DKIM e DMARC configurados se houver e-mail transacional
- [x] `security.txt` e canal de resposta a incidentes confirmados em produção
- [ ] Produção testada com ZAP baseline e smoke tests de autenticação/pagamento
