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
- **Status:** aberto

### 004 · `macroPriceEffectsByCompany` soma sem teto pode inverter o sinal do preço justo

- **Local:** `engine/internal/domain/tick/tick.go:498` (`macroPriceEffectsByCompany`), consumido em
  `engine/internal/domain/bot/fundamentalist.go:115` (`FundamentalistFairPrice`:
  `fairPrice := vpa * (roe / requiredReturn) * (1 + growthRate) * (1 + macroEffectPct/100)`)
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
- **Status:** aberto

### 007 · `InflationWeight`/`ipcaAccumulatedDeviation` numa escala que nunca move a Selic com desvio realista

- **Local:** `engine/internal/domain/selic/copom.go:29-33` (`reactionStep`), `selic.go:20-27`
  (`DefaultInflationWeight`)
- **Origem:** teste de ponta a ponta da Fase I (backlog-motor-mercado-realista), 2026-09-19
- **O que é:** `ipcaAccumulatedDeviation` é documentado e usado como decimal (`0.02` para 2 p.p.,
  mesma convenção de `ipca.Config`), mas é somado direto contra um passo medido em pontos
  percentuais inteiros — a mesma escala de `Config.Neutral`/`Config.Initial` (`10.0` = 10%, não
  `0.10`; mesma convenção já usada por `fundamentals.ExpectedGrowth` ao fazer
  `selicAnnualRate-selicNeutral` direto). Com `DefaultInflationWeight = 1.5` ("próximo do
  coeficiente clássico de Taylor", proposta seção 6), um desvio de IPCA de 2 p.p. — grande pros
  padrões reais de política monetária — soma só `1.5×0.02 = 0.03` p.p., abaixo de meio passo do
  Copom (`CopomStepIncrement/2 = 0.125`), e quantiza pra `0`. O limiar exato pra cruzar meio passo é
  `0.0833` (8,33 p.p. de desvio acumulado) — um choque inflacionário extremo, não a faixa "pequena
  variação em torno da meta" que `ipca.MonthlySeries` está documentado a produzir, nem a faixa que
  a composição de 12 meses que a M.1 vai gerar deve produzir em uso normal. Na prática, com os
  números atuais, o termo de reação à inflação criado pela I.1 fica inerte pro caso de uso real —
  só é observável hoje com desvios artificiais (`0.1`, usados nos testes de I.1 pra provar a
  direção do efeito). Regressão viva em
  `TestNextCalendarRate_DesvioRealistaDeIPCANaoMoveASelic` (`copom_test.go`), que trava esse
  comportamento pra ele não virar "corrigido" silenciosamente sem que a escala seja de fato
  recalibrada.
- **Por que não foi corrigido:** a correção depende de escolher **um número de calibração sem
  valor confirmado em nenhum documento** — nem a proposta (seção 6) nem o backlog (I.1) fecham se
  `peso_inflação` deveria operar sobre desvio em pontos percentuais (ex: `2.0` pra 2 p.p., exigindo
  converter o desvio antes de chamar `selic`) ou se o peso em si deveria ser ~100x maior pra
  compensar a escala decimal (ex: `~150` em vez de `1.5`) — as duas leituras são compatíveis com o
  texto ambíguo da proposta ("coeficiente ~1.5x o desvio"), e a tarefa I.2 já registrou o sintoma
  ("desvio pequeno quantiza pra 0") como comportamento esperado, adiando a calibração fina pra
  tarefa 8.1 — mas sem valor nenhum ainda escolhido pra essa calibração, nem registro formal do
  gap fora do comentário da I.2 no backlog.
- **Opções:** (a) mudar `ipcaAccumulatedDeviation` pra escala de pontos percentuais (mesma de
  `Config.Neutral`), convertendo na acumulação da Fase M (`IPCA_acumulado_pct - meta_IPCA_pct`,
  ambos ×100 antes de subtrair) e mantendo `DefaultInflationWeight = 1.5` como o coeficiente
  clássico de Taylor de fato pretendia; (b) manter a escala decimal e recalibrar
  `DefaultInflationWeight` pra uma ordem de grandeza que produza reação em desvios realistas (ex:
  testar valores entre 50 e 150 rodando o motor, como a tarefa 8.1 já prevê pra outros
  coeficientes ilustrativos); (c) manter como está e aceitar que o termo de IPCA só reage a choques
  extremos (~8+ p.p.), documentando isso como comportamento intencional em vez de calibração
  pendente — mas isso esvazia o valor pedagógico que a Fase I foi pedida pra criar (Selic reagindo
  de forma perceptível ao IPCA).
- **Status:** aberto

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
  3. **Parte C — causa raiz do caixa/alocação inicial de bot** (continua em aberto, sem duplicar
     rastreio): já tinha dono antes deste achado — mesmo raciocínio do achado 003 acima, Fase K de
     `backlog-motor-mercado-realista.md` (calibração com dados reais B3/CVM). Recalibrar o
     multiplicador de `bot.InitialCash`/`InitialAllocation` sem essa pesquisa só trocaria um número
     arbitrário por outro. As partes A/B já tornam qualquer ordem matematicamente impossível de
     exceder o que o mercado suporta, **independente** do caixa do bot — a causa raiz vira um
     problema de realismo, não de corretude (ex: `VALR3`/`BNDD4` ainda mostram ordens de venda na
     casa de dezenas de milhões de cotas, refletindo posição de bot desproporcional herdada da
     alocação inicial — não mais um risco de acúmulo indefinido, porque expiram no dia seguinte se
     não preenchidas).
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
