# `admin` — rotas restritas a papel administrativo

Módulo: `backend/src/modules/admin/`. `GET /admin/ping` é rota de exemplo; `POST /admin/macro-events` (tarefa 4.4) e `GET /admin/macro-events` (tarefa 4.5) formam o painel administrativo de Eventos Macro (RF13/RF14, tela 10.1/10.2 do inventário). Outros painéis administrativos chegam na semana 6 e são documentados aqui quando existirem. Desde a tarefa N.4 (Fase N, `backlog-motor-mercado-realista.md`) toda ação mutável do painel grava uma linha em `admin_audit_log` e `GET /admin/audit-log` consulta esse log (seção ao final).

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
  - `400` — corpo não bate com nenhuma das duas variantes do schema (campo obrigatório ausente, alvo com escopo ambíguo etc.) **ou** o motor rejeitou o evento por uma regra que só ele sabe validar (ex: `template_key` inexistente no catálogo, ou `asset_id` de alvo que não existe ou não é ação — FII, ETF e renda fixa são recusados) — dupla validação documentada (Zod na borda + `macroevent.NewEvent`/`NewTarget` no motor), não redundância acidental.
- **Auditoria (N.4):** grava `macro_event.trigger` com `target_type = macro_event`, `target_id` = id do evento criado e `payload` = corpo recebido; `result = failed` com `error_message` quando o motor recusa (`400`). Corpo recusado pelo Zod (`400` antes do caso de uso) não gera linha.
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
- **Auditoria (N.4):** grava `tick.trigger` com `target_type = tick`, `target_id` = dia simulado e `payload = { day }`; `result = failed` com o motivo quando o motor recusa (ex: `409` de tick em andamento).
- **Regra:** `TriggerTickUseCase` delega inteiramente pra `TickTrigger` (porta) → `engineTickTrigger` (adapter, chama `POST /admin/tick` via `ENGINE_URL`, sem body) — nenhuma regra de negócio própria, mesmo padrão de delegação fina das outras duas rotas deste módulo. Serve tanto demonstração ao vivo pra banca quanto a suíte `backend/test/e2e/` (avançar dias simulados sem esperar o job diário real).

### `GET /admin/audit-log`

*(Tarefa N.4. Sem backfill: ações administrativas anteriores à tarefa não existem no log.)*

- **Autenticação:** Bearer token + `role: 'admin'`.
- **Payload:** query string, todos opcionais, validados por `listAuditLogQuerySchema` (`interfaces/http/schemas.ts`): `admin_id` (uuid), `action` (lista fechada em `domain/auditEntry.ts`: `macro_event.trigger`, `tick.trigger`, `tick.advance`, `scheduler.pause`, `scheduler.resume`, `order.cancel`, `order.cancel_batch`), `result` (`success` | `failed`), `from`/`to` (ISO 8601 com fuso, `from` ≤ `to`), `limit` (inteiro 1–100, padrão 20) e `offset` (inteiro ≥ 0, padrão 0).
- **Sucesso:** `200` → `{ entries: [...], total_entries }`, mais recentes primeiro. Cada item: `{ id, admin_id, admin_username, action, target_type, target_id | null, payload, result, error_message | null, occurred_at }`. `total_entries` é o total do filtro, sem paginação.
- **Erros:**
  - `401` — token ausente ou inválido.
  - `403` — token válido, mas `role` diferente de `admin`.
  - `400` — filtro fora do formato (ação desconhecida, uuid inválido, `limit` fora de 1–100, data inválida, intervalo invertido).
- **Regra:** `ListAuditLogUseCase` delega pra `AuditLogRepository` (porta) → `drizzleAuditLogRepository` (`admin_audit_log` com join em `users` pro `admin_username`). Quem grava é `RecordAdminActionUseCase.run`, chamado pelos casos de uso do módulo em volta da operação mutável: registra `success` ou `failed` e devolve ou relança o resultado original. Se a gravação do log falhar, o erro é logado (`[audit]`) e a resposta da ação **não** muda (um tick que já rodou não vira `500`). O log é **append-only também no banco**: o trigger `admin_audit_log_append_only` recusa `UPDATE` e `DELETE` (migration `0018`). `payload` guarda só a entrada da ação, nunca senha, token ou patrimônio absoluto. Toda tarefa nova da Fase N que mude estado deve adicionar sua ação em `ADMIN_AUDIT_ACTIONS` e chamar `run`.

### Painel de Tempo (tarefa N.6)

Cinco rotas que repassam o controle do Temporizador do motor (ver `.docs/engine/tick.md#controle-do-temporizador-tarefa-n6-fase-n`). Todas exigem Bearer token + `role: 'admin'` (`401` sem token, `403` para usuário comum, nada é chamado nem auditado nesses casos). Proxy fino: `SchedulerAdmin` (porta → `engineSchedulerAdmin`) chama o motor via `ENGINE_URL`; a regra (pausa só vale pro tick agendado, retomar não recupera o tempo parado, teto de dias) vive no motor.

#### `GET /admin/scheduler`

- **Sucesso:** `200` → `{ enabled, paused, resumed_at, ticks_per_day, timezone, max_catch_up, next_slot_at, tick_in_progress, last_tick_at }`, idêntico ao do motor. `enabled` é a agenda do processo (variável de ambiente, só leitura); `paused` é a pausa em runtime.

#### `POST /admin/scheduler/pause` e `POST /admin/scheduler/resume`

- **Payload:** nenhum.
- **Sucesso:** `200` → o estado novo (mesmo corpo de `GET /admin/scheduler`). Idempotente.
- **Erros:** `409` — agenda automática desligada neste ambiente (`TICK_SCHEDULER_ENABLED=false`), não há o que pausar.
- **Auditoria:** `scheduler.pause` / `scheduler.resume`, `target_type = scheduler`; a recusa do motor grava `result = failed` com o motivo.

#### `GET /admin/ticks`

- **Payload:** query `limit` (1 a 100) e `offset` (≥ 0), opcionais, validados por `listTicksQuerySchema`.
- **Sucesso:** `200` → `{ ticks: [...], total_entries }`, mais recente primeiro. Cada item: `{ simulated_day | null, trigger ('scheduled' | 'catchup' | 'manual'), status ('success' | 'failed'), error_message | null, started_at, duration_ms, catch_up_discarded, selic_rate | null, is_copom_day, is_report_day, quotes_count, fundamentals_count, dividends_generated_count, dividends_paid_count, bot_fills_count, expired_orders_count, uncovered_assets_count, intraday_rounds_count }`.
- **Erros:** `400` — `limit`/`offset` fora da faixa.

#### `POST /admin/tick/advance`

- **Payload:** `{ "days": N }`, inteiro de 1 a 30 (`advanceTicksBodySchema`, o mesmo teto do motor).
- **Sucesso:** `200` → `{ requested, ticks: [...] }`, um item por tick no formato de `POST /admin/tick`. Os N ticks rodam em sequência no motor sob uma única trava. **Afeta todos os usuários** (o mercado é compartilhado).
- **Erros:** `400` — `days` ausente, fora de 1 a 30, fracionário ou texto (nada é chamado nem auditado); `409` — já existe um tick em andamento; `500` — falha no meio: `{ error, completed_ticks }` com os ticks que **já rodaram** (ficam gravados; não há rollback de mercado).
- **Auditoria:** `tick.advance`, `target_type = tick`, `target_id` = último dia simulado, `payload = { days, executed, last_day }` (uma única linha pro lote inteiro); falha grava `result = failed` com o motivo e `payload = { days }`.
- **Limite conhecido:** a resposta só volta quando todos os dias terminaram (cada tick leva alguns segundos e cresce com o catálogo); o motor dá 2 minutos de prazo de escrita por dia pedido.

### Visão geral e saúde do sistema (tarefa N.5)

Duas rotas de leitura da tela de entrada do painel. Exigem Bearer token + `role: 'admin'` (`401` sem token, `403` para usuário comum). Só leitura: não passam pela auditoria (N.4).

#### `GET /admin/system/health`

- **Sucesso:** `200` → `{ checked_at, components: [{ key, status, latency_ms | null, detail | null }] }`, sempre nesta ordem: `backend`, `engine`, `gamification_db`, `market_db`, `redis`. `status` é `ok`, `degradado` (respondeu, mas em mais de 1000 ms) ou `fora` (falhou ou não respondeu em 3 s; `latency_ms` vira `null` e `detail` traz o motivo).
- **Erros:** nenhum próprio. Um componente fora **não** derruba a resposta, só aparece como `fora`.
- **Regra:** `GetSystemHealthUseCase` sonda os componentes em paralelo por `HealthProbe` (porta): `engine` = `GET /health` do motor; `gamification_db` = `select 1` no pool do backend; `redis` = `PING`; `market_db` = a leitura da visão geral do motor (só o motor fala com esse banco, então se ela responde o banco está de pé). O `backend` é `ok` por definição.

#### `GET /admin/overview`

- **Sucesso:** `200` → `{ market, scheduler, last_tick, users, errors }`.
  - `market`: o corpo de `GET /admin/overview` do motor (ver `.docs/engine/admin.md`).
  - `scheduler`: o corpo de `GET /admin/scheduler` (agenda ligada/pausada, próximo slot).
  - `last_tick`: a linha mais recente de `GET /admin/ticks`, ou `null` se nunca houve tick.
  - `users`: `{ total, signups_last_24h, signups_last_7d }`, só contas `role = user`.
  - `errors`: por seção que falhou (`market`, `scheduler`, `last_tick`, `users`), a mensagem do erro; vazio quando tudo respondeu.
- **Erros:** nenhum próprio. Uma fonte fora vira `null` na seção dela e a mensagem em `errors`; as demais seguem. A tela de entrada precisa abrir justamente quando algo está quebrado.

### Monitor do mercado ao vivo (tarefa N.8)

Duas rotas de leitura que repassam o monitor do motor (ver `.docs/engine/admin.md`). Exigem Bearer token + `role: 'admin'` (`401` sem token, `403` para usuário comum). Só leitura: não passam pela auditoria (N.4). Proxy fino: `MarketMonitorReader` (porta) → `engineMarketMonitorReader`; os números (spread, variação, indicador por classe, posse de bots) são calculados no motor. Os indicadores macro (Selic/IPCA) e o calendário da tela reaproveitam as rotas públicas `GET /market/indicators` e `GET /market/calendar`, sem rota nova.

#### `GET /admin/market/assets`

- **Sucesso:** `200` → `{ assets: [...] }`, um item por ativo negociável (ação, ETF, FII), ordenado por ticker, no formato descrito em `.docs/engine/admin.md` (`last_price`, `daily_change_pct`, `best_bid`, `best_ask`, `spread_pct`, `resting_orders`, `bot_resting_orders`, `day_trades`, `day_volume`, `held_by_bots`, `held_by_users`, `covered`, `indicator`...).
- **Erros:** falha do motor propaga como `500`.

#### `GET /admin/market/assets/:id`

- **Payload:** `:id` UUID (validado por `requireUuidParam`).
- **Sucesso:** `200` → o item acima mais `bids`, `asks`, `trades`, `quotes` e `nav_history`.
- **Erros:** `400` — `id` não é UUID (o motor não é chamado); `404` — ativo inexistente ou fora do universo negociável.

### Ordens do book: consulta e cancelamento por intervenção (tarefa N.10)

Todas exigem `role = admin` (`401` sem token, `403` para usuário comum). Proxy do motor (ver `.docs/engine/admin.md`); o dono da ordem aparece aqui, ao contrário do book público.

#### `GET /admin/orders`

- **Payload:** query opcional validada por `listAdminOrdersQuerySchema`: `user_id`, `asset_id` (UUID), `side` (`buy` | `sell`), `status` (`open` | `pending` | `partially_filled` | `filled` | `cancelled`; `open` junta pending e partially_filled), `from`, `to` (ISO 8601, `from` ≤ `to`), `limit` (1 a 200), `offset` (≥ 0).
- **Sucesso:** `200` → `{ orders: [{ order_id, asset_id, ticker, user_id, is_bot, bot_archetype | null, side, type, quantity, filled_quantity, price, status, cancel_reason | null, simulated_day, created_at }], total }`, mais recentes primeiro.
- **Erros:** `400` — filtro inválido (o motor não é chamado).

#### `POST /admin/orders/:id/cancel`

- **Payload:** nenhum (`id` UUID no caminho).
- **Sucesso:** `204`.
- **Erros:** `400` — `id` não é UUID; `404` — ordem inexistente; `409` — ordem já executada ou cancelada.
- **Regra:** cancela com `cancel_reason = admin`, de qualquer dono. Não há reserva de saldo/posição a devolver (nenhuma ordem em repouso reserva, achado 015) nem evento a emitir.
- **Auditoria:** `order.cancel`, `target_type = order`, `target_id` = id da ordem; a recusa do motor grava `result = failed` com o motivo.

#### `POST /admin/orders/cancel-batch`

- **Payload (JSON):** `asset_id` e/ou `user_id` (UUID); pelo menos um é obrigatório (`cancelOrdersBatchBodySchema`). Com os dois vale a interseção.
- **Sucesso:** `200` → `{ cancelled_count, cancelled_ids }`.
- **Erros:** `400` — corpo inválido ou nenhum filtro; `422` com `{ error, code: "batch_too_large", matched, max }` — o filtro atinge mais que 500 ordens e **nada é cancelado**.
- **Auditoria:** `order.cancel_batch`, `target_type = order`, **uma linha** com `payload = { asset_id | null, user_id | null, cancelled_count, cancelled_ids }`; o lote recusado grava `result = failed` com o filtro.
