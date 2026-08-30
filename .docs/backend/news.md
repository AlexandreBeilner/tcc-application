# `news` — feed de eventos macro (público, RF16)

Módulo: `backend/src/modules/news/`. Ver `.claude/arquitetura-backend-ddd-lite.md` pra entender a divisão em casos de uso — aqui é só o contrato HTTP.

Existe pra desacoplar a tela 5.1 (Feed de Notícias, qualquer usuário autenticado) de `GET /admin/macro-events` (`.docs/backend/admin.md`, tarefa 4.5), que exige `role: 'admin'` — mesmo `ListMacroEventsUseCase`/mesmo formato de resposta, só sem a checagem de role. `modules/news` tem uma port própria (`NewsFeedReader`) implementada por um adapter em processo sobre a instância já existente de `ListMacroEventsUseCase` (mesmo padrão de `modules/profile`/`modules/ranking`) — não há regra de negócio nova, nem tradução de campo (`narrative` já é a versão amigável do evento; `direction`/`magnitude_band` continuam como enums técnicos, decisão desta tarefa: não valia a pena mapear pra Português já que a narrativa cobre isso).

**Tarefa 6.6.2** deu ao módulo sua primeira tabela própria (`news_event_reads`: `user_id`, `macro_event_id`, `read_at`, banco "gamification" — `macro_event_id` é um uuid solto do banco "market", dono é o motor, sem FK real) — rastreio de "visto" persistido por usuário, substituindo a granularidade só-agregada do sino da TopBar (`NewsBell`/`useUnreadNews`, ainda 100% client-side/`localStorage`, sem mudança nesta tarefa — os dois mecanismos coexistem, propósitos diferentes).

---

### `GET /news`

- **Autenticação:** Bearer token (qualquer usuário autenticado — sem exigência de `role`).
- **Payload (query string):** `limit` (opcional, inteiro 1–100) e `offset` (opcional, inteiro ≥ 0) — mesma validação de `GET /admin/macro-events`.
- **Sucesso:** `200` → `{ events: [...] }`, mesmo formato de item de `GET /admin/macro-events` (id, title, narrative, direction, magnitude_band, affects_price, affects_fundamentals, status, triggered_on_day, duration_days, os campos de efeito quando aplicável, `targets` — array de `{ sector? | risk_class? | asset_id? }`, exatamente um preenchido por item, usado pela tela 5.1/Feed de Notícias, tarefa 6.6, pra linkar o evento pro ativo/empresa afetado — `created_at`, timestamp real de criação do evento, tarefa 6.6.1, RFC 3339, diferente de `triggered_on_day` que é o dia **simulado** — e `seen`, booleano novo da tarefa 6.6.2: `true` se o usuário autenticado do token já marcou aquele evento como visto, `false` caso contrário). **Diferente de `GET /admin/macro-events`** (tarefa 6.6.3): enquanto `status = pendente`, `direction`/`magnitude_band` vêm como string vazia (`''`), `price_effect_pct`/`fundamentals_effect_pct` vêm ausentes e `targets` vem `[]` — só quando `status = aplicado` o item traz esses campos de verdade. Existe pra que a API não vaze o veredito do evento (o mesmo que `NewsEventList`, frontend, já deixa de renderizar) pra quem inspecionar a resposta diretamente.
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
  - `400` — `limit`/`offset` fora da faixa aceita.
- **Regra:** `ListNewsFeedUseCase` busca a página crua via `NewsFeedReader` (porta) → adapter em processo sobre `ListMacroEventsUseCase` (admin) → `MacroEventReader`/`engineMacroEventReader` (`GET /macro-events` no motor) — igual antes da 6.6.2. Em seguida redige os itens ainda `pendente` (`redactPending`, função pura em `domain/`, tarefa 6.6.3) e cruza os ids da página com `NewsReadRepository.listSeenEventIds` (só os ids da página atual, nunca o histórico inteiro do usuário), decorando cada item com `seen` (`decorateWithSeen`, função pura em `domain/`). Não expõe nada exclusivo de admin (histórico de gestão, criação de evento) — só leitura do feed.

### `POST /news/:id/seen`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum — `:id` na URL é o `id` do evento macro (mesmo campo devolvido por `GET /news`).
- **Sucesso:** `204`, corpo vazio.
- **Erros:**
  - `401` — token ausente ou inválido/expirado.
- **Regra:** `MarkNewsEventAsSeenUseCase` grava `(user_id, macro_event_id)` em `news_event_reads` via `NewsReadRepository.markAsSeen` — **idempotente** (upsert com `ON CONFLICT DO NOTHING` na constraint única `(user_id, macro_event_id)`, mesmo padrão de `AchievementRepository.unlock`; reenviar não duplica linha nem lança erro, mesmo raciocínio de `POST /missions/:id/complete`). Não valida se `:id` corresponde a um evento macro real no motor — se não corresponder, a linha simplesmente nunca aparece decorada em `GET /news`, sem efeito colateral. Frontend chama esta rota na primeira expansão de cada evento (`NewsEventList`, `<details onToggle>`), mesmo ponto de disparo já usado pelo auto-report da missão "Consulte o feed de notícias" (tarefa 6.6).
