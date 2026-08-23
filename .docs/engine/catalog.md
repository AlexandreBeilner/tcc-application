# `catalog` — leitura do catálogo de mercado

Pacote de domínio: `engine/internal/domain/catalog/` (+ `etf`/`fii`/`fixedincome` pras especializações, `internal/infra/db/catalog_repository.go` pra persistência). Ver `.claude/arquitetura-engine-go.md` pra entender a divisão em domínio/infra — aqui é só o contrato HTTP. Sem cotação corrente nestas rotas — a tabela de preços existe desde a tarefa 3.11 (`asset_quotes`, ver `.docs/engine/tick.md`), mas ainda não é exposta aqui, só o dado cadastral/quase-estático populado pelo seed (tarefa 3.9).

---

### `GET /assets`

- **Autenticação:** interno — chamado pelo backend gamificado, nunca exposto direto ao navegador via gateway.
- **Payload:** query `type` (opcional) — um dos 11 valores do enum `asset_type` (`tesouro_selic`, `tesouro_prefixado`, `tesouro_ipca`, `cdb`, `lci`, `lca`, `cri`, `cra`, `acao`, `etf`, `fii`). Ausente = lista todos.
- **Sucesso:** `200` → array de `{ id, ticker, name, type, risk_class?, is_sandbox }`, ordenado por `ticker`.
- **Erros:**
  - `400` — `type` não é um dos 11 valores válidos.
  - `503` — motor subiu sem `DATABASE_URL` configurado (serviço de catálogo indisponível).
  - `500` — falha inesperada de leitura.
- **Regra:** listagem sem regra de negócio — projeção direta de `assets`. Não inclui indicadores por classe (isso só aparece no detalhe, RF21).

---

### `GET /assets/{id}`

- **Autenticação:** interno, mesma observação de `GET /assets`.
- **Payload:** `id` no path — UUID do ativo.
- **Sucesso:** `200` → `{ id, ticker, name, type, risk_class?, is_sandbox }` mais **um** bloco extra, dependendo de `type` (RF21 — nunca reaproveita o layout de um bloco pro outro):
  - renda fixa (8 tipos): `fixed_income: { interest_rate?, maturity_date?, issuer_type, tax_exempt, credit_risk_rating?, minimum_investment }`. `minimum_investment` (tarefa 3.13) é a aplicação mínima do produto, em R$ — valor ilustrativo por tipo, sujeito à calibração da tarefa 8.1 (mesmo precedente de `interest_rate`/`maturity_date`).
  - `acao`: `equity: { company: { id, name, cnpj, sector }, share_class?, outstanding_shares? }`.
  - `etf`: `etf: { benchmark_index, methodology_summary?, holdings: [{ constituent_name, weight_pct }] }`.
  - `fii`: `fii: { fii_type, segment?, net_worth?, vacancy_rate?, indexador? }` — `vacancy_rate` só em tijolo, `indexador` só em papel (exclusão mútua de `fii.NewDetails`, tarefa 3.8).
  - O bloco extra fica ausente se a especialização ainda não foi persistida pra esse ativo (não deveria acontecer com dado vindo do seed — todo ativo tem sua especialização).
- **Erros:**
  - `404` — nenhum ativo com esse `id`.
  - `503` / `500` — mesmos casos de `GET /assets`.
- **Regra:** nenhuma fórmula — monta a resposta lendo a especialização correspondente ao `type` do ativo já carregado (`fixed_income_assets`/`variable_income_assets`+`companies`/`etf_details`+`etf_holdings`/`fii_details`). Indicadores fundamentalistas de Ações que dependem de preço (P/L, P/VP, Dividend Yield) e Dividend Yield/cota-valor patrimonial de FII ainda não aparecem aqui — dependem da tabela de cotações da tarefa 3.11.

---

### `GET /companies/{id}`

- **Autenticação:** interno, mesma observação de `GET /assets`.
- **Payload:** `id` no path — UUID da empresa.
- **Sucesso:** `200` → `{ id, name, cnpj, sector, assets: [{ id, ticker, name, share_class? }] }` — `assets` é a lista de ações emitidas pela empresa (ETFs/FIIs nunca aparecem aqui, não têm `company_id`).
- **Erros:**
  - `404` — nenhuma empresa com esse `id`.
  - `503` / `500` — mesmos casos de `GET /assets`.
- **Regra:** nenhuma fórmula — dado cadastral de `companies` + join em `variable_income_assets`/`assets`. Sem histórico de fundamentos (`company_fundamentals` ainda não é populada — isso é o ciclo de relatórios conectado ao Temporizador, tarefa 3.14).
