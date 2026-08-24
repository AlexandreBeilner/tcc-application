# `lessons` — trilha de aprendizado

Módulo: `backend/src/modules/lessons/`. Sobre `lessons`/`user_lesson_progress` (já existentes desde a tarefa 1.3). Primeiro consumidor real de `modules/gamification` (5.1/5.3) — credita xp e toca o streak via ports próprias (`xpAwarder`/`streakTracker`), implementadas em processo sobre `AwardXpUseCase`/`TouchStreakUseCase` (ver `.claude/arquitetura-backend-ddd-lite.md`).

Regra de desbloqueio: progressão linear por `sortOrder` global — uma lição fica `available` assim que `sortOrder <= completedCount + 1`, onde `completedCount` é o total de lições concluídas pelo usuário (não é por trilha; é isso que faz a última lição de uma trilha desbloquear a primeira da próxima, ex: 0.5 → 1.1). Não modela pré-requisito ramificado/paralelo.

Steps de uma lição (spec 5.2): `0`=cenário, `1`=micro-decisão, `2`=revelação, `3`=desbloqueio. Chegar no step `3` pela primeira vez marca a lição como concluída, credita xp (`LESSON_XP_REWARD`, flat, ilustrativo — sujeito à calibração 8.1) e toca o streak diário. Reenviar o step `3` ou reabrir a lição depois (modo revisão, tela 3.2) nunca credita de novo — idempotente por `completedAt` já preenchido.

---

### `GET /lessons`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ lessons: [{ id, code, title, trackNumber, trackName, sortOrder, centralConcept, unlocksDescription, status, currentStep }] }`, ordenado por `sortOrder`. `status` é `completed`/`available`/`locked`, calculado por usuário.
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

## Seed mínimo (não é o currículo completo)

`npm run db:seed:lessons` (idempotente, `ON CONFLICT (code) DO NOTHING`) — 6 lições reais da spec seção 5.1: `0.1`–`0.5` (Trilha 0 — Fundamentos, completa) + `1.1` (Trilha 1 — Renda Fixa, só a primeira). Suficiente pra exercitar a cadeia de desbloqueio entre trilhas ponta a ponta. Autoria das 33 lições do currículo completo é escopo da semana 7.
