# `news` — feed de eventos macro (público, RF16)

Módulo: `backend/src/modules/news/`. Ver `.claude/arquitetura-backend-ddd-lite.md` pra entender a divisão em casos de uso — aqui é só o contrato HTTP.

Existe pra desacoplar a tela 5.1 (Feed de Notícias, qualquer usuário autenticado) de `GET /admin/macro-events` (`.docs/backend/admin.md`, tarefa 4.5), que exige `role: 'admin'` — mesmo `ListMacroEventsUseCase`/mesmo formato de resposta, só sem a checagem de role. `modules/news` tem uma port própria (`NewsFeedReader`) implementada por um adapter em processo sobre a instância já existente de `ListMacroEventsUseCase` (mesmo padrão de `modules/profile`/`modules/ranking`) — não há regra de negócio nova, nem tradução de campo (`narrative` já é a versão amigável do evento; `direction`/`magnitude_band` continuam como enums técnicos, decisão desta tarefa: não valia a pena mapear pra Português já que a narrativa cobre isso).

---

### `GET /news`

- **Autenticação:** Bearer token (qualquer usuário autenticado — sem exigência de `role`).
- **Payload (query string):** `limit` (opcional, inteiro 1–100) e `offset` (opcional, inteiro ≥ 0) — mesma validação de `GET /admin/macro-events`.
- **Sucesso:** `200` → `{ events: [...] }`, mesmo formato de item de `GET /admin/macro-events` (id, title, narrative, direction, magnitude_band, affects_price, affects_fundamentals, status, triggered_on_day, duration_days, e os campos de efeito quando aplicável).
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `400` — `limit`/`offset` fora da faixa aceita.
- **Regra:** `ListNewsFeedUseCase` delega inteiramente pra `NewsFeedReader` (porta) → adapter em processo sobre `ListMacroEventsUseCase` (admin) → `MacroEventReader`/`engineMacroEventReader` (`GET /macro-events` no motor). Não expõe nada exclusivo de admin (histórico de gestão, criação de evento) — só leitura do feed.
