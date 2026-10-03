# `admin` — leituras do painel administrativo (Fase N)

Rotas internas de **leitura** do painel (tarefas N.5 e N.8), mesma convenção de `POST /admin/tick`: sem checagem de role no motor, o backend valida `role = admin` antes de repassar (ver `.docs/backend/admin.md`). O controle do Temporizador está em `tick.md`. Pacote de domínio: `engine/internal/domain/adminview/` (modelos de leitura e fórmulas puras: spread, variação, indicador por classe); consultas em `internal/infra/db/admin_read_repository.go`. Nada aqui grava saldo, posição ou evento. Respondem `503` se o motor subiu sem `DATABASE_URL` (sem `httpserver.WithAdminReader`).

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
