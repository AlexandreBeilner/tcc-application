# `market` — proxy de leitura e escrita do motor de simulação

Módulo: `backend/src/modules/market/`. Maior gap identificado na revisão da Semana 6 (tarefa 6.0.3): até esta tarefa, nenhuma rota de catálogo/conta/execução do motor tinha proxy no backend — o gateway só expõe o `backend`, nunca o `engine/` diretamente, então o frontend não tinha nenhum caminho pra listar ativo, ver extrato ou executar uma ordem. Sem regra de negócio própria: a regra de fato (matching, precificação, marcação a mercado, Event Sourcing) vive inteira no `engine/` — este módulo só autentica (Bearer token) e repassa.

**Convenção de tradução adotada nesta tarefa:** rotas de catálogo/extrato/escrita são proxy 1:1 — mesmos nomes de campo do motor, em snake_case, sem tradução (mesma convenção já usada por `modules/admin` pros eventos macro). A única exceção é `GET /market/me/account`, que agrega 3 chamadas ao motor numa resposta nova, em camelCase — não é um proxy, é uma composição.

**Decisão de dependência (perguntada no início desta sessão, ver `getMyAccount.ts`):** `market` **não** reaproveita `GetNetWorthUseCase`/`CurrentAccountStateReader` de `modules/ranking`. Aquele caminho calcula um único número (patrimônio total, sandbox excluído) pro ranking; `GET /market/me/account` precisa da lista de posições completa (ticker/nome/tipo/quantidade) pra tela de portfólio do próprio usuário. Reaproveitar criaria uma dependência `market → ranking` só pra descartar metade do que aquele caso de uso calcula — `market` tem seus próprios adapters finos de leitura do motor (`infrastructure/engine/`).

**Escopo deliberadamente fora desta tarefa:** desbloqueio instantâneo de conquista (`achievementChecker`) após uma ordem/aporte real. O mecanismo lazy via `asOf` explícito (replay) já cobre isso, validado na tarefa 5.2 — acoplar `market` a `gamification` fica pra quando a percepção de feedback imediato virar um critério de aceite explícito, não decidido nesta sessão.

**Não existe `GET /market/users/:id/account`** — só `/me/*`. Reforça RNF09 estruturalmente: valor absoluto de patrimônio nunca é exposto a outro usuário, e aqui isso é garantido pela ausência da rota, não por uma checagem condicional.

---

## Catálogo (leitura — qualquer usuário autenticado)

### `GET /market/assets`

- **Autenticação:** Bearer token (qualquer usuário logado — o motor não tem conceito de usuário nessas rotas).
- **Payload:** query `type` (opcional) — um dos 11 valores do enum `asset_type` (ver `.docs/engine/catalog.md`); qualquer outro valor é `400`.
- **Sucesso:** `200` → `{ assets: [...] }`, proxy 1:1 de `GET /assets` do motor.
- **Erros:** `400` — `type` inválido. `401` — token ausente/inválido. Qualquer erro do motor (`503`/`500`) é repassado com o mesmo status.
- **Regra:** `ListAssetsUseCase` → `CatalogReader.listAssets`.

### `GET /market/assets/:id`

- **Autenticação:** Bearer token.
- **Sucesso:** `200` → `{ asset: {...} }`, proxy 1:1 de `GET /assets/:id` (inclui o bloco por classe — `fixed_income`/`equity`/`etf`/`fii`, RF21).
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
- **Sucesso:** `201` → `{ filled_quantity, remaining_quantity, fills: [...] }`, corpo idêntico ao do motor.
- **Erros:** `400` — payload inválido (Zod) ou ativo não é de renda variável (motor). `401`; `404` — ativo/conta não encontrados; `422` — saldo/posição insuficiente (traduzido do motor, nada é persistido).
- **Regra:** `PlaceOrderUseCase` → `OrderExecutor.submit`. Validado ponta a ponta via `docker compose up`: uma ordem `market` real executa contra liquidez sintética e reflete em `GET /market/me/account`/`GET /market/me/events` imediatamente.

### `POST /market/fixed-income/purchases`

- **Autenticação:** Bearer token.
- **Payload:** `asset_id` (UUID), `amount` (> 0, valor do aporte em R$) — ver `.docs/engine/fixedincome.md`.
- **Sucesso:** `201` → `{ unit_price, quantity_purchased, position: {...} }`, corpo idêntico ao do motor.
- **Erros:** `400` — payload inválido ou ativo não é de renda fixa. `401`; `404`; `422` — abaixo do aporte mínimo ou saldo insuficiente.
- **Regra:** `PurchaseFixedIncomeUseCase` → `FixedIncomeExecutor.purchase`. Validado ponta a ponta via `docker compose up`.

### `POST /market/fixed-income/redemptions`

- **Autenticação:** Bearer token.
- **Payload:** `asset_id` (UUID). Resgate é sempre integral (sem campo de quantidade/valor, mesma regra do motor).
- **Sucesso:** `200` → `{ total_value, mark_to_market: {...} }`, corpo idêntico ao do motor.
- **Erros:** `400` — payload inválido ou ativo não é de renda fixa. `401`; `404` — usuário sem posição nesse título.
- **Regra:** `RedeemFixedIncomeUseCase` → `FixedIncomeExecutor.redeem`.
