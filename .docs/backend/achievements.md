# `achievements` — conquistas (RF09)

Módulo: `backend/src/modules/achievements/`. Sobre as tabelas `achievements`/`user_achievements` (Figura 10 do DER, já existentes desde 1.3). Nesta tarefa, `achievements.required_points` (int único, sem consumidor de código — confirmado por grep) foi substituído por `criteria_type` (enum `achievement_criteria_type`: `net_worth`, `streak_days`, `lessons_completed`, `trades_executed`) + `criteria_value numeric(15,2)` — trocado direto, sem migração em duas etapas, porque a coluna antiga nunca teve consumidor (`0004_lush_maria_hill.sql`).

**Backlog engajamento H.1** estendeu o enum com 3 critérios de qualidade (não só volume): `micro_decisions_streak`, `track_completed_no_errors`, `lesson_reviewed` — migration `0014` (`ALTER TYPE ... ADD VALUE`, 3 statements). Cuidado técnico já satisfeito pela arquitetura existente, sem precisar de nada novo: `ALTER TYPE ... ADD VALUE` não pode rodar na mesma transação que um `INSERT` usando o valor novo, mas migração (`runMigrations`, rodada no boot do `server.ts`) e seed de conquistas (`npm run db:seed:achievements`) já são 2 processos totalmente separados neste projeto — nunca uma transação só.

Desbloqueio é sempre automático, nunca por rota — `CheckAndUnlockAchievementsUseCase` é chamada em processo (nunca por polling) de dentro de `AwardXpUseCase`/`TouchStreakUseCase` (`modules/gamification`, ver `.docs/backend/gamification.md`, seção "Port `achievementChecker`") depois de qualquer crédito de xp ou toque de streak — cobre indiretamente conclusão de lição e de missão, já que as duas sempre passam por um dos dois.

`ProgressSnapshotReader` (`application/ports/progressSnapshotReader.ts`) agrega os números que qualquer critério pode consultar, num único adapter em processo (`infrastructure/aggregation/inProcessProgressSnapshotReader.ts`) que combina 3 módulos:
- `streakDays` — `GetProgressionUseCase` (`gamification`, 5.3).
- `lessonsCompleted` — `CountCompletedLessonsUseCase` (`lessons`, novo nesta tarefa, mesmo padrão de `HasCompletedLessonTodayUseCase`, 5.4 — reaproveita `listProgressForUser`, nenhum método novo no repositório).
- `netWorth`/`tradesExecuted` — `GetNetWorthUseCase` (`ranking`, 5.5), chamado com **`asOf: new Date()` explícito, nunca `asOf: undefined`**. Decisão desta sessão, divergente do texto original do backlog (que previa `asOf: undefined`): o caminho "agora" de `GetNetWorthUseCase` (`CurrentAccountStateReader`) não recomputa `tradesExecuted` (fica sempre 0, ver comentário em `getNetWorth.ts` deixado pela própria 5.5 já prevendo este consumidor) — só o caminho de replay, forçado por um `asOf` explícito, preenche esse número. Sem essa correção, "Primeira Operação"/"Trader Ativo" nunca desbloqueariam.
- `microDecisionsStreak`/`tracksCompletedNoErrors`/`lessonsReviewed` (H.1) — 3 leituras a mais de `lessons` (`GetCurrentMicroDecisionStreakUseCase`/`GetTracksCompletedWithoutErrorsCountUseCase`/`CountReviewedLessonsUseCase`), cada uma sua própria porta-por-consumidor, nenhuma reaproveita a outra. Todas juntam `listAll()` + `listProgressForUser()` em processo — nenhum método novo no repositório de `lessons`. `lessonsReviewed` conta lições **distintas** já revisadas ao menos uma vez, não o total de revisões: `user_lesson_progress.last_reviewed_at` (H.2) é sobrescrito a cada nova revisão da mesma lição, não acumulado.

---

### `GET /achievements`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ achievements: [{ id, name, description, criteriaType, criteriaValue, unlocked, unlockedAt, progress }] }`. `progress` é o valor atual do usuário pro critério da conquista (ex: streak atual pra uma conquista `streak_days`), presente mesmo em conquistas bloqueadas — sustenta "streak 3/7 dias" (tela 7.2). Sem rota de desbloqueio manual.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `ListAchievementsUseCase`.

---

## Verificação cruzada pra outros módulos (sem endpoint HTTP próprio)

`ExportUnlockedAchievementsUseCase.execute({ userId })` (tarefa 5.11, portabilidade RNF04) — reaproveita `listUnlockedForUser` direto (dump de `user_achievements`, sem juntar com o catálogo). Consumida em processo por `modules/auth` via port própria (`AchievementsExporter`).

## Seed mínimo (não é o currículo completo de conteúdo)

`npm run db:seed:achievements` (idempotente por nome) — 11 conquistas ilustrativas cobrindo os 7 critérios (spec, tela 7.2): "Primeira Semana"/"Fiel" (`streak_days` 7/30), "Estudioso"/"Formado na Trilha" (`lessons_completed` 10/33), "Primeiro Patrimônio"/"Grande Investidor" (`net_worth` 12000/25000), "Primeira Operação"/"Trader Ativo" (`trades_executed` 1/20), "Olho Clínico" (`micro_decisions_streak` 5), "Trilha Impecável" (`track_completed_no_errors` 1), "Voltou pra Revisar" (`lesson_reviewed` 1) — valores ilustrativos, sujeitos à calibração/autoria de conteúdo da semana 7/8.1, mesmo precedente de `macroevent.Templates` (4.3) e `MISSION_SEEDS` (5.4).
