# `calendar` — relógio e linha do tempo do mercado simulado

Pacote de domínio: `engine/internal/domain/marketcalendar/` (`ClockAt`, `Service`). Handlers: `engine/internal/infra/httpserver/calendar.go`. Leitura: `engine/internal/infra/db/calendar_repository.go`. Tarefa S.10 do `backlog-motor-mercado-realista.md`.

Rotas internas do motor, sem porta publicada (mesma convenção das demais): a autenticação é do backend, que repassa o id do usuário do token. Ambas respondem `503` sem `DATABASE_URL`.

O dia simulado é dia de **calendário** (7 por semana, data-base fixa numa segunda-feira, `simcalendar`). O mercado fica fechado em sábado e domingo simulados (a recusa de ordem em si é a tarefa S.11). Datas em `AAAA-MM-DD`; `weekday` em código estável (`sun`, `mon`, `tue`, `wed`, `thu`, `fri`, `sat`) que o frontend traduz.

### `GET /market/clock`

- **Payload:** nenhum.
- **Sucesso:** `200` →
  `{ simulated_day, date, weekday, market_open, days_until_open, days_per_real_day, next_tick_at, quarter_day, quarter_length }`.
  `days_until_open` é 0 com o mercado aberto (sábado 2, domingo 1). `days_per_real_day` vem de `SIMULATION_DAYS_PER_REAL_DAY` (padrão 5). `next_tick_at` (RFC 3339, UTC) é o início do próximo slot da agenda do tick (S.3); **`null` quando a agenda automática está desligada** (`TICK_SCHEDULER_ENABLED=false`). `quarter_day` vai de 1 a `quarter_length` (91); o dia de relatório é o último do trimestre.
- **Erros:** `500` (falha de leitura), `503`.
- **Regra:** tudo deriva de `market_calendar.current_day`; motor que nunca rodou tick fica no dia 0.

### `GET /market/calendar`

- **Payload:** query `from` e `to` (opcionais, `AAAA-MM-DD`), `user_id` (opcional, UUID). Sem `from`/`to`: uma semana atrás até duas à frente do dia corrente (nunca antes do dia 0). Só `from`: 21 dias a partir dele.
- **Sucesso:** `200` → `{ from_day, to_day, days: [{ simulated_day, date, weekday, market_open, events: [...] }] }`, **um item por dia da janela** (dias sem fato vêm com `events: []`). Cada evento: `{ kind, scope, future, ...campos do tipo }` (campos que não se aplicam são omitidos):
  - `scope: "global"` (igual pra todos): `macro_event` (`title`, `direction`), `copom` (`selic_rate` e `previous_selic_rate` só se já aconteceu), `report` (dia de relatório trimestral), `dividend_ex_date` e `dividend_payment_date` (`ticker`, `unit_value` = valor por cota).
  - `scope: "user"` (só com `user_id`): `order_executed` (`side` buy/sell, `ticker`, `quantity`, `unit_value`), `dividend_received`, `fixed_income_purchase`, `fixed_income_redemption`, `fixed_income_maturity` (vencimento de título que o usuário ainda carrega, `quantity`), `salary_payment` (tarefa T.6) — `unit_value` = salário pago quando `future: false` (lido de `market_events`, evento `salary_payment` gravado por `POST /accounts/{user_id}/salary`, T.2); no futuro (`future: true`) vem **sem `unit_value`**, porque o valor depende do nível do usuário no momento do pagamento (calculado no backend, T.3), que pode mudar até lá — só o dia é determinístico.
  - `future: true` marca fato que ainda vai acontecer.
- **Erros:** `400` — `from`/`to` fora do formato, `user_id` que não é UUID, `from > to` ou janela com mais de 92 dias. `500`, `503`.
- **Regra:** no futuro entram **só fatos determinísticos**: Copom (data efetiva, já empurrada pra dia útil por `selic.IsCopomMeetingDay`, sem o resultado), relatório, proventos já anunciados, vencimentos do usuário e o próximo dia de pagamento de salário (5º dia útil do mês-calendário real, `simcalendar.IsFifthBusinessDayOfMonth`, sem valor). Evento macro ainda não disparado nunca aparece (só `triggered_on_day <= dia corrente`). Ativos sandbox ficam de fora. Nunca expõe patrimônio nem fato de outro usuário (RNF09): o backend sempre passa o id do token. Eventos do usuário vêm de `market_events.simulated_day` (migration `000034`, gravado no INSERT a partir de `market_calendar`; o backfill de linhas antigas é aproximado, ordem preservada). Dentro de um dia: fatos do mercado antes dos do usuário, depois por tipo e ticker.
