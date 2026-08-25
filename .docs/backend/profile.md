# `profile` — perfil público de usuário (RF20)

Módulo: `backend/src/modules/profile/`. Achado da sessão 5.10 — RF20 ("O sistema deve exibir o perfil público de outro usuário mostrando rentabilidade percentual, nível e conquistas, nunca o valor absoluto de patrimônio") nunca tinha ganhado composição própria: cada peça existia solta em `gamification` (5.1/5.3), `achievements` (5.2) e `ranking` (5.5). Só camada de composição — sem `domain/` próprio além de `UserNotFoundError` (mesmo caso mínimo de `modules/admin`).

**RNF09 é estrutural aqui, não um campo omitido:** `GetPublicProfileUseCase` nunca consulta saldo/patrimônio absoluto em nenhum ponto do caminho — o valor não existe no código do caso de uso. Consome 3 ports próprias e mínimas (mesmo padrão de composição do resto da semana): `GamificationReader` (adapter sobre `GetProgressionUseCase`, 5.1/5.3), `AchievementsReader` (adapter sobre `ListAchievementsUseCase`, 5.2, filtrando só as desbloqueadas), `ProfitabilityReader` (adapter sobre `NetWorthReader`/`SandboxAssetReader` de `ranking`, 5.5, que devolve só o percentual — `total`/`cash` nunca atravessam essa fronteira). `UserDirectory` própria do módulo (leitura direta de `users`, mesmo padrão de `ranking`/`friendships`).

`ProfitabilityReader`'s adapter (`infrastructure/ranking/inProcessProfitabilityReader.ts`) duplica a lógica de baseline de `GetRankingUseCase` (`max(windowStart, user.createdAt)`, RNF06) em vez de reaproveitar `GetRankingUseCase` inteiro — decisão desta sessão: extrair 1 usuário do ranking completo recalcularia patrimônio de todo mundo à toa.

---

### `GET /users/:id/profile`

- **Autenticação:** Bearer token (qualquer usuário autenticado) — perfil é público entre usuários logados, não exposto sem autenticação nesta fase.
- **Payload (query):** `window` — `week`|`month`, opcional, default `week` (RF20 não especifica; mesma decisão de escopo não confirmada explicitamente já usada em outros pontos da semana).
- **Sucesso:** `200` → `{ profile: { username, level, xp, currentStreak, achievements: [{ id, name, description, unlockedAt }], profitabilityPct, window } }`. `achievements` só as desbloqueadas (RF20 não pede progresso das bloqueadas — isso é `GET /achievements`, tela 7.2, não 8.4).
- **Erros:**
  - `400` — `window` fora de `week`/`month`.
  - `401` — token ausente ou inválido/expirado.
  - `404` — `id` inexistente.
- **Regra:** `GetPublicProfileUseCase`.

---

### `GET /me/profile`

- **Autenticação:** Bearer token.
- **Payload (query):** `window`, mesmo formato de `/users/:id/profile`.
- **Sucesso:** `200` → mesmo formato de `/users/:id/profile`, pro próprio usuário. Tela 9.1 "Meu Perfil" combina esta resposta com `GET /auth/me` (dados de identidade — e-mail etc., já existente desde 1.4) no frontend.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `GetPublicProfileUseCase`, mesmo caso de uso de `/users/:id/profile` — `userId` vem de `req.auth.userId`, nunca falha por "usuário não encontrado" (o próprio token já garante que existe).
