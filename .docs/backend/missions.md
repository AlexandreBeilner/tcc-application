# `missions` — missões diárias (RF22)

Módulo: `backend/src/modules/missions/`. Sobre `daily_missions`/`user_mission_progress` (já existentes desde 1.3; `daily_missions` ganhou a coluna `requires_lesson_completion` nesta tarefa). Segundo consumidor real das ports `xpAwarder`/`streakTracker` (o primeiro foi `lessons`, 5.6) — adapters em processo sobre `AwardXpUseCase`/`TouchStreakUseCase`, mesmo padrão de composição.

Catálogo (3 missões da spec 6.1, seed em `npm run db:seed:missions`, idempotente por título): apenas **"Complete uma lição da trilha"** tem verificação cruzada real, contra `modules/lessons` (`requires_lesson_completion = true`) — as outras duas ("Compare dois produtos de renda fixa na calculadora", "Consulte o feed de notícias") aceitam o relato do cliente sem checagem no backend (calculadora e feed não têm estado persistido nesta fase).

---

### `GET /missions`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ missions: [{ id, title, description, completionCriteria, xpReward, requiresLessonCompletion, status }] }`. `status` é `pending`/`completed`, calculado por usuário e por dia (UTC). Gera a linha `pending` de hoje sob demanda, no primeiro `GET` do dia — não existe job de meia-noite.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `ListDailyMissionsUseCase`.

---

### `POST /missions/:id/complete`

- **Autenticação:** Bearer token.
- **Payload:** nenhum (conclusão é auto-reportada pelo cliente, exceto na verificação cruzada abaixo).
- **Sucesso:** `200` → `{ status: 'completed' }`. Idempotente — reenviar depois de já concluída no dia não credita xp/streak de novo, apenas confirma o status.
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `404` — missão inexistente no catálogo.
  - `422` — missão com `requiresLessonCompletion = true` sem nenhuma lição concluída no dia (UTC).
- **Regra:** `CompleteMissionUseCase`. Marca `completed`, credita `xpReward` via `xpAwarder` (motivo `missao:<id>`) e chama `streakTracker.touch` — conclusão de **qualquer** missão já mantém o streak (decisão da 5.3, não exige todas as missões do dia).

---

## Verificação cruzada da missão de lição

`HasCompletedLessonTodayUseCase` (`modules/lessons`, consumida em processo via `LessonCompletionChecker`, port própria de `missions`) — verifica se `user_lesson_progress.completed_at` de qualquer lição do usuário cai no dia calendário de hoje (UTC), reaproveitando `listProgressForUser` (nenhum método novo no repositório de lições).
