# Fase 3 — Estratégia de dados e conflitos

## Decisão atual

O LUAR continuará temporariamente usando um documento JSON versionado por conta. A revisão é atribuída exclusivamente pelo servidor. O horário, a quantidade de registros e o relógio do dispositivo não determinam precedência.

Quando duas sessões partirem da mesma revisão, a primeira gravação aceita avança a revisão. A segunda recebe `409` e nenhuma mesclagem automática é executada. As duas versões são preservadas até uma decisão explícita:

- **Usar a nuvem:** baixa a versão local como arquivo de recuperação antes de aplicar a versão remota.
- **Usar este dispositivo:** repete a gravação sobre a revisão remota e solicita snapshot; o servidor mantém a versão anterior no histórico antes de aplicar a local.

Exclusões não são inferidas nem mescladas nesta fase. Isso impede a ressurreição silenciosa de itens removidos.

## Comparação das opções

### JSON único versionado

É a opção transitória escolhida. Exige menos risco de migração, é compatível com clientes antigos e fornece concorrência otimista segura. A desvantagem é que alterações simultâneas em áreas diferentes ainda geram conflito do documento inteiro.

### Documentos por domínio

É o próximo passo adequado para preferências, layouts Vitalícios e configurações. Reduz conflitos entre áreas, mas ainda não resolve concorrência dentro de listas de registros.

### Tabelas normalizadas

É o destino recomendado para hábitos e conclusões, finanças, notas, calendário e ideias. Cada registro poderá ter revisão própria, propriedade validada e exclusão explícita.

## Ordem recomendada de normalização

1. Hábitos e conclusões: separar a definição do hábito de cada conclusão diária.
2. Finanças: transações, metas, depósitos, assinaturas e investimentos em registros próprios.
3. Notas e ideias: registros e conexões independentes.
4. Calendário: eventos e recorrências.
5. Preferências, layouts e widgets: documentos pequenos separados por domínio.

## Tombstones futuros

Tombstones só serão introduzidos junto das tabelas normalizadas. Cada exclusão terá ID, usuário proprietário, revisão do servidor e `deleted_at`. A retenção inicial proposta é de 90 dias, seguida de limpeza em processo controlado somente depois que todos os clientes ativos confirmarem uma revisão posterior. Clientes antigos nunca poderão recriar um registro cujo tombstone ainda esteja retido.

## Compatibilidade e rollback

Esta fase não altera o formato do JSON nem cria tabelas. Clientes antigos continuam usando o endpoint legado enquanto a flag V2 estiver desligada. A interface nova de conflito somente atua quando o servidor retorna conflito explícito. O rollback do código restaura a interface anterior sem alterar dados ou revisões no banco.

