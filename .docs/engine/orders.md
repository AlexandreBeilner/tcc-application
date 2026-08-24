# `orders` — execução de ordens ponta a ponta (Mercado Ao Vivo + Sandbox)

Pacote de domínio: `engine/internal/domain/orderexecution/` (`Execute`/`Service`, orquestrando `orderbook.Book`, tarefa 3.2) + `engine/internal/domain/position/` (`ApplyBuy`/`ApplySell`, recálculo de `average_price`) + `engine/internal/domain/sandbox/` (`PriceScript`/`PriceOnDay`/`DaysSince`, tarefa 4.11). Persistência em `internal/infra/db/order_execution_repository.go`. Ver `.claude/arquitetura-engine-go.md` pra divisão domínio/infra.

Ativos de renda variável (`acao`/`etf`/`fii`) passam por esta rota — renda fixa tem fluxo próprio (`.docs/engine/fixedincome.md`, tarefa 3.13). Até a tarefa 4.11, ativo `is_sandbox = true` também era rejeitado aqui (`400`); agora é aceito normalmente — só o preço de referência muda de fonte (ver "Sandbox" abaixo), o resto da rota (validação, matching, persistência, Event Sourcing) é idêntico.

---

### `POST /orders`

- **Autenticação:** interno — mesma convenção de `POST /accounts`/`POST /admin/tick`, chamado pelo backend gamificado na rede interna do Compose.
- **Payload (JSON):**
  - `user_id` — string, UUID, obrigatório.
  - `asset_id` — string, UUID, obrigatório.
  - `side` — `"buy"` ou `"sell"`, obrigatório.
  - `type` — `"market"` ou `"limit"`, obrigatório.
  - `price` — número, obrigatório e > 0 só para `type = "limit"` (ignorado para `"market"`).
  - `quantity` — inteiro > 0, obrigatório.
- **Sucesso:** `201` → `{ filled_quantity, remaining_quantity, fills: [{ price, quantity, synthetic }] }`. `remaining_quantity` só é > 0 pra ordem `limit` que não achou liquidez suficiente (fica pendurada em `order_book`, `status = pending`/`partially_filled`) — ordem `market` sempre fecha com `remaining_quantity = 0` (ver regra abaixo). `fills[].synthetic = true` identifica a parcela preenchida pelo "mercado" (liquidez sintética), não por uma ordem real de outro usuário.
- **Erros:**
  - `400` — corpo inválido; `user_id`/`asset_id` não são UUID; `side`/`type` fora dos valores aceitos; `quantity <= 0`; `price` ausente/`<= 0` numa ordem `limit`; ativo não encontrado é `404`, mas ativo encontrado e não negociável por esta rota (renda fixa) é `400`.
  - `404` — ativo não encontrado; conta do usuário não encontrada (`orderexecution.ErrAccountNotFound` — não deveria acontecer num fluxo normal, já que `POST /accounts` é sempre o primeiro passo).
  - `422` — saldo insuficiente (ordem de compra) ou quantidade em posição insuficiente (ordem de venda) — nada é persistido nesse caso.
  - `503` — motor subiu sem `DATABASE_URL` configurado (serviço de execução de ordens indisponível).
  - `500` — falha inesperada de leitura/persistência.
- **Regra:** `orderexecution.Service.Submit` → `orderexecution.Execute`. Reconstrói o book do ativo por *replay* das ordens reais pendentes (`order_book`, `status` em `pending`/`partially_filled`, em ordem de chegada) via `orderbook.Book.Submit`, depois submete a ordem recebida contra ele.

  **Liquidez sintética (decisão confirmada com o usuário em 2026-08-22, backlog 3.12):** ordem a mercado sempre executa por completo. Se as ordens reais pendentes não tiverem profundidade suficiente do lado oposto, o "mercado" em si — ao preço corrente da tabela de cotações (`asset_quotes`, tarefa 3.11; `tick.DefaultInitialPrice = 100.00` se o Temporizador ainda não gerou nenhuma cotação pra esse ativo) — age como contraparte implícita e ilimitada pro que faltar. Contrapartes reais sempre têm prioridade de preço/tempo sobre essa liquidez sintética. Ordem `limit` **não** recebe esse preenchimento: cruza só contra liquidez real e, se sobrar quantidade, fica pendurada no book exatamente como `orderbook.Book` já testa desde a 3.2. Essa escolha não tranca a evolução futura pra um book mais profundo — a liquidez sintética é só um passo a mais depois do matching real, não uma substituição dele.

  **Event Sourcing:** pra cada `Fill` (real ou sintético), grava o evento imutável (`buy_order_executed`/`sell_order_executed`) em `market_events` **antes** de projetar em `accounts`/`positions` — CLAUDE.md. Fill sintético só projeta o lado do usuário que enviou a ordem (não existe conta/posição real do outro lado). Contraparte real de um Fill também tem sua própria linha de `order_book` atualizada (`filled_quantity`/`status`) e seu evento gravado — uma única ordem a mercado pode gerar eventos/atualizações pra dois usuários diferentes.

  **Saldo e posição:** compra debita `current_balance` e soma o custo a `total_invested` (nunca reduzido numa venda — métrica cumulativa de capital já implantado); venda credita `current_balance`. `positions.average_price` é recalculado pela média ponderada pelo custo (`position.ApplyBuy`) numa compra; venda só reduz a quantidade, sem alterar `average_price` (`position.ApplySell`). `positions` agora tem `UNIQUE (user_id, asset_id)` (migration `000005`) — cada execução consolida a posição existente em vez de criar uma linha nova.

  **Sandbox (RF12/RNF08, tarefa 4.11):** ativo `is_sandbox = true` passa pelo mesmo `orderexecution.Execute` — mesma validação, mesmo matching contra `order_book`, mesma persistência/Event Sourcing. A única diferença fica em `OrderExecutionRepository.referencePrice`: em vez da última linha de `asset_quotes` (que o Temporizador nunca gera pra ativo sandbox), o preço de referência vem de `sandbox.PriceScript` — um roteiro fixo e pré-computado por ticker (não por `asset_id`, gerado pelo Postgres em tempo de execução), a mesma curva pra todo usuário, garantindo a equidade pedagógica de RNF08. O "dia" do roteiro conta a partir da primeira operação do usuário *naquele ativo* — `positions.created_at` (existente desde a migration `000001`, nunca lido antes desta tarefa; preservado por `ON CONFLICT ... DO UPDATE`, então nunca é sobrescrito numa compra seguinte), convertido em índice de dia por `sandbox.DaysSince` (relógio de parede, mesmo precedente de `fixedincomeexecution`'s DU restante). `sandbox.PriceOnDay` clampa no último valor da série se o dia calculado for maior — o roteiro "estabiliza", não extrapola. Nenhuma migration nova foi necessária.

  **Escopo não coberto nesta tarefa:** saldo/posição de uma ordem `limit` já pendurada não é revalidado quando ela é finalmente preenchida por uma ordem futura — a validação acontece só na submissão original. Validação de saldo/posição da ordem recebida acontece contra um snapshot lido sem lock antes da transação de escrita (`OrderExecutionRepository.LoadContext`); duas ordens do mesmo usuário em voo ao mesmo tempo podem, em teoria, passar as duas pela validação — aceitável pro escopo de protótipo de TCC, documentado no código (`order_execution_repository.go`).

### Tabelas

- `order_book` — ganhou `filled_quantity` (migration `000005`) pra sustentar o *replay*: `orderexecution.Execute` precisa da quantidade **restante** de cada ordem pendente, não da original.
- `positions` — ganhou `UNIQUE (user_id, asset_id)` (migration `000005`).
- `market_events` — usa os tipos `buy_order_executed`/`sell_order_executed`, já existentes no enum desde a migration `000001`, mas nunca usados antes desta tarefa.
