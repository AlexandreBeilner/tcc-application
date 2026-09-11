# Proposta — Motor de mercado orientado a negociação real (não fechada)

> **Proposta, não decisão fechada** — mesma exceção da tabela de `CLAUDE.md`: redesenho do motor de precificação de Renda Variável (Ações, FIIs, ETFs), dos eventos macro e da relação Selic/IPCA, discutido depois que o autor revisou `tmp/relatorio-logica-mercado.md` (relatório do estado atual do `engine/`) e identificou que a precificação hoje é um modelo estatístico (GBM + multiplicadores de evento) sem relação real com oferta/demanda, float finito ou negociação — não simula de fato o que acontece na bolsa. Este documento registra a direção acordada ao longo da discussão; ainda não é backlog.

## 1. Diagnóstico que motivou a mudança

Ver `tmp/relatorio-logica-mercado.md` (seções 2–4 e 8) para o levantamento completo. Os pontos centrais que motivam este redesenho:

- **Preço não nasce de negociação.** Hoje o preço de qualquer ação/ETF/FII é gerado por um Movimento Browniano Geométrico (`equity/gbm.go`) mais multiplicadores de evento macro e "surpresa" de balanço — todos aplicados de forma determinística sobre o preço anterior, independentemente de qualquer ordem de compra/venda ter acontecido. Uma venda de usuário executa **ao** preço corrente, mas nunca **forma** o preço corrente.
- **Não existe float finito.** `outstanding_shares` (catálogo) hoje só serve de denominador de LPA/VPA — não é um teto real de quantas ações existem pra negociar. Ordem a mercado sem contraparte real é preenchida por "liquidez sintética" (contraparte ilimitada implícita, decisão confirmada em 2026-08-22, `orderexecution.go:12-23`).
- **Evento macro e balanço mudam preço instantaneamente**, via fórmula, não via reação de mercado — o usuário nunca vê o preço "descobrir" a notícia através de negociação, só um salto/degrau calculado.
- **ETF não replica índice de verdade** — é um ativo com GBM próprio (tratado como risk_class Conservador, nem tem risk_class real), sem qualquer mecanismo de arbitragem entre preço de mercado e valor patrimonial.
- **FII tem o mesmo problema do ETF** — GBM tratado como Conservador, sem relação com a saúde do fundo (vacância, patrimônio, indexador da carteira de papel).
- **Evento macro "misto" aplica um único sinal a todos os alvos** — não modela o caso didático real de "câmbio beneficia exportador e prejudica importador ao mesmo tempo".
- **Coeficientes de geração de fundamentos são ilustrativos**, não calibrados com nenhuma referência real de mercado.
- **Selic e IPCA simulados são dois processos aleatórios independentes** — o Copom simulado nunca reage à inflação simulada, ao contrário do mecanismo real de política monetária.
- **Não existe distinção real entre tipo de ação (ON/PN)** — `share_class` já existe no catálogo, mas é só um rótulo; nenhuma empresa hoje tem as duas classes simultâneas, e o dividendo/preço não diferencia uma da outra.

## 2. Renda Variável (Ações) — novo modelo de formação de preço

### 2.1 Princípio geral
O preço de um ativo passa a ser **sempre a última negociação executada** naquele ativo, nunca uma fórmula aplicada por cima. Nenhuma ordem executa contra contraparte sintética/ilimitada — toda execução casa contra uma ordem real (de usuário ou de bot) do lado oposto do book. Isso reverte a decisão de 2026-08-22 documentada em `orderexecution.go` (liquidez sintética); a tela de confirmação de ordem (4.7) precisa passar a lidar com a possibilidade de execução parcial ou "sem liquidez no momento" quando o book não tiver profundidade suficiente.

**Importante — a formação de preço não é exclusiva dos bots.** Qualquer negociação executada move o preço, seja usuário-usuário, usuário-bot ou bot-bot; o motor de matching não distingue quem está em cada ponta. Bots existem só pra garantir profundidade de book quando não há contraparte humana suficiente (o problema de liquidez com poucos usuários que motivou a proposta) — não são a única fonte de movimento de preço.

### 2.2 Float finito

`outstanding_shares` (ou equivalente) passa a ser o teto real de ações em circulação daquele ativo. A soma de todas as posições de todos os detentores (usuários + bots) nunca excede esse número. Isso exige popular a distribuição inicial do float no seed.

**Proposta de distribuição inicial (autor pediu para eu propor a melhor forma):**
- O float de cada ativo nasce **100% alocado a bots** no seed — nunca "solto" ou pertencente a ninguém — e só se redistribui pra usuários (e entre bots) conforme a negociação acontece, exatamente como um float real já existe e circula desde o IPO.
- A alocação entre bots não é uniforme — usa uma distribuição concentrada (tipo Pareto/lei de potência: poucos detentores grandes, muitos pequenos), que é o padrão real de qualquer ativo negociado (poucos grandes fundos/controladores, muitos acionistas pequenos). **Decisão confirmada:** o grupo de bots "Market Maker" (seção 2.3) recebe **40-60% do float**, o restante se distribui entre os demais bots de personalidade variada (fundamentalista/chartista/ruído) com pesos sorteados de uma distribuição exponencial/Pareto, normalizados para somar o restante do float.
- Cada bot recebe também um **caixa inicial** (saldo em `accounts`), não só posição — do contrário um bot fica sem munição pro lado comprador do book. O tamanho do caixa inicial correlaciona com o papel do bot: Market Maker recebe um caixa maior (precisa sustentar liquidez nos dois lados o tempo todo), bots direcionais recebem caixa proporcional ao tamanho de posição que a personalidade tolera (seção 2.3).
- Isso deve ser uma função pura e determinística por seed (`bot.InitialAllocation(assetID, totalFloat, seed) → []Holding`), testável como qualquer fórmula do domínio (`.claude/arquitetura-engine-go.md`) — mesmos parâmetros sempre geram a mesma distribuição inicial, sem precisar fixar números mágicos no seed manualmente por ativo.

### 2.3 Bots de liquidez

**Decisão confirmada:** bots são **contas reais** — mesma tabela `accounts`/`positions`, mesmo Event Sourcing, mesmo `orderexecution` que já existe — com uma flag `is_bot` (mesmo padrão já usado por `is_sandbox` em `catalog.Asset`). Isso evita um caminho de dados paralelo: o bot compra/vende exatamente como um usuário compraria, só que decidido por um motor de comportamento em vez de uma pessoa. Bots precisam ser filtrados do ranking e do sistema social (mesma lógica de exclusão que hoje qualquer feature social precisaria aplicar a contas não-humanas).

**Bot de liquidez opera nos dois lados do book, não é unidirecional.** Um bot mantém (ou é capaz de submeter) oferta de compra e de venda ao mesmo tempo — um evento macro/notícia desloca o *viés* (ex: mais agressivo vendendo, preço de compra mais baixo) sem zerar o outro lado; um bot puramente vendedor esvaziaria a própria posição e deixaria de prover liquidez, e um puramente comprador nunca teria contraparte pro lado de venda do book. O viés muda o equilíbrio entre os dois lados (spread, agressividade, tamanho), não elimina um deles.

#### 2.3.1 Modelo de decisão — pesquisa e recomendação

O autor pediu pra eu pesquisar a melhor forma de fazer o motor de decisão do bot funcionar, dado que ele reage a vários fatores (Selic, indicadores de empresa, eventos macro) e tem "nível de conhecimento" variável. A área que resolve exatamente esse problema é **simulação de mercado baseada em agentes** (agent-based computational finance) — duas referências centrais moldam a proposta abaixo:

- **Arquétipos heterogêneos de trader** (literatura de modelos tipo Lux-Marchesi/Franke-Westerhoff, revisada em modelos recentes de mercado artificial): traders se dividem em **fundamentalistas** (negociam com base numa estimativa de valor "justo" do ativo, convergindo o preço pra esse valor), **chartistas/momentum** (reagem só à tendência recente de preço, sem olhar fundamento nenhum, e por isso amplificam movimentos — inclusive gerando bolhas/euforia realistas quando muitos chartistas seguem um fundamentalista que já se moveu) e **ruído** (ordens aleatórias, representando o "resto do mercado" sem tese definida). Um bot real de mercado costuma ser uma composição ponderada desses três instintos, não um puro de cada. ([HackerNoon — How to Build an Agent-Based Market Simulator](https://hackernoon.com/how-to-build-an-agent-based-market-simulator))
- **Zero-Intelligence Traders com restrição de orçamento** (Gode & Sunder, 1993): um achado robusto e replicado é que traders **totalmente aleatórios**, desde que nunca comprem acima do que "podem pagar" nem vendam abaixo do que "têm" (restrição de orçamento/posição, não de racional econômica), já geram um mercado com alta eficiência alocativa — a eficiência vem muito mais da **estrutura do leilão contínuo** (o próprio `orderbook`/`orderexecution` que já existe) do que da inteligência dos participantes. ([Gode & Sunder — agentFin summary, Brandeis](https://people.brandeis.edu/~blebaron/classes/agentfin/GodeSunder.html))

Isso é uma boa notícia pro escopo de TCC: **não precisamos de um motor de decisão sofisticado em todo bot** — a maioria pode ser barata (perto de zero-intelligence, só com restrição de orçamento), e só uma minoria de bots "fundamentalistas" precisa realmente interpretar indicadores/Selic/eventos pra ancorar o preço no que a spec chama de fundamento. Isso mapeia diretamente na ideia que o autor já tinha (bot com "nível de conhecimento" variável) e na de "escopo" (bot que só entende de um recorte do mercado).

#### 2.3.2 Catálogo de personalidade proposto

Cada bot é definido por 4 dimensões independentes, combinadas:

1. **Arquétipo** (a estratégia-base da função de decisão):
   - **Fundamentalista** — estima um "preço justo" a partir de `company_fundamentals` (P/L, ROE, crescimento) e da Selic simulada (via lição 3.2.2: Selic alta reduz o valor justo de setores cíclicos mais que defensivos), e negocia na direção de convergir o preço de mercado a essa estimativa. É o único arquétipo que "lê" o evento macro/balanço diretamente (seção 2.5/3) — os outros dois só reagem ao preço que resulta dessa leitura.
   - **Chartista/Momentum** — só olha a série de preço recente (ex: variação das últimas rodadas/dias); compra se a tendência for de alta, vende se for de baixa, sem consultar fundamento nenhum. É o arquétipo mais barato de calcular e o que gera o efeito realista de "manada" seguindo o movimento que o fundamentalista já iniciou.
   - **Ruído (Zero-Intelligence com restrição de orçamento)** — ordem de compra/venda aleatória (lado, quantidade, preço-limite) dentro do que o caixa/posição do bot permite, sem opinião nenhuma sobre valor — papel de liquidez de base, barato de simular em massa (Gode & Sunder mostram que isso sozinho já sustenta um book razoável).
   - **Market Maker** — não tem viés direcional; mantém spread simétrico ao redor do preço corrente, sempre nos dois lados, prioridade em nunca deixar o book vazio. Recebe a maior fatia do float/caixa inicial (seção 2.2).
2. **Escopo de especialização** (a ideia do autor, "bot X só entende de renda fixa + mineradoras + petrolíferas"): **decisão confirmada — 85-90%** da atividade de cada bot fica dentro do seu conjunto de setores/`risk_class`/classes de ativo (o "que ele entende"), os **10-15%** restantes negociando fora do escopo — meramente pra evitar que ativos fora de cobertura fiquem sem nenhuma liquidez residual. O catálogo de bots deve cobrir todos os setores (os 6 já fixados na spec 3.3.2) e as 3 classes (Ação/FII/ETF) com sobreposição suficiente pra nenhum ativo ficar sem nenhum bot especializado.
3. **Nível de conhecimento** (escalar 0-1, só relevante pra arquétipo Fundamentalista): controla o quão perto a estimativa de "preço justo" do bot fica do valor que os indicadores realmente sustentam — um bot de conhecimento alto usa o conjunto completo de indicadores com pouco ruído; um de conhecimento baixo usa uma leitura parcial/mais ruidosa dos mesmos dados (ex: ignora um ou mais indicadores, ou aplica um erro maior em cima da estimativa). Isso implementa direto a ideia do autor ("bot com mais conhecimento investe melhor") sem precisar de arquétipos novos — é um parâmetro dentro do Fundamentalista. **Decisão confirmada:** esse nível é sorteado uma vez no seed e **fica fixo pra sempre** — bot não "aprende" nem melhora com o tempo (fica pra uma eventual fase 2, fora deste redesenho).
4. **Perfil de risco/agressividade** — tamanho de posição tolerado, ordem a mercado vs. limitada, largura de spread — já descrito na versão anterior desta seção.
5. **Tamanho do pool por ativo** — **decisão confirmada: 15-25 bots cobrindo cada ativo de Renda Variável** (Ação/FII/ETF), somando os 4 arquétipos — equilíbrio entre parecer um book líquido de verdade e o custo computacional de rodar 1-4 rodadas por dia (seção 2.4) vezes esse pool vezes todos os ativos.

O papel dos eventos macro (seção 3) e dos balanços (seção 2.5) entra **só na função de decisão do arquétipo Fundamentalista** — desloca a estimativa de "preço justo" daquele bot pro alvo afetado, proporcional ao nível de conhecimento e ao quanto o setor do evento cruza com o escopo de especialização do bot. Chartistas e bots de ruído nunca leem evento/balanço diretamente; eles só reagem ao preço que já mudou por causa dos fundamentalistas negociando — é assim que o movimento se propaga pelo book de forma organiquica, sem precisar ensinar a mesma lógica de notícia pra 4 arquétipos diferentes.

### 2.4 Cadência de negociação

**Decisão confirmada:** de 1 a 4 rodadas de negociação de bot por dia simulado, com **horário variável e não previsível** dentro do dia (não um cronograma fixo tipo "sempre às 10h/12h/14h/16h simuladas") — objetivo explícito do autor é impedir que a cadência vire algo gameável.

Proposta de implementação: o Temporizador, ao processar `tick.Advance` de um dia, sorteia (determinístico por seed do dia, mesmo padrão de reprodutibilidade já usado em todo o motor):
- **Quantas** rodadas esse dia terá — **decisão confirmada: enviesado pra 2-3 como "dia normal"**, com 1 e 4 rodadas sendo exceção mais rara (a distribuição exata, ex: pesos por valor, fica pra fase de calibração fina);
- **Quando** dentro do dia cada rodada acontece — sorteando N pontos (não igualmente espaçados) dentro do "expediente" simulado do dia, em vez de slots fixos.

Isso implica um "sub-tick" dentro da orquestração do Temporizador: o dia simulado continua avançando 1x por chamada do Temporizador (Selic, calendário de relatório etc. seguem no ritmo diário atual), mas dentro desse dia o motor roda N rodadas de decisão/matching de bot (mais qualquer ordem de usuário que tenha chegado nesse meio-tempo) antes de fechar o dia. `asset_quotes` (histórico diário) continua guardando o preço de **fechamento** — a última negociação da última rodada do dia —, mantendo a cadência de Selic/relatório/proventos igual à de hoje; as negociações intradiárias (todas as rodadas, não só a última) ficam registradas nos fills de `order_book`/posições, que já são a fonte de verdade transacional — se o produto quiser expor um gráfico intradiário (sparkline, linguagem visual "home broker" já documentada em `identidade-visual-padroes.md`), dá pra derivar isso dos fills sem precisar de uma tabela nova.

### 2.5 Papel dos balanços (fundamentos)
**Decisão confirmada:** o efeito de um balanço trimestral no preço vem **100% do comportamento dos bots reagindo**, nunca de uma fórmula de sensibilidade direta. `fundamentals.ReportSurprise`/`ReportDayPriceEffect` saem; no dia do relatório, os bots reavaliam a nova `company_fundamentals` contra sua própria expectativa e negociam de acordo — o preço muda porque a negociação pós-balanço muda, não porque uma fórmula aplicou um degrau. Mantém o valor pedagógico central já validado na spec ("o que move preço não é o resultado em si, é o resultado vs. expectativa") — só muda o mecanismo de transmissão, de fórmula pra negociação simulada. O papel dos eventos macro em si (efeito imediato de preço) é tratado à parte, na seção 3, porque a remoção da limitação de "sinal único" pede um desenho próprio.

### 2.6 Liquidez desigual entre ativos
Consequência natural do modelo, não precisa de tratamento especial: ativos com menos bots cobrindo ou menos volume de usuário terão book mais raso, spread mais largo e preço mais sensível a uma ordem grande — isso é o comportamento real de ações de baixa liquidez e deve ser deixado acontecer, não compensado artificialmente. Vale tanto para Ações quanto para FIIs e cotas de ETF (seções 4 e 5).

### 2.7 Sandbox — fora do escopo deste redesenho

**Decisão confirmada:** os ativos fictícios de sandbox (`sandbox.PriceScript`/`RateScript`, lições 1.7/2.3) **continuam 100% roteirizados, sem bot nenhum** — nenhuma mudança aqui. Isso já garante RNF08 (equidade pedagógica) trivialmente, e introduzir bot ali reabriria uma discussão de determinismo que a tarefa 4.11 já resolveu, sem ganho pedagógico correspondente.

### 2.8 Tipos de ação — ON (Ordinária) vs. PN (Preferencial)

**Diagnóstico (autor pediu análise):** `share_class` já existe no catálogo (`variable_income_assets.share_class`), mas hoje é só um **rótulo cosmético**. Conferi no código: `dividend.EquityValuePerShare` (`dividend.go:44-49`) divide o `net_income` do ciclo por `outstandingShares` sem nunca olhar `share_class` — o dividendo por ação é idêntico não importa a classe. E no seed atual (`cmd/seed/main.go:46-47`), `VALR3` (ON) e `BNDD4` (PN) são **duas empresas diferentes**, cada uma com uma única classe — nunca existe o caso real de uma mesma empresa com as duas classes negociando ao mesmo tempo, que é exatamente o que a lição 2.3 do currículo já promete ensinar ("final 3 = ON, final 4 = PN" pressupõe o aluno *ver* os dois tickers da mesma empresa lado a lado).

**O que diferencia ON de PN na vida real** (Lei das S.A., 6.404/76, arts. 15-17):
- **ON**: dá direito a voto em assembleia. A plataforma não tem mecânica de assembleia/voto hoje — o único esboço disso é a "Assembleia de Acionistas" cogitada (não fechada) em `estrategia-monetizacao.md` — então essa diferença não tem efeito funcional por enquanto.
- **PN**: sem voto (ou voto restrito), mas por lei (art. 17, reforma da Lei 10.303/2001) precisa ter **pelo menos uma** de três vantagens econômicas, definida no estatuto de cada empresa: (a) prioridade no recebimento de dividendo, (b) prioridade no reembolso de capital em liquidação, ou (c) **dividendo pelo menos 10% maior que o pago à ON** — a mais comum na prática, e a que vale simular por ser mensurável e já se conectar direto ao `dividend` package existente. Importante: os 10% são um **piso legal de uma das três rotas**, não um número universal travado — cada empresa real pode escolher outra rota, ou dar mais que o mínimo.
- No mercado real, as duas classes da mesma empresa costumam ter preço parecido mas não idêntico — um spread persistente entre elas (prêmio de controle na ON ou de liquidez na PN, varia por empresa). É um bom caso de uso natural pro book real da seção 2: duas ordens de livro separadas pra mesma empresa, preços que podem divergir organicamente da negociação.
- **Composição real do mercado hoje (pesquisado):** o Novo Mercado — segmento de listagem de governança mais alta da B3 — **proíbe PN completamente**, só aceita empresas 100% ON com tag-along de 100%, e tem ~190 empresas (2025), já uma fatia grande do total listado. A maior parte dos IPOs desde meados dos anos 2000 optou por esse segmento; ON+PN sobrevive principalmente em blue chips mais antigas (ex: bancos, Petrobras), listadas em segmentos que ainda permitem PN (Tradicional/Nível 1/Nível 2). O padrão real de mercado hoje é **ON-only sendo maioria**, com ON+PN como um caso legado ainda relevante, não a norma.
- Fora de escopo por ora: "units" (ticker final 11, ON+PN empacotados) existem no mercado real, mas o sufixo 11 já está reservado pra FII na spec/currículo (lição 2.3) — não proponho reaproveitá-lo, evita colisão didática.

**Proposta (decisões confirmadas):**
1. Uma empresa passa a poder ter **1 ou 2 ativos de Ação vinculados** ao mesmo `company_id` — cada classe com seu próprio `asset_id`/ticker/book, mas ambas compartilhando o mesmo ciclo de `company_fundamentals` (mesmo balanço, mesma empresa por trás). Preço de cada classe nasce da própria negociação (seção 2), podendo divergir uma da outra.
2. **Dividendo com prioridade legal de PN**: `dividend.EquityValuePerShare` deixa de assumir uma única classe — passa a considerar as duas bases de ações em circulação (ON + PN) e aplicar a vantagem de dividendo. **Percentual configurável por empresa, com 10% como default** (o piso legal mais comum) — reflete o fato real de que cada empresa define isso no próprio estatuto, e algumas dão mais que o mínimo.
3. **Bot Fundamentalista** (seção 2.3.2) calcula "preço justo" separadamente por classe — o fundamento (lucro, ROE) é o mesmo, mas o dividendo esperado por ação difere (item 2), então o valor justo também difere ligeiramente. É só mais um input na função de decisão, não um arquétipo novo.
4. **Sem diferença de voto simulada por enquanto** — não há mecânica de assembleia hoje; se/quando a "Assembleia de Acionistas" da proposta de monetização sair do papel, é o ponto natural pra ON vs. PN passar a importar além do dividendo (só ON vota, ou PN com peso restrito).
5. **Mistura do catálogo seed reflete o mercado real de hoje**: **maioria de empresas só-ON** (padrão Novo Mercado), com **pelo menos uma ou duas empresas clássicas ON+PN** pra exercitar de verdade o cenário da lição 2.3 e o spread de preço entre classes da seção 2.

## 3. Eventos Macro — removendo a limitação de sinal único

**Decisão confirmada:** eliminar a limitação atual em que um evento "misto" sorteia um único sinal (positivo/negativo) e aplica o mesmo sinal a todos os seus alvos. O caso didático que a spec já cita (câmbio: desvalorização do real beneficia exportador e prejudica importador, ao mesmo tempo, no mesmo evento) precisa funcionar de verdade.

Direção proposta:
- `macro_event_targets` passa a carregar uma **direção própria por alvo**, em vez de herdar sempre a direção única do evento. Um evento "misto" declara 2+ alvos (ex: setor Exportador / setor Importador), cada um com seu próprio sinal (positivo/negativo) e, se necessário, sua própria banda de magnitude dentro do range do evento.
- Evento "não-misto" continua simples — todos os alvos herdam a mesma direção do evento, sem precisar declarar nada por alvo (não regride a UX do painel admin pros casos simples).
- No novo modelo de preço via negociação (seções 2, 4 e 5), esse sinal por alvo vira o parâmetro que desloca o viés dos bots daquele alvo especificamente — os bots do setor Exportador ficam mais compradores, os do setor Importador mais vendedores, no mesmo evento, ao mesmo tempo. É a mesma mecânica da seção 2.5/2.3, só que a granularidade do "empurrão" deixa de ser por evento inteiro e passa a ser por alvo dentro do evento.
- O efeito em fundamentos (linha contábil do próximo relatório) segue a mesma lógica por alvo — cada empresa/setor recebe o sinal do seu próprio alvo, não mais um sinal único herdado do evento inteiro.

## 4. FIIs — mesmo motor de negociação real de Ações, com fundamentos próprios

**Decisão confirmada:** FII entra no mesmo motor de negociação real (book de ofertas, bots, preço = última negociação) descrito na seção 2 — não ganha um mecanismo à parte como o ETF (seção 5). Justificativa: diferente de um ETF, um FII não tem um Participante Autorizado fazendo arbitragem contínua entre preço de mercado e patrimônio líquido por cota — na vida real, FIIs frequentemente negociam com ágio/deságio persistente frente ao valor patrimonial (P/VP diferente de 1), exatamente porque não existe esse mecanismo de correção automática. Modelar FII como "mais uma ação" (negociado livremente, sem arbitragem) é mais fiel à realidade do que dar a ele o mesmo tratamento do ETF.

O que muda por perfil de FII:
- **Tijolo** (segmento, patrimônio líquido, vacância): esses três campos deixam de ser só cadastrais e passam a alimentar o **comportamento dos bots** que negociam aquele FII, de forma análoga ao balanço de uma empresa (seção 2.5) — um FII com vacância subindo, ou um evento macro batendo no segmento dele (ex: "queda do e-commerce físico" afetando Shopping), desloca o viés dos bots que cobrem aquele FII, e o preço se move pela negociação resultante, não por fórmula. **Decisão confirmada:** `NetWorth` passa a ser **reavaliado periodicamente** (mesmo ciclo de 14 dias do relatório de empresas), com uma variação sintética ligada à Selic simulada — juro alto pressiona a avaliação de imóveis pra baixo, juro baixo valoriza, mesmo mecanismo de custo de capital real —, criando de fato uma variação patrimonial simulada do fundo em vez de um número fixo desde o seed.
- **Papel** (indexador CDI/IPCA+/prefixado, valor de carteira): o rendimento indexado que já alimenta o Dividend Yield continua existindo, mas a *precificação da cota* passa a vir de negociação — o valor de carteira (`PortfolioValue`) funciona como uma referência de "quanto vale por cota" (like um NAV informativo), sem forçar o preço de mercado a colar nele, mesmo raciocínio do ágio/deságio real. **Decisão confirmada:** `PortfolioValue` também passa a ser reavaliado no mesmo ciclo de 14 dias, variando conforme o indexador da carteira (CDI/IPCA+/prefixado) — o valor de referência da carteira de papel rende de acordo com seu próprio indexador, análogo a como um título de renda fixa acumula valor com o tempo.
- Bots que negociam FII precisam diferenciar tijolo de papel na função de decisão — sensibilidade a vacância/segmento pro tijolo, sensibilidade ao indexador (ex: FII papel indexado a CDI fica mais atrativo com Selic alta) pro papel. Essa segunda relação já cria um gancho direto com a seção 6 (Selic/IPCA), reforçando o conceito real de que FII papel "gosta" de juro alto e FII tijolo geralmente sofre com juro alto (custo de capital/financiamento imobiliário).
- Ciclo de relatório/dividendo (a cada 14 dias) continua existindo como está — o que muda é só que o preço não reage mais a esse ciclo por fórmula, e sim pela negociação dos bots avaliando o novo dado.

## 5. ETFs — modelo NAV + Participante Autorizado (creation/redemption)

Baseado na explicação do autor sobre o mecanismo real de ETF de gestão passiva; a proposta é seguir essa lógica:

### 5.1 NAV / iNAV
O fundo tem um **valor patrimonial (NAV)** calculado a partir da soma do valor de mercado corrente de todos os ativos da cesta mais caixa, menos passivos, dividido pelo número de cotas emitidas. Um `iNAV` (NAV intradiário) pode ser recalculado a cada rodada de negociação (seção 2.4) usando os preços correntes dos constituintes.

### 5.2 Preço de mercado do ETF
O preço de tela do ETF **não é o NAV** — é formado pelo mesmo mecanismo de negociação real da seção 2 (book de ofertas de compra/venda de cotas do ETF, entre usuários e bots). Pode divergir do NAV (ágio/deságio).

### 5.3 Participante Autorizado (bot especializado)
Um tipo de bot com papel de arbitragem entre preço de mercado e NAV:
- **Ágio** (preço do ETF > NAV): o bot-AP "compra" os ativos da cesta ao preço de mercado corrente, "entrega" ao fundo e recebe novas cotas (criação), que vende no mercado — aumenta a oferta de cotas, pressionando o preço de volta ao NAV.
- **Deságio** (preço do ETF < NAV): o bot-AP compra cotas baratas na bolsa, resgata pelos ativos subjacentes (destruição de cotas) e "vende" os ativos recebidos — reduz a oferta de cotas, pressionando o preço de volta ao NAV.
- Isso significa que o número de cotas em circulação do ETF deixa de ser fixo desde o seed — cresce/diminui via creation/redemption, análogo ao float de uma ação mas com um mecanismo de ajuste automático embutido.

### 5.4 Rebalanceamento mecânico

Gatilhos: (a) revisão periódica da composição do índice de referência (ex: a cada N dias simulados, análogo ao ciclo de relatório de 14 dias já existente), e (b) eventos corporativos que mudem o peso de um constituinte (ex: pagamento de dividendo, um ativo da cesta sofrendo forte variação de preço).

**Recomendação (autor pediu pra eu propor):** o gestor do rebalanceamento **não é um bot de personalidade** (seção 2.3) — é uma rotina determinística separada, mais parecida com uma fórmula financeira pura do domínio (`.claude/arquitetura-engine-go.md`, "fórmulas financeiras como funções puras testáveis") do que com um agente que "decide". Justificativa:
- Gestão passiva real não tem discricionariedade nenhuma — o gestor de um ETF passivo não "acha" que devia rebalancear, ele **calcula** o novo peso-alvo a partir da nova composição do índice e emite exatamente a ordem necessária pra chegar lá. Modelar isso como uma personalidade (com viés, ruído, nível de conhecimento) inventaria uma incerteza que não existe nesse papel — o gestor mecânico é 100% determinístico dado o índice-alvo.
- Isso também é mais fácil de testar (tabela de casos "composição antiga → composição nova → ordens esperadas", igual a qualquer outra fórmula do motor) do que testar um bot com aleatoriedade embutida.
- Ainda assim, a execução em si **usa a mesma conta/pipeline de ordem** dos bots (`is_bot = true`, mesmo `orderexecution`) — não é um caminho de dados paralelo, só a função que decide o que ordenar é diferente (determinística em vez de comportamental). Na prática: um `bot_type` (ou campo equivalente) diferencia "bot comportamental" (arquétipo da seção 2.3.2) de "bot mecânico" (rebalanceador/AP), mas ambos são a mesma entidade de conta pro resto do sistema.
- A execução acontece na(s) última(s) rodada(s) do dia de rebalanceamento, análogo ao leilão de fechamento real, e deve gerar Tracking Error mensurável entre o ETF simulado e o índice teórico (atrito da própria negociação, spread pago, timing) — bom gancho pedagógico (lição sobre por que ETF não entrega exatamente o retorno do índice, mencionado pelo autor como conceito real de "cash drag").
- O mesmo "bot mecânico" (com uma função de decisão diferente, não a de rebalanceamento) é reaproveitado pro papel de **Participante Autorizado** (seção 5.3) — arbitragem NAV também é 100% determinística dado o spread preço-de-mercado vs. NAV, não uma decisão de personalidade.

### 5.5 Cesta mista — incluindo FIIs
Confirmado: a cesta pode incluir ativos de renda variável (Ações), renda fixa e agora também **cotas de FII** (seção 4) — um "ETF de FIIs" (análogo a produtos reais tipo índices de fundos imobiliários) é um caso legítimo. Implicação técnica: `etf_holdings` (hoje só pensado para constituintes de renda variável com peso percentual — ver spec 3.6/seção 4 do DER) precisa suportar referenciar qualquer `asset_id` do catálogo (Ação, FII, ou instrumento de renda fixa), e o cálculo de NAV precisa saber precificar cada tipo de constituinte pela regra correta (preço de mercado pra Ação/FII, valor marcado a mercado pra renda fixa).

## 6. Selic e IPCA — ligação realista

**Decisão confirmada:** seguir as duas melhorias propostas para o mecanismo hoje implementado em `selic/selic.go`/`selic/copom.go` (reversão à média discretizada por reunião do Copom a cada 21 dias — já é um Vasicek simplificado razoável, mas hoje totalmente desacoplado do IPCA simulado, que por sua vez é gerado por `ipca.MonthlySeries` como ruído em torno de uma meta, sem memória e sem nenhuma referência à Selic).

1. **Regra de reação à inflação (Taylor simplificada).** Em vez de reverter só para uma `taxa_neutra` fixa (10% a.a.), a decisão do Copom simulado passa a reagir ao desvio do IPCA acumulado frente a uma meta de inflação:
   `nova_taxa = taxa_atual + velocidade_reversão × (taxa_neutra − taxa_atual) + peso_inflação × (IPCA_acumulado − meta_IPCA) + ruído`
   Isso cria a causalidade que falta hoje: um IPCA simulado persistentemente acima da meta empurra a Selic simulada pra cima nas próximas reuniões, e vice-versa — reforçando o mecanismo de transmissão de política monetária que a spec já menciona (3.2.2) só que hoje só existe no sentido Selic→fundamentos, nunca IPCA→Selic.
   **Decisão confirmada:** `peso_inflação` fica como **parâmetro livre em `selic.Config`** (calibrável, mesmo padrão de `Neutral`/`ReversionSpeed`/`Volatility` já existentes), mas o **valor inicial/default é o peso moderado**, próximo da regra de Taylor clássica (coeficiente ~1.5x o desvio de inflação) — não um valor fraco nem deixado em branco.
2. **Passos discretos do Copom.** O tamanho do movimento em cada reunião passa a ser quantizado em incrementos realistas (ex: 0,25 / 0,50 / 0,75 / 1,00 p.p.), não um valor decimal contínuo saído direto do ruído gaussiano — mais fiel ao que o Copom realmente faz (arredonda a decisão pro múltiplo de 0,25 mais próximo do que a regra de reação sugeriu).

Isso também fortalece a ponte com a seção 4 (FII papel/tijolo reagindo à Selic) e com o restante da Renda Fixa (seção 9) — a Selic simulada passa a ser um número que "significa" mais coisa dentro do motor, não só um input pro drift do GBM (que está saindo) e pros fundamentos.

## 7. Calibração dos coeficientes de fundamentos

**Decisão confirmada:** calibrar os coeficientes hoje marcados como "ilustrativos" em `fundamentals.go` (margem líquida 10%, margem EBIT 18%, patrimônio = 1.2×receita, dívida = 0.4×patrimônio, caixa = 15%×receita, sensibilidade à Selic 0.02/0.06 por `risk_class`) em vez de deixá-los como placeholders, usando como referência médias setoriais reais e públicas (ex: margens médias por setor divulgadas por B3/CVM/relatórios setoriais, para os 6 setores já fixados na spec 3.3.2 — Mineração, Agronegócio, Bancário/Financeiro, Varejo, Energia, Tecnologia) em vez de um único conjunto de coeficientes genérico pra toda empresa — o que também abriria espaço para diferenciar bots/fundamentos por setor, não só por `risk_class`.

**Método confirmado:** essa pesquisa de dados reais fica a meu cargo (mesmo tipo de levantamento já feito pra fundamentar o motor de bot na seção 2.3.1) — ainda **não conduzida nesta rodada**, fica como o próximo passo natural depois da revisão deste documento (o autor pediu pra revisar o documento inteiro primeiro antes de qualquer coisa nova). Esse trabalho de calibração é independente do redesenho de preço (seções 2–6) e pode ser feito em paralelo a ele.

## 8. O que muda no código hoje (mapeamento por pacote, alto nível — não é plano de implementação)

| Pacote/decisão atual | O que muda |
|---|---|
| `equity/gbm.go` (GBM) | Deixa de gerar preço "de fora" pra Ações/FIIs/ETFs; pode sobreviver só como gerador de comportamento inicial de bot (ex: viés de humor de mercado) ou ser removido — a decidir na fase de design técnico. |
| `orderexecution.go` — liquidez sintética (decisão 2026-08-22) | Revertida: toda ordem casa só contra liquidez real (usuário ou bot); sem contraparte ilimitada implícita. |
| `macroevent`/`macro_event_targets` — sinal único por evento | Passa a suportar sinal/magnitude por alvo (seção 3); `PriceEffectPct`/`macroPriceMultiplier` saem, entra efeito sobre parâmetros de comportamento de bot por alvo. |
| `fundamentals.ReportSurprise`/`ReportDayPriceEffect` | Sai a fórmula de sensibilidade direta; bots reavaliam fundamentos novos vs. expectativa e negociam — preço nasce dessa negociação. |
| `fundamentals.go` — coeficientes ilustrativos | Recalibrados por setor com referência real (seção 7). |
| `fii.Details` (`NetWorth`, `vacancy_rate`, indexador) | Passa a alimentar comportamento de bot (seção 4), com possível reavaliação periódica de `NetWorth` em vez de fixo desde o seed. |
| `selic`/`ipca` | Ganham ligação causal (regra de reação à inflação) e passos discretos do Copom (seção 6). |
| `tick.Advance` (Temporizador) | Ganha rodadas intradiárias de matching de bot dentro do mesmo dia simulado, além do que já faz hoje (Selic, calendário de relatório, proventos). |
| Catálogo (`assets`/`variable_income_assets`) | `outstanding_shares` vira teto real de float, não só denominador de indicador; precisa de distribuição inicial (bots detentores) — vale pra Ações e FIIs. |
| `etf.Details`/`etf_holdings` | Ganha NAV/iNAV, mecanismo de creation/redemption (cotas deixam de ser fixas), suporte a constituinte de renda fixa e de FII na cesta, e rebalanceamento mecânico por revisão de índice/evento corporativo. |
| Novo domínio `bot` (ou nome equivalente) | Personalidade configurável (com cobertura por classe de ativo — Ação/FII/ETF), motor de decisão de ordem por rodada, papel especial de Participante Autorizado pra ETF. |
| `catalog.VariableIncomeAsset.ShareClass` | Deixa de ser rótulo cosmético — uma empresa pode ter 1 ou 2 ativos de Ação (ON/PN) vinculados ao mesmo `company_id`, cada um com seu próprio book/preço (seção 2.8). |
| `dividend.EquityValuePerShare` | Passa a considerar as duas bases de ações em circulação (ON + PN) e aplicar a prioridade legal de dividendo da PN (mínimo 10% maior que a ON), em vez de assumir uma única classe. |

## 9. Renda Fixa — correções à parte, sem depender do redesenho de bots

O relatório (`tmp/relatorio-logica-mercado.md`, seções 8.3–8.6) já identificou os problemas de Renda Fixa, e diferente da Renda Variável, esses **não exigem** o redesenho de bots/order book — são correções cirúrgicas de fórmula já existente e não usada:

1. Implementar uma fórmula de rendimento pós-fixado de verdade pro Tesouro Selic/CDB %CDI (hoje usa `PrefixedPrice` com taxa estática — não acompanha a Selic simulada do dia a dia, quebrando o conceito central da lição 1.2). Ganha ainda mais relevância com a seção 6 (Selic passa a reagir ao IPCA — vale a pena o rendimento pós-fixado realmente acompanhar isso dia a dia).
2. Ligar `fixedincome.VNAProjected`/`IPCAPrice` (já implementado e testado) na compra/resgate real de Tesouro IPCA+, em vez de continuar usando deságio nominal.
3. Restringir a marcação a mercado via Selic a produtos prefixados (como a spec 3.2.1 já pede), em vez de aplicar a todos os 8 tipos.
4. Revisitar com o autor as 5 decisões de escopo documentadas em `fixedincomeexecution.go:7-49` que nunca foram formalmente confirmadas (taxa nunca atualiza, resgate sempre integral, DU calculado por relógio real em vez de dia simulado, etc.).

Proposta: tratar isso como uma frente separada e mais rápida, independente do timing da reescrita de Renda Variável — não é bloqueada por ela e nem a bloqueia.

## 10. Perguntas ainda em aberto (fase de design técnico, não deste documento)

Todas as decisões de calibração e desenho conceitual levantadas nas rodadas de discussão anteriores já foram resolvidas e incorporadas ao corpo do documento: cadência de rodadas (2.4), distribuição inicial do float e fatia do Market Maker (2.2), catálogo de personalidade/escopo/conhecimento do bot e tamanho do pool por ativo (2.3.2), gestor de rebalanceamento do ETF (5.4), reavaliação periódica de `NetWorth`/`PortfolioValue` de FII (4), peso da reação Selic→IPCA (6), sandbox fora de escopo (2.7), e método de calibração dos fundamentos por setor (7). O que ainda falta é execução, não decisão:

- **Pesquisa de calibração setorial (seção 7)**: eu ainda preciso efetivamente levantar os dados reais (B3/CVM/relatórios setoriais) e propor os coeficientes por setor — combinado que fica pra depois da revisão deste documento.
- **Números finos de calibração que ficaram como faixa, não valor único**: a distribuição exata do número de rodadas dentro do viés "2-3 mais comum" (seção 2.4), a proporção exata de cada arquétipo dentro do pool de 15-25 bots por ativo (seção 2.3.2, item 5), e o valor exato de `velocidade_reversão`/`peso_inflação` dentro da faixa "moderada" combinada (seção 6) — esses são ajustes de calibração fina que fazem mais sentido na prática (rodando o motor) do que fechados só na teoria; tratar como a mesma "calibração fina" já prevista na semana 8 do roadmap original.
- **Tamanho do esforço e sequenciamento**: isso é maior que qualquer tarefa única do backlog atual — vale desenhar como sua própria mini-sequência de fases/semanas (paralela ou substituindo parte do roadmap original), similar ao que já foi feito para `backlog-engajamento-gamificacao.md`. Autor pediu pra revisar o documento completo primeiro antes de iniciar esse desenho de backlog.

## 11. Fontes consultadas

- [How to Build an Agent-Based Market Simulator (HackerNoon)](https://hackernoon.com/how-to-build-an-agent-based-market-simulator) — arquétipos fundamentalista/chartista/ruído e composição ponderada entre eles (base da seção 2.3).
- [Zero Intelligence Traders: Gode and Sunder (1993) — resumo, Brandeis](https://people.brandeis.edu/~blebaron/classes/agentfin/GodeSunder.html) — eficiência alocativa de traders aleatórios com restrição de orçamento; base da recomendação de manter a maioria dos bots "baratos" (arquétipo Ruído) e reservar sofisticação só pro Fundamentalista.
- [Art. 17 da Lei das Sociedades Anônimas (Lei 6.404/76), Jusbrasil](https://www.jusbrasil.com.br/topicos/11533033/artigo-17-da-lei-n-6404-de-15-de-dezembro-de-1976) — vantagem legal mínima de dividendo da ação PN (10%, reforma da Lei 10.303/2001); base da seção 2.8.
- [Segmento Novo Mercado, B3](https://www.b3.com.br/pt_br/produtos-e-servicos/solucoes-para-emissores/segmentos-de-listagem/novo-mercado/) — exigência de 100% ações ON (~190 empresas em 2025); base da recomendação de mistura ON-only/ON+PN no catálogo seed (seção 2.8, item 5).
