# `market` — proxy de leitura e escrita do motor de simulação

Módulo: `backend/src/modules/market/`. Maior gap identificado na revisão da Semana 6 (tarefa 6.0.3): até esta tarefa, nenhuma rota de catálogo/conta/execução do motor tinha proxy no backend — o gateway só expõe o `backend`, nunca o `engine/` diretamente, então o frontend não tinha nenhum caminho pra listar ativo, ver extrato ou executar uma ordem. Sem regra de negócio própria: a regra de fato (matching, precificação, marcação a mercado, Event Sourcing) vive inteira no `engine/` — este módulo só autentica (Bearer token) e repassa.

**Convenção de tradução adotada nesta tarefa:** rotas de catálogo/extrato/escrita são proxy 1:1 — mesmos nomes de campo do motor, em snake_case, sem tradução (mesma convenção já usada por `modules/admin` pros eventos macro). `GET /market/me/account` agrega 3 chamadas ao motor numa resposta nova, em camelCase — não é um proxy, é uma composição. `GET /market/orders` (tarefa O.3) é um meio-termo: proxy 1:1 de `GET /orders` (mesmo snake_case), mas enriquece cada linha com `ticker`/`name` via uma segunda chamada ao motor (`CatalogReader.getAsset`) — o motor não embute catálogo na resposta de ordens.

**Decisão de dependência (perguntada no início desta sessão, ver `getMyAccount.ts`):** `market` **não** reaproveita `GetNetWorthUseCase`/`CurrentAccountStateReader` de `modules/ranking`. Aquele caminho calcula um único número (patrimônio total, sandbox excluído) pro ranking; `GET /market/me/account` precisa da lista de posições completa (ticker/nome/tipo/quantidade) pra tela de portfólio do próprio usuário. Reaproveitar criaria uma dependência `market → ranking` só pra descartar metade do que aquele caso de uso calcula — `market` tem seus próprios adapters finos de leitura do motor (`infrastructure/engine/`).

**Escopo deliberadamente fora desta tarefa:** desbloqueio instantâneo de conquista (`achievementChecker`) após uma ordem/aporte real. O mecanismo lazy via `asOf` explícito (replay) já cobre isso, validado na tarefa 5.2 — acoplar `market` a `gamification` fica pra quando a percepção de feedback imediato virar um critério de aceite explícito, não decidido nesta sessão.

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
- **Sucesso:** `200` → `{ asset: {...} }`, proxy 1:1 de `GET /assets/:id` (inclui o bloco por classe — `fixed_income`/`equity`/`etf`/`fii`, RF21). O bloco `etf` inclui `nav`, `premium_pct`, `nav_day`, `shares_outstanding`, `tracking_error_pct` (opcionais) e `dividend_history` (R.11, detalhe em `.docs/engine/catalog.md`).
- **Erros:** `401`; `404` (traduzido do motor) — ativo não encontrado.
- **Regra:** `GetAssetUseCase` → `CatalogReader.getAsset`.

### `GET /market/assets/:id/quotes`

- **Autenticação:** Bearer token.
- **Payload:** query `days` (opcional, inteiro ≥ 1).
- **Sucesso:** `200` → `{ quotes: [...] }`, proxy 1:1 de `GET /assets/:id/quotes`.
- **Erros:** `400` — `days` inválido. `401`; `404` (traduzido do motor).
- **Regra:** `GetAssetQuotesUseCase` → `CatalogReader.getAssetQuotes`.

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

## Conta do próprio usuário (leitura)

### `GET /market/me/account`

- **Autenticação:** Bearer token — `userId` sempre de `req.auth.userId`, nunca de parâmetro.
- **Sucesso:** `200` → `{ cashBalance, totalInvested, totalDividendsReceived, positions: [...], fixedIncomePositions: [...] }`. Cada posição já vem com `assetId`/`ticker`/`name`/`type`/`isSandbox`/`quantity`/`averagePrice` (mais `averageRate` pra renda fixa) — insumo direto pro donut de distribuição e a separação visual "Mercado Ao Vivo vs. Sandbox" da tela 2.1 (o frontend agrupa por `isSandbox`, esta rota não separa em dois blocos: `cashBalance`/`totalInvested` não têm equivalente sandbox — é a mesma conta, só os ativos negociados é que têm a flag).
- **Erros:** `401`. Qualquer erro do motor nas 3 chamadas agregadas (`GET /accounts/:id`, `GET /positions`, `GET /fixed-income/positions`) é repassado com o mesmo status.
- **Regra:** `GetMyAccountUseCase` — único caso de uso do módulo com lógica própria (agregação + tradução camelCase), documentada em `getMyAccount.ts`.

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
- **Erros:** `400` — payload inválido (Zod) ou ativo não é de renda variável (motor). `401`; `403` — produto travado pela trilha (tarefa 7.0.1, abaixo); `404` — ativo/conta não encontrados; `422` — saldo/posição insuficiente **ou** a ordem pendurada que seria casada foi cancelada pelo dono entre a leitura e a escrita do match (achado ao vivo/corrigido na sessão da tarefa O.1, ver `.docs/engine/orders.md`) — traduzido do motor, nada é persistido.
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
- **Sucesso:** `200` → `{ orders: [{ order_id, asset_id, ticker, name, side, type, quantity, filled_quantity, price, status, cancel_reason, created_at }] }`, mais recente primeiro, sem paginação nem filtro de status (escopo de protótipo) — `[]` se o usuário não tem ordem nenhuma. `cancel_reason` só aparece pra ordem `cancelled` (`user_cancelled`/`expired`/`no_liquidity`/`insufficient_funds`/`requoted` — os 4 primeiros podem aparecer pra um usuário real, `insufficient_funds` é a ordem em repouso que o motor pulou porque o dono não tinha mais saldo/posição no momento do match, achado 015; `requoted` só acontece com bot Market Maker). O agrupamento em Pendentes/Executadas/Recusadas (tela "Minhas Ordens", O.4) é responsabilidade do frontend, não desta rota.
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
- **Erros:** `400` — payload inválido ou ativo não é de renda fixa. `401`; `403` — produto travado pela trilha (tarefa 7.0.1, mesmo gate de `POST /market/orders` acima); `404`; `422` — abaixo do aporte mínimo ou saldo insuficiente.
- **Regra:** `PurchaseFixedIncomeUseCase` → mesmo gate de desbloqueio de `POST /market/orders` (não se aplica ao resgate, `POST /market/fixed-income/redemptions` abaixo — resgatar uma posição já existente não é "comprar produto travado") → `FixedIncomeExecutor.purchase`. Validado ponta a ponta via `docker compose up`.

### `POST /market/fixed-income/redemptions`

- **Autenticação:** Bearer token.
- **Payload:** `asset_id` (UUID). Resgate é sempre integral (sem campo de quantidade/valor, mesma regra do motor).
- **Sucesso:** `200` → `{ total_value, net_value, tax_rate, mark_to_market: {...} }`, corpo idêntico ao do motor. `net_value`/`tax_rate` (tarefa 6.0.5) são o líquido de IR regressivo e a alíquota aplicada — `net_value = total_value` se o ativo é isento ou não houve lucro no resgate.
- **Erros:** `400` — payload inválido ou ativo não é de renda fixa. `401`; `404` — usuário sem posição nesse título.
- **Regra:** `RedeemFixedIncomeUseCase` → `FixedIncomeExecutor.redeem`.
