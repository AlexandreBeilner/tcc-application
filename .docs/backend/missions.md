# `missions` — missões diárias (RF22)

Módulo: `backend/src/modules/missions/`. Sobre `daily_missions`/`user_mission_progress` (já existentes desde 1.3; `daily_missions` ganhou a coluna `requires_lesson_completion` nesta tarefa). Segundo consumidor real das ports `xpAwarder`/`streakTracker` (o primeiro foi `lessons`, 5.6) — adapters em processo sobre `AwardXpUseCase`/`TouchStreakUseCase`, mesmo padrão de composição.

Catálogo (3 missões da spec 6.1 + 2 do backlog engajamento H.2/H.3, seed em `npm run db:seed:missions`, idempotente por `key` desde a tarefa 6.6.4 — antes era por `title`): três têm verificação cruzada real contra `modules/lessons` — **"Complete uma lição da trilha"** (`key: 'lesson_complete'`, `requires_lesson_completion = true`), **"Revise uma lição concluída há mais de 14 dias"** (`key: 'review_old_lesson'`, H.2) e **"Acerte 3 apostas seguidas hoje"** (`key: 'micro_decision_streak_today'`, H.3) — as outras duas (`calculator_compare`: "Compare dois produtos de renda fixa na calculadora"; `feed_read`: "Consulte o feed de notícias") aceitam o relato do cliente sem checagem no backend (calculadora e feed não têm estado persistido nesta fase).

**`review_old_lesson`/`micro_decision_streak_today` são dispatchadas por `key`, não por coluna própria** (diferente de `lesson_complete`): só essas 2 missões precisam de uma segunda verificação cruzada nesta fase, então `CompleteMissionUseCase` compara `mission.key === REVIEW_OLD_LESSON_MISSION_KEY`/`MICRO_DECISION_STREAK_MISSION_KEY` (constantes em `domain/mission.ts`) em vez de justificar uma coluna boolean a mais em `daily_missions` (ver `requiresLessonCompletion` abaixo). Nunca penalizam — somem da lista de missões do dia se não forem feitas, sem tirar xp nem estragar streak (mesmo tratamento de qualquer missão pendente); sempre visíveis mesmo pra quem ainda não tem nenhuma lição elegível, mesmo padrão das outras 3 (`calculator_compare` já aparece antes da calculadora ser desbloqueada).

**`micro_decision_streak_today` (H.3) reaproveita a mesma sequência de acertos do critério `micro_decisions_streak` da conquista "Olho Clínico" (H.1, `.docs/backend/achievements.md`)**, limitada aos attempts concluídos no dia corrente (UTC) — `HasMicroDecisionStreakTodayUseCase` (`modules/lessons`) filtra por dia antes de aplicar `currentMicroDecisionStreak`, então um erro em qualquer ponto do dia zera a sequência dali pra frente e nada de ontem carrega pra hoje. Limiar fixo `MICRO_DECISION_MISSION_STREAK_THRESHOLD = 3` (`domain/lesson.ts`), sem coluna própria em `daily_missions`. **Achado não resolvido nesta tarefa, pré-existente desde a H.2:** nenhuma tela do frontend chama `POST /missions/:id/complete` pras 3 missões com verificação cruzada real (`lesson_complete`/`review_old_lesson`/`micro_decision_streak_today`) — só `calculator_compare`/`feed_read` têm um hook que auto-reporta (`useReportCalculatorComparisonMission`/`useReportFeedMission`). O claim dessas 3 só acontece via chamada direta à API hoje; falta um gatilho equivalente em `Lesson`/Trilha, mas isso não é escopo desta tarefa nem foi introduzido por ela.

**`key` (tarefa 6.6.4, migration `0007_add_mission_key.sql`):** slug estável (`varchar(50)`, único, ex: `'feed_read'`) — existe pra código cliente achar uma missão específica no catálogo sem depender de `title` (texto livre, pode mudar por correção/tradução) nem de `completionCriteria` (idêntico entre `calculator_compare`/`feed_read`: `"Reportado pelo cliente — sem verificação cruzada nesta fase"`). `frontend/src/features/news/useReportFeedMission` casa por `key === 'feed_read'`.

---

### `GET /missions`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ missions: [{ id, key, title, description, completionCriteria, xpReward, requiresLessonCompletion, status }] }`. `status` é `pending`/`completed`, calculado por usuário e por dia (UTC). Gera a linha `pending` de hoje sob demanda, no primeiro `GET` do dia — não existe job de meia-noite. **Só as missões ativas** (N.19): uma missão desativada pelo painel (`daily_missions.is_active = false`) não é sorteada pro dia, nem ganha linha de progresso nova, nem aparece aqui; reativar a devolve.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `ListDailyMissionsUseCase`.

---

### `POST /missions/:id/complete`

- **Autenticação:** Bearer token.
- **Payload:** nenhum (conclusão é auto-reportada pelo cliente, exceto na verificação cruzada abaixo).
- **Sucesso:** `200` → `{ status: 'completed' }`, mais `xpAwarded`, `leveledUp`, `newLevel`, `streakMilestone`, `unlockedAchievements` **só na chamada que de fato credita xp** (campos aditivos, tarefa I.2 do backlog de engajamento — ausentes em qualquer resposta idempotente, ver abaixo):
  - `xpAwarded` — sempre `mission.xpReward` quando presente.
  - `leveledUp` — `true` se esse crédito cruzou o limiar do próximo nível.
  - `newLevel` — nível após este crédito (tarefa T.10, Fase de mercado realista) — sempre presente junto com `leveledUp`, mesmo quando `false`; consumido pelo frontend pra calcular o salário mensal novo no reveal de level-up sem round-trip extra (`monthlySalaryForLevel`, fórmula duplicada no frontend, fonte real em `backend/src/modules/payroll/domain/salary.ts`).
  - `streakMilestone` — `7`, `30` ou `null`.
  - `unlockedAchievements` — `{ id, name, description }[]`, união das conquistas recém-desbloqueadas pelo crédito de xp e pelo toque de streak.

  Idempotente — reenviar depois de já concluída no dia não credita xp/streak de novo, apenas confirma o status (resposta só com `{ status: 'completed' }`, sem os 5 campos acima). Idempotência garantida por transição atômica no banco (`markCompleted`, UPSERT com `ON CONFLICT ... DO UPDATE ... WHERE status = 'pending' RETURNING`), não só pela leitura prévia de `findProgress` — duas requisições concorrentes pra mesma missão/dia (rede duplicando a chamada, ou alguém automatizando chamadas deliberadas pro endpoint) só creditam xp uma vez: o Postgres serializa via lock de linha, e só quem de fato transiciona `pending → completed` credita (e só esse quem recebe os 5 campos de volta).
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `404` — missão inexistente no catálogo, **ou desativada pelo painel** (N.19): nada é creditado. Quem já concluiu a missão antes de ela ser desativada mantém o XP e o streak.
  - `422` — missão com `requiresLessonCompletion = true` sem nenhuma lição concluída no dia (UTC), **ou** missão `review_old_lesson` sem nenhuma lição antiga (>14 dias) revisada hoje, **ou** missão `micro_decision_streak_today` sem 3 acertos seguidos hoje na Micro-decisão.
- **Regra:** `CompleteMissionUseCase`. Marca `completed`, credita `xpReward` via `xpAwarder` (motivo `missao:<id>`) e chama `streakTracker.touch` — conclusão de **qualquer** missão já mantém o streak (decisão da 5.3, não exige todas as missões do dia). `xpAwarder`/`streakTracker` (`missions/application/ports/`) devolvem o resultado real desde a I.2, mesma mudança de `.docs/backend/lessons.md`.

---

## Catálogo operável pelo painel (N.19)

`daily_missions.is_active` (migration `0021`, default `true`: tudo que já existe nasce ativo). O painel (`GET/PATCH /admin/gamification/missions`, `.docs/backend/admin.md`) edita título, descrição e XP (inteiro de 1 a 500) e liga/desliga; **não cria missão nova nem muda o tipo de conferência**, porque cada tipo (`lesson_completion`, `server_check`, `client_reported`) é código, e uma missão nova sem conferência seria XP de graça. `MissionRepository.listCatalog()` devolve só as ativas (é o conjunto do qual o dia é montado); `listAll()` traz todas, só pro painel. O seed (`db:seed:missions`) continua só inserindo por `key`, então não desfaz uma edição do painel.

---

## Verificação cruzada das missões de lição

`HasCompletedLessonTodayUseCase` (`modules/lessons`, consumida em processo via `LessonCompletionChecker`, port própria de `missions`) — verifica se `user_lesson_progress.completed_at` de qualquer lição do usuário cai no dia calendário de hoje (UTC), reaproveitando `listProgressForUser` (nenhum método novo no repositório de lições).

`HasReviewedOldLessonTodayUseCase` (`modules/lessons`, H.2, consumida em processo via `LessonReviewChecker`, port própria de `missions`) — verifica se existe lição concluída há pelo menos 14 dias cujo `last_reviewed_at` cai no dia calendário de hoje (UTC). `last_reviewed_at` é gravado por `POST /lessons/:id/review` (`.docs/backend/lessons.md`), chamado automaticamente pelo frontend ao reabrir qualquer lição já concluída — a missão em si só decide se essa revisão "vale" (lição antiga o bastante), o reabrir não muda.

`HasMicroDecisionStreakTodayUseCase` (`modules/lessons`, H.3, consumida em processo via `MicroDecisionStreakChecker`, port própria de `missions`) — junta lição+progresso (`buildMicroDecisionAttemptsChronological`, domínio compartilhado com `GetCurrentMicroDecisionStreakUseCase` de H.1), filtra pro dia corrente (UTC) e aplica `currentMicroDecisionStreak`, comparando contra `MICRO_DECISION_MISSION_STREAK_THRESHOLD` (3).

## Verificação cruzada pra outros módulos (sem endpoint HTTP próprio)

`ExportMissionProgressUseCase.execute({ userId })` (tarefa 5.11, portabilidade RNF04) — todo o histórico de `user_mission_progress` do usuário, qualquer data (diferente de `ListDailyMissionsUseCase`, que só lê o dia corrente). Único caso desta tarefa que exigiu um método novo no repositório (`listAllProgressForUser`) — nenhum caso de uso existente devolvia o histórico completo. Consumida em processo por `modules/auth` via port própria (`MissionProgressExporter`), mesmo padrão de composição de `xpAwarder`/`streakTracker`.
