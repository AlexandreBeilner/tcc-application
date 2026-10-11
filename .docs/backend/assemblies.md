# Assembleias (`modules/assemblies`)

Fundação genérica das assembleias (MO.6.1). Só `kind = shareholder` está registrado hoje; o
desenho é extensível por `kind` (M9).

**Rotas HTTP:** voto e "minha situação" (MO.6.4, abaixo). Elas só existem com `ASSEMBLIES_ENABLED=on` (sem a chave, 404). Propostas de pauta e apoio estão na MO.6.5 (abaixo); leitura e placar entram na MO.6.6, pausa e auditoria no admin na MO.6.8.
Cada tarefa documenta as suas rotas neste arquivo, no mesmo commit.

## Modelo

| Tabela | Papel |
|---|---|
| `assemblies` | (MO.6.3 acrescentou `title`, `subject_label`, `template_key` e `effect_applied_at`; MO.6.7, `result_announced_at`) `kind`, `subject_ref` (empresa hoje), `dedupe_key` única (abertura idempotente), `status` (`scheduled` → `open` → `closed`), `opens_at`, `snapshot_at` (data de corte), `closes_at`, `effect_applies_at`, resultado (`outcome`, `outcome_reason`, `winning_option_id`, `voter_count`). Check: `snapshot_at <= opens_at < closes_at <= effect_applies_at`. |
| `agenda_templates` | Catálogo de pautas (MO.6.3): `key`, `kind`, `sector` (nulo vale para qualquer setor), `title`, `description`, `options` (jsonb com 2 opções `{ key, label, gain, loss, effect }`), `active`. Semeado pela migração `0043` (5 pautas gerais e 12 de setor: Varejo, Energia, Mineração, Agronegócio, Bancário/Financeiro, Tecnologia). Cresce por linha nova; propostas e apoio vivem em `agenda_proposals` (MO.6.5), edição pelo painel na MO.6.8. |
| `assembly_options` | Opções da pauta, de catálogo (sem texto livre): `label`, `gain`, `loss`, `effect` (jsonb, lido pelo efeito do kind). |
| `assembly_votes` | Um voto por pessoa e assembleia (PK composta); trocar o voto atualiza a mesma linha. O peso **não** é gravado: sai do snapshot na apuração. |
| `agenda_proposals` | (MO.6.5) Proposta de pauta: `kind`, `subject_ref` (empresa), `template_key` (FK do catálogo; **sem texto livre**), `proposed_by`, `status` (`active` → `consumed` quando vira a pauta de uma assembleia, ou `expired`), `expires_at`, `consumed_assembly_id`. Índice único parcial `(kind, subject_ref, template_key) WHERE status = 'active'`: uma proposta ativa por pauta e empresa. |
| `agenda_proposal_supports` | (MO.6.5) Um apoio por pessoa e proposta (PK composta); o proponente entra como primeiro apoio. Nunca exposto por pessoa. |
| `assembly_vote_credits` | Consumo do crédito mensal gratuito (PK pessoa + assembleia); `month_key` = mês de calendário de Brasília (`2026-10`). |

## Regras de domínio (`domain/assembly.ts`)

- **Apuração** (`tallyVotes`): peso e elegibilidade vêm da política do kind sobre o snapshot da data de corte; voto de quem não é elegível, de peso zero ou em opção fora da pauta é descartado e não conta para o mínimo. Menos votantes distintos que `minVoters` → `not_approved / quorum`; empate no topo → `not_approved / tie`; ambos mantêm o status quo.
- **Janela de voto** (`isOpenForVoting`): `status = open` e `opens_at <= agora < closes_at`. Vale também para trocar o voto. O repositório trava a linha da assembleia ao gravar, então voto e fechamento se serializam.
- **Crédito**: `creditMonthKey` (Brasília, UTC-3) e `hasFreeCredit(usado, monthlyFreeCredits)`. O consumo no primeiro voto é do caso de uso da MO.6.4.
- **Parâmetros** (`AssemblyParams`: `minVoters`, `monthlyFreeCredits`, `freeCreditMinLevel`) entram por função; `DEFAULT_ASSEMBLY_PARAMS` é o valor inicial, que o painel sobrepõe pela tabela `assembly_settings` (MO.6.8, ver abaixo). **O quórum é congelado na assembleia** (`assemblies.min_voters`, gravado ao abrir): a apuração e o detalhe usam o da abertura, e só uma assembleia anterior ao parâmetro (`null`) usa o de agora.

## Extensão por kind

`AssemblyKindRegistry` (`application/assemblyKinds.ts`) guarda, por kind, `KindPolicies` (puras: `isEligible`, `weightOf`) e um `EffectApplier` (fala com o motor). Para um kind novo basta registrar os dois; `CreateAssemblyUseCase`, `TallyAssemblyUseCase`, o repositório e as tabelas não mudam (provado com um kind fictício nos testes).

## Ports

- `AssemblyRepository`: persistência (adapter Drizzle em `infrastructure/persistence/`).
- `HoldingsSnapshotProvider`: posições na data de corte, só de contas de usuário. O adapter (HTTP do motor) entra na MO.6.3.

## Ciclo de vida (MO.6.3)

Job (`RunAssemblyLifecycleUseCase`, ligado em `server.ts`) a cada hora (`ASSEMBLY_INTERVAL_MS`), **desligado por padrão**: só roda com `ASSEMBLIES_ENABLED=on`. Quatro etapas independentes e idempotentes, nesta ordem:

1. **Fechar** (`CloseDueAssembliesUseCase`): abertas com `closes_at` vencido. Apura (`TallyAssemblyUseCase`, com o snapshot do motor) e grava o resultado, **público a partir daí e antes de o efeito valer**. Sem o mínimo de votantes (`quorum`) ou com empate (`tie`) fecha como `not_approved` e nada vai ao motor. Se o motor estiver fora do ar a assembleia continua aberta e a próxima rodada tenta de novo.
2. **Abrir** (`OpenDueAssembliesUseCase`): pede ao motor `GET /governance/reports` (balanço de `openDelayDays` a `openDelayDays + catchUpDays` dias simulados atrás), escolhe a pauta do catálogo de forma **determinística** (hash de empresa e dia do balanço, entre as pautas gerais e as do setor), cria a assembleia com `dedupe_key = shareholder:{empresa}:{dia do balanço}`, pede o snapshot ao motor (`POST /governance/snapshots`) e a abre. **Antes de criar, consulta o período de espera da empresa no motor (`CompanyCooldownReader`, ponto 050): empresa em cooldown não abre; a rodada seguinte tenta de novo, então se o cooldown acabar dentro da janela de recuperação a assembleia abre, senão aquele balanço passa sem assembleia.** Reexecutar não duplica; assembleia que ficou `scheduled` por falha no meio é retomada.
3. **Aplicar** (`ApplyDueAssemblyEffectsUseCase`): fechadas, `approved`, com `effect_applies_at` vencido e `effect_applied_at` nulo. Envia a decisão **já aprovada** ao motor (`POST /governance/decisions`, `{ metric, direction, intensity }`, sem valor absoluto) e marca `effect_applied_at`. Idempotente no motor por id da assembleia.
4. **Publicar o resultado** (`AnnounceClosedAssembliesUseCase`, MO.6.7): fechadas com `result_announced_at` nulo (coluna nova, migração `0046`). Para quem **votou**, grava uma linha no feed social (`assembly_participated`, ver `socialfeed.md`); para **todo acionista da data de corte** (`KindPolicies.isEligible` sobre o snapshot), enfileira o e-mail `assembly_result` na categoria `social` (opt-in, desligada por padrão; mesmo texto para quem votou e para quem não votou, nunca cobra participação). Publica também quando a assembleia fechou sem decisão (`quorum`/`tie`, texto neutro). Cada envio é idempotente (`assembly-result:<assembleia>:<pessoa>` no e-mail; uma linha por assembleia e pessoa no feed), então, se algum falhar, a assembleia **não** recebe a marca e a rodada seguinte repete tudo sem duplicar; só depois de tudo certo `markResultAnnounced` grava a marca. O resumo entregue às portas (`AssemblyResultSummary`) leva só pauta, empresa e desfecho: nunca voto por pessoa nem valor em reais (RNF09).

### Parâmetros

Valor inicial por variável de ambiente (valor inválido cai no padrão), **sobreposto pelo que o painel grava em `assembly_settings`** (MO.6.8, ver "Painel admin"): `ASSEMBLY_OPEN_DELAY_DAYS` (2), `ASSEMBLY_CATCH_UP_DAYS` (7), `ASSEMBLY_DURATION_DAYS` (7), `ASSEMBLY_EFFECT_DELAY_DAYS` (1), `ASSEMBLY_MIN_VOTERS` (3), `ASSEMBLY_PARTICIPATION_XP` (10). **Unidade:** o atraso de abertura conta dias **simulados** (é o que o motor sabe do balanço); duração e atraso do efeito contam dias **reais** (é o prazo que a pessoa vive ao votar).

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
- **Recompensa (MO.6.7):** o **primeiro** voto da pessoa na assembleia concede `ASSEMBLY_PARTICIPATION_XP` (10) pelo `AwardXpUseCase` (motivo `assembly_vote:<assembleia>`); trocar o voto nunca concede de novo, e o valor **não depende de quem vence**. Best-effort: se o XP falhar, o voto já gravado continua valendo (só logado). O desbloqueio da conquista "Acionista Ativo" (critério `assemblies_participated`, ver `achievements.md`) é checado pelo próprio `AwardXpUseCase`.
- **Atomicidade:** `AssemblyRepository.castVote` faz numa transação só: trava a assembleia (voto e fechamento se serializam, nenhum voto entra depois da apuração), trava a pessoa no mês (advisory lock, então dois votos simultâneos em assembleias diferentes gastam um crédito só), confere o saldo, grava o voto e consome o crédito. Voto recusado nunca gasta crédito.
- **Crédito:** `ASSEMBLY_MONTHLY_FREE_CREDITS` por **mês de calendário de Brasília, o do primeiro voto** (`assembly_vote_credits.month_key`).

### `GET /assemblies/:id/me`

- **Sucesso:** `200` → `{ assemblyId, isPro, canVote, reason, message, myVote: { optionId } | null, myShares, credit: { monthKey, limit, used, available, minLevel } }`. `reason` é um de `not_open`, `not_shareholder`, `email_not_verified`, `level_too_low`, `no_credit` (ou `null`); `message` é o texto pronto, sem culpa. `myShares` são as ações **da própria pessoa** na data de corte (nunca valor em reais nem dado de outra pessoa; `null` fora da janela).
- **Erros:** `400` · `401` · `404`.
- **Regra:** `GetMyVotingStatusUseCase` usa o mesmo `VoteAccessService` do voto, então a tela (MO.6.6) mostra o botão, o saldo e o convite ao PRO sem repetir regra no frontend.

### Parâmetros novos

`ASSEMBLY_MONTHLY_FREE_CREDITS` (1) e `ASSEMBLY_FREE_CREDIT_MIN_LEVEL` (3), junto dos demais `ASSEMBLY_*`, até a tabela editável da MO.6.8.

## Propostas de pauta e apoio (MO.6.5)

PRO propõe uma pauta **do catálogo** para uma empresa que possui e PRO acionista apoia; a mais apoiada entra na próxima assembleia da empresa. Sem texto livre: o único dado da proposta é `templateKey`. Só existem com `ASSEMBLIES_ENABLED=on`. Autenticação Bearer; `:companyId` e `:proposalId` precisam ser UUID (`400`). Gating de PRO só pelo `ProAccessGuard` (porta `ProGate`), nunca claim de JWT: sem plano, `403 { error: "requer plano PRO" }` (o handler compartilhado).

### `GET /assemblies/companies/:companyId/proposals`

- **Quem:** qualquer pessoa autenticada (a fila é pública, ler não exige PRO nem ações).
- **Sucesso:** `200` → `{ company: { id, name, sector }, isPro, holdsShares, cooldownDaysLeft, blockedReason, limits: { monthlyCap, usedThisMonth, minSupport, ttlDays }, proposals: [{ id, templateKey, title, description, options: [{ label, gain, loss }], supportCount, supportedByMe, proposedByMe, expiresAt, queuePosition }], availableTemplates: [{ key, title, description, hasActiveProposal }] }`.
  - `blockedReason` é `not_shareholder`, `company_in_cooldown` ou `null`: o motivo de a pessoa não poder propor nem apoiar agora (o plano PRO é à parte, em `isPro`).
  - `proposals` vem na ordem da fila (mais apoios primeiro, empate pela mais antiga). `queuePosition` é 1 para a próxima a ser escolhida e `null` enquanto não tem `minSupport` apoios.
  - `availableTemplates` são as pautas gerais e as do setor da empresa, para a tela de propor.
  - **Nunca** revela quem propôs ou apoiou: só a contagem e os campos `...ByMe` da própria pessoa.
- **Erros:** `400` · `401` · `404` empresa inexistente no motor.

### `POST /assemblies/companies/:companyId/proposals`

- **Payload:** `{ "templateKey": string }` (Zod, 1 a 80 caracteres).
- **Sucesso:** `201` → `{ proposal: { id, templateKey, supportCount, supportedByMe, proposedByMe, expiresAt }, joinedExisting: false }`. Se a pauta **já tem proposta ativa** nesta empresa, o pedido vira apoio a ela: `200` com `joinedExisting: true`, sem gastar o teto.
- **Erros:** `400` corpo inválido · `400 { reason: "template_unavailable" }` pauta fora do catálogo ativo ou de outro setor · `401` · `403 { error: "requer plano PRO" }` · `403 { error, reason }` com `not_shareholder`, `company_in_cooldown` (o texto traz os dias do mercado que faltam) ou `monthly_cap_reached` · `404` empresa inexistente.
- **Regra** (`ProposeAgendaUseCase`, nesta ordem): plano PRO; empresa (ações **de agora** e período de espera, via motor `GET /governance/companies/{id}/standing`); pauta do catálogo ativo que vale para o setor; teto do mês. O repositório faz o resto numa transação que serializa a pauta da empresa (duplicado) e depois a pessoa (teto), então duas propostas simultâneas nunca passam do limite nem duplicam a pauta. O teto conta propostas **criadas** no mês de calendário de Brasília, de qualquer estado; retirar apoio ou ver a proposta expirar não o devolve.

### `PUT /assemblies/proposals/:proposalId/support`

- **Sucesso:** `201` → `{ proposal, alreadySupported: false }`; `200` com `alreadySupported: true` se já apoiava (não duplica).
- **Erros:** `400` · `401` · `403 requer plano PRO` · `403 { reason }` `not_shareholder` ou `company_in_cooldown` · `404` proposta inexistente · `409 { reason: "proposal_not_active" }` já usada ou vencida.
- **Regra** (`SupportProposalUseCase`): PRO, ações da empresa de agora e empresa fora do período de espera. Um apoio por pessoa.

### `DELETE /assemblies/proposals/:proposalId/support`

- **Sucesso:** `200` → `{ proposal, withdrawn }` (`withdrawn: false` se a pessoa não apoiava).
- **Erros:** `400` · `401` · `404`.
- **Regra** (`WithdrawProposalSupportUseCase`): **não exige PRO** (quem cancelou o plano ainda desfaz o que apoiou). A proposta nunca some por isso: só perde a contagem; propostas não são retiradas, só expiram ou são usadas.

### Como a fila escolhe a pauta (`OpenDueAssembliesUseCase`)

Ao abrir a assembleia de uma empresa: expira as propostas vencidas; ordena as vivas com pelo menos `minSupport` apoios por apoio (decrescente), depois proposta mais antiga, depois id (`rankProposals`); a primeira cuja pauta ainda está no catálogo ativo e vale para o setor vence (`pickProposedTemplate`). **Sem proposta que sirva vale o sorteio determinístico por hash do catálogo (MO.6.3), como antes.** A proposta cuja pauta virou a da assembleia é consumida (`consumed`, idempotente, pela pauta que a assembleia de fato guarda); **as demais continuam na fila até expirar** em `ASSEMBLY_PROPOSAL_TTL_DAYS`, sem zerar a cada ciclo.

### Cooldown

Só o do motor (`governance_cooldown_days`, 90 dias simulados): não há segundo cooldown no backend. O aviso é na entrada: propor e apoiar são recusados com `company_in_cooldown` enquanto a empresa está em período de espera. A **abertura** também respeita o cooldown (decisão do ponto 050, 2026-10-11): empresa em espera não abre assembleia até a espera acabar, dentro da janela de recuperação (`ASSEMBLY_CATCH_UP_DAYS`). O `skipped_cooldown` do motor fica só como rede de segurança (efeito aprovado que chega a uma empresa que mudou entre a abertura e o efeito).

### Parâmetros novos

`ASSEMBLY_PROPOSAL_MONTHLY_CAP` (3 propostas novas por PRO por mês), `ASSEMBLY_PROPOSAL_MIN_SUPPORT` (2, contando o proponente) e `ASSEMBLY_PROPOSAL_TTL_DAYS` (30, dias reais na fila), até a tabela editável da MO.6.8. Valor inválido cai no padrão.

## Leitura pública: lista, detalhe e placar (MO.6.6)

Qualquer pessoa autenticada lê (Bearer; sem PRO, sem ações). Só existem com `ASSEMBLIES_ENABLED=on`. Assembleia ainda `scheduled` nunca é pública (`404`). **Nunca** devolve quem votou em quê, ações absolutas nem valor em reais.

### `GET /assemblies`

- **Query (Zod):** `status` (`open` ou `closed`, opcional), `companyId` (UUID, opcional), `limit` (1 a 50, padrão 20, vale para as encerradas).
- **Sucesso:** `200` → `{ open: Summary[], closed: Summary[] }` (a lista do status não pedido vem vazia). `Summary` = `{ id, kind, subjectRef, subjectLabel, title, status, opensAt, closesAt, effectAppliesAt, effectAppliedAt, outcome, outcomeReason, voterCount }`. Abertas: as que fecham primeiro vêm antes. Encerradas: as mais recentes primeiro.
- **Erros:** `400` query inválida · `401`.

### `GET /assemblies/:id`

- **Sucesso:** `200` → `{ assembly: Summary & { description }, options: [{ id, key, label, gain, loss, effect, position }], scoreboard: { voters, options: [{ optionId, voters, weightPercent }] }, result, minVoters }`.
  - `effect` é `{ metric: "growth" | "quality", direction: 1 | -1, intensity }` ou `null`: a ficha mostra o que a opção mexe e que fração da faixa do motor ela usa, **sem lado recomendado** e sem valor absoluto (o tamanho final é do motor).
  - `scoreboard`: votantes e `weightPercent` (0 a 100, uma casa) sobre as ações **de quem votou**, na data de corte. Assembleia aberta passa por cache Redis de 5 s (`assemblies:scoreboard:{id}`, adapter que engole falha do Redis), então o polling do frontend não reapura a cada pedido; a encerrada é apurada direto.
  - `result`: `null` enquanto aberta; depois do fechamento `{ outcome, reason, winningOptionId, voterCount, decidedAt }` (público antes de o efeito valer).
  - `description`: contexto da pauta vindo do catálogo (`null` se a pauta saiu do catálogo ativo).
- **Erros:** `400` id que não é UUID · `401` · `404`.

## Painel admin: pausa, parâmetros e pautas (MO.6.8)

Rotas em `.docs/backend/admin.md#assembleias-tarefa-mo68` (admin, auditadas). O módulo expõe `createAssemblyAdminCore` (composição), que existe **com o recurso desligado**: repositório, pausas, parâmetros, catálogo editável e leitura com voto por pessoa. Três tabelas novas (migração `0047`):

- **`assembly_settings`** (`key`, `value`, `updated_by`, `updated_at`): uma linha por parâmetro alterado; restaurar apaga a linha. `AssemblySettingsService` mantém o objeto de configuração vivo (o mesmo que `composition.ts` lê a cada uso) e o atualiza ao gravar e **no começo de cada rodada do ciclo**, então o painel vale sem reiniciar. Linha gravada fora da faixa é ignorada (nunca derruba o ciclo). Faixas em `domain/settings.ts`.
- **`assembly_pauses`** (`scope` `global | subject`, `kind`, `subject_ref`, `scope_key`, `reason`, quem criou e quem retomou): uma vigente por escopo (índice único parcial em `scope_key`). `OpenDueAssembliesUseCase` e `ApplyDueAssemblyEffectsUseCase` consultam as vigentes a cada rodada: a global barra tudo (sem nem chamar o motor), a de empresa só a dela. Fechar, apurar e publicar o resultado não são afetados.
- **`assemblies.min_voters`**: coluna nova (nula em assembleias antigas).

O catálogo editável (`agenda_templates`) ganha `AgendaCatalogAdmin` (todas as pautas, com o uso) e validação em `domain/agendaTemplates.ts`; o ciclo continua lendo só as ativas (`AgendaCatalog.listActive`).
