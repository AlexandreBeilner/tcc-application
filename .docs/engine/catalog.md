# `catalog` — leitura do catálogo de mercado

Pacote de domínio: `engine/internal/domain/catalog/` (+ `etf`/`fii`/`fixedincome` pras especializações, `internal/infra/db/catalog_repository.go` pra persistência). Ver `.claude/arquitetura-engine-go.md` pra entender a divisão em domínio/infra — aqui é só o contrato HTTP. Cotação corrente (`asset_quotes`, tarefa 3.11) exposta desde a tarefa 4.6 em `GET /assets`/`GET /assets/:id` (`current_price`/`daily_change_pct`, só pra `acao`/`etf`/`fii`) e o histórico em `GET /assets/:id/quotes` — antes disso a tabela existia mas não tinha rota nenhuma expondo.

---

### `GET /assets`

- **Autenticação:** interno — chamado pelo backend gamificado, nunca exposto direto ao navegador via gateway.
- **Payload:** query `type` (opcional) — um dos 11 valores do enum `asset_type` (`tesouro_selic`, `tesouro_prefixado`, `tesouro_ipca`, `cdb`, `lci`, `lca`, `cri`, `cra`, `acao`, `etf`, `fii`). Ausente = lista todos.
- **Sucesso:** `200` → array de `{ id, ticker, name, type, risk_class?, is_sandbox, current_price?, daily_change_pct?, interest_rate? }`, ordenado por `ticker`. `interest_rate` (2026-10-24) só vem nos títulos de renda fixa com taxa cadastrada, na mesma escala de `fixed_income.interest_rate` do detalhe (pontos percentuais: "% do CDI" nos pós-fixados, "a.a." no prefixado e no IPCA+), lida numa consulta só para a lista de Renda Fixa mostrar a taxa sem N+1; omitido nos demais. `current_price`/`daily_change_pct` (tarefa 4.6) só aparecem pra `acao`/`etf`/`fii` — renda fixa não tem cotação de mercado nesse sentido (usa `interest_rate`/`minimum_investment`, ver `GET /assets/:id`), então o campo fica **omitido**, nunca `null`. Mesmo pra essas três classes, fica omitido se o Temporizador ainda não gerou nenhuma cotação pro ativo (`asset_quotes` vazio); `daily_change_pct` especificamente fica omitido quando só existe uma cotação (sem dia anterior pra comparar).
- **Erros:**
  - `400` — `type` não é um dos 11 valores válidos.
  - `503` — motor subiu sem `DATABASE_URL` configurado (serviço de catálogo indisponível).
  - `500` — falha inesperada de leitura (catálogo ou cotações).
- **Regra:** projeção direta de `assets` + a cotação mais recente por ativo, lida de `asset_quotes` numa única consulta (`CatalogRepository.ListCurrentQuotes`, `LAG`/`ROW_NUMBER` particionado por `asset_id`) pra não fazer uma query por ativo. Não inclui indicadores por classe (isso só aparece no detalhe, RF21).

---

### `GET /assets/{id}`

- **Autenticação:** interno, mesma observação de `GET /assets`.
- **Payload:** `id` no path — UUID do ativo.
- **Sucesso:** `200` → `{ id, ticker, name, type, risk_class?, is_sandbox, current_price?, daily_change_pct? }` (`current_price`/`daily_change_pct`, tarefa 4.6, mesma regra de omissão de `GET /assets` acima) mais **um** bloco extra, dependendo de `type` (RF21 — nunca reaproveita o layout de um bloco pro outro):
  - renda fixa (8 tipos): `fixed_income: { interest_rate?, maturity_date?, issuer_type, tax_exempt, credit_risk_rating?, minimum_investment }`. `minimum_investment` (tarefa 3.13) é a aplicação mínima do produto, em R$ — valor ilustrativo por tipo, sujeito à calibração da tarefa 8.1 (mesmo precedente de `interest_rate`/`maturity_date`). `interest_rate` de Tesouro Prefixado/IPCA+ (tarefa L.4, `backlog-motor-mercado-realista`) é a taxa OFERTADA HOJE, já recalculada a partir do spread do catálogo + Selic simulada corrente (Prefixado) ou taxa real via correção de Fisher (IPCA+) — a mesma taxa que `POST /fixed-income/purchases` travaria numa compra nova neste exato momento (`CatalogRepository.reprecificarOfertaParaExibicao`, `.docs/engine/fixedincome.md`), nunca um valor estático de catálogo. Fica no valor cru do catálogo (o spread, sem somar benchmark) só se o Temporizador ainda não rodou nenhum tick — transitório, não um erro. Pós-fixado (6 tipos) e ativo `is_sandbox` continuam com `interest_rate` cru, sem essa reprecificação.
  - `acao`: `equity: { company: { id, name, cnpj, sector }, share_class?, outstanding_shares?, indicators?, dividend_history }`. `indicators` (tarefa 4.8, mais Dividend Yield desde a 4.9) é `{ price_to_earnings?, price_to_book_value?, earnings_per_share?, book_value_per_share?, roe?, ebit_margin?, net_margin?, net_debt_to_ebit?, dividend_yield? }` — os 8 indicadores fundamentalistas de RF21 calculados a partir do ciclo de relatório mais recente da empresa (`company_fundamentals`), `outstanding_shares` e o preço corrente do ativo, mais `dividend_yield` (9º campo, calculado independentemente dos outros 8 — não depende de `company_fundamentals`, só de `dividend_events` e da cotação corrente). O bloco `indicators` fica **ausente** só se nem os 8 fundamentalistas nem `dividend_yield` puderem ser calculados; cada campo dentro dele fica **omitido** (não `0`) independentemente dos demais, sempre que o dado de origem falta — `outstanding_shares` ausente (LPA/VPA/P-L/P-VP), ativo sem cotação corrente ainda (P/L, P/VP, Dividend Yield) ou um denominador zero/negativo na fórmula (ex: EBIT = 0 pra Dívida Líquida/EBIT). `dividend_history` (tarefa 4.9) é o histórico de `dividend_events` do ativo, mais recente primeiro — sempre presente, array vazio se o ativo nunca gerou provento nenhum (nunca omitido, diferente de `indicators`).
  - `etf`: `etf: { benchmark_index, methodology_summary?, holdings: [{ constituent_name, weight_pct }], nav?, premium_pct?, nav_day?, shares_outstanding? }`. Desde a tarefa R.3 (backlog-motor-mercado-realista), `nav` (valor patrimonial por cota, `etf.NAV` sobre as posições reais do fundo e os preços de fechamento dos constituintes), `premium_pct` (ágio positivo ou deságio negativo do preço de fechamento sobre o NAV, em pontos percentuais), `nav_day` (dia simulado do NAV) e `shares_outstanding` (cotas emitidas) vêm da última linha de `etf_nav_history` (`CatalogRepository.FindLatestETFNAV`) e ficam **omitidos** até a emissão inicial do ETF e o tick seguinte a gravarem. Desde a R.11, o bloco também traz `tracking_error_pct` (desvio do NAV contra o índice teórico do fundo, R.7, em pontos percentuais; omitido enquanto a coluna não foi gravada) e `dividend_history` (sempre presente, lista vazia se o fundo nunca distribuiu; mesmo formato do histórico de ação e FII, vem de `dividend_events` do ETF, R.8).
  - `fii`: `fii: { fii_type, segment?, net_worth?, vacancy_rate?, indexador?, portfolio_value?, dividend_yield?, price_to_book_value?, dividend_history }` — `segment`/`net_worth`/`vacancy_rate` só em tijolo, `indexador`/`portfolio_value` só em papel (exclusão mútua de `fii.NewDetails`, tarefas 3.8 e 4.10 — `net_worth`/`portfolio_value` também mutuamente exclusivos desde a 4.10). `dividend_yield`/`dividend_history` (tarefa 4.9, estendido a papel pela 4.10) são a mesma fonte e o mesmo cálculo do bloco de ação (nunca reaproveita `equityIndicatorsResponse`, RF21/CLAUDE.md) — `dividend.FIIValuePerShare` (gerador de provento, `.docs/engine/tick.md`) consome `net_worth` (tijolo) ou `portfolio_value` (papel) como a mesma grandeza numérica de origem, sem mudar a fórmula, então os dois perfis têm `dividend_yield`/`dividend_history` preenchidos nas mesmas condições. `price_to_book_value` (tarefa U.6, achado 024) é o P/VP do FII: cotação corrente ÷ (`net_worth` no tijolo, `portfolio_value` no papel, dividido por `outstanding_shares`, lido de `variable_income_assets` junto de `fii_details`), a mesma âncora que o Fundamentalista usa no preço justo (`fii.FairPrice`, `.docs/engine/tick.md`). **Omitido** (não `0`) sem cotação corrente, sem valor-base ou sem cotas em circulação.
  - O bloco extra fica ausente se a especialização ainda não foi persistida pra esse ativo (não deveria acontecer com dado vindo do seed — todo ativo tem sua especialização).
- **Erros:**
  - `404` — nenhum ativo com esse `id`.
  - `503` / `500` — mesmos casos de `GET /assets` (`500` inclui falha ao ler o histórico de `dividend_events`, tarefa 4.9).
- **Regra:** monta a resposta lendo a especialização correspondente ao `type` do ativo já carregado (`fixed_income_assets`/`variable_income_assets`+`companies`/`etf_details`+`etf_holdings`/`fii_details`) mais a cotação corrente (`CatalogRepository.FindCurrentQuote`, tarefa 4.6). Desde a Fase D.2 (`backlog-motor-mercado-realista`), uma empresa recém-seedada já pode ter fundamentos desde o primeiro tick (`CatalogRepository.CreateInitialFundamentals`, chamada só pelo seed — achado da sessão: sem isso, o arquétipo Fundamentalista do motor de bots calculava um preço justo desconectado do preço real, calibrado contra `fundamentals.DefaultBaseRevenue`, pensado pra uma empresa genérica pequena, nunca contra o `outstanding_shares` de um ativo específico) — antes disso, `indicators` só existia a partir do primeiro dia de relatório da empresa (91 dias simulados). Pra `acao`, também lê o ciclo de relatório mais recente da empresa (`CatalogRepository.FindLatestFundamentals`, tarefa 4.8) e calcula os 8 indicadores (`fundamentals.LPA`/`VPA`/`ROE`/`EBITMargin`/`NetMargin`/`NetDebtToEBIT`/`PriceToEarnings`/`PriceToBookValue`, funções puras) combinando esse fundamento com `outstanding_shares` (catálogo) e o preço corrente. Desde a tarefa 4.9, `acao` e `fii` também leem `CatalogRepository.ListDividendHistory` (todo `dividend_events` do ativo, sem filtrar por `paid`) e somam `value_per_share` dos últimos 12 meses (por `payment_date`, relógio real) pra calcular Dividend Yield via `dividend.Yield` — mesma fórmula, calculada independentemente pras duas classes.

**Cache de leitura (Redis, tarefa 5.7):** `FindCurrentQuote` (usado por este endpoint) checa Redis (`REDIS_URL`) antes de consultar Postgres — contrato HTTP e formato de resposta idênticos, só a origem do dado muda. `TickRepository.SaveTick` (`.docs/engine/tick.md`) escreve a cotação nova no cache logo depois de cada tick commitado (write-through), então normalmente a leitura nem chega no Postgres. Sem `REDIS_URL` (ou com Redis fora do ar), o motor cai de volta pro Postgres em toda leitura — mesmo comportamento de antes da 5.7, sem erro nem degradação de resposta.

---

### `GET /assets/quotes`

*(MO.9.5 — base da sparkline das listas do Mercado.)*

- **Payload:** query `days` (opcional, inteiro de 1 a 90, padrão 30); fora disso é `400`.
- **Sucesso:** `200` → `{ "series": { "<asset_id>": [preço, ...] } }`, os `days` preços mais recentes de cada ativo cotado, em ordem cronológica. Ativo sem linha em `asset_quotes` fica fora do mapa; sem nenhuma cotação, `{ "series": {} }` (objeto, nunca `null`).
- **Erros:** `400` — `days` inválido. `500`/`503` — erro de leitura / catálogo indisponível.
- **Regra:** `CatalogRepository.ListRecentPricesByAsset`, uma única consulta (`ROW_NUMBER() OVER (PARTITION BY asset_id ORDER BY simulated_day DESC)`), sem consulta por ativo. Rota literal vence `GET /assets/{id}` no `ServeMux`.

### `GET /assets/{id}/quotes`

- **Autenticação:** interno, mesma observação de `GET /assets`.
- **Payload:** `id` no path — UUID do ativo. Query `days` (opcional, inteiro ≥ 1, default `30`) — quantos dias simulados mais recentes vêm na resposta.
- **Sucesso:** `200` → array `[{ simulated_day, price }, ...]`, ordenado cronologicamente (mais antigo primeiro) — base do gráfico de preço da tela 4.5 (RF04). Lista **vazia** (não erro) se o ativo existe mas o Temporizador nunca gerou cotação pra ele (renda fixa, ou renda variável antes do primeiro tick).
- **Erros:**
  - `400` — `days` não é um inteiro ≥ 1.
  - `404` — nenhum ativo com esse `id`.
  - `503` / `500` — mesmos casos de `GET /assets`.
- **Regra:** nenhuma fórmula — `CatalogRepository.ListQuoteHistory` lê os `days` dias mais recentes de `asset_quotes` pra esse `asset_id`, reordenados cronologicamente antes de responder (a consulta em si busca do mais recente pro mais antigo, pra `LIMIT` pegar os últimos `days` dias, não os primeiros).

---

### `GET /companies/{id}`

- **Autenticação:** interno, mesma observação de `GET /assets`.
- **Payload:** `id` no path — UUID da empresa.
- **Sucesso:** `200` → `{ id, name, cnpj, sector, assets: [{ id, ticker, name, share_class? }], fundamentals: [{ period_date, net_revenue }] }` — `assets` é a lista de ações emitidas pela empresa (ETFs/FIIs nunca aparecem aqui, não têm `company_id`); `fundamentals` (tarefa 3.14) é o histórico de `company_fundamentals`, mais recente primeiro, vazio até o primeiro ciclo de relatório rodar (a cada 91 dias simulados, via Temporizador). `net_revenue` pode vir `null` numa linha sem essa coluna preenchida (não deveria acontecer pro fluxo atual, que sempre grava `net_revenue`); os demais indicadores fundamentalistas (`net_income`/`ebit`/`net_equity`/`gross_debt`/`cash_equivalents`) ainda não têm fórmula de geração e não aparecem na resposta.
- **Erros:**
  - `404` — nenhuma empresa com esse `id`.
  - `503` / `500` — mesmos casos de `GET /assets` (`500` inclui falha ao listar o histórico de fundamentos).
- **Regra:** nenhuma fórmula — dado cadastral de `companies` + join em `variable_income_assets`/`assets`, mais o histórico de `company_fundamentals` (`CatalogRepository.ListFundamentalsByCompany`, ordenado por `period_date` desc). A geração de fato das linhas de `company_fundamentals` é responsabilidade do ciclo de relatórios conectado ao Temporizador (tarefa 3.14, `POST /admin/tick` — ver `.docs/engine/tick.md`), não desta rota de leitura.

## Agenda de balanço e proventos por ativo (RC.6.7, sem rota nova)

Nenhuma rota muda: as colunas abaixo são cadastrais (migration `000048_payment_schedule`) e só o motor passa a ler a partir da RC.6.8. Todo default reproduz o legado (relógio único de 91 dias, ex no dia da geração, pagamento em 5 dias, FII a cada 30 dias).

- `companies`: `report_offset_days` (atraso do balanço em **dias úteis** depois do fim do trimestre, 0 a 31), `dividend_policy` (`quarterly`, `semiannual` ou `annual`), `com_lag_days` e `payment_lag_days` (dias úteis, a data-com depois do balanço e o pagamento depois da data-ex) e `schedule_assigned`.
- `fii_details`: `payout_business_day` (dia útil do mês seguinte em que o fundo paga, 1 a 20) e `schedule_assigned`.
- `dividend_events`: `declared_day`, `ex_day` (dias simulados) e `recipients_snapshotted` (linhas antigas e a geração atual: declaração e ex no mesmo dia, snapshot já tirado).
- `market_calendar.schedule_cutover_day`: até esse dia vale o relógio legado, depois a agenda escalonada; nasce no dia simulado corrente do deploy.
- A agenda é derivada de uma chave estável por `paymentschedule.DefaultsFor` (CNPJ da empresa, ticker do FII; ON e PN dividem a agenda da empresa). O seed atribui na criação e leva ativos antigos à agenda **uma vez** (`schedule_assigned = false` vira `true`), sem sobrescrever o que um admin editar.
