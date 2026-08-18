# Auditoria da Fase 1: sincronizacao e Indicacoes

Este documento registra o comportamento existente. A Fase 1 nao altera banco, formato do estado, recompensas ou dados de usuarios.

## Fluxo efetivamente executado

- `save()` registra o snapshot financeiro, chama `writeLocalState()`, agenda `scheduleCloudSave()` e renderiza a interface.
- `writeLocalState()` atualiza `profile.localUpdatedAt`, grava no `localStorage` da conta e agenda a copia no IndexedDB.
- `scheduleCloudSave()` aplica debounce e chama `pushCloudState()`.
- `pushCloudState()` envia o estado inteiro para `/api/account-state` e usa `baseUpdatedAt` como controle otimista.
- Em conflito 409, `mergeAccountStates()` mescla automaticamente o JSON completo e tenta novamente.
- `handleSignedIn()` usa `chooseSafestAccountState()` para escolher entre nuvem, `localStorage`, IndexedDB, armazenamento legado e metadata antiga.
- `syncReferralProgram()` captura o codigo guardado localmente, registra a indicacao e mantem o resultado GET em cache por 60 segundos.

## Persistencia local mapeada

- `luar-state`: estado legado e estado inicial antes da resolucao da conta.
- `luar-state:<user_id>`: cache local vinculado a conta.
- IndexedDB `luar-private-state` / `accounts`: segunda copia local vinculada ao usuario.
- `luar-profile-permanent:<user_id>`: conquistas e informacoes permanentes do perfil.
- `luar-referral-code`: codigo de indicacao pendente, restrito ao navegador.
- `luar-attribution`: parametros UTM, restritos ao navegador.
- `luar-payment:<user_id>`: checkout Pix pendente.
- Chaves auxiliares de tema, analytics, tutorial, backup e preferencias continuam locais.

## Duplicacoes consolidadas

- `handleSignedIn()`: preservada a implementacao posterior, que usa `chooseSafestAccountState()` e inclui a origem `metadata` no processo de recuperacao.
- `syncReferralProgram()`: preservada a implementacao posterior, que normaliza o retorno, impede requisicoes GET simultaneas e apresenta carregamento/erro/tentativa novamente.

## Limitacoes deliberadamente preservadas nesta fase

- Nao existe revalidacao por foco, visibilidade ou retorno da internet.
- O relogio do cliente ainda influencia `chooseSafestAccountState()`.
- A mesclagem ainda nao representa exclusoes e pode restaurar registros apagados.
- Campos locais ainda podem vencer campos remotos sem comparacao por registro.
- O salvamento pendente ainda nao possui fila duravel.
- Indicacoes ainda dependem de `localStorage` antes do login e podem ser perdidas entre navegadores.
- O cache de Indicacoes ainda pode permanecer desatualizado por ate 60 segundos.

Esses itens sao demonstrados por `scripts/test-phase1-sync-diagnostics.mjs` e somente serao corrigidos nas fases autorizadas posteriormente.
