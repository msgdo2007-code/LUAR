# Segurança do LUAR

## Segredos

- Nunca coloque webhooks, `service_role`, tokens de pagamento ou senhas em HTML, JavaScript público, commits, mensagens ou screenshots.
- Configure segredos somente nos ambientes protegidos da Vercel.
- Os nomes usados pelo backend são `DISCORD_LOGIN_WEBHOOK_URL`, `DISCORD_PAYMENT_WEBHOOK_URL`, `DISCORD_FEEDBACK_WEBHOOK_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUSHINPAY_TOKEN` e `LIFETIME_SIGNING_SECRET`.
- Qualquer webhook enviado em chat deve ser excluído no Discord e recriado antes do uso.

## Banco

Execute `supabase/migrations/20260817120000_security_hardening.sql` no SQL Editor do projeto Supabase. A migração:

- reafirma RLS nas tabelas do LUAR;
- revoga acesso padrão de `anon` e `authenticated` a tabelas futuras;
- cria o rate limit compartilhado das APIs;
- cria a auditoria que falha quando uma tabela pública está sem RLS.

Depois, configure no repositório GitHub os secrets `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. O workflow `.github/workflows/security.yml` verificará RLS em cada push para `main`.

## Testes automáticos

- Gitleaks: procura segredos no histórico Git.
- Opengrep: bloqueia padrões perigosos, webhooks literais e execução dinâmica de JavaScript.
- OWASP ZAP: examina semanalmente o site publicado.
- `npm audit`: verifica as dependências de produção do painel administrativo.
- `scripts/test-state-schema.mjs`: testa limites do plano, URLs inseguras e prototype pollution.

## Resposta a incidente

1. Revogue primeiro a credencial exposta no provedor.
2. Gere uma credencial nova.
3. Atualize somente a variável protegida na Vercel.
4. Revise logs de pagamento, autenticação e auditoria.
5. Execute novamente o workflow de segurança.

Não existe aplicação “impossível de hackear”. Estas proteções reduzem a superfície de ataque, mas atualizações, logs, backups e revisões periódicas continuam obrigatórios.
