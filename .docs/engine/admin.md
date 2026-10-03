# `admin` — leituras do painel administrativo (Fase N)

Rotas internas de **leitura** do painel (tarefa N.5), mesma convenção de `POST /admin/tick`: sem checagem de role no motor, o backend valida `role = admin` antes de repassar (ver `.docs/backend/admin.md`). O controle do Temporizador está em `tick.md`. Pacote de domínio: `engine/internal/domain/adminview/` (modelos de leitura); consultas em `internal/infra/db/admin_read_repository.go`. Nada aqui grava saldo, posição ou evento. Respondem `503` se o motor subiu sem `DATABASE_URL` (sem `httpserver.WithAdminReader`).

---

### `GET /admin/overview`

- **Autenticação:** interno (ver acima).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ simulated_day, selic_rate, ipca_monthly | null, ipca_accumulated_12m | null, pending_macro_events, uncovered_assets, tradable_assets, active_bots, total_bots, day_trades, day_volume, resting_orders }`.
- **Erros:** `503` — sem banco; `500` — falha de leitura.
- **Regra:** uma chamada agrega o recorte do mercado, sem consulta por ativo. Selic e IPCA vêm da última linha de `market_indicator_history` (sem histórico ainda, a Selic cai pra `market_calendar` e o IPCA fica `null`). `pending_macro_events` são eventos disparados que o próximo tick ainda aplica. `uncovered_assets` conta ativos negociáveis (ação, ETF e FII que não sejam sandbox) **agora** sem Market Maker ativo cobrindo (é a leitura ao vivo, diferente de `uncovered_assets_count` do tick, que é a foto do último tick). `day_trades`/`day_volume` são as execuções do dia simulado corrente: uma por ordem de compra executada (`buy_order_executed`), volume em R$ (`quantidade × preço`). `resting_orders` são as ordens `limit` abertas no book.
