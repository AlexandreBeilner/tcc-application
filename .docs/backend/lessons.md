# `lessons` — trilha de aprendizado

Módulo: `backend/src/modules/lessons/`. Sobre `lessons`/`user_lesson_progress` (já existentes desde a tarefa 1.3). Primeiro consumidor real de `modules/gamification` (5.1/5.3) — credita xp e toca o streak via ports próprias (`xpAwarder`/`streakTracker`), implementadas em processo sobre `AwardXpUseCase`/`TouchStreakUseCase` (ver `.claude/arquitetura-backend-ddd-lite.md`).

Regra de desbloqueio: progressão linear por `sortOrder` global — uma lição fica `available` assim que `sortOrder <= completedCount + 1`, onde `completedCount` é o total de lições concluídas pelo usuário (não é por trilha; é isso que faz a última lição de uma trilha desbloquear a primeira da próxima, ex: 0.5 → 1.1). Não modela pré-requisito ramificado/paralelo.

Steps de uma lição (spec 5.2): `0`=cenário, `1`=micro-decisão, `2`=revelação, `3`=desbloqueio. Chegar no step `3` pela primeira vez marca a lição como concluída, credita xp (`LESSON_XP_REWARD`, flat, ilustrativo — sujeito à calibração 8.1) e toca o streak diário. Reenviar o step `3` ou reabrir a lição depois (modo revisão, tela 3.2) nunca credita de novo — idempotente por `completedAt` já preenchido.

Desbloqueio real de funcionalidade/produto (tarefa 7.0.1, diferente da progressão lição-a-lição acima): `unlocksKeys` (vocabulário fixo — `portfolio`, `calculator`, `news_feed` ou `asset:<AssetType>`) some lição-a-lição pra formar o conjunto de chaves desbloqueadas de um usuário — `unlockedKeysFor(completedCount, lessons)`, união de `unlocksKeys` de toda lição com `sortOrder <= completedCount` (a lição precisa estar **concluída**, não só disponível). Consumido de dois jeitos: (a) `modules/market` (`ProductUnlockReader`, ver `.docs/backend/market.md`) nega `POST /market/orders`/`fixed-income/purchases` de ativo real ainda travado; (b) frontend espelha a mesma função em TS puro (`features/lessons/unlockedKeys.ts`) a partir do `unlocksKeys` que `GET /lessons` já devolve por lição — sem endpoint novo.

Conteúdo pedagógico real por passo (tarefa 7.0.2, migration `0010`): `scenarioText`/`microDecisionPrompt`/`revelationText` (`text NOT NULL DEFAULT ''`) sustentam os passos Cenário/Micro-decisão/Revelação da tela 3.2 (antes desta tarefa, a tela reaproveitava `centralConcept` idêntico nos 3). `microDecisionType` (`pgEnum` — `reflection`/`growth_calculator`/`fixed_income_comparison`/`live_indicator`, default `reflection`) escolhe o widget do passo Micro-decisão no frontend; `microDecisionAssetTicker` (nullable) só é usado quando o tipo é `live_indicator` — a Revelação busca o indicador ao vivo desse ticker via `GET /market/assets/:id` (resolvido antes por `GET /market/assets`, sem endpoint novo). `unlocksAssetTicker` (nullable) é preenchido só nas lições cujo `unlocksKeys` inclui um `asset:*` — ticker canônico real do produto recém-desbloqueado, usado pelo botão "Comprar agora" do passo Desbloqueio (deep-link pro Detalhe de Ativo real). Lições ainda não autoradas (autoria é a tarefa 7.1) ficam com os 3 campos de texto vazios e `microDecisionType`/`unlocksAssetTicker` no default — estado de transição esperado, não bug.

---

### `GET /lessons`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ lessons: [{ id, code, title, trackNumber, trackName, sortOrder, centralConcept, scenarioText, microDecisionPrompt, microDecisionType, microDecisionAssetTicker, revelationText, unlocksDescription, unlocksKeys, unlocksAssetTicker, status, currentStep }] }`, ordenado por `sortOrder`. `status` é `completed`/`available`/`locked`, calculado por usuário. `unlocksKeys` (tarefa 7.0.1) é `string[]` — normalmente `[]`, só preenchido nas lições que desbloqueiam feature/produto de verdade (ver acima). `scenarioText`/`microDecisionPrompt`/`revelationText`/`microDecisionType`/`microDecisionAssetTicker`/`unlocksAssetTicker` (tarefa 7.0.2) sustentam o conteúdo pedagógico real por passo (ver acima) — os 3 campos de texto podem vir vazios pra lição ainda não autorada.
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
- **Payload (JSON):** `step` — inteiro, `0`–`3`.
- **Sucesso:** `200` → `{ currentStep, completed }`.
- **Erros:**
  - `400` — `step` fora do intervalo `0`–`3`.
  - `401` — token ausente ou inválido/expirado.
  - `404` — lição inexistente, ou ainda bloqueada e nunca concluída antes (reabrir uma já concluída sempre é permitido, mesmo que a contagem global não a sustentasse mais desbloqueada).
- **Regra:** `AdvanceLessonUseCase`. Grava `currentStep`; ao alcançar o step `3` pela primeira vez, marca `completedAt`, credita `LESSON_XP_REWARD` via `xpAwarder` (com o motivo `licao:<code>`) e chama `streakTracker.touch`.

---

### `POST /lessons/:id/review`

- **Autenticação:** Bearer token.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ status: 'reviewed' }`. Idempotente — chamar de novo no mesmo dia só atualiza `lastReviewedAt` de novo, sem efeito colateral extra (nunca credita xp/streak).
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `404` — lição inexistente.
  - `422` — lição existe mas o usuário nunca a concluiu (`completedAt` nulo) — não há o que revisar.
- **Regra:** `ReviewLessonUseCase` (backlog engajamento H.2). Só grava `user_lesson_progress.last_reviewed_at = now()` — não mexe em `currentStep`/`completedAt`. Frontend chama isso automaticamente ao reabrir uma lição já concluída (tela 3.2, "modo revisão" — reabrir já pula direto pro passo Desbloqueio, ver `POST /lessons/:id/progress` acima); o reabrir em si já é a "revisão voluntária" que sustenta a missão "revise uma lição antiga" (`.docs/backend/missions.md`) com verificação cruzada de verdade, sem exigir nenhuma ação extra do usuário. O backend, não o frontend, decide se a lição é antiga o bastante pra valer pra missão (`REVIEW_ELIGIBLE_AFTER_DAYS = 14`, `domain/lesson.isEligibleForReview`).

---

## Seed mínimo (não é o currículo completo)

`npm run db:seed:lessons` (idempotente, `ON CONFLICT (code) DO NOTHING`) — 7 lições reais da spec seção 5.1: `0.1`–`0.5` (Trilha 0: Fundamentos, completa) + `1.1`/`1.2` (Trilha 1: Renda Fixa, só as duas primeiras). `0.1`–`1.1` ainda ficam com `scenarioText`/`microDecisionPrompt`/`revelationText` vazios (autoria real é a tarefa 7.1); `1.2` (Tesouro Selic) é exceção deliberada da tarefa 7.0.2 — conteúdo pedagógico completo (`microDecisionType = 'reflection'`, `unlocksKeys = ['asset:tesouro_selic']`, `unlocksAssetTicker = 'LFT2029'`), escrito pra provar o pipeline schema→API→tela ponta a ponta (inclusive o botão "Comprar agora") antes da 7.1.2 autorar `1.3`–`1.9` em massa. Suficiente pra exercitar a cadeia de desbloqueio entre trilhas ponta a ponta. Autoria das 33 lições do currículo completo é escopo da semana 7.

## Verificação cruzada pra outros módulos (sem endpoint HTTP próprio)

`HasCompletedLessonTodayUseCase.execute({ userId })` (tarefa 5.4) — devolve `true` se `user_lesson_progress.completed_at` de qualquer lição do usuário cair no dia calendário de hoje (UTC, `domain/lesson.utcDateString`). Consumida em processo por `modules/missions` (a missão "complete uma lição da trilha" é a única com essa coluna dedicada) via port própria (`LessonCompletionChecker`), mesmo padrão de composição de `xpAwarder`/`streakTracker`.

`HasReviewedOldLessonTodayUseCase.execute({ userId })` (backlog engajamento H.2) — devolve `true` se existir lição concluída há pelo menos `REVIEW_ELIGIBLE_AFTER_DAYS` (14 dias) cujo `last_reviewed_at` cai no dia calendário de hoje (UTC). Consumida em processo por `modules/missions` (missão "revise uma lição antiga", dispatchada por `key` — ver `.docs/backend/missions.md`) via port própria (`LessonReviewChecker`), mesmo padrão da anterior.

`CountCompletedLessonsUseCase.execute({ userId })` (tarefa 5.2) — total de lições concluídas pelo usuário (`completedAt` preenchido), reaproveitando `listProgressForUser` sem método novo no repositório, mesmo padrão da anterior. Consumida em processo por `modules/achievements` (critério `lessons_completed`) dentro do adapter que agrega `ProgressSnapshotReader` — ver `.docs/backend/achievements.md`.

`ExportLessonProgressUseCase.execute({ userId })` (tarefa 5.11, portabilidade RNF04) — progresso completo (`lessonId`/`currentStep`/`completedAt`) de todas as lições do usuário, reaproveitando `listProgressForUser` sem método novo. Consumida em processo por `modules/auth` via port própria (`LessonProgressExporter`).
