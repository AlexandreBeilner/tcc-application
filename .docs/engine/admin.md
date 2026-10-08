# `admin` — leituras e intervenções do painel administrativo (Fase N)

Rotas internas do painel: **leitura** (tarefas N.5, N.8 e a consulta de ordens da N.10) e **cancelamento de ordens por intervenção** (N.10, seção no fim), mesma convenção de `POST /admin/tick`: sem checagem de role no motor, o backend valida `role = admin` antes de repassar (ver `.docs/backend/admin.md`). O controle do Temporizador está em `tick.md`. Pacote de domínio: `engine/internal/domain/adminview/` (modelos de leitura e fórmulas puras: spread, variação, indicador por classe); consultas em `internal/infra/db/admin_read_repository.go`. Nada aqui grava saldo, posição ou evento. Respondem `503` se o motor subiu sem `DATABASE_URL` (sem `httpserver.WithAdminReader`).

---

### `GET /admin/overview`

- **Autenticação:** interno (ver acima).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ simulated_day, selic_rate, ipca_monthly | null, ipca_accumulated_12m | null, pending_macro_events, uncovered_assets, tradable_assets, active_bots, total_bots, day_trades, day_volume, resting_orders }`.
- **Erros:** `503` — sem banco; `500` — falha de leitura.
- **Regra:** uma chamada agrega o recorte do mercado, sem consulta por ativo. Selic e IPCA vêm da última linha de `market_indicator_history` (sem histórico ainda, a Selic cai pra `market_calendar` e o IPCA fica `null`). `pending_macro_events` são eventos disparados que o próximo tick ainda aplica. `uncovered_assets` conta ativos negociáveis (ação, ETF e FII que não sejam sandbox) **agora** sem Market Maker ativo cobrindo (é a leitura ao vivo, diferente de `uncovered_assets_count` do tick, que é a foto do último tick). `day_trades`/`day_volume` são as execuções do dia simulado corrente: uma por ordem de compra executada (`buy_order_executed`), volume em R$ (`quantidade × preço`). `resting_orders` são as ordens `limit` abertas no book.

---

### `GET /admin/market/assets`

- **Autenticação:** interno.
- **Payload:** nenhum. Filtro e ordenação ficam na tela.
- **Sucesso:** `200` → `{ assets: [...] }`, um item por ativo negociável, ordenado por ticker: `{ asset_id, ticker, name, type ('acao' | 'etf' | 'fii'), sector | null, last_price | null, daily_change_pct | null, best_bid | null, best_ask | null, spread_pct | null, resting_orders, bot_resting_orders, day_trades, day_volume, outstanding_shares | null, held_by_bots, held_by_users, covered, indicator | null }`.
- **Erros:** `503`, `500` como acima.
- **Regra:** `indicator = { kind, value }` é o número que importa pra classe (RF21, nunca o layout de ação pra ETF/FII): ação → `price_to_earnings` (preço ÷ LPA do último relatório); ETF → `nav_premium_pct` (ágio/deságio do último NAV gravado, em %); FII → `price_to_book` (cotação ÷ valor patrimonial por cota; tijolo usa `net_worth`, papel usa `portfolio_value`). Fica `null` quando falta insumo. `spread_pct` é o spread relativo ao ponto médio do book, em %. `covered` diz se há Market Maker **ativo** cobrindo o ativo. `held_by_bots`/`held_by_users` somam `positions.quantity` por tipo de conta. Ativo sem cotação, book ou negócio volta com os campos `null`/`0`, sem quebrar. Uma consulta só, sem N+1 (migration `000041` indexa `market_events (simulated_day, event_type)` pros negócios do dia).

---

### `GET /admin/market/assets/{id}`

- **Autenticação:** interno.
- **Payload:** `id` no caminho, UUID.
- **Sucesso:** `200` → o mesmo item de `GET /admin/market/assets` mais `bids` e `asks` (`[{ price, quantity, bot_quantity }]`, book **completo** agregado por preço: bids do maior pro menor, asks do menor pro maior), `trades` (últimos 30 negócios: `{ simulated_day, price, quantity, buyer_is_bot }`), `quotes` (60 últimos fechamentos: `{ simulated_day, price }`) e `nav_history` (30 últimos NAVs de ETF: `{ simulated_day, nav, close_price, premium_pct }`; vazio fora de ETF).
- **Erros:** `400` — `id` não é UUID; `404` — ativo inexistente ou fora do universo negociável (sandbox, renda fixa); `503`, `500` como acima.
- **Regra:** nunca expõe o dono de uma ordem individual, só a quantidade agregada por preço e quanto dela é de bot.

---

### `GET /admin/orders`

- **Autenticação:** interno.
- **Payload (query, tudo opcional):** `user_id`, `asset_id` (UUID); `side` (`buy` | `sell`); `status` (`open` = pending + partially_filled, `pending`, `partially_filled`, `filled`, `cancelled`); `from`, `to` (ISO 8601); `limit` (padrão 50, máximo 200), `offset`.
- **Sucesso:** `200` → `{ orders: [...], total }`, mais recentes primeiro. Cada ordem: `{ order_id, asset_id, ticker, user_id, is_bot, bot_archetype | null, side, type, quantity, filled_quantity, price, status, cancel_reason | null, simulated_day, created_at }`. `total` é o total que casa com o filtro, pra paginar.
- **Erros:** `400` — UUID, `side`, `status`, data ou número inválidos; `503` — sem banco; `500`.
- **Regra:** diferente do book público e do monitor, aqui o dono da ordem aparece (o admin investiga). Nunca traz patrimônio. `cancel_reason` ganhou o valor `admin` (migration `000042`).

---

### `POST /admin/orders/{id}/cancel`

- **Autenticação:** interno.
- **Payload:** nenhum (`id` no caminho, UUID).
- **Sucesso:** `204`.
- **Erros:** `400` — `id` não é UUID; `404` — ordem inexistente; `409` — ordem já `filled` ou `cancelled`; `503`, `500`.
- **Regra:** cancela com `cancel_reason = admin`, qualquer que seja o dono (sem a checagem de dono de `POST /orders/{id}/cancel`). Lê a linha com `FOR UPDATE`, então serializa contra um fill concorrente (o fill checa o status). O `filled_quantity` já executado não é revertido. **Não há reserva a devolver nem evento a emitir:** nenhuma ordem em repouso reserva saldo ou posição (achado 015, o motor revalida o dono no match), e cancelar nunca passou por `market_events` (mesma regra do cancelamento do dono, O.1).

---

### `POST /admin/orders/cancel-batch`

- **Autenticação:** interno.
- **Payload (JSON):** `asset_id` e/ou `user_id` (UUID). **Pelo menos um** é obrigatório; com os dois, vale a interseção (ordens do dono naquele ativo, o caminho que a N.1 usa ao tirar um ativo de um Market Maker). "Cancelar tudo" não existe.
- **Sucesso:** `200` → `{ cancelled_count, cancelled_ids: [...] }` (lista vazia se nada estava em repouso).
- **Erros:** `400` — corpo inválido, UUID inválido ou nenhum filtro; `422` com `code: "batch_too_large"` e `{ matched, max }` — o filtro atinge mais que 500 ordens (`orderexecution.MaxAdminCancelBatch`); **nada é cancelado**, o admin estreita o filtro; `503`, `500`.
- **Regra:** uma transação: trava as ordens em repouso do filtro (`FOR UPDATE`, lê no máximo `max + 1`), recusa se passou do teto e senão cancela todas com `cancel_reason = admin`. A auditoria (uma linha com a lista de ids) é do backend.

---

### Pausa de negociação (tarefa N.9)

Pacote de domínio: `engine/internal/domain/tradinghalt/` (`NewHalt`, `Blocking`, `Service`); tabela `trading_halts` (migration `000043`). Uma pausa é global ou de um ativo, fica **vigente** até `lifted_at` ser preenchido e nunca é apagada. Respondem `503` sem `httpserver.WithTradingHalts`.

**O que a pausa faz:** enquanto vigente, `POST /orders` do escopo responde `409` com `code: "trading_halted"` (ver `orders.md`) e as rodadas dos bots não enviam ordem pro ativo (o bot nem decide, e o Market Maker **não cancela** a cotação velha, porque não poderia repô-la). Ordens **já em repouso permanecem** (cancelar em massa é a N.10). O ativo sandbox nunca é pausado. Pausa global e de ativo coexistem e a global vence. **A pausa não suspende o tick** (decisão do autor, achado 029): dia, Selic, balanços e dividendos seguem; o relógio tem o próprio interruptor (`tick.md`). **Consequência aceita:** as ordens em repouso expiram a cada tick (regra Day) e os bots não recotam durante a pausa, então se ela atravessar um tick o book fica vazio ao retomar; retomar não força uma rodada, e quem quiser liquidez imediata dispara 1 tick.

#### `GET /admin/halts`

- **Sucesso:** `200` → `{ active: [...], recent: [...] }`; `active` são as pausas vigentes (a global primeiro), `recent` as últimas 30 encerradas. Cada item: `{ id, scope ('global' | 'asset'), asset_id | null, ticker | null, reason, created_by, created_at, lifted_at | null, lifted_by | null }`.
- **Erros:** `503`, `500`.

#### `POST /admin/halts`

- **Payload (JSON):** `scope` (`global` | `asset`), `asset_id` (UUID, obrigatório se `asset`, proibido se `global`), `reason` (texto de 1 a 200 caracteres), `admin_id` (UUID de quem pausa, informado pelo backend).
- **Sucesso:** `201` → a pausa criada.
- **Erros:** `400` — corpo, UUID, escopo ou motivo inválidos, ou ativo que não é negociável no book (sandbox, renda fixa); `404` — ativo inexistente; `409` — já existe pausa vigente nesse escopo (índice parcial único: uma global e uma por ativo); `503`, `500`.

#### `POST /admin/halts/{id}/lift`

- **Payload (JSON):** `admin_id` (UUID). `id` no caminho, UUID.
- **Sucesso:** `200` → a pausa encerrada (`lifted_at` e `lifted_by` preenchidos).
- **Erros:** `400` — UUID inválido; `404` — pausa inexistente; `409` — já encerrada (o `UPDATE` condicionado a `lifted_at IS NULL` é atômico, duas retomadas concorrentes não encerram duas vezes); `503`, `500`.

#### `GET /market/halts`

- **Autenticação:** interno (o backend repassa a usuário autenticado).
- **Sucesso:** `200` → `{ global: bool, asset_ids: [uuid] }`.
- **Regra:** leitura pública mínima pro aviso "Negociação pausada" do usuário. **Nunca** expõe o motivo interno nem quem pausou.


---

### Parâmetros de simulação (tarefa N.7)

Pacote de domínio: `engine/internal/domain/enginesetting/` (`Service`, `Validate`, lista fechada de chaves); tabela `engine_settings` (migration `000045`, uma linha por chave alterada: `key`, `value`, `updated_by`, `updated_at`, `version`). Sem linha vale o **padrão do ambiente** (`SIMULATION_DAYS_PER_REAL_DAY`, `TICK_MAX_CATCHUP`). **Só o ritmo do Temporizador é editável** (decisão do autor, achado 029): `ticks_per_day` (1 a 24) e `max_catch_up` (1 a 30). O resto aparece como somente leitura. O agendador lê o valor vigente a cada tentativa (no máximo 30 s de atraso) e nunca no meio de um tick; `GET /admin/scheduler` e `GET /market/clock` (`days_per_real_day`) refletem o valor vigente; o valor sobrevive a restart. Respondem `503` sem `httpserver.WithSettings`.

#### `GET /admin/settings`

- **Sucesso:** `200` → `{ editable: [...], read_only: [...] }`. `editable`: `{ key, value, default, min, max, overridden, updated_by | null, updated_at | null, version }`. `read_only`: `{ key, value (texto), reason }` (semente, capital inicial, intervalo do Copom, teto de spread de bot, teto de ordem de bot sobre o volume, teto de avançar dias, teto do lote de cancelamento).
- **Erros:** `503`, `500`.

#### `PUT /admin/settings/{key}`

- **Payload (JSON):** `value` (inteiro), `admin_id` (UUID, informado pelo backend). `key` é `ticks_per_day` ou `max_catch_up`.
- **Sucesso:** `200` → o mesmo corpo do `GET`, já com o valor novo.
- **Erros:** `400` — corpo ou `admin_id` inválidos; `404` — chave desconhecida ou somente leitura; `422` — valor fora da faixa (mensagem do domínio com a faixa); `503`, `500`.

#### `DELETE /admin/settings/{key}`

- **Sucesso:** `200` → o mesmo corpo do `GET`, com a chave de volta ao padrão. Idempotente.
- **Erros:** `404` — chave desconhecida; `503`, `500`.

---

### Gestão de bots (tarefa N.1)

Pacote de domínio: `engine/internal/domain/botadmin/` (`Service`, `CreateInput`, `UpdateInput`); leituras e escritas em `internal/infra/db/bot_admin_repository.go`. A personalidade reaproveita `bot.NewSpecializationScope`, `bot.NewRiskProfile` e `bot.NewPersonality` (nenhuma regra duplicada), e a cobertura reaproveita `coverage.MarketMakerLister`/`Provisioner` (P.1) e `NewMarketMakerID`. Respondem `503` sem `httpserver.WithBotAdmin`.

#### `GET /admin/bots`

- **Sucesso:** `200` → `{ bots: [...], uncovered_assets: [{ asset_id, ticker }] }`. Cada bot: `{ account_id, archetype ('ruido' | 'market_maker' | 'chartista' | 'fundamentalista'), is_active, cash, scope: { sectors, risk_classes, asset_classes, within_scope_pct }, knowledge_level | null, risk_profile: { max_position_size_pct, market_order_preference, spread_width_pct }, max_covered_assets | null, covered_assets: [{ asset_id, ticker }], holdings: [{ asset_id, ticker, quantity, average_price }] }`. Ordenado por arquétipo e depois por `account_id`.
- **Erros:** `503`, `500`.
- **Regra:** quatro consultas pro roster inteiro, nenhuma por bot. `max_covered_assets` e `covered_assets` só são preenchidos no Market Maker. `holdings` traz só posição com quantidade maior que zero (`positions` mantém a linha de quem vendeu tudo). `uncovered_assets` é a mesma definição de `uncovered_assets` em `GET /admin/overview`: ativo negociável (ação, ETF e FII fora do sandbox) sem Market Maker **ativo** cobrindo. Setores e classes de risco usam os valores do domínio (strings de exibição, ex: `Bancário/Financeiro`, `Conservador`); classes de ativo são `acao`, `etf`, `fii`.

#### `POST /admin/bots`

- **Payload (JSON):** `archetype`, `sectors`, `risk_classes`, `asset_classes` (listas; pelo menos uma não vazia), `within_scope_pct` (0,85 a 0,90), `knowledge_level` (0 a 1, **obrigatório só no `fundamentalista`**, proibido nos outros), `max_position_size_pct` (maior que 0 até 1), `market_order_preference` (0 a 1), `spread_width_pct` (0 a `MaxSpreadWidthPct` = 0,10), `max_covered_assets` (inteiro positivo, só `market_maker`; padrão 10), `initial_cash` (maior que 0, até R$ 1.000.000.000.000, porte compatível com o float sintético, em que um Market Maker do seed passa de R$ 300 bilhões).
- **Sucesso:** `201` → o bot criado (mesmo formato de um item de `GET /admin/bots`).
- **Erros:** `400` — qualquer recusa de domínio (`bot.Err*`: arquétipo, escopo vazio, setor/classe desconhecidos, faixa de atividade, spread, posição, conhecimento, teto de cobertura) ou caixa fora da faixa; `409` — ID já existente; `503`, `500`.
- **Regra:** conta e personalidade nascem **na mesma transação**; o caixa entra pelo evento imutável `bot_initial_cash` (o mesmo de `AccountRepository.Create`). **Não há posição inicial:** o float de todo ativo já está distribuído entre os detentores (B.1/P.2) e a posição teria que sair de alguém, então o bot começa só com caixa e ganha posição negociando (decisão desta tarefa, ver o Entregável da N.1). O ID é determinístico (entra na semente das rodadas, RNF08): Market Maker usa `coverage.NewMarketMakerID(quantos Market Makers existem)`, os demais `00000000-0000-0000-0002-<índice>` (prefixo próprio do painel, nunca colide com o pool do seed). Market Maker novo **nasce sem cobertura**: por ser o menos carregado, vira o candidato de `coverage.Assign` pro próximo ativo que precisar de cobertura, ou recebe ativos explícitos pelo `PATCH`. O bot novo entra na rodada seguinte (a coleta lê `bot_personalities` + `is_active` a cada rodada).

#### `PATCH /admin/bots/{id}`

- **Payload (JSON, pelo menos um campo):** `is_active` (bool), `max_covered_assets` (inteiro positivo, só Market Maker), `covered_asset_ids` (lista de UUIDs, só Market Maker: o conjunto **final** de ativos, que substitui o atual; lista vazia tira toda a cobertura) e, a partir da N.15, a **personalidade**: `sectors`, `risk_classes`, `asset_classes` (listas; cada uma, quando enviada, **substitui** a atual, e o escopo final não pode ficar vazio), `within_scope_pct` (0,85 a 0,90), `knowledge_level` (0 a 1, só `fundamentalista`), `max_position_size_pct` (maior que 0 até 1), `spread_width_pct` (0 a 0,10). `id` no caminho, UUID. **`market_order_preference` não é aceito** (achado 001, decidido em 2026-10-03: o campo fica reservado e sem efeito; se vier no corpo, é ignorado).
- **Sucesso:** `200` → o bot atualizado.
- **Erros:** `400` — `id`/UUID inválido, corpo vazio, teto ou cobertura num bot que não é Market Maker, teto não positivo, ativo repetido, ativo não negociável, cobertura acima do teto; `404` — bot inexistente; `409` — ativo já coberto por **outro** Market Maker (tirar de lá primeiro: mover é remover e depois adicionar); `422` com `code: "batch_too_large"` — o Market Maker tem mais de 500 ordens em repouso no ativo a remover, nada foi tirado; `503`, `500`.
- **Regra:** o estado final (teto e cobertura) é validado **antes** de gravar qualquer coisa, então só falha de infraestrutura deixa a alteração pela metade. Ordem de aplicação: teto, ativos novos (`ProvisionCoverage` com 0 ações e sem caixa, só a cobertura), ativos removidos, interruptor. **Ao remover um ativo, as ordens em repouso do Market Maker nele são canceladas** (mesmo cancelamento em lote da N.10, interseção ativo + dono, `cancel_reason = admin`) **antes** de a linha de cobertura sair, porque a cotação de Market Maker ativo não expira por dia (P.5); a posição que ele tem no ativo continua com ele. `is_active` só alterna `accounts.is_active`, nunca toca saldo nem posição (A.4); um Market Maker inativo perde a isenção de expiração (as cotações dele expiram no próximo tick) e deixa de contar como cobertura em `uncovered_assets`.
- **Personalidade (N.15):** a personalidade final é montada pelos mesmos construtores da criação (`NewSpecializationScope`, `NewRiskProfile`, `NewPersonality`), partindo da atual: campo ausente mantém o valor, e arquétipo, preferência por ordem a mercado e teto de cobertura nunca mudam por aqui. Qualquer recusa de domínio (`bot.Err*`) é `400` e **nada é gravado**. A gravação (`UpdatePersonality`) troca as colunas e **todas** as linhas de `bot_personality_scopes` numa transação só. Vale **na rodada seguinte** (a coleta lê `bot_personalities` a cada rodada); as ordens que o bot já tem em repouso seguem com o preço de quando foram enviadas, e um Market Maker as recota na próxima rodada com o spread novo.

#### `POST /admin/bots/{id}/funding`

- **Payload (JSON, pelo menos um dos dois):** `cash` (maior que 0, até R$ 1.000.000.000.000; omitido ou 0 não aporta caixa) e `holdings` (`[{ asset_id (UUID), quantity (inteiro de 1 a 2.000.000.000) }]`, sem ativo repetido). `id` no caminho, UUID.
- **Sucesso:** `200` → o bot depois do aporte (mesmo formato de um item de `GET /admin/bots`).
- **Erros:** `400` — `id` ou `asset_id` não é UUID, corpo vazio, caixa fora da faixa, quantidade inválida, ativo repetido, ativo não negociável, ativo sem cotação pra valorizar a posição, ativo sem cotas em circulação; `404` — bot inexistente (ou conta que não é de bot); `409` — a posição passaria do total de cotas em circulação do ativo (teto de float, achado 005); `503`, `500`.
- **Regra:** **só soma, nunca remove** caixa nem posição. Tudo entra por evento imutável antes de projetar, numa transação só: o caixa vira `bot_initial_cash` (sem ativo) e soma ao saldo; cada posição vira `bot_initial_allocation` (quantidade e a **última cotação** do ativo como valor unitário), e a posição existente recebe o preço médio ponderado. Os mesmos tipos do seed e do provisionamento de cobertura, então o aporte aparece no extrato do bot e em `market_events`, e conta como **capital aportado** no P&L da N.14 (não vira lucro). O teto de float é validado **depois** de gravar a posição, e qualquer linha que estoure desfaz o aporte inteiro, inclusive o caixa. Como o float de todo ativo costuma estar 100% distribuído (B.1/P.2), o aporte de **posição** só passa onde houver folga (ex: ETF com cotas novas); o caminho comum pra um Market Maker esgotado é o aporte de **caixa**. Vale na rodada seguinte.

### Desempenho dos bots (tarefa N.14)

Modelos e fórmulas puras em `engine/internal/domain/adminview/bots.go`; consultas em `internal/infra/db/admin_bots_read_repository.go`. Só leitura, mesma fonte de verdade do resto do painel (`order_book`, `market_events`, `positions`, `asset_quotes`), nunca tabela de métricas paralela. Respondem `503` sem `httpserver.WithAdminReader`. A migration `000044` indexa `order_book (user_id, simulated_day)`.

#### `GET /admin/bots/{id}/activity`

- **Payload (query, opcional):** `days` — janela em dias simulados, inclusive o corrente (padrão 30, máximo 365). `id` no caminho, UUID.
- **Sucesso:** `200` → `{ account_id, archetype, is_active, from_day, to_day, period_days, cash, holdings_value, net_worth, capital_contributed, pnl, pnl_pct | null, orders: { sent, filled, partially_filled, open, cancelled, cancelled_by_reason: { <motivo>: n }, fill_rate_pct | null }, trades, volume, last_order_at | null, last_order_day | null, quotes: [...] }`. `quotes` só vem preenchido no Market Maker: `{ asset_id, ticker, best_bid | null, best_ask | null, spread_pct | null, held_quantity, target_quantity, inventory_pct | null }`.
- **Erros:** `400` — `id` não é UUID ou `days` não é inteiro positivo; `404` — a conta não existe ou não é de bot; `503`, `500`.
- **Regra:** **patrimônio, capital e P&L são acumulados desde a criação do bot**, não da janela (o patrimônio de um dia passado exigiria reconstruir as posições dia a dia); ordens, negócios e volume respeitam a janela. `net_worth = cash + holdings_value`, com as posições a mercado pela última cotação (`asset_quotes`; sem cotação, pelo preço médio). `capital_contributed` é tudo que entrou por evento de alocação: `bot_initial_cash` (caixa) mais `bot_initial_allocation` (`quantidade × valor`); `pnl = net_worth − capital_contributed`. As ordens contam por `simulated_day` da criação dentro da janela (`open` inclui as parcialmente executadas); `fill_rate_pct` é a quantidade executada sobre a enviada. `trades`/`volume` vêm de `market_events` (`buy_order_executed` e `sell_order_executed` do próprio bot, volume em R$). `last_order_*` é a última ordem de sempre. No Market Maker, `best_bid`/`best_ask` são só as ordens **dele** em repouso, e `target_quantity` é a soma das alocações iniciais gravadas em `market_events`. **Não há "% dos dias com bid e ask":** o `order_book` não guarda quando uma ordem foi encerrada, então esse histórico não é reconstruível sem uma tabela nova; a tela mostra a situação **atual** da cotação.

#### `GET /admin/bots/summary`

- **Payload (query, opcional):** `idle_days` — quantos dias simulados sem ordem tornam um bot ativo "parado" (padrão 3, máximo 90).
- **Sucesso:** `200` → `{ simulated_day, idle_days, active_bots, idle_bots: [{ account_id, archetype, last_order_day | null }], low_cash_bots: [{ account_id, archetype, cash, capital }], empty_inventory: [{ account_id, asset_id, ticker }], liquidity: [{ asset_id, ticker, resting_by_provider: { <arquétipo | "usuario">: quantidade } }], float_concentration: [{ asset_id, ticker, top_bot_id, top_bot_archetype, top_bot_pct, all_bots_pct, outstanding_shares }] }`.
- **Erros:** `400` — `idle_days` inválido; `503`, `500`.
- **Regra:** só bots **ativos** entram em `idle_bots` e `low_cash_bots`; "rodadas" do texto da tarefa viraram **dias simulados** (a rodada não é gravada; a ordem tem o dia). `idle_bots` é quem não tem ordem criada nos últimos `idle_days` dias (inclusive o corrente), com `last_order_day` nulo pra quem nunca ordenou. `low_cash_bots` é o caixa abaixo de 1% do capital aportado (`LowCashRatio`, valor ilustrativo). `empty_inventory` lista Market Maker ativo sem nenhuma ação de um ativo que cobre. `liquidity` soma a quantidade **ainda aberta** (`quantidade − executada`) das ordens a limite em repouso, por arquétipo de bot e `usuario`. `float_concentration` traz o maior bot detentor de cada ativo e a fatia de todos os bots, em % das cotas em circulação, ordenado pela maior concentração. Ativos sem cobertura continuam em `uncovered_assets` de `GET /admin/bots`.

---

### Catálogo de ativos (tarefa N.12)

Pacote de domínio: `engine/internal/domain/catalogadmin/` (`Service`, `Patch.Validate`, `EditableFields`); leitura e gravação em `db.CatalogAdminRepository`. O catálogo é dado cadastral (não Event Sourcing), então a edição é um `UPDATE` direto, mas só numa **lista fechada de campos**, validada pelas mesmas regras do cadastro (`catalog.ValidateBaseGrowthPct`, `ValidateQualityMultiplier`). Mudar `base_growth_pct` ou `quality_multiplier` vale a partir do próximo relatório (o tick lê a empresa todo dia). Respondem `503` sem `httpserver.WithCatalogAdmin`.

Editável por classe: **ação** `name`, `base_growth_pct`, `quality_multiplier` (os dois últimos são da **empresa emissora**, então valem pra ON e PN juntas); **ETF** `name`, `methodology_summary`; **FII** e **renda fixa** `name`. **Somente leitura**, por decisão: ticker, tipo, classe de risco, setor, float em circulação (`outstanding_shares`, mexer reescreve a distribuição dos bots), `report_frequency_days` (a spec 3.3.1 fixa um ciclo global de 91 dias e o gatilho de evento macro, o FII e o ETF dependem dele), cesta do ETF e parâmetros de FII/renda fixa. Ativo do sandbox aparece marcado e nunca é editável (achado 023).

#### `GET /admin/catalog`

- **Sucesso:** `200` → `{ assets: [...] }`, todos os ativos (inclusive sandbox) ordenados por tipo e ticker. Cada item: `{ asset_id, ticker, name, type, risk_class | null, is_sandbox, share_class | null, outstanding_shares | null, editable: [campos], company | null, etf | null, fii | null, fixed_income | null }`. Só o bloco da classe vem preenchido (RF21). `company`: `{ company_id, name, sector, report_frequency_days, base_growth_pct, quality_multiplier }`. `etf`: `{ benchmark_index, methodology_summary | null, expense_ratio_pct, rebalance_frequency_days, holdings: [{ name, weight_pct }], holdings_total_weight_pct }`. `fii`: `{ fii_type, segment | null, vacancy_rate | null, indexador | null }`. `fixed_income`: `{ interest_rate | null, maturity_date | null, issuer_type, tax_exempt, credit_risk_rating | null, minimum_investment }`.
- **Erros:** `503`, `500`.

#### `PATCH /admin/catalog/{id}`

- **Payload (JSON):** qualquer subconjunto de `name` (1 a 100 caracteres), `base_growth_pct` (maior que -100), `quality_multiplier` (em (0, 2]), `methodology_summary` (até 1000 caracteres, vazio limpa), mais `admin_id` (UUID, informado pelo backend).
- **Sucesso:** `200` → o ativo já alterado, no mesmo formato de um item do `GET`.
- **Erros:** `400` — `id`/`admin_id` inválido, corpo que não é JSON ou campo com tipo errado; `404` — ativo inexistente; `422` — valor fora da regra (mensagem do domínio), campo somente leitura (`ticker`, `outstanding_shares`, `report_frequency_days`...), campo que não se aplica à classe, ativo do sandbox ou nenhum campo informado; `503`, `500`.
- **Regra:** a gravação trava a linha do ativo e valida de novo dentro da transação; nada é gravado se a validação falha.

#### Cadastro de ativo novo (tarefa N.13)

Pacotes: `engine/internal/domain/assetprovision/` (`Spec.Validate`, `Service.Preview`/`Create`) e `engine/internal/domain/botpool/` (id e personalidade dos bots direcionais, **compartilhados com o seed**: crescer o pool pelo painel gera exatamente os bots que o seed geraria). Adapter `db.AssetProvisionRepository`. Respondem `503` sem `httpserver.WithAssetProvision`.

O cadastro percorre o mesmo caminho do seed: (1) **catálogo numa transação só** (empresa, ativo, especialização e fundamentos iniciais calibrados pra o preço justo nascer em R$ 10, ou detalhes de FII/ETF; o ETF ganha a conta de fundo); (2) **pool de bots** cresce até `bot.PoolSize(nº de ativos negociáveis)` (nunca encolhe), com caixa e personalidade pros bots novos; (3) o float do ativo novo é distribuído entre o pool inteiro (`bot.InitialAllocation`, 50% pro grupo Market Maker); (4) **cobertura de Market Maker** por `coverage.Ensurer` (um Market Maker novo nasce se nenhum tem folga). **Nenhuma posição de ativo antigo é alterada**: bot antigo só ganha posição no ativo novo e bot novo só recebe posição no ativo novo. Ação e FII passam pelas quatro etapas; **ETF só pela primeira** (não tem float de bots nem Market Maker, a liquidez vem da criação de cotas pelo Participante Autorizado, igual ao seed).

Classes (`kind`): `acao` (cria a empresa emissora junto, uma ação ON; classe de risco derivada do setor: Mineração e Energia Conservador, o resto Sofisticado), `fii_tijolo`, `fii_papel`, `etf`. Ticker: ação `ABCD3` ou `ABCD4`, FII e ETF `ABCD11`. Não há exclusão de ativo (pode ter posição e histórico imutável).

#### `POST /admin/catalog/preview`

- **Payload (JSON):** `kind`, `ticker`, `name`, e os campos da classe. Ação: `company_name`, `cnpj` (14 dígitos), `sector` (um dos 6 fixos), `outstanding_shares` (1.000.000 a 2.000.000.000), `base_growth_pct` (maior que -100), `quality_multiplier` (em (0, 2]). FII de tijolo: `segment`, `vacancy_rate` (0 a 100). FII de papel: `indexador` (`CDI` ou `IPCA+`). ETF: `benchmark_index`, `methodology` (opcional), `holdings: [{ ticker, weight_pct }]` (1 a 30 ações ou FIIs já cadastrados, pesos somando 100).
- **Sucesso:** `200` → `{ kind, ticker, name, outstanding_shares | null, pool | null }`. `pool` (nulo em ETF): `{ pool_before, pool_after, new_bots, market_maker_shares, bot_shares, market_maker_id, creates_market_maker }`. Não grava nada.
- **Erros:** `400` corpo inválido; `409` ticker ou CNPJ já em uso; `422` `{ error, field }` regra de domínio (faixa, formato, constituinte inexistente ou de renda fixa, pesos); `503`, `500`.

#### `POST /admin/catalog`

- **Payload:** o mesmo do preview, mais `admin_id` (UUID, informado pelo backend).
- **Sucesso:** `201` → `{ asset_id, preview }`.
- **Erros:** os do preview (`400` também sem `admin_id`); `500` com `{ error, asset_id }` quando o catálogo gravou mas a etapa dos bots ou da cobertura falhou (o ativo existe e aparece sem cobertura no painel de bots, que reatribui; a ordem das etapas é a do seed: bots antes da cobertura).
