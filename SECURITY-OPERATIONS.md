# Operação segura do LUAR

Este documento reúne os controles que dependem das contas e da infraestrutura. Eles não são ativados por uma alteração no código e devem ser confirmados por uma pessoa autorizada.

## Ações imediatas

- Ativar MFA por autenticador ou chave física no registrador, DNS, Vercel, Supabase, GitHub, e-mail e contas administrativas.
- Revogar sessões antigas, tokens de implantação e chaves sem uso; manter segredos somente nas variáveis protegidas da Vercel.
- Ativar bloqueio de transferência do domínio e DNSSEC quando o registrador e o DNS confirmarem suporte.
- Confirmar SPF, DKIM e DMARC do domínio de e-mail.
- Revisar membros e permissões de Vercel, Supabase e GitHub pelo princípio do menor privilégio.

## Backups 3-2-1

- Manter três cópias, em dois meios, sendo uma externa, offline ou imutável.
- Incluir banco, metadados de autenticação, configurações de DNS/Vercel e código-fonte.
- A credencial usada pelo site não pode excluir backups.
- Executar e registrar um teste de restauração em ambiente isolado pelo menos uma vez por mês.

## Proteção de borda e monitoramento

- Ativar firewall/WAF e proteção contra bots no provedor, preservando os endpoints de OAuth.
- Aplicar limites mais baixos a login, recuperação, cadastro e rotas administrativas.
- Alertar sobre novo administrador, mudança de MFA, exportação em massa, falhas repetidas de login e picos de erros 401, 403 e 500.
- Manter logs fora da aplicação, com retenção, acesso restrito e proteção contra exclusão.

## Rotina de segurança

- Verificar semanalmente os resultados de Gitleaks, Opengrep, auditoria de dependências, RLS e Dependabot.
- Executar OWASP ZAP inicialmente em staging e somente com escopo e janela autorizados.
- Atualizar dependências após revisão e teste; remover serviços e chaves sem uso.
- Fazer pentest independente periódico e repetir os testes depois das correções.

## Incidente

1. Isolar o componente sem apagar evidências.
2. Preservar logs e snapshots.
3. Revogar sessões, chaves e credenciais afetadas.
4. Identificar alcance e causa raiz.
5. Corrigir e restaurar de uma cópia comprovadamente limpa.
6. Monitorar persistência e avaliar as comunicações exigidas pela LGPD.
