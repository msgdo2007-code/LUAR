# Segurança do LUAR

## Segredos

- Nunca coloque webhooks, `service_role`, tokens de pagamento ou senhas em HTML, JavaScript público, commits, mensagens ou screenshots.
- Configure segredos somente nos ambientes protegidos da Vercel.
- Os nomes usados pelo backend são `DISCORD_LOGIN_WEBHOOK_URL`, `DISCORD_PAYMENT_WEBHOOK_URL`, `DISCORD_FEEDBACK_WEBHOOK_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUSHINPAY_TOKEN` e `LIFETIME_SIGNING_SECRET`. Em `SUPABASE_SERVICE_ROLE_KEY`, prefira uma Secret key atual no formato `sb_secret_...`; o nome da variável foi mantido por compatibilidade.
- Qualquer webhook enviado em chat deve ser excluído no Discord e recriado antes do uso.

## Banco

Execute, em ordem, `supabase/migrations/20260817120000_security_hardening.sql` e `supabase/migrations/20260818124000_authorization_posture.sql` no SQL Editor do projeto Supabase. As migrações:

- reafirma RLS nas tabelas do LUAR;
- revoga acesso padrão de `anon` e `authenticated` a tabelas futuras;
- cria o rate limit compartilhado das APIs;
- criam a auditoria que falha quando uma tabela está sem RLS, uma tabela interna possui GRANT indevido, uma função privilegiada não fixa `search_path` ou um bucket está público;
- neutralizam qualquer identidade fornecida pelo cliente na função que verifica administradores;
- aplicam `FORCE ROW LEVEL SECURITY` às tabelas internas.

O workflow `.github/workflows/security.yml` verifica RLS em cada push para `main` usando `/api/security-health`. A rota informa apenas sucesso ou falha e mantém a Secret key exclusivamente na Vercel.

## Testes automáticos

- Gitleaks: procura segredos no histórico Git.
- Opengrep: bloqueia padrões perigosos, webhooks literais e execução dinâmica de JavaScript.
- OWASP ZAP: examina semanalmente o site publicado.
- `npm audit`: verifica as dependências de produção do painel administrativo.
- `scripts/test-state-schema.mjs`: testa limites do plano, URLs inseguras, assinatura real de imagens e prototype pollution.
- `scripts/check-public-exposure.mjs`: impede credenciais e arquivos sensíveis no conteúdo público.
- `supabase/tests/database/authorization_rls.test.sql`: contém testes negativos de privilégios e escalada de função.
- O SBOM CycloneDX é armazenado como artefato de cada execução do CI.

## Administração e pagamentos

- Ações críticas do painel exigem MFA AAL2 recente, além da role verificada no servidor.
- Server Actions aceitam somente origens explícitas e corpos de até 64 KB.
- A confirmação de pagamento consulta o provedor e a transição para pago é atômica.
- A chave de idempotência impede múltiplas cobranças equivalentes em uma janela curta.
- Nunca aceite `plan`, `role`, `user_id` ou `isLifetime` enviados pelo navegador como autorização.

## Resposta a incidente

1. Revogue primeiro a credencial exposta no provedor.
2. Gere uma credencial nova.
3. Atualize somente a variável protegida na Vercel.
4. Revise logs de pagamento, autenticação e auditoria.
5. Execute novamente o workflow de segurança.

O procedimento completo está em `INCIDENT-RESPONSE.md`.

Não existe aplicação “impossível de hackear”. Estas proteções reduzem a superfície de ataque, mas atualizações, logs, backups e revisões periódicas continuam obrigatórios.
