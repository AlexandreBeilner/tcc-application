# Calibração de liquidez dos bots — pesquisa e medição (achado 009)

Pesquisa pedida a partir do achado 009 de `.claude/pontos-em-aberto-decisao-produto.md` ("capital/alocação
inicial do bot não é calibrado com dados reais"). Duas frentes: (1) referência real da B3 pra quanto um
mercado de ações negocia por dia, (2) medição do que o motor faz hoje contra essa referência. Pesquisa, diagnóstico
e, na seção final, a correção aplicada (opção A).

## Achado principal: a premissa do 009 estava errada

O 009 assumia que **capital insuficiente** dos bots era o que fazia o mercado parecer parado. A medição
mostra o contrário: o caixa agregado dos bots é enorme e **a liquidez morre por outro motivo**, um laço de
realimentação no teto de tamanho de ordem (`MaxOrderPctOfAverageVolumePct`, achado 005 parte B).

### Medição (stack isolado, seed limpo, 40 ticks sem nenhum evento macro, `SIMULATION_SEED=42`)

Volume diário negociado (unidades) por dia simulado:

| dia | VALR3 | BNDD3 | BNDD4 | TJLO11 | PAPL11 |
|---|---|---|---|---|---|
| 1 | 23.774.319 | 24.876.533 | 0 | 35.949 | 0 |
| 4 | 3.885.376 | 1.591.140 | 3 | 331 | 0 |
| 7 | 761.743 | 440.470 | 5 | 440 | 3 |
| 13 | 131.479 | 22.581 | 1 | 2 | 0 |
| 19 | 5.264 | 1.059 | 4 | 1 | 1 |
| 25 | 991 | 68 | 4 | 0 | 1 |
| 31 | 18 | 2 | 1 | 1 | 2 |
| 40 | 10 | 4 | 6 | 0 | 2 |

Float: VALR3 500M, BNDD3/BNDD4 300M cada, FIIs 1M cotas cada. No dia 40, o volume médio do período
(dias > 5) foi de **0,028% do float/dia** no melhor caso (VALR3) e praticamente zero nos outros; BNDD4,
PAPL11 e TJLO11 negociam de 2 a 18 unidades por dia.

Caixa dos bots: 1 Market Maker com R$ 116,4 bi + 19 outros com R$ 29,4 bi = **R$ 145,7 bi**, contra um
float total de ~R$ 110 bi (o preço inicial é R$ 100). Ou seja, o caixa dos bots é ~130% do valor do float,
muito além de qualquer necessidade, então mais capital não resolve nada.

### Causa raiz (mecânica, não de calibração de capital)

`tick.effectiveOrderSizeCeiling` (`engine/internal/domain/tick/rounds.go`) limita a ordem de compra a
`MaxOrderPctOfAverageVolumePct` (20%) da média do volume dos últimos `ChartistPriceHistoryDays` (5) dias. O
volume de hoje é resultado de ordens limitadas por esse teto, que por sua vez é 20% do volume dos dias
anteriores. Isso é uma **contração geométrica**: cada janela negocia uma fração do que a anterior negociou,
até cair no piso `MinOrderSizeCeiling = 1` (J.6), que só evita o zero absoluto, não a morte de fato do
mercado. A curva acima (24M → 3,9M → 760k → 130k → 5k → 342 → 18 → 10) é exatamente esse decaimento.

O J.6 tratou o sintoma mais grave (travamento em zero), mas deixou o piso em 1 unidade, sem relação com o
tamanho do ativo. Resultado prático pro usuário: depois de algumas semanas simuladas, comprar ou vender
uma quantidade normal (ex: 100 ações) não encontra contraparte, porque o book inteiro negocia dezenas de
unidades por dia.

## Referência real (B3)

| Métrica | Valor | Fonte |
|---|---|---|
| Giro do mercado à vista (volume anualizado / valor de mercado), jan/2025 | 136,8% | XP/Acionista, destaques operacionais B3 |
| Giro, jun/2025 | 134,6% | XP, destaques operacionais B3 |
| Volume médio diário (ADTV), jan/2025 | R$ 22,6 bi | idem |
| ADTV 2025 (até 22/dez) | ~R$ 18,5 bi (menor em 5 anos) | Guia do Investidor / Money Times |
| ADTV nov/2025 | R$ 29,05 bi | B3, DataWise+ |
| Valor de mercado médio, jan/2025 | ~R$ 4,138 tri | Acionista |
| Free float / valor de mercado | 56,2% | Bora Investir (B3), estudo Elos Ayta |
| Concentração: 10 ações mais negociadas | ~46,6% do volume (1º sem. 2026) | InfoMoney |
| Concentração: 5 mais negociadas | ~32% do volume | InfoMoney |
| Ações com liquidez que atrai estrangeiro (> US$ 5 mi/dia) | 94 de 460 | InfoMoney |

Conta que fecha (confere o giro publicado): R$ 22,648 bi × 252 dias ÷ R$ 4,138 tri = ~138%, coerente com
os 136,8% divulgados. Portanto:

- **Giro diário do mercado ≈ 135% ÷ 252 ≈ 0,54% do valor de mercado por dia.**
- Sobre o free float (56%), isso é ~0,95% do float por dia.
- É uma **média do mercado**: a liquidez é muito concentrada, então o ativo típico pouco negociado fica
  bem abaixo disso e os líderes bem acima.

O simulador trata `outstanding_shares` como float negociável inteiro, então a referência mais próxima é
o giro sobre valor de mercado (~0,5%/dia), não sobre free float.

### Comparação

| | Fração do float por dia |
|---|---|
| Referência B3 (média de mercado) | ~0,5% |
| Motor, dia 1 (VALR3) | ~4,8% (10x acima, bursts de abertura) |
| Motor, dia 40 (melhor ativo) | ~0,000002% a 0,03% (média da janela) |

O motor não é "pouco capitalizado", ele **abre agitado demais e depois entra em coma**, nunca chegando ao
regime de ~0,5% ao dia.

## O que não foi encontrado

- Fonte pública confiável pro **percentual de caixa de fundos de ações brasileiros** (que justificaria o
  multiplicador de caixa 2,0/0,5 de `bot/cash.go`). A busca só retornou regulação de liquidez da ANBIMA/CVM,
  sem número. Como o caixa não é o fator limitante (acima), isso não bloqueia a correção, mas o
  multiplicador continua sendo um valor ilustrativo.
- Giro específico de FIIs (o motor tem só 2, com 1M de cotas cada). Não pesquisado.
- Participação de formador de mercado no volume de um papel: a B3 mede a eficácia por essa participação mas
  não publica um percentual agregado.

## Opções de correção (pra decisão do autor)

Recomendação: **(A)**.

- **(A) Piso do teto proporcional ao float.** Trocar `MinOrderSizeCeiling = 1` por um piso
  `MinOrderPctOfFloat × float` (ordem de grandeza a calibrar por simulação, mirando regime estável de ~0,3%
  a 0,7% do float/dia). O teto por volume continua existindo e continua barrando ordens gigantes, só nunca
  colapsa abaixo do tamanho que um ativo real absorve. Mudança pequena, local em `effectiveOrderSizeCeiling`,
  não mexe em assinatura de bot nem nos arquétipos.
- **(B) Trocar o laço por um alvo de giro.** Teto = alvo de giro diário (`~0,5% × float`) dividido entre
  bots/rodadas, sem depender do volume passado. Elimina a realimentação por completo, mas remove o efeito
  "mais volume gera ordens maiores" e mexe mais no motor.
- **(C) Perfil de liquidez por ativo.** Um alvo de giro diferente por ativo (líderes ~2%, cauda ~0,05%),
  imitando a concentração real (top 10 = 46,6% do volume). Mais realista, mas precisa de um campo novo no
  catálogo e de decisão de produto sobre quais ativos são "líquidos". Pode vir depois de (A).

Decisões que dependem do autor: (1) A, B ou C; (2) se todos os ativos partem do mesmo alvo de giro ou se já
distinguem líquidos e ilíquidos; (3) se vale reduzir o burst do dia 1 (~5% do float), que hoje vem do teto
inicial sem histórico (`recentVolume` vazio cai pro float inteiro).

## Fontes

- [XP, destaques operacionais B3 jun/2025](https://conteudos.xpi.com.br/acoes/relatorios/b3-b3sa3-melhoria-em-meio-a-cautela-destaques-operacionais-da-b3-para-junho-de-2025/)
- [Acionista, destaques operacionais B3 jan/2025 (giro 136,8%)](https://acionista.com.br/destaques-operacionais-da-b3-em-janeiro-de-2025-analise-completa-dos-resultados/)
- [Guia do Investidor, menor giro em cinco anos](https://guiadoinvestidor.com.br/mercado/b3-amarga-menor-giro-de-acoes-em-cinco-anos-e-acende-alerta-no-mercado/)
- [B3, ADTV nov/2025 (DataWise+)](https://www.b3.com.br/pt_br/noticias/volume-medio-diario-de-negociacao-no-mercado-a-vista-na-b3-atinge-r-29-bilhoes-alta-de-3-4-em-12-meses-revela-datawise.htm)
- [Bora Investir, free float recorde da B3](https://borainvestir.b3.com.br/colunistas/einar-rivero/o-free-float-recorde-da-b3-abre-espaco-para-uma-bolsa-mais-liquida-mas-esse-potencial-ainda-depende-do-investidor/)
- [InfoMoney, volumes da B3 e concentração](https://www.infomoney.com.br/mercados/b3-b3sa3-recupera-volumes-mas-bancos-miram-volatilidade-de-setembro/)
- [B3, Formador de mercado](https://www.b3.com.br/pt_br/antigo/produtos-e-servicos/empresas/aumento-de-liquidez/formador-de-mercado/)

Nota de precisão: os números vêm de resumos de páginas de terceiros obtidos por busca/leitura automática; o
valor de mercado de jan/2025 aparece como "R$ 4.138 bilhões" na fonte (erro de unidade, é R$ 4,138 tri, o que
fecha com o giro publicado). Conferir na fonte primária da B3 antes de citar no TCC.

## Decisão e implementação (2026-09-23)

O autor escolheu a **opção A** e descartou fixar um perfil de liquidez por ativo agora (opção C): a liquidez
real de uma ação depende de vários fatores, então um número fixo por ativo seria arbitrário. Pode ser
revisitado no futuro. Ativos mais e menos líquidos já aparecem naturalmente (ver FIIs abaixo), só que sem um
valor imposto.

Implementação: `tick.MinOrderPctOfFloat` e `minOrderSizeCeiling` em `engine/internal/domain/tick/rounds.go`;
`effectiveOrderSizeCeiling` usa o piso proporcional em vez do piso absoluto de 1 quando o float é conhecido.

### Calibração do valor (simulação de 60 dias, seed 42, sem eventos, banco novo por valor)

Média do volume diário como % do float, por janela de dias simulados (dia 1 excluído do regime):

| Piso (% do float) | VALR3 d21-40 / d41-60 | BNDD3 | BNDD4 | TJLO11 | PAPL11 |
|---|---|---|---|---|---|
| 0,02% | 0,033 / 0,026 | 0,021 / 0,020 | 0,025 / 0,017 | 0,011 / 0,012 | 0,016 / 0,009 |
| 0,05% | 0,073 / 0,065 | 0,057 / 0,049 | 0,069 / 0,044 | 0,030 / 0,031 | 0,040 / 0,016 |
| 0,1% | 0,151 / 0,119 | 0,105 / 0,093 | 0,134 / 0,088 | 0,068 / 0,065 | 0,071 / 0,041 |
| 0,2% | 0,310 / 0,285 | 0,180 / 0,133 | 0,232 / 0,155 | 0,117 / 0,120 | 0,150 / 0,081 |
| **0,4% (adotado)** | 0,523 / 0,475 | 0,401 / 0,308 | 0,491 / 0,289 | 0,231 / 0,254 | 0,341 / 0,123 |
| 0,7% | 0,575 / 0,403 | 0,496 / 0,274 | 0,649 / 0,241 | 0,464 / 0,487 | 0,435 / 0,224 |

Leitura: em todos os valores o volume deixa de decair (as duas janelas ficam na mesma ordem de grandeza),
e o volume médio diário fica em torno de 1x o piso, então ele controla o regime de forma quase linear até
~0,4%. De 0,4% pra 0,7% o ganho satura (d41-60 não sobe), então 0,4% é o menor valor que chega na faixa alvo
(0,3-0,7% do float/dia) sem inflar o tamanho máximo de ordem à toa.

Observação: FIIs (1M de cotas) ainda têm dias sem negociação (~14 de 40, em qualquer valor do piso),
porque poucos bots negociam FII por rodada, não por colapso. Não decai, só é esparso. Fica como está.
