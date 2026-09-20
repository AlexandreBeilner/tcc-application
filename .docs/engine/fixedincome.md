# `fixedincome` — compra e resgate de renda fixa ponta a ponta (Mercado Ao Vivo + Sandbox)

Pacotes de domínio: `engine/internal/domain/fixedincomeexecution/` (`Purchase`/`Redeem`/`Simulate`/`Service`, orquestrando as fórmulas puras de `fixedincome` — `PrefixedPrice`, `EarlyRedemption`, `RegressiveIncomeTaxRate`, tarefa 6.0.5) + `engine/internal/domain/fixedincomeposition/` (`ApplyBuy`, blend de posição) + `engine/internal/domain/sandbox/` (`RateScript`/`RateOnDay`/`DaysSince`, tarefa 4.11). Persistência em `internal/infra/db/fixed_income_execution_repository.go`. Ver `.claude/arquitetura-engine-go.md` pra divisão domínio/infra.

Ativos de renda fixa (`tesouro_selic`, `tesouro_prefixado`, `tesouro_ipca`, `cdb`, `lci`, `lca`, `cri`, `cra`) passam por estas rotas — renda variável tem fluxo próprio (`.docs/engine/orders.md`, tarefa 3.12). Até a tarefa 4.11, ativo `is_sandbox = true` também era rejeitado aqui (`400`); agora é aceito normalmente — só a taxa contratada/de mercado muda de fonte (ver "Sandbox" abaixo), o resto das rotas é idêntico.

---

### `POST /fixed-income/purchases`

- **Autenticação:** interno — mesma convenção de `POST /accounts`/`POST /orders`, chamado pelo backend gamificado na rede interna do Compose.
- **Payload (JSON):**
  - `user_id` — string, UUID, obrigatório.
  - `asset_id` — string, UUID, obrigatório.
  - `amount` — número > 0, obrigatório — valor do aporte em R$ (a compra é por valor, não por quantidade de títulos — tela 4.3 do inventário).
- **Sucesso:** `201` → `{ unit_price, quantity_purchased, position: { quantity, average_price, average_rate } }`. `position` já reflete a posição agregada **depois** da compra (soma com qualquer compra anterior do mesmo título pelo mesmo usuário).
- **Erros:**
  - `400` — corpo inválido; `user_id`/`asset_id` não são UUID; `amount <= 0`; ativo não encontrado é `404`, mas ativo encontrado e não sendo um dos 8 tipos de renda fixa é `400`.
  - `404` — ativo não encontrado; conta do usuário não encontrada (`fixedincomeexecution.ErrAccountNotFound`).
  - `422` — `amount` abaixo da aplicação mínima do produto (`minimum_investment`, `.docs/engine/catalog.md`) ou saldo insuficiente — nada é persistido nesse caso.
  - `503` — motor subiu sem `DATABASE_URL` configurado.
  - `500` — falha inesperada de leitura/persistência.
- **Regra:** `fixedincomeexecution.Service.Purchase` → `fixedincomeexecution.Purchase`. Produto **pós-fixado** (Tesouro Selic, CDB, LCI, LCA, CRI, CRA — `fixedincome.IsPostFixado`, tarefa L.1) compra **ao par**: `unit_price = fixedincome.FaceValue` (R$1.000), sem deságio — não há taxa travada na compra pra descontar, o rendimento nasce só no resgate. **Tesouro IPCA+** (`fixedincome.IsIPCAMais`, tarefa L.2) precifica a unidade pelo VNA: `unit_price = fixedincome.IPCAPrice(VNAProjected(vnaBase, monthlyIPCA, now), IPCAQuote(taxa_real_contratada, DU_restante))` — `vnaBase`/`monthlyIPCA` vêm de `fixedincome.CurrentVNAWindow`, derivado sem nenhum estado persistido a partir de `ipca.Config` (calibrado por `ipca.DefaultConfig`, injetado em `Service` na composição de `cmd/api/main.go` com uma seed própria, nunca a mesma raw seed do `selic.Config` do Temporizador) e `fixedincome.VNAEpoch` (data-base fixa, 15/07/2000, mesma convenção do Tesouro Direto real) — mesma cfg/seed sempre reproduz o mesmo VNA numa data (RNF08). Qualquer outro tipo (só Tesouro Prefixado sobra) continua precificando a unidade nocional pelo deságio nominal (`fixedincome.PrefixedPrice`, mesma fórmula da tarefa 2.3) usando a taxa do catálogo (`fixed_income_assets.interest_rate`) e o DU restante até o vencimento (calculado a partir do relógio de parede vs. `maturity_date` — ver nota 4 abaixo). Em todos os casos, `quantity_purchased = amount / unit_price`, e a compra blenda na posição já existente do usuário nesse título (`fixedincomeposition.ApplyBuy`) — ver "Modelagem da posição" abaixo. Pra produto pós-fixado, `fixed_income_assets.interest_rate` deixou de significar "taxa anual em %" e passou a significar "% do CDI/Selic contratado" (ex: `110.00` = "110% do CDI", mesma convenção da lição 3.3 — "CDB 110% CDI vs LCI 90% CDI isento"); pra Tesouro IPCA+, `interest_rate` continua sendo a taxa REAL contratada em % a.a. (sem mudança da L.1/L.2).

  **Event Sourcing:** grava o evento imutável `fixed_income_purchase` em `market_events` (`quantity = NULL`, `unit_value = amount`) **antes** de projetar em `accounts`/`fixed_income_positions` — CLAUDE.md. Débita `current_balance` e soma `amount` a `total_invested` (nunca reduzido, mesma métrica cumulativa de `orders.md`).

---

### `POST /fixed-income/redemptions`

- **Autenticação:** interno, mesma observação de `POST /fixed-income/purchases`.
- **Payload (JSON):** `user_id`, `asset_id` — ambos UUID, obrigatórios. Sem campo de quantidade/valor — resgate é sempre **integral** da posição agregada (ver "Escopo não coberto" abaixo).
- **Sucesso:** `200` → `{ total_value, net_value, tax_rate, mark_to_market: { mark_to_market_price, realized_return_pct, vs_contracted_rate } }`. `total_value` é o valor bruto total resgatado, em R$; `net_value`/`tax_rate` (tarefa 6.0.5) são o líquido de IR regressivo e a alíquota aplicada (ver "IR regressivo" abaixo) — `net_value = total_value` sempre que o ativo é `tax_exempt` ou o resgate não teve lucro (`total_value <= valor efetivamente aplicado`); os três campos de `mark_to_market` espelham `fixedincome.EarlyRedemptionResult` (tarefa 2.4).
- **Erros:**
  - `400` — corpo inválido; `user_id`/`asset_id` não são UUID; ativo não encontrado é `404`, ativo não sendo renda fixa é `400`.
  - `404` — ativo não encontrado; usuário sem posição nesse título (`fixedincomeexecution.ErrPositionNotFound`).
  - `503` / `500` — mesmos casos de `POST /fixed-income/purchases`.
- **Regra:** `fixedincomeexecution.Service.Redeem` → `fixedincomeexecution.Redeem`. Produto **pós-fixado** (`fixedincome.IsPostFixado`, tarefa L.1) NÃO é marcado a mercado — rende de verdade pela Selic simulada (`fixedincome.PostFixedValue`: o principal investido, `Position.AveragePrice × Position.Quantity`, composto dia a dia pelo percentual do índice contratado, `Position.AverageRate`, sobre uma série de Selic simulada — hoje a Selic corrente repetida por todo o período decorrido, ver nota 3.1 do doc do pacote `fixedincomeexecution` pra por que ainda não é histórico real). `mark_to_market.vs_contracted_rate` sempre `0` nesse caso — não existe "desvio da taxa contratada" pra um produto cujo rendimento já É o índice. **Tesouro IPCA+** (`fixedincome.IsIPCAMais`, tarefa L.2) usa `fixedincome.IPCAEarlyRedemption` — mesma decomposição de `EarlyRedemption`, só que sobre o VNA de hoje (`VNAProjected` alimentado por `CurrentVNAWindow`, mesmo mecanismo de `POST /fixed-income/purchases` acima) em vez do Valor Nominal fixo. **Continua sofrendo marcação a mercado igual o Tesouro Prefixado — decisão confirmada com o usuário na tarefa L.3**: apesar da spec 3.2.1 falar só em "títulos prefixados", a taxa real contratada do IPCA+ funciona como uma prefixada sobre o VNA (diferente dos 6 pós-fixados, cujo rendimento já É o índice de mercado), então segue fazendo sentido reprecificar pela taxa de mercado vigente. A taxa de mercado usada continua sendo a Selic nominal simulada do dia (`ctx.CurrentMarketRatePct`), reaproveitada como proxy de taxa real de mercado — sem correção de Fisher nominal/real, simplificação de calibração à parte que segue sem confirmação (ver nota 3 do doc do pacote `fixedincomeexecution`, L.4 revisita). Qualquer outro tipo (só Tesouro Prefixado sobra) continua marcado a mercado (`fixedincome.EarlyRedemption`, taxa de mercado corrente = Selic simulada do dia — `market_calendar.selic_rate`, Temporizador da tarefa 3.11), convertendo pro valor total (`position.Quantity × MarkToMarketPrice`). Aplica IR regressivo sobre o lucro em todos os casos (ver abaixo).

  **Event Sourcing:** grava o evento imutável `fixed_income_redemption` em `market_events` (`quantity = NULL`, `unit_value = total_value` — valor **bruto**, não líquido) **antes** de creditar `current_balance` (com o valor bruto, sem decrementar `total_invested` — mesmo precedente do lado de venda em `orders.md`) e remover a linha de `fixed_income_positions` (resgate sempre integral).

---

### `GET /fixed-income/simulate`

*(Tarefa 6.0.5, sem consumidor no `user_id`/conta — simulação stateless.)*

- **Autenticação:** interno, mesma convenção das demais rotas deste módulo.
- **Query params:** `asset_id` (UUID, obrigatório), `amount` (número > 0, obrigatório — valor hipotético do aporte em R$), `days_held` (inteiro > 0, obrigatório — dias corridos simulados de permanência, usados tanto pra projetar o preço futuro quanto pra escolher a faixa de IR regressivo).
- **Sucesso:** `200` → `{ unit_price, quantity_purchased, gross_projected_value, tax_rate, net_projected_value }`. Nenhuma escrita: não grava `market_events`, não toca `fixed_income_positions`/`accounts` — puramente `fixedincomeexecution.Simulate`, que nem recebe um `Repository`.
- **Erros:**
  - `400` — `asset_id` ausente/não-UUID; `amount`/`days_held` ausentes, não numéricos ou `<= 0`; ativo não encontrado é `404`, ativo não sendo um dos 8 tipos de renda fixa é `400`.
  - `404` — ativo não encontrado.
  - `500` — especialização de renda fixa não encontrada pro ativo ou com `interest_rate`/`maturity_date` nulo (dado de catálogo incompleto — não deveria acontecer pra um ativo já filtrado como renda fixa); falha inesperada de leitura.
  - `503` — motor subiu sem `DATABASE_URL` configurado.
- **Regra:** `fixedincomeexecution.Simulate`. Lê `interest_rate`/`maturity_date`/`tax_exempt` via `assetCatalogReader.FindFixedIncomeSpecialization` (o mesmo leitor de catálogo de `GET /assets/:id`, tarefa 3.10 — nenhum repositório novo). Precifica a unidade pelo deságio nominal na data de hoje (`fixedincome.PrefixedPrice`, mesma fórmula de `POST /fixed-income/purchases`), projeta o preço da mesma unidade depois de `days_held` dias (DU restante até o vencimento encolhido pela conversão `dias corridos → DU`, mesma proporção 252/365 usada pra calcular o DU restante) e aplica o IR regressivo sobre o ganho projetado, se o produto não for isento. **Gap conhecido, não corrigido nem pela L.1 nem pela L.2:** diferente de `Purchase`/`Redeem`, esta rota continua usando `PrefixedPrice` pra TODOS os 8 tipos, inclusive pós-fixados e Tesouro IPCA+ — `Simulate` não recebe nenhum `Repository` (só dado de catálogo, sem acesso a `market_calendar.selic_rate` nem a `ipca.Config`/`CurrentVNAWindow`), estender exigiria um colaborador novo na camada HTTP pra cada um dos dois, fora do escopo cirúrgico dessas tarefas. A projeção mostrada pro simulador de aporte (tela 4.3) fica levemente incorreta pra produto pós-fixado/IPCA+ até uma sessão futura estender essa mesma mudança até aqui.

  Sustenta o simulador de aporte da tela 4.3 ("campo de valor → projeção de retorno até o vencimento") e a Calculadora em modo comparação (6.1/6.2, lição 3.3 — "CDB 110% CDI líquido vs. LCI 90% CDI isento") — nenhum dos dois tinha suporte de backend antes desta tarefa.

---

### `GET /fixed-income/tax-rate`

*(Tarefa 6.7, decisão (b) do backlog: modo comparação da Calculadora usa juros compostos genéricos client-side, não um `asset_id` real do catálogo — este endpoint só expõe a alíquota, mais barato que `.../simulate`.)*

- **Autenticação:** interno, mesma convenção das demais rotas deste módulo.
- **Query params:** `days_held` (inteiro > 0, obrigatório — dias corridos hipotéticos de permanência).
- **Sucesso:** `200` → `{ tax_rate }`. Sem nenhuma dependência de catálogo/conta — não responde `503` em nenhum cenário, diferente de todas as outras rotas deste módulo.
- **Erros:** `400` — `days_held` ausente, não inteiro ou `<= 0`.
- **Regra:** chama `fixedincome.RegressiveIncomeTaxRate(daysHeld)` direto — o cliente (Calculadora, modo comparação) decide se aplica a alíquota sobre o ganho projetado ou ignora, caso o produto hipotético seja isento (`LCI`/`LCA`/`CRI`/`CRA` — nenhum parâmetro de isenção aqui, o front já sabe se o produto simulado é isento antes de chamar este endpoint).

---

### IR regressivo (tarefa 6.0.5)

`fixedincome.RegressiveIncomeTaxRate(daysHeld int) float64` — tabela fixa da legislação brasileira (Lei 11.033/2004), por **dias corridos** (não dias úteis, diferente das fórmulas de precificação deste módulo):

| Prazo (dias corridos) | Alíquota |
|---|---|
| até 180 | 22,5% |
| 181 a 360 | 20% |
| 361 a 720 | 17,5% |
| acima de 720 | 15% |

Ativos com `tax_exempt = true` (LCI/LCA/CRI/CRA) nunca aplicam essa função — líquido = bruto sempre, verificado no ponto de chamada (`fixedincomeexecution.Redeem`/`Simulate`), não dentro de `RegressiveIncomeTaxRate`. O imposto incide só sobre o **lucro** (`valor resgatado/projetado − valor efetivamente aplicado`) — se não houver lucro (`profit <= 0`), líquido = bruto mesmo em produto tributado, nada é descontado.

`days_held` tem duas origens diferentes conforme a rota: em `GET /fixed-income/simulate` é o parâmetro da query (prazo hipotético); em `POST /fixed-income/redemptions` é calculado a partir de `fixed_income_positions.created_at` (a mesma coluna já usada pelo Sandbox pra contar dias — ver "Sandbox" abaixo) até o momento do resgate.

---

### Sandbox (RF12/RNF08, tarefa 4.11)

Ativo `is_sandbox = true` passa pelas mesmas `fixedincomeexecution.Purchase`/`Redeem` — mesma validação, mesma persistência/Event Sourcing. Fórmula usada depende do mesmo `fixedincome.IsPostFixado(ProductType)` do Mercado Ao Vivo (tarefa L.1); hoje isso não muda nada na prática porque o único roteiro sandbox seedado (`SANDPRE`, abaixo) é Tesouro Prefixado — continua em `PrefixedPrice`/`EarlyRedemption`, nunca em `PostFixedValue`. A diferença fica só em `FixedIncomeExecutionRepository.LoadPurchaseContext`/`LoadRedeemContext`: em vez de `fixed_income_assets.interest_rate` (compra) ou `market_calendar.selic_rate` (resgate), a taxa vem de `sandbox.RateScript` — um roteiro fixo e pré-computado por ticker (não por `asset_id`, gerado pelo Postgres em tempo de execução), a mesma curva pra todo usuário. `RateScript` serve as **duas** grandezas: lido no dia da compra, é a taxa contratada; lido no dia do resgate, é a taxa de mercado corrente pra marcação a mercado — mesma dualidade que o Mercado Ao Vivo já tinha (`interest_rate` do catálogo vs. `market_calendar.selic_rate`), só que as duas leituras agora saem do mesmo roteiro em dias diferentes. `maturity_date`/`minimum_investment` continuam vindo do catálogo mesmo pra sandbox — só a taxa (a grandeza simulada) troca de fonte.

O "dia" do roteiro conta a partir da primeira operação do usuário *naquele título* — `fixed_income_positions.created_at` (existente desde a migration `000006`, nunca lido antes desta tarefa; preservado por `ON CONFLICT ... DO UPDATE` numa compra seguinte, mas a linha é **apagada inteira** num resgate — nota 5 abaixo — então uma recompra depois de um resgate reinicia a contagem, legitimamente: é uma primeira operação nova), convertido em índice de dia por `sandbox.DaysSince` (relógio de parede, mesmo precedente da nota 4 abaixo). `sandbox.RateOnDay` clampa no último valor da série se o dia calculado for maior. Nenhuma migration nova foi necessária.

Se o ativo é `is_sandbox = true` mas o ticker não tem `sandbox.RateScript` cadastrado (erro de cadastro — catálogo de roteiros incompleto), tanto a compra quanto o resgate falham com `500` (`ErrSandboxScriptNotFound`) em vez de cair silenciosamente na taxa do Mercado Ao Vivo.

O roteiro seedado (`SANDPRE`, Tesouro Prefixado sandbox) existe pra reproduzir a lição 1.7 de forma controlada: taxa contratada 10% no dia da compra (dia 0), sobe pra 15% nos dias 1–3 (resgatar nesse intervalo marca a mercado com perda — taxa de mercado acima da contratada), cai pra 6% do dia 4 em diante (resgatar aí marca a mercado com ganho extraordinário — taxa de mercado abaixo da contratada).

**Tesouro IPCA+ sandbox não foi seedado nesta tarefa:** `sandbox.IPCAScript` existe e é testado isoladamente por simetria com `PriceScript`/`RateScript`, mas sem consumidor real. Diferente do Mercado Ao Vivo (que passou a usar `fixedincome.CurrentVNAWindow`/VNA de verdade na L.2, nota 2 abaixo), um Tesouro IPCA+ sandbox, se seedado, ainda cairia no branch `IsIPCAMais` de `Purchase`/`Redeem` — ou seja, usaria o MESMO `ipca.Config` global do Mercado Ao Vivo (via `Service.ipcaCfg`), não um roteiro determinístico próprio como `sandbox.IPCAScript` prometeria; ligar `IPCAScript` de verdade ao sandbox é gap não coberto por esta tarefa.

### Modelagem da posição (decisão confirmada com o usuário, 2026-08-23)

Comprar o mesmo título mais de uma vez, em taxas diferentes, resulta numa **única posição agregada** por `(user_id, asset_id)` (`fixed_income_positions`, tabela nova — não reaproveita `positions`, pensada pra preço médio de ação sem conceito de taxa contratada). A taxa contratada (`average_rate`) é ajustada pela **média ponderada pelo valor aportado em cada compra** — mesmo comportamento do Tesouro Direto real (exemplo do próprio usuário: comprar Tesouro IPCA+ 2032 a 7%, comprar de novo depois a 8,4%, a carteira mostra um título só com a taxa ajustada). `quantity` é fracionário (`numeric(18,6)`) — unidades nocionais de valor de face, já que a compra é por valor em R$, não por quantidade inteira de títulos.

### Escopo não coberto nesta tarefa (decisões de escopo desta sessão — sinalizar se divergir da intenção pedagógica)

Nenhum dos itens abaixo está nos três documentos de referência; foram decisões tomadas durante a implementação da 3.13 (e revisitadas pela L.1, backlog-motor-mercado-realista), documentadas aqui e no doc do pacote `fixedincomeexecution` pra não serem redescobertas depois:

1. **Taxa contratada na compra** = `fixed_income_assets.interest_rate` (a taxa ilustrativa e estática do catálogo) pra todos os 8 tipos de produto. **Parcialmente revisitado pela L.1:** pros 6 tipos pós-fixados, esse número virou "% do CDI/Selic contratado" em vez de "taxa anual em %" — ainda estático no catálogo, mas o RENDIMENTO em si passou a acompanhar a Selic simulada dia a dia (`fixedincome.PostFixedValue`), não mais travado no valor da compra. Tesouro Prefixado sem mudança; Tesouro IPCA+ continua com a taxa REAL travada na compra (`interest_rate` em % a.a., sem mudança de significado), só o VNA que multiplica essa taxa passou a variar (nota 2).
2. **Tesouro IPCA+ reaproveitava a mesma precificação por deságio nominal** (`PrefixedPrice`) do Tesouro Prefixado, não a projeção real de VNA (`fixedincome.VNAProjected`/`IPCAPrice`) — **resolvido pela L.2**: `ipca.DefaultConfig` calibra `ipca.Config` (meta de IPCA mensal, banda, volatilidade — ver doc do pacote `ipca`), e `fixedincome.CurrentVNAWindow` deriva `vnaBase`/`monthlyIPCA` **sem nenhum estado persistido** — encadeia `ipca.MonthlySeries` desde `fixedincome.VNAEpoch` (data-base fixa, 15/07/2000) até a janela de `now`, mesma cfg/seed sempre reproduz o mesmo VNA numa data (RNF08). Decisão de escopo desta sessão: nenhuma tabela nova, nenhum consumo do IPCA dentro do Temporizador (`tick.Advance`) — isso é a tarefa M.1 (independente), que serve pra **exibir** a série ao usuário/painel admin, não pra calcular o VNA (a fórmula não precisa de histórico gravado, só da data corrente).
3. **Taxa de mercado corrente pra marcação a mercado no resgate** = `market_calendar.selic_rate` do dia simulado. **Resolvido pra pós-fixado pela L.1:** os 6 tipos pós-fixados não passam mais por `EarlyRedemption` — não faz sentido marcar a mercado um produto cujo rendimento já É o índice de mercado. **Resolvido pra IPCA+ pela L.3** (decisão confirmada com o usuário): apesar da spec 3.2.1 falar só em "títulos prefixados", Tesouro IPCA+ continua sofrendo marcação a mercado junto com o Tesouro Prefixado, porque a taxa real contratada na compra funciona como uma prefixada sobre o VNA. Os dois continuam usando a Selic nominal simulada como proxy de taxa de mercado — pra IPCA+ (L.2), isso significa usá-la como proxy de taxa REAL de mercado (sem correção de Fisher), simplificação de calibração à parte que segue sem confirmação com o usuário (L.4 revisita).
   - **3.1.** A série diária de Selic que `PostFixedValue` recebe é hoje uma aproximação: `market_calendar` só guarda a Selic corrente (sem histórico — a persistência diária real é a tarefa M.1, independente desta), então `Redeem` repete o único valor conhecido por todo o período decorrido — mesma simplificação que `fii.PortfolioValueVariation` já usa pro indexador CDI.
4. **DU restante até o vencimento** é calculado a partir do relógio de parede (`time.Now()`) vs. `maturity_date` (data de calendário real, seedada como `time.Now().AddDate(2,0,0)`), não do contador de dia simulado — coerente com "1 tick = 1 dia real" do Temporizador (3.11).
5. **Resgate é sempre integral** da posição agregada — não existe resgate parcial.

### Tabelas

- `fixed_income_assets` — ganhou `minimum_investment` (migration `000006`), valores ilustrativos por tipo de produto.
- `fixed_income_positions` — tabela nova (migration `000006`), `UNIQUE (user_id, asset_id)`.
- `market_events` — usa os tipos `fixed_income_purchase`/`fixed_income_redemption`, já existentes no enum desde a migration `000001`, mas nunca usados antes desta tarefa.
