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

### 005 · Tamanho de ordem de bot sem teto contra o float — preço "trava" por semanas/meses simulados

- **Local:** `engine/internal/domain/bot/noise.go:84` e `engine/internal/domain/bot/marketmaker.go:116`
  (`maxQuantity := int(availableCash / price)`, sem nenhum teto relativo a `OutstandingShares`);
  causa raiz a montante em `engine/cmd/seed/main.go` (`bot.InitialCash`/`InitialAllocation`, tarefa
  B.2), que gera saldo de bot ordens de grandeza maior que o float de qualquer ativo individual.
  `engine/internal/domain/orderexecution/orderexecution.go:225` (`validateFloat`) também não ajuda
  aqui — só valida a soma de posição pré-negociação, nunca o tamanho da ordem recebida contra o
  float, então a ordem gigante é aceita como pendente sem nenhuma rejeição.
- **Origem:** teste de ponta a ponta desta sessão (2026-09-19) validando a Fase G
  (`backlog-motor-mercado-realista.md`, FII no motor real) além do caminho feliz já documentado nos
  Entregáveis de G.1-G.3 — não é um achado específico de FII, mas afeta diretamente a validade do
  critério de aceite de G.1 ("preço nasce de negociação real") sob operação sustentada.
- **O que é:** rodando `docker compose up` com os dados reais já seedados (bots com saldo acumulado
  de dividendos/trades ao longo de ~140 dias simulados de sessões anteriores) e avançando `POST
  /admin/tick` repetidamente, `TJLO11` e `PAPL11` (FII) tiveram o preço de fechamento **travado no
  mesmo valor por 14 e 33 dias simulados seguidos**, respectivamente (ex: `PAPL11` em exatamente
  `106.77` do dia 108 ao 140), mesmo com fills reais acontecendo em quase todo tick. Causa
  confirmada: uma única ordem limite gigante fica pendente no book (ex: bot Market Maker `...0001`
  com ordem de compra de `24.419.788` cotas de `TJLO11` — o float **inteiro** do ativo é
  `1.000.000` cotas, ou seja, a ordem sozinha é **24x maior que 100% do float que existe**) e
  absorve todo fill seguinte no mesmo preço até ser exaurida, o que nunca acontece dentro de um
  horizonte razoável. Levantamento no banco confirma que isso não é um caso isolado: de 1.864 ordens
  pendentes/parcialmente preenchidas no book hoje, 331 (≈18%) já excedem sozinhas 100% do float do
  próprio ativo, e o pior caso chega a 553x o float. A causa raiz é dupla: (1) o saldo dos 20 bots
  seedados já nasce/cresce desproporcional ao float de qualquer ativo individual (bot
  Market Maker `...0001` está com `R$ 104,8 bilhões` de saldo — soma de todos os bots é `R$ 139,7
  bilhões`, contra um float de 1M-ish cotas por ativo a poucas dezenas de reais cada); (2)
  `maxQuantity := int(availableCash / price)` em `noise.go`/`marketmaker.go` dimensiona a ordem só
  por caixa disponível, sem nenhum teto contra o float do ativo, e `orderexecution.validateFloat`
  não rejeita a ordem na entrada por tamanho absurdo (só existe pra proteger a soma pós-negociação).
  O sintoma (preço congelado por semanas) é exatamente o oposto do que G.1 buscou entregar ao tirar
  FII do GBM.
- **Por que não foi corrigido:** não é um bug mecânico de lógica isolada — a correção depende de um
  número de negócio sem valor confirmado em nenhum documento (qual fração do float um bot pode
  ofertar de uma vez? `.claude/proposta-motor-mercado-realista.md` não fecha isso) e/ou de recalibrar
  o dimensionamento de caixa inicial de bot (`bot.InitialCash`, tarefa B.2/8.1) pra ficar proporcional
  ao float em vez do multiplicador ilustrativo atual — os dois são escolhas de calibração, não uma
  correção de código óbvia. Também não é exclusivo desta fase (Ações `BNDD4`/`VALR3` já mostram o
  mesmo padrão desde a Fase D), então a decisão de onde consertar (dimensionamento de ordem, teto de
  aceite em `orderexecution`, ou recalibração de caixa de bot) é melhor tomada olhando o motor de bot
  como um todo, não só o pedaço que a Fase G tocou.
- **Opções:** (a) `noise.go`/`marketmaker.go` (e qualquer arquétipo futuro) capam `maxQuantity` a uma
  fração do float (`OutstandingShares`) do ativo, não só do caixa disponível; (b)
  `orderexecution.validateFloat`/`Submit` rejeita de cara (não só aceita como pendente) uma ordem cujo
  `Quantity` sozinho já excede o float total do ativo, independente de caixa; (c) recalibrar
  `bot.InitialCash`/`InitialAllocation` (seed, tarefa B.2) pra manter o caixa de bot na mesma ordem de
  grandeza do valor de mercado do float que ele pode efetivamente negociar, atacando a causa raiz em
  vez do sintoma. Provavelmente uma combinação de (a)/(b) com (c), não uma só.
- **Mitigação mecânica aplicada (2026-09-19, sem fechar o achado):** opção (a) implementada — a parte
  do achado que não dependia de nenhum número de negócio (nenhuma ordem pode ser maior que 100% do
  float, ponto matematicamente indiscutível, não uma calibração) foi corrigida: `capToFloat`
  (`engine/internal/domain/bot/marketmaker.go`) capa o lado de compra em `noise.go` (`DecideNoiseOrder`),
  `marketmaker.go` (`DecideMarketMakerOrders`) e `quantityForSide` (compartilhada por `chartist.go`/
  `fundamentalist.go`) contra `bot.DecisionInput.FloatCeiling` — o mesmo
  `orderexecution.Context.OutstandingShares` que `rounds.go` (`decisionInputFor`) já carregava, mas só
  lia dentro do `case ArchetypeFundamentalista` antes desta correção. Testado (`TestCapToFloat`
  table-driven, mais um teste por arquétipo confirmando que `availableCash` ordens de grandeza maior
  que o float nunca produz `Quantity > floatCeiling`, mais `TestRunIntradayRounds_
  QuantidadeDeCompraNuncaExcedeOFloat` cobrindo o wiring de ponta a ponta) e validado ao vivo via
  `docker compose up` contra os mesmos dados reais da auditoria: depois da correção, nenhuma ordem nova
  ultrapassou o float do próprio ativo (ex: `VALR3` capado em exatamente 250.000.000 = 50% de
  500.000.000, a fração `MaxPositionSizePct` do Market Maker aplicada sobre 100% do float, nunca mais
  sobre `availableCash/price` sem teto). `go build`/`go vet`/`go test ./...`/`golangci-lint run`
  (Docker, v2.12.2) verdes. **O que continua em aberto:** (1) as ordens gigantes já pendentes no book
  *antes* desta correção (ex: a ordem de 553.598.866 cotas de `TJLO11`) não foram limpas — não existe
  mecanismo de cancelamento/expiração de ordem no motor (achado novo desta mesma auditoria, fora do
  escopo desta correção: nenhum bot cancela a própria ordem anterior antes de recotar a cada rodada,
  então `order_book` cresce sem nenhum teto de tempo de vida — decisão de produto em aberto: ordens
  deveriam expirar no fim do dia simulado? o Market Maker deveria cancelar a cotação anterior antes de
  recotar?); (2) o teto de 100% do float ainda é gigantesco perto do que um único bot deveria
  razoavelmente ofertar de uma vez (`MaxPositionSizePct` já reduz isso pra bots com fração < 1, mas o
  Market Maker seedado usa 0.5 — uma ordem de 50% do float inteiro continua fora de qualquer
  microestrutura realista); (3) a causa raiz (opção c — caixa de bot desproporcional ao float, bot
  Market Maker com R$ 104,8 bilhões de saldo) não foi recalibrada. (1)-(3) continuam exigindo decisão
  de produto/calibração, por isso o achado segue aberto, não vai pra Resolvidos.
- **Status:** aberto (mitigado)

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
