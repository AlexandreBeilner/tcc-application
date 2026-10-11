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

Nenhum ponto em aberto no momento.

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
- **Decisão (2026-09-23, a pedido do autor):** opção (a) com teto próprio — `macroevent.DefaultPriceEffectCapPct`
  (40.0, ilustrativo, constante separada de `DefaultFundamentalsCapPct` pois protegem fórmulas diferentes) aplicado via
  `CombinePendingEffects` em `macroPriceEffectsByCompany`. Como 40 < 100, `(1 + soma/100)` nunca inverte o sinal.
  Teste: `TestAdvance_MacroEffectPctEmpilhadoTemTeto` (`tick_test.go`). `.docs/engine/macroevent.md` atualizado.
- **Status:** resolvido

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
- **Decisão (2026-09-23):** teto de spread de 0,10 (ilustrativo), confirmado pelo autor ao seguir a recomendação
  da proposta de cobertura de Market Maker.
- **Resolução (tarefa P.6, 2026-09-23):** `bot.MaxSpreadWidthPct = 0.10` validado em `NewRiskProfile`
  (`ErrSpreadWidthAboveMax`), então `1.999999` e qualquer valor acima de 0,10 são rejeitados na construção; a
  checagem `spread >= 2` de `MarketMakerQuotePrices` ficou só como defesa para uma `Personality` montada sem o
  construtor. Testes cobrem o teto exato, `0.1001` e `1.999999`.
- **Status:** Resolvido

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
- **Resolução (Fase P, 2026-09-23):** cobertura contínua de Market Maker (`market_maker_coverage`, P.1 a P.3), manutenção de
  cotação com passada final (P.4), cotação que não expira por dia (P.5) e piso de tamanho (P.6). Validado na P.8: compra e
  venda a mercado preenchem nos 5 ativos do seed real e em 10 de 10 ativos de catálogos de 35 e 55 ativos (20 de 20 ordens
  cada), depois de 60 dias simulados. Detalhes em `proposta-cobertura-market-maker.md` seção 6.2.
- **Status:** Resolvido

### 014 · O volume por ativo cai com o tamanho do catálogo porque o pool de bots direcionais é fixo

- **Local:** `engine/cmd/seed/main.go` (`botOtherBotCount = 19`, mais `bot.SelectAssetForRound`: cada bot negocia 1 ativo
  por rodada), `engine/internal/domain/tick/rounds.go` (`MinOrderPctOfFloat`)
- **Origem:** medição da tarefa P.8 (benchmark da P.7), 2026-09-23
- **O que é:** o volume diário médio por ativo, como % do float, cai aproximadamente com `1/N` quando o catálogo cresce, com
  o pool de 19 bots direcionais e 1 a 4 rodadas por dia fixos. Medido em 60 dias simulados, mesma seed: **5 ativos (seed
  real) 0,45%** (dentro da faixa de 0,3% a 0,7% de `calibracao-liquidez-bots.md`), **15 ativos 0,20%**, 35 ativos 0,08%,
  55 ativos 0,06%. Como a tarefa 7.2 do backlog principal planeja de 12 a 15 ativos negociáveis, o volume do catálogo real
  previsto já sai da faixa. Efeito colateral medido: o efeito de eventos macro também enfraquece nos ativos menos
  negociados (cinco eventos severos no setor de Mineração: `VALR3` caiu 7,7%, um ativo sintético do mesmo setor 3%).
- **Por que não foi corrigido:** `MinOrderPctOfFloat` não resolve: o volume depende de quantas ordens acontecem por ativo,
  não só do tamanho delas, e subir a constante para atender 15 ativos empurraria o seed de hoje para o topo da faixa.
  Escalar o pool custa comandos SQL de forma linear (cerca de 17 por turno de bot, ~800 por tick com 19 bots), então
  manter o volume de 5 ativos com 55 ativos exigiria ~200 bots e ~9.000 comandos por tick, acima do orçamento de 3.500 da
  seção 6.1 da proposta de cobertura. É preciso o autor definir **qual volume por ativo é o alvo** e quanto custo de
  tick aceita pagar por isso.
- **Opções:** (a) o pool de bots direcionais escala com o catálogo (regra de bots por ativo, definida no seed e
  reaproveitada pelo painel de bots da Fase N), com um teto de custo de tick; (b) cada bot negocia mais de um ativo por
  rodada (custo por bot sobe, número de bots fica fixo); (c) aceitar a cauda longa, coerente com a B3 (as 10 ações mais
  negociadas concentram ~46% do volume), e definir a faixa-alvo só para os ativos líderes, deixando os demais mais
  parados; (d) combinação: escalar o pool até um teto e aceitar cauda longa acima dele. **Recomendação:** (d), com o
  número de bots por ativo e o teto escolhidos pelo autor. Não bloqueia a Fase P.
- **Decisão (2026-09-25, autor):** desenhar para pelo menos 30 ativos e crescendo (horizonte de 100). Alvo: líderes na
  faixa de 0,3% a 0,7%, mediano de pelo menos 0,15%, nenhum ativo sem negociação. Orçamento: teto de 5.000 comandos por
  tick, meta de 3.500 com 30 ativos. Virou a **Fase Q** de `backlog-motor-mercado-realista.md` (turno mais barato, pool
  dimensionado pelo orçamento, escolha de ativo ponderada por valor de mercado com piso, benchmark, e sessão de tick em
  memória só se o benchmark exigir).
- **Benchmark da Q.4 (2026-09-26):** 30 ativos dentro do alvo; 50 estoura o custo (máx. 5.701 comandos); 100 estoura custo
  (média 5.335, 28 de 60 ticks acima de 5.000) e alvo (mediano 0,14%, 36% dos ativo-dias sem negócio, cauda reage -1,0% a
  cinco eventos severos). Causa: custo e volume dependem do mesmo botão (tamanho do pool). Virou as tarefas **Q.7 a Q.10**
  (medir custo, orçamento de turnos com piso rígido, giro-alvo via tamanho de ordem, atenção por evento). **Decidido
  (2026-09-26, autor delegou):** o piso de "nenhum ativo sem negociação" passa de estatístico para rígido, 1 turno marketable
  por ativo por dia (Q.8).
- **Status:** resolvido (2026-09-26). A Q.4 validou os alvos em 30, 50 e 100 ativos depois de Q.7 a Q.10; resultados na seção 6.4 de
  `proposta-cobertura-market-maker.md` e no Entregável da Q.4 de `backlog-motor-mercado-realista.md`.

### 015 · Ordem limitada em repouso não reserva nem revalida saldo/posição: saldo negativo e ordem "fantasma" travando o book

- **Local:** `engine/internal/domain/orderexecution/` (`Execute`/`Persist`, `applyFillSide`),
  `engine/internal/infra/db/order_execution_repository.go` (`LoadContext`, `fillRestingOrder`)
- **Origem:** teste ponta a ponta da Fase Q, 2026-09-26 (o `.docs/engine/orders.md` já listava o comportamento em "Escopo não
  coberto", mas nunca como achado com consequência medida)
- **O que é:** a validação de saldo/posição de uma ordem limitada acontece só na submissão, contra o que ela preencheria na
  hora, e nada é reservado. Duas consequências reproduzidas ao vivo:
  1. **Saldo negativo (alavancagem grátis).** Usuário com R$ 10.000 põe uma compra limitada de R$ 9.000 dentro do spread de
     um ativo, gasta R$ 7.400 a mercado em outro, e outro usuário vende a mercado no primeiro: a ordem em repouso preenche e o
     saldo vai a **-R$ 6.402,37** (RNF06 e o capital de partida deixam de valer, e o ranking premia o risco sem custo). Nos
     bots o mesmo aconteceu sozinho: 1 de 137 bots (Ruído) terminou com **-R$ 17,8 milhões** de saldo depois de 195 dias
     simulados, porque várias compras limitadas em repouso preencheram depois de o caixa ser gasto em outros turnos.
  2. **Ordem fantasma que bloqueia um lado do book.** Venda limitada sem posição (ou compra sem caixa) que **não cruza** o
     book é aceita (`201`) e, se estiver dentro do spread, vira a melhor oferta: toda ordem a mercado do outro lado casa com
     ela primeiro e é rejeitada inteira (`422 quantidade em posição insuficiente`) até a ordem expirar no fim do dia. Um
     usuário sem posição nenhuma travou todas as compras de um ativo (as dele e as dos bots, inclusive o turno de piso da Q.8) com uma
     ordem de 1 ação.
- **Por que não foi corrigido:** a decisão de escopo ("aceitável para o protótipo", `.docs/engine/orders.md`) é do autor. Corrigir
  exige escolher entre reservar (mexe em Event Sourcing e no extrato) ou revalidar no preenchimento (mexe no replay do book).
- **Opções:** (a) revalidar no `Persist`: se a contraparte em repouso não tem saldo/posição, cancelar aquela ordem
  (`cancel_reason` novo, ex: `insufficient_funds`) e continuar o match com a próxima (resolve os dois sintomas sem reserva);
  (b) reservar saldo/posição na submissão (ordem limitada compromete caixa/posição e o cancelamento/expiração libera);
  (c) manter como está e documentar a exposição na tela de ordens.
- **Recomendação:** (a): é a mudança menor, preserva o modelo de "nada é reservado" já documentado e fecha o saldo negativo e a
  ordem fantasma no mesmo ponto.
- **Decisão (2026-09-26, autor aprovou a recomendação (a)):** revalidar o dono da ordem em repouso no match.
- **Resolução (2026-09-26):** `Execute` pula e cancela (`cancel_reason = insufficient_funds`) a ordem em repouso cujo dono não
  honra o trade, com saldo e posição lidos na mesma consulta do book (nenhum comando SQL a mais), mais `CHECK` de saldo e
  posição não negativos como rede de proteção (migration `000025`). Validado ao vivo: a venda fantasma dentro do spread não
  bloqueia mais a compra da vítima e é cancelada; a compra em repouso sem caixa não preenche (saldo do dono intacto); ordem
  com fundos continua preenchendo; 12 compras concorrentes de ~R$ 8.000 com R$ 10.000 deram 1 execução e 11 rejeições;
  180 ticks com o catálogo crescendo de 30 para 60 ativos terminaram com **0 saldos negativos** (antes, 1 bot com -R$ 17,8 mi),
  0 divergências de saldo contra `market_events` e determinismo preservado (dois motores, mesmo hash). Detalhes em
  `.docs/engine/orders.md`.
- **Status:** Resolvido

### 016 · Ágio/deságio médio dos ETFs (~1,3%) acima do critério de 1%, e a faixa da arbitragem não é a causa

- **Local:** `engine/internal/domain/etf/arbitrage.go` (`ArbitrageActionBandPct`, `ArbitrageDailyCapPct`), Market Maker do ETF (`internal/domain/bot/`, ancorado no iNAV)
- **Origem:** benchmark da tarefa R.12, 2026-09-26 (30/50/100 ativos com 1/5/10 ETFs, 40 dias)
- **O que é:** o ágio/deságio médio em módulo ficou em **1,30%, 1,32% e 1,35%** (máximo de 6% a 7%) nas três configurações; o
  critério da R.12 pede média abaixo de 1%. A distribuição é **simétrica** (média com sinal de -0,27%: 38 dias de deságio contra
  18 de ágio acima da faixa), ou seja, é dispersão em torno do NAV, não viés. **Experimento:** baixar a faixa de ação do
  Participante Autorizado de 1,5% para 0,75% (50 ativos, 5 ETFs) **não melhorou** (média de 1,58%) e quadruplicou a arbitragem
  (32,7 criações por dia contra 7,9). A hipótese não verificada é que o preço de fechamento do ETF é o último negócio do dia, que
  cai no bid ou no ask do Market Maker (a largura do spread é parâmetro por Market Maker), então o "ágio" medido é meio spread e
  não um desequilíbrio que a arbitragem corrija.
- **Por que não foi corrigido:** o valor-alvo do ágio de um ETF sintético (1%? 0,5%?) e a troca entre realismo e custo de tick são
  calibração do autor, e a causa ainda não foi isolada (falta medir o ágio contra o ponto médio do book, não contra o último
  negócio).
- **Opções:** (a) manter a faixa e trocar o critério da R.12 para a realidade medida (média abaixo de 1,5%), documentando que ETF
  sintético tem spread de Market Maker embutido; (b) medir o ágio contra o ponto médio do book de fechamento e só então recalibrar;
  (c) estreitar o spread do Market Maker que cobre ETF (escopo do painel de bots, Fase N).
- **Medição (2026-09-26, 50 ativos, 5 ETFs, 40 dias, faixa original de 1,5%, amostra do book de cada ETF no fechamento de cada dia, 234 amostras com bid e ask):**
  o ágio contra o **último negócio** foi 1,05% de média (máx 6,48%) e contra o **ponto médio do book** foi **0,34%** (máx 5,21%). O meio spread médio é 0,88% e o
  último negócio do dia cai **no bid ou no ask em 168 de 234 fechamentos (72%)**. Hipótese do spread **confirmada**. Segunda causa, achada na mesma medição: nos dias de
  relatório (14, 28, 42...) **todos os ETFs** abrem 3% a 6% de ágio ao mesmo tempo (média de 3,22% nesses dias contra 0,96% nos demais). É o provento do próprio ETF: o NAV cai
  na data-ex porque o passivo do provento é criado no fechamento (`closingETFNAVs`), depois das rodadas, então o preço do ETF negociado durante o dia ainda está ancorado no iNAV
  sem o passivo; o mercado só ajusta no dia seguinte (o ágio volta a ~0,5%). Uma ação real cai no dia da data-ex, não no seguinte. Sem esses dias, a média contra o último
  negócio já é **0,96%**, dentro do critério de 1%.
- **Resolução parcial pendente de decisão:** (1) o spread do último negócio é propriedade do modelo (Market Maker cota com spread), então a métrica de critério devia ser o ponto médio
  do book (0,34%, atende); (2) o degrau de 1 dia na data-ex do ETF é inconsistência de modelagem: o certo é o preço cair na própria data-ex. Dá para corrigir calculando o
  provento do ETF antes das rodadas do dia de relatório (o valor por cota é caixa livre dividido pelas cotas, não depende de preço) e incluindo o passivo no iNAV das rodadas.
- **Decisão (2026-09-26, autor):** corrigir o degrau da data-ex (opção 2).
- **Resolução (2026-09-26, tarefa R.12b):** o provento do ETF é anunciado no iNAV das rodadas do dia de relatório. Ágio médio nos dias de relatório de 3,22% para 1,15% (máx de 6,48% para 2,30%), ágio médio geral de
  1,32% para 1,04% contra o último negócio e 0,28% contra o ponto médio do book. O critério de 1% passa a ser medido contra o ponto médio do book (o último negócio carrega o spread do Market Maker), onde atende com folga.
- **Status:** Resolvido

### 017 · Custo por tick passa de 5.000 comandos com 100 ativos, com ou sem ETF

- **Local:** `engine/internal/domain/tick/` (rodadas de bots e Market Makers), orçamento de 5.000 comandos do RNF de tick
- **Origem:** benchmark da tarefa R.12, 2026-09-26
- **O que é:** com 100 ativos e 10 ETFs, o tick teve **média de 5.384 e p95 de 6.844 comandos** (32 de 40 ticks acima de 5.000).
  O **mesmo catálogo de 100 ativos sem ETF** já dava média de 4.818 e p95 de 5.191 (6 de 40 acima de 5.000): os 10 ETFs
  acrescentam ~570 comandos por tick em média (~57 por ETF, quase tudo arbitragem e cobertura do Market Maker) e o grosso do custo
  é do catálogo de ações (Market Makers 1.770 e bots direcionais 2.879 por tick). Com 50 ativos e 5 ETFs a média é 4.033 (2 ticks acima).
- **Por que não foi corrigido:** reduzir custo exige escolher entre menos rodadas por dia, bots mais seletivos por rodada ou um
  orçamento de tick maior; nenhuma delas é mecânica e o critério de 5.000 vem da P.8, dimensionado para menos ativos.
- **Opções:** (a) subir o orçamento para o tamanho de catálogo pretendido (ex.: 8.000 para 100 ativos) e medir o prazo do tick
  (2 s de média, 6 s de máximo hoje); (b) limitar o custo por ativo-rodada (a Fase Q já mede); (c) manter o catálogo real em ~30 a 50
  ativos, onde cabe.
- **Decisão (2026-09-26, autor):** sem correção agora. O catálogo real vai demorar a chegar perto de 100 ativos, e o único problema
  medido é o custo passar de 5.000 comandos (o tempo de tick, 2 s de média e 6 s no pior caso, segue folgado). Reabrir se o
  catálogo real passar de ~50 ativos ou se o tempo de tick se aproximar do prazo de 2 minutos da rota.
- **Status:** Resolvido (aceito sem correção)


### 018 · Temporizador automático não é ancorado em horário nem recupera dias perdidos

- **Local:** `engine/internal/infra/scheduler/daily.go` (`RunDaily`)
- **Origem:** validação ponta a ponta do mercado simulado, 2026-09-26 (`tmp/relatorio-e2e-mercado-simulado.md`)
- **O que é:** o tick automático é um `time.Ticker` de 24h que começa na subida do motor. Reiniciar o motor (deploy, crash) reinicia a contagem: com mais de um deploy por dia, nenhum tick automático dispara. Nada persiste o horário do último tick e não há recuperação de dias perdidos (motor fora 2 dias = 2 dias de mercado a menos).
- **Por que não foi corrigido:** exige decidir horário/fuso do tick e a política de recuperação (rodar N ticks de uma vez? pular?).
- **Opções:** (a) ancorar em horário fixo (ex.: 00:00 America/Sao_Paulo) lendo o último tick de `market_calendar`; (b) idem + recuperar dias perdidos limitado a K; (c) manter e operar o tick só pelo admin.
- **Decisão (2026-09-26, autor, Fase S):** horário fixo (00:00 America/Sao_Paulo) com recuperação limitada de dias perdidos (teto de K dias, ex.: 3) e trava contra tick duplicado.
- **Status:** Resolvido pela S.3 (2026-09-27): agenda ancorada às 00:00 America/Sao_Paulo, recuperação limitada (`TICK_MAX_CATCHUP`) e trava consultiva contra tick duplicado. **Revalidação final (S.9, 2026-09-27):** `go test ./internal/infra/db -run TickLock` verde contra o Postgres do stack de teste (as 3 sub-testes: exclusão mútua entre duas instâncias, disputa concorrente com vencedor único, liberação quando a conexão cai); run de 130 dias simulados via `sim.py` sem nenhum tick duplicado/perdido fora do teto configurado.

### 019 · Escala de tempo: crescimento de fundamentos por ciclo de 14 dias gera drift de ~+40%/ano em renda variável contra Selic de 10%

- **Local:** `engine/internal/domain/fundamentals/fundamentals.go` (`DefaultBaseGrowth` = 3% por ciclo), `DefaultReportFrequencyDays` = 14
- **Origem:** validação ponta a ponta, 132 dias simulados, 20 ativos, seed 42
- **O que é:** a taxa de crescimento é "trimestral", mas o ciclo de relatório é a cada 14 dias simulados (~4,5x mais rápido que um trimestre em dias úteis, que é a base do rendimento da renda fixa). Receita medida: +3% a cada 14 dias (+49% em 9 ciclos). Resultado: retorno médio de +19% em 132 dias (desvio entre ativos 17,5 pp), ~0,14%/dia, contra CDB a 110% do CDI rendendo ~0,03%/dia. Dividendos a cada ciclo somam mais ~6% no mesmo período. O usuário aprende que renda variável bate renda fixa com folga, o oposto da lição de risco.
- **Por que não foi corrigido:** calibração/decisão pedagógica (escalar o crescimento por 14/63, ou declarar 14 dias = 1 trimestre e comprimir também a renda fixa).
- **Opções:** (a) `DefaultBaseGrowth` proporcional ao ciclo (~0,67%) e DY idem; (b) manter e assumir tempo comprimido também na renda fixa; (c) margem líquida com reversão à média para gerar ciclos de queda.
- **Decisão (2026-09-26, autor, Fase S):** proposta do autor: manter o trimestre real (ciclo de relatório de ~63 dias simulados, crescimento de 3% e DY reais por trimestre) e acelerar o relógio: 1 dia real = 5 dias simulados (fator 5 como constante ajustável), com 5 ticks por dia real espaçados (~4h48) para o mercado andar ao longo do dia. Ordem limitada 'day order' passa a viver ~5h reais. Interage com o 018 (agenda passa a ser de 5 ticks/dia ancorados) e fecha o 022.
- **Revisão (2026-09-26, autor, Fase S):** o dia simulado passa a ser **dia de calendário** (7 por semana, data-base fixa numa segunda-feira, feriados ignorados por ora), não dia útil. Fim de semana simulado (~9h30 reais) com mercado fechado para negociação de renda variável e renda fixa (sandbox, lições e cancelamento de ordem seguem abertos). Selic/CDI rendem só em dia útil (base 252); IR da renda fixa conta dias corridos direto. Trimestre = 91 dias, Copom = 45 dias, rebalanceamento de ETF trimestral (91), FII paga proventos a cada 30 dias. Calendário da simulação visível no frontend (tarefas S.10 a S.12).
- **Status:** Resolvido (2026-09-27, fecha na S.9): escala 1 dia real = 5 simulados, trimestre de 91 dias e fim de semana sem negociação de bots (S.1-S.3); mercado fechado para o usuário no fim de semana simulado (S.11, `weekend.py` sem falhas na revalidação da S.9) e calendário/relógio no frontend (S.10-S.12). **Revalidação final (S.9):** run de 130 dias simulados (25 usuários reais + bots, catálogo de 23 ativos de renda variável) devolveu retorno médio de preço ~+0,6% no período (≈1,6%/ano anualizado, ante o antigo +19% em 132 dias/achado original), bem abaixo da Selic simulada (9,75%-10%) — sem nenhum resquício do drift de +40%/ano; dia 91 confirmado como o primeiro ciclo de relatório real (trimestre de 91 dias) com reunião do Copom no mesmo dia (Selic 10% → 9,75%), como desenhado.

### 020 · Lição concluível pulando direto pro passo 3: trilha inteira em ~1 s, 1.750 XP e todos os produtos liberados

- **Local:** `POST /lessons/:id/progress` (`backend/src/modules/lessons/`)
- **Origem:** validação ponta a ponta
- **O que é:** `step: 3` numa lição disponível conclui a lição na hora e credita 50 XP, sem passar pelos passos 0-2. Os 35 passos da trilha foram completados em 1,2 s por script (nível 6). Como as lições liberam produtos (ações, ETFs, FIIs, renda fixa), o gate pedagógico é contornável por API e o XP é farmável (não afeta o ranking, que é por rentabilidade, mas afeta nível/conquistas).
- **Por que não foi corrigido:** exige decidir a regra (passos sequenciais? tempo mínimo por passo? só avançar 1 passo por chamada?).
- **Opções:** (a) `step` só pode ser `currentStep` ou `currentStep + 1`; (b) idem + tempo mínimo por passo; (c) aceitar (protótipo) e documentar.
- **Decisão (2026-09-26, autor, Fase S):** passos sequenciais (`step` só pode ser `currentStep` ou `currentStep + 1`) mais tempo mínimo entre avanços (ex.: 5 s, ajustável).
- **Status:** Resolvido (2026-09-26, tarefa S.4): gate de passos sequenciais e tempo mínimo de 5 s entre avanços (`LESSON_MIN_STEP_INTERVAL_MS`), `422` `step_out_of_order`/`step_too_fast`; validado ponta a ponta. **Fechamento formal (S.9, 2026-09-27):** `gating.py` revalidado do zero contra o stack de teste — 0 falhas nas 35 lições × 11 tipos de ativo (gate de produto) e nos dois `422` de passo (pular direto, avançar rápido demais).

### 021 · Tela de ordem mostra o último negócio como preço unitário; execução é contra o book (spread ~2%) e o preço oficial oscila com um único negócio

- **Local:** `frontend` (`OrderConfirmationDialog`, painel "Nova ordem"), `orderexecution`
- **Origem:** validação ponta a ponta (API + navegador)
- **O que é:** (1) o painel/diálogo mostra "Preço unitário" = último negócio e "Total"/"Saldo após a ordem" calculados com ele, mas ordem a mercado executa no melhor ask (spread medido ~2%, ida e volta de ~2% de custo). Comprar "o máximo que cabe" pelo último preço falha com 422 genérico "saldo insuficiente" (40 de 66 tentativas all-in do cenário). A mensagem de sucesso não informa o preço médio executado. (2) O preço oficial é o último negócio, então 1 cota comprada no ask ou vendida no bid move o preço 1% a 2% (medido 1,94% num ETF com book raso) e marca todas as carteiras e o ranking; dá para inflar a própria posição com negócios pequenos.
- **Por que não foi corrigido:** decisão de produto (mostrar melhor bid/ask e preço estimado? marcar carteira a ponto médio?).
- **Opções:** (a) mostrar bid/ask e "custo estimado" no diálogo e o preço médio no resultado; (b) marcar carteira/ranking a ponto médio do book; (c) ambas.
- **Decisão (2026-09-26, autor, Fase S):** (a) rota de leitura com melhor bid/ask e profundidade resumida; diálogo mostra custo estimado contra o book, resultado informa preço médio executado, e o 422 de all-in ganha mensagem clara com a quantidade máxima possível; (b) carteira, patrimônio e ranking marcam a ponto médio do book (fallback: último negócio se faltar um dos lados). Gráfico e variação do dia continuam no último negócio.
- **Status:** Resolvido (2026-09-27, tarefas S.5-S.7): `GET /assets/{id}/book` (motor) + proxy no backend expõem melhor bid/ask e profundidade; painel "Nova ordem" mostra custo estimado contra o book e "Usar o máximo" calcula pela profundidade real; resultado informa preço médio executado; carteira/patrimônio/ranking marcam a ponto médio do book (S.6). **Revalidação final (S.9):** `liq.py` contra os 23 ativos reais do run de 130 dias — 100% de preenchimento em todos, slippage médio de ida ~+1% / volta ~-1% (round-trip ~2%, mesma ordem de grandeza da validação original), nenhum 500/preenchimento zero inesperado.

### 022 · Composição de tempo do renda fixa mistura relógio de parede e dia simulado

- **Local:** `fixedincomeexecution` (DU restante, `days_held` do IR) contra rendimento pós-fixado (dias simulados)
- **Origem:** validação ponta a ponta, 21 ticks em sequência
- **O que é:** o rendimento pós-fixado acumula por dia simulado (LFT 100% Selic rendeu 0,797% em 21 dias, exato), mas o preço do Tesouro Prefixado (DU restante) e o IR regressivo usam relógio de parede: após 21 ticks seguidos o Prefixado resgatou ao mesmo preço da compra e o IR foi 22,5% (0 dia). Em produção (1 tick = 1 dia real) coincidem, mas divergem com tick manual do admin ou recuperação de dias (achado 018). Já documentado como decisão 4 da tarefa 3.13; registrado aqui como risco operacional.
- **Opções:** (a) derivar tudo de dias simulados; (b) manter e proibir tick manual em produção.
- **Decisão (2026-09-26, autor, Fase S):** derivar prazo/vencimento e IR da renda fixa, datas de dividendos (DY de 12 meses) e o dia do roteiro sandbox do dia simulado, não do relógio de parede. Implementado junto com a aceleração de 5 dias simulados por dia real (ver 019).
- **Revisão (2026-09-26, autor, Fase S):** o dia simulado passa a ser **dia de calendário** (7 por semana, data-base fixa numa segunda-feira, feriados ignorados por ora), não dia útil. Fim de semana simulado (~9h30 reais) com mercado fechado para negociação de renda variável e renda fixa (sandbox, lições e cancelamento de ordem seguem abertos). Selic/CDI rendem só em dia útil (base 252); IR da renda fixa conta dias corridos direto. Trimestre = 91 dias, Copom = 45 dias, rebalanceamento de ETF trimestral (91), FII paga proventos a cada 30 dias. Calendário da simulação visível no frontend (tarefas S.10 a S.12).
- **Status:** Resolvido pela S.1 (2026-09-26): prazo/IR/VNA da renda fixa, datas de dividendo/fundamentos e dia do roteiro sandbox derivam do dia simulado (`simcalendar`). **Revalidação final (S.9, 2026-09-27):** compra de LFT2029 (Tesouro Selic, pós-fixado) seguida de 21 ticks corridos (15 dias úteis de 21, 6 dias de fim de semana simulado corretamente sem render) e resgate — retorno realizado 0,5553% bate com o cálculo teórico de 15 dias úteis compostos à Selic corrente (9,75% a.a., base 252) dentro de 0,001pp; IR regressivo 22,5% (primeira faixa) correto pros 21 dias corridos mantidos.

### 023 · Ativo sandbox aparece na tabela de Ações do mercado real como "aguardando cotação"

- **Local:** `frontend` (Renda Variável, aba Ações)
- **Origem:** validação ponta a ponta (navegador)
- **O que é:** `SAND3` (sandbox) aparece misturado às ações reais, sem risco nem cotação, na lista do Mercado Ao Vivo. Confunde o usuário sobre o que conta no ranking.
- **Opções:** (a) esconder sandbox da lista do mercado real e listá-lo só no modo aprendizado; (b) rotular claramente.
- **Decisão (2026-09-26, autor, Fase S):** esconder ativos sandbox do mercado real (`GET /market/assets` exclui `is_sandbox` por padrão, com parâmetro para incluir); sandbox fica acessível só pelo card Modo Aprendizado do Portfólio e pelas lições, que continuam achando o ativo pelo ticker.
- **Status:** Resolvido (2026-09-26, tarefa S.8): `GET /market/assets` esconde sandbox por padrão (`include_sandbox=true` p/ lições e extrato); validado ponta a ponta. **Fechamento formal (S.9, 2026-09-27):** confirmado no run de 130 dias — `SAND3`/`SANDPRE` ausentes da listagem padrão consumida pelo restante do script, presentes e operáveis só quando pedidos explicitamente com `include_sandbox=true` (persona "sand": compra/venda via sandbox funcionando normalmente durante todo o run).

### 024 · Preço de FII deriva para baixo sem âncora fundamentalista (-49% em 200 dias simulados)

- **Local:** `engine/internal/domain/tick` (rodadas de bots), `bot` (só Fundamentalista tem preço justo, e ele cobre só ação)
- **Origem:** validação da tarefa S.2 (2026-09-26): 200 dias simulados, seed com FII a P/VP = 1 (patrimônio por cota = preço inicial R$ 100)
- **O que é:** TJLO11 e PAPL11 caíram em média 49% (TJLO11: 106 no dia 10, 64 no dia 200, patrimônio por cota estável em ~100), enquanto as ações ficaram em média +5%. FII não tem preço justo pra nenhum bot (`FundamentalistFairPrice` é só de ação); o preço se move só por Chartista, Ruído e Market Maker, sem nada puxando de volta ao valor patrimonial. Já existia antes da S.2 (primeira medição, com o patrimônio 5x o preço, deu -45%); a proposta do motor realista diz que ágio/deságio persistente de FII é esperado, mas -50% em ~6 meses não é ágio, é deriva.
- **Por que não foi corrigido:** decisão de produto/modelo (qual âncora: patrimônio por cota, rendimento exigido vs Selic ou nenhuma).
- **Opções:** (a) Fundamentalista passa a ter preço justo de FII = patrimônio por cota ajustado por um P/VP-alvo por segmento; (b) preço justo por Dividend Yield exigido (proventos anualizados / (Selic + prêmio)); (c) manter como está e tratar FII como ativo volátil sem âncora.
- **Decisão (2026-09-29):** opção (a), calibrada por pesquisa de como o mercado real avalia FII. Duas lentes usadas juntas: P/VP (preço sobre valor patrimonial por cota, com desconto persistente e variável por segmento: lajes ~0,66x, shoppings ~0,86x, logística ~18% de desconto) e spread do Dividend Yield sobre a NTN-B (média histórica ~2,9% a 3,0% no tijolo, 3,6% em ago/2024). Fórmula adotada: preço justo = VP por cota × P/VP-alvo do segmento, com o P/VP-alvo deslocado quando a Selic sai da neutra. Constantes ilustrativas, sujeitas à 8.1. Fontes: Suno (P/VP), relatórios gerenciais Rio Bravo CXRI11/CRFF11 (spread de DY sobre NTN-B, ago/2024), EQI Research, InfoMoney, B3 Bora Investir (P/VP por segmento). Não achei P/VP nem spread histórico confiável de FII de papel: o valor do papel é ilustrativo.
- **Status:** Resolvido (2026-09-30, Fase U, U.1 a U.7). O Fundamentalista negocia FII com preço justo (VP por cota × P/VP-alvo por segmento deslocado pela Selic, com efeito transitório do provento). Validado em 200 dias simulados com o catálogo completo: deriva de -49% para no máximo +5% (ver Entregável da U.7 em `backlog-motor-mercado-realista.md`). Resolve junto a reserva S.14. Sobra o achado 027 (DY de lajes/logística).


### 025 · ROE/margens/alavancagem continuam idênticos entre empresas do mesmo setor — só o crescimento (`base_growth_pct`) diferencia "boa/média/ruim"

- **Local:** `engine/internal/domain/fundamentals/fundamentals.go` (`DeriveFinancials`/`CoefficientsForSector`, chamadas só com `sector` — nenhum parâmetro por empresa)
- **Origem:** tarefa 7.2 (seed de catálogo completo, 2026-09-27) — pedido do autor de "empresas boas, médias e ruins" em cada setor
- **O que é:** `DeriveFinancials(sector, netRevenue)` deriva `NetIncome`/`EBIT`/`NetEquity`/`GrossDebt`/`CashEquivalents` só a partir de `CoefficientsBySector[sector]` (margens/alavancagem fixas, calibradas por setor na K.1) e do `netRevenue` do dia — nunca de um coeficiente próprio da empresa. Como `ROE = NetIncome/NetEquity = NetMarginPct/EquityToRevenueRatio` (os dois fixos por setor), **toda empresa do mesmo setor tem exatamente o mesmo ROE pra sempre**, e o mesmo vale pra margem líquida/EBIT e pro índice de alavancagem (dívida/patrimônio) — confirmado ao vivo nesta sessão (MSAL3/MTCE3/MPNG3, mesmo setor Mineração, ROE idêntico a 11,54% apesar de `base_growth_pct` 8/3/-3). O único grau de liberdade que esta tarefa introduziu (`companies.base_growth_pct`, migration 000035) diferencia P/L e P/VP (via o termo de crescimento de `bot.FundamentalistFairPrice`, que pondera o preço justo por `1+growthRate`) e a trajetória de preço/receita ao longo do tempo — mas não os 3 indicadores de rentabilidade/estrutura de capital que RF21/tela 4.5 também expõem (ROE, margem, alavancagem), que ficam iguais em qualquer comparação lado a lado dentro de um setor.
- **Por que não foi corrigido:** dar variação própria de ROE/margem por empresa exige generalizar `DeriveFinancials`/`CoefficientsForSector` pra aceitar um multiplicador ou um conjunto de coeficientes por empresa (não só por setor) — mudança de assinatura que atravessa `tick.go` (dois call sites), o bootstrap inicial e possivelmente uma coluna nova em `companies` (ou `company_fundamentals`) pra persistir o multiplicador; escopo maior que o desta sessão (que já entregava 22 empresas/3 FIIs/4 ETFs novos) e não estava fechado em nenhum documento antes de hoje — só citado como "trabalho futuro" no comentário de `CoefficientsBySector` (K.1/K.2).
- **Opções:** (a) generalizar `CoefficientsForSector` pra `CoefficientsForCompany(sector, qualityMultiplier)`, aplicando um multiplicador (ex: 0.8/1.0/1.3) sobre `NetMarginPct`/`EBITMarginPct` (e inverso sobre `DebtToEquityRatio`) antes de `DeriveFinancials`, com o multiplicador vindo de uma coluna nova (`companies.quality_multiplier` ou similar); (b) manter como está — crescimento já move P/L e P/VP de forma perceptível e didaticamente honesta ("múltiplo mais alto por causa de crescimento esperado", não de rentabilidade), e documentar essa nuance na tela 4.5/RF21; (c) reservar ROE/margem variável só pra uma fase futura de calibração fina (8.1), já que os 3 indicadores idênticos por setor não impedem nenhum critério de aceite fechado da 7.2 (RF21 pede o indicador existir e refletir os fundamentos reais da empresa, não necessariamente variar dentro do setor).
- **Status:** Resolvido (2026-10-01), opção (a) escolhida pelo autor. `companies.quality_multiplier` (migration 000039, default 1.00, CHECK em `(0, 2]`) alimenta `fundamentals.CoefficientsForCompany(sector, q)`: margem líquida e margem EBIT × q, dívida/patrimônio ÷ q; patrimônio/receita, caixa/receita e sensibilidade à Selic seguem do setor (ROE passa a escalar com q, a ordem EBIT ≥ lucro líquido se preserva). `DeriveFinancials` e `BootstrapFinancialsForTargetPrice` recebem o multiplicador (o preço justo de partida continua batendo com o alvo), `catalog.NewCompany` valida a faixa, `tick.CompanyForFundamentals.QualityMultiplier` vem de `ListCompaniesForFundamentals`. Seed: Boa/Média/Ruim = 1,25/1,00/0,75 pareados com o crescimento de 8/3/-3% (ex.: Mineração ROE 14,4%/11,5%/8,6%, Tecnologia 20,8%/16,7%/12,5%). Dividend Yield não muda (P/L de equilíbrio independe do ROE). Valor zero do campo (struct sem preenchimento) vale neutro. **Ambientes já seedados:** `ensureCompany` pula empresa existente, então elas ficam em 1.00 até reseed do banco (ou `UPDATE companies SET quality_multiplier` + novo ciclo de relatório, com salto único de preço justo no ciclo). Testes: domínio (`fundamentals`, `catalog`, `tick`), seed (`quality_test.go`) e integração com Postgres (`TestListCompaniesForFundamentals_TrazQualityMultiplier`); `golangci-lint` 0 issues; seed validado contra Postgres descartável.

### 026 · Catch-up de salário atrasado empilha N meses indistinguíveis no mesmo dia simulado, com o valor do nível atual (não do nível histórico)

- **Local:** `backend/src/modules/payroll/application/useCases/creditMonthlyPayrollForUser.ts` (T.5), `engine` `POST /accounts/{user_id}/salary` (T.2, dia simulado sempre automático/atual via gatilho da migration `000034`), calendário (T.6/T.7)
- **Origem:** validação ponta a ponta desta sessão (Fase T completa) — conta criada no dia simulado 0, backend nunca reiniciado durante ~7 meses simulados (avanço via `POST /admin/tick` em lote, simulando o backend ficar fora do ar por um período longo); ao reiniciar o backend, o catch-up correu duas vezes (uma pagando Fev/Mar/Abr, outra Jun/Jul/Ago com Mai descartado pelo teto) — comportamento correto e já documentado pro teto (`maxCatchUpMonths`) e pra "o dia do crédito não ser exatamente o 5º dia útil" (nota da T.6). O que não estava documentado: `market_events` mostrou os 3 meses do segundo catch-up (Jun/Jul/Ago) todos com `simulated_day=217` (o dia em que o job rodou) e `unit_value=100.00` idênticos — `GET /market/calendar` nessa janela devolve **3 entradas `salary_payment` empilhadas no mesmo dia**, sem nenhum campo que diga a qual mês-calendário cada uma se refere, e os dias 5º-dia-útil reais de Jun/Jul (que já passaram) não mostram nenhum marcador (nem "vem aí", nem "pago") — o fato só existe no dia em que o backend finalmente rodou o check.
- **Por que não foi corrigido:** decisão de produto sobre como representar catch-up multi-mês pro usuário — não é um bug mecânico (o código faz exatamente o que os comentários da T.5/T.2 descrevem: "o motor não guarda nível histórico", "dia simulado automático"), mas a *apresentação* (calendário e teatro de recompensa da T.7, que dispararia um toast "Salário do mês: R$100" por evento, um atrás do outro, sem indicar que são meses diferentes) nunca foi pensada pro caso de N>1.
- **Cenário concreto:** usuário some por 2+ meses (viagem, app raramente aberto) e volta: vê 2-3 marcadores idênticos de salário no mesmo dia no calendário e 2-3 toasts idênticos em sequência ao abrir o app, sem saber que representam meses diferentes nem que um mês foi descartado pelo teto.
- **Opções:** (a) aceitar como está (é a mesma limitação já aceita pro teto de dias do Temporizador do motor, S.3) e no máximo documentar no onboarding/T.11 que atraso agrupa os pagamentos; (b) `POST /accounts/{user_id}/salary` ganhar um campo opcional pra anotar o mês de referência (ex. `reference_month`), propagado ao evento e exposto no calendário, permitindo distinguir "Salário de Junho: R$100" de "Salário de Agosto: R$100" mesmo pagos no mesmo dia; (c) o job agregar o catch-up num único crédito ("Salário atrasado (3 meses): R$300") em vez de N créditos iguais, mais simples de exibir mas perde a rastreabilidade por mês em `market_events`.
- **Decisão (2026-09-28, autor):** opção (b) — rastreabilidade por mês em `market_events` (Event Sourcing, CLAUDE.md) vale mais que a simplicidade de (c).
- **Status:** Resolvido (2026-09-28): `reference_month` (`AAAA-MM`, `char(7)`, migration `000037_salary_payment_reference_month`) novo em `market_events`, só preenchido em `salary_payment`. `POST /accounts/{user_id}/salary` (T.2) passa a exigir `reference_month` no corpo (`400` se ausente ou fora do formato) — `account.Service.CreditSalary`/`account.Repository.CreditSalary` (engine) e `SalaryCrediter`/`CreditMonthlyPayrollForUserUseCase` (backend, T.5) ganharam o parâmetro, cada mês do catch-up credita com o `monthKey` que está de fato pagando (nunca o dia em que o job rodou). `marketcalendar.Event`/`UserFact` (T.6) expõem `ReferenceMonth`, tanto no fato real passado (lido de `market_events`) quanto no anúncio futuro sintético (`simcalendar.MonthKeyOf`, redundante com a data mas mantido por consistência de contrato) — `GET /market/calendar` devolve `reference_month` em todo `salary_payment`. Frontend: `describeCalendarEvent` (T.7) muda o subtítulo pra "Referente a `<mês> de <ano>`" quando `reference_month` vem preenchido (era "Caiu na sua conta" fixo); `useDayFlipReveal` agora itera **todos** os `salary_payment` do dia (achado adicional encontrado corrigindo este: o código antigo só pegava o primeiro com `.find`, então um catch-up de 3 meses mostrava só 1 toast e "perdia" a celebração dos outros 2, mesmo já tendo creditado o dinheiro certo) — um toast por crédito, cada um nomeando o mês só quando há mais de um naquele dia (`describeSalaryReveal(amount, referenceMonth?)`); com um só, o título genérico "Salário do mês" é mantido, sem mudança visível no caso comum. Validado ao vivo via `docker compose` numa stack isolada (mesmo método da auditoria original): usuário criado, salário pago no mês corrente, depois avanço de ~90 dias simulados via `POST /admin/tick` em lote (2 ciclos de restart do backend) reproduziu o catch-up de 3 meses (`2026-09`, `2026-10`, `2026-11`) todos no `simulated_day=307` — `GET /market/calendar` confirmou os 3 eventos com `reference_month` distinto cada. Testes: domínio (`account_test.go`, validação de formato incluindo os mesmos casos do achado), repositório contra Postgres real (`account_repository_integration_test.go`), `httpserver` (`account_test.go`), `marketcalendar` (`calendar_test.go`, incluindo teste dedicado do cenário de catch-up de 3 meses), `simcalendar_test.go` (`MonthKeyOf`) no engine; `creditMonthlyPayrollForUser.test.ts`/`runPayrollCheck.test.ts`/`engineSalaryCrediter.test.ts` no backend; `calendarEvents/index.test.ts`, `dayFlipReveal/index.test.ts`, `MarketClockChip/index.test.tsx` (cenário de catch-up com 2 toasts nomeados) no frontend. `go build`/`go vet`/`go test ./...`/`golangci-lint run` (Docker v2.12.2, 0 issues), `npx tsc -b`/`npm run lint`/`npx vitest run` (backend 721, frontend 820) e `npx oxlint`/`npx prettier --check` (sem warning novo) verdes. `.docs/engine/account.md`/`calendar.md` atualizados.

### 027 · Dividend Yield inicial dos FIIs de lajes e logística fica acima da faixa plausível depois da calibração do seed (U.5)

- **Local:** `engine/internal/domain/dividend/dividend.go` (`DefaultFIIYieldPerCyclePct` = 1,1% do VP por mês), `engine/cmd/seed/main.go` (`fiiInitialBaseValue`), `engine/internal/domain/fii/fairprice.go` (P/VP-base por segmento)
- **Origem:** tarefa U.5 (2026-09-30): ao calibrar o valor-base inicial pelo P/VP-alvo, o patrimônio por cota passou a ser maior que o preço, e o provento (1,1% do VP por mês) sobe em relação ao preço.
- **O que é:** DY anual inicial sobre o preço de R$ 100: TJLO11 (lajes, P/VP 0,75) **17,6%**, LOGT11 (logística, 0,85) **15,5%**, SHPP11 (shopping, 0,88) 15,0%, PAPL11/IPCP11 (papel, 1,00) 13,2%. A faixa plausível citada na U.5 é ~8% a 15% a.a.; lajes e logística passam dela (shopping no limite). Antes da U.5, com P/VP = 1, todos davam 13,2%.
- **Por que não foi corrigido:** calibrar `DefaultFIIYieldPerCyclePct` (ou torná-lo por segmento) às cegas muda o yield de todos os FIIs e a relação com a Selic; a U.5 manda registrar em vez de calibrar. É calibração fina (tarefa 8.1) ou decisão de modelo.
- **Opções:** (a) manter (constante ilustrativa, 8.1 ajusta); (b) taxa de payout por segmento (ex.: menor nos de P/VP baixo, de modo que o DY sobre o preço fique perto de 12% a 13% nos três); (c) reduzir `DefaultFIIYieldPerCyclePct` global (ex.: 0,9% ao mês), o que deixa o papel em ~10,8%.
- **Decisão (2026-09-30, autor):** opção (b), taxa de provento por segmento derivada do P/VP-base, com Dividend Yield anual-alvo de 13,2% (o do papel, 12 × 1,1%).
- **Status:** Resolvido (2026-09-30): `fii.PayoutYieldPerCyclePct(tipo, segmento)` = 13,2 × P/VP-base ÷ 12 (lajes 0,825%, shopping 0,968%, logística 0,935%, papel 1,10% inalterado, tijolo desconhecido 0,935%). `dividend.FIIValuePerShare` recebe a taxa; `dividend.DefaultFIIYieldPerCyclePct` foi removida; o efeito do provento no preço justo (U.4) usa a mesma taxa. DY anual inicial 13,2% nos 5 FIIs (antes 17,7% em lajes e 15,6% em logística). Validado em 100 ticks no catálogo padrão: DY realizado de 13,1% a 13,5%, preços dos FIIs entre 98 e 102 em média, invariantes financeiras com 0 violações. Testes em `fii/payout_test.go`, `dividend_test.go`, `tick_test.go` e `cmd/seed/fii_test.go`.

### 028 · Evento macro apontado para um FII é aceito e marcado `aplicado`, mas não move nada

- **Local:** `POST /admin/macro-events` (backend, `modules/admin`) e `engine/internal/domain/tick/tick.go` (`assetToCompany`, ~linha 694-718: só ativo com `CompanyID` entra no fan-out do efeito)
- **Origem:** teste ponta a ponta adversarial do PR #49 (2026-10-01), cenário E: `POST /admin/macro-events` com `targets: [{ asset_id: <FII> }]` devolveu `201`, o evento passou por `pendente` e terminou `aplicado` (aparece assim no feed `/news`), mas o preço do FII não recebeu nenhum efeito.
- **O que é:** a Fase U declara "evento macro afetando FII" fora de escopo (FII não tem empresa, e o efeito macro é por empresa). Só que a API não recusa o alvo: o admin dispara o evento, o usuário comum vê "aplicado" no feed e nada acontece no ativo. Não há erro, nem 5xx, nem efeito.
- **Por que não foi corrigido:** exige decidir se o evento em FII deve (a) ser rejeitado na criação (`422`, "FII não é alvo válido"), (b) passar a ter efeito (preço justo do FII ganha o termo de efeito macro que `fii.FairPrice` já recebe como parâmetro `macroEffectPct`, hoje sempre 0), ou (c) continuar aceito e apenas ser documentado como sem efeito.
- **Decisão (2026-10-01, autor):** opção (a), rejeitar na criação. Motivo: o efeito macro que importa para FII (juros e inflação) já chega pelo preço justo via Selic e IPCA; os templates atuais são de setor e não descrevem nada de FII, e os eventos reais de FII são locais (vacância, inadimplência, laudo), um conjunto de templates próprio que seria uma fase futura.
- **Status:** Resolvido (2026-10-01): `macroeventtrigger.Service.Trigger` consulta `Repository.AssetsWithCompany` (uma consulta por disparo, só quando há alvo por `asset_id`) e devolve `ErrUnknownTargetAsset` (ativo inexistente ou id malformado) ou `ErrAssetNotTargetable` (FII, ETF, renda fixa), ambos `400` no motor (mesma família de `ErrUnknownSector`, então o backend os repassa como `400` sem mudança). Um alvo inválido recusa o evento inteiro antes de gravar. Alvos de setor e `risk_class` não consultam o catálogo. Antes, um `asset_id` inexistente caía num erro de chave estrangeira (`500`); agora é `400`. Testes: domínio (`macroeventtrigger_test.go`, tabela com ação/FII/misturado/inexistente/malformado/setor/risk_class e erro de consulta), `httpserver` (mapeamento `400`), banco (`macro_event_repository_integration_test.go` contra Postgres real) e e2e (`pr49.py`, cenário E). Sem alvo FII em nenhum dos 3 testes e2e do backend, que usam ação.

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
- **Decisão (2026-10-02, confirmada com o autor):** opção (b), manter as duas tabelas separadas. Crescimento
  de receita reflete a estrutura do setor (por setor); retorno exigido é uma taxa de desconto ligada ao
  risco da classe do ativo (por `risk_class`). Divergir pra uma mesma empresa (BNDD4: 0.05 vs 0.06) não é
  inconsistência. Só comentários mudaram (`fundamentals.go`, `tick.go`, `bot/fundamentalist.go`), sem
  alteração de comportamento; `go build`/`go vet` verdes.
- **Status:** resolvido

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
- **Decisão (2026-10-03, autor): opção (a), mantida como está.** O campo continua **reservado e sem efeito**: todo
  bot segue enviando só ordem limitada, a mesma decisão já tomada nas Fases C e D (já discutida e confirmada pelo
  autor), podendo ser revista no futuro. Consequência prática: o painel de bots (N.15) **não expõe** esse campo,
  pra não oferecer um botão que não faz nada. Se um dia a regra for desenhada, os candidatos naturais por realismo
  são os arquétipos Chartista e Ruído; ordem a mercado de bot consome o book fino e exigiria recalibração.
- **Status:** resolvido

### 029 · Escopo do painel admin ampliado (Fase N, N.3 a N.24): decisões que travavam tarefas

- **Local:** `.claude/backlog-motor-mercado-realista.md`, Fase N (N.7, N.9, N.16, N.17, N.18, N.23)
- **Origem:** ampliação da Fase N pedida pelo autor ("controle geral da aplicação"), 2026-10-03
- **O que é:** a spec 3.3.3 limitava o painel a eventos macro; as tarefas novas cobrem tempo, mercado, bots,
  usuários, conteúdo e gamificação, e seis pontos dependiam de escolha do autor.
- **Decisões (2026-10-03, autor):**
  1. **Parâmetros editáveis (N.7):** só o ritmo do relógio (ticks por dia real e recuperação máxima); o resto fica
     só leitura.
  2. **Pausa de negociação (N.9):** não suspende o tick; relógio e negociação têm interruptores independentes. O
     book fica vazio se a pausa atravessar um tick, e retomar não força rodada.
  3. **Patrimônio absoluto (N.16):** o admin vê o de qualquer usuário, sem auditar a leitura ("o administrador pode
     fazer o que quiser"). Exceção escrita no CLAUDE.md.
  4. **Suspensão de conta (N.16):** entra, na forma reversível (bloqueia login e tokens, tira do ranking e da
     busca, nunca apaga progresso), como subtarefa separável; não cancela as ordens do usuário.
  5. **Crédito de caixa (N.17):** o admin adiciona dinheiro simulado na conta de qualquer usuário, **sem teto**,
     pra uso excepcional (evento imutável `admin_credit`). Não afeta o ranking, que mede só capital de risco.
  6. **Conteúdo das lições (N.23):** o banco é a fonte da verdade; o admin edita e cria lições pelo painel; o seed
     vira só importação inicial.
- **Status:** resolvido

### 030 · Onde uma lição criada pelo painel pode entrar na ordem (progressão por contagem)

- **Local:** `backend/src/modules/lessons/domain/lesson.ts:38` (`isUnlocked`: `sortOrder <= completedCount + 1`) e
  `:193` (`unlockedKeysFor`: chave vale se existe lição com `sortOrder <= completedCount` que a desbloqueia)
- **Origem:** decisão do autor de 2026-10-03 de ter o banco como fonte das lições e criar lições pelo painel (N.23)
- **O que é:** a progressão é linear e por **contagem**, não por lição específica: quem concluiu N lições tem
  liberadas as de `sort_order` até N+1, e os produtos vêm das lições de `sort_order` até N. Inserir uma lição **no
  meio** desloca o `sort_order` das seguintes: um usuário com 5 concluídas passa a ser tratado como se tivesse feito
  a lição nova sem tê-la feito, e a antiga 5ª (agora 6ª) deixa de contar, podendo **tirar de volta um produto já
  desbloqueado**. Mesmo tipo de problema do achado 010. O mesmo vale pra **despublicar** (N.18): despublicar uma
  lição que o usuário não fez trava a trilha dele, e despublicar uma que fez o faz pular uma.
- **Decisão (2026-10-03, autor): permitir inserir no meio, com dispensa.** Lição nova no meio **não bloqueia quem já
  passou daquele ponto**; só bloqueia quem ainda não chegou. Implementação na tarefa **N.24** (dispensa por usuário,
  progressão calculada sobre as lições publicadas), que também resolve o despublicar.
- **Regras de detalhe (2026-10-03, autor):** (a) lição dispensada **concede as chaves de produto** dela mesmo sem
  ter sido feita, porque quem já passou daquele ponto provavelmente já viu o conteúdo e a lição é só um complemento
  (aparece no mapa como "nova, opcional"); (b) dispensa **não dá XP**; (c) pra "trilha concluída", dispensada conta
  como satisfeita (troféu já conquistado não regride). Os itens (b) e (c) foram aceitos como propostos.
- **Status:** resolvido

### 045 · Quando o jogador passa a ver um evento macro agendado (N.11)

- **Local:** `engine/internal/domain/macroevent/lifecycle.go` (`IsPubliclyVisible`), `engine/internal/infra/db/macro_event_repository.go` (`listWhere`, visão pública) e `engine/internal/infra/db/calendar_repository.go` (`MacroEventsBetween`)
- **Origem:** implementação da N.11 (agendar um evento pra um dia simulado futuro). O backlog diz que o agendado "aparece como pendente até lá", mas não diz **pra quem**: o feed de notícias e o calendário do jogador mostram título e narrativa de todo evento.
- **O que é:** mostrar o evento ao jogador no instante em que o admin o agenda entregaria o evento com semanas de aviso, o que contraria a razão de existir do veredito redigido (RF16). **Decisão provisória tomada na implementação (a confirmar):** o evento agendado só aparece no feed e no calendário do jogador na **véspera** do primeiro dia de efeito (`triggered_on_day <= dia corrente + 1`), a mesma antecedência de um disparo imediato, que já aparece um tick antes de produzir efeito. Evento **cancelado** nunca aparece. O painel enxerga tudo.
- **Opções:** (a) a regra atual (véspera, igual ao disparo imediato); (b) aparecer só quando o efeito começa (some a antecedência de um tick, e o disparo imediato teria de seguir a mesma regra); (c) o admin escolher a antecedência por evento.
- **Decisão (2026-10-06, autor): opção (c), o admin escolhe a antecedência por evento.** A regra da véspera vira só o valor padrão. Implementação na tarefa **N.25** (campo de antecedência no agendamento, no motor, na tela e nas duas consultas de visão pública). Numeração: este achado era o segundo "031" do arquivo e foi renumerado para 035.
- **Status:** resolvido

### 032 · Revogar uma conquista que o usuário ainda cumpre não "fica": a próxima checagem a concede de novo (N.17)

- **Local:** `backend/src/modules/achievements/application/useCases/correctAchievements.ts` (`RevokeAchievementUseCase`) e `checkAndUnlockAchievements.ts`
- **Origem:** implementação da N.17 (conceder ou revogar conquista manualmente).
- **O que é:** revogar só apaga a linha de `user_achievements`. A conquista não tem noção de "revogada pelo suporte", então se o usuário ainda satisfaz o critério (streak, lições, patrimônio), o próximo `checkAndUnlock` (disparado por XP, streak ou lição) a concede de novo, em silêncio. Revogar só funciona de verdade quando a conquista foi dada **por engano** (concessão manual sem critério, ou bug). **Decisão provisória tomada na implementação (a confirmar):** manter assim e avisar o admin na tela e em `.docs/backend/admin.md`.
- **Opções:** (a) manter (revogar desfaz concessão indevida; critério cumprido volta sozinho); (b) guardar uma marca de "revogada" por usuário e conquista, que a checagem automática respeita (precisa de coluna ou tabela nova, e um jeito de desfazer a marca); (c) tirar a ação "revogar" do painel e só permitir conceder.
- **Decisão (2026-10-06, autor): opção (c), tirar "revogar" do painel e deixar só "conceder".** Revogar não fica quando o critério continua cumprido, então a ação prometia algo que não acontece. Implementação na tarefa **N.26**.
- **Status:** resolvido

### 033 · Conquistas sem ícone nem XP, missões sem "tipo" e "meta" editáveis: o painel de gamificação cobre só o que o modelo já tem (N.19)

- **Local:** `backend/src/db/schema.ts` (`achievements`, `daily_missions`) e o texto da tarefa N.19
- **Origem:** implementação da N.19. A descrição pede **editar nome, descrição, ícone e XP** da conquista e, na missão, **texto, tipo, meta, XP**. O modelo não tem nada disso: `achievements` só tem nome, descrição, regra e meta de desbloqueio (sem coluna de ícone nem de XP, e o frontend não renderiza ícone por conquista); `daily_missions` tem texto, XP e um "tipo" que na verdade é **código** (`requiresLessonCompletion` e duas `key`s despachadas em `CompleteMissionUseCase`), sem meta numérica parametrizável.
- **O que é:** entregar "ícone" e "XP por conquista" não é só uma coluna: XP ao desbloquear muda a economia de XP do jogo (nível, salário por nível, ranking de nível) e cria um laço (`AwardXpUseCase` chama a checagem de conquistas, que concederia XP de novo); ícone exige o frontend passar a renderizar um ícone por conquista (hoje não renderiza). Criar missão nova pelo painel entregaria XP de graça (sem verificação cruzada). **Decisão provisória tomada na implementação (a confirmar):** o painel opera o que existe (conquista: nome, descrição, regra da lista fechada, meta, ativa; missão: título, descrição, XP de 1 a 500, ativa, tipo só leitura), sem ícone, sem XP por conquista, sem criar missão.
- **Opções:** (a) manter assim; (b) ícone por chave de uma lista fechada (coluna `icon` e o frontend renderizando); (c) XP por conquista, concedido uma vez ao desbloquear (decidir a curva e quebrar o laço da checagem); (d) tipos de missão genéricos com meta (ex: "ler N eventos no feed"), o que é uma refatoração do despacho por `key`.
- **Decisão (2026-10-06, autor): opção (a), manter o escopo atual.** Sem ícone, sem XP por conquista e sem criar missão pelo painel: XP por conquista mexeria na economia de nível/salário/ranking e criaria um laço com a checagem de conquistas. Ícone por lista fechada (b) e tipos de missão genéricos (d) ficam como evolução futura, sem tarefa aberta. O texto da N.19 foi ajustado no backlog.
- **Status:** resolvido

### 043 · Painel de bots: histórico de tempo de cotação e origem de uma posição aportada

- **Local:** `engine/internal/infra/db/admin_bots_read_repository.go` (`marketMakerQuotes`) e `engine/internal/infra/db/bot_admin_repository.go` (`FundBot`)
- **Origem:** N.14 e N.15 (PR 6 da Fase N), 2026-10-03
- **O que é:** dois gaps entre o texto das tarefas e o que o dado permite. (1) A N.14 pede "tempo de cotação por ativo (% dos dias com bid+ask)" do Market Maker, mas o `order_book` não guarda quando uma ordem terminou (só `created_at`, `status` e `cancel_reason`), então esse histórico não é reconstruível; a tela mostra só a **situação atual** da cotação (melhor compra e venda do próprio Market Maker, spread e inventário contra o alvo). (2) A N.15 pede aporte de caixa **ou posição** "respeitando o teto de float", mas o float de todo ativo já está 100% distribuído (B.1/P.2), então o aporte de **posição** é recusado (`409`) em quase todo ativo; só o aporte de caixa funciona na prática. Mesmo ponto já registrado na N.1 ("de quem sai a posição?").
- **Por que não foi corrigido:** (1) exige gravar um dado novo (um snapshot de cotação por dia e por Market Maker, ou o instante de encerramento da ordem), o que muda o motor e o custo por tick; (2) exige escolher de onde a posição aportada sai (de outro detentor, de uma criação de cotas, ou aumentando `outstanding_shares`), e cada uma tem efeito diferente na economia do ativo.
- **Opções:** (1) tabela `market_maker_quote_days (mm_account_id, asset_id, simulated_day, had_bid, had_ask)` gravada pelo tick, ou coluna `closed_at` em `order_book`; ou aceitar a foto atual como suficiente. (2) aporte de posição como transferência explícita de outro bot (com contrapartida em evento), ou aceitar só caixa e retirar o campo de posição da tela.
- **Decisão (2026-10-06, autor):** (1) **aceitar a foto atual**: a tela mostra só a situação atual da cotação (melhor compra e venda, spread, inventário), sem tabela de histórico diário. A métrica "% dos dias com bid+ask" é diagnóstico do admin, não afeta o jogador nem o preço, e gravá-la mudaria o motor e o custo por tick. (2) **aporte só de caixa**: o campo de posição sai da tela da N.15, já que o float está 100% distribuído e o aporte de posição quase sempre devolve `409`. O texto das tarefas N.14 e N.15 foi ajustado no backlog.
- **Status:** resolvido

### 044 · Catálogo do painel: deslistar ativo, ciclo de relatório por empresa e ETF sem Market Maker (N.12 e N.13)

- **Local:** `engine/internal/domain/catalogadmin/` (campos editáveis), `engine/internal/domain/assetprovision/` (o que o cadastro provisiona) e o texto das tarefas N.12 e N.13
- **Origem:** implementação da N.12 e da N.13 (PR 11 da Fase N), 2026-10-05
- **O que é:** três pontos em que o texto das tarefas pede mais do que o modelo sustenta hoje. (1) **Deslistar**: a N.13 diz "só deslistar (N.9 pausa permanente + `delisted_at`)". Não há coluna `delisted_at` e criá-la exige decidir o que o usuário vê de um ativo deslistado (some da lista e do detalhe? segue visível só pra quem tem posição? o que acontece com a posição e com a ordem em repouso?). Hoje o painel só tem a pausa de negociação por ativo (N.9), que impede operar mas deixa o ativo visível. (2) **`report_frequency_days` por empresa**: a N.12 cita o campo como exemplo de editável, mas a spec 3.3.1 fixa um ciclo global de 91 dias e o gatilho de evento macro, o FII e o ETF usam a constante, então editar por empresa desalinharia o dia de relatório do evento do dia em que a empresa divulga. Ficou somente leitura. (3) **ETF novo sem Market Maker**: o ETF criado pelo painel, como o do seed, nasce sem cotas e sem cobertura; a liquidez só vem quando o Participante Autorizado cria cotas, então o critério "aparece com cotação de Market Maker" só vale pra ação e FII.
- **Por que não foi corrigido:** (1) é escolha de comportamento do produto, não de código; (2) mudar o ciclo por empresa contraria uma decisão registrada na spec; (3) cobrir ETF com Market Maker muda o modelo de liquidez do ETF (a proposta de ETF usa NAV e Participante Autorizado, não book de bot).
- **Opções:** (1) `delisted_at` em `assets` com a regra de visibilidade escolhida, ou manter só a pausa de negociação. (2) manter o ciclo global, ou o ciclo por empresa com o gatilho de evento macro lendo o valor de cada empresa. (3) manter, ou um Market Maker específico de ETF cotando ao redor do NAV.
- **Decisão (2026-10-06, autor):** confirmado o que foi implementado. (1) **sem deslistar**: fica só a pausa de negociação por ativo (N.9), sem `delisted_at`, porque deslistar exigiria regras novas de visibilidade, de posição e de ordem em repouso. (2) **ciclo de relatório global** de 91 dias (spec 3.3.1), `report_frequency_days` segue somente leitura. (3) **ETF sem Market Maker**: a liquidez vem do Participante Autorizado e do NAV; o critério "cotação de Market Maker" da N.13 vale só para ação e FII. O texto da N.12 e da N.13 foi ajustado no backlog.
- **Status:** resolvido

### 034 · A compra de ações libera na lição do ticker, antes de a trilha ensinar ordens, corretora e custos (RC.4.3)

- **Local:** `backend/src/db/seedLessons.ts` (lição `stableKey` `2.3`, `unlocksKeys: ['asset:acao']`)
- **Origem:** reordenação da Trilha 2 (RC.4.3). O ticker passou a ser a 2ª lição (antes do IPO), e a lição "B3, corretora e ordens" a 4ª; o desbloqueio de `asset:acao` continuou na lição do ticker.
- **O que é:** o jogador pode comprar ações depois de aprender só o que é ação e o ticker, sem ainda ter visto ordem a mercado x limite, spread, liquidez e custos. Mover o desbloqueio para a lição de ordens faria quem já concluiu o ticker perder o acesso até concluir a nova (regressão para quem já está na trilha).
- **Opções:** (a) manter (a compra libera cedo, as ordens vêm logo depois); (b) mover o desbloqueio para a lição de B3 e ordens, e dispensar dela quem já concluiu a do ticker (migração com N.24); (c) manter na lição do ticker, mas mostrar um aviso curto de ordem a mercado x limite na tela de compra.
- **Status:** aberto (implementado com (a))

### 035 · Duas migrations do engine com o mesmo número `000040` nas pilhas ainda não mescladas (RC.6.1)

- **Local:** `engine/internal/infra/db/migrations/000040_clean_visible_catalog_text.*` (RC.1.4) e `000040_tick_runs_and_scheduler_control.*` (Fase N, N.3/N.4/N.6)
- **Origem:** rodar o teste de integração do `CalendarRepository` (RC.6.1) num Postgres descartável: `Migrate` falha com `duplicate migration file: 000040_...` nesta branch, que empilha as duas séries. A `main` ainda não tem nenhuma das duas.
- **O que é:** as pilhas RC e Fase N foram criadas em paralelo e cada uma pegou o próximo número livre. Quem aplicar as duas no mesmo banco (ou subir o `engine` com as duas) tem o `golang-migrate` recusando a pasta inteira. O teste de integração do calendário só rodou movendo uma delas para fora, temporariamente.
- **Por que não foi corrigido na hora:** renumerar uma delas (por exemplo, a de limpeza de texto para `000043`) é mecânico, mas quem já aplicou a `000040` num banco de dev ficaria com o histórico dessincronizado, e a ordem de merge das pilhas é decisão do autor.
- **Opções:** (a) renumerar a `000040_clean_visible_catalog_text` para o próximo número livre antes de mesclar a pilha RC (ajustando bancos de dev que já a aplicaram); (b) renumerar a da Fase N; (c) mesclar uma pilha antes e renumerar a outra no rebase.
- **Status:** resolvido (2026-10-07, RC.7.6): opção (a), `000040_clean_visible_catalog_text` renumerada para `000049` (idempotente, só UPDATEs de texto); `docker compose up` subiu o engine com as duas séries. Bancos de dev que já tinham a antiga `000040` da série RC precisam de `UPDATE schema_migrations`/reaplicação (a 000049 é idempotente).

### 036 · JCP e imposto sobre dividendos não existem no motor, só nas lições (RC.6.5, D9)

- **Local:** `engine/internal/domain/tick/tick.go` (geração de `dividend_events`) e `dividend_events` (sem coluna de natureza do provento)
- **Origem:** análise do calendário (`revisao-trilhas-anexos/analise-calendario.md`, seções 2 e 3.7) e decisão D9 do backlog de revisão, 2026-10-03.
- **O que é:** na vida real, parte dos proventos de ações vem como JCP (retenção na fonte de 15%) e a Lei 15.270/2025 passou a tributar dividendos de grande valor. O motor paga todo provento como dividendo isento: não há natureza `dividend|jcp`, retenção nem imposto sobre dividendos. As lições explicam o tema, mas o calendário e o extrato mostram sempre o valor cheio.
- **Por que não foi corrigido:** modelar IR retido muda o valor creditado, o extrato e o `estimated_amount` do calendário, e a decisão D9 foi manter isso fora do motor por ora (só nas lições).
- **Opções:** (a) manter assim (lição explica, motor simplifica; o bloco "Na plataforma" diz isso); (b) coluna `dividend_events.kind = dividend|jcp` com retenção de 15% no crédito e no valor estimado do calendário; (c) (b) mais o imposto sobre dividendos acima do limite da Lei 15.270/2025.
- **Status:** aberto (implementado com (a))

### 037 · Instante do snapshot de quem recebe o provento: data-com real x geração do evento (RC.6.5, D10)

- **Local:** `engine/internal/domain/tick/tick.go` (`dividend_event_recipients`) e `engine/internal/domain/marketcalendar/calendar.go` (`entitlement`)
- **Origem:** análise do calendário (3.7 itens 2 e 3) e decisão D10, 2026-10-03: data-com real, com snapshot dos elegíveis na data-ex.
- **O que é:** hoje o snapshot é tirado quando o evento de provento é gerado, não na data-ex; o calendário já trata a data-ex passada sem snapshot como "sem direito" e estima antes dela. Enquanto a RC.6.11 (declaração separada e snapshot na data-ex) não entra, quem compra entre a geração e a data-ex pode ver uma estimativa que o snapshot depois não confirma. Também falta definir a tolerância do primeiro ciclo irregular no cutover do escalonamento (item 3 da análise) e os pesos anual/semestral por setor (item 4, vão para `calibracao-calendario-proventos.md`, RC.6.5b).
- **Por que não foi corrigido:** a mudança de instante altera quem recebe cada provento, e a entrega ordenada é a RC.6.11; o texto da lição "Na plataforma" deve descrever o comportamento vigente.
- **Opções:** (a) manter o snapshot na geração até a RC.6.11 e documentar na lição; (b) antecipar o snapshot na data-ex só para os proventos novos, com cutover por dia; (c) (b) retroativo, o que contraria o event sourcing (proventos já pagos ficam intactos).
- **Status:** Resolvido (2026-10-06, RC.6.11): proventos declarados antes da data-ex ganham o snapshot no tick da data-ex (opção (b), só para os novos; os já pagos ficam intactos). Falta só a tolerância do primeiro ciclo irregular no cutover, coberta pelo dia de corte (`schedule_cutover_day`).

### 038 · Copom e eventos macro aparecem como "No mercado", mesmo para quem tem renda fixa pós-fixada (RC.6.5)

- **Local:** `engine/internal/domain/marketcalendar/calendar.go` (relevância de `copom` e `macro_event`) e `frontend/src/components/organisms/MarketCalendarPanel`
- **Origem:** análise do calendário (3.7 item 1) e RC.6.1/RC.6.4.
- **O que é:** só fato com consequência direta no saldo do usuário é "Para você". Uma reunião do Copom muda o rendimento de quem tem Tesouro Selic, CDB pós-fixado ou a poupança, mas hoje é sempre "No mercado" (aparece só em "Todos"); evento macro setorial também não marca quem tem ativo do setor. Quem usa só "Meus" não vê o Copom que mexe na sua carteira.
- **Por que não foi corrigido:** "mine" para Copom e macro exige regra de produto (qual posição conta, se vale para o evento macro agendado sem entregar o veredito, RF16) e a v1 decidiu por `market`.
- **Opções:** (a) manter (informação macro vai em "No mercado"); (b) Copom `mine` para quem tem posição pós-fixada ou Selic; (c) (b) mais macro setorial `mine` para quem tem ativo do setor, sem texto de veredito.
- **Status:** aberto (implementado com (a))

### 039 · Abrir por URL uma lição ainda bloqueada mostra só um aviso de erro, sem o `LockedGate` (QA ponta a ponta, 2026-10-07)

- **Local:** `frontend/src/pages/Lesson/index.tsx` (estado `lessonQuery.isError`) e `GET /lessons/:id` (404 para bloqueada)
- **Origem:** teste ponta a ponta do backlog de revisão com um usuário novo abrindo `/trilha/<id da 2.1>` direto.
- **O que é:** o backend responde 404 para lição bloqueada (de propósito, não revela se existe) e o player mostra "Não foi possível carregar esta lição agora. Ela pode estar bloqueada ou não existir." As telas de Mercado, Calculadora e Notícias usam o `LockedGate` com CTA para a lição que libera; o player não.
- **Por que não foi corrigido:** trocar o aviso pelo `LockedGate` exige decidir se o player pode usar o status `locked` que já vem em `GET /lessons` (sem expor nada novo) e qual CTA mostrar (a lição disponível mais próxima, respeitando a regra de nunca apontar para lição não alcançada). Foi corrigido só o mecânico: o 404 deixou de ser repetido 3 vezes, que mantinha "Carregando lição…" na tela por ~7 segundos.
- **Opções:** (a) manter o aviso; (b) usar `status: 'locked'` da lista e renderizar `LockedGate` (variante `screen`) com CTA para a próxima lição disponível.
- **Status:** ✅ resolvido (2026-10-07, opção (b)): `pages/Lesson` usa o `status: 'locked'` de `GET /lessons` e renderiza `LockedGate` (variante `screen`) com CTA para a primeira lição `available`; lição inexistente continua com o aviso de erro.

### 040 · Ranking por renda fixa/variável exclui quem não tinha a classe no início da janela (6.8.3)

- **Local:** `backend/src/modules/ranking/application/useCases/getRanking.ts` (`scoreByProfitability`, ramo `baseline[field] === 0`)
- **Origem:** dúvida do autor em 2026-10-08: usuários com +5,7% no geral não aparecem ao filtrar por renda fixa ou variável.
- **O que é:** o critério de classe compara o valor da classe no início da janela com o valor atual e exclui quem tinha zero na classe no início (para não mostrar um 0% enganoso). Quem investiu na classe só depois do início da janela, e quem criou a conta no meio da janela (baseline = depósito inicial, sem posição), nunca entra nesse ranking, mesmo com posição e rentabilidade hoje. Com poucos usuários e janela semanal/mensal, a lista costuma ficar vazia.
- **Por que não foi corrigido:** mudar a base de cálculo (custo investido em vez de valor no início, por exemplo) é regra de produto sobre o que "rentabilidade da classe" significa.
- **Opções:** (a) manter e mostrar um texto de lista vazia explicando o motivo; (b) base = custo investido na classe dentro da janela (qualquer posição atual entra); (c) incluir quem tem posição hoje, usando o valor da primeira compra como baseline.
- **Decisão do autor (2026-10-08):** (1) o ranking não é em tempo real: snapshot recalculado a cada 3 horas, com histórico curto (**feito**, branch `ranking-snapshot-3h`: tabela `ranking_snapshots`, job `ComputeRankingSnapshotUseCase`, `GET /ranking` lê o snapshot e informa `updatedAt`); (2) critério por classe passa a usar a rentabilidade sobre o custo investido na própria classe (mesma lógica do geral), em vez do valor no início da janela; (3) renda fixa passa a ser valorizada pelo valor atual (marcação a mercado, inicialmente **bruto** de IR; trocado por líquido em 2026-10-09, achado 042) no patrimônio e no ranking, extraindo a conta do resgate do motor para uma função pura reaproveitada. Também levantado: o patrimônio de renda fixa hoje é a custo, então o ranking de renda fixa nunca mostra rendimento até o resgate.
- **Status:** parcial: (1) feito; (2) feito (`classReturnPct`, fluxos por classe no replay, 2026-10-08); (3) feito para o ranking (2026-10-08): motor `?valuation=true`, valor de hoje (líquido de IR desde 2026-10-09), começo da janela por amostras do job (decisão do autor); patrimônio mostrado na carteira/UI, conquistas, perfil e painel admin seguem a custo (ainda sem decisão de mudar) (ver análise de viabilidade desta sessão: (2) via replay por classe no backend; (3) mexe no motor Go e muda o patrimônio de quem tem renda fixa)

### 041 · Usuário novo some do ranking (e da própria posição) até a próxima rodada do snapshot (review do PR 107, 2026-10-09)

- **O que acontece:** como `GET /ranking` lê só o snapshot de até 3 h atrás, quem se cadastra depois da última rodada não aparece em nenhum critério e recebe `requestingUserPosition: null`, inclusive no critério Nível. Medido ao vivo: 4 usuários criados e com ordens executadas ficaram com posição `null` nos 5 critérios até o job rodar; depois apareceram corretos. O mesmo vale para amigo recém-aceito/cadastrado no escopo Amigos.
- **Por que não foi corrigido:** é regra de produto saber se o usuário recém-chegado deve ver "Você aparece na próxima atualização" ou se a posição dele deve ser calculada na hora.
- **Opções:** (a) manter e mostrar na tela uma mensagem explicando que a posição entra na próxima atualização; (b) calcular ao vivo só a linha do próprio usuário e encaixar no snapshot; (c) disparar uma rodada extra do job no cadastro.
- **Decisão do autor (2026-10-09):** opção (b). Quem se cadastrou depois da última rodada tem a própria linha calculada ao vivo e encaixada no snapshot; a tela de Classificação avisa isso.
- **Status:** ✅ resolvido (2026-10-09): `GetRankingUseCase.load`/`scoreOwnRow`, com testes.

### 042 · Resgate de renda fixa dentro da janela entra líquido de IR, a posição mantida entra bruta (review do PR 107, 2026-10-09)

- **O que acontece:** o valor de hoje da renda fixa no ranking é bruto de IR (decisão do autor), mas `disinvestedProceeds` de um resgate é o valor líquido creditado. Resgatar dentro da janela faz o IR sair do ganho da classe; manter a posição não. Resgatar um título com lucro rende menos pontos no ranking do que manter o mesmo título.
- **Por que não foi corrigido:** exige decidir se o ranking deve ser líquido de IR dos dois lados ou se o resgate deve ser contabilizado pelo valor bruto. Não foi exercitado ao vivo (resgate no mesmo dia simulado não gera lucro nem IR).
- **Opções:** (a) manter e documentar; (b) valorizar a posição mantida pelo `net_value` (já devolvido pelo motor); (c) guardar o bruto do resgate nos fluxos.
- **Decisão do autor (2026-10-09):** opção (b), líquido de IR dos dois lados, revertendo o "bruto de IR" da decisão de 2026-10-08; a tela de Classificação avisa que a renda fixa entra descontado o IR.
- **Status:** ✅ resolvido (2026-10-09): `engineCurrentAccountStateReader` soma `net_value`; amostras de começo de janela gravadas antes da mudança ficam em bruto até a próxima virada de semana/mês.

### 043 · Vínculo do Google por e-mail sem verificar o e-mail (pré-sequestro de conta) ✅, achado na análise do gateway de e-mail (2026-10-09)

- **Local:** `backend/src/modules/auth/application/useCases/loginWithGoogle.ts` (casamento por `findByEmail`) e `backend/src/modules/auth/infrastructure/google/googleIdentityProviderAdapter.ts` (não lê `email_verified`); `RegisterUserUseCase` não confirma o e-mail.
- **O que acontece:** alguém se cadastra com o e-mail de outra pessoa e uma senha própria; quando a vítima entra com o Google, a identidade dela é vinculada à conta do atacante, que ainda conhece a senha.
- **Por que não foi corrigido:** a correção completa depende de verificação de e-mail (não existe envio de e-mail hoje) e de decidir o que fazer com a senha local de uma conta não verificada ao vincular.
- **Opções:** (a) recusar o vínculo se a conta local não estiver verificada; (b) vincular e zerar a senha local, só com `email_verified` do Google; (c) manter.
- **Recomendação (D3 em `.claude/plano-gateway-email.md`):** (b). Entra na tarefa EM.3.2 do plano.
- **Status:** ✅ resolvido (2026-10-10, EM.3.2): `LoginWithGoogleUseCase` só vincula conta local com `email_verified` do Google; conta local não verificada tem a senha zerada, as sessões encerradas e o e-mail marcado como verificado. Teste do pré-sequestro em `loginWithGoogle.test.ts`.

### 044 · O que é "conquista rara" no e-mail de conquista (EM.7.2, E14)

- **Local:** `backend/src/modules/achievements/domain/rarity.ts` (`RARE_MAX_HOLDER_SHARE = 0.1`, `RARE_MIN_POPULATION = 20`).
- **Origem:** o backlog do e-mail pede aviso de "conquista rara desbloqueada", mas o catálogo não tem o conceito de raridade em nenhum documento.
- **O que foi feito (provisório):** rara = no máximo 10% dos jogadores ativos (usuário comum, ativo, não anonimizado) a têm, contando quem acabou de desbloquear, e só com 20 ou mais jogadores. Medido ao vivo com 23 jogadores: "Formado na Trilha", "Primeira Operação" e "Voltou pra Revisar" contam como raras, porque cada uma tem 1 dono.
- **Por que isso pode estar errado:** a raridade é dinâmica, então no começo da vida do produto quase toda conquista é "rara" para quem a ganha primeiro, mesmo as fáceis (Primeira Operação), e deixa de ser quando a base cresce. O e-mail diz "poucas pessoas têm", o que é verdade no momento do envio, mas pode soar exagerado.
- **Opções:** (a) manter a regra dinâmica; (b) marcar no catálogo (campo `is_rare` ou `rarity`, editável no painel de conquistas) quais conquistas são raras de verdade, independente da base; (c) combinar: marcada como rara no catálogo **e** abaixo do limite.
- **Status:** ✅ resolvido (2026-10-11, decisão do autor: opção (b)): só vale a marca do catálogo. Coluna `achievements.is_rare` (migração `0048`), editável no painel de conquistas (`PATCH /admin/gamification/achievements/:id` com `is_rare`, botão "Marcar como rara"), e a regra dinâmica de 10% dos jogadores foi removida (`rarity.ts`, `AchievementRarityReader` e adapter apagados). Ponto de partida marcado pela migração e pelo seed, editável: *Fiel*, *Formado na Trilha*, *Grande Investidor* e *Trilha Impecável* (escolha minha, as quatro mais difíceis; troque no painel se discordar). Conquista criada pelo painel nasce não rara e se marca depois.

### 045 · Regras do lembrete de sequência em risco por e-mail (EM.7.3)

- **Local:** `backend/src/modules/notifications/domain/engagement/streakReminder.ts` (`MIN_STREAK_FOR_REMINDER = 3`, janela 17h a 19h59 de Brasília) e a variável `EMAIL_STREAK_REMINDER`.
- **Origem:** o backlog descreve o lembrete (opt-in, teto de 1 por dia, tom de convite) mas não dá a sequência mínima, o horário, nem diz se ele nasce ligado, e o plano manda medir cancelamento e reclamação do resumo semanal antes.
- **O que foi feito (provisório):** (1) o job nasce **desligado** e só liga com `EMAIL_STREAK_REMINDER=on`, para honrar o "medir antes"; (2) só quem tem sequência de 3 dias ou mais (1 ou 2 dias não é algo a manter); (3) janela da tarde, 17h a 19h59 de Brasília, porque o dia da sequência é em UTC e termina às 21h de Brasília (o e-mail diz isso com todas as letras); (4) o teto de 1 por dia vale só para este lembrete, não é compartilhado com o resumo semanal nem com os avisos de salário e conquista.
- **Opções:** ligar por padrão depois de olhar as métricas (cancelamento, reclamação abaixo de 0,1%, abandono da trilha); mudar a sequência mínima; ou um teto único de 1 e-mail de engajamento por dia somando os quatro tipos.
- **Status:** ✅ resolvido (2026-10-11, decisão do autor): mantidas as regras (sequência mínima 3, janela 17h a 19h59, teto de 1 por dia só dele) e o lembrete **passa a nascer ligado**; `EMAIL_STREAK_REMINDER=off` desliga. O plano de medir cancelamento e reclamação do resumo semanal antes (EM.7.1) vira acompanhamento depois de ligar, não pré-requisito: se piorarem, desligue pela variável.

### 046 · Decisões de produto abertas da monetização (backlog-monetizacao.md)

- **Local:** `.claude/backlog-monetizacao.md` (MO.1.1, MO.5.1, MO.5.4, MO.6.2) e `.claude/estrategia-monetizacao.md`.
- **Origem:** ao fechar os planos (2026-10-10) ficaram perguntas que nenhum documento responde.
- **Perguntas:** (1) **limites das ligas e duelos** (quantas ligas por assinante, quantos membros, regra de pontuação livre ou de catálogo, duração do duelo); (2) **catálogo inicial de cosméticos** (quais itens, quais visíveis para os outros); (3) **parâmetros da Assembleia de Acionistas** (mínimo de votantes, duração, faixa de efeito por indicador, cooldown, nível mínimo para o crédito mensal, tamanho do catálogo de pautas); (4) **preço final** nas faixas de BRL das lojas (19,97 pode não existir); (5) ~~checkout web~~ **decidido em 2026-10-10 (M12):** Stripe conectado ao RevenueCat, sem Pix, só recorrente no cartão; (6) **recompensa da indicação** (quantos dias de PRO, teto por pessoa).
- **Decididas em 2026-10-10:** (1) **ligas:** até 3 ligas ativas por assinante, até 20 membros cada, pontuação fixa por rentabilidade percentual na janela semanal ou mensal do ranking; **duelos:** 1 contra 1, 7 dias, vence a maior rentabilidade percentual, empate é empate, quem não opera no período perde por abandono, XP só por participar (nunca por vencer), até 3 duelos simultâneos por pessoa. (2) **cosméticos:** catálogo enxuto e só visível aos outros: selo PRO, 6 molduras de avatar e 8 títulos; sem temas; itens como dado no banco. (4) **preço:** 19,90 mensal e 199,90 anual (faixas redondas das lojas, mesmo valor nas três plataformas; a tela calcula o desconto do preço real).
- **Decididas em 2026-10-10 (parte do item 3):** a assembleia abre **2 dias depois do balanço**, fica aberta **7 dias**, o efeito começa **1 dia depois de fechar**, e o crédito mensal de voto exige **nível 3** e e-mail verificado. Todos como configuração, ajustáveis na MO.6.8. Seguem em aberto, para a calibração da MO.6.9: mínimo de votantes (ponto de partida 3), faixas de efeito por indicador, cooldown e tamanho do catálogo de pautas.
- **Decidido em 2026-10-11:** (3) os parâmetros da Assembleia (mínimo de votantes, faixas de efeito, cooldown, tamanho do catálogo) **saem do teste ponta a ponta da MO.6.9**: os pontos de partida ficam e o relatório propõe os valores finais. (6) **indicação:** a recompensa de dias de PRO para os dois não fazia sentido (quem entra já vira PRO ao assinar), então: qualquer pessoa indica por link, **sem teto**; vale a conta criada pelo link que **verifica o e-mail** (Google já vem verificado); a recompensa é **só de quem indica**, escalonada em conquistas e dias de PRO (5 indicações = 1 semana, 20 = mais 1 semana, 50 = mais uma, e assim por diante). Registrado na MO.7.2 do `backlog-monetizacao.md`, que ainda precisa de um freio contra conta descartável (o gatilho é só verificar o e-mail) aprovado pelo autor antes de implementar.
- **Status:** ✅ resolvido na parte de decisão; (3) segue sendo calibrado na MO.6.9 e (6) está pronto para a MO.7.2, sem iniciar.

### 047 · Teto de ligas das quais uma pessoa pode participar (MO.5.2)

- **Local:** `backend/src/modules/leagues` (`RespondToLeagueInvitationUseCase`).
- **Origem:** a decisão de 2026-10-10 limita **criar** (3 ligas abertas por assinante) e o tamanho (20 pessoas), mas nada diz quantas ligas alguém pode **integrar**. Hoje não há teto: um usuário gratuito pode aceitar convites de qualquer número de amigos.
- **Opções:** manter sem teto (o convite já exige amizade aceita, então o abuso é pequeno); ou um teto de participação (ex.: 10).
- **Status:** ✅ resolvido (2026-10-11, decisão do autor): teto de **10 ligas ativas** por pessoa (`MAX_JOINED_LEAGUES_PER_USER`). `RespondToLeagueInvitationUseCase` recusa aceitar o 11º convite com `409` (`JoinedLeaguesLimitReachedError`); recusar e sair continuam livres, e convite pendente não conta. Documentado em `.docs/backend/leagues.md`. Sem trava de corrida: dois aceites simultâneos da mesma pessoa podem passar de 10 por um, o que não tem consequência de custo.

### 048 · Política de Privacidade não cita a medição do funil de conversão (MO.7.1), achado em 2026-10-10

O app agora grava eventos próprios de funil (`funnel_events`: quem viu um convite ao PRO, abriu os planos, iniciou a compra, assinou ou cancelou, com o ponto de origem). Não sai da plataforma e não tem valor nem patrimônio, mas é tratamento de dado de uso por pessoa identificada. **Decisão do autor:** incluir um parágrafo na Política de Privacidade (`/privacidade`) e definir por quanto tempo os eventos ficam (hoje, indefinidamente) e se `DELETE /me` deve apagá-los (hoje a conta é anonimizada e as linhas ficam ligadas ao id).

- **Status:** ✅ resolvido (2026-10-11, decisão do autor: parágrafo + 12 meses + anonimizar): `/privacidade` ganhou a linha "Passos de contato com o plano PRO" na tabela de dados e a retenção na seção 7; os eventos são apagados depois de 12 meses (`FUNNEL_RETENTION_MONTHS`, `PurgeOldFunnelEventsUseCase`, agendado uma vez por dia no `server.ts`); `DELETE /me` **não** apaga os eventos, porque a conta já é anonimizada (sem nome, e-mail, username nem senha) e o que resta dela não identifica ninguém, então não houve mudança de código na exclusão. Se a intenção era cortar também o `user_id`, é uma tarefa à parte (a coluna é `NOT NULL` e as contagens do funil usam `COUNT(DISTINCT user_id)`).

### 049 · Unidade dos prazos da Assembleia de Acionistas: dias simulados ou reais? (MO.6.3), achado em 2026-10-10

- **Local:** `backend/src/modules/assemblies` (`OpenDueAssembliesUseCase`, `planSchedule`) e `.docs/backend/assemblies.md`.
- **Origem:** a decisão "abre 2 dias depois do balanço, fica aberta 7 dias, efeito 1 dia depois de fechar" não diz se "dia" é simulado ou real. O balanço só existe em dia simulado, mas votar é um prazo vivido em tempo real. Implementado: o atraso de abertura em dias **simulados**, duração e atraso do efeito em dias **reais**.
- **Problema:** com `days_per_real_day` maior que 1 (hoje o Temporizador anda 5 dias simulados por dia real), 2 dias simulados equivalem a menos de 1 dia real e o efeito de um trimestre (cooldown de 90 dias simulados do motor) pode chegar antes de a pessoa ver o resultado.
- **Opções:** manter como está; ou converter tudo para dias reais (abrir quando passou N dias reais do balanço); ou tudo em dias simulados.
- **Status:** ✅ resolvido (2026-10-11, decisão do autor): **manter** as unidades (abertura em dias simulados, duração e efeito em dias reais); revisar na calibração (MO.6.9).

### 050 · Assembleia que abre com a empresa ainda em período de espera, e unidades do prazo da fila (MO.6.5), achado em 2026-10-10

- **Local:** `backend/src/modules/assemblies` (`OpenDueAssembliesUseCase`, `ProposeAgendaUseCase`) e `engine/internal/domain/corporategovernance` (`CooldownDaysLeft`).
- **Origem:** a MO.6.5 barra **propor e apoiar** quando a empresa está no cooldown de 90 dias simulados do motor, mas a **abertura** da assembleia não olha o cooldown (comportamento da MO.6.3): se a empresa mudou há pouco, a assembleia abre, a pessoa vota e o motor registra `skipped_cooldown` sem mudar nada, depois de a pessoa ter gasto um voto (ou crédito mensal) à toa.
- **Opções:** (a) manter (o resultado público já diz que não houve efeito); (b) não abrir a assembleia de empresa em período de espera e deixar o balanço passar, ou abrir só dentro da janela de recuperação se o cooldown acabar a tempo; (c) abrir, mas não consumir o crédito mensal quando o motor já avisou o cooldown.
- **Relacionado ao 049:** o prazo da fila (`ASSEMBLY_PROPOSAL_TTL_DAYS`, 30 dias **reais**) e o cooldown (90 dias **simulados**, hoje cerca de 18 dias reais a 5 dias simulados por dia real) têm unidades diferentes; com a decisão do 049 isso se alinha.
- **Status:** ✅ resolvido (2026-10-11, decisão do autor: opção (b)): `OpenDueAssembliesUseCase` consulta o cooldown da empresa no motor (porta `CompanyCooldownReader`, adaptador sobre `GET /governance/companies/{id}/standing` com o UUID nulo) e **não abre** enquanto houver dias de espera; a rodada seguinte tenta de novo, então se o cooldown acabar dentro da janela de recuperação (`ASSEMBLY_CATCH_UP_DAYS`) a assembleia abre, senão aquele balanço passa sem assembleia. Falha do motor conta como falha da empresa e repete. Testes no ciclo e `.docs/backend/assemblies.md` atualizados. A unidade do prazo da fila segue a decisão do 049.

### 051 · Pausa das assembleias, balanço que sai da janela e parâmetros que mexem em votação aberta (MO.6.8), achado em 2026-10-11

- **Local:** `backend/src/modules/assemblies` (`OpenDueAssembliesUseCase`, `AssemblySettingsService`, `domain/agendaTemplates.ts`) e o painel admin (`/admin/assembleias`).
- **Origem:** três pontos que a MO.6.8 deixou como comportamento padrão, sem decisão do autor.
- **(1) Balanço que passa da janela durante uma pausa.** A pausa impede abrir assembleia nova, e a abertura só olha balanços dentro da janela de recuperação (`ASSEMBLY_CATCH_UP_DAYS`, 7 dias simulados além da espera). Uma pausa longa (ou o painel esquecido pausado) faz o balanço sair da janela e **aquela assembleia nunca abre**, sem aviso. Opções: (a) manter, o painel já avisa na tela da pausa; (b) ao retomar, abrir também os balanços perdidos pela pausa (exigiria guardar o que ficou barrado); (c) limitar a duração da pausa por parâmetro (alerta depois de N dias vigente). Mesma família do 050 (abrir ou não fora do tempo certo).
- **(2) Parâmetros de voto que mudam com a votação aberta.** Só o quórum fica congelado na assembleia. Crédito mensal, nível mínimo do voto gratuito e XP de participação valem **no momento do voto**, então editar esses parâmetros no meio de uma assembleia muda as regras de quem ainda não votou. Opções: (a) manter (são regras da pessoa, não da pauta); (b) congelar também o nível mínimo e o crédito por assembleia (mais colunas em `assemblies`).
- **(3) Setor da pauta é texto livre.** O painel valida só o tamanho; um erro de digitação ("Varejo " ou "varejo") cria uma pauta que nunca é sorteada, porque o setor da empresa vem do motor. Opções: (a) manter, o painel sugere os setores já usados no catálogo (`datalist`); (b) lista fechada dos setores do motor (leitura do cadastro de empresas) e recusa de setor desconhecido.
- **Status:** ✅ resolvido (2026-10-11, decisão do autor: 1a, 2a, 3b): (1) mantido, o painel já avisa na tela da pausa; (2) mantido, são regras da pessoa e não da pauta; (3) o setor da pauta agora é **lista fechada** dos 6 setores do motor (`COMPANY_SECTORS` em `domain/agendaTemplates.ts`; setor desconhecido vira `400`; vazio vale para qualquer setor) e o painel usa um seletor. A lista espelha o enum `company_sector` do motor (spec 3.3.2) em vez de ler o cadastro de empresas: setor novo no motor exige somar à lista. Revisar (1) e (2) na calibração (MO.6.9) se a pausa longa virar problema real.

### 052 · Freio contra conta descartável na indicação e escada acima de 50 (MO.7.2), decidido em 2026-10-11

- **Local:** `.claude/backlog-monetizacao.md` (MO.7.2).
- **Origem:** o gatilho da indicação é só verificar o e-mail e a recompensa em PRO não tem teto, então dava para fabricar PRO com e-mails descartáveis.
- **Status:** ✅ resolvido (2026-10-11, decisão do autor): (1) **freio:** a indicação só conta quando a pessoa indicada **conclui a primeira lição** (além de verificar o e-mail ou entrar com Google); **sem limite por IP/dispositivo**. Risco aceito: um script paciente que conclua uma lição por conta ainda passa; observar no painel e revisar se aparecer abuso. (2) **escada:** 5, 20 e 50 indicações (1 semana de PRO cada), e acima de 50 **+1 semana a cada 50** (100, 150, 200...), como dado no banco. (3) **cosméticos por marco:** uma **conquista por marco e um título novo por marco**, nada de moldura nova.

### 053 · O catálogo de pautas só empurra os fundamentos para cima (MO.6.9), achado em 2026-10-11

- **Local:** tabela `agenda_templates` (migração `0043`) e `engine/internal/domain/corporategovernance`.
- **Origem:** o ensaio de calibração de 12 meses simulados (`tmp/relatorio-calibracao-assembleia.md`) mostrou que das 34 opções ativas, 33 têm efeito de sentido positivo (crescimento ou qualidade sobem) e 1 negativo. Toda decisão aprovada melhora a empresa; o mercado inteiro deriva para cima (crescimento médio +0,23 p.p., qualidade +2% em 12 meses). O texto "o que ganha, o que perde" não tem contrapartida na mecânica.
- **Opções:** (a) reescrever as pautas com troca real (um lado sobe uma métrica e baixa a outra) e acrescentar pautas, chegando a 25 ou mais; (b) manter e aceitar a deriva positiva (limitada pelo teto de 2 decisões por empresa por ano); (c) decaimento lento do fundamento de volta ao valor de cadastro.
- **Status:** decidido em 2026-10-11 (opção (a), com extensão): pautas com troca real, 28 ou mais, em vozes variadas, **e** assembleia que decide também o payout, a política de dividendo e o prêmio da PN, com efeito composto de até 2 efeitos por opção e declaração de dividendo adiada durante a votação. Virou a Fase F2 do `backlog-monetizacao.md` (MO.6.10 a MO.6.15); o ponto fecha na MO.6.15, depois da nova calibração.

### 054 · Recompra e emissão de ações como pauta da Assembleia (melhoria futura), registrado em 2026-10-11

- **Local:** `engine/internal/domain/catalog` (`OutstandingShares`), `corporategovernance`, bots de liquidez.
- **Origem:** ao ampliar as alavancas da assembleia (Fase F2), o autor deixou recompra e emissão de ações **de fora desta rodada**. Mexer em ações em circulação muda float, liquidez dos bots, lucro por ação, ETFs que contêm o ativo e posições de usuários.
- **Para quando voltar:** definir se a recompra cancela ações (reduz o float) ou vira ação em tesouraria, quem vende (a conta de uma contraparte técnica, nunca usuário), como fica o snapshot de acionistas e o dividendo por ação, e recalibrar. Hoje a pauta "Captar emitindo ações novas" do rascunho usa só o efeito em qualidade e deve ser reescrita sem prometer emissão.
- **Status:** adiado por decisão do autor (melhoria futura), sem tarefa aberta.
