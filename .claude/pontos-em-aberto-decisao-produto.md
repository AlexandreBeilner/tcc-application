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

## Resolvidos

_(vazio até o momento)_
