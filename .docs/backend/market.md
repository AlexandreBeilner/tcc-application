# `market` — proxy de leitura e escrita do motor de simulação

Módulo: `backend/src/modules/market/`. Maior gap identificado na revisão da Semana 6 (tarefa 6.0.3): até esta tarefa, nenhuma rota de catálogo/conta/execução do motor tinha proxy no backend — o gateway só expõe o `backend`, nunca o `engine/` diretamente, então o frontend não tinha nenhum caminho pra listar ativo, ver extrato ou executar uma ordem. Sem regra de negócio própria: a regra de fato (matching, precificação, marcação a mercado, Event Sourcing) vive inteira no `engine/` — este módulo só autentica (Bearer token) e repassa.

**Convenção de tradução adotada nesta tarefa:** rotas de catálogo/extrato/escrita são proxy 1:1 — mesmos nomes de campo do motor, em snake_case, sem tradução (mesma convenção já usada por `modules/admin` pros eventos macro). `GET /market/me/account` agrega 3 chamadas ao motor numa resposta nova, em camelCase — não é um proxy, é uma composição. `GET /market/orders` (tarefa O.3) é um meio-termo: proxy 1:1 de `GET /orders` (mesmo snake_case), mas enriquece cada linha com `ticker`/`name` via uma segunda chamada ao motor (`CatalogReader.getAsset`) — o motor não embute catálogo na resposta de ordens.

**Decisão de dependência (perguntada no início desta sessão, ver `getMyAccount.ts`):** `market` **não** reaproveita `GetNetWorthUseCase`/`CurrentAccountStateReader` de `modules/ranking`. Aquele caminho calcula um único número (patrimônio total, sandbox excluído) pro ranking; `GET /market/me/account` precisa da lista de posições completa (ticker/nome/tipo/quantidade) pra tela de portfólio do próprio usuário. Reaproveitar criaria uma dependência `market → ranking` só pra descartar metade do que aquele caso de uso calcula — `market` tem seus próprios adapters finos de leitura do motor (`infrastructure/engine/`).

**Escopo deliberadamente fora desta tarefa:** desbloqueio instantâneo de conquista (`achievementChecker`) após uma ordem/aporte real. O mecanismo lazy via `asOf` explícito (replay) já cobre isso, validado na tarefa 5.2 — acoplar `market` a `gamification` fica pra quando a percepção de feedback imediato virar um critério de aceite explícito, não decidido nesta sessão.

**Contrato de erro do proxy (tarefa RC.1.5):** todo erro vindo do motor chega ao cliente como `{ code, error, ...extras }`, nunca com o texto cru do motor. `code` é estável (o front decide comportamento por ele) e `error` é uma frase em português pensada para o usuário. Tradução em `interfaces/http/engineErrorTranslator.ts`: mensagem conhecida do motor vira um `code` da tabela (`insufficient_balance`, `insufficient_position`, `order_no_longer_available`, `order_not_found`, `order_not_cancellable`, `below_minimum_investment`, `position_not_found`, `asset_not_found`, `account_not_found`, `market_not_ready`, `asset_class_mismatch`, `service_unavailable`, `invalid_request`); mensagem **desconhecida nunca é repassada**, cai num genérico pelo status (`400 invalid_request`, `404 not_found`, `422 operation_rejected`, `5xx market_unavailable`, resto `unknown_error`). Erro que o motor já envia com `code` próprio (ex: `market_closed`, com `opens_on`/`days_until_open`) passa 1:1. Os exemplos de corpo de erro abaixo mostram o texto cru do motor por histórico; o que o cliente recebe é o texto traduzido.

**Não existe `GET /market/users/:id/account`** — só `/me/*`. Reforça RNF09 estruturalmente: valor absoluto de patrimônio nunca é exposto a outro usuário, e aqui isso é garantido pela ausência da rota, não por uma checagem condicional.

**Gate de desbloqueio por lição (tarefa 7.0.1):** diferente do resto do módulo, `PlaceOrderUseCase`/`PurchaseFixedIncomeUseCase` **têm** uma regra de negócio própria (não delegada ao motor) — o achado mais grave da revisão da Semana 7 era que qualquer usuário, mesmo sem completar nenhuma lição, já conseguia operar um ativo real. O `403` das duas rotas foge da convenção `{ error }` do resto do módulo: o corpo é `{ error, key, unlockingLesson }`, onde `key` é a chave travada (`asset:<AssetType>`) e `unlockingLesson` é `{ code, title }` da lição que a desbloqueia (`null` se nenhuma lição seedada ainda cobre a chave — currículo incompleto até a tarefa 7.1). Ver `ProductUnlockReader`/`inProcessProductUnlockReader.ts` (adapter em processo sobre `modules/lessons`, mesmo padrão de `modules/missions/infrastructure/lessons/inProcessLessonCompletionChecker.ts`).

---

## Catálogo (leitura — qualquer usuário autenticado)

### `GET /market/assets`

- **Autenticação:** Bearer token (qualquer usuário logado — o motor não tem conceito de usuário nessas rotas).
- **Payload:** query `type` (opcional) — um dos 11 valores do enum `asset_type` (ver `.docs/engine/catalog.md`); qualquer outro valor é `400`. Query `include_sandbox` (opcional, `true`/`false`, padrão `false`; qualquer outro valor é `400`).
- **Sucesso:** `200` → `{ assets: [...] }`, proxy de `GET /assets` do motor **sem os ativos `is_sandbox`** (S.8/achado 023: `SAND3`/`SANDPRE` não aparecem no mercado real). `include_sandbox=true` devolve o catálogo completo, pra quem precisa achar o ativo do Modo Aprendizado (lições por ticker) ou rotular ativos no extrato. `GET /market/assets/:id` segue achando qualquer ativo, sandbox inclusive.
- **Erros:** `400` — `type` inválido. `401` — token ausente/inválido. Qualquer erro do motor (`503`/`500`) é repassado com o mesmo status.
- **Regra:** `ListAssetsUseCase` → `CatalogReader.listAssets`, filtrando `is_sandbox` no backend (o motor continua devolvendo tudo).

### `GET /market/assets/:id`

- **Autenticação:** Bearer token.
- **Sucesso:** `200` → `{ asset: {...} }`, proxy 1:1 de `GET /assets/:id` (inclui o bloco por classe — `fixed_income`/`equity`/`etf`/`fii`, RF21). O bloco `fii` inclui `price_to_book_value` (opcional, U.6: cotação ÷ valor patrimonial por cota, omitido sem cotação/valor-base/cotas; detalhe em `.docs/engine/catalog.md`). O bloco `etf` inclui `nav`, `premium_pct`, `nav_day`, `shares_outstanding`, `tracking_error_pct` (opcionais) e `dividend_history` (R.11, detalhe em `.docs/engine/catalog.md`).
- **Erros:** `401`; `404` (traduzido do motor) — ativo não encontrado.
- **Regra:** `GetAssetUseCase` → `CatalogReader.getAsset`.

### `GET /market/assets/:id/quotes`

- **Autenticação:** Bearer token.
- **Payload:** query `days` (opcional, inteiro ≥ 1).
- **Sucesso:** `200` → `{ quotes: [...] }`, proxy 1:1 de `GET /assets/:id/quotes`.
- **Erros:** `400` — `days` inválido. `401`; `404` (traduzido do motor).
- **Regra:** `GetAssetQuotesUseCase` → `CatalogReader.getAssetQuotes`.

### `GET /market/assets/:id/book`

*(Tarefa S.5, `backlog-motor-mercado-realista.md` — proxy de `GET /assets/:id/book` do motor, ver `.docs/engine/orders.md`. Insumo do diálogo de ordem, S.7, e da marcação a ponto médio, S.6.)*

- **Autenticação:** Bearer token.
- **Payload:** nenhum — o backend sempre passa o `userId` do token pro motor (mesmo padrão de `GET /market/calendar`), nunca aceita um `user_id` da requisição.
- **Sucesso:** `200` → `{ book: {...} }`, proxy 1:1 de `GET /assets/:id/book`: `{ is_sandbox, price, best_bid, best_ask, mid_price, bids, asks }`. Ativo do Mercado Ao Vivo: `price` é `null`, `best_bid`/`best_ask`/`mid_price` são `null` quando o lado correspondente do book está vazio (`mid_price` também fica `null` com só um lado disponível), `bids`/`asks` são `null` (não `[]`) no mesmo caso — cada nível (`{ price, quantity }`) é a soma agregada de ordens `limit` pendentes naquele preço, nunca id nem dono de ordem individual, recortado aos 5 melhores preços de cada lado. Ativo sandbox: só `price` vem preenchido (preço do roteiro, resolvido pelo `userId` do token), os 5 campos de book vêm todos `null` — sandbox nunca teve, nem vai ter, contraparte real.
- **Erros:** `401`; `404` (traduzido do motor) — ativo não encontrado.
- **Regra:** `GetAssetBookUseCase` → `CatalogReader.getAssetBook(id, userId)`.

### `GET /market/companies/:id`

- **Autenticação:** Bearer token.
- **Sucesso:** `200` → `{ company: {...} }`, proxy 1:1 de `GET /companies/:id`.
- **Erros:** `401`; `404` (traduzido do motor).
- **Regra:** `GetCompanyUseCase` → `CatalogReader.getCompany`.

### `GET /market/indicators`

*(Tarefa M.3, `backlog-motor-mercado-realista.md` — proxy de `GET /market/indicators/history` do motor, ver `.docs/engine/tick.md`.)*

- **Autenticação:** Bearer token — qualquer usuário autenticado, sem regra de negócio própria (mesma convenção do resto desta seção).
- **Payload:** query `days` (opcional, inteiro ≥ 1 — `indicatorHistoryQuerySchema`, coerção via `z.coerce`, mesma convenção de `GET /market/assets/:id/quotes`). Sem default próprio neste módulo — omitido, o motor aplica o dele (`defaultIndicatorHistoryDays = 90`).
- **Sucesso:** `200` → `{ indicators: [...] }`, proxy 1:1 de `GET /market/indicators/history` (`[{ simulated_day, selic_rate, ipca_monthly_rate, ipca_accumulated_12m }, ...]`, cronológico, mais antigo primeiro). Lista vazia (não erro) se o Temporizador nunca rodou ainda — mesmo tratamento de `GET /market/assets/:id/quotes`.
- **Erros:** `400` — `days` inválido. `401`. Qualquer erro do motor (`503`/`500`) é repassado com o mesmo status.
- **Regra:** `GetIndicatorHistoryUseCase` → `IndicatorHistoryReader.getIndicatorHistory` (port própria do módulo, não estende `CatalogReader` — indicador macro não é um ativo do catálogo). Composição em `app.ts` decora o adapter do motor (`engineIndicatorHistoryReader.ts`) com cache Redis (`createRedisIndicatorHistoryCache`/`redisIndicatorHistoryCacheStore.ts`, mesmo padrão de `createRedisNetWorthCache` do módulo `ranking`, tarefa 5.7) — TTL curto (5 minutos, ilustrativo/sujeito a calibração), chave por `days` (não por usuário, já que a série é a mesma pra qualquer chamador). Redis fora do ar nunca derruba a leitura — cai pro motor direto (mesma garantia best-effort do cache de `ranking`).

---

### `GET /market/clock`

*(Tarefa S.10, `backlog-motor-mercado-realista.md` — proxy de `GET /market/clock` do motor, ver `.docs/engine/calendar.md`.)*

- **Autenticação:** Bearer token — qualquer usuário autenticado.
- **Payload:** nenhum.
- **Sucesso:** `200` → proxy 1:1 do motor: `{ simulated_day, date, weekday, market_open, days_until_open, days_per_real_day, next_tick_at, quarter_day, quarter_length }` (`next_tick_at` é `null` com a agenda automática desligada).
- **Erros:** `401`. Erro do motor (`500`/`503`) repassado com o mesmo status.
- **Regra:** `GetMarketClockUseCase` → `MarketCalendarReader.getClock` (port própria do módulo). Sem regra de negócio no backend.

### `GET /market/halts`

*(Tarefa N.9 — proxy de `GET /market/halts` do motor, ver `.docs/engine/admin.md`, "Pausa de negociação".)*

- **Autenticação:** Bearer token (qualquer usuário).
- **Sucesso:** `200` → `{ global: bool, asset_ids: [uuid] }`: se há pausa de negociação global vigente e em quais ativos há pausa própria. Alimenta o aviso "Negociação pausada" do detalhe do ativo.
- **Regra:** nunca expõe o motivo interno nem quem pausou. Com pausa vigente, `POST /market/orders` devolve `409` com `{ error, code: "trading_halted", scope: "global" | "asset" }`, repassado 1:1 do motor; cancelar ordem e o ativo sandbox seguem abertos.

### `GET /market/calendar`

*(Tarefa S.10 — proxy de `GET /market/calendar` do motor, ver `.docs/engine/calendar.md`.)*

- **Autenticação:** Bearer token — qualquer usuário autenticado.
- **Payload:** query `from` e `to` (opcionais, `AAAA-MM-DD` — `marketCalendarQuerySchema`). Sem elas o motor usa a janela padrão (uma semana atrás, duas à frente). `scope` (`mine` ou `all`; sem ele o motor devolve `all`) e `market_limit` (inteiro de 0 a 200; sem ele o motor usa 50) controlam o recorte (RC.6.2): `mine` devolve só o que afeta o usuário, e `market_limit` limita quantos fatos de mercado vêm, os mais próximos de hoje.
- **Sucesso:** `200` → proxy 1:1: `{ from_day, to_day, market_total, market_shown, days: [{ simulated_day, date, weekday, market_open, summary: { mine_count, market_count }, events: [...] }] }`, fatos globais do mercado mais os do próprio usuário (ordens, proventos recebidos, aportes, resgates e vencimentos de renda fixa). Cada evento traz `relevance` (`mine` ou `market`) e, em `mine`, `relevance_reason`, mais `user_quantity`, `estimated_amount` e `amount_is_estimate` quando há provento do próprio usuário; `summary` e `market_total` contam antes do corte por `market_limit`. Formato completo dos eventos e regras de relevância em `.docs/engine/calendar.md`.
- **Erros:** `400` — data fora do formato, `scope` diferente de `mine`/`all` ou `market_limit` fora de 0 a 200 (validação Zod aqui) ou janela inválida (`from > to`, mais de 92 dias, validada no motor). `401`. Erro do motor repassado com o mesmo status.
- **Regra:** `GetMarketCalendarUseCase` passa sempre o `userId` do token; um `user_id` na query é ignorado, então ninguém enxerga fato de terceiros (RNF09). Evento macro ainda não disparado nunca aparece.

---

## Conta do próprio usuário (leitura)

### `GET /market/me/account`

- **Autenticação:** Bearer token — `userId` sempre de `req.auth.userId`, nunca de parâmetro.
- **Sucesso:** `200` → `{ cashBalance, totalInvested, totalDividendsReceived, positions: [...], fixedIncomePositions: [...] }`. Cada posição já vem com `assetId`/`ticker`/`name`/`type`/`isSandbox`/`quantity`/`averagePrice` (mais `averageRate` pra renda fixa) — insumo direto pro donut de distribuição e a separação visual "Mercado Ao Vivo vs. Sandbox" da tela 2.1 (o frontend agrupa por `isSandbox`, esta rota não separa em dois blocos: `cashBalance`/`totalInvested` não têm equivalente sandbox — é a mesma conta, só os ativos negociados é que têm a flag). Posição de renda variável (`positions`, não `fixedIncomePositions`) também traz `dividendsReceived` (tarefa S.15) — proventos recebidos nesse ativo em R$, 1:1 com o `dividends_received` já agregado pelo motor (`GET /positions`), sempre presente, `0` sem provento nenhum. Posição de renda variável do Mercado Ao Vivo (`isSandbox: false`) também traz `markPrice` (tarefa S.6) — preço de marcação a mercado: o ponto médio do book do ativo (`GET /assets/:id/book`, S.5) quando os dois lados têm oferta pendente, senão o último preço negociado (`GET /assets`); `domain/markPrice.ts`. Posição sandbox nunca traz `markPrice` (nunca teve book real, RF12/RNF08) — o frontend cai pro `averagePrice` (custo) nesse caso.
- **Erros:** `401`. Qualquer erro do motor nas chamadas agregadas (`GET /accounts/:id`, `GET /positions`, `GET /fixed-income/positions`, mais um `GET /assets` e um `GET /assets/:id/book` por ativo distinto de renda variável real na carteira, pra `markPrice`) é repassado com o mesmo status.
- **Regra:** `GetMyAccountUseCase` — único caso de uso do módulo com lógica própria (agregação + tradução camelCase + `markPrice`), documentada em `getMyAccount.ts`.

### `GET /market/me/events`

- **Autenticação:** Bearer token — `userId` de `req.auth.userId`.
- **Payload:** query `limit` (1–100, default do motor 20) / `offset` (≥ 0, default 0).
- **Sucesso:** `200` → `{ events: [...] }`, proxy 1:1 de `GET /accounts/:user_id/events` (extrato, RF05, tela 4.8). Sem filtro por `event_type`/data nesta tarefa — o motor não filtra, só pagina; o frontend filtra client-side (ver nota da tarefa 6.5 no backlog).
- **Erros:** `400` — paginação inválida. `401`.
- **Regra:** `ListMyEventsUseCase` → `AccountReader.listAccountEvents`.

---

## Execução real (escrita — RF01–RF03)

`user_id` nunca é aceito no corpo da requisição em nenhuma das 3 rotas abaixo — mesmo se o cliente enviar, é ignorado: o router sempre injeta `req.auth.userId` antes de repassar pro motor (impede operar em nome de outro usuário).

### `POST /market/orders`

- **Autenticação:** Bearer token.
- **Payload:** `asset_id` (UUID), `side` (`buy`/`sell`), `type` (`market`/`limit`), `price` (obrigatório e > 0 só se `type = limit`), `quantity` (inteiro > 0) — ver `.docs/engine/orders.md`.
- **Sucesso:** `201` → `{ order_id, filled_quantity, remaining_quantity, fills: [...] }`, corpo idêntico ao do motor. `order_id` (tarefa O.3) é o id da ordem recém-criada, necessário pra chamar `POST /market/orders/:id/cancel` depois.
- **Erros:** `400` — payload inválido (Zod) ou ativo não é de renda variável (motor). `401`; `403` — produto travado pela trilha (tarefa 7.0.1, abaixo); `404` — ativo/conta não encontrados; `422` — saldo/posição insuficiente **ou** a ordem pendurada que seria casada foi cancelada pelo dono entre a leitura e a escrita do match (achado ao vivo/corrigido na sessão da tarefa O.1, ver `.docs/engine/orders.md`) — traduzido do motor, nada é persistido; **`409` com `code: "trading_halted"`** (tarefa N.9) quando há pausa de negociação vigente no ativo ou global: `{ error, code, scope }`, repassado 1:1 do motor. **`422` com `code: "market_closed"`** (tarefa S.11) em sábado/domingo simulado: `{ error, code, opens_on, days_until_open }`, repassado 1:1 do motor (o `EngineRequestError` carrega os campos extras em `details`). Ativo sandbox segue aberto; cancelar ordem também.
- **Regra:** `PlaceOrderUseCase` → resolve o `AssetType` do ativo (`CatalogReader.getAsset`) e, se **não for sandbox**, exige `asset:<type>` no conjunto de chaves desbloqueadas do usuário (`ProductUnlockReader`, port sobre `modules/lessons` — tarefa 7.0.1) antes de repassar pro `OrderExecutor.submit`. Sandbox (`is_sandbox = true`) segue isento (RF12). Validado ponta a ponta via `docker compose up`: uma ordem `market` reflete em `GET /market/me/account`/`GET /market/me/events` imediatamente. Desde a tarefa A.2 (backlog-motor-mercado-realista), ordem `market` de ativo do Mercado Ao Vivo só executa a parte com contraparte real disponível (`remaining_quantity` reporta a sobra não executada, sem erro) — só ativo sandbox mantém a execução garantida via liquidez sintética (`.docs/engine/orders.md`).

### `POST /market/orders/:id/cancel`

*(Tarefa O.1, `backlog-motor-mercado-realista.md` — cancelamento manual de ordem pendente/parcial.)*

- **Autenticação:** Bearer token. `user_id` nunca é aceito de parâmetro/corpo — sempre `req.auth.userId`, mesma convenção das outras rotas de escrita desta seção.
- **Payload:** nenhum — `id` (UUID da ordem) vem da URL.
- **Sucesso:** `204`, sem corpo.
- **Erros:** `401`; `404` (traduzido do motor) — ordem não encontrada **ou** pertence a outro usuário (as duas causas colapsam no mesmo erro no motor, de propósito); `409` (traduzido do motor) — ordem já `filled`/`cancelled`.
- **Regra:** `CancelOrderUseCase` → `OrderExecutor.cancel` — proxy fino, sem regra de negócio própria (diferente de `PlaceOrderUseCase`, não passa pelo gate de desbloqueio da 7.0.1: cancelar não é "comprar produto travado"). Ver `.docs/engine/orders.md` pro detalhe de por que `filled_quantity` já executado não é revertido.

### `GET /market/orders`

*(Tarefa O.3, `backlog-motor-mercado-realista.md` — fecha o achado 012 em `pontos-em-aberto-decisao-produto.md`: sem esta rota, nenhum cliente tinha como descobrir qual `order_id` passar pra `POST /market/orders/:id/cancel` depois de um reload de página.)*

- **Autenticação:** Bearer token. Sem query string aceita do cliente — `user_id` sempre `req.auth.userId`, mesma convenção das outras rotas desta seção.
- **Sucesso:** `200` → `{ orders: [{ order_id, asset_id, ticker, name, side, type, quantity, filled_quantity, price, status, cancel_reason, created_at }] }`, mais recente primeiro, sem paginação nem filtro de status (escopo de protótipo) — `[]` se o usuário não tem ordem nenhuma. `cancel_reason` só aparece pra ordem `cancelled` (`user_cancelled`/`expired`/`no_liquidity`/`insufficient_funds`/`admin`/`requoted` — todos menos `requoted` podem aparecer pra um usuário real; `admin` é o cancelamento por intervenção do painel, tarefa N.10; destes, `insufficient_funds` é a ordem em repouso que o motor pulou porque o dono não tinha mais saldo/posição no momento do match, achado 015; `requoted` só acontece com bot Market Maker). O agrupamento em Pendentes/Executadas/Recusadas (tela "Minhas Ordens", O.4) é responsabilidade do frontend, não desta rota.
- **Erros:** `401`.
- **Regra:** `ListMyOrdersUseCase` → `OrderExecutor.list` (motor devolve `asset_id` cru) + `CatalogReader.getAsset` (deduplicado por `asset_id` — a mesma ação costuma se repetir em várias ordens) pra enriquecer cada linha com `ticker`/`name`, mesmo padrão de `assertProductUnlocked` já usar `getAsset` por id em vez do motor embutir o catálogo em cada rota. Ver `.docs/engine/orders.md` pro formato cru que o motor devolve.

### `GET /market/fixed-income/simulate`

*(Tarefa 6.0.5 — proxy de `GET /fixed-income/simulate`, ver `.docs/engine/fixedincome.md`.)*

- **Autenticação:** Bearer token — qualquer usuário autenticado, sem exigir dono de conta específica (a simulação não depende de `user_id`, diferente das duas rotas abaixo).
- **Query params:** `asset_id` (UUID, obrigatório), `amount` (número > 0, obrigatório), `days_held` (inteiro > 0, obrigatório) — `simulateFixedIncomeQuerySchema`, coerção via `z.coerce` (query string chega sempre como string).
- **Sucesso:** `200` → `{ unit_price, quantity_purchased, gross_projected_value, tax_rate, net_projected_value }`, corpo idêntico ao do motor. Nenhuma escrita — não passa por `market_events`.
- **Erros:** `400` — query inválida (Zod) ou ativo não é de renda fixa (motor). `401`; `404` — ativo não encontrado.
- **Regra:** `SimulateFixedIncomeUseCase` → `FixedIncomeExecutor.simulate`. Sustenta o simulador de aporte da tela 4.3. A Calculadora (6.7) **não** usa esta rota — decisão (b) do backlog, ver `GET /market/fixed-income/tax-rate` abaixo.

### `GET /market/fixed-income/tax-rate`

*(Tarefa 6.7 — proxy de `GET /fixed-income/tax-rate`, ver `.docs/engine/fixedincome.md`.)*

- **Autenticação:** Bearer token — qualquer usuário autenticado, sem exigir dono de conta específica (não depende de `user_id`).
- **Query params:** `days_held` (inteiro > 0, obrigatório) — `fixedIncomeTaxRateQuerySchema`, coerção via `z.coerce`.
- **Sucesso:** `200` → `{ tax_rate }`, corpo idêntico ao do motor.
- **Erros:** `400` — query inválida (Zod). `401`.
- **Regra:** `GetFixedIncomeTaxRateUseCase` → `FixedIncomeExecutor.getTaxRate`. Sustenta a Calculadora em modo comparação (6.2, lição 3.3 — "CDB 110% CDI líquido vs. LCI 90% CDI isento"): os dois produtos são hipotéticos digitados pelo usuário (juros compostos calculados no cliente), não um `asset_id` real do catálogo — este endpoint só resolve a alíquota de IR pro prazo informado, mais barato que `GET /market/fixed-income/simulate` (que exige `asset_id`/`amount`).

### `POST /market/fixed-income/purchases`

- **Autenticação:** Bearer token.
- **Payload:** `asset_id` (UUID), `amount` (> 0, valor do aporte em R$) — ver `.docs/engine/fixedincome.md`.
- **Sucesso:** `201` → `{ unit_price, quantity_purchased, position: {...} }`, corpo idêntico ao do motor.
- **Erros:** `400` — payload inválido ou ativo não é de renda fixa. `401`; `403` — produto travado pela trilha (tarefa 7.0.1, mesmo gate de `POST /market/orders` acima); `404`; `422` — abaixo do aporte mínimo ou saldo insuficiente, ou `code: "market_closed"` em fim de semana simulado (mesmo corpo de `POST /market/orders`).
- **Regra:** `PurchaseFixedIncomeUseCase` → mesmo gate de desbloqueio de `POST /market/orders` (não se aplica ao resgate, `POST /market/fixed-income/redemptions` abaixo — resgatar uma posição já existente não é "comprar produto travado") → `FixedIncomeExecutor.purchase`. Validado ponta a ponta via `docker compose up`.

### `POST /market/fixed-income/redemptions`

- **Autenticação:** Bearer token.
- **Payload:** `asset_id` (UUID). Resgate é sempre integral (sem campo de quantidade/valor, mesma regra do motor).
- **Sucesso:** `200` → `{ total_value, net_value, tax_rate, mark_to_market: {...} }`, corpo idêntico ao do motor. `net_value`/`tax_rate` (tarefa 6.0.5) são o líquido de IR regressivo e a alíquota aplicada — `net_value = total_value` se o ativo é isento ou não houve lucro no resgate.
- **Erros:** `400` — payload inválido ou ativo não é de renda fixa. `401`; `404` — usuário sem posição nesse título; `422` com `code: "market_closed"` em fim de semana simulado (título sandbox segue aberto).
- **Regra:** `RedeemFixedIncomeUseCase` → `FixedIncomeExecutor.redeem`.
