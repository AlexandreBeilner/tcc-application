# `account` — abertura de conta com capital inicial padronizado + leitura de estado do usuário

Pacote: `engine/internal/domain/account/` (abertura de conta) + `engine/internal/domain/position/`/`fixedincomeposition/` (tipo `Record`, usado só pelas rotas de leitura abaixo) + `engine/internal/domain/eventstore.go` (`MarketEventRecord`, idem). Persistência de tudo (escrita e leitura) em `internal/infra/db/account_repository.go` — `*db.AccountRepository` implementa tanto `account.Repository` (escrita) quanto as quatro leituras da tarefa 4.7, mesma convenção de `CatalogRepository` servir mais de uma interface pequena. Ver `.claude/arquitetura-engine-go.md` pra entender a divisão em domínio/infra — aqui é só o contrato HTTP.

Nenhuma das quatro rotas de leitura abaixo (tarefa 4.7) aceita listar o estado de um usuário sem informar explicitamente esse `user_id` (no path ou na query) — não existe "listar todas as contas"/"todas as posições". A garantia de que um usuário só pode pedir o próprio estado é do backend (que decide quem pode chamar o quê), não do motor.

---

### `POST /accounts`

- **Autenticação:** interno — chamado pelo backend gamificado (`ENGINE_URL`), nunca exposto direto ao navegador via gateway.
- **Payload (JSON):** `user_id` — string, UUID do usuário (banco `gamification`), obrigatório.
- **Sucesso:** `201` → `{ user_id, current_balance, total_invested, total_disinvested, total_dividends_received }`. `current_balance` sempre `10000.00` (RNF06).
- **Erros:**
  - `400` — `user_id` ausente ou não é um UUID válido.
  - `409` — já existe conta para esse `user_id`.
  - `503` — motor subiu sem `DATABASE_URL` configurado (serviço de contas indisponível).
  - `500` — falha inesperada de persistência.
- **Regra:** `account.Service.Open`. O capital inicial (`account.InitialBalance = 10000.00`) é fixado no domínio, não configurável. Grava o evento imutável `initial_deposit` em `market_events` e só então projeta a linha em `accounts`, na mesma transação (Event Sourcing, CLAUDE.md) — a FK `market_events.user_id → accounts.user_id` é `DEFERRABLE INITIALLY DEFERRED` (migration `000002`) justamente pra permitir essa ordem sem abrir mão da integridade referencial.

---

### `POST /accounts/{user_id}/salary`

- **Autenticação:** interno, mesma observação de `POST /accounts`.
- **Payload:** `user_id` no path. Corpo (JSON): `amount` — número, obrigatório, deve ser positivo; `reference_month` — string, obrigatório, formato `AAAA-MM` (achado 025).
- **Sucesso:** `204`, sem corpo.
- **Erros:**
  - `400` — `amount` ausente, zero ou negativo; `reference_month` ausente ou fora do formato `AAAA-MM`; ou JSON inválido.
  - `404` — nenhuma conta com esse `user_id` (diferente de `POST /accounts`, essa rota nunca cria conta).
  - `503` — motor subiu sem `DATABASE_URL` configurado.
  - `500` — falha inesperada de persistência.
- **Regra:** `account.Service.CreditSalary` (tarefa T.2, Fase T — salário mensal simulado). Grava o evento imutável `salary_payment` em `market_events` (com `reference_month`, achado 025 — ver `.claude/pontos-em-aberto-decisao-produto.md`) e só então soma `amount` em `accounts.current_balance`, na mesma transação (Event Sourcing, CLAUDE.md) — mesma FK deferrable de `POST /accounts`. **Nunca** incrementa `total_invested`/`total_disinvested`/`total_dividends_received`: salário é caixa livre, nunca capital de risco (T.1), e por isso não entra no cálculo de rentabilidade (RF17). O motor só executa o crédito — decidir quando (5º dia útil do mês-calendário real), quanto pagar (fórmula por nível de gamificação) e a que mês cada crédito se refere é responsabilidade do backend (tarefas T.3/T.4/T.5). `reference_month` é o mês-calendário real a que o salário se refere — normalmente igual ao mês em que o crédito é processado, mas pode divergir num catch-up de vários meses atrasados de uma vez (T.5): todos os créditos desse catch-up caem no mesmo `simulated_day` (o dia em que o job rodou), então `reference_month` é o único jeito de distinguir "salário de junho" do "salário de agosto" quando os dois chegam juntos — ver `GET /market/calendar` (`.docs/engine/calendar.md`).

---

### `GET /accounts/{user_id}`

- **Autenticação:** interno, mesma observação de `POST /accounts`.
- **Payload:** `user_id` no path — UUID do usuário.
- **Sucesso:** `200` → `{ user_id, current_balance, total_invested, total_disinvested, total_dividends_received }` — os 4 campos monetários de `accounts`, sempre o valor corrente (não um snapshot da criação). `total_disinvested` (tarefa T.1) é o simétrico de `total_invested`: soma bruta de vendas de renda variável + resgates de renda fixa, nunca líquida de compra — nenhum dos dois é filtrado por `is_sandbox` (mesma convenção de `current_balance`, que também reflete efeito real de operação sandbox).
- **Erros:**
  - `404` — nenhuma conta com esse `user_id`.
  - `503` — motor subiu sem `DATABASE_URL` configurado.
  - `500` — falha inesperada de leitura.
- **Regra:** nenhuma fórmula — projeção direta de `accounts` (`AccountRepository.FindByUserID`).

---

### `GET /accounts/{user_id}/events`

- **Autenticação:** interno, mesma observação de `POST /accounts`.
- **Payload:** `user_id` no path. Query `limit`/`offset` (opcionais) — mesma convenção de `GET /admin/macro-events` (`.docs/engine/macroevent.md`, tarefa 4.5): `limit` default `20`, máximo `100`; `offset` default `0`.
- **Sucesso:** `200` → array `[{ id, event_type, asset_id?, quantity?, unit_value?, timestamp }, ...]`, ordenado cronológico **reverso** (mais recente primeiro) — extrato de `market_events` (RF05, tela 4.8). `asset_id`/`quantity`/`unit_value` ficam omitidos quando o evento não os tem (ex: `initial_deposit` não tem `asset_id`/`quantity`). Lista vazia (não erro) pra usuário sem evento nenhum.
- **Erros:**
  - `400` — `limit`/`offset` inválido.
  - `503` / `500` — mesmos casos de `GET /accounts/:user_id`.
- **Regra:** nenhuma fórmula — projeção direta de `market_events` filtrada por `user_id`, ordenada por `timestamp DESC, id DESC` (`AccountRepository.ListMarketEventsByUser`). Nunca 404 mesmo pra um `user_id` sem conta — é só uma consulta que pode não achar linha nenhuma, diferente de `GET /accounts/:user_id` (que representa "a conta" como um recurso).

---

### `GET /positions`

- **Autenticação:** interno, mesma observação de `POST /accounts`.
- **Payload:** query `user_id` (obrigatório) — UUID do usuário.
- **Sucesso:** `200` → array `[{ asset_id, ticker, name, type, is_sandbox, quantity, average_price, dividends_received }, ...]` — posições de renda variável (`positions`) do usuário, cada uma já enriquecida com a identificação do ativo via join com `assets` (não só o `asset_id` cru). `is_sandbox` (tarefa 4.11, RF12) distingue posição de sandbox da de Mercado Ao Vivo — insumo pra tela 2.1 (inventário) separar as duas visualmente. `dividends_received` (tarefa S.15) é a soma de `quantity * unit_value` dos eventos `dividend_payment` (`market_events`) desse usuário nesse ativo — sempre presente, `0` (não `null`) sem provento nenhum. Lista vazia (não erro) pra usuário sem posição nenhuma.
- **Erros:**
  - `400` — `user_id` ausente ou não é um UUID válido.
  - `503` / `500` — mesmos casos de `GET /accounts/:user_id`.
- **Regra:** nenhuma fórmula na leitura em si — `positions JOIN assets` (`AccountRepository.ListPositionsByUser`), ordenado por `ticker`, com um `LEFT JOIN` numa subquery que agrega `SUM(quantity * unit_value)` de `market_events` (`event_type = 'dividend_payment'`) por `asset_id`, `COALESCE`ado pra `0`. Não existe o mesmo campo em `GET /fixed-income/positions` — renda fixa não gera evento `dividend_payment`.

---

### `GET /fixed-income/positions`

- **Autenticação:** interno, mesma observação de `POST /accounts`.
- **Payload:** query `user_id` (obrigatório) — UUID do usuário.
- **Sucesso:** `200` → array `[{ asset_id, ticker, name, type, is_sandbox, quantity, average_price, average_rate }, ...]` — mesmo padrão de `GET /positions` (incluindo `is_sandbox`, tarefa 4.11), pra `fixed_income_positions`, incluindo `average_rate` (a taxa contratada ajustada pela média ponderada — `fixedincomeposition.ApplyBuy`, tarefa 3.13). Lista vazia (não erro) pra usuário sem posição nenhuma.
- **Erros:**
  - `400` — `user_id` ausente ou não é um UUID válido.
  - `503` / `500` — mesmos casos de `GET /accounts/:user_id`.
- **Regra:** nenhuma fórmula — `fixed_income_positions JOIN assets` (`AccountRepository.ListFixedIncomePositionsByUser`), ordenado por `ticker`.
