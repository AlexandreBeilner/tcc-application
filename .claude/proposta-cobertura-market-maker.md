# Proposta: cobertura contínua de Market Maker escalável

**Decisões fechadas em 2026-09-23** (autor confirmou seguir as recomendações da análise; seção 9) e
convertida em tarefas executáveis: **Fase P de `backlog-motor-mercado-realista.md`**. Este documento
continua como o "porquê" por trás delas. Nasce do achado 013 de `.claude/pontos-em-aberto-decisao-produto.md`
(venda a mercado logo após a compra não preenche) e de uma investigação de causa raiz feita em
2026-09-23. Direção acordada com o autor: a solução precisa ser boa **para o futuro** (o catálogo vai
crescer, o painel admin de bots vai existir), nunca dimensionada só para os 5 ativos negociáveis do
seed de hoje. A quebra de tarefas está na seção 7.

Documentos relacionados: `proposta-motor-mercado-realista.md` (seções 2.2 e 2.3.2, Market Maker),
`calibracao-liquidez-bots.md` (achado 009, piso do teto de ordem), `arquitetura-engine-go.md`
(padrão obrigatório do `engine/`), `backlog-motor-mercado-realista.md` (Fases N e O).

## 1. Problema

Sintoma: com o motor parado depois de 60 ticks, comprar 100 ações a mercado de VALR3 ou BNDD4
preenche, mas vender as mesmas 100 logo em seguida retorna `filled_quantity: 0` e a ordem fica
pendente. O book de VALR3 terminou o dia 60 com 7 vendas de outros bots e nenhuma compra.

### Causa raiz (medida, não suposta)

Stack isolado, seed limpo, 60 ticks, código da branch `fix-009-piso-teto-ordem`:

- **Um único Market Maker para todos os ativos.** `marketMakerBotUserID` é uma constante do seed
  (`engine/cmd/seed/main.go`), com um caixa único (R$ 116 bi) dimensionado pelo float de hoje.
- **Sorteio de um ativo por rodada.** `runIntradayRounds` (`engine/internal/domain/tick/rounds.go`)
  chama `bot.SelectAssetForRound` para todo bot, inclusive o Market Maker: em cada rodada ele cota
  **um** ativo sorteado. Nos últimos 20 dias simulados ele cotou VALR3 em 7 dias, PAPL11 em 3, BNDD4
  em 9, TJLO11 em 10 e BNDD3 em 14. Em VALR3, nenhuma ordem dele nos dias 59 e 60.
- **Expiração diária.** `OrderExecutionRepository.ExpireStaleOrders` cancela, no início de cada tick,
  toda ordem pendente de dia anterior. A cotação do Market Maker some sozinha, e o ativo só volta a ter
  compra e venda em repouso no dia em que o sorteio o escolhe.
- **Os outros bots não cobrem o vazio.** Chartista, Fundamentalista e Ruído colocam ordens oportunistas
  por sinal, com compras raras. Quem deveria garantir os dois lados sempre presentes é o Market Maker
  (proposta 2.3.2: "sempre nos dois lados, prioridade em nunca deixar o book vazio").

Recotar o lado consumido ao fim de cada rodada **não resolve**: o problema é o ativo nem entrar na
rodada do Market Maker. Também não é falta de capital (achado 009, já corrigido no PR #38).

### Por que não basta "cotar todos" com o código de hoje

Um Market Maker único que itera todos os ativos resolve os 5 de hoje e degrada com o catálogo:

- A tarefa 7.2 do backlog principal planeja cerca de 12 a 15 ativos de renda variável negociáveis
  (6 empresas, o par ON e PN, 4 FIIs, 2 ETFs), e a spec prevê cadastro de ativos pela interface no
  futuro.
- Caixa e estoque compartilhados numa conta só: o esgotamento em um ativo afeta todos.
- Custo por rodada linear e concentrado numa conta: `ativos × rodadas × (carregar contexto, cancelar,
  submeter dois lados)`, tudo sequencial.
- Cobertura definida por uma constante no seed, sem caminho para o painel de bots (Fase N) ou para um
  ativo novo criado depois do seed.

## 2. Princípios de design

1. **Cobertura é dado, não código.** Quem cota o quê vive numa tabela, não numa constante nem no
   sorteio.
2. **Custo limitado por peça.** Cada Market Maker cobre no máximo N ativos; o catálogo cresce
   adicionando Market Makers, não sobrecarregando um.
3. **Custo proporcional à mudança, não ao catálogo.** Cotação que ainda vale não é cancelada e
   recriada.
4. **Ativo novo nasce coberto.** Provisionar cobertura, caixa e posição é uma rotina reutilizável, não
   um passo manual do seed.
5. **Validar em catálogo maior que o real.** Nenhum número desta proposta vale se só foi medido com 5
   ativos (diretriz do autor, salva na memória do projeto).
6. **Espelhar o mercado real.** Na B3 o formador de mercado é contratado **por ativo**, com spread
   máximo e quantidade mínima, e pode haver mais de um formador por papel.

## 3. Modelo proposto

### 3.1 Cobertura como tabela

Nova tabela `market_maker_coverage (asset_id, mm_account_id, created_at)`, chave primária
`(asset_id, mm_account_id)`.

- A chave composta já comporta **redundância** (dois Market Makers no mesmo ativo) sem mudar o modelo,
  mesmo que a v1 use um por ativo.
- Só faz sentido para ativos negociados no book real (Ação e FII hoje; ETF quando a Fase H o trouxer
  para o mesmo motor). Sandbox fica de fora.
- FK para `assets` e para `accounts`; conta precisa ser `is_bot` com arquétipo `market_maker`.

### 3.2 Teto de ativos por Market Maker

Nova coluna `bot_personalities.max_covered_assets` (inteiro positivo, nulo para arquétipos que não são
Market Maker). O teto é do bot, não uma constante global, para o painel admin poder ajustar por bot.

**Valor padrão: 10 ativos por Market Maker, configurável por bot.** Base da escolha (ver seção 6.1):

- O teto **não reduz o tempo do tick**. Os bots são processados em sequência (`runIntradayRounds`), então o
  custo total depende do número de ativos, não de quantos Market Makers os dividem. Ele não é uma alavanca
  de desempenho.
- Ele existe para **limitar o estrago** de um Market Maker desativado ou com estoque esgotado (com 50
  ativos e teto 10, no máximo 10 ativos, 20%, perdem cobertura por vez) e para manter a **granularidade
  operacional** do painel (50 ativos viram 5 contas, não 1 nem 50).
- Não há dado externo que fixe 10 (na B3 o formador é contratado por papel, sem um teto por instituição
  publicado). Por isso é padrão ajustável, e não constante no código. A distribuição usa o menos carregado,
  então 15 ativos viram dois Market Makers de 8 e 7, não 10 e 5.

### 3.3 Atribuição

Função pura de domínio `Assign(assetID, marketMakers)`: devolve o Market Maker ativo com menos ativos
cobertos entre os que ainda têm folga (desempate por ID, para determinismo); sem nenhum com folga,
sinaliza "precisa criar Market Maker". Sem I/O, testável em tabela.

### 3.4 Provisionamento (rotina única, reutilizável)

Caso de uso `EnsureCoverage(asset)` (no domínio, com colaboradores por interface pequena, padrão do
`engine/`):

1. Se o ativo já tem Market Maker ativo cobrindo, não faz nada (idempotente, como o seed).
2. Escolhe o Market Maker por `Assign`; se nenhum tem folga, cria uma conta nova (`account.NewBot`) com a
   personalidade padrão de Market Maker (mesmo perfil de risco do seed) e o teto padrão.
3. Grava a cobertura e provisiona **caixa e posição proporcionais ao float do ativo** (fatia do grupo
   Market Maker de `bot.InitialAllocation`, caixa por `bot.InitialCash`), somando ao saldo já existente
   do Market Maker escolhido. O que hoje é um laço do seed (`cmd/seed/main.go`) passa a ser chamado por
   essa rotina.
4. Caixa e posição entram por Event Sourcing (CLAUDE.md): nenhuma escrita direta em `accounts` ou
   `positions` sem evento em `market_events`. O seed de hoje já respeita isso pelas funções
   `ensureBotAccount`/`ensureBotPosition`; a rotina nova precisa reaproveitar o mesmo caminho.

### 3.5 Comportamento por rodada

Em `runIntradayRounds`, o Market Maker deixa de passar por `SelectAssetForRound`: em cada rodada ele
cota **todos os ativos que cobre**, em ordem determinística por ID. Os outros três arquétipos continuam
exatamente como estão (um ativo sorteado por rodada, achado 005). Nenhuma rodada perde determinismo,
porque `roundSeed` já é por `(dia, rodada, bot, "asset"/"decision")`.

Ativo coberto que não está no universo negociável da rodada (por exemplo, ETF ainda fora do motor real) é
ignorado sem erro.

### 3.6 Manutenção de cotação

Hoje `CancelUserRestingOrders` cancela **tudo** do Market Maker no ativo e ele recota, sempre. Com
cobertura total isso vira `ativos × rodadas` cancelamentos e criações por tick. Proposta:

- Função pura `NeedsRequote(existingOrders, referencePrice, tolerancePct, minRemaining)`: a cotação está
  boa se há uma compra e uma venda em repouso, ambas dentro da tolerância do preço de referência e com
  quantidade restante acima do mínimo.
- Cotação boa: nada a fazer. Só o lado consumido, vencido ou fora da tolerância é cancelado e recotado.
- Efeito: escrita proporcional à atividade do mercado, não ao tamanho do catálogo.
- Leitura em lote: uma consulta traz as ordens em repouso de todos os ativos cobertos por um Market
  Maker, em vez de uma consulta por ativo.

### 3.7 Expiração de cotação de Market Maker

Ponto de decisão (seção 9, item 3). Hoje `ExpireStaleOrders` cancela **toda** ordem de dia anterior,
inclusive as do Market Maker, então a manutenção de cotação só poderia poupar escrita dentro do mesmo
dia. Recomendação: cotação de Market Maker é ordem "de pé" (como a do formador real, que cota
continuamente), então não expira por dia. Ela sai do book quando o Market Maker a substitui
(`cancel_reason` já existente para recotação) ou quando o bot é desativado. Isso muda a semântica da
tarefa O.2 (ordem Day) apenas para o arquétipo Market Maker e precisa ficar documentado em
`.docs/engine/orders.md` e `.docs/engine/tick.md`.

### 3.8 Obrigações do formador (como na B3)

- **Spread máximo:** já existe `RiskProfile.SpreadWidthPct` por bot. Falta um teto validado no domínio
  (achado 002: hoje só rejeita `>= 2`, o que deixa passar valores absurdos como 1,999999).
  **Teto adotado: 0,10 (10%)**, valor ilustrativo (sem fonte real confirmada, como os demais coeficientes do
  motor, sujeito à mesma calibração futura). O seed usa 0,02, então o teto só barra valores absurdos vindos
  de um consumidor futuro (painel de bots, Fase N).
- **Quantidade mínima por lado:** a cotação nunca fica abaixo do piso proporcional ao float do PR #38
  (`tick.MinOrderPctOfFloat`, 0,4%), para uma cotação simbólica não contar como cobertura.

### 3.9 Ativo sem cobertura ativa

Se todos os Market Makers de um ativo estão inativos (`is_active = false`, tarefa A.4) ou o ativo nunca
foi provisionado, o motor **não falha**: registra em log, por tick, quantos ativos negociáveis estão sem
cobertura ativa, e o `POST /admin/tick` devolve esse número. A ação corretiva (reatribuir) é do painel de
bots (Fase N).

## 4. O que fica fora do escopo (por ora)

- **Recotar por evento** (logo depois de um fill ou de uma ordem de usuário, disparado fora do tick).
  Melhora ainda mais a experiência, mas exige um gatilho de bot síncrono a partir de `POST /orders`,
  com risco de concorrência. A cobertura contínua já resolve o caso de uso do achado 013.
- **Redundância ativa** (2 Market Makers por ativo): o modelo comporta, a v1 usa um.
- **Perfil de liquidez fixo por ativo** (opção C do achado 009): descartado pelo autor, liquidez real
  depende de vários fatores.
- **Market Maker de ETF:** ETF tem o Participante Autorizado e o rebalanceamento mecânico (Fase H). A
  tabela de cobertura é agnóstica de tipo de ativo, mas quem cota ETF fica para quando a H o integrar ao
  motor de negociação real.
- **Ajuste do spread por volatilidade** ou qualquer inteligência nova de cotação.

## 5. Efeitos esperados e riscos

| Efeito | Direção | Como tratar |
|---|---|---|
| Volume diário sobe | Desejado, mas pode passar da faixa de 0,3-0,7% do float | Reconferir contra `calibracao-liquidez-bots.md`; ajustar `MinOrderPctOfFloat` se sair da faixa |
| Preço mais estável, reação a evento macro mais lenta | Realista, muda o "sabor" do mercado | Repetir o teste de 5 eventos severos (PR #37) e comparar |
| O usuário paga o spread (~2% de ida e volta) | Realista e educativo | Registrar em conteúdo/UX se necessário |
| Estoque e caixa do Market Maker esgotam em algum ativo | Risco | Medir depois de 60 dias; teto por Market Maker limita o estrago |
| Custo do tick | Linear no catálogo, limitado por Market Maker | Manutenção de cotação (3.6) + medição com catálogo sintético |
| Série de preços muda para a mesma seed | Esperado | Determinismo continua, só não bate com dados já gerados |
| Bot no ranking/patrimônio exibido | Risco a confirmar | Verificar antes de fechar que contas `is_bot` ficam fora do ranking e do perfil público (RNF09) |

## 6. Como validar (sem depender do catálogo mínimo)

- **Catálogo sintético:** opção do seed (`--synthetic-assets N`, só para stack de teste, nunca no seed
  de desenvolvimento) que gera N ativos, com empresas nos 6 setores e float variado, com N de 30 a 50.
- **Métricas a registrar** por execução de 60 dias simulados: tempo de cada tick, quantidade de
  Market Makers criados, caixa e posição mínimos de cada Market Maker, cobertura (ativos com compra e
  venda em repouso no fim de cada dia), volume diário como % do float por ativo.
- **Cenários:** compra e venda de 100 ações a mercado em vários ativos no fim do dia 60 (o teste do
  achado 013), cinco eventos severos no mesmo setor (o teste do achado 004), desativação de um Market
  Maker no meio da execução (cobertura perdida vira log, não falha).
### 6.1 Custo medido hoje e orçamento

Medição em 2026-09-23, stack isolado com `log_statement=all` no Postgres, seed real (5 ativos negociáveis,
19 bots direcionais + 1 Market Maker), 8 ticks, com e sem o Market Maker ativo (mesma seed):

| Medida | Valor |
|---|---|
| Statements SQL por tick, sem o Market Maker | 540 a 900 (média ~700) |
| Tempo do tick no banco local | 0,13 a 0,21 s (~0,22 ms por statement) |
| Ordens do Market Maker por tick | 4 a 8 (2 por ativo-rodada, 2 a 4 rodadas) |
| **Statements por ativo-rodada do Market Maker** | **~26** (medido em 1 tick com estado idêntico; 15 a 41 nos demais, confundido pela divergência de estado entre as duas execuções) |
| Custo dos outros bots | ~constante por bot, cada um negocia **1** ativo por rodada, então não cresce com o catálogo |

Duas conclusões que orientam o orçamento:

1. **Só o Market Maker cresce com o catálogo**, na forma `N ativos × R rodadas × ~26 statements`. Hoje isso
   é ~80 statements por tick (3 ativo-rodadas). Cobrindo N ativos sem manutenção de cotação: 50 ativos ×
   até 4 rodadas × 26 = ~5.200 statements, ~7x o tick inteiro de hoje.
2. **A latência do banco domina.** O 0,22 ms por statement é de um Postgres local. Em banco gerenciado, com
   ~2 ms por statement (suposição, a fixar quando houver ambiente real), o tick de hoje (~700 statements)
   já leva ~1,6 s, e 5.200 statements a mais somariam ~11,5 s.

**Restrição já existente que passa a importar:** o servidor HTTP do motor tem `WriteTimeout` de 5 s
(`engine/internal/infra/httpserver/server.go`) e `POST /admin/tick` roda o tick de forma síncrona na
requisição (`handleAdminTick`, `admin.go`). O tick automático diário (`scheduler/daily.go`) não tem esse
limite, só o disparo manual (o recurso de demonstração ao vivo para a banca) tem. Com ~2 ms por statement,
o disparo manual estoura os 5 s por volta de 2.000 a 2.500 statements, ou seja, com pouco mais de 20 ativos
cotados sem manutenção de cotação.

**Orçamento proposto** (a medir contra o catálogo sintético da P.7 e a fixar na P.8):

| Métrica | Orçamento |
|---|---|
| Statements do Market Maker por ativo-rodada, **regime estável** (com manutenção de cotação, P.4) | média ≤ 12 |
| Statements do Market Maker por ativo-rodada, **pior caso** (recotar tudo) | ≤ 30 (hoje ~26) |
| Statements por tick com 50 ativos | ≤ 3.500 (linha de base ~1.000 + 50 × 4 rodadas × 12) |
| Tempo do tick com 50 ativos, latência de referência 2 ms por statement | ≤ 10 s no tick automático |
| Crescimento com o catálogo | linear; nunca pior que linear em ativos |
| Revisão obrigatória do desenho | tick acima de 30 s com 100 ativos, ou acima de 5.000 statements com 50 |

Os dois primeiros itens são hardware-independentes (contagem de statements) e por isso são a métrica
principal de aceite. O tempo é uma métrica derivada, dependente da latência assumida. Se a latência real
for pior que 2 ms, ela vira o gargalo antes das contas acima, e a saída é a de sempre: reduzir statements
(manutenção de cotação mais agressiva, leitura em lote) antes de paralelizar.

**Consequência de escopo:** o disparo manual precisa deixar de depender dos 5 s. Nova tarefa **P.10**
(seção 7): ou levanta o deadline só dessa rota (`http.ResponseController.SetWriteDeadline`), ou torna o
disparo assíncrono (`202` com consulta de estado). O tick automático não precisa de nada.

### 6.2 Resultados medidos (tarefa P.7, 2026-09-23)

Script `engine/scripts/benchmark-cobertura.sh [N_ATIVOS_SINTETICOS] [DIAS]` (banco isolado `market_bench`,
`log_statement=all` só durante a execução, seed `--synthetic-assets N` com `SEED_ALLOW_SYNTHETIC=true`), 60 dias
simulados, código do PR 2 mais P.6. O total inclui os 5 ativos reais do seed.

| Métrica | 30 sintéticos (35 ativos, 4 Market Makers) | 50 sintéticos (55 ativos, 6 Market Makers) | Orçamento (6.1) |
|---|---|---|---|
| Comandos SQL por tick, média | 1.180 | 1.319 | |
| Comandos SQL por tick, máximo | 2.493 | **3.350** | ≤ 3.500 com 50 ativos |
| Tempo do tick, média / máximo (Postgres local, ~0,2 ms por comando) | 0,26 s / 0,65 s | 0,27 s / 0,52 s | ≤ 10 s com 2 ms por comando |
| Tempo equivalente a 2 ms por comando, pior tick | 5,0 s | 6,7 s | ≤ 10 s |
| Custo estimado por ativo-rodada do Market Maker, média | 2,6 | 2,4 | ≤ 12 |
| Custo estimado por ativo-rodada do Market Maker, pior caso | 17 | 18 | ≤ 30 |
| Ativos com compra e venda em repouso ao fim do dia 60 | 35 de 35 | 55 de 55 | todos |
| Ativos sem Market Maker ativo cobrindo, por tick | 0 | 0 | 0 |
| Ordens a mercado do cenário do achado 013 preenchidas (compra e venda de 50 em 10 ativos) | 20 de 20 | 20 de 20 | todas |
| Menor posição de um Market Maker ao fim (esgotamento) | 547.896 | 524.876 | > 0 |
| Volume diário médio por ativo, % do float (mín. / máx.) | 0,079 (0,018 / 0,168) | 0,056 (0,004 / 0,188) | 0,3 a 0,7 (`calibracao-liquidez-bots.md`) |

Como ler:

- O custo por ativo-rodada é uma **estimativa**: `(comandos do tick - 800) / (ativos x (rodadas + 1 passada final))`, com
  800 comandos como linha de base dos demais bots (medida na seção 6.1, 540 a 900). Não é medido por bot, porque o
  Postgres não separa comando por conta.
- Os limites de tempo da 6.1 valem para uma latência de 2 ms por comando, suposição a revisar com ambiente real; o
  banco local do benchmark tem ~0,2 ms. A linha "equivalente a 2 ms" é `máximo de comandos x 2 ms`.
- Um Market Maker por 10 ativos (teto): 35 ativos viraram 10 + 10 + 10 + 5 e 55 viraram 10 x 5 + 5, cada ativo exatamente
  uma vez, sem nenhum Market Maker criado a mais nem esgotado.
- **Volume abaixo da faixa de calibração** (0,06% a 0,08% contra 0,3% a 0,7%): com o pool de 19 bots direcionais fixo,
  cada bot negocia 1 ativo por rodada, então o volume por ativo cai quando o catálogo cresce. É um efeito do tamanho do
  pool de bots, não da cobertura; fica para a P.8 (reconferir a calibração e decidir como o pool escala).

### 6.3 Validação ponta a ponta (tarefa P.8, 2026-09-23)

| Cenário | Resultado |
|---|---|
| Compra e venda a mercado (achado 013) | seed real 6 de 6; 15, 35 e 55 ativos 20 de 20 cada |
| Cinco eventos severos no mesmo setor (Mineração) | `VALR3` 104,06 para 96,02 (-7,7%) em 4 dias, recupera ao expirar; `BNDD3` intocado; ativo sintético do setor -3% (menos negociado) |
| Market Maker de 10 ativos desativado no meio da execução | tick sem falha, `uncovered_assets_count` = 10, 6 de 15 ativos cotados no dia da desativação, 15 de 15 depois de reativar |
| Contas `is_bot` no ranking / perfil público (RNF09) | fora por construção: ranking e diretório leem só `users` |
| Volume diário médio, % do float | seed real 0,45 (0,29 a 0,75); 15 ativos 0,20; 35 ativos 0,08; 55 ativos 0,06 |

O volume fora da faixa com catálogo maior virou o achado 014 (pool de bots fixo); `MinOrderPctOfFloat` ficou em 0,4%.

### 6.4 Liquidez que escala com o catálogo (Fase Q, 2026-09-26)

Medição em 30, 50 e 100 ativos (5 reais mais sintéticos, 60 dias simulados, seed 42), antes e depois da Fase Q:

| | 100 ativos, antes (Q.1 a Q.3) | 30 ativos | 50 ativos | 100 ativos, depois (Q.7 a Q.10) |
|---|---|---|---|---|
| Comandos por tick, média | 5.335 (28 de 60 ticks acima de 5.000) | 2.163 | 3.600 | 4.644 (3 de 60 acima, p95 5.051) |
| Volume dos líderes (% do float/dia) | 0,32 | 0,54 | 0,53 | 0,34 |
| Volume mediano | 0,14 | 0,33 | 0,30 | 0,24 |
| Ativos abaixo de 0,15% | 52 de 100 | 1 de 30 | 0 de 50 | 0 de 100 |
| Dias sem negociação | 36% | 0% | 0,4% | 0,6% |
| Reação da cauda a 5 eventos severos | -1,0% | -8,2% | -5,8% | mediana -4,9% |

Diagnóstico (Q.7): os bots direcionais respondem por cerca de 72% dos comandos do tick, o Market Maker por 25% e o custo fixo
por 3%, em qualquer tamanho de catálogo. A causa do estouro era cada bot sortear um ativo por rodada: custo e volume dependiam do
mesmo botão (o pool) e cada ativo novo diluía os outros. A correção (Q.8 a Q.10) inverte o modelo: o tick fixa um orçamento de
turnos (até 200, com piso rígido de 1 turno a mercado por ativo por dia), o volume vem do tamanho da ordem dimensionado ao
giro-alvo do ativo (0,2% a 0,6% do float, sublinear no valor de mercado) e um evento macro ativo atrai turnos e Fundamentalistas
ao ativo afetado. Achado colateral (Q.9): a recotação do Market Maker podia ser consumida de cara por uma ordem de bot do outro
lado do preço, então a passada final agora repete até a cotação estabilizar.

Volatilidade diária com 100 ativos: mediana 1,10%, p95 1,51%. Nenhum Market Maker esgotou caixa nem posição.

## 7. Escopo: tarefas (candidatas à Fase P de `backlog-motor-mercado-realista.md`)

Cada tarefa é escopo de uma sessão, com teste no mesmo commit, `golangci-lint` e `go test ./...`
passando, docs em `.docs/engine/` atualizados e validação por `docker compose up`, como manda o
checklist do CLAUDE.md para o `engine/`.

### P.1 · Modelo de dados e domínio da cobertura
- Migration `000023` (próximo número livre): tabela `market_maker_coverage` e coluna
  `bot_personalities.max_covered_assets`, com `down` correspondente.
- Pacote de domínio novo (por conceito, sem I/O): tipo de cobertura, função pura `Assign`, validação do
  teto por Market Maker.
- Repositório em `internal/infra/db/` (leitura de cobertura por Market Maker, por ativo, e escrita), com a
  interface pequena declarada no ponto de consumo.
- Aceite: `Assign` em teste de tabela (folga, empate, nenhum com folga, Market Maker inativo ignorado);
  migration aplica e reverte.

### P.2 · Provisionamento reutilizável (`EnsureCoverage`) e migração do seed
- Caso de uso `EnsureCoverage`: atribuição (3.3), criação de Market Maker novo quando preciso, caixa e
  posição proporcionais ao float (3.4), tudo por Event Sourcing.
- O seed (`cmd/seed/main.go`) passa a chamar essa rotina no lugar do laço atual e do
  `marketMakerBotUserID` fixo; idempotente.
- Backfill: banco já existente com o Market Maker único ganha linhas de cobertura para os ativos que ele
  já cobre de fato (posição existente), sem criar conta nova nem mexer em saldo.
- Aceite: rodar o seed duas vezes não duplica nada; seed de um catálogo com mais ativos que o teto cria
  Market Makers adicionais e cada ativo fica com exatamente um.

### P.3 · Rodada: Market Maker cota todos os ativos que cobre
- `runIntradayRounds` para o arquétipo Market Maker: itera a cobertura (3.5), em ordem por ID, no lugar
  de `SelectAssetForRound`; os outros arquétipos intocados.
- `BotRoster` passa a devolver, para cada Market Maker, os ativos cobertos.
- Contagem de ativos sem cobertura ativa no log e em `POST /admin/tick` (3.9).
- Aceite: teste de rodada com N ativos cobertos cota os N em toda rodada; ativo fora do universo é
  ignorado; determinismo preservado (mesma seed, mesmo resultado).

### P.4 · Manutenção de cotação
- `NeedsRequote` (3.6) como função pura de domínio, com tolerância e quantidade mínima.
- Leitura em lote das ordens em repouso por Market Maker.
- Substitui o "cancelar tudo, recotar tudo" por "recotar só o que precisa".
- Aceite: cotação boa não gera nenhum cancelamento nem submissão; lado consumido é recotado; medir a
  redução de escritas por tick contra a versão anterior.

### P.5 · Expiração de cotação de Market Maker (decisão 3.7)
- Se aprovada a recomendação: `ExpireStaleOrders` deixa de cancelar ordens de Market Maker; a recotação
  substitui por `cancel_reason` já existente.
- Aceite: cotação de Market Maker atravessa a virada de dia; ordem de qualquer outro bot continua
  expirando; documentar a exceção em `.docs/engine/orders.md`/`tick.md` e na tarefa O.2.

### P.6 · Obrigações do formador
- Teto validado de spread no domínio (fecha o achado 002, com o valor confirmado pelo autor) e quantidade
  mínima por lado ligada a `MinOrderPctOfFloat`.
- Aceite: `NewRiskProfile` rejeita spread acima do teto; cotação abaixo do mínimo não conta como cobertura.

### P.7 · Catálogo sintético e benchmark
- Opção `--synthetic-assets N` no seed, restrita ao stack de teste.
- Script de medição (tempo do tick, cobertura, caixa e posição por Market Maker, volume por ativo).
- Aceite: execução de 60 dias com 30 e 50 ativos, resultados registrados neste documento, com a contagem de
  statements por tick e por ativo-rodada do Market Maker (log do Postgres, como na seção 6.1) comparada ao
  orçamento.

### P.8 · Validação ponta a ponta e ajuste de calibração
- Repetir os cenários da seção 6 contra o catálogo sintético e contra o seed real.
- Reconferir o volume contra `calibracao-liquidez-bots.md` e ajustar `MinOrderPctOfFloat` se preciso.
- Confirmar que `is_bot` fica fora do ranking e do perfil público.
- Aceite: compra e venda de 100 ações a mercado preenchem nos ativos cobertos; teste de 5 eventos
  severos ainda reage; nenhum Market Maker esgotado no fim dos 60 dias; tick dentro do orçamento da 6.1.

### P.10 · Deadline do disparo manual do tick
- `POST /admin/tick` hoje herda o `WriteTimeout` de 5 s do servidor (ver 6.1). Proposta: levantar o
  deadline só nessa rota com `http.ResponseController.SetWriteDeadline` (mais simples, mantém o contrato
  síncrono que o painel admin e o backend já usam) ou tornar o disparo assíncrono. A recomendação é a
  primeira; a segunda só se o tick passar do orçamento da 6.1.
- Aceite: com o catálogo sintético de 50 ativos, o disparo manual retorna `200` com o resultado completo,
  sem `timeout` do servidor. Documentar em `.docs/engine/tick.md`. Independente das outras tarefas, pode
  entrar já no primeiro PR.

### P.9 · Integração com a Fase N (só documentação)
- Atualizar as descrições de N.1/N.2 do backlog: listar a cobertura por Market Maker, ativos sem
  cobertura ativa, reatribuição e ajuste de `max_covered_assets` pelo painel.
- Sem código novo nesta tarefa; garante que a Fase N já nasça sabendo do modelo.

### Sequência sugerida
`P.1 → P.2 → P.3` fecham o núcleo (todo ativo coberto, todo tick). `P.4` e `P.5` são a otimização de
custo e podem entrar juntas depois. `P.6` é independente a partir de `P.1`. `P.7` pode começar assim que
`P.2` existir (precisa do provisionamento). `P.8` fecha a fase. `P.9` a qualquer momento antes da Fase N. `P.10` é independente e pode abrir a fase.

## 8. Contexto para quem for implementar

- Arquitetura do `engine/`: `arquitetura-engine-go.md`. Domínio isolado de infraestrutura (`depguard`
  bloqueia), interfaces pequenas no ponto de consumo, o adapter concreto só é instanciado em
  `cmd/api/main.go`.
- Pontos do código a ler antes: `internal/domain/tick/rounds.go` (`runIntradayRounds`,
  `effectiveOrderSizeCeiling`), `internal/domain/bot/marketmaker.go` (`DecideMarketMakerOrders`),
  `internal/domain/bot/allocation.go` e `cash.go` (`InitialAllocation`, `InitialCash`),
  `internal/infra/db/bot_repository.go` (`ListEligibleForTradingRound`),
  `internal/infra/db/order_execution_repository.go` (`ExpireStaleOrders`, `CancelUserRestingOrders`),
  `cmd/seed/main.go` (criação do Market Maker e provisionamento).
- Rotas alteradas: `POST /admin/tick` (novo campo de cobertura). Documentar em `.docs/engine/tick.md`.
- Achados relacionados em `pontos-em-aberto-decisao-produto.md`: 013 (origem), 002 (teto de spread),
  001 (`MarketOrderPreference`, independente), 009 (piso do teto, já resolvido).

## 9. Decisões (fechadas em 2026-09-23)

O autor pediu para seguir as recomendações da análise. Todas valem como ponto de partida e são ajustáveis
por medição (P.7/P.8) ou pelo painel de bots (Fase N):

1. **Teto de ativos por Market Maker: 10, configurável por bot** (3.2). O teto não afeta tempo de tick, só o
   alcance de uma falha e a granularidade operacional.
2. **Redundância:** um Market Maker por ativo na v1. O modelo (chave `(asset_id, mm_account_id)`) já comporta
   dois por ativo como evolução.
3. **Expiração da cotação do Market Maker: não expira por dia** (3.7). Exceção à regra de ordem Day só
   para o arquétipo Market Maker. A cotação sai do book quando o Market Maker a substitui ou quando o bot
   é desativado.
4. **Teto de spread do formador: 0,10** (3.8), ilustrativo. Fecha o achado 002.
5. **Orçamento de tick: seção 6.1**, com a contagem de comandos SQL como métrica principal e o tempo como
   derivada de uma latência de referência de 2 ms por comando (suposição a revisar quando houver ambiente
   real).
6. **Escopo de PRs:** (1) P.10 e P.1 a P.3, (2) P.4 e P.5, (3) P.6 a P.8. P.9 é só documentação e entra a
   qualquer momento.
