# Assembleias (`modules/assemblies`)

Fundação genérica das assembleias (MO.6.1). Só `kind = shareholder` está registrado hoje; o
desenho é extensível por `kind` (M9).

**Ainda não há rotas HTTP.** Elas entram com os casos de uso que as justificam: voto e crédito
(MO.6.4), propostas e apoio (MO.6.5), leitura e placar (MO.6.6) e pausa/auditoria no admin (MO.6.8).
Cada tarefa documenta as suas rotas neste arquivo, no mesmo commit.

## Modelo

| Tabela | Papel |
|---|---|
| `assemblies` | `kind`, `subject_ref` (empresa hoje), `dedupe_key` única (abertura idempotente), `status` (`scheduled` → `open` → `closed`), `opens_at`, `snapshot_at` (data de corte), `closes_at`, `effect_applies_at`, resultado (`outcome`, `outcome_reason`, `winning_option_id`, `voter_count`). Check: `snapshot_at <= opens_at < closes_at <= effect_applies_at`. |
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
