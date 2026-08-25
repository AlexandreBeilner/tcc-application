# `gamification` — XP, nível e streak

Módulo: `backend/src/modules/gamification/`. Dono único de XP/nível/streak do sistema — nenhum outro módulo escreve `user_progression` direto; consumidores futuros (missões 5.4, lições 5.6) vão depender de uma port própria mínima (`xpAwarder`/`streakTracker`) implementada, na composição (`app.ts`), por um adapter em processo sobre `AwardXpUseCase`/`TouchStreakUseCase` (ver `.claude/arquitetura-backend-ddd-lite.md`).

---

### `GET /me/progression`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ userId, xp, level, currentStreak, longestStreak, lastQualifyingActivityDate }`. Usuário sem nenhuma atividade ainda (nenhuma linha em `user_progression`) recebe o estado zerado (`xp: 0, level: 1, currentStreak: 0, longestStreak: 0, lastQualifyingActivityDate: null`) — não é erro.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `GetProgressionUseCase`.

---

### `GET /users/:id/progression`

- **Autenticação:** público — nível/XP/streak nunca são o dado protegido por RNF09, só patrimônio absoluto é.
- **Payload:** nenhum.
- **Sucesso:** `200` → mesmo formato de `/me/progression`. `id` inexistente também devolve o estado zerado (o endpoint não valida existência do usuário, só lê `user_progression`).
- **Erros:** nenhum além do padrão do Express.
- **Regra:** `GetProgressionUseCase`, mesmo caso de uso de `/me/progression`.

---

### `GET /me/streak`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ currentStreak, longestStreak }`. Consumido pelo Portfólio (tela 2.1) e Meu Perfil (tela 9.1).
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** sem caso de uso próprio — extrai os dois campos do resultado de `GetProgressionUseCase` (delegação simples, ver `.claude/arquitetura-backend-ddd-lite.md`).

---

## Regra de crédito de XP (sem endpoint HTTP próprio)

`AwardXpUseCase.execute({ userId, amount, reason })` — usada em processo por outros módulos (missões 5.4, lições 5.6), nunca chamada via HTTP direto. Soma `amount` ao xp acumulado, recalcula `level` via `levelForXp(xp)` (nunca incrementado à parte — sustenta saltos de 2+ níveis num crédito grande) e persiste, preservando os campos de streak como estão. `amount <= 0` lança `InvalidXpAmountError`. Curva de nível ilustrativa (sujeita à calibração da tarefa 8.1): `xpRequiredForLevel(L) = 100 * (L-1) * L / 2` — nível 2 aos 100xp, nível 3 aos 300xp, nível 4 aos 600xp. Desde a tarefa 5.2, chama `achievementChecker.checkAndUnlock(userId)` no final — qualquer crédito de xp pode satisfazer um critério de conquista.

## Regra de streak diário (sem endpoint de escrita HTTP próprio)

`TouchStreakUseCase.execute({ userId })` — chamada em processo a partir de qualquer atividade-chave do dia: conclusão de lição (5.6) ou de missão diária (5.4), nunca chamada via HTTP direto (não exige as duas nem todas as missões do dia). Dia calendário fixado em **UTC** (decisão de projeto, não confirmada explicitamente com o usuário). `domain/streak.touch`: mesma data da última atividade → sem mudança (idempotente); dia seguinte consecutivo → `currentStreak += 1`; gap ≥ 2 dias sem atividade → `currentStreak` reseta pra 1 (o próprio dia já conta); `longestStreak` é o máximo histórico, nunca decresce. Preserva xp/nível como estão. Desde a tarefa 5.2, chama `achievementChecker.checkAndUnlock(userId)` no final, mesmo raciocínio de `AwardXpUseCase`.

## Port `achievementChecker` (consumida por este módulo, não fornecida por ele)

Diferente de `xpAwarder`/`streakTracker` (este módulo é o *provedor*), aqui `gamification` é o *consumidor*: `application/ports/achievementChecker.ts` (`{ checkAndUnlock(userId): Promise<void> }`) é implementada, na composição (`app.ts`), por `gamification/infrastructure/achievements/inProcessAchievementChecker.ts` — um adapter fino em processo sobre `CheckAndUnlockAchievementsUseCase` de `modules/achievements` (5.2). Mesmo padrão de composição do resto da semana 5, só a direção da dependência que se inverte.
