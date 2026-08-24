# `gamification` — XP e nível

Módulo: `backend/src/modules/gamification/`. Dono único de XP/nível do sistema — nenhum outro módulo escreve `user_progression` direto; consumidores futuros (missões, lições) vão depender de uma port própria mínima (`xpAwarder`) implementada, na composição (`app.ts`), por um adapter em processo sobre `AwardXpUseCase` (ver `.claude/arquitetura-backend-ddd-lite.md`).

---

### `GET /me/progression`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ userId, xp, level }`. Usuário sem nenhum crédito de xp ainda (nenhuma linha em `user_progression`) recebe `{ xp: 0, level: 1 }` — não é erro.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `GetProgressionUseCase`.

---

### `GET /users/:id/progression`

- **Autenticação:** público — nível/XP nunca são o dado protegido por RNF09, só patrimônio absoluto é.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ userId, xp, level }`, mesmo formato de `/me/progression`. `id` inexistente também devolve `{ xp: 0, level: 1 }` (o endpoint não valida existência do usuário, só lê `user_progression`).
- **Erros:** nenhum além do padrão do Express.
- **Regra:** `GetProgressionUseCase`, mesmo caso de uso de `/me/progression`.

---

## Regra de crédito de XP (sem endpoint HTTP próprio)

`AwardXpUseCase.execute({ userId, amount, reason })` — usada em processo por outros módulos (missões 5.4, lições 5.6), nunca chamada via HTTP direto. Soma `amount` ao xp acumulado, recalcula `level` via `levelForXp(xp)` (nunca incrementado à parte — sustenta saltos de 2+ níveis num crédito grande) e persiste. `amount <= 0` lança `InvalidXpAmountError`. Curva de nível ilustrativa (sujeita à calibração da tarefa 8.1): `xpRequiredForLevel(L) = 100 * (L-1) * L / 2` — nível 2 aos 100xp, nível 3 aos 300xp, nível 4 aos 600xp.
