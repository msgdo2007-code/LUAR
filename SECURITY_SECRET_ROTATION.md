# Rotação de secrets

## Resultado da auditoria

Nenhum valor secreto está versionado no estado atual. O arquivo local `admin-console/.env.local` está coberto por `.gitignore` e não aparece em `git ls-files`.

## Ação preventiva

- `VERCEL_OIDC_TOKEN`: existe somente no arquivo local ignorado. Apague-o ao terminar a sessão de deploy e revogue/regenere no painel Vercel se ele tiver sido compartilhado, copiado para logs ou usado fora do dispositivo confiável.
- Revise o resultado do Gitleaks com histórico completo no GitHub Actions antes do deploy.

## Secrets server-side que exigem rotação em caso de exposição

`SUPABASE_SERVICE_ROLE_KEY`, `PUSHINPAY_TOKEN`, `LIFETIME_SIGNING_SECRET`, `PAYMENT_IDEMPOTENCY_SECRET`, `RATE_LIMIT_SECRET`, `DISCORD_FEEDBACK_WEBHOOK_URL`, `DISCORD_LOGIN_WEBHOOK_URL`, `DISCORD_PAYMENT_WEBHOOK_URL` e tokens administrativos da Vercel/GitHub.

Rotação deve ser feita no provedor e depois na Vercel, nunca por commit. Para chaves de assinatura, planeje uma janela de compatibilidade antes de invalidar licenças existentes.
