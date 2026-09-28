# `admin` — rotas restritas a papel administrativo

Módulo: `backend/src/modules/admin/`. `GET /admin/ping` é rota de exemplo; `POST /admin/macro-events` (tarefa 4.4) e `GET /admin/macro-events` (tarefa 4.5) formam o painel administrativo de Eventos Macro (RF13/RF14, tela 10.1/10.2 do inventário). Outros painéis administrativos chegam na semana 6 e são documentados aqui quando existirem.

---

### `GET /admin/ping`

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ ok: true }`.
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
- **Regra:** nenhuma regra de negócio própria — existe só pra validar que `shared/http/authMiddleware.ts` (`authenticate` + `requireRole('admin')`) funciona de ponta a ponta. `role: 'admin'` só existe via `npm run db:seed:admin` (`backend/src/db/seed.ts`) — nunca por autocadastro (RNF07, ver `.docs/backend/auth.md`).

### `POST /admin/macro-events`

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** repassado praticamente sem tradução pro motor (mesmos nomes de campo, snake_case) — ver `.docs/engine/macroevent.md` pro formato completo (`template_key` opcional; evento avulso exige `title`/`narrative`/`direction`/`magnitude_band`/`affects_price`/`affects_fundamentals`; `targets`, mínimo 1, cada um com exatamente um entre `sector`/`risk_class`/`asset_id`). Validado com `interfaces/http/schemas.ts` (`triggerMacroEventBodySchema`, união de duas variantes — template ou avulso) antes de chamar o caso de uso.
- **Sucesso:** `201` → `{ event: {...} }`, corpo de `event` idêntico à resposta de `POST /macro-events` do motor (id, efeitos já amostrados, `fundamentals_report_day` se aplicável, `targets` — array de `{ sector? | risk_class? | asset_id? }` refletindo os alvos persistidos, exatamente um campo preenchido por item).
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
  - `400` — corpo não bate com nenhuma das duas variantes do schema (campo obrigatório ausente, alvo com escopo ambíguo etc.) **ou** o motor rejeitou o evento por uma regra que só ele sabe validar (ex: `template_key` inexistente no catálogo) — dupla validação documentada (Zod na borda + `macroevent.NewEvent`/`NewTarget` no motor), não redundância acidental.
- **Regra:** `TriggerMacroEventUseCase` delega inteiramente pra `MacroEventTrigger` (porta) → `engineMacroEventTrigger` (adapter, chama `POST /macro-events` via `ENGINE_URL`) — a regra de negócio do disparo (sorteio de efeito por banda, defasagem preço↔fundamentos) vive toda no motor; este módulo só garante `role = admin` (RNF07) antes de repassar. Um `400` do motor é traduzido pelo adapter em `InvalidMacroEventError` (`domain/errors.ts`), mapeado de volta pra `400` pelo router — qualquer outra falha do motor (`500`+) propaga como erro genérico (`500`, tratamento padrão do Express).

### `GET /admin/macro-events`

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** query string — `limit` (opcional, inteiro 1–100) e `offset` (opcional, inteiro ≥ 0), validados por `interfaces/http/schemas.ts` (`listMacroEventsQuerySchema`, `z.coerce.number()` já que query chega como string). Ambos repassados como estão pro motor; ausentes, o motor aplica o próprio default (ver `.docs/engine/macroevent.md`).
- **Sucesso:** `200` → `{ events: [...], total_entries }`, cada item idêntico à resposta de `POST /admin/macro-events` mais `created_at` (mesmo formato de `event`, `targets` incluído) — inclui `status` já atualizado (`pendente`/`aplicado`), não um valor congelado da criação (tarefa 4.5: o Temporizador atualiza a coluna a cada tick, ver `.docs/engine/macroevent.md#get-macro-events` e `.docs/engine/tick.md`). `created_at` (tarefa 6.6.1, RFC 3339) só aparece nesta resposta, nunca na de `POST /admin/macro-events` — é o timestamp real de criação, diferente de `triggered_on_day` (dia **simulado**). `total_entries` (tarefa 6.9.9) é o total de eventos macro sem paginação — o motor conta `macro_events` inteira (`SELECT COUNT(*)`) além de aplicar `LIMIT`/`OFFSET`, ver `.docs/engine/macroevent.md#get-macro-events`.
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
  - `400` — `limit`/`offset` fora da faixa aceita (ex: `limit=0`, `limit=101`, `offset=-1`, valor não numérico).
- **Regra:** `ListMacroEventsUseCase` delega inteiramente pra `MacroEventReader` (porta) → `engineMacroEventReader` (adapter, chama `GET /macro-events` via `ENGINE_URL`, repassando `limit`/`offset` como query string) — nenhuma regra de negócio própria, mesmo padrão de delegação fina de `TriggerMacroEventUseCase`. Não expõe patrimônio nem dado de conta de usuário — evento macro é estado global do motor (Mercado Ao Vivo único), não por conta (CLAUDE.md).

### `POST /admin/tick`

*(Gap fechado na tarefa 7.3, `backlog-plataforma-investimentos.md` — até esta tarefa, `POST /admin/tick` só existia na rede interna do Compose, `engine:8080`, nunca alcançável do host nem do gateway; comentário de `handleAdminTick` em `engine/internal/infra/httpserver/admin.go` já antecipava esse proxy "quando o painel admin existir". Sem ele, a suíte e2e não tinha como avançar dias simulados batendo só no gateway — decisão confirmada com o autor em 2026-09-28: criar o proxy em vez de expor a porta do motor ao host ou contornar via `docker exec`.)*

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** nenhum — o motor não aceita parâmetro nenhum nesta rota.
- **Sucesso:** `200` → corpo idêntico ao de `POST /admin/tick` do motor: `{ day, selic_rate, quotes_count, fundamentals_count, is_copom_day, is_report_day, dividends_generated_count, dividends_paid_count, bot_fills_count, expired_orders_count, uncovered_assets_count, intraday_rounds_count }` (ver `.docs/engine/tick.md`).
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
  - `409` — já existe um tick em andamento (trava consultiva do motor, tarefa S.3 — job diário automático ou outro `POST /admin/tick` concorrente).
  - Qualquer outra falha do motor (`500`/`503`) propaga como erro genérico (`500`, tratamento padrão do Express) — mesmo raciocínio de `POST /admin/macro-events` pra falhas fora das traduzidas explicitamente.
- **Regra:** `TriggerTickUseCase` delega inteiramente pra `TickTrigger` (porta) → `engineTickTrigger` (adapter, chama `POST /admin/tick` via `ENGINE_URL`, sem body) — nenhuma regra de negócio própria, mesmo padrão de delegação fina das outras duas rotas deste módulo. Serve tanto demonstração ao vivo pra banca quanto a suíte `backend/test/e2e/` (avançar dias simulados sem esperar o job diário real).
