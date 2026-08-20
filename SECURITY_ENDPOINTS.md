# Inventário de endpoints

Todos os outputs JSON privados usam `Cache-Control: no-store`. `Same origin` significa allowlist exata, sem reflexão arbitrária.

| Método/rota | Auth | Papel/ownership | Rate limit | Validação/saída |
|---|---|---|---|---|
| POST `/api/create-account?action=signup|login|recovery` | Pública | n/a | IP + e-mail | e-mail, senha e nome limitados; resposta genérica |
| GET `/api/create-account?action=oauth|callback` | Pública/PKCE | state por cookie HttpOnly | IP | provedores Google/Discord; redirect fixo |
| POST `/api/create-account?action=session|refresh|signout|update` | Cookie | usuário da sessão | IP/ação | metadata em allowlist; tokens nunca retornam no JSON |
| GET `/api/account-state` | Obrigatória | e-mail/id da sessão | IP + usuário | retorna somente conta autenticada |
| PUT/POST `/api/account-state` | Obrigatória + same-origin | conta autenticada | IP + usuário | esquema fechado, revisão/idempotência, limite de plano |
| GET/POST `/api/account-state?resource=categories` | Obrigatória | categoria pertence ao usuário | IP + usuário | domínio/IDs/valores validados |
| POST `/api/create-lifetime-payment` | Obrigatória + same-origin | usuário autenticado | 6/10 min + usuário | preço/produto definidos no servidor |
| POST `/api/check-lifetime-payment` | Obrigatória + same-origin | token assinado + user/payment ownership | 30/10 min | ID, valor e provedor verificados |
| POST `/api/payment-webhook` | Provedor indireto | transação existente | 120/10 min | corpo limitado; status confirmado server-to-server; idempotente |
| POST `/api/verify-lifetime` | Obrigatória + same-origin | licença assinada vinculada a uid/e-mail | 60/10 min | token limitado e assinatura verificada |
| POST `/api/admin-lifetime` | Obrigatória + same-origin | owner + Google recente + role/MFA na RPC | 12/10 min | ação/provider/e-mail em allowlist; auditado no banco |
| GET/POST `/api/referrals` | Obrigatória (exceto click público) | usuário autenticado | por IP/usuário | máquina de estados e ownership no backend |
| POST `/api/activity-event` | Obrigatória + same-origin | usuário autenticado | por IP/usuário | tipo, rating e mensagem limitados |
| GET `/api/blog`, `/api/seo-page`, `/api/landing-config` | Pública | somente conteúdo público | CDN/plataforma | slugs/modes em allowlist; sem dados privados |
| GET `/api/security-health` | Server-side health | service role no backend | endpoint guard | retorna somente postura agregada |

Recursos privados (tarefas, hábitos, notas, finanças, metas, widgets e mapa) são persistidos dentro do estado da conta autenticada; não há rota por ID de outro usuário.
