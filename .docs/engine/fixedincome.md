# `fixedincome` — compra e resgate de renda fixa ponta a ponta (Mercado Ao Vivo)

Pacotes de domínio: `engine/internal/domain/fixedincomeexecution/` (`Purchase`/`Redeem`/`Service`, orquestrando as fórmulas puras de `fixedincome` — `PrefixedPrice`, `EarlyRedemption`) + `engine/internal/domain/fixedincomeposition/` (`ApplyBuy`, blend de posição). Persistência em `internal/infra/db/fixed_income_execution_repository.go`. Ver `.claude/arquitetura-engine-go.md` pra divisão domínio/infra.

Só ativos de renda fixa (`tesouro_selic`, `tesouro_prefixado`, `tesouro_ipca`, `cdb`, `lci`, `lca`, `cri`, `cra`; `is_sandbox = false`) passam por estas rotas — renda variável tem fluxo próprio (`.docs/engine/orders.md`, tarefa 3.12).

---

### `POST /fixed-income/purchases`

- **Autenticação:** interno — mesma convenção de `POST /accounts`/`POST /orders`, chamado pelo backend gamificado na rede interna do Compose.
- **Payload (JSON):**
  - `user_id` — string, UUID, obrigatório.
  - `asset_id` — string, UUID, obrigatório.
  - `amount` — número > 0, obrigatório — valor do aporte em R$ (a compra é por valor, não por quantidade de títulos — tela 4.3 do inventário).
- **Sucesso:** `201` → `{ unit_price, quantity_purchased, position: { quantity, average_price, average_rate } }`. `position` já reflete a posição agregada **depois** da compra (soma com qualquer compra anterior do mesmo título pelo mesmo usuário).
- **Erros:**
  - `400` — corpo inválido; `user_id`/`asset_id` não são UUID; `amount <= 0`; ativo não encontrado é `404`, mas ativo encontrado e não sendo um dos 8 tipos de renda fixa (ou `is_sandbox = true`) é `400`.
  - `404` — ativo não encontrado; conta do usuário não encontrada (`fixedincomeexecution.ErrAccountNotFound`).
  - `422` — `amount` abaixo da aplicação mínima do produto (`minimum_investment`, `.docs/engine/catalog.md`) ou saldo insuficiente — nada é persistido nesse caso.
  - `503` — motor subiu sem `DATABASE_URL` configurado.
  - `500` — falha inesperada de leitura/persistência.
- **Regra:** `fixedincomeexecution.Service.Purchase` → `fixedincomeexecution.Purchase`. Precifica a unidade nocional pelo deságio nominal (`fixedincome.PrefixedPrice`, mesma fórmula da tarefa 2.3) usando a taxa do catálogo (`fixed_income_assets.interest_rate`) e o DU restante até o vencimento (calculado a partir do relógio de parede vs. `maturity_date` — ver nota 4 abaixo); `quantity_purchased = amount / unit_price`. Blenda a compra na posição já existente do usuário nesse título (`fixedincomeposition.ApplyBuy`) — ver "Modelagem da posição" abaixo.

  **Event Sourcing:** grava o evento imutável `fixed_income_purchase` em `market_events` (`quantity = NULL`, `unit_value = amount`) **antes** de projetar em `accounts`/`fixed_income_positions` — CLAUDE.md. Débita `current_balance` e soma `amount` a `total_invested` (nunca reduzido, mesma métrica cumulativa de `orders.md`).

---

### `POST /fixed-income/redemptions`

- **Autenticação:** interno, mesma observação de `POST /fixed-income/purchases`.
- **Payload (JSON):** `user_id`, `asset_id` — ambos UUID, obrigatórios. Sem campo de quantidade/valor — resgate é sempre **integral** da posição agregada (ver "Escopo não coberto" abaixo).
- **Sucesso:** `200` → `{ total_value, mark_to_market: { mark_to_market_price, realized_return_pct, vs_contracted_rate } }`. `total_value` é o valor total resgatado, em R$; os três campos de `mark_to_market` espelham `fixedincome.EarlyRedemptionResult` (tarefa 2.4).
- **Erros:**
  - `400` — corpo inválido; `user_id`/`asset_id` não são UUID; ativo não encontrado é `404`, ativo não sendo renda fixa (ou sandbox) é `400`.
  - `404` — ativo não encontrado; usuário sem posição nesse título (`fixedincomeexecution.ErrPositionNotFound`).
  - `503` / `500` — mesmos casos de `POST /fixed-income/purchases`.
- **Regra:** `fixedincomeexecution.Service.Redeem` → `fixedincomeexecution.Redeem`. Marca a mercado a posição inteira (`fixedincome.EarlyRedemption`, taxa de mercado corrente = Selic simulada do dia — `market_calendar.selic_rate`, Temporizador da tarefa 3.11) e converte pro valor total (`position.Quantity × MarkToMarketPrice`).

  **Event Sourcing:** grava o evento imutável `fixed_income_redemption` em `market_events` (`quantity = NULL`, `unit_value = total_value`) **antes** de creditar `current_balance` (sem decrementar `total_invested` — mesmo precedente do lado de venda em `orders.md`) e remover a linha de `fixed_income_positions` (resgate sempre integral).

---

### Modelagem da posição (decisão confirmada com o usuário, 2026-08-23)

Comprar o mesmo título mais de uma vez, em taxas diferentes, resulta numa **única posição agregada** por `(user_id, asset_id)` (`fixed_income_positions`, tabela nova — não reaproveita `positions`, pensada pra preço médio de ação sem conceito de taxa contratada). A taxa contratada (`average_rate`) é ajustada pela **média ponderada pelo valor aportado em cada compra** — mesmo comportamento do Tesouro Direto real (exemplo do próprio usuário: comprar Tesouro IPCA+ 2032 a 7%, comprar de novo depois a 8,4%, a carteira mostra um título só com a taxa ajustada). `quantity` é fracionário (`numeric(18,6)`) — unidades nocionais de valor de face, já que a compra é por valor em R$, não por quantidade inteira de títulos.

### Escopo não coberto nesta tarefa (decisões de escopo desta sessão — sinalizar se divergir da intenção pedagógica)

Nenhum dos itens abaixo está nos três documentos de referência; foram decisões tomadas durante a implementação da 3.13, documentadas aqui e no doc do pacote `fixedincomeexecution` pra não serem redescobertas depois:

1. **Taxa contratada na compra** = `fixed_income_assets.interest_rate` (a taxa ilustrativa e estática do catálogo) pra todos os 8 tipos de produto, inclusive Tesouro Selic e Tesouro IPCA+.
2. **Tesouro IPCA+** reaproveita a mesma precificação por deságio nominal (`PrefixedPrice`) dos outros 7 tipos, não a projeção real de VNA (`fixedincome.VNAProjected`/`IPCAPrice`) — exigiria um estado de série mensal de IPCA persistido e path-dependent que não existe hoje (nem o pacote `ipca` tem `Config` calibrado). `VNAProjected`/`IPCAPrice` continuam sem consumidor real no motor.
3. **Taxa de mercado corrente pra marcação a mercado no resgate** = `market_calendar.selic_rate` do dia simulado, uniformemente pros 8 tipos — inclusive Tesouro Selic, que na vida real tem risco de mercado ~zero por ser pós-fixado. Essa nuance não foi modelada.
4. **DU restante até o vencimento** é calculado a partir do relógio de parede (`time.Now()`) vs. `maturity_date` (data de calendário real, seedada como `time.Now().AddDate(2,0,0)`), não do contador de dia simulado — coerente com "1 tick = 1 dia real" do Temporizador (3.11).
5. **Resgate é sempre integral** da posição agregada — não existe resgate parcial.

### Tabelas

- `fixed_income_assets` — ganhou `minimum_investment` (migration `000006`), valores ilustrativos por tipo de produto.
- `fixed_income_positions` — tabela nova (migration `000006`), `UNIQUE (user_id, asset_id)`.
- `market_events` — usa os tipos `fixed_income_purchase`/`fixed_income_redemption`, já existentes no enum desde a migration `000001`, mas nunca usados antes desta tarefa.
