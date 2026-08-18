# Resposta a incidentes do LUAR

## Severidade

- **Crítico:** conta administrativa, banco, domínio, pagamentos ou segredo de produção comprometido.
- **Alto:** acesso indevido a dados de outro usuário, bypass do Vitalício ou upload executável.
- **Médio:** scanner, backup ou controle indisponível sem exploração confirmada.
- **Baixo:** tentativa bloqueada ou configuração sem impacto imediato.

Nunca envie tokens, cookies, senhas ou dados pessoais pelo Discord, issue pública ou captura de tela.

## Primeiros 30 minutos

1. Registrar horário de Brasília, origem do alerta, rota e identificador de correlação.
2. Preservar logs, deploys, eventos de auditoria e snapshots; não apagar o ambiente comprometido.
3. Bloquear somente a rota ou credencial afetada.
4. Revogar sessões, tokens e chaves afetadas no provedor correspondente.
5. Rotacionar a credencial e atualizar apenas os ambientes protegidos da Vercel.
6. Confirmar que o novo deploy corresponde a um commit conhecido.

## Segredo Supabase exposto

1. Revogar a chave no Supabase antes de alterar o Git.
2. Criar uma Secret key nova, com privilégio mínimo, e atualizar a Vercel.
3. Reimplantar as APIs e confirmar `/api/security-health`.
4. Procurar uso anormal da service role, exportações e alterações de RLS.
5. Executar Gitleaks no histórico completo e o workflow de segurança.

## Administrador comprometido

1. Remover ou suspender a role administrativa usando uma conta de emergência.
2. Revogar todas as sessões e rotacionar senha/passkey/MFA.
3. Revisar `admin_audit_logs`, alterações de Vitalício e exportações.
4. Reverter alterações somente depois de preservar evidências.

## Pagamento ou Vitalício fraudulento

1. Preservar o `transaction_id` e os logs; não registrar o token do provedor.
2. Consultar a transação diretamente no provedor.
3. Comparar valor, usuário, e-mail, `paid_at` e origem do plano.
4. Bloquear temporariamente a criação/confirmação se houver exploração ativa.
5. Não revogar compras legítimas durante a investigação.

## Recuperação

1. Corrigir a causa raiz e adicionar um teste que reproduza a falha.
2. Restaurar em ambiente isolado a partir de backup comprovadamente limpo.
3. Executar testes de autorização, build, Gitleaks, Opengrep e ZAP.
4. Liberar gradualmente e monitorar recorrência.
5. Avaliar comunicação a titulares e ANPD conforme impacto e LGPD.
6. Registrar linha do tempo, impacto, decisões, responsáveis e próxima revisão.

## Simulação trimestral

Alternar entre vazamento de chave, tomada de conta administrativa, falha de restauração e bypass de autorização. Registrar RTO, RPO, dificuldades e ações corretivas.
