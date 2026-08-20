# Checklist de deploy seguro

## Código e CI

- [ ] `main` protegida, PR obrigatório e CODEOWNERS exigido para API/admin/Supabase/workflows
- [ ] 2FA/passkey habilitado no GitHub; recovery codes fora do repositório
- [ ] Gitleaks, Opengrep, npm audit, SBOM e testes verdes
- [ ] Dependabot revisado; lockfile instalado com `npm ci`
- [ ] Secret scanning e push protection habilitados
- [ ] Actions de terceiros revisadas e permissões mínimas

## Secrets e hospedagem

- [ ] `.env*`, logs, dumps, backups e source maps privados não estão publicados
- [ ] Secrets configurados apenas como env server-side na Vercel
- [ ] `VERCEL_OIDC_TOKEN` local removido/rotacionado após uso
- [ ] Service role, PushinPay, HMAC e webhooks com escopo mínimo e rotação documentada
- [ ] Preview deployments não usam secrets/produção sem proteção
- [ ] CSP, HSTS, no-store de APIs, HTTPS e redirects verificados em produção
- [ ] WAF/rate limit de borda e alertas 401/403/429/5xx configurados

## Auth e banco

- [ ] Redirects OAuth exatos; sem wildcard desnecessário
- [ ] MFA/AAL2 obrigatório para administração
- [ ] Migrations aplicadas e `node scripts/check-rls.mjs` aprovado
- [ ] pgTAP de ownership/RLS executado com usuário A e B
- [ ] Tabelas backend-only sem grants anon/authenticated
- [ ] Backups criptografados, acesso limitado e restore testado

## Pagamentos/admin

- [ ] Preço oficial confirmado server-side
- [ ] Checkout, consulta ao provedor e idempotência testados
- [ ] Webhook falso/repetido não concede benefício
- [ ] Usuário comum recebe 403 em RPC/API admin
- [ ] Audit logs administrativos e alertas de pagamento revisados

## Privacidade/operação

- [ ] Analytics não recebe e-mail, notas, hábitos, valores financeiros ou tokens
- [ ] Exportação contém somente dados do usuário autenticado
- [ ] Exclusão de conta possui confirmação/reautenticação conforme risco
- [ ] Retenção, consentimentos, exportação/correção/exclusão revisados para LGPD
- [ ] Registrador/DNS com 2FA, auto-renew, registrar lock e contatos atualizados
- [ ] SPF, DKIM e DMARC configurados se houver e-mail transacional
- [ ] `security.txt` e canal de resposta a incidentes confirmados
- [ ] Produção testada com ZAP baseline e smoke tests de autenticação/pagamento
