# Assembleias (`modules/assemblies`)

Fundação genérica das assembleias (MO.6.1). Só `kind = shareholder` está registrado hoje; o
desenho é extensível por `kind` (M9).

**Ainda não há rotas HTTP** (o ciclo abaixo roda em job, sem rota). Elas entram com os casos de uso que as justificam: voto e crédito
(MO.6.4), propostas e apoio (MO.6.5), leitura e placar (MO.6.6) e pausa/auditoria no admin (MO.6.8).
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
