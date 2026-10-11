# Assembleias (`modules/assemblies`)

Fundação genérica das assembleias (MO.6.1). Só `kind = shareholder` está registrado hoje; o
desenho é extensível por `kind` (M9).

**Rotas HTTP:** voto e "minha situação" (MO.6.4, abaixo). Elas só existem com `ASSEMBLIES_ENABLED=on` (sem a chave, 404). Propostas e apoio entram na MO.6.5, leitura e placar na MO.6.6, pausa e auditoria no admin na MO.6.8.
Cada tarefa documenta as suas rotas neste arquivo, no mesmo commit.

## Modelo

| Tabela | Papel |
|---|---|
| `assemblies` | (MO.6.3 acrescentou `title`, `subject_label`, `template_key` e `effect_applied_at`) `kind`, `subject_ref` (empresa hoje), `dedupe_key` única (abertura idempotente), `status` (`scheduled` → `open` → `closed`), `opens_at`, `snapshot_at` (data de corte), `closes_at`, `effect_applies_at`, resultado (`outcome`, `outcome_reason`, `winning_option_id`, `voter_count`). Check: `snapshot_at <= opens_at < closes_at <= effect_applies_at`. |
| `agenda_templates` | Catálogo de pautas (MO.6.3): `key`, `kind`, `sector` (nulo vale para qualquer setor), `title`, `description`, `options` (jsonb com 2 opções `{ key, label, gain, loss, effect }`), `active`. Semeado pela migração `0043` (5 pautas gerais e 12 de setor: Varejo, Energia, Mineração, Agronegócio, Bancário/Financeiro, Tecnologia). Cresce por linha nova; proposta e apoio entram na MO.6.5, edição pelo painel na MO.6.8. |
| `assembly_options` | Opções da pauta, de catálogo (sem texto livre): `label`, `gain`, `loss`, `effect` (jsonb, lido pelo efeito do kind). |
| `assembly_votes` | Um voto por pessoa e assembleia (PK composta); trocar o voto atualiza a mesma linha. O peso **não** é gravado: sai do snapshot na apuração. |
| `assembly_vote_credits` | Consumo do crédito mensal gratuito (PK pessoa + assembleia); `month_key` = mês de calendário de Brasília (`2026-10`). |

## Regras de domínio (`domain/assembly.ts`)

- **Apuração** (`tallyVotes`): peso e elegibilidade vêm da política do kind sobre o snapshot da data de corte; voto de quem não é elegível, de peso zero ou em opção fora da pauta é descartado e não conta para o mínimo. Menos votantes distintos que `minVoters` → `not_approved / quorum`; empate no topo → `not_approved / tie`; ambos mantêm o status quo.
- **Janela de voto** (`isOpenForVoting`): `status = open` e `opens_at <= agora < closes_at`. Vale também para trocar o voto. O repositório trava a linha da assembleia ao gravar, então voto e fechamento se serializam.
- **Crédito**: `creditMonthKey` (Brasília, UTC-3) e `hasFreeCredit(usado, monthlyFreeCredits)`. O consumo no primeiro voto é do caso de uso da MO.6.4.
- **Parâmetros** (`AssemblyParams`: `minVoters`, `monthlyFreeCredits`) entram por função em `TallyAssemblyUseCase`; `DEFAULT_ASSEMBLY_PARAMS` (3 e 1) é só o ponto de partida até a tabela editável pelo admin (MO.6.8).

## Extensão por kind

`AssemblyKindRegistry` (`application/assemblyKinds.ts`) guarda, por kind, `KindPolicies` (puras: `isEligible`, `weightOf`) e um `EffectApplier` (fala com o motor). Para um kind novo basta registrar os dois; `CreateAssemblyUseCase`, `TallyAssemblyUseCase`, o repositório e as tabelas não mudam (provado com um kind fictício nos testes).

## Ports

- `AssemblyRepository`: persistência (adapter Drizzle em `infrastructure/persistence/`).
- `HoldingsSnapshotProvider`: posições na data de corte, só de contas de usuário. O adapter (HTTP do motor) entra na MO.6.3.

## Ciclo de vida (MO.6.3)

Job (`RunAssemblyLifecycleUseCase`, ligado em `server.ts`) a cada hora (`ASSEMBLY_INTERVAL_MS`), **desligado por padrão**: só roda com `ASSEMBLIES_ENABLED=on`. Três etapas independentes e idempotentes, nesta ordem:

1. **Fechar** (`CloseDueAssembliesUseCase`): abertas com `closes_at` vencido. Apura (`TallyAssemblyUseCase`, com o snapshot do motor) e grava o resultado, **público a partir daí e antes de o efeito valer**. Sem o mínimo de votantes (`quorum`) ou com empate (`tie`) fecha como `not_approved` e nada vai ao motor. Se o motor estiver fora do ar a assembleia continua aberta e a próxima rodada tenta de novo.
2. **Abrir** (`OpenDueAssembliesUseCase`): pede ao motor `GET /governance/reports` (balanço de `openDelayDays` a `openDelayDays + catchUpDays` dias simulados atrás), escolhe a pauta do catálogo de forma **determinística** (hash de empresa e dia do balanço, entre as pautas gerais e as do setor), cria a assembleia com `dedupe_key = shareholder:{empresa}:{dia do balanço}`, pede o snapshot ao motor (`POST /governance/snapshots`) e a abre. Reexecutar não duplica; assembleia que ficou `scheduled` por falha no meio é retomada.
3. **Aplicar** (`ApplyDueAssemblyEffectsUseCase`): fechadas, `approved`, com `effect_applies_at` vencido e `effect_applied_at` nulo. Envia a decisão **já aprovada** ao motor (`POST /governance/decisions`, `{ metric, direction, intensity }`, sem valor absoluto) e marca `effect_applied_at`. Idempotente no motor por id da assembleia.

### Parâmetros

Por variável de ambiente até a tabela editável da MO.6.8 (valor inválido cai no padrão): `ASSEMBLY_OPEN_DELAY_DAYS` (2), `ASSEMBLY_CATCH_UP_DAYS` (7), `ASSEMBLY_DURATION_DAYS` (7), `ASSEMBLY_EFFECT_DELAY_DAYS` (1), `ASSEMBLY_MIN_VOTERS` (3). **Unidade:** o atraso de abertura conta dias **simulados** (é o que o motor sabe do balanço); duração e atraso do efeito contam dias **reais** (é o prazo que a pessoa vive ao votar).

### Calendário

Com o ciclo ligado, `GET /market/calendar` (ver `market.md`) acrescenta fatos globais de mercado `assembly_open`, `assembly_close` e `assembly_effect` (este só se a pauta não foi reprovada), com `title` = "Empresa: pauta", `relevance: "market"` e sem valor em reais. Ficam de fora com `scope=mine`. Instante real vira dia simulado pelo relógio do motor (`GET /market/clock`). Falha ao ler as assembleias nunca derruba o calendário.

## Voto e elegibilidade (MO.6.4)

Autenticação: Bearer token, `userId` sempre do token. `:id` precisa ser UUID (`400`). Só existem com `ASSEMBLIES_ENABLED=on`.

### `POST /assemblies/:id/vote`

- **Payload:** `{ "optionId": uuid }` (Zod). A opção precisa ser da pauta desta assembleia.
- **Sucesso:** `201` no primeiro voto, `200` ao trocar o voto. Corpo: `{ optionId, changed, creditConsumed }` (`creditConsumed` é `true` só no primeiro voto de quem usou o crédito gratuito; PRO e troca de voto nunca consomem).
- **Erros:** `400` corpo inválido ou opção de outra assembleia · `401` · `404` assembleia inexistente · `409 { error, reason: "not_open" }` fora da janela de votação · `403 { error, reason }` com um dos motivos abaixo.
- **Regra** (`CastVoteUseCase` + `VoteAccessService` + `resolveVoteAccess`, nesta ordem):
  1. janela aberta (`status = open` e `opens_at <= agora < closes_at`);
  2. **posição na data de corte** (snapshot do motor, que já exclui bots): sem ela `403 not_shareholder`, **mesmo para PRO**;
  3. quem **já votou** troca o voto até o fechamento sem PRO, crédito, nível ou e-mail (cancelar o plano nunca desfaz o que a pessoa já fez; o peso continua o do snapshot);
  4. **PRO** vota sem gastar crédito e sem exigência de nível ou e-mail (consulta ao `ProAccessGuard`, nunca claim de JWT);
  5. quem não é PRO usa o **crédito mensal**: `403 email_not_verified` (verifique seu e-mail), `403 level_too_low` (a partir do nível `ASSEMBLY_FREE_CREDIT_MIN_LEVEL`, padrão 3) e `403 no_credit` com o texto `requer plano PRO ou crédito de voto`.
- **Atomicidade:** `AssemblyRepository.castVote` faz numa transação só: trava a assembleia (voto e fechamento se serializam, nenhum voto entra depois da apuração), trava a pessoa no mês (advisory lock, então dois votos simultâneos em assembleias diferentes gastam um crédito só), confere o saldo, grava o voto e consome o crédito. Voto recusado nunca gasta crédito.
- **Crédito:** `ASSEMBLY_MONTHLY_FREE_CREDITS` por **mês de calendário de Brasília, o do primeiro voto** (`assembly_vote_credits.month_key`).

### `GET /assemblies/:id/me`

- **Sucesso:** `200` → `{ assemblyId, isPro, canVote, reason, message, myVote: { optionId } | null, myShares, credit: { monthKey, limit, used, available, minLevel } }`. `reason` é um de `not_open`, `not_shareholder`, `email_not_verified`, `level_too_low`, `no_credit` (ou `null`); `message` é o texto pronto, sem culpa. `myShares` são as ações **da própria pessoa** na data de corte (nunca valor em reais nem dado de outra pessoa; `null` fora da janela).
- **Erros:** `400` · `401` · `404`.
- **Regra:** `GetMyVotingStatusUseCase` usa o mesmo `VoteAccessService` do voto, então a tela (MO.6.6) mostra o botão, o saldo e o convite ao PRO sem repetir regra no frontend.

### Parâmetros novos

`ASSEMBLY_MONTHLY_FREE_CREDITS` (1) e `ASSEMBLY_FREE_CREDIT_MIN_LEVEL` (3), junto dos demais `ASSEMBLY_*`, até a tabela editável da MO.6.8.
