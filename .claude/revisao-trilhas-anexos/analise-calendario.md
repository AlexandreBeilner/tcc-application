# Análise: escalonamento de proventos/balanços e UX "o que me afeta" no Calendário

Somente leitura. Nenhum código alterado. Data da análise: 2026-10-03. Caminhos relativos a `/home/alexandre/WorkSpace/tcc-aplication`.

---------------------------------------------------------------------------

## 0. Mapa rápido (onde está cada peça)

| Peça | Local |
|---|---|
| Tela | `frontend/src/components/organisms/MarketCalendarPanel/index.tsx` (painel aberto pelo chip do relógio da `TopBar`, montado em `templates/AppShell/index.tsx:34`). Não existe `pages/Calendario`. Tela 4.11 / tarefa S.12 |
| Subcomponentes | `molecules/CalendarEventItem`, `molecules/CalendarDayStrip`, `molecules/QuarterGrid` (só desktop), `atoms/CalendarKindIcon`, `features/market/calendarEvents/index.ts` (texto de cada kind), `features/market/useMarketCalendarQuery`, `features/market/quarterCells` |
| Tipos do cliente | `frontend/src/services/market/types.ts:352-395` |
| Rota backend | `GET /market/calendar` em `backend/src/modules/market/interfaces/http/marketRouter.ts:201`; use case `getMarketCalendar.ts` (proxy 1:1, sem regra); port `application/ports/marketCalendarReader.ts`; adapter `infrastructure/engine/engineMarketCalendarReader.ts` |
| Rota engine | `engine/internal/infra/httpserver/calendar.go` (`handleGetMarketCalendar`) |
| Domínio | `engine/internal/domain/marketcalendar/calendar.go` (`Service.Calendar`, linhas 167-261), `clock.go` |
| Leitura SQL | `engine/internal/infra/db/calendar_repository.go` (`DividendsBetween` 74-98, `UserFactsBetween` 102-166) |
| Geração de provento | `engine/internal/domain/tick/tick.go:873-935` (`dividendRecordsForCycle`), chamada em `tick.go:1266` dentro de `Advance` (1141+); fórmulas em `engine/internal/domain/dividend/dividend.go`, `fii/payout.go`, `etf/dividend.go` |
| Persistência/pagamento | `engine/internal/infra/db/tick_repository.go:574-625` (`saveNewDividends`), `:627-680` (`payDueDividends`), `:263-330` (`ListDividendPayerAssets`), `:332+` (`ListPendingDividendPayments`) |
| Docs atuais | `.docs/engine/calendar.md`, `.docs/backend/market.md:89-97` (`GET /market/calendar`) |

---------------------------------------------------------------------------

## 1. Diagnóstico: por que todos os proventos caem no mesmo dia

### 1.1 Como o motor gera hoje (determinístico, sem sorteio)

- **Não há seed nem aleatoriedade na data.** A data é puramente aritmética sobre o índice do dia: `fundamentals.IsReportDay(i, freq) = (i+1) % freq == 0` (`engine/internal/domain/fundamentals/reportcycle.go:23`). `dayIndex = newDay-1` (`tick.go:1143`).
- **Ações:** `companies.report_frequency_days` vale **91 para todas** (default `reportcycle.go:11`, `catalog/company.go:35`, migration `000033_real_time_cycles`). No loop de empresas (`tick.go:1170`) todas batem `IsReportDay` no mesmo dia (91, 182, 273...). O `net_income` desse relatório vira o provento (`EquityValuePerShare`, `dividend.go:60`, payout fixo 50%, `DefaultEquityPayoutRatio`). Ou seja: **balanço, data de geração do provento e data-ex são o mesmo dia para as ~24 empresas.**
- **FIIs:** `dividendRecordsForCycle` usa `IsReportDay(dayIndex, FIIPayoutIntervalDays=30)` (`tick.go:874`, `dividend.go:29`) — um único relógio global de 30 dias para todos os FIIs. Todos geram no mesmo dia (30, 60, 90, 120...). Note que 30 dias não é o mês-calendário (o resto do motor usa `simcalendar` de dia de calendário real; o salário usa 5º dia útil do mês real).
- **ETFs:** distribuem no mesmo dia de relatório global (`tick/etf.go:286`, `announcedDistributions`/`etfDividends`), também alinhados ao 91.
- **Data-ex = dia da geração** (`tick_repository.go:578-589`: `exDate := simcalendar.DateOf(day)`); **pagamento = ex + 5 dias corridos** fixos (`DefaultPaymentLagDays`, `dividend.go:34`) — pode cair em sábado/domingo. O snapshot de elegíveis (`dividend_event_recipients`) é capturado na geração, isto é, na data-ex.
- **Consequência para o calendário:** como o evento só nasce na data-ex e o pagamento é +5, `DividendsBetween` (`calendar_repository.go:74`) nunca tem nada "anunciado" além de 5 dias à frente. Os eventos `dividend_ex_date`/`dividend_payment_date` aparecem em lote (~24 tickers no mesmo dia, 11 FIIs no mesmo dia), e o evento `report` é um único fato global sem ticker (`calendar.go:219-220`; texto fixo "Divulgação de resultados do trimestre" em `calendarEvents/index.ts`).
- **Acoplamentos que dependem do relógio único (precisam ser tratados no escalonamento):**
  1. `fundamentals.DefaultReportFrequencyDays` usado como global em `marketcalendar/calendar.go:16` (`MaxWindowDays`), `clock.go:36` (`QuarterLength`, o "Fim do trimestre" do painel), `tick/etf.go:286`, `tick/etf_rebalance.go:118`, `fiiNetWorthUpdatesForCycle`/`fiiPortfolioValueUpdatesForCycle` (`tick.go:951,982`), `Result.IsReportDay` (`tick.go:1264`).
  2. Evento macro com efeito em fundamentos: `AssignReportDay(..., nextGlobalReportDay(currentDay))` (`macroeventtrigger.go:277, 346`) grava `macro_events.fundamentals_report_day` global; `macroFundamentalsEffectsByCompany` aplica quando `FundamentalsReportDay == newDay` (`tick.go:782-792`). Com datas por empresa, o dia-alvo passa a ser por empresa.
  3. Efeito de preço do provento (S.13/U.4): `dividendPriceEffectPct` e `fiiDividendPriceEffectPct` (`tick.go:572, 593`) usam `(dayIndex+1) % freq` como "dias desde o relatório" (banda de 10 dias). É stateless e acoplado ao relógio.
  4. `cycleIndex = (dayIndex+1)/freq - 1` (`tick.go:1176`) alimenta `fundamentals.NextGrowth` (ruído determinístico por ciclo) — com offset precisa virar "ciclo de calendário da empresa".
  5. `nextGlobalReportDay`/`ReportCutoffDays` (janela de corte do evento macro).
- **Determinismo (RNF08):** a RNF08 da spec (linha 352) é do *Sandbox* (equivalência pedagógica por estágio), não do mercado ao vivo; o mercado ao vivo é determinístico dado `seed` base + chave da entidade (`deterministicSeed(baseSeed, id)`, `tick.go:520`, FNV sobre o **UUID** do ativo/empresa). Cuidado: UUIDs vêm de `gen_random_uuid()`, então hash de UUID **não é reprodutível entre bancos recriados**. Para offset, usar chave estável (ticker/CNPJ) ou, melhor, persistir o offset em coluna (ver 2.2).

### 1.2 Referência real (Brasil) para calibrar

- **FIIs:** pagamento majoritariamente mensal, concentrado na primeira quinzena do mês seguinte; data-com fixa por fundo (comum: último dia útil do mês; alguns no 5º dia útil, ex.: BCFF11, MGFF11); data-ex = dia útil seguinte à data-com; obrigação legal de distribuir >= 95% do lucro de caixa semestralmente (Lei 8.668/93), mas a prática é mensal. Fontes: euqueroinvestir.com (quando os FIIs pagam dividendos), fundsexplorer.com.br, acionista.com.br/moneytimes.
- **Ações:** periodicidade varia por empresa — trimestral (a mais comum em grandes empresas/estatais), semestral (mineradoras como a Vale, muitas elétricas), anual (resíduo do dividendo mínimo obrigatório de 25%, Lei 6.404/76 art. 202), e mensal em casos específicos (ex.: JCP mensal do Banestes, ver fato relevante em ri.banestes.com.br). Dividendos isentos de IR para o acionista; JCP com retenção na fonte (15%, base atual no motor segue o que já existe; NÃO alterar aqui). Ciclo: divulgação do balanço (ITR até 45 dias após o fim do trimestre, DFP até 3 meses após o exercício — por isso as empresas divulgam espalhadas ao longo de ~6 semanas), declaração do conselho (com data-base/data-com), data-ex (dia útil seguinte à data-com), pagamento (de poucos dias a meses depois). Fonte: B3 Bora Investir (agenda de dividendos e JCP), InvestNews/Mais Retorno (calendários).
- Observação para o autor: a regra tributária de dividendos mudou em 2026 (Lei 15.270/2025, IRPF sobre dividendos altos); não foi validada aqui e está fora do escopo — registrar em `pontos-em-aberto` se o autor quiser refletir no motor.

---------------------------------------------------------------------------

## 2. Desenho técnico do escalonamento

### 2.1 Princípios

1. **Função pura de agenda** num pacote novo de domínio `engine/internal/domain/paymentschedule` (ou subpacote de `dividend`; Go idiomático: pacote por conceito). Entrada: `(PolicyKind, offsetDays, cycleIndex)` -> datas. Sem I/O. Table-driven.
2. **Offset persistido como dado, com default derivado por hash estável**, não recalculado em runtime a cada tick: coluna `companies.report_offset_days` e `fii_details.payout_day_of_month`/`payout_offset_days`. Hash (FNV-1a sobre **ticker/CNPJ**, não UUID) só serve para gerar o valor *no momento da criação do ativo* (seed e admin) — assim é reproduzível, editável e imune a UUID aleatório.
3. **Event sourcing intacto:** a mudança é de *quando* se gera `dividend_events` (tabela de leitura/agenda, não financeira) e de *quando* o `dividend_payment` é gravado em `market_events` (continua gravado antes da projeção de saldo, `payDueDividends`). Nada em `market_events` já gravado muda. Nenhuma migração reescreve eventos.
4. **Cutover sem reescrever o passado:** nova coluna `schedule_version`/dia de corte global (`engine_settings` ou constante lida no boot) — antes do dia de corte vale o relógio legado (alinhado), depois dele vale a agenda escalonada. `dividend_events` já gravados ficam intactos e continuam sendo pagos por `payment_day`.

### 2.2 Modelo de dados (migrations novas, aditivas)

- `companies`: `report_offset_days int NOT NULL DEFAULT 0` (0..ReportWindow-1), `dividend_policy text NOT NULL DEFAULT 'quarterly'` (`quarterly | semiannual | annual`), `payout_ratio_pct numeric NULL` (hoje fixo 50%; opcional calibrar por setor). Default 0/quarterly reproduz exatamente o comportamento legado.
- `fii_details`: `payout_offset_days int NOT NULL DEFAULT 0` — posição do fundo dentro do mês de 30 dias, ou preferencialmente `payout_anchor` (`last_business_day | fifth_business_day | day_N`) para casar com o mês-calendário real que `simcalendar` já usa (`IsFifthBusinessDayOfMonth`). Recomendação: **ancorar FII no mês-calendário real** (data-com = último dia útil do mês; ex = próximo dia útil; pagamento = N-ésimo dia útil do mês seguinte, N sorteado deterministicamente no intervalo 5..15). Isso fecha a inconsistência de "30 dias" vs. mês real e dá dias úteis reais.
- `dividend_events`: adicionar `declared_day int`, `ex_day int`, (`payment_day` já existe) e `recipients_snapshotted bool DEFAULT true` (linhas antigas = true, pois o snapshot foi na geração). Índice parcial em `ex_day WHERE recipients_snapshotted = false`.
- ETF: distribuição fica no relógio do fundo, também com offset (mesma coluna de offset em `etf_details`), mas continua sendo derivada do caixa livre (R.8).

### 2.3 Funções puras novas (testáveis)

```
// pacote paymentschedule
func ReportDay(freqDays, offsetDays, cycleIndex int) int            // dia simulado do balanço do ciclo k
func IsReportDay(dayIndex, freqDays, offsetDays int) bool           // generaliza fundamentals.IsReportDay (offset 0 == legado)
func CycleIndex(dayIndex, freqDays, offsetDays int) (int, bool)     // ciclo fechado em dayIndex
func DeclarationLag / ExDay(reportDay, lagBusinessDays) int         // data-ex = dia útil após data-com
func PaymentDay(exDay, lagBusinessDays) int                         // pagamento em dia útil (nunca sáb/dom)
func EquityPayoutCycles(policy) []bool                              // quais balanços do ano pagam (quarterly: 4; semiannual: 2 em Q2/Q4; annual: 1)
func FIIPayoutDays(anchor, month) (comDay, exDay, payDay int)       // mês-calendário real via simcalendar
```
`fundamentals.IsReportDay` permanece (offset 0) para compatibilidade e é chamada por `paymentschedule.IsReportDay` quando offset=0; testes existentes continuam verdes.

Política de periodicidade (calibrável, documentar como "ilustrativo, sujeito à 8.1"):
- Distribuição do catálogo sintético: ~60% trimestral, ~30% semestral, ~10% anual; banco/energia tendem a trimestral/semestral, mineração/agro semestral/anual, tecnologia anual ou sem payout (política `none`/payout baixo). Atribuição por **hash estável do ticker** dentro de pesos por setor (`SectorPolicyWeights`), persistida na criação.
- Em ciclos que não pagam, o balanço ainda sai (fundamentos continuam trimestrais); só não gera `dividend_events`. Em semestral, o valor do pagamento acumula os dois trimestres (pool = soma dos net_income dos dois ciclos × payout). Para isso `EquityValuePerShare` ganha o `netIncome` acumulado (já puro; o chamador soma; sem mudar a fórmula).
- JCP: tratar como *flag de natureza do provento* (coluna `dividend_events.kind = dividend|jcp`) só se o autor decidir modelar IR retido; **fora do escopo desta entrega** (registrar em pontos-em-aberto).

Escalonamento do balanço: `report_offset_days` em [0, 45) dias após o fim do trimestre (ITR até 45 dias), pesos concentrados nas últimas 2-3 semanas. Dia útil: se cair em fim de semana, empurrar para a segunda (reutilizar `simcalendar.IsBusinessDay`).

### 2.4 Declaração separada de data-ex (mudança estrutural principal)

Hoje geração == ex == snapshot. Para o calendário mostrar "vem aí" com dias de antecedência (como o real), separar:
1. **Dia do balanço** (`ReportDay`): gera `company_fundamentals`; se o ciclo paga, grava `dividend_events` com `declared_day=hoje`, `ex_day = ExDay(...)` (futuro), `payment_day = PaymentDay(...)`, `recipients_snapshotted=false`, valor já calculado (net_income do ciclo).
2. **Dia da data-ex** (novo passo no `Advance`): para eventos com `ex_day == newDay && !recipients_snapshotted`, tirar o snapshot de posições (hoje `ListDividendPayerAssets` carrega holders de todos os ativos todo tick — passar a carregar só dos ativos com ex hoje) e gravar `dividend_event_recipients`.
3. **Dia do pagamento**: igual a hoje (`duePaymentsForDay`).
O efeito de preço do provento (queda do preço justo) passa a acontecer na data-ex (mais fiel) — `dividendPriceEffectPct` deve receber `daysSinceEx` derivado de `ex_day`, não de `(dayIndex+1)%freq`.

Cuidado no snapshot: um comprador no dia da data-ex ainda não tem direito (data-com é o dia anterior). Definir `recipients` = posições ao **fechamento do dia anterior à ex** (equivale a posição na data-com) — decisão de produto menor, documentar. Hoje o snapshot é na geração (mesmo dia); ao mover, a regra fica mais fiel ao real.

### 2.5 Ajustes dos acoplamentos

| Acoplamento | Ajuste |
|---|---|
| `Result.IsReportDay` / `ETF` / rebalanceamento / reavaliação de FII (`tick.go:951,982,1264`, `etf.go:286`, `etf_rebalance.go:118`) | Manter relógio global trimestral **apenas** para o que é global (NAV/rebalanceamento de ETF, reavaliação trimestral de patrimônio de FII). Eles não são "data de pagamento"; permanecem alinhados, ou ganham offset próprio por fundo numa tarefa posterior. `Result.IsReportDay` passa a significar "fim de trimestre global" e ganha `ReportingCompanyIDs` |
| `AssignReportDay`/`nextGlobalReportDay` (`macroeventtrigger.go:277,346`) | Calcular `FundamentalsReportDay` **por empresa alvo** (próximo balanço da empresa), ou manter global e aplicar o efeito "no próximo balanço de cada empresa depois de `FundamentalsReportDay`". Menor mudança: trocar a igualdade `== newDay` (`tick.go:792`) por "primeiro balanço da empresa com dia >= FundamentalsReportDay" com marca de consumido por (evento, empresa) — exige estado; alternativa sem estado: janela `[FundamentalsReportDay, +freq)` e o efeito é aplicado no balanço da empresa que cair nela. Eventos já gravados com `fundamentals_report_day` global continuam válidos (a janela os cobre) |
| `QuarterLength` / "Fim do trimestre" no relógio (`clock.go:36`) | Continua como marco do trimestre global; o evento `report` do calendário passa a ser por ticker (ver 3) |
| `cycleIndex` ruído de crescimento | `CycleIndex(dayIndex, freq, offset)`; offset 0 reproduz idêntico ao legado |
| `MaxWindowDays = 92` (`calendar.go:16`) | Desacoplar de `DefaultReportFrequencyDays`: constante própria (92) |

### 2.6 Compatibilidade com dados e eventos já gravados

- `market_events` (append-only por trigger) e `dividend_events` pagos: **intocados**. Nenhuma migration faz UPDATE em `market_events`.
- Eventos `dividend_events` pendentes (`paid=false`) no momento do deploy: continuam pagos por `payment_day` (a coluna é o gate). Backfill: `ex_day = DayOf(ex_date)`, `declared_day = ex_day`, `recipients_snapshotted = true`.
- **Cutover:** constante/setting `schedule_cutover_day` = dia corrente no deploy. Para `dayIndex+1 <= cutover` valem as datas legadas (relógio único). Transição: o primeiro balanço escalonado pode vir após um intervalo menor ou maior que 91 dias (uma vez só). Alternativas se isso incomodar: definir `report_offset` como atraso a partir do relatório legado seguinte (offset sempre >= 0, nunca antes do próximo marco), de modo que ninguém antecipa e o intervalo máximo é 91+offset.
- Pagamentos de FIIs: o legado era a cada 30 dias; na virada para mês-calendário real, o primeiro mês pode ter intervalo irregular (<30 ou >30 dias). Mitigar escolhendo o corte no começo de um mês-calendário.
- Reprodutibilidade: com offsets persistidos por coluna, o replay a partir de um seed novo reproduz a mesma agenda (ticker-hash estável).

### 2.7 Catálogo que cresce

- Escalonar por hash de ticker produz distribuição uniforme esperada; **validar com catálogo sintético** de 500-2.000 ativos (teste gerador: N empresas, N FIIs) afirmando: (a) máximo de eventos de geração por dia <= ~ceil(N/janela)*fator, (b) nenhum dia concentra mais que X% dos eventos do ano, (c) offsets dentro de [0, janela), (d) pagamentos nunca em fim de semana.
- Hash não evita colisões; aceitável, e o teste mede o pior dia. Para evitar rajadas, usar *stratified spreading* (offset = (rank do hash entre os ativos criados) mod janela) só se o teste de pior dia falhar; começar simples.
- Admin que cria ativo/empresa (`catalog_repository.go:68` `CreateCompany`) recebe offset/política automaticamente via função pura `paymentschedule.DefaultsFor(ticker, sector)` e pode editar no painel admin.

### 2.8 Pressão sobre o tick

- Hoje o tick de relatório é um pico (1/91 dos ticks processa todas as empresas e FIIs; 1/30 todos os FIIs) — o escalonamento **achata o pico** (trabalho por tick ~ N/janela).
- Pontos de custo atuais independentes do dia de pagamento: `ListDividendPayerAssets` carrega holders de **todos** os ativos pagadores em **todo** tick (`tick_repository.go:~290-325`); `ListPendingDividendPayments` carrega todos os eventos não pagos com recipients. Com N grande isso escala mal. Mudanças recomendadas dentro da tarefa de repositório: (a) `ListDividendPayerAssets` sem holders (só catálogo), (b) carregar holders só dos ativos com ex hoje, em lote (`WHERE asset_id = ANY($1)`), (c) `ListPendingDividendPayments` filtrar `payment_day = $newDay` (índice parcial já existe: `dividend_events_pending_payment_idx`). Esses ajustes precisam de benchmark com catálogo sintético grande (regra "Design for growth").
- Escrita por dia: `INSERT ... unnest` em lote já existe (Q.6); manter.

### 2.9 Testes (Go, table-driven, junto da implementação)

- `paymentschedule`: `ReportDay`/`IsReportDay` com offset 0 == `fundamentals.IsReportDay` (teste de equivalência exaustiva dias 0..2000), offsets variados, passagem de ano, fim de semana empurrado para segunda, `CycleIndex`, políticas (quarterly/semiannual/annual: nº de pagamentos/ano), `FIIPayoutDays` em meses com 28/30/31 dias e meses começando em fim de semana, `ExDay` pula fim de semana, `PaymentDay` útil.
- Propriedade/dispersão: catálogo sintético 1.000 ativos, afirmar pior dia <= limiar; mesma entrada -> mesma saída (determinismo); ordem do slice de entrada não altera offsets.
- `tick`: `Advance` com 3 empresas de offsets distintos gera proventos em dias distintos; não gera fora do dia; semestral acumula pool de dois ciclos; evento macro de fundamentos atinge cada empresa no seu balanço; efeito de preço desloca para a data-ex.
- Regressão: testes existentes `TestAdvance_Dividendos_*` (`tick_test.go:664-858`) passam com offset 0/quarterly.
- Integração (banco scratch, não o `market` de dev — `market_events` é append-only): snapshot na data-ex, cutover, backfill, pagamento aos recipients, nenhum crédito duplicado.
- `marketcalendar`: evento `report` por ticker, `DividendsBetween` retorna eventos futuros declarados.

---------------------------------------------------------------------------

## 3. Parte 2: UX "o que me afeta"

### 3.1 Problema atual

`Service.Calendar` já devolve `scope: global|user` e o item mostra a tag `VOCÊ` (`CalendarEventItem`), mas:
- O painel lista tudo junto, por dia, em duas colunas "Aconteceu / Vem aí" (`MarketCalendarPanel/index.tsx:178-228`); o usuário não vê separação visual entre o que é dele e o que é informativo.
- Eventos globais de proventos (`dividend_ex_date`/`dividend_payment_date`) vêm de **todos** os ativos (`DividendsBetween` sem filtro de usuário). Com a agenda escalonada o volume cresce (mais datas distintas, e N ativos).
- Não existe "provento a receber" para o usuário: só `dividend_received` (passado, de `market_events`). Faltam: posição (ativos que ele possui), ordens abertas, e valor estimado.
- `QuarterGrid`/`CalendarDayStrip` marcam dias com qualquer evento (`hasEvents`), sem distinguir dias que o afetam.

### 3.2 Modelo de relevância

Campo novo por evento: `relevance: 'mine' | 'market'` (substitui o uso informal de `scope`, que continua) mais `affects`:

```
CalendarEvent {
  ...campos atuais...
  relevance: 'mine' | 'market'      // calculado no servidor (engine)
  relevance_reason?: 'position' | 'open_order' | 'fixed_income_position' | 'own_fact' | 'salary'
  estimated_amount?: number         // R$ estimado/exato do usuário (proventos a receber, vencimento)
  amount_is_estimate?: boolean      // true quando depende de preço/posição futura
  user_quantity?: number            // quantidade do usuário no ativo (posição)
}
```
Regras (no engine, `marketcalendar.Service`):
- **mine**: todo fato `scope=user` (ordens, proventos recebidos, aportes/resgates RF, vencimentos RF, salário); `dividend_ex_date`/`dividend_payment_date` de ticker em que o usuário **tem posição** (ou, para pagamento já com snapshot, aparece em `dividend_event_recipients`); `report` de empresa em que ele tem posição; `order_executed` e **ordens abertas/expirando** (novo fato `order_pending`, opcional na fase 2); vencimento RF das posições dele; `copom` quando ele tem RF pós-fixada/Selic? (decisão: **market**, informação macro; ver 3.7 pergunta aberta).
- **market**: o restante (macro_event, copom, report sem posição, proventos de terceiros).

Estimativa de provento a receber:
- Pagamento já com snapshot (ex já passou): `estimated_amount = unit_value × recipient.quantity` e `amount_is_estimate=false` (exato — vem de `dividend_event_recipients`).
- Antes da data-ex (modelo escalonado 2.4): `unit_value × quantidade atual` com `amount_is_estimate=true` ("se mantiver a posição até a data-com").
- Vencimento RF: valor bruto estimado ainda depende do rendimento; devolver `quantity` e rótulo "valor até o vencimento sujeito ao rendimento"; se o engine já tem função de marcação de saída (fixedincome), usar valor líquido estimado na data (verificar `engine/internal/domain/fixedincome`), senão omitir `estimated_amount` e mostrar só a quantidade/valor investido. Marcar `amount_is_estimate=true`.

### 3.3 Contrato de API: servidor vs. cliente

**Recomendação: calcular no servidor (engine).** Motivos:
- Privacidade/RNF09: o cliente não deve receber a lista de eventos de proventos de terceiros junto com a posição para cruzar; filtrar no servidor reduz tráfego e evita cálculo com posição no cliente (que exigiria `GET /positions` + cruzamento a cada abertura). Relevância é derivada de posições do usuário já acessíveis no engine (`positions`, `fixed_income_positions`, `dividend_event_recipients`).
- Custo: uma consulta extra de posições do usuário (`SELECT asset_id, quantity FROM positions WHERE user_id=$1 AND quantity>0` + RF) por requisição; trivial, indexado por `user_id`. Pode virar um `HoldingsBetween` na interface `UserFacts` (`calendar.go:131`).
- Consistência: o mesmo cálculo serve ao painel, ao `QuarterGrid` (dias "que me afetam") e a futuros badges (ex.: notificação "provento amanhã").
- Nenhum dado novo de terceiros: o valor estimado é do próprio usuário (ele já vê sua posição), nunca patrimônio absoluto de outro usuário. O engine continua recebendo `user_id` do backend a partir do token (nunca da requisição).

Parâmetros novos em `GET /market/calendar`:
- `scope=mine|all` (padrão `all` para não quebrar clientes; o frontend manda `mine` como padrão da UI). `mine` retorna só `relevance=mine`; `all` retorna tudo com o campo.
- Para o `all` com catálogo grande: `market_limit` (padrão 50 por janela, ordenado por proximidade/relevância setorial) + `market_total` no cabeçalho do dia ou da resposta, para o cliente mostrar "+N outros". Evita payload gigante com 1.000 ativos. Campo `summary` por dia: `{ mine_count, market_count }` para o `QuarterGrid`/`DayStrip` pintarem dias sem baixar tudo.
- Backend: schema Zod (`marketCalendarQuerySchema`, `backend/.../schemas.ts`) ganha `scope` (enum) e `market_limit` (int 0..200). Use case continua proxy; port `MarketCalendarQuery` e tipo `CalendarEvent` (`marketCalendarReader.ts`) espelham os campos novos (hoje também falta `reference_month` ali — corrigir de passagem).

Compatibilidade: campos novos são aditivos; `scope` antigo permanece. Frontend atual continua funcionando.

### 3.4 Composição de UI (3 breakpoints)

Princípio: **duas camadas visuais claramente distintas**, não só uma tag.

- **Faixa "Para você" (destaque)** no topo do painel: cartões com borda/acento sólido (cor de ação primária dos tokens `identidade-visual-tokens.md`), ícone por causa (posição, ordem, RF, provento), valor estimado em destaque ("~ R$ 42,10 a receber, 15/10") e rótulo textual ("Você tem 120 cotas"; "estimado" quando `amount_is_estimate`). Ordenados por data. Sólido = já aconteceu/exato; tracejado = estimado/futuro (reaproveita a convenção sólido/tracejado de `identidade-visual-padroes.md`).
- **Seção "No mercado" (secundária)**: itens compactos, tom neutro (sem acento), recolhida por padrão no mobile (accordion "Ver o que acontece no mercado (N)"), com filtro por tipo (`Eventos`, `Copom`, `Balanços`, `Proventos`).
- **Segmented control `Meus | Todos`** no cabeçalho (padrão `Meus`): `Meus` mostra só a faixa "Para você" + o dia; `Todos` mostra as duas camadas. Persistência da escolha em `localStorage` (try/catch, só conveniência por viewer).
- **Dia a dia** (`CalendarDayStrip`/`QuarterGrid`): marcador duplo — ponto preenchido do acento para dias com `mine_count>0`, ponto cinza para dias só com mercado; legenda atualizada (`LEGEND` em `MarketCalendarPanel/index.tsx:27`). Hoje o primeiro evento do dia decide o ícone (`events[0].kind`); passa a priorizar `mine`.

Responsividade (o painel já é uma árvore só com CSS por breakpoint):
- **Mobile (<768px)**: bottom sheet existente; ordem: segmented control, faixa "Para você" (lista vertical, 1 coluna), strip de dias, "No mercado" recolhido. Alvos de toque >= 44px.
- **Tablet (768-1023px)**: painel abaixo da barra; "Para você" em duas colunas de cartões, "No mercado" em lista compacta.
- **Desktop (>=1024px)**: coluna lateral fixa; `QuarterGrid` com marcador duplo + coluna "Para você" fixa no topo do painel e "No mercado" com rolagem própria (nunca mobile esticado).

Estados vazios (texto sem travessão `—`, regra do projeto):
- `Meus` sem nada: "Nada que afete você nos próximos dias." + atalho "Ver o que acontece no mercado" (troca para `Todos`) e dica educativa ("Quando você comprar uma ação ou FII, os proventos dele aparecem aqui").
- Usuário sem posição: mesmo estado com CTA para explorar ativos (link para `/market`).
- `Todos` sem mercado: "Nenhum fato previsto." (já existe).
- Erro: texto atual de `role="alert"`; loading: `role="status"`.
- Dia selecionado vazio por filtro: "Nada neste dia para o filtro escolhido." com botão limpar filtro.

Acessibilidade: relevância nunca só por cor (rótulo `VOCÊ`/"Para você" + ícone + borda sólida/tracejada), foco e `aria-pressed` no segmented control, `aria-live` ao trocar filtro.

### 3.5 Privacidade (RNF09)

- Nunca expor posição, quantidade ou valor de outro usuário; `relevance` e `estimated_amount` só do usuário do token. O `all` expõe só fatos globais já públicos.
- Valor estimado é do próprio usuário (permitido). Não incluir patrimônio total.
- Admin (`role=admin`): sem mudança; a exceção deliberada do patrimônio não se aplica ao calendário.

### 3.6 Impacto em docs

- `.docs/engine/calendar.md`: payload novo (`relevance`, `relevance_reason`, `estimated_amount`, `amount_is_estimate`, `user_quantity`, `summary`, `scope`, `market_limit`), regra de relevância, evento `report` com `ticker`, eventos de provento futuros declarados.
- `.docs/backend/market.md:89-97`: query `scope`/`market_limit`, campos novos, erros 400 de validação.
- `.docs/engine/tick.md`: geração por empresa (declaração/ex/pagamento), políticas, snapshot na data-ex, cutover.
- `.docs/engine/catalog.md` e `.docs/engine/admin.md` (se houver edição de offset/política via admin): campos novos de empresa/FII.
- `.claude/` (decisões): registrar em `especificacao...` (changelog v0.6) e `backlog-motor-mercado-realista.md` a nova fase; `pontos-em-aberto-decisao-produto.md`: JCP/retenção, política Copom "mine", data-com vs data-ex do snapshot, ações PN/ON no escalonamento (par com mesmo offset por empresa, já garantido porque o offset é da empresa).
- `.claude/identidade-visual-padroes.md`: padrão "faixa Para você" + marcador duplo.

### 3.7 Perguntas de produto abertas (registrar, não bloquear)

1. Copom/macro devem aparecer como "mine" para quem tem RF pós-fixada ou ativos do setor afetado? (sugestão: não na v1; "mine" só para fatos com consequência financeira direta no saldo do usuário).
2. Snapshot de elegíveis: posição ao fechamento da data-com (real) ou na data-ex (legado)?
3. Tolerância de transição no cutover (primeiro ciclo de comprimento irregular).
4. Quais empresas distribuem anual/semestral (pesos por setor) — calibração ilustrativa.

---------------------------------------------------------------------------

## 4. Riscos

| Risco | Mitigação |
|---|---|
| Quebra de `AssignReportDay`/efeito macro de fundamentos (hoje `==` dia global) | Tarefa dedicada com testes; janela em vez de igualdade; compat. com `macro_events` gravados |
| Dupla geração / perda de provento no cutover | `schedule_cutover_day`, teste de integração em banco scratch, `paid`/`payment_day` como gate; teste de idempotência |
| Mudança do instante do snapshot altera quem recebe | Decisão explícita (3.7 item 2); manter legado como padrão da primeira entrega (snapshot na geração) e só mudar na tarefa de declaração separada |
| Pico de tick não diminui se hash concentra | Teste de dispersão com catálogo sintético; estratificação se necessário |
| Payload cresce no `all` | `market_limit` + `summary`; paginação por janela já existente (92 dias) |
| `ListDividendPayerAssets` carregando holders de todos os ativos por tick | Tarefa de otimização + benchmark com catálogo grande |
| Efeito de preço do provento (banda de 10 dias) descasar da data-ex | Passar a derivar de `ex_day`; testes de `dividendPriceEffectPct` com offsets |
| ETFs/FII com reavaliação trimestral global desalinhada do balanço por empresa | Manter globais por ora, documentar; tarefa futura de offset por fundo |
| Duas mudanças (escalonar + UX) acopladas | Entregar UX primeiro sobre os dados atuais (valor imediato, baixo risco); escalonamento depois |

---------------------------------------------------------------------------

## 5. Quebra em tarefas (uma sessão cada)

Sugestão de ordem: Trilha B (UX) pode começar já e é independente da Trilha A (escalonamento). Cada tarefa segue o checklist do CLAUDE.md (testes junto, lint, docs `.docs/`, validação via `docker compose up`).

### Trilha A: escalonamento

**A.1 Pacote `paymentschedule` (funções puras)** — depende de: nada.
- `IsReportDay`/`ReportDay`/`CycleIndex` com offset, `ExDay`/`PaymentDay` em dia útil, `EquityPayoutCycles` (políticas), `FIIPayoutDays` (mês real), `DefaultsFor(ticker, sector)` (hash FNV estável).
- Aceite: offset 0 equivale a `fundamentals.IsReportDay` em 0..2000 dias; table-driven cobrindo fim de semana, ano bissexto, meses 28-31; dispersão em catálogo sintético de 1.000 ativos (pior dia <= limiar documentado); `golangci-lint`, `go test ./...` verdes.

**A.2 Migrations + catálogo + seed** — depende de A.1.
- Colunas `companies.report_offset_days`, `dividend_policy`, `fii_details.payout_*`, `dividend_events.declared_day/ex_day/recipients_snapshotted` com defaults que reproduzem o legado; backfill; `CreateCompany`/FII preenchem via `DefaultsFor`; seed atribui.
- Aceite: migration sobe e desce em banco scratch; linhas antigas inalteradas; cutover setting criada; `go test` de repositório; documentado em `.docs/engine/catalog.md`.

**A.3 Balanço escalonado por empresa no `Advance`** — depende de A.1, A.2.
- Substituir `fundamentals.IsReportDay(dayIndex, c.ReportFrequencyDays)` e `cycleIndex` por funções com offset; `CompanyForFundamentals.ReportOffsetDays`; respeitar `schedule_cutover_day`.
- Aceite: 3 empresas com offsets diferentes reportam em dias diferentes; offset 0 regressão idêntica; `TestAdvance_*` existentes verdes; evento macro de fundamentos (janela) aplica no balanço de cada empresa.

**A.4 Proventos de ação por política (trimestral/semestral/anual) e pagamento em dia útil** — depende de A.3.
- `dividendRecordsForCycle` por empresa e política; pool acumulado; `PaymentDay` em dia útil; `EquityPriceEffectPct` ancorado na data-ex.
- Aceite: semestral gera 2 pagamentos/ano com pool acumulado; anual 1; nenhum pagamento em sábado/domingo; efeito de preço na janela da ex; testes table-driven.

**A.5 FIIs no mês-calendário real, offset por fundo** — depende de A.1, A.2.
- Substituir `FIIPayoutIntervalDays=30` por `FIIPayoutDays`; `fiiDividendPriceEffectPct` na ex; manter `PayoutsPerYear=12`.
- Aceite: FIIs pagam em dias diferentes do mês seguinte, dentro de 5..15º dia útil; 12 pagamentos por ano; DY anual-alvo (`fii/payout.go`) preservado em teste.

**A.6 Declaração separada e snapshot na data-ex + otimização de carga** — depende de A.4, A.5.
- Gerar `dividend_events` no balanço com `ex_day` futuro; passo de snapshot na ex; `ListDividendPayerAssets` sem holders; holders só dos ativos com ex hoje; pendentes por `payment_day`.
- Aceite: quem vende antes da data-com não recebe, quem compra depois não recebe; benchmark com catálogo sintético mostra queries/tick não crescem com nº de ativos sem evento; integração em banco scratch; nenhum evento duplicado no cutover.

**A.7 ETFs: distribuição com offset por fundo (opcional)** — depende de A.3. Aceite: distribuição do ETF em dia distinto, NAV/passivo coerentes (R.8/R.12b).

**A.8 Evento macro por empresa** — depende de A.3. Ajusta `AssignReportDay`/`macroFundamentalsEffectsByCompany`; aceite: eventos antigos gravados continuam aplicando uma vez; testes.

### Trilha B: calendário "o que me afeta"

**B.1 Relevância e `estimated_amount` no engine** — depende de: nada (funciona com dados atuais).
- Interface `UserFacts` ganha `HoldingsBetween`/posições; `Event` ganha `Relevance`, `RelevanceReason`, `EstimatedAmount`, `AmountIsEstimate`, `UserQuantity`; `report` por ticker (posição do usuário); `summary` por dia; `scope`/`market_limit`.
- Aceite: usuário sem posição só tem `mine` nos fatos próprios; com posição em X vê provento/balanço de X como `mine` com valor exato a partir de `dividend_event_recipients`; nenhum dado de terceiros; testes de domínio com fakes; teste de integração SQL; `.docs/engine/calendar.md` atualizado.

**B.2 Backend: query e tipos** — depende de B.1.
- `marketCalendarQuerySchema` (`scope`, `market_limit`), port/tipos espelham, teste de router (supertest) e use case.
- Aceite: `scope` inválido -> 400; `user_id` na query ignorado; docs `.docs/backend/market.md`.

**B.3 Frontend: dados e agrupamento** — depende de B.2.
- Tipos em `services/market/types.ts`, `features/market/calendarRelevance` (função pura: separa mine/market, ordena, resume), segmented control com persistência `localStorage`.
- Aceite: testes unitários da função pura; query manda `scope=mine` por padrão.

**B.4 UI "Para você" + "No mercado" nos 3 breakpoints** — depende de B.3.
- Faixa "Para você", seção secundária recolhível, marcador duplo em `CalendarDayStrip`/`QuarterGrid`, legenda, estados vazios, acessibilidade.
- Aceite: mobile/tablet/desktop verificados (mockup/rascunho antes por ser mudança de padrão visual); relevância nunca só por cor; sem travessão no texto de UI; testes de componente (`MarketCalendarPanel/index.test.tsx` estendido); `docker compose up` e checagem visual.

**B.5 Pontos em aberto e docs de decisão** — depende de B.1.
- Registrar em `.claude/pontos-em-aberto-decisao-produto.md` os itens 3.7 e o JCP; atualizar spec changelog/backlog.

### Dependências

```
A.1 -> A.2 -> A.3 -> A.4 -> A.6
        |      |       \-> A.5 -> A.6
        |      \-> A.7, A.8
B.1 -> B.2 -> B.3 -> B.4      B.5 (após B.1)
```
A Trilha B não depende da A: entrega valor primeiro (recomendado). Depois de A.6 o calendário passa a mostrar proventos futuros declarados com dias de antecedência, o que valoriza a faixa "Para você" (B).

---------------------------------------------------------------------------

## 6. Fontes web consultadas

- euqueroinvestir.com: quando os FIIs pagam dividendos
- fundsexplorer.com.br, acionista.com.br, moneytimes.com.br (calendários de FIIs)
- B3 Bora Investir: agenda de dividendos e JCP
- ri.banestes.com.br (JCP mensal com data-base, ex e pagamento)
- InvestNews / Mais Retorno (calendários de dividendos)
