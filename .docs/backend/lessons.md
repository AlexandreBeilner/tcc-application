# `lessons` — trilha de aprendizado

Módulo: `backend/src/modules/lessons/`. Sobre `lessons`/`user_lesson_progress` (já existentes desde a tarefa 1.3). Primeiro consumidor real de `modules/gamification` (5.1/5.3) — credita xp e toca o streak via ports próprias (`xpAwarder`/`streakTracker`), implementadas em processo sobre `AwardXpUseCase`/`TouchStreakUseCase` (ver `.claude/arquitetura-backend-ddd-lite.md`).

Regra de desbloqueio: progressão linear por `sortOrder` global — uma lição fica `available` assim que `sortOrder <= completedCount + 1`, onde `completedCount` é o total de lições concluídas pelo usuário (não é por trilha; é isso que faz a última lição de uma trilha desbloquear a primeira da próxima, ex: 0.5 → 1.1). Não modela pré-requisito ramificado/paralelo.

Steps de uma lição (spec 5.2): `0`=cenário, `1`=micro-decisão, `2`=revelação, `3`=desbloqueio. Chegar no step `3` pela primeira vez marca a lição como concluída, credita xp (`LESSON_XP_REWARD`, flat, ilustrativo — sujeito à calibração 8.1) e toca o streak diário. Reenviar o step `3` ou reabrir a lição depois (modo revisão, tela 3.2) nunca credita de novo — idempotente por `completedAt` já preenchido.

Desbloqueio real de funcionalidade/produto (tarefa 7.0.1, diferente da progressão lição-a-lição acima): `unlocksKeys` (vocabulário fixo — `portfolio`, `calculator`, `news_feed` ou `asset:<AssetType>`) some lição-a-lição pra formar o conjunto de chaves desbloqueadas de um usuário — `unlockedKeysFor(completedCount, lessons)`, união de `unlocksKeys` de toda lição com `sortOrder <= completedCount` (a lição precisa estar **concluída**, não só disponível). Consumido de dois jeitos: (a) `modules/market` (`ProductUnlockReader`, ver `.docs/backend/market.md`) nega `POST /market/orders`/`fixed-income/purchases` de ativo real ainda travado; (b) frontend espelha a mesma função em TS puro (`features/lessons/unlockedKeys.ts`) a partir do `unlocksKeys` que `GET /lessons` já devolve por lição — sem endpoint novo.

Conteúdo pedagógico real por passo (tarefa 7.0.2, migration `0010`): `scenarioText`/`microDecisionPrompt`/`revelationText` (`text NOT NULL DEFAULT ''`) sustentam os passos Cenário/Micro-decisão/Revelação da tela 3.2 (antes desta tarefa, a tela reaproveitava `centralConcept` idêntico nos 3). `microDecisionType` (`pgEnum` — `reflection`/`growth_calculator`/`fixed_income_comparison`/`live_indicator`/`live_macro_indicator` (M.5), default `reflection`) escolhe o widget do passo Micro-decisão no frontend; `microDecisionAssetTicker` (nullable) só é usado quando o tipo é `live_indicator` — a Revelação busca o indicador ao vivo desse ticker via `GET /market/assets/:id` (resolvido antes por `GET /market/assets`, sem endpoint novo). Uma lição `live_macro_indicator` (tarefa M.5, ex: `1.3`/`1.9`) não usa `microDecisionAssetTicker` — a Revelação busca a série de Selic/IPCA direto via `GET /market/indicators` (M.3), sem ticker de ativo nenhum. `unlocksAssetTicker` (nullable) é preenchido só nas lições cujo `unlocksKeys` inclui um `asset:*` — ticker canônico real do produto recém-desbloqueado, usado pelo botão "Comprar agora" do passo Desbloqueio (deep-link pro Detalhe de Ativo real). Lições ainda não autoradas (autoria é a tarefa 7.1) ficam com os 3 campos de texto vazios e `microDecisionType`/`unlocksAssetTicker` no default — estado de transição esperado, não bug.

Aposta com acerto/erro real (backlog engajamento B.1, migration `0013`): `microDecisionOptions` (`text[]`, nullable) e `microDecisionCorrectOption` (`smallint`, nullable) em `lessons` — quando os dois estão preenchidos, o passo Micro-decisão troca o checkbox "já pensei" (widget de hoje) por uma escolha real entre 2-4 alternativas (widget novo é a B.3; conteúdo real das 33 lições é a B.4). `null` nos dois é o estado normal enquanto isso não acontece — nenhuma quebra de contrato pro frontend atual. `user_lesson_progress.microDecisionSelectedOption` (`smallint`, nullable) grava o índice escolhido pelo usuário — ainda não gravado por nenhum endpoint nesta tarefa (`POST /lessons/:id/progress` ganha o campo `selectedOption` na B.2); existe desde já pra Fase H (conquista/missão de sequência de acertos) poder consultar o histórico depois. `domain/lesson.isCorrectOption(lesson, selectedOption)` compara o índice escolhido com o correto — `null` (não `false`) tanto pra "lição sem aposta real ainda" quanto pra "usuário não escolheu nada", já que nenhum dos dois é de fato "errou". **Correção da revisão da PR 18:** `microDecisionCorrectOption` (o índice certo) nunca sai do módulo pela API — `domain/lesson.buildLessonView` (usado por `GET /lessons`/`GET /lessons/:id`) o omite estruturalmente, mesmo padrão de RNF09 (o campo não existe no tipo de resposta, não é um filtro na serialização). A versão original devolvia o índice certo em todo `GET /lessons`, antes mesmo do usuário escolher — qualquer um podia ler a resposta certa pela aba de rede, o que esvaziava o propósito da aposta. `domain/lesson.microDecisionResultFor(lesson, selectedOption)` calcula o veredito (`correct`/`correctOptionLabel`) no servidor; só `AdvanceLessonUseCase` o expõe, e só na resposta do `POST` que de fato envia `selectedOption` (ver `POST /lessons/:id/progress` abaixo).

---

### `GET /lessons`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ lessons: [{ id, code, title, trackNumber, trackName, sortOrder, centralConcept, scenarioText, microDecisionPrompt, microDecisionType, microDecisionAssetTicker, revelationText, unlocksDescription, unlocksKeys, unlocksAssetTicker, microDecisionOptions, status, currentStep }] }`, ordenado por `sortOrder`. `status` é `completed`/`available`/`locked`, calculado por usuário. `unlocksKeys` (tarefa 7.0.1) é `string[]` — normalmente `[]`, só preenchido nas lições que desbloqueiam feature/produto de verdade (ver acima). `scenarioText`/`microDecisionPrompt`/`revelationText`/`microDecisionType`/`microDecisionAssetTicker`/`unlocksAssetTicker` (tarefa 7.0.2) sustentam o conteúdo pedagógico real por passo (ver acima) — os 3 campos de texto podem vir vazios pra lição ainda não autorada. `microDecisionOptions` (backlog engajamento B.1) vem `null` pra toda lição ainda não migrada pra aposta real (ver acima); `microDecisionCorrectOption` **nunca** vem aqui, nem preenchido nem `null` — o índice certo não faz parte deste contrato (correção da revisão da PR 18, ver acima).
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `GetTrackMapUseCase`.

---

### `GET /lessons/:id`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ lesson: { ...mesmo formato de GET /lessons, currentStep pra retomar } }`.
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `404` — lição inexistente **ou** ainda bloqueada — as duas situações retornam o mesmo status, de propósito (não expõe se uma lição bloqueada existe).
- **Regra:** `GetLessonUseCase`.

---

### `POST /lessons/:id/progress`

- **Autenticação:** Bearer token.
- **Payload (JSON):** `step` — inteiro, `0`–`3`, e (lição ainda não concluída) só o passo já gravado ou o seguinte — ver `422` abaixo. `selectedOption` — inteiro `>= 0`, opcional (backlog engajamento B.2): índice escolhido pelo usuário no passo Micro-decisão de uma lição com `microDecisionOptions` preenchido (B.1). Ignorado sem erro pra lição sem opções reais (`microDecisionOptions === null`, checkbox "já pensei" de hoje continua valendo).
- **Sucesso:** `200` → `{ currentStep, completed }`, mais os campos abaixo quando aplicável:
  - `microDecisionCorrect`/`correctOptionLabel` — presentes só quando esta chamada envia `selectedOption` válido pra uma lição com `microDecisionOptions` preenchido (correção da revisão da PR 18): `microDecisionCorrect` (`boolean`) é o veredito, `correctOptionLabel` (`string`) é o texto da alternativa certa (não necessariamente a escolhida). Único lugar da API que revela o índice certo, e só depois que o usuário já escolheu — nunca em `GET /lessons`/`GET /lessons/:id` (ver acima).
  - `xpAwarded`, `leveledUp`, `newLevel`, `streakMilestone`, `unlockedAchievements` — **só quando esta chamada é quem conclui a lição pela primeira vez** (campos aditivos, tarefa I.2 do backlog de engajamento — ausentes em qualquer outra resposta, inclusive reabrir uma lição já concluída):
    - `xpAwarded` — sempre `LESSON_XP_REWARD` quando presente.
    - `leveledUp` — `true` se esse crédito de xp cruzou o limiar do próximo nível.
    - `newLevel` — nível após este crédito (tarefa T.10, Fase de mercado realista) — sempre presente junto com `leveledUp`, mesmo quando `false`; consumido pelo frontend pra calcular o salário mensal novo no reveal de level-up sem round-trip extra (`monthlySalaryForLevel`, fórmula duplicada no frontend, fonte real em `backend/src/modules/payroll/domain/salary.ts`).
    - `streakMilestone` — `7`, `30` ou `null`, conforme o streak bateu um desses marcos com este toque (nunca `14` — não existe achievement seedado com esse valor).
    - `unlockedAchievements` — `{ id, name, description }[]`, união das conquistas recém-desbloqueadas pelo crédito de xp e pelo toque de streak (nunca duplicado — uma conquista só entra na lista da primeira chamada que a satisfaz).
- **Erros:**
  - `400` — `step` fora do intervalo `0`–`3`, ou `selectedOption` fora do intervalo de `microDecisionOptions.length` da lição (nunca lançado pra lição sem opções reais — o campo é só ignorado nesse caso).
  - `401` — token ausente ou inválido/expirado.
  - `404` — lição inexistente, ou ainda bloqueada e nunca concluída antes (reabrir uma já concluída sempre é permitido, mesmo que a contagem global não a sustentasse mais desbloqueada).
  - `422` (gate de passos, backlog Fase S tarefa S.4/achado 020; nada é gravado nem creditado) — só pra lição ainda não concluída; reabrir uma concluída (modo revisão) nunca passa por aqui:
    - `{ error, code: 'step_out_of_order' }` — `step` não é o passo já gravado (`currentStep`, `0` se nunca iniciada) nem o seguinte. Pular direto pro passo `3` (que concluía a lição e creditava xp) ou voltar a um passo anterior cai aqui. Reenviar o passo já gravado é permitido (idempotente, ex: trocar a aposta).
    - `{ error, code: 'step_too_fast', retryAfterMs }` — avanço pro passo seguinte antes de `LESSON_MIN_STEP_INTERVAL_MS` (padrão 5000 ms, env de mesmo nome) desde a última gravação de passo (`user_lesson_progress.updated_at`); `retryAfterMs` é quanto falta. O primeiro avanço de uma lição sem progresso gravado nunca espera (não há instante de referência no servidor; o frontend só chama esta rota ao sair do passo 0). Reenviar o passo atual também não espera.
- **Regra:** `AdvanceLessonUseCase`. Grava `currentStep`; ao alcançar o step `3` pela primeira vez, marca `completedAt`, credita `LESSON_XP_REWARD` via `xpAwarder` (com o motivo `licao:<id>` — chave por `lessons.id`, não `code`, desde a tarefa M.6/achado 010: `code` virou mutável, ver seed abaixo), chama `streakTracker.touch` e, se essa conclusão for a última lição pendente da trilha (`completedTrackNumbers` antes/depois da escrita), grava um evento `track_completed` via `socialFeedRecorder` (backlog engajamento G.1 — ver `.docs/backend/socialfeed.md`). `xpAwarder`/`streakTracker` (`lessons/application/ports/`) devolvem o resultado real de `AwardXpUseCase`/`TouchStreakUseCase` desde a I.2 — antes descartado (`Promise<void>`), sem dado nenhum pro "teatro de recompensa" do frontend (`RewardReveal`, I.1) disparar em tempo real. `selectedOption` (B.2), quando presente e dentro do intervalo de opções da lição, é gravado em `user_lesson_progress.micro_decision_selected_option` — via `upsertProgress` quando esta chamada não conclui a lição, ou via `completeIfNotAlreadyCompleted` quando conclui (achado da revisão da PR 18: a versão original só passava o campo pro primeiro caminho, perdendo silenciosamente a escolha de uma chamada que já chega no step de desbloqueio com `selectedOption`). O veredito (`microDecisionCorrect`/`correctOptionLabel`, `domain/lesson.microDecisionResultFor`) vai no corpo desta mesma resposta (ver acima) — nunca no `GET /lessons`/`GET /lessons/:id` (segunda correção da revisão da PR 18: a versão original devolvia o índice certo ali de antemão).

---

### `POST /lessons/:id/review`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ status: 'reviewed', unlockedAchievements: [{ id, name, description }] }`. Idempotente — chamar de novo no mesmo dia só atualiza `lastReviewedAt` de novo, sem efeito colateral extra (nunca credita xp/streak). `unlockedAchievements` (backlog engajamento H.1, critério `lesson_reviewed`) é sempre um array, vazio quando nenhuma conquista nova foi desbloqueada por esta chamada — checado direto aqui porque revisão nunca passa por `xpAwarder`/`streakTracker` (os 2 pontos que checam conquista de carona pra qualquer outro critério). Sem consumidor de "teatro de recompensa" no frontend ainda (`useReviewLesson` é fire-and-forget).
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `404` — lição inexistente.
  - `422` — lição existe mas o usuário nunca a concluiu (`completedAt` nulo) — não há o que revisar.
- **Regra:** `ReviewLessonUseCase` (backlog engajamento H.2/H.1). Só grava `user_lesson_progress.last_reviewed_at = now()` — não mexe em `currentStep`/`completedAt`. Frontend chama isso automaticamente ao reabrir uma lição já concluída (tela 3.2, "modo revisão" — reabrir já pula direto pro passo Desbloqueio, ver `POST /lessons/:id/progress` acima); o reabrir em si já é a "revisão voluntária" que sustenta a missão "revise uma lição antiga" (`.docs/backend/missions.md`) com verificação cruzada de verdade, sem exigir nenhuma ação extra do usuário. O backend, não o frontend, decide se a lição é antiga o bastante pra valer pra missão (`REVIEW_ELIGIBLE_AFTER_DAYS = 14`, `domain/lesson.isEligibleForReview`).

---

## Seed (currículo completo)

`npm run db:seed:lessons` — 35 lições (spec seção 5.1: `0.1`–`0.5`, `1.1`–`1.11`, `2.1`–`2.10`, `3.1`–`3.4`; autoria completa desde a tarefa 7.1, mais `1.3`/`1.9` da M.5). Idempotente via `onConflictDoUpdate`, **não** `onConflictDoNothing` — completar um bloco de autoria novo também atualiza lições já seedadas em sessões anteriores, não só insere as que faltam. `target` do upsert é `lessons.stable_key` (`varchar UNIQUE NOT NULL`, tarefa M.6/achado 010), não `lessons.code`: `stable_key` é atribuído uma vez por lição e nunca mais tocado, mesmo que a posição didática mude — `code` (mutável, reflete só a posição atual no currículo) entra no `set` do upsert desde a M.6. Antes da M.6 o upsert casava por `code`, que nunca entrava no `set`: uma renumeração de `code` (ex: a que a própria M.5 fez em 7 lições) reaproveitava a linha física/`id` existente em vez de criar linha nova, arrastando `user_lesson_progress` de quem já tinha progresso real pra uma lição de conteúdo diferente — corrigido na raiz pela M.6, ver `.claude/pontos-em-aberto-decisao-produto.md` (achado 010, resolvido).

## Verificação cruzada pra outros módulos (sem endpoint HTTP próprio)

`HasCompletedLessonTodayUseCase.execute({ userId })` (tarefa 5.4) — devolve `true` se `user_lesson_progress.completed_at` de qualquer lição do usuário cair no dia calendário de hoje (UTC, `domain/lesson.utcDateString`). Consumida em processo por `modules/missions` (a missão "complete uma lição da trilha" é a única com essa coluna dedicada) via port própria (`LessonCompletionChecker`), mesmo padrão de composição de `xpAwarder`/`streakTracker`.

`HasReviewedOldLessonTodayUseCase.execute({ userId })` (backlog engajamento H.2) — devolve `true` se existir lição concluída há pelo menos `REVIEW_ELIGIBLE_AFTER_DAYS` (14 dias) cujo `last_reviewed_at` cai no dia calendário de hoje (UTC). Consumida em processo por `modules/missions` (missão "revise uma lição antiga", dispatchada por `key` — ver `.docs/backend/missions.md`) via port própria (`LessonReviewChecker`), mesmo padrão da anterior.

`CountCompletedLessonsUseCase.execute({ userId })` (tarefa 5.2) — total de lições concluídas pelo usuário (`completedAt` preenchido), reaproveitando `listProgressForUser` sem método novo no repositório, mesmo padrão da anterior. Consumida em processo por `modules/achievements` (critério `lessons_completed`) dentro do adapter que agrega `ProgressSnapshotReader` — ver `.docs/backend/achievements.md`.

`ExportLessonProgressUseCase.execute({ userId })` (tarefa 5.11, portabilidade RNF04) — progresso completo (`lessonId`/`currentStep`/`completedAt`) de todas as lições do usuário, reaproveitando `listProgressForUser` sem método novo. Consumida em processo por `modules/auth` via port própria (`LessonProgressExporter`).

## Chamada de saída pra outro módulo (direção invertida das acima)

`AdvanceLessonUseCase` (dentro de `POST /lessons/:id/progress`, ver acima) chama `modules/socialfeed` via port própria de `lessons` (`SocialFeedRecorder`, `application/ports/socialFeedRecorder.ts`), implementada em processo sobre `RecordTrackCompletedUseCase` (`infrastructure/socialfeed/inProcessSocialFeedRecorder.ts`) — mesmo mecanismo de composição das ports acima, só que aqui `lessons` é o consumidor, não o provedor. Ver `.docs/backend/socialfeed.md`.
