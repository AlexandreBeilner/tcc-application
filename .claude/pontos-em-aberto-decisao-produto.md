# Pontos em aberto que exigem decisão de produto

Este arquivo é o backlog de **achados** (de review, de auditoria, ou notados durante a implementação de
uma tarefa) que são um gap ou uma inconsistência real, mas que **não podem ser corrigidos
mecanicamente** — a correção depende de uma decisão de produto/design que só o autor pode tomar (um
número de negócio sem valor confirmado em nenhum documento, uma escolha de comportamento entre duas
opções válidas, um trade-off deliberado ainda não resolvido). Ver CLAUDE.md, seção "Como trabalhar a
partir do backlog", item 5 — este arquivo é onde esse tipo de pausa fica registrado em vez de se
perder no fim da sessão/PR em que foi notado.

**Não é** lugar para bugs mecânicos (esses se corrigem na hora, na mesma sessão/PR em que foram
achados) nem para achados que uma investigação mostrou que na verdade batem com um padrão já
estabelecido no código (esses são refutados e descartados, não entram aqui).

Cada entrada: local exato, o que foi observado, por que não foi corrigido de cara, e o status. Ao
resolver uma entrada, mova pro final da seção "Resolvidos" com a decisão tomada e a data — não apague,
é histórico de decisão.

## Convenção de entrada

```
### <id> · <título curto>

- **Local:** `arquivo:linha`
- **Origem:** tarefa/PR/review que encontrou isso, com data
- **O que é:** descrição do gap/inconsistência
- **Por que não foi corrigido:** o motivo específico (número sem valor confirmado, escolha de
  comportamento em aberto, etc.) — nunca "falta de tempo"
- **Opções:** 2+ caminhos possíveis, se já visíveis
- **Status:** aberto
```

## Em aberto

### 001 · `RiskProfile.MarketOrderPreference` nunca é lido

- **Local:** `engine/internal/domain/bot/personality.go:156` (campo), consumido por nenhuma das 4
  `Decide*` (`noise.go`, `marketmaker.go`, `chartist.go`, `fundamentalist.go`)
- **Origem:** review do PR #25 (Fase C do backlog-motor-mercado-realista), 2026-09-13
- **O que é:** o campo é validado (`NewRiskProfile`), semeado (0.50 pra todo bot) e persistido em
  `bot_personalities.market_order_preference`, mas nenhuma função de decisão de arquétipo o consulta —
  todas geram sempre `orderbook.TypeLimit`. Um dado totalmente modelado (validação própria, seed,
  coluna no banco) sem efeito nenhum no comportamento do motor.
- **Por que não foi corrigido:** usar o campo significa decidir *como* um bot escolhe entre ordem a
  mercado e limitada (probabilidade sorteada por rodada? só alguns arquétipos? só em certas
  condições de mercado?) — nenhuma dessas opções está fechada na proposta 2.3.2. As descrições de
  aceite de C.2-C.5 já documentam "ordem sempre limitada", o que sugere adiamento deliberado pra Fase D
  (orquestração da rodada), não descuido — mas isso não está confirmado.
- **Opções:** (a) confirmar que é adiado pra Fase D e documentar isso explicitamente no comentário do
  pacote `bot`, ou (b) desenhar agora a regra de uso (ex: `Decide*` sorteia o tipo com probabilidade
  `MarketOrderPreference` antes de montar a `Decision`).
- **Status:** aberto

### 002 · Teto de `SpreadWidthPct` do Market Maker perto de 2.0

- **Local:** `engine/internal/domain/bot/marketmaker.go:61` (`DecideMarketMakerOrders`), validação em
  `engine/internal/domain/bot/personality.go:172` (`NewRiskProfile`, só rejeita `< 0`)
- **Origem:** review do PR #25 (Fase C do backlog-motor-mercado-realista), 2026-09-13
- **O que é:** `NewRiskProfile` não tem teto pra `SpreadWidthPct`; `DecideMarketMakerOrders` só rejeita
  `spread >= 2` exatamente. Um valor válido tipo `1.999999` passa nos dois, faz `bidPrice` colapsar
  perto de zero e `int(availableCash/bidPrice)` produzir uma quantidade gigante/instável (conversão
  float→int fora da faixa é comportamento não determinístico em Go). Hoje inofensivo — o seed
  (`cmd/seed/main.go`) fixa `0.02` — mas nada no domínio impede um valor extremo vindo de um consumidor
  futuro (ex: o painel admin da Fase N, `POST /admin/bots`).
- **Por que não foi corrigido:** qualquer teto mais apertado que `< 2` é um número de negócio (ex:
  "spread máximo de 10%") sem valor confirmado na proposta motor-mercado-realista — inventar um valor
  seria decisão de produto, não técnica.
- **Opções:** (a) autor define um teto máximo razoável de spread e ele vira constante confirmada tipo
  `MarketMakerShareMin/Max`, ou (b) mover a validação de `spread >= 2` pra dentro de `NewRiskProfile`
  (fecha o buraco de "RiskProfile inválido só detectado no consumo", sem resolver o valor extremo
  perto do teto).
- **Decisão parcial (2026-09-23):** teto de spread de 0,10 (ilustrativo) adotado na tarefa **P.6** da Fase P
  (`backlog-motor-mercado-realista.md`), valor confirmado pelo autor ao seguir a recomendação da proposta de
  cobertura de Market Maker. Move pra Resolvidos quando a P.6 fechar.
- **Status:** aberto, com dono real (P.6)

### 004 · `macroPriceEffectsByCompany` soma sem teto pode inverter o sinal do preço justo

- **Local:** `engine/internal/domain/tick/tick.go:600` (`macroPriceEffectsByCompany`, linha atualizada
  pós-Fase J — mecanismo/achado inalterados), consumido em
  `engine/internal/domain/bot/fundamentalist.go:129` (`FundamentalistFairPrice`:
  `fairPrice := vpa * (roe / requiredReturn) * (1 + growthRate) * (1 + macroEffectPct/100) * (1 +
  pnPremiumPct/100)` — a tarefa J.3 acrescentou o fator `pnPremiumPct` ao final, mas ele nunca é
  negativo (piso legal de dividendo da PN, sempre >= 0), então não interage com o problema deste
  achado)
- **Origem:** review do PR #27 (Fase E do backlog-motor-mercado-realista), 2026-09-14/16
- **O que é:** a tarefa E.2 (`.claude/backlog-motor-mercado-realista.md`, já ✅) documenta
  deliberadamente que `macroPriceEffectsByCompany` soma `PriceEffectPct` **sem teto**, descrito como "a
  mesma ausência de limite que `macroPriceMultiplier` já tinha" antes de ser removida nesta mesma
  tarefa. Essa equivalência não é exata: o `macroPriceMultiplier` antigo empilhava
  *multiplicativamente* (`multiplier *= (1+pct/100)^(1/duration)` por evento) — produto de fatores
  positivos, nunca inverte de sinal não importa quantos eventos se acumulem. O novo caminho soma os
  `PriceEffectPct` brutos (cada um até ±25%, banda severa) e só então aplica um único fator
  `(1 + soma/100)` — se a soma de eventos concorrentes sobre a mesma empresa passar de -100% (ex: 5
  eventos severos negativos no mesmo setor, nada no domínio impede isso hoje), o fator vira negativo e
  `fairPrice` inverte de sinal antes do clamp em `FundamentalistMinFairPrice` (0.01). Não é um crash
  nem um `NaN` — o piso já existente absorve o caso — mas dois cenários bem diferentes (evento
  moderadamente stackado vs. o sinal efetivamente invertido) colapsam no mesmo preço-piso artificial,
  perdendo a proporcionalidade que `macroFundamentalsEffectsByCompany` preserva no caminho irmão via
  `macroevent.CombinePendingEffects`/`DefaultFundamentalsCapPct` (spec 3.3: "evita o resultado
  didaticamente absurdo de vários eventos severos empilhados sem limite" — a mesma justificativa
  citada por E.2 pra *não* aplicar um teto ao efeito de preço).
- **Por que não foi corrigido:** o valor do teto (se algum) é um número de negócio sem valor confirmado
  em nenhum documento — `DefaultFundamentalsCapPct = 40.0` é especificamente sobre fundamentos (spec
  3.3), nunca foi proposto como valor também válido pro efeito de preço do Fundamentalista. Além disso
  "sem teto" foi uma escolha deliberada e já registrada (não um descuido mecânico) — corrigir sem
  confirmar com o autor seria redecidir algo já fechado (CLAUDE.md).
- **Opções:** (a) aplicar `macroevent.CombinePendingEffects` (ou um teto novo e próprio) também a
  `macroPriceEffectsByCompany`, alinhando de fato com o comportamento do multiplicador antigo (nunca
  inverte sinal); (b) manter sem teto, mas documentar explicitamente que o piso
  `FundamentalistMinFairPrice` é a proteção intencional pra esse caso (aceitar a perda de
  proporcionalidade em eventos concorrentes extremos como já coberto, não um gap); (c) impedir múltiplos
  eventos macro concorrentes sobre a mesma empresa/setor no disparo (`macroeventtrigger.Trigger`),
  tornando o cenário de estouro impossível na origem em vez de tratado no consumo.
- **Decisão parcial (2026-09-23):** teto de spread de 0,10 (ilustrativo) adotado na tarefa **P.6** da Fase P
  (`backlog-motor-mercado-realista.md`), valor confirmado pelo autor ao seguir a recomendação da proposta de
  cobertura de Market Maker. Move pra Resolvidos quando a P.6 fechar.
- **Status:** aberto, com dono real (P.6)

### 008 · Duas fontes de sensibilidade à Selic para a mesma empresa (setor vs. `risk_class`)

- **Local:** `engine/internal/domain/fundamentals/fundamentals.go` (`CoefficientsBySector[...].
  SelicSensitivity`, usada por `ExpectedGrowth`/`GrowthSeries`/`NextGrowth` via `tick.
  fundamentalsConfig`) vs. `engine/internal/domain/bot/fundamentalist.go:109`
  (`fundamentals.SensitivityByRiskClass[riskClass]`, usada por `FundamentalistFairPrice` no cálculo
  do retorno exigido da fórmula de Justified Price-to-Book)
- **Origem:** tarefa K.2 (`backlog-motor-mercado-realista.md`), 2026-09-19 — a K.1
  (`.claude/calibracao-fundamentos-setor.md`) já tinha sinalizado isso como recomendação de
  implementação não-decidida
- **O que é:** antes da K.2, as duas fórmulas (crescimento de receita e retorno exigido no preço
  justo) liam a mesma tabela `SensitivityByRiskClass` (2 valores, por `risk_class` do ativo) — o
  comentário original de `bot.FundamentalistFairPrice` até dizia explicitamente "reaproveitado aqui,
  não duplicado". A K.2 migrou só a primeira fórmula pra uma tabela por setor (`CoefficientsBySector`,
  6 valores, calibrados com fonte real pela K.1), porque o próprio texto da tarefa a escopava em
  "aplicação da calibração em `fundamentals.go`" — `bot.FundamentalistFairPrice` fica fora desse
  arquivo e, principalmente, fora do escopo de uma sessão (mudar sua assinatura de 11 parâmetros
  rippla por `bot/round.go`, `tick/rounds.go` e os testes das Fases C/D/E, já fechadas). Resultado:
  hoje as duas fórmulas podem divergir pra uma mesma empresa — ex: VALR3 (Mineração) usa sensibilidade
  0.02 pro crescimento de receita (tabela por setor) mas 0.02 (Conservador) pro retorno exigido
  (tabela por risk_class, coincidência dos números atuais, não garantia); BNDD4 (Bancário) usa 0.05
  (tabela por setor) pro crescimento mas 0.06 (Sofisticado) pro retorno exigido — já divergem hoje.
- **Por que não foi corrigido:** decidir se as duas fórmulas devem convergir pra uma fonte única
  (sector) é uma escolha de design que muda o comportamento de todo o arquétipo Fundamentalista
  (Fase C, já fechada e validada ao vivo) — não é um número sem valor confirmado, é uma escolha de
  arquitetura/comportamento entre manter dois conceitos de sensibilidade deliberadamente separados
  (um por setor pra fundamentos, um por risk_class pra valuation) ou unificar os dois por setor.
- **Opções:** (a) migrar `bot.FundamentalistFairPrice`/`DecideFundamentalistOrder` pra receber
  `catalog.Sector` em vez de `equity.RiskClass` e ler `fundamentals.CoefficientsForSector(sector).
  SelicSensitivity`, unificando as duas fórmulas numa fonte só — maior blast radius (assinatura de
  11 parâmetros, `bot.DecisionInput.RiskClass`, call sites em `round.go`/`rounds.go`, testes de
  C.5/D.2/E.2); (b) manter as duas tabelas deliberadamente separadas (crescimento de receita
  reflete margem/alavancagem setorial real, retorno exigido reflete um conceito de risco por classe
  de ativo, não por setor da empresa) e documentar isso como decisão consciente, não gap.
- **Status:** aberto

### 013 · Book sem ordens de compra no instante em que o usuário tenta vender (venda a mercado logo após a compra não preenche)

- **Local:** `engine/internal/domain/tick/rounds.go` (`runIntradayRounds`), `engine/internal/domain/bot/marketmaker.go`
- **Origem:** teste de ponta a ponta da correção do achado 009, 2026-09-23
- **O que é:** com o motor parado depois de 60 ticks, comprar 100 ações a mercado de VALR3 ou BNDD4 preenche (há ordens
  de venda em repouso), mas vender as mesmas 100 a mercado logo em seguida retorna `filled_quantity: 0` (ordem fica
  pendente): o book de VALR3 só tinha ordens de venda em repouso no fim do dia 60 (5 pendentes + 2 parciais),
  nenhuma de compra, porque as compras dos bots foram consumidas nas rodadas do dia e as ordens só são recotadas nas
  rodadas do próximo tick. Reproduzido idêntico no código anterior à correção do 009 (não é regressão dela).
- **Por que não foi corrigido:** exige decidir como o mercado deve se comportar entre ticks: manter cotação
  bilateral contínua do Market Maker entre rodadas, recotar depois de cada fill, ou aceitar que o usuário só
  executa venda quando há contraparte na rodada. Impacta usabilidade direta (usuário não consegue "desfazer" uma
  compra na hora), mas a forma de resolver é escolha de comportamento.
- **Opções:** (a) o Market Maker recota imediatamente após um fill (mantém sempre os dois lados no book); (b)
  reservar uma fatia da profundidade de compra que não é consumida pelas rodadas de bots; (c) manter como está e
  deixar a ordem a mercado virar limitada e esperar a próxima rodada (UX: mostrar "aguardando contraparte", já
  coberto pela tela "Minhas Ordens").
- **Análise (2026-09-23):** causa raiz medida e proposta de solução escalável em
  `.claude/proposta-cobertura-market-maker.md` (o Market Maker sorteia um ativo por rodada e a expiração
  diária apaga a cotação; nenhuma das opções (a)/(b)/(c) acima resolvia isso sozinha).
- **Decisão (2026-09-23, confirmada com o autor):** seguir a proposta; virou a **Fase P**
  (`backlog-motor-mercado-realista.md`, tarefas P.1 a P.10). Fecha quando a P.8 confirmar que a compra e a
  venda de 100 ações preenchem nos ativos cobertos.
- **Status:** aberto, com dono real (Fase P)

## Resolvidos

### 003 · Calibração inicial de `company_fundamentals` é um número inventado, não pesquisado

- **Decisão (2026-09-13):** o achado misturava dois problemas de natureza diferente, e só um deles
  exigia decisão de produto:
  1. **Mecanismo** (resolvido nesta sessão, sem decisão de produto pendente — pesquisa em
     [literatura de simulação de mercado por agentes](https://arxiv.org/pdf/1909.11650) confirma que o
     "valor fundamental" inicial deve ser tratado como entrada exógena escolhida pra ser consistente
     com o preço de partida, nunca derivado à parte e reconciliado por tentativa): `97.0` era álgebra
     resolvida uma única vez à mão e cravada numa constante — não generalizava pra nenhuma empresa
     futura da tarefa 7.2 (currículo completo) sem repetir o mesmo exercício manual, com o mesmo risco
     de corromper o book se esquecido. Substituído por
     `fundamentals.BootstrapFinancialsForTargetPrice(targetPrice, outstandingShares, growthRate,
     selicNeutral)` (`engine/internal/domain/fundamentals/fundamentals.go`) — inverte a fórmula de
     Justified Price-to-Book de `FundamentalistFairPrice` e resolve algebricamente o `net_revenue` que
     faz o preço justo nascer exatamente em `targetPrice`, pra qualquer `outstandingShares`/preço-alvo.
     `seedInitialFundamentals` (`engine/cmd/seed/main.go`) passa a chamá-la com
     `tick.DefaultInitialPrice`, generalizando automaticamente pra qualquer ativo futuro sem álgebra
     manual nova. Testado (round-trip: preço justo recalculado bate com o alvo dentro de 1e-6, pra
     várias combinações de preço/ações/crescimento/Selic — não só os dois casos atuais; e reproduz o
     `~97.0` histórico como caso particular) em
     `engine/internal/domain/fundamentals/fundamentals_test.go`.
  2. **Dado** (continua em aberto, sem duplicar rastreio): quais coeficientes usar (margem líquida,
     margem EBIT, patrimônio/receita, sensibilidade à Selic) por setor real, com pesquisa B3/CVM — isso
     já tinha dono antes deste achado: `.claude/proposta-motor-mercado-realista.md` seção 7, a
     executar na Fase K de `backlog-motor-mercado-realista.md`. Não vira uma segunda entrada aqui.
- **Validação:** `go build ./...`, `go test ./...` e `golangci-lint run ./...` (via Docker,
  `golangci/golangci-lint:v2.5.0-alpine`) passando; `docker compose up` (postgres + engine) confirma
  migrations aplicadas e o seed rodando ponta a ponta contra o banco real sem erro.

### 005 · Tamanho de ordem de bot sem teto contra o float — preço "trava" por semanas/meses simulados

- **Decisão (2026-09-19):** achado fechado em duas partes (A/B), com a terceira (C) deliberadamente
  deferida — decisão confirmada com o autor de que as duas primeiras já bastam pra corretude, a
  terceira é só calibração/realismo:
  1. **Parte A — ciclo de vida de ordem** (resolvido, mecanismo geral, não um número de negócio): a
     causa por trás de "331 ordens já excediam sozinhas o float, pior caso 553x" não era só o
     dimensionamento de uma ordem nova — era a ausência completa de expiração. Nenhuma ordem
     cancelava a anterior nem expirava, então `order_book` crescia sem limite pra sempre.
     `order_book.simulated_day` (coluna nova, migration `000017`) carimba o dia simulado em que cada
     ordem nasceu (`orderexecution.Context.SimulatedDay`/`Request.SimulatedDay`, carimbado por
     `Service.SubmitWithContext` a partir do `Context` recém-carregado — nunca do valor que o
     chamador já tinha, mesmo pra ordem humana via `POST /orders` e ordem de bot via
     `tick.runIntradayRounds`). `OrderExecutionRepository.ExpireStaleOrders`, chamado por
     `tick.Service.Run` antes de cada dia novo, cancela toda ordem `pending`/`partially_filled` de um
     dia anterior — cancelar não reverte saldo/posição (nada é reservado na submissão), então não
     passa por Event Sourcing. `OrderExecutionRepository.CancelUserRestingOrders`, chamado por
     `runIntradayRounds` só pro arquétipo `market_maker`, cancela a cotação da rodada anterior antes
     de recotar o mesmo (bot, ativo) — sem isso ele empilhava um par novo por rodada em vez de
     substituir.
  2. **Parte B — teto de tamanho de ordem por volume negociado real** (resolvido, valor ilustrativo
     sujeito à mesma calibração futura de outros coeficientes do motor, não uma decisão bloqueada):
     100% do float sozinho continuava um teto gigante, sem relação com o que o mercado de fato
     absorve num dia. `TickRepository.RecentTradedVolume` (mesmo contrato de `RecentClosingPrices`,
     alimentado por `asset_quotes.total_quantity`, coluna nova da mesma migration) mede o volume médio
     dos últimos `ChartistPriceHistoryDays` dias; `tick.effectiveOrderSizeCeiling` usa o menor entre o
     float e `MaxOrderPctOfAverageVolumePct` (20%, ilustrativo) desse volume — `bot.DecisionInput.
     FloatCeiling` renomeado pra `OrderSizeCeiling` nos 4 arquétipos, deixando claro que o teto pode
     vir de qualquer um dos dois. `total_quantity` nasce **nullable, sem `DEFAULT`** de propósito —
     achado do próprio teste de ponta a ponta desta correção: um `DEFAULT 0` faria todo dia anterior à
     migration virar "volume real zero" (em vez de "não rastreado"), zerando o teto de compra de todo
     bot já em produção permanentemente (nenhum jeito de sair do zero, porque comprar exige o teto
     ser positivo). `NULL` nas linhas antigas + `RecentTradedVolume` filtrando `IS NOT NULL` corrige
     isso: dia sem dado conta como "sem histórico ainda" (cai pro float sozinho), não "zero
     negociado".
  3. **Parte C — agora com dono real: `J.6`** (`.claude/backlog-motor-mercado-realista.md`,
     2026-09-20): esta entrada original (2026-09-19) apontava "já tinha dono... Fase K de
     `backlog-motor-mercado-realista.md`", reaproveitando o mesmo raciocínio do achado 003 acima
     sem checar se a Fase K *como escrita no backlog* de fato cobria isso. Não cobria: K.1/K.2
     (implementadas e fechadas — teste de ponta a ponta da Fase J confirmou, 2026-09-19) escopam
     literalmente "calibração de fundamentos por setor" — margem líquida, margem EBIT,
     patrimônio/receita, dívida/patrimônio, caixa/receita e sensibilidade à Selic de
     `fundamentals.go` —, nunca mencionando `bot.InitialCash`/`InitialAllocation`
     (`engine/internal/domain/bot/`, módulo diferente). Efeito prático confirmado ao vivo em dois
     testes de ponta a ponta da Fase J (não é só "ordens de venda desproporcionais", como o texto
     original registrava): rodando o motor do zero (seed novo) por ~50-60 dias simulados seguidos,
     o mercado trava por completo — `RecentTradedVolume` (Parte B) cai a 0 real depois de dias sem
     negociação suficiente, `effectiveOrderSizeCeiling` fica preso em 0 pro lado de compra, e sem
     contraparte de compra as vendas também param de casar, perpetuando o zero indefinidamente
     (`BNDD4`/`PAPL11`/`TJLO11` observados presos exatamente no preço inicial, `total_quantity = 0`
     por dezenas de ticks seguidos) — impacto real pro usuário: uma vez travado, fica impossível
     **vender** aquele ativo (o lado comprador nunca mais se regenera), não só um problema estético
     de preço congelado. **Decisão (2026-09-20, confirmada com o autor):** a correção mecânica
     (piso mínimo em `effectiveOrderSizeCeiling`, nunca removendo o teto em si — só impedindo o
     colapso total quando o float disponível é positivo) resolve o bug de corretude observado
     sozinha, sem depender de nenhuma pesquisa nova — virou a tarefa `J.6`. A recalibração de
     `bot.InitialCash`/`InitialAllocation` com dados reais (que mitigaria a *frequência* do
     travamento, mas não o eliminaria sozinha) foi deliberadamente separada pro achado 009 abaixo —
     não bloqueia `J.6` nem duplica o escopo dela.
- **Status:** Resolvido por completo — Partes A/B (ver testes/validação abaixo) e Parte C via `J.6`
  (`.claude/backlog-motor-mercado-realista.md`, 2026-09-20): `tick.MinOrderSizeCeiling` (piso de 1)
  em `effectiveOrderSizeCeiling`, validado ao vivo contra o mesmo travamento real de `BNDD4`/`PAPL11`
  (`total_quantity = 0` por 20+ dias simulados) — os dois recuperaram negociação já no primeiro
  `POST /admin/tick` pós-correção.
- **Testes:** `bot` (rename de `capToFloat`/`floatCeiling` pra `OrderSizeCeiling` nos testes
  existentes, mais dois novos cobrindo o teto zerando a quantidade comprável sem panicar —
  `rng.Intn(0)` panicaria se `canBuy` não considerasse o teto, achado do próprio trabalho desta
  correção em `noise.go`); `tick` (`TestEffectiveOrderSizeCeiling` table-driven; wiring de
  `ExpireStaleOrders`/`CancelUserRestingOrders` em `rounds_test.go`/`service_test.go`, com fakes
  novos; volume acumulado por ativo; teto de volume efetivamente mais apertado que o float quando
  aplicável); `orderexecution` (`SimulatedDay` sempre vem do `Context` recém-carregado, nunca do que
  o chamador já tinha em `Request`).
- **Validação:** `go build ./...`, `go vet ./...`, `go test ./...` (incl. `-race`) e
  `golangci-lint run ./...` (Docker, `v2.12.2`) verdes. `docker compose up -d --build` contra os
  mesmos dados reais da auditoria original (sem `down -v`): as 1.891 ordens pendentes/parciais
  pré-existentes (incl. os 553.598.866 cotas de `TJLO11`) foram canceladas já no primeiro
  `POST /admin/tick` pós-deploy (`expired_orders_count: 1891`, exatamente o total pendente antes);
  `order_book` se manteve estável (~10-30 pendentes por tick, nunca crescendo) por ~20 ticks
  seguidos; um Market Maker nunca acumulou mais de 1 ordem de compra + 1 de venda pendente por ativo
  em nenhum momento observado. O teste de ponta a ponta também expôs e corrigiu, na própria sessão, o
  bug do `total_quantity`/`DEFAULT 0` descrito na Parte B acima — sem essa correção, o ambiente real
  ficava com o lado de compra travado em zero permanentemente a partir do primeiro tick pós-migration
  (comportamento observado e revertido nesta mesma validação, antes de fechar o achado).

### 006 · Peso de `Holding` real não soma 100% sozinho quando a cesta do ETF tem constituinte cosmético

- **Local:** `engine/internal/domain/etf/rebalance.go` (`RebalanceOrders`, consumida por
  `DecideAuthorizedParticipantAction`), em conjunto com `engine/internal/domain/etf/etf.go`
  (`Holding.WeightPct`) e `engine/internal/domain/etf/basket.go` (`ConstituentsFromHoldings`)
- **Origem:** teste de ponta a ponta da Fase H (branch `fase-h-etfs-nav-rebalanceamento-ap`),
  2026-09-19 — achado de teste ativo que combinou as peças de H.1-H.4 como a integração real vai
  precisar fazer (nenhum teste existente até aqui exercitava H.1/H.2/H.4 juntos). Regressão viva em
  `engine/internal/domain/etf/basket_test.go:TestPesoDeHoldingRealNaoServeDiretoParaRebalanceOrders_QuandoCestaTemConstituinteCosmetico`.
- **O que era:** `etf.NewDetails` exige que a soma de `WeightPct` de **todos** os holdings
  (cosméticos + reais) fique dentro de `WeightTolerance` de 100%. `ConstituentsFromHoldings` (H.4)
  filtra pra só enxergar holding com `AssetID` preenchido — é assim que H.1 (NAV) soma corretamente
  só os constituintes reais. Mas `RebalanceOrders` (H.2, também consumida por
  `DecideAuthorizedParticipantAction`/H.3) exige a **mesma** validação de soma-100% sobre
  `TargetWeightPct` — alimentar `RebalanceConstituent.TargetWeightPct` direto do `WeightPct` dos
  holdings reais de `Details.Holdings` (o caminho óbvio) faz a soma ficar abaixo de 100% por
  exatamente o peso cosmético excluído, rejeitando com `ErrWeightsDoNotSumTo100`.
- **Decisão (2026-09-19):** a dúvida real por trás do achado — "o que o peso cosmético representa
  de fato?" — se resolveu ao confirmar um ponto de produto que já estava certo na spec (3.6:
  "composição... derivada da carteira teórica do **índice simulado**") mas não estava claro pra quem
  revisou: a plataforma **não** replica a composição de um índice real (Ibovespa/B3) — o
  `BenchmarkIndex`/nome do índice é só rótulo de exibição pra familiaridade pedagógica; a cesta é um
  índice lógico **inteiramente nosso**, construído só com ativos do nosso próprio catálogo simulado.
  Não existe, portanto, nenhum motivo de produto pra um ETF ter uma fatia "fora do catálogo" que o
  robô mecânico não consegue enxergar — confirma a **opção (c)** das listadas originalmente: **todo
  ETF elegível pro robô mecânico (NAV/rebalanceamento/Participante Autorizado) precisa ter a cesta
  100% em holdings reais (`AssetID` preenchido em todas as linhas), sem constituinte cosmético.** O
  papel cosmético de `Holding.AssetID = nil` (H.4) continua existindo no domínio — não foi removido,
  nem devia ser: um ETF puramente ilustrativo/decorativo (não operado pelo robô) ainda pode usá-lo —
  só deixou de ser uma opção válida pra qualquer ETF que participe de rebalanceamento/arbitragem de
  verdade.
- **É regra de dado, e o único dado que existia foi corrigido na mesma sessão:** nenhuma validação
  nova foi adicionada em `etf.NewDetails`/`RebalanceOrders` (a função não sabe, e não deveria saber,
  se quem a chama pretende usar um dado ETF com o robô mecânico — isso é decisão de quem monta o
  catálogo, não do domínio `etf`; a própria `RebalanceOrders` já recusa sozinha se um holding
  cosmético vazar pra lá, funcionando como guarda-corpo). O ETF de exemplo do seed
  (`cmd/seed/main.go:seedETF`, `SINT11`) — único ETF que existe hoje, e candidato natural a ganhar o
  robô mecânico quando H.2/H.3 forem integrados — foi re-autorado nesta mesma sessão: as 2 empresas
  fictícias + a linha "Outros" (100% cosmético) viraram 100% holdings reais (`VALR3` 50%/`TJLO11`
  35%/`LFT2029` 15%, mesma combinação Ação/FII/renda fixa já validada ao vivo em H.4).
  `main()` precisou reordenar a chamada de `seedETF` pra depois de `VALR3`/`TJLO11`/`LFT2029` já
  seedados (a cesta referencia `asset_id` real, então a ordem importa agora) — nova função auxiliar
  `mustFindAssetID` resolve cada ticker. Validado primeiro contra um Postgres descartável (container
  `postgres:16-alpine` avulso, sem tocar o volume de dev persistente): migrations + seed rodaram
  limpo do zero, `etf_holdings` confirmado com as 3 linhas reais somando 100%, reexecução do seed
  idempotente (`SINT11 já existe — pulando`). **Depois, a pedido do autor, a mesma correção foi
  aplicada no volume de dev persistente também** (não só em bancos novos): confirmado que `SINT11`
  não tinha nenhuma posição/ordem real referenciando o ativo (só cotação histórica de `asset_quotes`,
  intocada), então a cesta antiga foi substituída pela real via `DELETE`+`INSERT` direto em
  `etf_holdings` (mesmo resultado que `seedETF` produziria, sem apagar `assets`/`etf_details`/
  cotações) — `GET /assets/:id` real contra o motor rodando confirmou a resposta certa depois da
  troca, sem erro de serialização.
- **Status:** resolvido e implementado, inclusive no dado de dev existente — nada pendente. Quem
  pegar a integração real de H.2/H.3 só
  precisa consumir `Details.Holdings` de `SINT11` como está hoje (já 100% real); a regra "todo ETF
  operado pelo robô nasce 100% real" vale igual pra qualquer ETF novo que o catálogo ganhar depois.

### 007 · `InflationWeight`/`ipcaAccumulatedDeviation` numa escala que nunca move a Selic com desvio realista

- **Local:** `engine/internal/domain/selic/copom.go:29-33` (`reactionStep`), `selic.go:20-33`
  (`DefaultInflationWeight`)
- **Origem:** teste de ponta a ponta da Fase I (backlog-motor-mercado-realista), 2026-09-19
- **O que é:** `ipcaAccumulatedDeviation` é documentado e usado como decimal (`0.02` para 2 p.p.,
  mesma convenção de `ipca.Config`), mas é somado direto contra um passo medido em pontos
  percentuais inteiros — a mesma escala de `Config.Neutral`/`Config.Initial` (`10.0` = 10%, não
  `0.10`; mesma convenção já usada por `fundamentals.ExpectedGrowth` ao fazer
  `selicAnnualRate-selicNeutral` direto). Com `DefaultInflationWeight = 1.5` original ("próximo do
  coeficiente clássico de Taylor", proposta seção 6), um desvio de IPCA de 2 p.p. — grande pros
  padrões reais de política monetária — somava só `1.5×0.02 = 0.03` p.p., abaixo de meio passo do
  Copom (`CopomStepIncrement/2 = 0.125`), e quantizava pra `0`. O limiar exato pra cruzar meio passo
  era `0.0833` (8,33 p.p. de desvio acumulado) — um choque inflacionário extremo, não a faixa
  "pequena variação em torno da meta" que `ipca.MonthlySeries` está documentado a produzir, nem a
  faixa que a composição de 12 meses da M.1 deve produzir em uso normal. Na prática, o termo de
  reação à inflação criado pela I.1 ficava inerte pro caso de uso real.
- **Por que não foi corrigido na hora:** a correção dependia de escolher **um número de calibração
  sem valor confirmado em nenhum documento** — nem a proposta (seção 6) nem o backlog (I.1) fechavam
  se `peso_inflação` deveria operar sobre desvio em pontos percentuais (exigindo converter o desvio
  antes de chamar `selic`) ou se o peso em si deveria ser ~100x maior pra compensar a escala decimal
  — as duas leituras eram compatíveis com o texto ambíguo da proposta ("coeficiente ~1.5x o
  desvio").
- **Decisão (2026-09-19, mesma sessão, a pedido do autor):** manter `ipcaAccumulatedDeviation`
  decimal (opção b das listadas originalmente) — trocar de convenção pra pontos percentuais mantendo
  o peso em 1.5 foi descartado depois de simular: como o termo de inflação soma de novo a cada
  reunião enquanto o desvio persistir (não é um nível calculado uma vez, é um incremento repetido a
  cada `CopomMeetingIntervalDays`), a escala de pontos com peso 1.5 diverge pra valores absurdos
  (simulado: 1 p.p. de desvio persistente levaria a Selic a +30 p.p. acima da neutra no patamar de
  equilíbrio, dado `ReversionSpeed = 0.05`). `DefaultInflationWeight` recalibrado pra **7.5**
  (mantendo decimal), escolhido simulando `NextCalendarRate` reunião a reunião — não só o efeito
  isolado de uma reunião — contra `ReversionSpeed`/`CopomStepIncrement`: ignora desvio de ruído (<1
  p.p.), reage em passos de 0,25 realistas a um desvio persistente de 2-5 p.p., e converge a um
  patamar estável em vez de divergir. Regressão viva em
  `TestNextCalendarRate_DesvioRealistaDeIPCAReageDeFormaGradualEEstavel` (`copom_test.go`), que
  prova as três propriedades (ruído ignorado, reação gradual, convergência) simulando 8-12 reuniões
  seguidas — os testes de I.1 que usavam desvios artificiais de 10 p.p. só pra cruzar o
  arredondamento (`TestNextCalendarRate_RegraDeReacaoAoDesvioDoIPCA`,
  `TestCalendarSeries_IPCAPersistenteMoveASelicNasReuniõesSeguintes`) também foram atualizados pra
  2 p.p., já suficiente com o novo peso. `.docs/engine/tick.md` atualizado com o novo default.
  `gofmt`/`go vet`/`go build`/`go test ./...`/`golangci-lint run` (Docker, v2.12.2, 0 issues)
  verdes.
- **Status:** resolvido — nada pendente pra I.1/I.2. Quem implementar a Fase M continua precisando
  alimentar `ipcaAccumulatedDeviation` como decimal (`IPCA_acumulado - meta_IPCA`, sem multiplicar
  por 100), consistente com a convenção que `ipca.Config`/`ipca.MonthlySeries` já usam.

### 010 · Renumeração de `code` na tarefa M.5 relabela lições existentes em vez de criar linhas novas

- **Local:** `backend/src/db/seedLessons.ts` (`upsertLessonSeed`, antes inline em `main()`),
  `backend/src/db/schema.ts` (`lessons`), `backend/src/modules/lessons/application/useCases/
  advanceLesson.ts:160`, `.docs/backend/lessons.md`
- **Origem:** implementação da tarefa M.5 (backlog-motor-mercado-realista), 2026-09-20
- **O que é:** M.5 insere 2 lições novas na Trilha 1 (`Como a Selic é formada`, `O que é o IPCA`),
  deslocando o `code` de 7 lições existentes um degrau adiante (`1.3`→`1.4`, `1.4`→`1.5`, ...,
  `1.9`→`1.11`). O upsert de `seedLessons.ts` casava por `code` (não por conteúdo) e nunca incluía
  `code` no `set` — então rodar `npm run db:seed:lessons` num banco que já tinha as 33 lições antigas
  não criava linha nova pras 7 renumeradas: reaproveitava a linha física que já existia com aquele
  `code` e sobrescrevia título/textos pro conteúdo do próximo degrau, preservando o `id`. Qualquer
  `user_lesson_progress` que já apontasse pro `id` de uma dessas 7 lições passava, depois do reseed, a
  apontar pra uma lição de conteúdo diferente com `completedAt` preservado — a UI mostraria a lição
  errada como concluída, sem erro nem log.
- **Decisão (2026-09-20, mesma sessão, a pedido do autor):** opção (c) das listadas originalmente —
  trocar a chave de upsert de `lessons.code` pra uma coluna nova e estável, deixando `code` livre pra
  refletir só a posição didática atual. Implementado na tarefa M.6: `lessons.stable_key` (`varchar(20)
  UNIQUE NOT NULL`, migration `0016`) — atribuído uma vez por lição (hoje coincide com o `code`
  vigente no momento em que a coluna nasceu, por ser o primeiro valor atribuído) e nunca mais tocado
  em renumeração futura. `seedLessons.ts` (`upsertLessonSeed`, extraída de `main()` pra ficar
  testável) casa o upsert por `stable_key` e passa a incluir `code` no `set`. Como a aplicação não
  está em produção, a migration trunca `user_lesson_progress`/`lessons` antes de tornar `stable_key`
  NOT NULL, em vez de exigir uma política de migração de dado legado — reseed do zero. Efeito
  colateral corrigido no mesmo commit: `AdvanceLessonUseCase` usava `licao:${lesson.code}` como chave
  de idempotência do XP — trocado pra `licao:${lesson.id}` (imutável), já que `code` virou mutável e
  reabriria brecha de reconceder XP numa renumeração futura. `.docs/backend/lessons.md` corrigido
  (documentava `ON CONFLICT (code) DO NOTHING`, incorreto desde sempre — o código real já fazia
  `onConflictDoUpdate`) e atualizado com `stable_key`. Teste cobrindo o cenário do achado
  (`seedLessons.test.ts`, fake in-memory do upsert): renumerar `code` mantendo o mesmo `stable_key`
  atualiza a linha existente sem duplicar e preservando `id`.
- **Status:** resolvido. `npm run lint`/`npm run build`/`npm test` verdes (585 testes).

### 011 · Marcação a mercado de Prefixado/IPCA+ ignorava o spread contratual — duplicação de dinheiro repetível via compra+resgate instantâneo

- **Local:** `engine/internal/domain/fixedincomeexecution/fixedincomeexecution.go` (`Redeem`, branches
  `default`/`IsIPCAMais`), `engine/internal/infra/db/fixed_income_execution_repository.go`
  (`LoadRedeemContext`)
- **Origem:** teste de ponta a ponta da Fase L (branch `fase-l-renda-fixa-correcoes-cirurgicas`),
  2026-09-20 — achado registrado como aberto, escalado pra correção na mesma sessão a pedido do autor
  depois de perguntar qual era o impacto.
- **O que era:** `Purchase` trava a taxa contratada como `spread + benchmark` (`fixedincome.
  OfferedRate` — tarefa L.4), mas `Redeem` marcava a mercado comparando essa taxa CHEIA contra o
  benchmark BRUTO (Selic nominal pra Prefixado, Selic real via Fisher pra IPCA+ — sem somar spread
  nenhum). Como o valor creditado em `accounts.current_balance` vinha exatamente dessa comparação
  (não só o rótulo `vs_contracted_rate`), compra e resgate imediato de Tesouro Prefixado/IPCA+
  creditava mais dinheiro do que foi investido, sem nenhum tempo decorrido nem movimento real de
  Selic, repetível indefinidamente (nenhuma carência entre `POST /fixed-income/purchases` e
  `POST /fixed-income/redemptions`). Validado ao vivo antes da correção: 4 ciclos seguidos de
  compra+resgate instantâneo em LTN2027 (spread 1,75, Selic parada em 30%) levaram uma conta de
  R$ 10.000,00 pra R$ 11.129,06 em segundos, ~2,71% líquido de IR por ciclo, compondo a cada rodada.
  Os 6 produtos pós-fixados nunca foram afetados (L.1/L.3 já tiravam eles da marcação a mercado).
- **Decisão (2026-09-20, mesma sessão):** opção (a) das listadas originalmente — corrigir a fórmula
  em si (somar o mesmo spread ao benchmark de mercado antes de comparar), sem adicionar carência
  mínima de resgate. Justificativa: a correção de fórmula fecha o exploit por completo (quando o
  benchmark não mudou, a marcação vira exatamente 0, não só "mais lenta de repetir") — uma carência
  sozinha só reduziria a frequência sem corrigir o viés em si. `RedeemContext` ganhou `AnnualRatePct`
  (o spread do catálogo, mesma fonte/convenção de `PurchaseContext.AnnualRatePct`) e `IsSandbox`;
  `Redeem` agora soma esse spread ao benchmark corrente (`fixedincome.OfferedRate`) antes de marcar a
  mercado, nos dois branches (Prefixado via Selic nominal, IPCA+ via Fisher) — exceto sandbox
  (`IsSandbox`), cuja taxa do roteiro (`sandbox.RateOnDay`) já vem pronta, sem separar spread de
  benchmark (mesmo raciocínio de `PurchaseContext.IsSandbox`, já existente desde a 4.11).
  `LoadRedeemContext` passou a ler `fixed_income_assets.interest_rate` (mesma query já existente, só
  mais uma coluna) e propagar `is_sandbox`. Testes novos (`fixedincomeexecution_test.go`):
  `TestRedeem_Prefixado_SpreadNaoGeraGanhoArtificialQuandoSelicNaoMudou`,
  `TestRedeem_Prefixado_ComSpread_SelicSubiuAindaGeraPerdaReal` (confirma que a marcação a mercado
  genuína continua funcionando — só o componente artificial do spread foi removido),
  `TestRedeem_Prefixado_Sandbox_NaoSomaSpreadSobreATaxaDoRoteiro` (usa `AnnualRatePct: 999` de
  propósito — se a correção fosse aplicada por engano num resgate sandbox, o resultado se afastaria
  muito de zero) e `TestRedeem_IPCAMais_SpreadNaoGeraGanhoArtificialQuandoBenchmarkNaoMudou`. Os
  testes pré-existentes de marcação a mercado continuam passando sem alteração — não setavam
  `AnnualRatePct` (zero-value), e `OfferedRate(0, x) = x` é uma identidade que preserva o
  comportamento anterior num cenário de spread zero. Validado ao vivo repetindo exatamente o mesmo
  cenário de exploração (4 ciclos de compra+resgate instantâneo em LTN2027, Selic parada): saldo ficou
  em **R$ 10.000,00 nos 4 ciclos** (antes: R$ 11.129,06 no 4º ciclo). `go build`/`go test
  ./...`/`golangci-lint run` (Docker, `v2.12.2`, 0 issues) verdes.
- **Status:** resolvido.

### 012 · Cancelamento de ordem (O.1) implementado, mas sem nenhum caminho pro cliente descobrir o `order_id`

- **Local:** `backend/src/modules/market/interfaces/http/marketRouter.ts` (`POST /market/orders`,
  `POST /market/orders/:id/cancel`), `backend/src/modules/market/application/ports/orderExecutor.ts`
  (`OrderResult`)
- **Origem:** teste de ponta a ponta da Fase O (branch `fase-o-cancelamento-ordem`), 2026-09-21
- **O que era:** testado ao vivo via `docker compose up`: `POST /market/orders` devolve só
  `{ filled_quantity, remaining_quantity, fills }` — nunca o `id` da linha que acabou de nascer em
  `order_book` (o `INSERT` em `insertIncomingOrder`, `order_execution_repository.go`, nem usa
  `RETURNING id`). Não existe nenhuma rota `GET` que liste as ordens do usuário (pendentes ou não).
  Resultado: `POST /market/orders/:id/cancel` (O.1, implementado e correto em todas as camadas nesta
  mesma sessão) não tem nenhum caminho real pelo qual um cliente descubra qual `id` passar — nem no
  momento da submissão (resposta não carrega o id), nem depois (sem endpoint de listagem). A
  funcionalidade só foi exercitada nesta sessão consultando `order_book` direto no Postgres.
- **Opções levantadas:** (a) `POST /market/orders`/`POST /orders` passam a devolver `order_id` na
  resposta (mudança pequena, `RETURNING id` + campo novo em `OrderResult`/`submitOrderResponse`) —
  resolve só o caso "cancelar a ordem que acabei de colocar, na mesma sessão de UI", não sobrevive a
  reload; (b) rota nova `GET /market/orders` (ou `/market/me/orders`), com filtro de status — único
  jeito de cancelar depois de um reload, mas implica desenhar uma tela nova (ou seção nova de tela
  existente) pra listar/cancelar, fora do escopo descrito em O.1; (c) as duas, já que (a) sozinha não
  fecha o ciclo completo do produto.
- **Decisão (2026-09-21, mesma sessão, confirmada com o autor):** opção (c) — as duas juntas, agora
  com dono real: **O.3** (`order_id` na resposta + `GET /orders`/`GET /market/orders` + coluna nova
  `order_book.cancel_reason`) e **O.4** (tela nova "Minhas Ordens" no frontend), ambas em
  `.claude/backlog-motor-mercado-realista.md`. Decisões de design fechadas na mesma conversa: a tela
  tem **3 abas** — Pendentes, Executadas, Recusadas (ideia original do autor, inspirada em apps de
  corretora) — sem uma 4ª aba pra "rejeitada na submissão" (ordem rejeitada por saldo/posição
  insuficiente nunca é persistida hoje, decisão deliberada de Event Sourcing; criar esse log seria
  feature nova, fora de escopo aqui). "Recusadas" agrega as 4 causas hoje indistinguíveis sob
  `status = cancelled` (cancelamento manual, expiração automática — a intenção original do autor pra
  essa aba —, ordem a mercado sem liquidez, recotação de bot Market Maker) — o autor confirmou manter
  só 3 abas no nível da UI mesmo depois de decidir adicionar `cancel_reason`; a coluna nova enriquece
  cada linha da aba Recusadas com o motivo humanizado, sem virar sub-aba própria.
- **Status:** resolvido — O.1 continua ✅ como rota isolada (comportamento correto, testado). O.3/O.4
  ainda não implementadas (escopo de múltiplas sessões: engine + backend + tela nova de frontend).

### 009 · Capital/alocação inicial do bot não é calibrado com dados reais (mitigação de realismo do achado 005)

- **Local:** `engine/internal/domain/bot/allocation.go` (`InitialAllocation`, distribui o float
  entre os 20 bots) e `engine/cmd/seed/main.go` (`botMinimumOrderShares`/multiplicadores de
  `bot.InitialCash`, achado 005 Parte B)
- **Origem:** achado 005 Parte C (`.claude/pontos-em-aberto-decisao-produto.md`), separado nesta
  sessão (2026-09-20) da correção mecânica que virou `J.6` — teste de ponta a ponta da Fase J
  (`.claude/backlog-motor-mercado-realista.md`), 2026-09-19/20
- **O que é:** o capital/posição inicial de cada bot vem de constantes ilustrativas
  (`cmd/seed/main.go`), nunca calibradas contra dados reais de participação de liquidez/free float
  da B3 — mesma natureza do achado 003 (coeficientes de fundamentos), mas aplicada a um insumo
  diferente. Capital insuficiente pra sustentar negociação contínua aumenta a *frequência* com que
  a média de volume real de um ativo (`RecentTradedVolume`, achado 005 Parte B) chega a zero, que é
  a condição que `J.6` corrige na raiz mecânica — mais capital reduziria a chance desse cenário
  acontecer, mas não o eliminaria sozinho (é estatístico, não determinístico).
- **Por que não foi corrigido:** o valor certo de capital/alocação por bot é um número de negócio
  sem fonte real confirmada em nenhum documento — exigiria uma pesquisa dedicada tipo K.1 (dados
  B3/CVM de participação de market maker/free float), não só uma decisão de comportamento.
- **Opções:** (a) pesquisa dedicada (mesmo formato de K.1) seguida de aplicação em
  `cmd/seed/main.go`/`bot.InitialCash` (mesmo formato de K.2); (b) manter os valores ilustrativos
  atuais indefinidamente, já que `J.6` remove a consequência mais grave (travamento permanente) e
  o resto é só realismo de "quão ativo o mercado parece", não corretude.
- **Pesquisa (2026-09-23):** `.claude/calibracao-liquidez-bots.md`. A premissa deste achado (capital
  insuficiente) **não se sustenta**: o caixa agregado dos bots é ~130% do valor do float. O que mata a
  liquidez é o laço de realimentação de `MaxOrderPctOfAverageVolumePct` (teto = 20% do volume recente),
  que decai geometricamente até o piso de 1 unidade do J.6: VALR3 foi de 23,8M unidades/dia no dia 1 pra
  10 no dia 40, contra ~0,5% do float/dia de referência real (giro B3 ~135% ao ano). Correção recomendada
  no doc (opção A, piso do teto proporcional ao float) aguarda decisão do autor.
- **Decisão (2026-09-23, confirmada com o autor):** opção A do doc — piso do teto de volume proporcional ao
  float (`tick.MinOrderPctOfFloat` = 0,4%, calibrado por simulação de 60 dias), uniforme entre ativos.
  Opção C (perfil de liquidez fixo por ativo) descartada por ora: liquidez real depende de vários
  fatores, fixar um número seria arbitrário, mas pode ser revisitada. `bot.InitialCash`/`InitialAllocation`
  ficam como estão (caixa agregado já é ~130% do float, não é o limitante). Teste novo em
  `TestEffectiveOrderSizeCeiling`, `.docs/engine/tick.md` atualizado.
- **Status:** resolvido.
