# Backlog — Motor de Mercado Realista

Backlog executável derivado de `.claude/proposta-motor-mercado-realista.md` (redesenho do motor de
precificação de Renda Variável — Ações, FIIs, ETFs —, eventos macro e da relação Selic/IPCA,
disparado pelo diagnóstico em `tmp/relatorio-logica-mercado.md`). Cobre a substituição do modelo
estatístico atual (GBM + multiplicadores de evento) por um motor de negociação real orientado a
book de ofertas e bots comportamentais (Fases A-H), a ligação causal Selic↔IPCA (Fase I), a
introdução de tipos de ação ON/PN (Fase J), a calibração de fundamentos por setor (Fase K) e as
correções cirúrgicas de Renda Fixa que não dependem do redesenho de bots (Fase L).

**Como usar este arquivo** — mesma disciplina dos outros dois backlogs do projeto:

1. Siga a **sequência sugerida** na seção final, não a ordem alfabética das fases — a ordem A-L é
   só agrupamento temático; a sequência resolve as dependências reais entre fases.
2. Cada tarefa é escopo de uma sessão. Não empacote várias tarefas numa sessão só — este backlog
   em particular tem tarefas maiores que a média dos outros dois (redesenho de motor, não feature
   de UI), então o cuidado de não empacotar vale ainda mais aqui.
3. Ao concluir uma tarefa, verifique os critérios de aceite antes de considerar pronta, e marque
   ✅ + acrescente um bullet de Entregável (mesmo padrão dos outros backlogs).
4. Toda tarefa que toca `engine/` (Go) passa pelo checklist do `CLAUDE.md` — domínio isolado de
   infraestrutura, interfaces pequenas no ponto de consumo, fórmula financeira nova sempre com
   teste table-driven no mesmo commit, `golangci-lint`/`go build`/`go test ./...` verdes,
   `.docs/engine/<pacote>.md` atualizado se alguma rota HTTP mudar, `docker compose up` antes de
   fechar a tarefa.
5. **Este redesenho reverte uma decisão de arquitetura já confirmada** — a liquidez sintética de
   `orderexecution.go` (decisão de 2026-08-22, tarefa 3.12) sai na Fase A. Isso já foi discutido e
   confirmado com o autor na proposta (seção 2.1) — não é preciso reabrir essa conversa, só citar
   a reversão explicitamente no commit/PR que tocar `orderexecution.go`.
6. **Interação com o backlog principal**: a tarefa `7.2` (`backlog-plataforma-investimentos.md`,
   ainda não concluída) planeja adicionar `BNDD3` como par ON da já existente `BNDD4` (PN) de
   forma simples, só pra ter um exemplo de duas classes no catálogo. Se `7.2` rodar antes da
   Fase J deste backlog, `BNDD3`/`BNDD4` nascem sem a lógica de prioridade de dividendo — a Fase
   J precisa então retrofitar esse par existente em vez de criar um novo. Se a Fase J rodar
   primeiro, ela já entrega esse par corretamente e `7.2` só precisa reconhecer que já existe.
   Ou seja: **não é preciso coordenar a ordem entre os dois backlogs**, mas quem pegar `7.2` ou a
   Fase J deve conferir se a outra já rodou antes de duplicar o par ON/PN.
7. Nenhuma regra crítica do `CLAUDE.md` é reaberta aqui (Event Sourcing como fonte da verdade
   financeira, capital inicial fixo em R$10.000, `role=admin` nunca por autocadastro, indicadores
   diferenciados por classe de ativo). Nenhuma tarefa abaixo toca essas regras; se alguma parecer
   que precisa, pare e confirme antes.
8. **Fases I, K e L são independentes do núcleo de bots (A-H)** — podem ser feitas a qualquer
   momento, inclusive em paralelo, sem bloquear nem serem bloqueadas pelo resto.

---

## Fase A — Fundação: conta de bot e liquidez real

Base de tudo — sem isso nenhuma fase seguinte tem onde pousar. Risco médio-alto: mexe em
`orderexecution.go`, peça central e já testada do motor.

### A.1 · Conta de bot (`is_bot`) e exclusão de ranking/social

- **Descrição:** hoje só existe `catalog.Asset.IsSandbox` como flag de "conta não-real". Precisa
  de um equivalente pro lado de conta/usuário — bots são contas reais em `accounts`/`positions`
  (proposta 2.3), então a flag pode viver em `accounts` (migration nova) ou numa tabela auxiliar
  `bots` referenciando `user_id`/`account_id`, a decidir na sessão conforme o que já existe no
  schema de `accounts`. Todo ponto que hoje lista/rankeia usuários (ranking global/amigos, busca
  de amigos, qualquer feed social futuro) precisa excluir contas com essa flag.
- **Critérios de aceite:** uma conta de bot nunca aparece em `GET` de ranking (nenhum escopo),
  nunca aparece em busca de `username`, e nunca pode receber solicitação de amizade. Teste table-
  driven cobrindo pelo menos um bot misturado com usuários reais nos três casos.
- **Referências:** proposta 2.3.
- **Dependências:** nenhuma.

### A.2 · Reverter liquidez sintética em `orderexecution`

- **Descrição:** remove o preenchimento por contraparte ilimitada (`MarketCounterparty`,
  `orderexecution.go:12-23`, decisão de 2026-08-22 revertida — ver nota 5 da seção "Como usar este
  arquivo"). Ordem a mercado sem profundidade suficiente do lado oposto do book passa a executar
  só a parte que tem contraparte real, deixando o restante sem preencher (não "pendurado" como
  ordem limitada — ordem a mercado não fica no book; o resto simplesmente não executa). A tela de
  Confirmação de Ordem (4.7, frontend) precisa comunicar isso ao usuário quando acontecer.
- **Critérios de aceite:** teste cobrindo book raso (sem contraparte suficiente) confirmando
  execução parcial sem erro nem preenchimento sintético; frontend mostra mensagem clara de
  execução parcial/sem liquidez, sem quebrar o fluxo de confirmação.
- **Referências:** proposta 2.1.
- **Dependências:** nenhuma (mas fica sem sentido prático até a Fase B/C popular o book com bots
  — pode ser feita antes, só não terá liquidez nenhuma no ambiente de teste até lá).

### A.3 · Float finito (`outstanding_shares` como teto real)

- **Descrição:** hoje `outstanding_shares` só é denominador de LPA/VPA. Vira um teto real — a
  soma de todas as posições de todos os detentores (usuários + bots) de um ativo nunca pode
  exceder esse número. Precisa de uma validação de domínio (provavelmente em
  `orderexecution`/`position`) que rejeite qualquer estado que violaria o teto — na prática, isso
  só é possível de violar se a distribuição inicial (Fase B) estourar o total, então a validação
  aqui é sobretudo uma proteção/teste de invariante, não uma regra que trava ordem normal (ordem
  normal só transfere posição já existente entre partes, nunca cria do nada).
- **Critérios de aceite:** teste confirmando que a soma de posições nunca excede
  `outstanding_shares` após qualquer sequência de execuções; teste de regressão pra `fundamentals`
  confirmando que LPA/VPA continuam batendo (não é uma mudança de fórmula, só de garantia).
- **Referências:** proposta 2.2.
- **Dependências:** nenhuma.

---

## Fase B — Distribuição inicial do float

### B.1 · Função pura `bot.InitialAllocation`

- **Descrição:** nova função pura em `internal/domain/bot` (pacote novo): recebe
  `(assetID, totalFloat, marketMakerSharePct, seed)` e devolve a distribuição de posições entre um
  conjunto de bots — Market Maker com 40-60% do float (proposta 2.2), o restante distribuído por
  pesos sorteados de uma distribuição exponencial/Pareto entre os demais bots, normalizados para
  somar exatamente o restante do float. Determinística por seed (mesmo padrão de
  `equity.NextPrice`/`selic.Series`).
- **Critérios de aceite:** teste table-driven cobrindo: soma da distribuição bate exatamente com
  `totalFloat`; Market Maker sempre dentro da faixa 40-60%; mesma seed sempre produz a mesma
  distribuição; distribuição entre não-Market-Maker é visivelmente concentrada (poucos grandes,
  muitos pequenos), não uniforme.
- **Referências:** proposta 2.2.
- **Dependências:** A.1 (bot precisa existir como conta antes de receber posição).

### B.2 · Seed populando bots com posição e caixa inicial

- **Descrição:** `cmd/seed/main.go` passa a criar as contas de bot (A.1) e, pra cada ativo de
  Ação/FII já seedado, chamar `bot.InitialAllocation` (B.1) pra popular `positions` — mais um
  caixa inicial em `accounts.current_balance` por bot, correlacionado ao papel (Market Maker ganha
  caixa maior; bots direcionais ganham caixa proporcional ao tamanho de posição que a
  personalidade tolera, ainda sem personalidade definida nesta tarefa — usar um valor
  proporcional simples até a Fase C existir).
- **Critérios de aceite:** depois do seed, todo ativo de Ação/FII tem 100% do float distribuído
  entre bots (nenhuma posição "solta"); todo bot tem caixa suficiente pra pelo menos uma ordem de
  tamanho médio no ativo que detém.
- **Referências:** proposta 2.2.
- **Dependências:** B.1.

---

## Fase C — Arquétipos e motor de decisão do bot

Fase mais densa do redesenho — o "cérebro" de cada bot. Ordem interna pensada por complexidade
crescente (Ruído primeiro, mais barato; Fundamentalista por último, mais caro).

### C.1 · Domínio `bot`: struct de personalidade

- **Descrição:** define o tipo `bot.Personality` (ou nome equivalente) com as 4 dimensões da
  proposta 2.3.2: arquétipo (enum: ruído/market_maker/chartista/fundamentalista), escopo de
  especialização (lista de setor/`risk_class`/classe de ativo + percentual dentro/fora do escopo,
  85-90%/10-15% confirmado), nível de conhecimento (escalar 0-1, só relevante pro
  fundamentalista, fixo desde o seed — sem dimensão de aprendizado), e perfil de
  risco/agressividade (tamanho de posição tolerado, ordem a mercado vs. limitada, largura de
  spread). Interface pequena declarada no ponto de consumo pra qualquer colaborador externo
  (leitura de fundamentos, de preço, de evento) que a função de decisão precisar, no padrão já
  estabelecido pelo resto do `engine/`.
- **Critérios de aceite:** struct + construtor validando os campos (ex: nível de conhecimento só
  aceito pra arquétipo fundamentalista, percentual de escopo dentro de [0,100]); teste cobrindo
  validação.
- **Referências:** proposta 2.3.2.
- **Dependências:** A.1.

### C.2 · Arquétipo Ruído (Zero-Intelligence com restrição de orçamento)

- **Descrição:** função de decisão mais simples — sorteia lado (compra/venda), quantidade e
  preço-limite aleatórios, restrito ao que o caixa/posição do bot permite (nunca compra acima do
  caixa disponível, nunca vende mais do que tem em posição). Sem opinião sobre valor do ativo.
- **Critérios de aceite:** teste table-driven confirmando que a ordem gerada nunca viola a
  restrição de orçamento/posição, em várias seeds.
- **Referências:** proposta 2.3.1, 2.3.2 (Gode & Sunder 1993).
- **Dependências:** C.1.

### C.3 · Arquétipo Market Maker

- **Descrição:** mantém oferta simétrica dos dois lados do book ao redor do preço corrente
  (spread configurável), sem viés direcional — prioridade em nunca deixar o book vazio. Recebeu a
  maior fatia do float/caixa (B.1/B.2), então precisa de uma função de decisão que sustente isso
  ao longo do tempo (reabastece os dois lados a cada rodada, não só na primeira).
- **Critérios de aceite:** teste confirmando que o Market Maker sempre tem oferta ativa dos dois
  lados após uma rodada de decisão, dado caixa/posição suficiente.
- **Referências:** proposta 2.3.2.
- **Dependências:** C.1.

### C.4 · Arquétipo Chartista/Momentum

- **Descrição:** função de decisão que só olha a série de preço recente (últimas N rodadas/dias,
  a definir) — compra se a tendência for de alta, vende se for de baixa. Não consulta fundamento
  nem evento macro/balanço (só o Fundamentalista lê isso diretamente, proposta 2.3.2).
- **Critérios de aceite:** teste table-driven com séries de preço sintéticas (alta/baixa/lateral)
  confirmando a direção esperada da ordem gerada.
- **Referências:** proposta 2.3.1, 2.3.2.
- **Dependências:** C.1.

### C.5 · Arquétipo Fundamentalista

- **Descrição:** o mais complexo — estima um "preço justo" a partir de `company_fundamentals`
  (P/L, ROE, crescimento) e da Selic simulada (setores cíclicos mais sensíveis que defensivos,
  spec 3.2.2), ponderado pelo nível de conhecimento do bot (conhecimento alto = leitura completa
  com pouco ruído; baixo = leitura parcial/mais ruidosa). Negocia na direção de convergir o preço
  de mercado a essa estimativa. É o único arquétipo que vai ler o efeito de evento macro (Fase E)
  e de balanço (Fase F) — mas essas duas fases vêm depois; nesta tarefa a função de decisão só
  precisa reagir a fundamentos + Selic, sem evento/balanço ainda (isso entra como parâmetro
  adicional na Fase E/F, não uma reescrita).
- **Critérios de aceite:** teste table-driven confirmando que bots de conhecimento alto convergem
  mais rápido/precisamente ao "preço justo" sintético de um cenário controlado do que bots de
  conhecimento baixo; teste confirmando sensibilidade à Selic proporcional ao `risk_class` da
  empresa (setor sofisticado mais sensível que conservador).
- **Referências:** proposta 2.3.1, 2.3.2.
- **Dependências:** C.1.

### C.6 · Escopo de especialização + catálogo de bots

- **Descrição:** monta o catálogo de bots do seed — pool de 15-25 bots por ativo de Renda
  Variável (Ação/FII/ETF), somando os 4 arquétipos, cobrindo os 6 setores fixos da spec 3.3.2 e
  as 3 classes de ativo, com sobreposição suficiente pra nenhum ativo ficar sem bot especializado.
  Cada bot tem seu escopo de especialização (85-90% dentro, 10-15% fora) configurado no seed.
- **Critérios de aceite:** depois do seed, todo ativo de Renda Variável tem pelo menos um bot de
  cada arquétipo cobrindo seu setor/classe dentro do escopo principal; nenhum ativo fica com zero
  bots especializados.
- **Referências:** proposta 2.3.2.
- **Dependências:** C.2, C.3, C.4, C.5, B.2.

---

## Fase D — Cadência intradiária

### D.1 · Sub-tick no Temporizador

- **Descrição:** `tick.Advance` ganha uma etapa nova — sorteia (determinístico por seed do dia)
  quantas rodadas de negociação o dia terá (enviesado pra 2-3, com 1 e 4 mais raros, proposta 2.4)
  e em que pontos não igualmente espaçados do "expediente" simulado do dia cada uma acontece. Não
  muda o ritmo diário do resto do tick (Selic, calendário de relatório, proventos continuam 1x por
  dia) — só adiciona esse sorteio como novo insumo pro que a D.2 consome.
- **Critérios de aceite:** teste confirmando que o número de rodadas sorteado fica sempre entre 1
  e 4, com distribuição visivelmente enviesada pra 2-3 numa amostra grande; mesma seed do dia
  sempre produz a mesma quantidade/horários (determinismo).
- **Referências:** proposta 2.4.
- **Dependências:** nenhuma (pode ser feita em paralelo à Fase C, já que só mexe no
  Temporizador/calendário, não na decisão de bot em si).

### D.2 · Execução de rodadas de negociação dentro do sub-tick

- **Descrição:** pra cada rodada sorteada em D.1, o motor coleta a decisão de cada bot elegível
  (dentro do escopo + a fração fora do escopo, C.6) mais qualquer ordem de usuário chegada nesse
  meio-tempo, e roda o matching via `orderexecution` (já sem liquidez sintética, A.2). O preço de
  fechamento do dia (última negociação da última rodada) é o que grava em `asset_quotes`, mantendo
  a leitura atual (`ORDER BY simulated_day DESC LIMIT 1`) funcionando sem mudança de contrato.
  Negociações intradiárias (todas as rodadas) ficam nos fills de `order_book`/`positions`, sem
  tabela nova.
- **Critérios de aceite:** teste ponta a ponta de um dia simulado com N rodadas confirmando que
  `asset_quotes` recebe exatamente uma linha por ativo por dia (a de fechamento), e que os fills
  de todas as rodadas intermediárias estão registrados e são reconstituíveis (pra uso futuro de
  gráfico intradiário).
- **Referências:** proposta 2.4.
- **Dependências:** D.1, C.6, A.2.

---

## Fase E — Eventos macro por alvo

### E.1 · Direção própria por alvo em `macro_event_targets`

- **Descrição:** `macro_event_targets` ganha um campo de direção/magnitude próprio por alvo, em
  vez de sempre herdar a direção única do evento (`macroevent.go`). Evento "misto" passa a
  declarar 2+ alvos com sinais diferentes (ex: setor Exportador positivo, Importador negativo, no
  mesmo evento) — evento "não-misto" continua simples, todos os alvos herdando a mesma direção
  (sem regressão de UX no painel admin pros casos simples).
- **Critérios de aceite:** teste cobrindo um evento "misto" com 2 alvos de sinais opostos,
  confirmando que cada alvo carrega sua própria direção corretamente; teste de regressão
  confirmando que evento "não-misto" continua funcionando sem precisar declarar nada por alvo.
- **Referências:** proposta seção 3.
- **Dependências:** nenhuma (mudança de schema/domínio isolada do motor de bot).

### E.2 · Efeito de evento macro vira parâmetro de comportamento de bot

- **Descrição:** remove `PriceEffectPct`/`macroPriceMultiplier` (multiplicador direto de preço,
  `tick.go:403-423`). O sinal/magnitude por alvo (E.1) passa a ser lido só pelo arquétipo
  Fundamentalista (C.5) — desloca a estimativa de "preço justo" dos bots cujo escopo cruza com o
  alvo afetado, proporcional ao nível de conhecimento do bot. Chartistas e bots de Ruído nunca
  leem o evento diretamente — só reagem ao preço que já mudou pela negociação dos fundamentalistas
  (proposta 2.3.2/3).
- **Critérios de aceite:** teste ponta a ponta confirmando que um evento macro severo negativo
  num setor move o preço dos ativos daquele setor pra baixo ao longo de algumas rodadas (via
  negociação), sem nenhum salto instantâneo de preço no momento do disparo do evento.
- **Referências:** proposta 2.5, seção 3.
- **Dependências:** E.1, C.5, D.2.

---

## Fase F — Balanços via negociação

### F.1 · Remoção da fórmula de surpresa de balanço

- **Descrição:** remove `fundamentals.ReportSurprise`/`ReportDayPriceEffect` (fórmula de
  sensibilidade direta que move preço no dia do relatório). No dia do relatório, os bots
  Fundamentalistas (C.5) reavaliam a nova `company_fundamentals` contra sua própria expectativa
  (a mesma estimativa de "preço justo" que já calculam todo dia) e negociam de acordo — o preço se
  move pela negociação resultante, mantendo o valor pedagógico de "resultado vs. expectativa"
  (spec) sem a fórmula direta.
- **Critérios de aceite:** teste ponta a ponta cobrindo um ciclo de relatório com resultado melhor
  que o esperado e um pior que o esperado, confirmando que o preço se move na direção certa via
  negociação simulada (não fórmula) em ambos os casos, e que "sem surpresa" (resultado bate com o
  esperado) produz pouco ou nenhum movimento.
- **Referências:** proposta 2.5.
- **Dependências:** C.5, E.2 (compartilha a mesma leitura de fundamentos pelo Fundamentalista).

---

## Fase G — FIIs no motor de negociação real

### G.1 · FII entra no book real (mesmo mecanismo de Ações)

- **Descrição:** remove o GBM/tratamento Conservador de FII (`tick.riskClassForPricing`,
  `tick.go:281-286`, pro lado de FII) — FII passa a negociar no mesmo book/bots de Ações (Fases
  A-D), sem mecanismo de arbitragem tipo ETF (proposta seção 4 — ágio/deságio persistente é
  esperado e correto). Bots de C.6 precisam cobrir FII como uma das 3 classes já previstas no
  escopo de especialização.
- **Critérios de aceite:** FII negocia via `orderexecution` real, preço nasce de negociação; teste
  confirmando ausência de qualquer resquício de GBM no caminho de precificação de FII.
- **Referências:** proposta seção 4.
- **Dependências:** D.2, C.6.

### G.2 · Reavaliação periódica de `NetWorth` (FII tijolo)

- **Descrição:** `fii.Details.NetWorth` (hoje fixo desde o seed) passa a ser reavaliado no mesmo
  ciclo de 14 dias do relatório de empresas, com variação sintética ligada à Selic simulada (juro
  alto pressiona a avaliação de imóveis pra baixo, juro baixo valoriza). Vacância e segmento
  continuam campos cadastrais fixos (não fazem parte desta reavaliação).
- **Critérios de aceite:** teste table-driven da fórmula de variação (juro alto → `NetWorth`
  tende a cair; juro baixo → tende a subir), determinística por seed; teste ponta a ponta
  confirmando nova linha de `NetWorth` a cada ciclo de 14 dias.
- **Referências:** proposta seção 4.
- **Dependências:** G.1.

### G.3 · Reavaliação periódica de `PortfolioValue` (FII papel)

- **Descrição:** `fii.Details.PortfolioValue` (hoje fixo) passa a ser reavaliado no mesmo ciclo de
  14 dias, variando conforme o indexador da carteira (CDI/IPCA+/prefixado) — análogo a como um
  título de renda fixa acumula valor com o tempo.
- **Critérios de aceite:** teste table-driven cobrindo os 3 indexadores possíveis, confirmando que
  `PortfolioValue` acumula corretamente ao longo de ciclos sucessivos.
- **Referências:** proposta seção 4.
- **Dependências:** G.1.

---

## Fase H — ETFs: NAV + Participante Autorizado + rebalanceamento

### H.1 · NAV / iNAV

- **Descrição:** função pura que calcula o valor patrimonial do fundo a partir da soma do valor
  de mercado corrente de todos os ativos da cesta (renda variável, renda fixa marcada a mercado,
  ou cota de FII) mais caixa, menos passivos, dividido pelo número de cotas emitidas. Recalculável
  a cada rodada de negociação (D.1) como iNAV.
- **Critérios de aceite:** teste table-driven cobrindo cesta mista (Ação + renda fixa + FII),
  confirmando o cálculo correto de NAV pra cada combinação de preços de constituinte.
- **Referências:** proposta 5.1, 5.5.
- **Dependências:** G.1 (FII precisa já ter preço de mercado real se estiver na cesta).

### H.2 · Bot mecânico rebalanceador

- **Descrição:** rotina determinística (não personalidade — proposta 5.4) que, dado uma nova
  composição-alvo do índice (revisão periódica ou evento corporativo), calcula a diferença entre a
  cesta atual e a cesta-alvo e emite exatamente as ordens necessárias pra convergir, executando na
  última rodada do dia de rebalanceamento (mesma conta/pipeline de ordem dos bots, `is_bot = true`,
  função de decisão diferente — não personalidade).
- **Critérios de aceite:** teste table-driven "composição antiga → composição nova → ordens
  esperadas", cobrindo pelo menos um caso de revisão periódica e um de evento corporativo (ex:
  ativo da cesta sofrendo forte variação de preço mudando seu peso).
- **Referências:** proposta 5.4.
- **Dependências:** H.1, D.2.

### H.3 · Bot mecânico Participante Autorizado (creation/redemption)

- **Descrição:** reaproveita a mesma função "mecânica" de H.2 com um papel diferente — arbitragem
  entre preço de mercado do ETF e NAV (H.1). Ágio: compra a cesta ao preço de mercado, entrega ao
  fundo, recebe cotas novas (criação), vende no mercado. Deságio: compra cotas baratas, resgata
  pelos ativos subjacentes (destruição de cotas), vende os ativos. O total de cotas em circulação
  do ETF deixa de ser fixo desde o seed.
- **Critérios de aceite:** teste table-driven cobrindo cenário de ágio e de deságio, confirmando
  que a arbitragem sempre empurra o preço de mercado em direção ao NAV e que o total de cotas
  muda na direção certa (cresce no ágio, encolhe no deságio).
- **Referências:** proposta 5.3.
- **Dependências:** H.1, D.2.

### H.4 · `etf_holdings` suporta qualquer classe de ativo na cesta

- **Descrição:** `etf_holdings` (hoje só pensado pra constituinte de renda variável com peso
  percentual) passa a referenciar qualquer `asset_id` do catálogo — Ação, FII ou instrumento de
  renda fixa. Migration de schema + validação de domínio.
- **Critérios de aceite:** teste confirmando que um ETF pode ter cesta mista (Ação + FII + renda
  fixa) e que H.1 precifica cada tipo pela regra correta.
- **Referências:** proposta 5.5.
- **Dependências:** H.1.

---

## Fase I — Selic × IPCA (independente, pode rodar a qualquer momento)

### I.1 · Regra de reação à inflação em `selic.Config`

- **Descrição:** `selic.NextCalendarRate`/`CalendarSeries` ganham um termo novo —
  `peso_inflação × (IPCA_acumulado − meta_IPCA)` — somado ao termo de reversão à média já
  existente. `peso_inflação` vira campo novo em `selic.Config` (parâmetro livre, calibrável, mesmo
  padrão de `Neutral`/`ReversionSpeed`/`Volatility`), com valor default moderado (~1.5x o desvio,
  próximo da regra de Taylor clássica, confirmado na proposta). Precisa também de um jeito de
  acumular o IPCA simulado ao longo do tempo (hoje `ipca.MonthlySeries` não tem estado acumulado
  entre chamadas) — a decidir na sessão se isso vive em `ipca` ou é calculado por quem orquestra
  (`tick`).
- **Critérios de aceite:** teste table-driven confirmando que IPCA persistentemente acima da meta
  empurra a Selic simulada pra cima nas reuniões seguintes (e o inverso pra baixo), com o peso
  default aplicado; teste de regressão confirmando que `peso_inflação = 0` reproduz exatamente o
  comportamento atual (retrocompatibilidade da fórmula).
- **Referências:** proposta seção 6.
- **Dependências:** nenhuma.

### I.2 · Passos discretos do Copom

- **Descrição:** o tamanho do movimento em cada reunião do Copom simulado passa a ser quantizado
  em incrementos de 0,25 p.p. (arredondando o resultado da regra de reação, I.1, pro múltiplo de
  0,25 mais próximo) em vez de um valor decimal contínuo direto do ruído gaussiano.
- **Critérios de aceite:** teste confirmando que toda mudança de Selic simulada em dia de reunião
  é sempre um múltiplo de 0,25 p.p.
- **Referências:** proposta seção 6.
- **Dependências:** I.1.

---

## Fase J — Ações ON/PN

### J.1 · Empresa com 1 ou 2 ativos de Ação vinculados

- **Descrição:** o catálogo passa a suportar uma empresa (`company_id`) com dois ativos de Ação
  (`asset_id` diferentes, ON e PN), cada um com seu próprio ticker/book, ambos compartilhando o
  mesmo ciclo de `company_fundamentals`. Ver nota 6 da seção "Como usar este arquivo" sobre a
  interação com a tarefa `7.2` do backlog principal (`BNDD3`/`BNDD4`).
- **Critérios de aceite:** teste confirmando que duas ações da mesma empresa compartilham o mesmo
  `company_fundamentals` (mesmo balanço) mas têm preços independentes (books separados).
- **Referências:** proposta 2.8, item 1.
- **Dependências:** A.1, A.2 (book real já revertido).

### J.2 · Dividendo com prioridade legal de PN

- **Descrição:** `dividend.EquityValuePerShare` (`dividend.go:44-49`) deixa de assumir uma única
  classe — passa a considerar as duas bases de ações em circulação (ON + PN) e aplicar a vantagem
  de dividendo da PN. Percentual configurável por empresa (campo novo, ex:
  `companies.pn_dividend_premium_pct`), com **10% como default** (piso legal da Lei 6.404/76,
  art. 17, confirmado na proposta).
- **Critérios de aceite:** teste table-driven cobrindo: empresa só-ON (comportamento idêntico ao
  atual, sem quebra de compatibilidade); empresa ON+PN com premium default de 10%; empresa ON+PN
  com premium customizado acima do mínimo.
- **Referências:** proposta 2.8, item 2.
- **Dependências:** J.1.

### J.3 · Bot Fundamentalista valoriza por classe

- **Descrição:** o arquétipo Fundamentalista (C.5) calcula "preço justo" separadamente pra ON e
  PN da mesma empresa — mesmo fundamento (lucro, ROE), mas dividendo esperado por ação diferente
  (J.2), então o valor justo difere ligeiramente entre as duas classes.
- **Critérios de aceite:** teste confirmando que, pra uma empresa ON+PN com premium de dividendo
  configurado, o "preço justo" estimado pelo Fundamentalista pra PN é consistentemente maior que
  o de ON, proporcional ao premium.
- **Referências:** proposta 2.8, item 3.
- **Dependências:** J.2, C.5.

### J.4 · Seed reflete a composição real do mercado

- **Descrição:** ajusta `cmd/seed/main.go` pra que a maioria das empresas nasça só-ON (padrão
  Novo Mercado), com pelo menos uma ou duas empresas clássicas ON+PN (aproveitando ou substituindo
  o par `BNDD3`/`BNDD4` já planejado em `7.2`, conforme a nota 6) — pra exercitar de verdade o
  cenário da lição 2.3 do currículo e o spread de preço entre classes (proposta seção 2).
- **Critérios de aceite:** seed confirmado gerando pelo menos 1 empresa ON+PN funcional (dividendo
  com prioridade, preços independentes) e maioria só-ON entre as demais.
- **Referências:** proposta 2.8, item 5.
- **Dependências:** J.1, J.2, J.3.

---

## Fase K — Calibração de fundamentos por setor (independente)

### K.1 · Pesquisa de dados reais por setor

- **Descrição:** levantamento de margens/alavancagem médias reais e públicas (B3/CVM/relatórios
  setoriais) pros 6 setores fixos da spec 3.3.2 (Mineração, Agronegócio, Bancário/Financeiro,
  Varejo, Energia, Tecnologia), pra substituir os coeficientes hoje "ilustrativos" de
  `fundamentals.go` (margem líquida 10%, margem EBIT 18%, patrimônio = 1.2×receita, dívida =
  0.4×patrimônio, caixa = 15%×receita, sensibilidade à Selic 0.02/0.06 por `risk_class`).
- **Critérios de aceite:** tabela de coeficientes propostos por setor, com fonte citada pra cada
  número, entregue como documento/anexo (não precisa de código nesta tarefa — é pesquisa).
- **Referências:** proposta seção 7.
- **Dependências:** nenhuma.

### K.2 · Aplicação da calibração em `fundamentals.go`

- **Descrição:** os coeficientes agora variam por setor (K.1) em vez de um único conjunto genérico
  pra toda empresa — `fundamentals.go` passa a receber o setor da empresa como insumo pra escolher
  os coeficientes certos.
- **Critérios de aceite:** teste table-driven cobrindo pelo menos 2 setores diferentes com
  coeficientes visivelmente distintos; teste de regressão confirmando que o restante da fórmula
  (crescimento base + ruído + fator Selic) continua funcionando igual, só os coeficientes mudam.
- **Referências:** proposta seção 7.
- **Dependências:** K.1.

---

## Fase L — Renda Fixa: correções cirúrgicas (independente)

Nenhuma destas depende do redesenho de bots/order book — são correções de fórmula já existente e
não usada (relatório `tmp/relatorio-logica-mercado.md`, seções 8.3-8.6).

### L.1 · Rendimento pós-fixado real (Tesouro Selic/CDB %CDI)

- **Descrição:** implementa uma fórmula de rendimento pós-fixado de verdade — hoje usa
  `PrefixedPrice` com taxa estática do catálogo, nunca acompanhando a Selic simulada dia a dia.
  Ganha ainda mais relevância depois da Fase I (Selic reagindo ao IPCA).
- **Critérios de aceite:** teste table-driven confirmando que o rendimento acumulado de um título
  pós-fixado acompanha a série de Selic simulada dia a dia (não uma taxa fixa travada na compra).
- **Referências:** proposta seção 9, item 1; relatório seção 8.3.
- **Dependências:** nenhuma.

### L.2 · VNA real pro Tesouro IPCA+

- **Descrição:** liga `fixedincome.VNAProjected`/`IPCAPrice` (já implementado e testado, sem
  consumidor) na compra/resgate real de Tesouro IPCA+, em vez de continuar usando deságio nominal.
  Exige um `ipca.Config` calibrado (hoje não existe, `ipca.go` documenta isso explicitamente) e
  uma série mensal de IPCA persistida.
- **Critérios de aceite:** teste ponta a ponta confirmando que compra/resgate de Tesouro IPCA+
  usa VNA de verdade, não mais deságio nominal; teste de regressão nos outros 7 produtos
  confirmando que eles continuam usando deságio nominal sem mudança.
- **Referências:** proposta seção 9, item 2; relatório seção 8.4.
- **Dependências:** nenhuma.

### L.3 · Marcação a mercado restrita a produtos prefixados

- **Descrição:** hoje a marcação a mercado via Selic se aplica uniformemente aos 8 tipos de
  produto. Restringe a produtos prefixados de verdade (spec 3.2.1), removendo o efeito de
  produtos pós-fixados/isentos de risco de mercado (Tesouro Selic, CDB %CDI, LCI/LCA, CRI/CRA).
- **Critérios de aceite:** teste confirmando que resgate antecipado de um produto pós-fixado não
  sofre marcação a mercado (ganho/perda sempre proporcional ao rendimento acumulado real, L.1),
  enquanto produto prefixado continua sofrendo normalmente.
- **Referências:** proposta seção 9, item 3; relatório seção 8.5.
- **Dependências:** L.1 (produto pós-fixado precisa já ter rendimento real pra fazer sentido não
  sofrer marcação a mercado via Selic).

### L.4 · Revisitar as 5 decisões de escopo do `fixedincomeexecution`

- **Descrição:** confirmar com o autor as 5 decisões documentadas em
  `fixedincomeexecution.go:7-49` (taxa contratada sempre estática — parcialmente resolvida por
  L.1/L.2; resgate sempre integral; DU calculado por relógio real vs. dia simulado; marcação a
  mercado uniforme — resolvida por L.3; taxa de mercado = Selic uniforme). As que L.1-L.3 não
  resolverem ficam registradas aqui como decisão pendente de confirmação, não assumida.
- **Critérios de aceite:** cada uma das 5 decisões tem uma resposta explícita do autor registrada
  de volta no código/documentação (mesma disciplina do item 5 do "Como trabalhar a partir do
  backlog" do `CLAUDE.md`).
- **Referências:** proposta seção 9, item 4; relatório seção 8.6.
- **Dependências:** L.1, L.2, L.3 (pra saber o que já ficou resolvido antes de levar o resto pra
  confirmação).

---

## Sequência sugerida

1. **A.1 → A.2 → A.3** (fundação — pode já rodar em paralelo às Fases I, K, L, que são
   independentes).
2. **B.1 → B.2** (distribuição do float, depende de A).
3. **C.1 → C.2 → C.3 → C.4 → C.5 → C.6** (arquétipos, depende de B; ordem interna por
   complexidade crescente).
4. **D.1 → D.2** (cadência intradiária, depende de C).
5. **J.1 → J.2 → J.3 → J.4** (ON/PN — só depende de A/C.5, pode entrar em paralelo a partir do
   passo 3).
6. **E.1 → E.2** (eventos macro por alvo, depende de C.5/D.2).
7. **F.1** (balanços via negociação, depende de C.5/E).
8. **G.1 → G.2 → G.3** (FIIs, depende de D).
9. **H.1 → H.2 → H.3 → H.4** (ETFs, depende de D/G).
10. **I.1 → I.2** (Selic × IPCA — independente, pode ser feita a qualquer momento, inclusive
    antes de tudo).
11. **K.1 → K.2** (calibração de fundamentos — independente, idem).
12. **L.1 → L.2 → L.3 → L.4** (Renda Fixa — independente, idem).
