# Backlog — Motor de Mercado Realista

Backlog executável derivado de `.claude/proposta-motor-mercado-realista.md` (redesenho do motor de
precificação de Renda Variável — Ações, FIIs, ETFs —, eventos macro e da relação Selic/IPCA,
disparado pelo diagnóstico em `tmp/relatorio-logica-mercado.md`). Cobre a substituição do modelo
estatístico atual (GBM + multiplicadores de evento) por um motor de negociação real orientado a
book de ofertas e bots comportamentais (Fases A-H), a ligação causal Selic↔IPCA (Fase I), a
introdução de tipos de ação ON/PN (Fase J), a calibração de fundamentos por setor (Fase K), as
correções cirúrgicas de Renda Fixa que não dependem do redesenho de bots (Fase L), tornar Selic e
IPCA visíveis pro usuário — histórico persistido, API, tela e lições novas (Fase M) — e um painel
admin pra operar os bots de liquidez (Fase N). Fases M e N nasceram de um pedido do autor numa
sessão posterior (2026-09-13) que revisou este backlog antes de começar a execução — não fazem
parte da proposta original.

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
   momento, inclusive em paralelo, sem bloquear nem serem bloqueadas pelo resto. **Fase M
   (indicadores macro visíveis) e Fase N (painel admin de bots) também são independentes do núcleo
   A-H**, mas Fase M tem dependência própria da Fase I (ver nota da M.5) e Fase N depende de A.4/C
   (ver nota da Fase N) — não são "independentes de tudo" como I/K/L, só do núcleo de bots.
9. **Interação com o backlog principal, segunda ocorrência**: a tarefa `7.1.3`
   (`backlog-plataforma-investimentos.md`, já concluída) autorou o conteúdo real da lição 2.3
   (Nomenclatura de tickers) usando `VALR3`/`BNDD4` como exemplo de ON/PN — mas hoje são **duas
   empresas diferentes**, não um par de verdade da mesma empresa (esse par só nasce na Fase J
   deste backlog). A tarefa `J.5` abaixo revisita esse conteúdo já escrito pra refletir o par real
   assim que ele existir — mesmo padrão da nota 6 (não é preciso coordenar ordem entre backlogs,
   só conferir se a outra já rodou antes de duplicar trabalho).

---

## Fase A — Fundação: conta de bot e liquidez real

Base de tudo — sem isso nenhuma fase seguinte tem onde pousar. Risco médio-alto: mexe em
`orderexecution.go`, peça central e já testada do motor.

### A.1 · Conta de bot (`is_bot`) e exclusão de ranking/social ✅

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
- **Entregável:** decisão da sessão — `is_bot` vive direto em `accounts` (migration
  `000010_bot_accounts`), não numa tabela auxiliar, já que A.4 (próxima tarefa) precisa do
  `is_active` na mesma tabela. Bot deliberadamente **não** ganha nenhuma linha em `users` (banco
  gamification) — só passa pelo fluxo real de cadastro (`POST /accounts`) uma conta humana; bot
  nasce direto no motor (via `account.NewBot`, tarefa B.2 consome). Isso garante a exclusão de
  ranking/social **por construção**: `GetRankingUseCase`, `SearchUsersUseCase` e
  `SendFriendRequestUseCase` leem só `users`, nunca `accounts`, então nunca enxergam um bot — sem
  precisar de nenhum filtro `WHERE NOT is_bot` espalhado pelo backend. `account.Account` ganhou o
  campo `IsBot` e o construtor `NewBot(userID, initialBalance)` (valida `userID`/saldo, mesmo
  padrão de construtor validado já usado em `catalog`/`macroevent`/`fixedincome`); `New` (conta
  humana) continua com `InitialBalance` fixo (RNF06 intocado). `AccountRepository.Create`/
  `FindByUserID` persistem/leem a coluna nova. Testes novos: `account_test.go` (`TestNewBot`
  table-driven — válido, `userID` vazio, saldo negativo) + 3 testes de regressão no backend
  (`getRanking.test.ts`, `searchUsers.test.ts`, `sendFriendRequest.test.ts`) documentando e
  travando essa garantia com um bot "misturado" a usuários reais nos leitores que a arquitetura
  permite (friend graph, level reader, net worth) sem nunca vazar pro resultado. `go build`/
  `go test ./...`/`golangci-lint run` (Docker, 0 issues) e `npm run lint`/`build`/`test` (565
  testes) verdes; `docker compose up` confirmou a migration aplicando sem erro sobre o volume
  real (149 contas humanas pré-existentes, todas com `is_bot = false` por default) e
  `POST /accounts` continuando a criar conta humana normalmente.

### A.2 · Reverter liquidez sintética em `orderexecution` ✅

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
- **Entregável:** achado importante desta sessão que não estava no texto original da tarefa —
  **sandbox é exceção deliberada, não escopo desta reversão** (proposta motor-mercado-realista
  2.7: sandbox fica 100% fora do redesenho de bots, sem isso o RF12/RNF08 quebraria por completo,
  já que o ativo sandbox nunca teve — nem vai ter — contraparte real nenhuma). `orderexecution.
  Context` ganhou o campo `Sandbox bool`; `Execute` só injeta o Fill sintético
  (`MarketCounterparty`/`IsSynthetic`, ambos mantidos, não removidos) quando `Sandbox = true` —
  Mercado Ao Vivo (`Sandbox = false`) executa só a parte real e reporta a sobra em
  `Outcome.RemainingQuantity`, sem erro. `OrderExecutionRepository.referencePrice` passou a
  devolver também `isSandbox` (já calculava isso internamente pra escolher a fonte do preço, só
  não repassava pro chamador). **Bug real de corrupção de replay encontrado e corrigido nesta
  sessão, fora do texto original:** o `status` de uma ordem `market` sem preenchimento total ainda
  precisa ser gravado como `pending`/`partially_filled` em `order_book` (auditoria — reflete
  quantidade pedida vs. preenchida), mas `loadRestingOrders` lia esse status sem filtrar por
  `type` — sem correção, essa linha voltaria a ser lida como liquidez real pendurada na próxima
  ordem desse ativo (RF04 proíbe ordem `market` de ficar pendurada). Corrigido com
  `AND type = 'limit'` na query. Confirmado ao vivo via `docker compose up`: ordem `market` de
  100 unidades em `VALR3` (Mercado Ao Vivo, sem nenhum bot/float ainda — Fase B/C) devolveu
  `filled_quantity: 0`/`remaining_quantity: 10`, sem debitar saldo nem criar posição, e a query de
  `loadRestingOrders` (rodada manualmente) confirmou que essa linha nunca aparece; a mesma ordem
  em `SAND3` (sandbox) preencheu 100% via liquidez sintética como sempre (`synthetic: true`),
  confirmando a regressão zero pro RF12. `OrderConfirmationDialog.successMessage` (frontend)
  ganhou 2 mensagens novas (execução parcial / execução zero) usando `remaining_quantity`, sem
  mudar o estado de sucesso do diálogo (task pedia mensagem clara, não um novo estado de UI).
  `go build`/`go test ./...`/`golangci-lint` (Docker, 0 issues), `npm test`/`tsc -b`/`oxlint`/
  `prettier`/`npm run build` (frontend, 665 testes) verdes.

### A.3 · Float finito (`outstanding_shares` como teto real) ✅

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
- **Entregável:** `position.ValidateFloatCeiling(totalHeld, outstandingShares int64) error` (nova,
  `internal/domain/position/position.go`) — função pura que rejeita (`ErrFloatExceeded`) qualquer
  soma acima do teto; `orderexecution.Context` ganhou `OutstandingShares *int64` (nil quando o
  ativo não tem esse teto, ex: sandbox — `seedSandboxEquity` já grava `outstanding_shares = NULL`
  de propósito) e `TotalHeldExcludingIncoming int64` (soma das posições de todos os outros
  detentores reais, excluindo o usuário da ordem recebida); `Execute` valida, via `validateFloat`
  (nova função interna), que `TotalHeldExcludingIncoming + IncomingUserPosition` — o snapshot
  **pré-negociação** que `Repository.LoadContext` já lê — nunca excede o teto. Decisão de design
  desta sessão: a checagem usa o total pré-trade, não um total pós-trade recalculado a partir do
  fill — como toda transferência real é zero-sum (sai de um detentor já contabilizado em
  `TotalHeldExcludingIncoming`, entra no usuário da ordem), os dois totais são sempre idênticos;
  calcular o pós-trade a partir do fill somado ao pré-trade contava a mesma quantidade duas vezes
  (bug pego pelo teste de sequência antes de fechar a tarefa). `orderexecution.ErrFloatExceeded`
  (alias de `position.ErrFloatExceeded`) mantém o padrão de handler HTTP só importar
  `orderexecution`; sem tratamento especial em `writeOrderExecutionError` — cai no `500` genérico
  de propósito (violação sinaliza corrupção de estado, não rejeição de negócio como saldo/posição
  insuficiente, que são `422`). `OrderExecutionRepository.LoadContext` (infra) ganhou `floatCeiling`
  — lê `variable_income_assets.outstanding_shares` (nulo pula a segunda query) e
  `SUM(quantity) FROM positions WHERE asset_id = $1 AND user_id != $2`. Testes novos:
  `TestValidateFloatCeiling` (table-driven, `position_test.go`); `TestExecute_FloatFinito`
  (table-driven: compra/venda que preservam o teto, estado corrompido rejeitado, sandbox sem teto
  ignora a checagem) e `TestExecute_FloatFinito_PreservaInvarianteAoLongoDeSequencia` (simula 3
  contas com distribuição inicial somando exatamente `outstandingShares`, roda 3 trades em
  sequência atualizando holdings a cada passo, confirma que a soma nunca excede — e na prática
  nunca muda — o teto), ambos em `orderexecution_test.go`. Regressão de `fundamentals.LPA`/`VPA`
  confirmada sem nenhuma mudança de código (`fundamentals.go`/`indicators.go` intocados — a tarefa
  não altera a fórmula, só adiciona o teto em outro lugar). `go build`/`go test ./...`/
  `golangci-lint run` (Docker, 0 issues) verdes. Validado ao vivo via `docker compose up`: conta
  real criada via `POST /accounts`, posição de um bot forçada via SQL direto pra ficar 1 unidade
  acima do teto de `VALR3` (500.000.000) — `POST /orders` de compra devolveu `500` sem debitar
  saldo nem criar posição; corrigido o estado pra ficar exatamente no teto, a mesma ordem passou a
  executar normalmente (`200`, fill real contra a ordem do bot). Estado de teste revertido
  (`positions`/`order_book` limpos); as duas contas de teste ficaram no banco porque
  `market_events` é append-only por trigger (não dá pra apagar o evento de abertura de conta) —
  resíduo inofensivo, sem posição nem saldo relevante.

### A.4 · Flag `is_active` no bot (interruptor operacional, independente de `is_bot`) ✅

- **Descrição:** pedido do autor além do que a proposta original cobria — precisa de um jeito de
  desligar um bot específico sem apagá-lo, pro caso de um bot individual sair "fora da curva"
  (ex: convergindo pra um preço absurdo, esvaziando o próprio caixa) e for preciso isolar o efeito
  dele pra entender o que aconteceu, sem perder histórico/posição nem mexer nos demais bots. Campo
  novo `is_active boolean not null default true` na mesma tabela/migration de `is_bot` (A.1) —
  **não é o mesmo conceito**: `is_bot` é identidade (essa conta é um bot, nunca deixa de ser),
  `is_active` é controle operacional (esse bot específico está participando das rodadas agora ou
  não, reversível a qualquer momento). Bot inativo é pulado inteiro na coleta de decisões da
  rodada de negociação (D.2) — não gera ordem nenhuma, não é considerado profundidade de book —,
  mas mantém posição/caixa acumulados intocados (não zera, não liquida, não redistribui o float
  que ele carrega; só para de negociar até reativado). `bot.InitialAllocation` (B.1) não precisa
  saber de `is_active` — todo bot nasce ativo no seed.
- **Critérios de aceite:** teste confirmando que um bot com `is_active = false` nunca aparece na
  lista de bots elegíveis pra decisão de uma rodada (D.2), mesmo com escopo/caixa/posição que o
  qualificariam; teste confirmando que desativar um bot não altera posição/caixa dele; teste
  confirmando que reativar volta a incluí-lo normalmente na rodada seguinte.
- **Referências:** pedido do autor nesta sessão (2026-09-13), não coberto pela proposta original.
- **Dependências:** A.1 (mesma tabela/migration).
- **Entregável:** `is_active boolean NOT NULL DEFAULT true` em `accounts` (migration
  `000011_bot_active_flag`, mesma tabela de `is_bot`/A.1, migration separada porque A.1 já estava
  fechada e mergeada). `account.Account.IsActive` novo; `New` (humano) e `NewBot` passam a marcar
  `IsActive: true` explicitamente (não só confiar no `DEFAULT true` do schema — o `INSERT` já lista
  todas as colunas, então o zero-value `false` do Go seria gravado sem isso). Decisão de escopo
  desta sessão, já que a Fase D (coleta de decisões da rodada, D.2) ainda não existe: em vez de
  esperar D.2 pra ter o que testar, a tarefa entrega o pedaço de domínio que D.2 vai consumir depois
  — `Account.EligibleForTradingRound() bool` (`IsBot && IsActive`, pura) é o predicado de
  elegibilidade que a futura coleta de bots vai aplicar; `account.Deactivate`/`Activate` (funções
  puras, mesmo padrão de `position.ApplyBuy`/`ApplySell`) só alternam `IsActive`, nunca tocam
  `CurrentBalance`/`TotalInvested`/`TotalDividendsReceived` nem `IsBot`/`UserID` — a garantia de
  "não mexe no saldo" é estrutural (a função nem tem como tocar os outros campos), não uma
  validação em tempo de execução. Sem endpoint admin nem método de repositório pra alternar
  `is_active` em produção nesta tarefa — isso é escopo explícito da `N.1` (que já cita "A.4" no seu
  próprio texto), pra não duplicar trabalho quando essa fase chegar. `AccountRepository.Create`/
  `FindByUserID` persistem/leem a coluna nova (mesmo padrão de A.1). Testes novos em
  `account_test.go`: `TestAccount_EligibleForTradingRound` (table-driven, cobrindo bot ativo/
  inativo e humano ativo/inativo), `TestDeactivate`/`TestActivate` (confirmam saldo intocado e
  `EligibleForTradingRound()` alternando corretamente); `TestNew`/`TestNewBot` ganharam a
  asserção `IsActive == true`. `go build`/`go test ./...`/`golangci-lint run` (Docker, 0 issues)
  verdes. Validado ao vivo via `docker compose up`: migration aplicou sobre as 153 contas
  existentes (todas `is_active = true` por default); `POST /accounts` real confirmado gravando
  `is_active = true` explicitamente (não só o default do schema); `UPDATE accounts SET is_active =
  false/true` direto via SQL (não há endpoint ainda) confirmou saldo (`current_balance`) intocado
  nos dois sentidos, numa das contas de bot deixadas pela sessão da A.3.

---

## Fase B — Distribuição inicial do float

### B.1 · Função pura `bot.InitialAllocation` ✅

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
- **Entregável:** `internal/domain/bot/allocation.go` (pacote `bot` novo). Assinatura final
  acrescenta um parâmetro que a descrição original não listava mas que a função precisa pra
  existir de fato — `otherBotCount int` (quantos bots além do Market Maker recebem fatia; contagem
  real do pool por ativo só é decidida no catálogo da C.6, então quem chama informa quantas contas
  já criou) —, ficando `InitialAllocation(assetID string, totalFloat int64, marketMakerSharePct
  float64, otherBotCount int, seed int64) (Allocation, error)`. `Allocation{MarketMaker int64,
  Others []int64}` — `MarketMaker` é um agregado único (C.6 ainda não decidiu se o grupo Market
  Maker é uma ou várias contas; quem chama fatia depois); `Others` é posicional (índice, não
  identidade de bot), B.2 associa a uma conta concreta. `marketMakerSharePct` fora de
  `[MarketMakerShareMin, MarketMakerShareMax]` (0.40-0.60, constantes exportadas) retorna
  `ErrInvalidAllocation` — a faixa do critério de aceite é garantida por validação, não por
  sorteio. Restante distribuído por pesos `rand.ExpFloat64()` normalizados (equivalente a um
  simplex de Dirichlet(1,...,1), visivelmente concentrado por estatística de valores extremos) e
  convertidos a inteiros pelo método dos maiores restos (Hamilton apportionment) — garante soma
  exata com `totalFloat` por construção, sem viés sistemático a favor de nenhum índice. Seed por
  ativo derivada via `fnv.New64a()` do `assetID` somado à seed base (mesma técnica de
  `tick.deterministicSeed`, reimplementada localmente porque domínios irmãos não se importam —
  `.claude/arquitetura-engine-go.md`): dois ativos com a mesma seed base nunca sorteiam a mesma
  sequência. Testes novos em `allocation_test.go` (table-driven): soma exata em várias
  combinações de float/contagem/seed; Market Maker sempre dentro da faixa em toda a faixa de
  `marketMakerSharePct`; erro pra `marketMakerSharePct`/`totalFloat`/`otherBotCount` inválidos;
  mesma seed reproduz a mesma distribuição; seeds diferentes e `assetID`s diferentes (mesma seed
  base) produzem distribuições diferentes; concentração (maior fatia individual bem acima da
  fatia uniforme, 20 bots, 10 seeds); caso de 1 único outro bot recebe 100% do restante; fatias do
  método dos maiores restos nunca negativas. `go build`/`go test ./...`/`golangci-lint run`
  (Docker, 0 issues) verdes. Sem tarefa de `.docs/engine/` (função pura de domínio, sem rota HTTP
  nova) e sem validação via `docker compose up` (sem ponto de infra/DB tocado ainda — a integração
  real só existe a partir da B.2, que consome esta função no seed).

### B.2 · Seed populando bots com posição e caixa inicial ✅

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
- **Entregável:** pool único de 20 bots (1 Market Maker + 19 direcionais genéricos, uuids fixos
  `00000000-0000-0000-0000-000000000001..020`) compartilhado entre os quatro ativos de
  Ação/FII já seedados (VALR3/BNDD4/TJLO11/PAPL11) — decisão de escopo desta sessão: a segmentação
  real de 15-25 bots *por ativo* (proposta 2.3.2, item 5) só existe a partir do catálogo da C.6,
  que ainda não roda; até lá um pool só cobre os quatro. `bot.MarketMakerShareMin`/`Max` no meio
  da faixa (50%) e `botOtherBotCount = 19` (constantes em `cmd/seed/main.go`).
  Nova função pura `bot.InitialCash(positionMarketValue, minimumCash, isMarketMaker) float64`
  (`internal/domain/bot/cash.go`, com `cash_test.go`) — Market Maker ganha multiplicador maior
  (`MarketMakerCashMultiplier = 2.0`) que bot direcional (`OtherCashMultiplier = 0.5`) sobre o
  valor de mercado da posição agregada (todos os ativos que o bot detém, a preço
  `tick.DefaultInitialPrice`), com piso (`minimumCash`) pra nenhum bot da cauda da distribuição
  (B.1) nascer sem caixa suficiente pra uma ordem de tamanho médio — piso calibrado no seed como
  100 unidades a `tick.DefaultInitialPrice` (R$ 10.000).
  **Achado crítico desta sessão, não previsto no texto original da tarefa:** o banco de
  desenvolvimento já usado em sessões anteriores tinha posições humanas reais em VALR3/BNDD4
  (ordens executadas pela antiga liquidez sintética, revertida na tarefa A.2, semanas antes deste
  redesenho existir) — distribuir 100% de `outstanding_shares` pros bots nesse cenário estourou o
  teto (`position.ValidateFloatCeiling`, tarefa A.3) por exatamente a quantidade que humanos já
  detinham. A proposta 2.2 assume implicitamente base zerada ("o float nasce 100% alocado a
  bots"), premissa que só vale de fato num banco vazio. Corrigido com
  `AccountRepository.SumHumanHoldings(ctx, assetID)` (nova, soma `positions.quantity` de contas
  `NOT is_bot`) — o seed agora distribui só `outstanding_shares - SumHumanHoldings`, nunca o bruto;
  se o resultado for ≤ 0 (humanos já saturaram o float), pula o ativo com log em vez de estourar.
  Isso é permanente, não só um contorno pra essa sessão: **qualquer seed/repovoamento futuro de
  bots precisa descontar o que humanos já detêm**, mesmo num banco novo onde isso hoje é sempre
  zero. Evento novo `bot_initial_allocation` (`domain.EventBotInitialAllocation`, migration
  `000013_bot_initial_allocation_event`, `ALTER TYPE market_event_type ADD VALUE`) — não reaproveita
  `buy_order_executed` porque a alocação inicial não tem contraparte real (é o float nascendo, não
  uma ordem casada); down migration recria o enum sem o valor novo (Postgres não suporta remover
  valor de enum direto), falha de propósito se alguma linha já usa o valor (Event Sourcing não
  permite apagar evento). `AccountRepository.SeedInitialHolding` (nova) grava esse evento antes de
  projetar `positions`, mesmo padrão de `Create`/`applyPositionFill`
  (`order_execution_repository.go`); idempotente (pula se o bot já tem posição nesse ativo).
  `go build`/`go test ./...`/`golangci-lint run` (Docker, 0 issues) verdes. Validado ao vivo via
  `docker compose up` (volume resetado a pedido do autor depois do achado acima deixar dado
  inconsistente num teste anterior): depois do seed, `SUM(positions.quantity)` bate exatamente com
  `outstanding_shares` nos quatro ativos (nenhuma posição solta, nenhum estouro de teto); Market
  Maker com exatamente 50% de cada float; caixa mínimo de todos os 20 bots bem acima do piso;
  reexecução do seed confirmada idempotente (todas as 20 contas + 80 posições puladas com log
  "já existe").
- **Correções do review do PR #24 (sessão seguinte):** cinco achados corrigidos, dois descartados
  por já serem decisão documentada. Corrigidos: (1) `bot.InitialAllocation` podia estourar a faixa
  40-60% do Market Maker por arredondamento quando `totalFloat` é pequeno (ex: `totalFloat=1`,
  `marketMakerSharePct=0.50` arredondava pra 100%) — agora calcula `minShares`/`maxShares` (teto
  inteiro da faixa) e limita `marketMakerShares` a esse intervalo, retornando
  `ErrInvalidAllocation` quando nenhum inteiro cabe nele; testes novos em `allocation_test.go`
  cobrindo os dois lados. (2) `SeedInitialHolding` não validava
  `position.ValidateFloatCeiling` antes de gravar — ganhou parâmetro `outstandingShares` e passou a
  validar o teto logo depois do INSERT, desfazendo a transação inteira se violar (mesma defesa que
  `orderexecution.Execute` já faz antes de cada negociação); `seedBotLiquidity`/`ensureBotPosition`
  em `cmd/seed/main.go` repassam o `outstandingShares` de cada ativo. (3) `SeedInitialHolding`
  fazia `SELECT EXISTS` + `INSERT` separados (janela de corrida entre duas execuções concorrentes
  do seed) — trocado por `INSERT ... ON CONFLICT (user_id, asset_id) DO NOTHING` (mesma unique
  constraint de `applyPositionFill`), decidindo `created` via `RowsAffected`; evento e validação de
  teto só acontecem quando o INSERT realmente cria a linha, mesma transação garante atomicidade
  mesmo com o INSERT vindo antes do evento. (4) `AccountRepository.Create` gravava o caixa inicial
  de bot sob `initial_deposit` (tipo pensado pro depósito humano fixo de RNF06) — novo evento
  `bot_initial_cash` (`domain.EventBotInitialCash`, migration
  `000014_bot_initial_cash_event`, mesmo padrão de down-migration que falha de propósito sobre
  linha existente de `000013`); `Create` escolhe o tipo por `acc.IsBot`. `eventstore_test.go`
  ganhou os dois tipos que faltavam na tabela de regressão contra o enum Postgres (nenhum dos dois
  estava lá, incluindo o de `000013`, já existente antes desta sessão). Descartados por já serem
  decisão documentada: duplicação de `deterministicSeed` entre `bot`/`tick` (arquitetura Go do
  projeto exige domínios irmãos não se importarem — "a little copying is better than a little
  dependency", `.claude/arquitetura-engine-go.md`) e pool de bots hardcoded em `cmd/seed/main.go`
  (decisão de escopo já registrada acima, resolve na C.6). Falta de teste unitário pra
  `AccountRepository`/`SeedInitialHolding`/`SumHumanHoldings` também não foi tratada como gap: nenhum
  arquivo em `internal/infra/db/` testa SQL contra Postgres real (só `quote_cache_test.go`, que
  testa uma função pura) — a validação desse pacote é sempre via `docker compose up`, convenção já
  seguida por todo o pacote antes desta sessão. `go build`/`go test ./...`/`golangci-lint run`
  (Docker, 0 issues) verdes; `docker compose up` sobre o volume de dev real aplicou a migration
  `000014` sem erro e confirmou a idempotência do seed pós-fix (reexecução pulou as 20 contas + 80
  posições existentes, sem erro de constraint) — as contas de bot já existentes nesse volume
  mantiveram `initial_deposit` (evento imutável, não reescrito retroativamente); só uma conta de
  bot criada depois desta sessão grava `bot_initial_cash`.

---

## Fase C — Arquétipos e motor de decisão do bot

Fase mais densa do redesenho — o "cérebro" de cada bot. Ordem interna pensada por complexidade
crescente (Ruído primeiro, mais barato; Fundamentalista por último, mais caro).

### C.1 · Domínio `bot`: struct de personalidade ✅

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
- **Entregável:** `internal/domain/bot/personality.go` (mesmo pacote `bot` de B.1/B.2, novo
  arquivo). `Archetype` (`ruido`/`market_maker`/`chartista`/`fundamentalista`) com
  `IsValidArchetype` no mesmo padrão de `catalog.IsValidAssetType`/`IsValidSector`. Escopo de
  especialização é `SpecializationScope{Sectors []catalog.Sector, RiskClasses []equity.RiskClass,
  AssetClasses []catalog.AssetType, WithinScopePct float64}` — deliberadamente uma **união**
  (0+ setores + 0+ risk_classes + 0+ classes de ativo simultâneas), diferente do XOR de
  `macroevent.Target` (que descreve um único alvo por vez, não um conjunto); `NewSpecializationScope`
  exige pelo menos uma das três listas não-vazia e valida cada valor contra o conjunto conhecido —
  `RiskClasses`/`AssetClasses` usam cópias locais de validação (`validRiskClasses`/
  `validAssetClasses`, não expostas por `equity`/`catalog`), mesmo raciocínio de "domínios irmãos
  não se importam" já registrado em `allocation.go`; `AssetClasses` restrito às 3 classes de Renda
  Variável (`AssetAcao`/`AssetETF`/`AssetFII`), nunca os 8 tipos de Renda Fixa (bots não cobrem
  Renda Fixa, proposta seção 9). `WithinScopePct` validado contra `SpecializationWithinScopeMin`/
  `Max` (0.85/0.90, escala fração — não 0-100 — pra bater com o padrão já estabelecido por
  `MarketMakerShareMin`/`Max` no mesmo pacote), mesma técnica de "faixa garantida pelo construtor,
  não por sorteio" de B.1. Perfil de risco é `RiskProfile{MaxPositionSizePct, MarketOrderPreference,
  SpreadWidthPct float64}` com `NewRiskProfile` validando `(0,1]`/`[0,1]`/`>=0` respectivamente.
  `Personality{Archetype, Scope, KnowledgeLevel *float64, RiskProfile}` — `KnowledgeLevel` é
  ponteiro deliberadamente (nil pros 3 arquétipos sem essa dimensão) e `NewPersonality` valida a
  regra cruzada do critério de aceite nos dois sentidos: `ArchetypeFundamentalista` exige
  `KnowledgeLevel` não-nil dentro de `[0,1]`, os outros 3 rejeitam (erro, não silenciosamente
  ignoram) qualquer valor não-nil. Sem interface de colaborador externo nesta tarefa — `Personality`
  só descreve dados; a nota do texto original sobre "interface pequena no ponto de consumo" fica
  documentada no comentário do pacote como responsabilidade de C.2-C.5 (cada função de decisão
  declara a sua própria quando existir, não uma abstração prematura aqui). Testes novos
  (`personality_test.go`, table-driven): `TestNewSpecializationScope` (união válida em cada
  combinação das 3 listas, escopo vazio, valor desconhecido em cada lista, classe de ativo de Renda
  Fixa rejeitada, `WithinScopePct` abaixo/acima da faixa), `TestNewRiskProfile` (limites de cada um
  dos 3 campos), `TestNewPersonality` (os 4 arquétipos válidos, arquétipo desconhecido, os 3
  arquétipos não-fundamentalistas rejeitando `KnowledgeLevel`, fundamentalista exigindo e validando
  `KnowledgeLevel`), `TestIsValidArchetype`. `gofmt`/`go build`/`go test ./...`/`golangci-lint run`
  (Docker, 0 issues) verdes. Sem `.docs/engine/` (sem rota HTTP nova) e sem validação via
  `docker compose up` (função pura de domínio sem ponto de infra/DB tocado, mesma nota de escopo já
  registrada em B.1 — a integração real só chega em C.6, que monta o catálogo de bots consumindo
  `Personality`).

### C.2 · Arquétipo Ruído (Zero-Intelligence com restrição de orçamento) ✅

- **Descrição:** função de decisão mais simples — sorteia lado (compra/venda), quantidade e
  preço-limite aleatórios, restrito ao que o caixa/posição do bot permite (nunca compra acima do
  caixa disponível, nunca vende mais do que tem em posição). Sem opinião sobre valor do ativo.
- **Critérios de aceite:** teste table-driven confirmando que a ordem gerada nunca viola a
  restrição de orçamento/posição, em várias seeds.
- **Referências:** proposta 2.3.1, 2.3.2 (Gode & Sunder 1993).
- **Dependências:** C.1.
- **Entregável:** `internal/domain/bot/noise.go` (mesmo pacote `bot`). `Decision{Side, Type, Price,
  Quantity}` novo — tipo de resultado **compartilhado** por qualquer arquétipo (C.3-C.5 devolvem o
  mesmo tipo, só muda a função `Decide*`); reaproveita `orderbook.Side`/`orderbook.Type` em vez de
  redeclarar os mesmos dois enums (mesmo raciocínio de reuso de tipo canônico já usado por
  `macroevent.Target` com `catalog.Sector`). `DecideNoiseOrder(referencePrice, availableCash
  float64, currentPosition int, seed int64) (Decision, error)` — deliberadamente **não recebe
  `Personality`**: Ruído "não tem opinião" (nem sobre valor do ativo, nem sobre `Scope`/
  `RiskProfile`), então threadar a struct inteira só pra ler `Archetype` seria uma dependência sem
  uso real; quem despachar por arquétipo (futuro consumidor em C.6/Fase D) já sabe que é Ruído antes
  de chamar esta função. Preço-limite sorteado dentro de `NoisePriceBandPct` (±5%, constante nova,
  **valor ilustrativo desta sessão — a proposta não fixa uma faixa numérica**, mesma nota de
  "sujeito a calibração futura" já usada em `fundamentals.go`) ao redor de `referencePrice`.
  Restrição de orçamento/posição garantida por construção, não por validação a posteriori: lado só é
  sorteado entre compra/venda quando ambos são viáveis (`availableCash >= preço sorteado` e
  `currentPosition >= 1`); quando só um é viável, o lado é forçado pra esse (nunca sorteia uma venda
  sem posição nem uma compra sem caixa suficiente pra 1 unidade); quando nenhum é viável, devolve
  `ErrNoViableOrder` em vez de uma ordem de tamanho zero — o bot simplesmente não participa da
  rodada (consumo futuro da Fase D). `maxQuantity` (teto do sorteio uniforme `1 + rng.Intn(...)`) é
  `int(availableCash/preço)` na compra ou `currentPosition` na venda — sempre ≥ 1 no ponto em que é
  usado, porque a checagem de viabilidade já passou antes. Determinística por seed (`rand.New(rand.
  NewSource(seed))`, mesmo padrão de `InitialAllocation`/`InitialCash`). Testes novos (`noise_test.go`,
  table-driven, 200 seeds por caso): nunca excede caixa/posição em 6 combinações de caixa/posição/
  preço (incluindo casos "só 1 unidade cabe" nos dois lados), preço sempre dentro da faixa, mesma
  seed reproduz a mesma decisão, lado forçado corretamente quando só um é viável (50 seeds ×2
  sub-casos), erro `ErrNoViableOrder` sem caixa nem posição e com caixa insuficiente pra 1 unidade
  (mesmo com posição zero), erro `ErrInvalidReferencePrice` pra preço ≤ 0. `gofmt`/`go build`/
  `go test ./...`/`golangci-lint run` (Docker, 0 issues) verdes. Sem `.docs/engine/` e sem
  `docker compose up` (mesma nota de escopo de C.1/B.1 — função pura, sem infra tocada; a chamada
  real só existe a partir da Fase D, que orquestra a rodada de negociação).

### C.3 · Arquétipo Market Maker ✅

- **Descrição:** mantém oferta simétrica dos dois lados do book ao redor do preço corrente
  (spread configurável), sem viés direcional — prioridade em nunca deixar o book vazio. Recebeu a
  maior fatia do float/caixa (B.1/B.2), então precisa de uma função de decisão que sustente isso
  ao longo do tempo (reabastece os dois lados a cada rodada, não só na primeira).
- **Critérios de aceite:** teste confirmando que o Market Maker sempre tem oferta ativa dos dois
  lados após uma rodada de decisão, dado caixa/posição suficiente.
- **Referências:** proposta 2.3.2.
- **Dependências:** C.1.
- **Entregável:** `internal/domain/bot/marketmaker.go` (mesmo pacote `bot`).
  `DecideMarketMakerOrders(personality Personality, referencePrice, availableCash float64,
  currentPosition int) ([]Decision, error)` — diferente de `DecideNoiseOrder` (C.2), **recebe a
  `Personality` inteira** (não só parâmetros soltos), porque de fato consome `RiskProfile.
  SpreadWidthPct` (largura do spread) e `RiskProfile.MaxPositionSizePct` (fração de caixa/posição
  ofertada por lado) — a nota de C.2 sobre "só recebe o que o arquétipo realmente consome" se
  confirma aqui no sentido oposto. Primeira função do pacote a validar `personality.Archetype`
  contra o arquétipo esperado (`ErrWrongArchetype` novo, genérico o suficiente pra C.4/C.5
  reaproveitarem em vez de recriar por arquétipo). **100% determinístico, sem seed** — diferente do
  Ruído, Market Maker não sorteia nada: mesmo preço de referência + mesmo estado de caixa/posição
  sempre produz a mesma cotação; "reabastecer a cada rodada" não é estado guardado por esta função,
  é só o efeito de chamá-la de novo (Fase D) com o caixa/posição já atualizados pelos fills da
  rodada anterior — confirmado por um teste dedicado que simula 5 rodadas sucessivas atualizando
  caixa/posição a cada iteração. Preço de compra/venda: `referencePrice*(1 ∓ spread/2)` — `spread`
  é a largura **total** (não a meia largura); `ErrInvalidSpreadForQuote` novo rejeita
  `SpreadWidthPct >= 2` (preço de compra ficaria ≤ 0), um teto que `NewRiskProfile` (C.1) não
  aplica de propósito (só Market Maker deriva preço a partir do spread; os outros arquétipos não
  têm essa restrição). Quantidade de cada lado usa a função interna `quantityFraction(max, pct)` —
  `int(max*pct)`, nunca menos que 1 quando esse lado já é viável (garante "nunca deixar o book
  vazio" mesmo quando a fração arredondaria pra zero) e nunca mais que `max` (porque `pct <= 1`,
  validado por `NewRiskProfile`). Devolve os dois lados (`[]Decision{compra, venda}`, nessa ordem)
  quando ambos são viáveis; só o lado viável quando falta caixa suficiente pra 1 unidade de compra
  ou não há posição pra vender; `ErrNoViableOrder` (reaproveitado de C.2, mesmo pacote) quando
  nenhum dos dois é viável. Testes novos (`marketmaker_test.go`, table-driven): sempre 2 lados com
  recurso suficiente (3 combinações de spread/fração/preço), spread simétrico exato ao redor do
  preço de referência, determinismo (mesma chamada duas vezes), só lado de venda sem caixa, só lado
  de compra sem posição, sustentação ao longo de 5 rodadas simuladas, erro sem caixa nem posição,
  erro de arquétipo errado (`Personality` de Ruído passada por engano), erro de preço de referência
  inválido, erro de spread inválido (`>= 2`). `gofmt`/`go build`/`go test ./...`/
  `golangci-lint run` (Docker, 0 issues) verdes. Sem `.docs/engine/` e sem `docker compose up`
  (mesma nota de escopo de C.1/C.2/B.1 — função pura, consumo real só a partir da Fase D).

### C.4 · Arquétipo Chartista/Momentum ✅

- **Descrição:** função de decisão que só olha a série de preço recente (últimas N rodadas/dias,
  a definir) — compra se a tendência for de alta, vende se for de baixa. Não consulta fundamento
  nem evento macro/balanço (só o Fundamentalista lê isso diretamente, proposta 2.3.2).
- **Critérios de aceite:** teste table-driven com séries de preço sintéticas (alta/baixa/lateral)
  confirmando a direção esperada da ordem gerada.
- **Referências:** proposta 2.3.1, 2.3.2.
- **Dependências:** C.1.
- **Entregável:** `internal/domain/bot/chartist.go` (mesmo pacote `bot`).
  `DecideChartistOrder(personality Personality, priceHistory []float64, availableCash float64,
  currentPosition int) (Decision, error)` — `priceHistory` é a janela de preço recente em ordem
  cronológica (mais antigo primeiro); "quantas rodadas/dias entram na janela" é decisão de quem
  chama (Fase D), não desta função — ela só precisa do primeiro e do último ponto pra calcular a
  variação percentual (`momentum = (último-primeiro)/primeiro`). **100% determinístico**, mesmo
  padrão de `DecideMarketMakerOrders` (C.3) — sem seed, a proposta não pede nenhum sorteio pro
  Chartista. Tendência: `momentum > ChartistTrendThresholdPct` (1%, constante nova — mesma nota de
  "valor ilustrativo sujeito a calibração" de `NoisePriceBandPct`, C.2) compra;
  `momentum < -ChartistTrendThresholdPct` vende; dentro da faixa devolve `ErrNoClearTrend` novo — a
  distinção importante desta tarefa: **`ErrNoClearTrend` (sem sinal, mercado lateral) é um erro
  diferente de `ErrNoViableOrder`** (sinal existe, mas falta caixa/posição pro lado indicado) —
  ambos fazem o bot ficar de fora da rodada, mas por motivos semanticamente distintos, úteis pra
  quem for logar/depurar o comportamento do motor depois. Preço da ordem é sempre o último preço da
  janela (o mais recente observado); quantidade reaproveita `quantityFraction` (mesma função
  interna de C.3) sobre `RiskProfile.MaxPositionSizePct` — nenhuma duplicação de lógica de
  "fração de caixa/posição, nunca zero quando o lado é viável" entre os dois arquétipos, como já
  antecipado na memória de progresso da C.3. Reaproveita `ErrWrongArchetype`/`ErrInvalidReferencePrice`/
  `ErrNoViableOrder` do resto do pacote em vez de redeclarar. Testes novos (`chartist_test.go`,
  table-driven): direção conforme a tendência (alta/baixa/lateral em dois formatos, incluindo
  primeiro==último), nunca excede caixa/posição (4 combinações de tendência/recurso × 3 frações de
  `MaxPositionSizePct`), preço da ordem é o último da janela, determinismo, erro de recurso
  insuficiente pro lado indicado pela tendência (alta sem caixa, baixa sem posição), erro de
  histórico insuficiente (`nil`/vazio/1 ponto), erro de preço inválido no primeiro ou último ponto
  da janela, erro de arquétipo errado. `gofmt`/`go build`/`go test ./...`/`golangci-lint run`
  (Docker, 0 issues) verdes. Sem `.docs/engine/` e sem `docker compose up` (mesma nota de escopo de
  C.1-C.3/B.1).

### C.5 · Arquétipo Fundamentalista ✅

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
- **Entregável:** `internal/domain/bot/fundamentalist.go` (mesmo pacote `bot`). Decisão de design
  central desta sessão, documentada no comentário do pacote: **modelo de "preço justo" é Justified
  Price-to-Book** — `fairPrice = VPA × (ROE / retorno_exigido) × (1 + crescimento)` — em vez de uma
  razão P/L literal, porque P/L exigiria o preço como insumo (circular: não dá pra estimar preço a
  partir de uma razão que já contém preço). "P/L" da descrição da tarefa entra indiretamente via
  ROE/VPA, o par canônico de valuation por patrimônio equivalente ao papel que P/L cumpriria numa
  razão preço/lucro — decisão sem fórmula fechada na proposta, mesmo tratamento "ilustrativo,
  sujeito a calibração futura" já dado a outros coeficientes de `fundamentals.go`.
  `retorno_exigido = selicNeutral + fundamentals.SensitivityByRiskClass[riskClass] × (selicAnnualRate
  − selicNeutral)` — **reaproveita o coeficiente já existente** (0.02 Conservador / 0.06
  Sofisticado, `fundamentals.go`) em vez de inventar uma tabela nova, e é isso que produz a
  sensibilidade proporcional ao `risk_class` do critério de aceite por construção (retorno exigido
  sobe mais pro Sofisticado com o mesmo choque de Selic → `ROE/retorno_exigido` cai mais → preço
  justo cai mais). `FundamentalistFairPrice(financials fundamentals.Financials, outstandingShares
  int64, growthRate, selicAnnualRate, selicNeutral float64, riskClass equity.RiskClass) (float64,
  error)` é a estimativa **sem ruído** ("verdadeira") — reaproveita `fundamentals.ROE`/
  `fundamentals.VPA`/`fundamentals.SensitivityByRiskClass` diretamente (nenhuma fórmula duplicada);
  clampada em `FundamentalistMinFairPrice` (0.01, piso arbitrário — ROE muito negativo pode produzir
  um valor não-positivo, que não faz sentido como preço-limite). `DecideFundamentalistOrder(...)`
  (11 parâmetros — a função com mais entradas do pacote, refletindo ser "a mais cara" da proposta)
  chama `FundamentalistFairPrice` e aplica ruído multiplicativo (`rand.NormFloat64() ×
  FundamentalistMaxNoiseStdDevPct × (1 − *personality.KnowledgeLevel)`, 10% de desvio-padrão no
  conhecimento zero decaindo linearmente a 0 no conhecimento 1 — mesma nota de "valor ilustrativo"
  de `NoisePriceBandPct`/`ChartistTrendThresholdPct`), compara a estimativa (já com ruído) contra
  `currentMarketPrice` com uma faixa morta (`FundamentalistMispricingThresholdPct`, 1%) — dentro
  dela devolve `ErrNoMispricingDetected` **novo**, deliberadamente distinto de `ErrNoClearTrend` (C.4):
  lá é "mercado lateral, sem sinal", aqui é "preço já convergiu à minha estimativa", semânticas
  diferentes mesmo com efeito prático igual (bot fica de fora da rodada). A ordem gerada é sempre
  limitada à própria estimativa de preço justo (o bot negocia até o preço em que acredita, não
  além); quantidade reaproveita `quantityFraction` (mesma função de C.3/C.4) sem duplicação.
  Reaproveita `ErrWrongArchetype` (C.3), `ErrMissingKnowledgeLevel` (C.1, checado defensivamente
  aqui embora `NewPersonality` já garanta não-nil pro Fundamentalista), `ErrInvalidReferencePrice`
  (C.2) e `ErrNoViableOrder` (C.2) do resto do pacote — três erros novos específicos desta tarefa:
  `ErrUnknownRiskClass`, `ErrInvalidFinancials` (ROE/VPA indefinidos), `ErrInvalidRequiredReturn`
  (retorno exigido ≤ 0). Testes novos (`fundamentalist_test.go`): sensibilidade à Selic proporcional
  ao `risk_class` (queda percentual do Sofisticado maior que a do Conservador com o mesmo choque) +
  regressão "sem choque de Selic, `risk_class` não importa"; conhecimento alto converge bem mais
  (desvio médio absoluto sobre 300 seeds, margem de segurança de 2x sobre uma proporção teórica de
  ~19x, preço de mercado deliberadamente a 30% do preço justo pra nenhuma amostra inverter de lado
  por causa do ruído); direção conforme o desvio (compra/venda, ruído zerado com conhecimento=1);
  erro de "sem mispricing claro"; nunca excede caixa/posição (4 cenários × 3 níveis de conhecimento
  × 3 frações de `MaxPositionSizePct` × 20 seeds); determinismo; erro de recurso insuficiente pro
  lado indicado (compra sem caixa, venda sem posição); erro de arquétipo errado; erro de
  `KnowledgeLevel` nil (`Personality` montada direto, não via `NewPersonality`, simulando estado
  inválido defensivamente); erro de preço de mercado inválido; erro de `risk_class` desconhecida;
  erro de financeiros inválidos (patrimônio líquido zero, ações em circulação zero); erro de retorno
  exigido inválido (Selic extrema o suficiente pra ficar ≤ 0). `gofmt`/`go build`/`go test ./...`/
  `golangci-lint run` (Docker, 0 issues) verdes. Sem `.docs/engine/` e sem `docker compose up`
  (mesma nota de escopo de C.1-C.4/B.1 — função pura, consumo real só a partir da Fase D/E).

### C.6 · Escopo de especialização + catálogo de bots ✅

- **Descrição:** monta o catálogo de bots do seed — pool de 15-25 bots por ativo de Renda
  Variável (Ação/FII/ETF), somando os 4 arquétipos, cobrindo os 6 setores fixos da spec 3.3.2 e
  as 3 classes de ativo, com sobreposição suficiente pra nenhum ativo ficar sem bot especializado.
  Cada bot tem seu escopo de especialização (85-90% dentro, 10-15% fora) configurado no seed.
- **Critérios de aceite:** depois do seed, todo ativo de Renda Variável tem pelo menos um bot de
  cada arquétipo cobrindo seu setor/classe dentro do escopo principal; nenhum ativo fica com zero
  bots especializados.
- **Referências:** proposta 2.3.2.
- **Dependências:** C.2, C.3, C.4, C.5, B.2.
- **Entregável:** decisão de escopo desta sessão — **não cria um pool novo**: o pool de 20 contas
  já criado por B.2 (1 Market Maker + 19 direcionais) já cai dentro da faixa 15-25 confirmada pela
  proposta, então C.6 só **atribui personalidade** (arquétipo + escopo de especialização) a essas
  20 contas já existentes, em vez de criar contas adicionais. `internal/domain/bot/catalog.go`
  (mesmo pacote `bot`) — `AssignSpecializations(archetypes []Archetype, sectors []catalog.Sector,
  assetClasses []catalog.AssetType, botCount int) ([]SpecializationAssignment, error)`, pura e
  100% determinística (mesmo espírito de C.3/C.4: é partição, não sorteio): distribui `botCount`
  bots entre `archetypes` o mais igualmente possível (`evenSplit`, mesmo raciocínio de rateio
  proporcional de `largestRemainderAllocation`/B.1, simplificado porque todo "peso" aqui é igual —
  1 bot = 1 bot); dentro de cada arquétipo, `sectors`+`assetClasses` viram uma sequência única de
  "chaves de cobertura" (`coverageKey`, união opaca das duas) particionada entre os bots daquele
  arquétipo via `chunkKeysAcrossBots` — dois caminhos: `botCount >= chaves` (mais bots que chaves:
  os primeiros recebem 1 chave distinta cada, o excedente repete a partir do início, round-robin —
  nunca um bot fica com escopo vazio, o que violaria `NewSpecializationScope`/C.1) e
  `botCount < chaves` (menos bots que chaves: chaves particionadas em `botCount` grupos contíguos
  o mais equilibrados possível via `evenSplit`, cobrindo todas sem repetição). Erros novos:
  `ErrNoArchetypesToAssign`, `ErrInsufficientBotsForArchetypes` (`botCount < len(archetypes)`),
  `ErrNoCoverageKeys`. **Ação não é uma chave de cobertura própria** — decisão de design: todo
  ativo `type=acao` já tem `company_sector`, então cobertura por setor já cobre Ação por
  construção; só FII/ETF (sem setor no catálogo atual) entram como chaves de classe de ativo
  (`nonEquityAssetClasses`), evitando um grupo "genérico de Ação" redundante com os grupos por
  setor. Testes novos (`catalog_test.go`, table-driven): cobertura completa por arquétipo (cenário
  real — 3 arquétipos, 6 setores + FII/ETF, 19 bots), nenhum bot com escopo vazio, tamanho total
  bate com `botCount`, distribuição equilibrada entre arquétipos (diferença máxima de 1),
  determinismo, os dois caminhos de `chunkKeysAcrossBots` isolados (mais bots que chaves — força
  wraparound; menos bots que chaves — força chunking, confirma soma exata sem repetição), os 3
  erros de validação. `go build`/`go test ./...`/`golangci-lint run` (Docker, 0 issues) verdes.
  **Persistência nova** (diferente de C.1-C.5, que eram só domínio): migration
  `000015_bot_personalities` — tabela `bot_personalities` (arquétipo, `within_scope_pct`,
  `knowledge_level` nullable com `CHECK` espelhando a mesma regra de `NewPersonality` — só
  não-nulo pra `fundamentalista` —, perfil de risco) + `bot_personality_scopes` (uma linha por
  item de escopo — união, não uma linha só com 3 colunas nullable como `macro_event_targets`, que
  é XOR; `CHECK num_nonnulls(sector, risk_class, asset_class) = 1` por linha, mesmo padrão de
  `macro_target_scope_chk`). Coluna `risk_class` incluída na tabela de escopo mesmo não usada por
  este seed (`AssignSpecializations` não cobre por risk_class) — decisão desta sessão pra deixar o
  schema completo relativo ao que `bot.Personality`/`NewSpecializationScope` já suportam, evitando
  uma migration de retrabalho quando `N.1` (painel admin, `POST /admin/bots` com personalidade
  arbitrária) chegar. `internal/infra/db/bot_repository.go` (`BotRepository`, novo, mesmo padrão
  não-event-sourced de `CatalogRepository` — personalidade é dado de catálogo/config, não estado
  financeiro) — `CreatePersonality`/`FindPersonalityByAccountID`; a leitura reconstrói via
  `bot.NewSpecializationScope`/`NewRiskProfile`/`NewPersonality` (nunca um struct literal direto),
  então uma linha corrompida no banco nunca produz uma `Personality` que viole os próprios
  invariantes do domínio. Sem teste unitário pro pacote `db` (mesma convenção já registrada em
  B.2 — só `docker compose up` valida SQL contra Postgres real). `cmd/seed/main.go`:
  `seedBotPersonalities` (nova) chama `AssignSpecializations` com `sixFixedSectors`/
  `nonEquityAssetClasses`/`botOtherBotCount` pros 19 bots direcionais e monta a personalidade do
  Market Maker à parte (escopo amplo — todos os 6 setores + FII/ETF, `WithinScopePct` no teto da
  faixa — coerente com já concentrar a maior fatia do float/caixa desde B.1/B.2);
  `botSpecializationWithinScopePct` fixo no meio da faixa (0.875, mesmo raciocínio de
  `botMarketMakerSharePct` em B.2); nível de conhecimento dos bots Fundamentalistas sorteado
  (determinístico por `botSeed`, não um valor único igual pra todos); `ensureBotPersonality`
  idempotente, mesmo padrão de `ensureBotAccount`/`ensureBotPosition`. Validado ao vivo via
  `docker compose up` (build limpo do `engine`, migration `000015` aplicada sem erro): seed criou
  as 20 personalidades (1 `market_maker`, 7 `ruido`, 6 `chartista`, 6 `fundamentalista` —
  `evenSplit(19,3)`), reexecução do seed confirmada idempotente (20 "já existe — pulando"); query
  direta contra `bot_personality_scopes`/`bot_personalities` confirmou os 4 arquétipos presentes
  em cada um dos 6 setores + FII + ETF (32 combinações arquétipo×chave, todas com pelo menos 1
  bot) — critério de aceite satisfeito; `knowledge_level` populado só nas 6 linhas
  `fundamentalista` (valores distintos entre si, confirmando o sorteio), nulo nas 14 restantes,
  batendo exatamente com o `CHECK` da migration.

---

## Fase D — Cadência intradiária

### D.1 · Sub-tick no Temporizador ✅

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
- **Entregável:** `internal/domain/tick/intraday.go` (mesmo pacote `tick`, novo arquivo — decisão
  de escopo desta sessão: fica dentro de `tick`, não um pacote novo, porque é uma etapa da própria
  orquestração diária do Temporizador, não um conceito de domínio reutilizável por outro pacote
  ainda; se a Fase D.2 precisar expor isso pra fora de `tick`, revisita então). `IntradayRound
  {SequenceIndex int, TimeOfDay float64}` — `TimeOfDay` é a posição relativa dentro do "expediente"
  simulado (`[0,1)`, não um horário de relógio real — o motor não modela hora do dia) usada só pra
  ordenar as rodadas entre si; `IntradayRounds(seed int64, dayIndex int) []IntradayRound` sorteia
  quantas rodadas (1-4, `intradayRoundCount`, pesos ilustrativos 15%/35%/35%/15% — mesma nota de
  "sujeito a calibração futura" já usada em `bot.NoisePriceBandPct`/`bot.ChartistTrendThresholdPct`)
  e os N pontos (sorteios independentes em `[0,1)`, ordenados) em vez de slots fixos — atende
  literalmente o pedido do autor de horário "variável e não previsível", já que nenhum cronograma
  fixo é usado. RNG derivado via `deterministicSeed(seed, "intraday-rounds") + dayIndex` — mesma
  técnica de isolamento de processo por entidade já usada em `equity.NextPrice`/
  `fundamentalsConfig`, aqui com um id fixo em vez de `asset_id`/`company_id` (é um processo único
  por dia, não por entidade do catálogo); garante que esta sortição nunca compartilha o stream de
  números aleatórios de Selic/GBM/fundamentos no mesmo dia, mesmo reaproveitando a mesma seed base.
  `Advance` chama `IntradayRounds(seed, dayIndex)` e expõe o resultado em `Result.IntradayRounds`
  (campo novo) — decisão desta sessão: vira parte do `Result` (não fica só uma função solta) porque
  a descrição da tarefa pede explicitamente que `Advance` "ganhe uma etapa nova", mas nada mais no
  `Advance` consome esse valor ainda (nenhum outro campo do `Result` muda de comportamento) — é
  só o novo insumo que a D.2 vai usar; `Repository.SaveTick`/schema não mudam (nada novo pra
  persistir ainda, sem tabela/rota pra isso nesta tarefa). Testes novos: `intraday_test.go`
  (`TestIntradayRounds_CountAlwaysWithinRange`, `TestIntradayRounds_DistributionBiasedTowards2And3`
  — 5000 amostras confirmando todo count 1-4 aparece e `count(2)+count(3) > count(1)+count(4)` —,
  `TestIntradayRounds_Deterministic`, `TestIntradayRounds_DifferentDaysProduceDifferentSchedules`,
  `TestIntradayRounds_SequenceIndexAndTimeOfDayAreValid` — `TimeOfDay` dentro de `[0,1)` e ordenado
  ascendente, `SequenceIndex` batendo com a posição); regressão em `tick_test.go`
  (`TestAdvance_IntradayRounds_PopulaDeterministicamentePorDia`,
  `TestAdvance_IntradayRounds_NaoAfetaOutrosCamposDoResult` — mesma asserção de
  `TestAdvance_SemCotacaoAnteriorUsaDefaultInitialPrice`, confirmando que a cotação gerada não mudou
  com a sortição nova). `gofmt`/`go build`/`go test ./...`/`golangci-lint run` (Docker, 0 issues)
  verdes. Sem `.docs/engine/` (sem rota HTTP nova ou alterada — `tickResponse`/`handleAdminTick` não
  expõem `IntradayRounds`, decisão de escopo: nada consome esse dado publicamente ainda). Validado
  ao vivo via `docker compose up`: `POST /admin/tick` (via rede interna do Compose, motor não expõe
  porta pro host) respondeu normalmente (`day: 1`, 5 cotações), confirmando que adicionar o campo
  novo ao `Result` não quebrou o fluxo real do Temporizador; containers parados ao final
  (`docker compose stop`, sem `-v`) preservando o volume de dev existente.

### D.2 · Execução de rodadas de negociação dentro do sub-tick ✅

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
- **Entregável:** escopo restrito a Ação (VALR3/BNDD4 hoje) — FII/ETF continuam em GBM até as Fases
  G/H estenderem o mesmo motor pra eles; "ordem de usuário chegada nesse meio-tempo" não exigiu
  nenhuma mudança no fluxo humano (`POST /orders` continua síncrono, mesmo `orderexecution.Service`)
  porque o book real já reflete qualquer ordem/posição humana pendurada — a coleta de bot só precisa
  negociar contra o mesmo book, não esperar por nada.
  - `internal/domain/bot/round.go` (novo): `SpecializationScope.MatchesEquity` (checa se um
    setor/risk_class cai no escopo do bot, união igual a `NewSpecializationScope`);
    `SelectAssetForRound` (sorteia o ativo da rodada — `WithinScopePct` das vezes um ativo dentro do
    escopo, o resto fora, com fallback pro grupo não-vazio quando um dos dois lados não existe pro
    universo atual — cobre tanto o Market Maker, cujo escopo cobre tudo, quanto um bot cujo escopo
    não bate com nenhum ativo hoje seedado); `DecisionInput`/`Decide` (dispatcher único por
    arquétipo, normaliza o retorno de C.2-C.5 pra `[]Decision`, propaga sem tradução os erros de
    "bot não participa desta rodada").
  - `internal/domain/tick/rounds.go` (novo) — `Service.runIntradayRounds`, não é função pura (só
    `Advance` é, `rounds.go` documenta isso explicitamente): roda cada rodada sequencialmente, bot a
    bot (roster ordenado por `UserID`, RNF08), rastreando o preço de referência de cada Ação **em
    memória** (não em `asset_quotes`, que só reflete o fechamento do dia anterior até o fim do tick)
    e atualizando a cada fill real — é isso que dá path-dependence dentro do próprio dia, entre
    rodadas e entre bots da mesma rodada. Novas interfaces pequenas no ponto de consumo:
    `BotRoster`/`PriceHistoryReader`/`OrderContextLoader`/`OrderSubmitter` — as duas últimas
    redeclaram (1 método cada) capacidades que `orderexecution.Repository`/`Service` já expõem,
    implementadas pelos mesmos `*db.OrderExecutionRepository`/`*orderexecution.Service` que
    `POST /orders` usa, sem caminho paralelo pra ordem de bot. `roundSeed` deriva uma seed
    determinística e independente por (dia, rodada, bot, propósito) via `deterministicSeed` (já
    existia em `tick.go`). Erro de decisão (`ErrNoViableOrder`/`ErrNoClearTrend`/
    `ErrNoMispricingDetected`/`ErrInsufficientPriceHistory`, ou insumo ausente pro arquétipo — ex:
    Fundamentalista sem `CompanyID`/`OutstandingShares`/`CompanyContext`) só pula o bot nessa rodada;
    erro de IO (`LoadContext`/`Submit`/leitura de roster/histórico) propaga e aborta o tick inteiro,
    mesmo padrão do resto de `Run`.
  - `tick.go`: `AssetForPricing` ganhou `Type string` (cru, mesma convenção de `Sector`/`RiskClass`
    já documentada) — `Advance` pula Ação (`assetTypeAcao`) no loop de GBM, e `Result` ganhou
    `IntradayFillsCount` (observabilidade, preenchido só por `Service.Run` depois de
    `runIntradayRounds`, nunca por `Advance`) e `CompanyContext map[string]CompanyRoundContext`
    (financeiros derivados + crescimento esperado de **toda** empresa, não só as de dia de relatório
    — `companyRoundContexts`, novo — pro Fundamentalista reavaliar preço justo em qualquer dia, não
    só no dia da divulgação). `Service.Run` chama `runIntradayRounds` logo depois de `Advance` e
    antes de `SaveTick`, mesclando o fechamento de cada Ação em `result.Quotes` — `SaveTick`
    continua gravando exatamente uma linha por ativo por dia sem nenhuma mudança de schema/contrato
    (critério de aceite).
  - `db.BotRepository.ListEligibleForTradingRound` (novo) — junta `accounts`+`bot_personalities`,
    filtra por `account.EligibleForTradingRound` (`IsBot && IsActive`, A.4) **em Go**, reaproveitando
    o predicado que A.4 construiu pra este uso exato, em vez de duplicar `is_bot AND is_active` cru
    em SQL. `db.TickRepository.RecentClosingPrices` (novo) — janela de fechamentos diários pro
    Chartista (`tick.ChartistPriceHistoryDays = 5`, ilustrativo). `ListPricingAssets` ganhou a
    coluna `type` na projeção.
  - `httpserver/admin.go`: `tickResponse` ganhou `bot_fills_count` (= `Result.IntradayFillsCount`).
    `.docs/engine/tick.md`/`catalog.md` atualizados (rota alterada, mesmo tick/sessão).
  - **Achado crítico desta sessão, fora do texto original da tarefa — bug de unidade em
    `bot.FundamentalistFairPrice` (C.5), só surgiu ao integrar com Selic real pela primeira vez:**
    a fórmula usa `requiredReturn` (derivado de `selicAnnualRate`/`selicNeutral`) como denominador de
    uma razão com ROE (fração decimal, ex: 0.08) — precisa estar na mesma escala. `fundamentalist_test.go`
    (C.5) sempre testou com Selic em fração decimal (`0.10` = 10%), nunca contra a escala 0-100 que
    `selic.Config`/`equity.Config`/o resto do motor usa de verdade (`selicAnnualRate/100` já aparece
    em `equity.go`) — como C.5 documentou "consumo real só a partir da Fase D/E", esse descasamento
    ficou adormecido até agora. Corrigido convertendo só na fronteira `tick → bot`
    (`decisionInputFor`, `rounds.go`: `SelicAnnualRate: selicRate/100, SelicNeutral: selicNeutral/100`)
    — `bot/fundamentalist.go` e seus testes ficam intocados (já corretos, só nunca antes exercitados
    contra a escala real); `fundamentals.ExpectedGrowth` (crescimento) não precisou de conversão
    nenhuma, já usa a escala 0-100 corretamente há várias sessões.
  - **Segundo achado crítico, também fora do texto original — calibração ausente de
    `company_fundamentals`:** mesmo com a unidade corrigida, o preço justo do Fundamentalista pra
    VALR3/BNDD4 saía ~100x menor que o preço real, porque as duas empresas nunca tinham uma linha de
    `company_fundamentals` seedada — caíam no fallback genérico `fundamentals.DefaultBaseRevenue`
    (1 milhão, calibrado pra uma empresa pequena qualquer) contra um `outstanding_shares` de
    centenas de milhões, produzindo um VPA microscópico. Confirmado ao vivo: um bot Ruído chegou a
    gerar uma ordem de compra de **~90 bilhões de unidades** a R$0,01 depois de um Fundamentalista
    negociar contra esse preço justo corrompido, e o tick abortava com `ErrInsufficientPosition`.
    Corrigido com `db.CatalogRepository.CreateInitialFundamentals` (novo) + `cmd/seed/main.go`
    `seedInitialFundamentals` — grava a primeira linha de `company_fundamentals` calibrada pra que
    `fairPrice` bata aproximadamente com `tick.DefaultInitialPrice` (`net_revenue ≈ 97 ×
    outstanding_shares`, valor calculado nesta sessão, não pesquisa setorial real). **Registrado em
    `.claude/pontos-em-aberto-decisao-produto.md` (item 003)**: `97.0` é ilustrativo, mesmo
    tratamento dado a outros coeficientes do motor — a calibração de verdade (dado real B3/CVM) é
    escopo da Fase K.
  - **Nota pra quem pegar a Fase F.1** (não é achado desta sessão precisar de ação agora, só
    registro): excluir Ação do loop de GBM também tornou inalcançável, na prática, o trecho que
    aplicava `reportEffects[*a.CompanyID].PriceEffect` — ver nota adicionada na própria entrada de
    F.1 abaixo antes de começá-la, pra não duplicar trabalho nem reabrir os dois testes que ainda
    cobrem esse caminho morto (`TestAdvance_EfeitoDePrecoSoNoDiaDoRelatorio`/
    `TestAdvance_SemEfeitoDePrecoForaDoDiaDeRelatorio`).
  - **Limitação conhecida, aceita por ora:** Market Maker nunca cancela suas próprias ofertas de
    rodadas passadas (Fase O, cancelamento de ordem, ainda não implementada) — a cada rodada ele
    refresca a cotação submetendo ordens novas, mas as antigas seguem penduradas no book até
    executarem ou até O.1/O.2 existirem. Não corrompe estado (float finito/saldo continuam
    validados normalmente a cada execução, confirmado ao vivo) nem foi pedido pelo texto desta
    tarefa — só um book com mais profundidade "de sobra" do que um MM real deixaria, esperado até a
    Fase O chegar.
  - Testes novos: `internal/domain/bot/round_test.go` (`MatchesEquity`, `SelectAssetForRound` —
    distribuição respeitando `WithinScopePct`, fallback nos dois sentidos, determinismo,
    `ErrNoEquityAvailable` com universo vazio —, `Decide` — um caso por arquétipo, arquétipo
    desconhecido, propagação de erro de decisão); `internal/domain/tick/rounds_test.go` (fakes
    novas em `service_test.go` — `fakeBotRoster`/`fakePriceHistoryReader`/`fakeOrderContextLoader`/
    `fakeOrderSubmitter`, roster/histórico vazios viram no-op pros testes que não são sobre D.2):
    sem Ação no universo/sem rodada sorteada não faz nada, fechamento usa o último fill de todas as
    rodadas, sem fill mantém o preço anterior (carrega adiante — critério de aceite "exatamente uma
    linha por ativo por dia" mesmo sem negociação), bot inelegível nunca é submetido, determinismo
    entre duas execuções idênticas, propagação de erro de `ListEligibleForTradingRound`/
    `LoadContext`/`Submit`; mais o teste de ponta a ponta do critério de aceite em `Service.Run`
    (`TestService_Run_RodadasDeAcaoEntramEmResultQuotesUmaVezSo` — exatamente 1 `Quote` por Ação em
    `result.Quotes`, `IntradayFillsCount` > 0, propagado a `SaveTick`). `gofmt`/`go build`/
    `go test ./...`/`golangci-lint run` (Docker, 0 issues) verdes.
  - Validado ao vivo via `docker compose up` (volume resetado a pedido do autor no meio da sessão —
    ordens de bot de tentativas de debug anteriores, cada uma commitada independentemente do tick,
    tinham deixado saldo/posição de bot inconsistentes com o seed original): seed reaplicado, 18
    ticks consecutivos via `POST /admin/tick` sem erro, `bot_fills_count` sempre > 0
    (14-38 fills/dia), preços de VALR3/BNDD4 oscilando numa faixa plausível (~95-106, perto do
    `tick.DefaultInitialPrice`/preço inicial ~100-101) com movimento real entre dias (não só
    ruído/travado), `SUM(positions.quantity) = outstanding_shares` intacto nos dois ativos (float
    finito, A.3, preservado por toda a sessão), nenhuma conta com saldo/posição negativa, FII/ETF/
    sandbox (SAND3) inalterados (continuam em GBM/roteirizado). Containers parados ao final
    (`docker compose stop`, sem `-v`).

---

## Fase E — Eventos macro por alvo

### E.1 · Direção própria por alvo em `macro_event_targets` ✅

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
- **Entregável:** `macroevent.Target` ganhou `Direction *Direction` (`NewTarget` recebe o quinto
  parâmetro, validado por `ErrTargetDirectionMustBeSigned` — só `positivo`/`negativo`, `misto`
  nunca é sinal de um único alvo) mais `ResolvedDirection(eventDirection) Direction` (nil ⇒ herda
  do evento). `Target` também ganhou `PriceEffectPct`/`FundamentalsEffectPct` próprios (espelham
  os campos de `Event`), só preenchidos pra alvos com `Direction` explícita —
  `macroeventtrigger.Service.Trigger` (`sampleTargetEffects`, novo) sorteia esses dois campos por
  alvo, mesma banda do evento, só depois de amostrar o efeito do evento inteiro; alvo sem
  `Direction` própria não ganha amostra nova, continua lendo o efeito do evento como sempre
  (critério de aceite "não-misto não precisa declarar nada por alvo"). `TargetInput.Direction`
  (novo) propaga isso do payload HTTP (`macroevents.go`: `triggerMacroEventTargetRequest.direction`
  no request, `macroEventTargetResponse.direction/price_effect_pct/fundamentals_effect_pct` —
  todos `omitempty` — na resposta) até o domínio. Persistência: migration
  `000016_macro_event_target_direction` (`macro_event_targets` ganha `direction`/`price_effect_pct`
  /`fundamentals_effect_pct`, nullable, `CHECK` espelhando `ErrTargetDirectionMustBeSigned` a nível
  de banco — sem backfill, tabela já não tinha nenhuma linha gravada); `MacroEventRepository.
  Persist`/`attachTargets` gravam/leem as três colunas novas. **Fora de escopo desta tarefa,
  documentado pra não ser reaberto:** `Target` não ganhou uma `Band` própria (a proposta seção 3
  menciona isso como "se necessário", não como requisito, e nenhum critério de aceite cobre isso —
  todo alvo com direção própria ainda amostra dentro da mesma banda do evento); o backend Node
  (`schemas.ts`/`adminMacroEventsRouter.ts`) e o painel admin (tela 10.2) **não foram tocados** —
  `targets[].direction` só é alcançável hoje via chamada direta ao motor (fora da rede do Compose,
  só em teste/`docker compose exec`), porque o dado amostrado por esta tarefa ainda não é
  consumido por nada (isso é a E.2, que "lê o sinal/magnitude por alvo" — só faz sentido expor no
  formulário do admin depois que a E.2 fizer esse dado significar algo pro Fundamentalista). Testes
  novos: `macroevent_test.go` (`TestNewTarget_DirecaoPropria`, `TestTarget_ResolvedDirection`),
  `macroeventtrigger_test.go` (`TestTrigger_EventoMistoComDirecaoPropriaPorAlvo` — critério de
  aceite principal, 2 alvos sinais opostos —, `TestTrigger_EventoNaoMistoNaoPrecisaDeclararDirecaoPorAlvo`
  — regressão —, `TestTrigger_AlvoComDirecaoMistaEhRejeitado`), `macroevents_test.go`
  (`TestHandleTriggerMacroEvent_DirecaoPropriaPorAlvo`, fronteira HTTP request→domínio→resposta).
  `gofmt`/`go build`/`go test ./...`/`golangci-lint run` (Docker, 0 issues) verdes. `.docs/engine/
  macroevent.md` atualizado (payload/resposta/regra de `POST /macro-events`, nota explícita de que
  a aplicação de efeito — `tick.Advance`/regra do `GET /macro-events` — ainda lê só os campos do
  evento, não os do alvo, até a E.2). Validado ao vivo via `docker compose up`: evento misto real
  (setor Mineração positivo/Tecnologia negativo) devolveu `price_effect_pct` com sinais opostos
  corretos por alvo (`+11.45`/`-8.28`) tanto no `POST` quanto no `GET /macro-events` subsequente
  (valores arredondados por `numeric(6,3)`, confirmando a persistência); evento não-misto (setor
  Bancário/Financeiro, sem `direction` por alvo) devolveu o item de `targets` sem `direction`/
  `price_effect_pct` (herda do evento, zero regressão); alvo com `direction: "misto"` rejeitado
  com `400` como esperado. Containers parados ao final (`docker compose stop`, sem `-v`).

### E.2 · Efeito de evento macro vira parâmetro de comportamento de bot ✅

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
- **Entregável:** `macroPriceMultiplier`/`eventTargetsAsset` removidas de `tick.go` — a linha
  `price *= macroPriceMultiplier(...)` que sobrevivia só pro caminho GBM (FII/ETF, já que Ação sai
  desse loop desde D.2) saiu sem substituto (regressão aceita e documentada: FII/ETF ficam sem
  reação a evento macro de preço até as Fases G/H trazerem o mesmo motor de negociação real pra
  eles — mesmo precedente já aberto pelo efeito de surpresa de balanço em D.2/nota da F.1).
  `eventTargetsCompany` (usada só por `macroFundamentalsEffectsByCompany`, que não mudou de
  comportamento) e a nova `macroPriceEffectsByCompany` (tarefa desta sessão) compartilham o fan-out
  via `matchingTarget` (novo, devolve o `Target` que bateu, não só um bool) — `macroPriceEffectsByCompany`
  soma, **sem teto** (mesma ausência de limite que `macroPriceMultiplier` já tinha, só que agora
  aditivo sobre uma estimativa em vez de multiplicativo sobre o GBM), o `PriceEffectPct` de todo
  evento ativo (`macroevent.IsPriceEffectActive`) que alcança a empresa — usando a magnitude do
  próprio `Target` (E.1) quando ele declarou direção própria, senão a do evento inteiro. Resultado
  vira `CompanyRoundContext.MacroEffectPct` (novo campo, `rounds.go`), populado em
  `companyRoundContexts` (novo parâmetro) e propagado por `decisionInputFor` pro
  `bot.DecisionInput.MacroEffectPct` (novo campo) — só lido no `case ArchetypeFundamentalista` de
  `bot.Decide`, nunca por Chartista/Ruído/Market Maker.
  `bot.FundamentalistFairPrice` ganhou o parâmetro `macroEffectPct` (desloca multiplicativamente:
  `fairPrice *= 1 + macroEffectPct/100`) e `bot.DecideFundamentalistOrder` ganhou o mesmo parâmetro,
  ponderado por `*personality.KnowledgeLevel` antes de repassar pra `FundamentalistFairPrice`
  ("proporcional ao nível de conhecimento", critério de aceite da proposta 2.5) — conhecimento 1.0
  incorpora o efeito inteiro, conhecimento 0.0 o ignora, mesmo raciocínio já usado no ruído de
  leitura (`FundamentalistMaxNoiseStdDevPct`). `MacroEventTargetForApplication` (tipo espelho de
  `tick`, não reaproveita `macroevent.Target`) ganhou `Direction`/`PriceEffectPct`, lidos por
  `db.TickRepository.ListPendingMacroEvents` (`SELECT` ganhou `t.direction, t.price_effect_pct`).
  Testes novos: `bot/fundamentalist_test.go`
  (`TestFundamentalistFairPrice_MacroEffectPctDeslocaOPrecoJusto`,
  `TestDecideFundamentalistOrder_MacroEffectPctProporcionalAoConhecimento` — média de 400 seeds por
  nível de conhecimento, cancela o ruído de leitura, confirma proporcionalidade sem flakiness —,
  `TestFundamentalistFairPrice_MacroEffectPctZeroMantemFormulaOriginal`, regressão); `tick/tick_test.go`
  (4 testes recriados sobre `CompanyContext[...].MacroEffectPct` em vez de `Quotes`, já que o
  multiplicador não existe mais — inclusive um novo caso confirmando que a magnitude própria de um
  `Target` sobrepõe a do evento); `tick/rounds_test.go`
  (`TestService_Run_EventoMacroSeveroMovePrecoGradualmenteViaNegociacao`, **o teste do critério de
  aceite principal**: 3 bots Fundamentalistas com conhecimento crescente 0.3/0.6/0.9, `fakeOrderSubmitter`
  novo (`fillAtRequestedPrice`, preenche exatamente no preço pedido — simula uma contraparte sempre
  disponível, evitando construir um book de verdade só pra este teste) — confirma >= 2 negociações
  reais, preço final bem abaixo do início, vários preços distintos negociados (convergência
  gradual: 100 → ~91.8 → ~79.1 → ~77.4 na validação ao vivo) e nenhuma ordem no efeito bruto máximo
  (prova que o deslocamento é sempre filtrado por conhecimento). Ordem do roster (conhecimento
  crescente por `UserID`) é deliberada: evita o bot de conhecimento baixo "comprar de volta" o que
  o de conhecimento alto já vendeu — o último bot de cada rodada é sempre o de crença mais extrema,
  então o fechamento converge pra perto da crença dele independente de quantas rodadas o dia
  sortear (Fase D.1). `gofmt`/`go build`/`go test ./...`/`golangci-lint run` (Docker, 0 issues)
  verdes. `.docs/engine/macroevent.md` atualizado (duas notas antigas que citavam
  `macroPriceMultiplier`/"ainda não consumido" corrigidas). Validado ao vivo via `docker compose
  up`: evento severo negativo (`-16.35%`) disparado no setor Mineração (VALR3) — preço moveu de
  103.76 para 102.73 (~-1%) no primeiro tick dentro da janela ativa, com 18 fills reais (nenhum
  salto pro efeito bruto), voltando a 103.76 no tick seguinte à janela expirar (evento só afetava
  preço, não fundamentos — comportamento emergente esperado: sem dano permanente aos fundamentos,
  o Fundamentalista arbitra de volta ao preço justo "sem choque" assim que `MacroEffectPct` some).
  Containers parados ao final (`docker compose stop`, sem `-v`).

---

## Fase F — Balanços via negociação

### F.1 · Remoção da fórmula de surpresa de balanço ✅

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
- **Achado da sessão D.2 (2026-09-13), conferir antes de começar:** como Ação já não passa mais por
  GBM desde D.2 (`tick.go` pula `assetTypeAcao` inteiro no loop de cotação), o trecho que aplica
  `reportEffects[*a.CompanyID].PriceEffect` (`tick.go`, dentro do mesmo loop, logo depois do `continue`
  de Ação) já está **inalcançável na prática** — Ação é a única classe com `CompanyID`, e ela nunca
  chega mais até esse trecho. `fundamentals.ReportSurprise`/`ReportDayPriceEffect` continuam
  computados e chamados (não removidos por D.2 — remover a fórmula é escopo explícito desta tarefa,
  não da D.2, que não tocou `fundamentals_test.go` nem os dois testes que ainda exercitam esse
  caminho via um ativo sintético sem `Type` setado — `TestAdvance_EfeitoDePrecoSoNoDiaDoRelatorio`/
  `TestAdvance_SemEfeitoDePrecoForaDoDiaDeRelatorio`, `tick_test.go`). Como o mecanismo de reação via
  negociação real do Fundamentalista (`companyRoundContexts`, `tick.go`/`rounds.go`) já lê os
  financeiros mais recentes de toda empresa todo dia (não só no dia de relatório), o essencial desta
  tarefa (F.1) pode já estar entregue como efeito colateral de D.2 — confirme com um teste de
  ponta a ponta próprio (resultado melhor/pior que o esperado movendo preço via negociação, "sem
  surpresa" pouco/nenhum movimento) antes de assumir que falta implementação; o que sobra de fato pra
  F.1 é provavelmente só a limpeza (remover `PriceEffect`/`companyReportEffect`/o trecho morto de
  `tick.go` e os dois testes acima, que passam a testar um cenário que não existe mais no catálogo
  real) mais a validação formal dos critérios de aceite.
- **Entregável:** a suspeita da nota da D.2 se confirmou — o mecanismo já estava entregue como
  efeito colateral de D.2/E.2, sem nenhuma linha de produção nova. `internal/domain/tick/rounds_test.go`
  ganhou os três testes de ponta a ponta do critério de aceite (`newReportCycleService`,
  `findReportGrowthSeed` — helper que busca, por varredura determinística sobre
  `fundamentals.NextGrowth`, qual seed base produz um ciclo de relatório melhor/pior/sem surpresa
  clara em relação a `fundamentals.ExpectedGrowth`, já que o ruído do ciclo não tem inversa fechada):
  `TestService_Run_RelatorioMelhorQueEsperadoMovePrecoParaCimaViaNegociacao`,
  `TestService_Run_RelatorioPiorQueEsperadoMovePrecoParaBaixoViaNegociacao`,
  `TestService_Run_RelatorioSemSurpresaProduzPoucoOuNenhumMovimento` — todos passando sem nenhuma
  mudança de domínio, confirmando que `companyRoundContexts` (net_revenue recém-divulgado, com o
  ruído do ciclo embutido, contra `GrowthRate` sempre sistêmico) já entrega "resultado vs.
  expectativa" via negociação real do Fundamentalista. Com isso confirmado, a limpeza prevista pela
  nota da D.2 foi feita: `fundamentals.ReportSurprise`/`ReportDayPriceEffect` (`reportcycle.go`) e
  `fundamentals.DefaultReportPriceSensitivity` (`fundamentals.go`) removidas — `fundamentals.
  ActualGrowthWithMacroEffect` (efeito de evento macro sobre o crescimento realizado, tarefa 4.2, sem
  relação com a fórmula de surpresa removida) **não foi tocada**, continua em uso por
  `macroFundamentalsEffectsByCompany`. `tick.go`: `companyReportEffect` (struct com só `NetRevenue`
  sobrando depois de tirar `PriceEffect`) virou `map[string]float64` (`reportedRevenue`, renomeado de
  `reportEffects`) — simplificação direta, não uma abstração nova; o trecho morto que aplicava
  `reportEffects[*a.CompanyID].PriceEffect` multiplicativamente na cotação GBM (inalcançável desde
  D.2, ver nota acima) foi removido do loop de `quotes` em `Advance`, junto da variável `expectedGrowth`
  que só existia pra alimentar `ReportSurprise`. Testes removidos por testarem diretamente as funções
  apagadas: `TestReportSurprise_*`/`TestReportDayPriceEffect_*`/`TestReportCycle_SurpresaIncluiEfeitoMacro`/
  `TestReportCycle_PrecoSoReageNoDiaDoRelatorio` (`reportcycle_test.go` — substituído por
  `TestActualGrowthWithMacroEffect_PreservaSinalDoEfeito`, cobrindo só a parte de
  `ActualGrowthWithMacroEffect` que continua existindo) e
  `TestAdvance_EfeitoDePrecoSoNoDiaDoRelatorio`/`TestAdvance_SemEfeitoDePrecoForaDoDiaDeRelatorio`
  (`tick_test.go` — substituídos por `TestAdvance_QuotesDeCompanhiaNuncaSofremEfeitoDePrecoDireto`,
  confirmando a regressão oposta: `companies` nunca mais afeta `Result.Quotes` direto, dentro ou fora
  do dia de relatório). `gofmt`/`go build`/`go test ./...`/`golangci-lint run` (Docker, v2.12.2 —
  mesma versão pinada em `.github/workflows/engine-ci.yml` — 0 issues) verdes. `.docs/engine/tick.md`
  atualizado (a frase que descrevia o multiplicador de `ReportDayPriceEffect` agora descreve o
  mecanismo real: `net_revenue` recém-divulgado entra em `Result.CompanyContext` pra toda empresa, e
  é o Fundamentalista, dentro de `runIntradayRounds`, que reage a ele negociando). Sem
  `docker compose up` — tarefa é só remoção de função pura + simplificação de tipo interno de
  `tick.go`, sem schema/rota nova, e os três testes de ponta a ponta novos já validam o comportamento
  real via `Service.Run` (fakes, sem infra).

---

## Fase G — FIIs no motor de negociação real

### G.1 · FII entra no book real (mesmo mecanismo de Ações) ✅

- **Descrição:** remove o GBM/tratamento Conservador de FII (`tick.riskClassForPricing`,
  `tick.go:281-286`, pro lado de FII) — FII passa a negociar no mesmo book/bots de Ações (Fases
  A-D), sem mecanismo de arbitragem tipo ETF (proposta seção 4 — ágio/deságio persistente é
  esperado e correto). Bots de C.6 precisam cobrir FII como uma das 3 classes já previstas no
  escopo de especialização.
- **Critérios de aceite:** FII negocia via `orderexecution` real, preço nasce de negociação; teste
  confirmando ausência de qualquer resquício de GBM no caminho de precificação de FII.
- **Referências:** proposta seção 4.
- **Dependências:** D.2, C.6.
- **Achado da sessão (conferir antes de reabrir):** C.6 (`cmd/seed/main.go`,
  `nonEquityAssetClasses`) já atribuía `catalog.AssetFII`/`AssetETF` ao escopo dos bots desde antes
  desta tarefa, antecipando as Fases G/H — nenhuma mudança de seed foi necessária aqui, só o
  domínio (`tick`/`bot`) precisava passar a ler essa atribuição pro book real.
- **Entregável:** `tick.go` — `assetTypeAcao` virou um bloco `const` com `assetTypeFII = "fii"` ao
  lado; o loop de `quotes` em `Advance` pula as duas classes (`a.Type == assetTypeAcao ||
  a.Type == assetTypeFII`), igual à Ação desde D.2 — ETF é a única classe que ainda cai no GBM
  (`riskClassForPricing`, doc atualizada pra refletir isso). `rounds.go` —
  `buildEquityUniverse` passa a incluir `assetTypeFII` no filtro; pra FII, `Sector`/`RiskClass`
  ficam em zero value de propósito (não chama mais `riskClassForPricing` — é exatamente o
  "tratamento Conservador" que o critério de aceite pede pra remover), porque o único jeito de um
  bot alcançar FII agora é por classe de ativo, não por setor/risk_class que ele não tem.
  `bot/round.go` — `EquityForRound` ganhou o campo `Type catalog.AssetType`; `MatchesEquity` ganhou
  um terceiro parâmetro (`assetType`) e uma terceira checagem de união contra `s.AssetClasses` (até
  aqui morta pro caminho de Ação — "Ação não é chave de cobertura própria", C.6 — mas agora a única
  via de match pra FII); `SelectAssetForRound` repassa `e.Type`. Fundamentalista nunca decide uma
  ordem pra FII: `fundamentalistHasCompanyContext` já descartava qualquer ativo com `CompanyID nil`
  (mesma checagem que já valia pra Ação sem empresa vinculada), e FII nunca tem `CompanyID` (spec
  3.6) — nenhum código novo precisou tratar esse caso, é consequência direta do que já existia.
  G.2/G.3 (reavaliação de `NetWorth`/`PortfolioValue`, sensibilidade de bot a vacância/indexador)
  ficam fora desta tarefa, como a proposta seção 4 já separa.
  Testes novos: `bot/round_test.go` —
  `TestSpecializationScope_MatchesEquity_PorClasseDeAtivo` (match por `AssetClasses`, ignora
  Sector/RiskClass vazios); `tick/tick_test.go` — `TestAdvance_FIINaoNasceMaisDeGBM` (FII com
  `RiskClass`/`LastPrice` nulos não gera nenhuma `Quote` em `Advance`, cenário que antes da G.1
  caía no fallback Conservador e gerava preço via GBM); `tick/rounds_test.go` —
  `TestRunIntradayRounds_FIINegociaComoAcaoViaBookReal` (bot Ruído especializado em FII por
  `AssetClasses` negocia via `orderexecution` real, fechamento reflete o fill) e
  `TestRunIntradayRounds_FundamentalistaNuncaNegociaFII` (Fundamentalista especializado em FII é
  descartado antes de qualquer `LoadContext`, `fills = 0`). `gofmt`/`go vet`/`go build`/
  `go test ./...`/`golangci-lint run` (Docker, v2.12.2) verdes. `.docs/engine/tick.md` atualizado
  (FII saiu do caminho de GBM, só ETF resta; menção a `bot_fills_count` agora inclui FII).
  Validado ponta a ponta via `docker compose up -d --build` (sem `down -v` — nenhuma migration
  nova) contra dados reais já seedados em sessões anteriores (bots com posição/personalidade em
  TJLO11/PAPL11 desde B.2/C.6): `POST /admin/tick` (dia 102→103) gerou `bot_fills_count: 22` e
  `order_book` confirmou fills reais em TJLO11/PAPL11 (`status = filled`/`partially_filled`, preços
  de negociação, não um salto instantâneo de GBM) — `asset_quotes` do dia 103 tem exatamente 5
  linhas (2 Ações + 2 FIIs vindas do fechamento de `runIntradayRounds`, 1 ETF ainda vindo do GBM de
  `Advance`), confirmando que FII deixou o caminho antigo. Stack parada com `docker compose down`
  (sem `-v`) ao final, dados preservados.

### G.2 · Reavaliação periódica de `NetWorth` (FII tijolo) ✅

- **Descrição:** `fii.Details.NetWorth` (hoje fixo desde o seed) passa a ser reavaliado no mesmo
  ciclo de 14 dias do relatório de empresas, com variação sintética ligada à Selic simulada (juro
  alto pressiona a avaliação de imóveis pra baixo, juro baixo valoriza). Vacância e segmento
  continuam campos cadastrais fixos (não fazem parte desta reavaliação).
- **Critérios de aceite:** teste table-driven da fórmula de variação (juro alto → `NetWorth`
  tende a cair; juro baixo → tende a subir), determinística por seed; teste ponta a ponta
  confirmando nova linha de `NetWorth` a cada ciclo de 14 dias.
- **Referências:** proposta seção 4.
- **Dependências:** G.1.
- **Entregável:** pacote novo `engine/internal/domain/fii/networth.go` — `NetWorthConfig`
  (`Sensitivity`/`NoiseStdDev`/`Seed`, mesmo papel de `fundamentals.Config` pro ciclo de relatório
  de empresa) + `NetWorthVariation` (fração decimal, sinal invertido em relação ao desvio da
  Selic — `-Sensitivity×(selicRate-selicNeutral) + ruído`, mesma técnica de
  `fundamentals.ExpectedGrowth`/`NextGrowth`: seed determinística por `cfg.Seed + cycleIndex`,
  RNF08) + `NextNetWorth` (aplica a variação multiplicativamente sobre o valor vigente, nunca
  regenera do zero — mesma decisão de `equity.NextPrice`). `DefaultNetWorthSelicSensitivity =
  0.03`/`DefaultNetWorthNoiseStdDev = 0.01`: valores ilustrativos únicos e globais (FII não tem
  `risk_class` própria, spec 3.6, então nada equivalente à tabela por risk_class de
  `fundamentals.SensitivityByRiskClass`) — sujeitos à calibração da tarefa 8.1, mesmo tratamento já
  dado a todo coeficiente sem tabela fechada na spec. `tick.go`: `NetWorthUpdate{AssetID,
  NetWorth}` novo (doc deixa explícito que **não** é uma linha de histórico como
  `FundamentalsRecord` — `fii_details.net_worth` é coluna mutável de uma tabela com `asset_id` como
  chave primária, então `SaveTick` faz `UPDATE`, não `INSERT`); `fiiNetWorthUpdatesForCycle`
  reaproveita a mesma lista `dividendPayers` (`DividendPayerAsset`, já carregada pra dividendo, já
  tem `NetWorth`/`AssetID` prontos) — nenhuma consulta nova ao catálogo precisou ser criada. Roda
  no mesmo calendário quinzenal global (`fundamentals.IsReportDay(dayIndex,
  fundamentals.DefaultReportFrequencyDays)`) que já dispara relatório de empresa/dividendo; filtra
  só `Type == "fii" && NetWorth != nil` — FII papel (`PortfolioValue` preenchido, `NetWorth` nil)
  nunca entra aqui, fica pra G.3. `Result.NetWorthUpdates` novo, preenchido em `Advance`.
  `internal/infra/db/tick_repository.go`: `SaveTick` ganha um loop `UPDATE fii_details SET
  net_worth = $1 WHERE asset_id = $2` por item, na mesma transação do resto do tick — sem
  Repository novo nem query de leitura adicional (o dado de entrada já vinha de
  `ListDividendPayerAssets`, existente desde a 4.9). Testes novos: `fii/networth_test.go`
  (table-driven — `TestNetWorthVariation_JuroAltoReduzJuroBaixoAumenta` com os 3 casos do critério
  de aceite, mais determinismo por seed/cycleIndex, seeds diferentes gerando ruído diferente, e
  `NextNetWorth` aplicando a variação multiplicativamente/mantendo o valor sem desvio nem ruído);
  `tick/tick_test.go` — `TestAdvance_NetWorth_ReavaliaFIITijoloNoCalendarioGlobalDeRelatorio`
  (bate exatamente com `fii.NextNetWorth` chamada com os mesmos parâmetros que `Advance` usa de
  verdade, mesma técnica de `TestNextGrowth_*`), `TestAdvance_NetWorth_FIIPapelNuncaReavaliado`,
  `TestAdvance_NetWorth_NaoReavaliaForaDoDiaDeRelatorioGlobal`. `gofmt`/`go vet`/`go build`/
  `go test ./...`/`golangci-lint run` (Docker, v2.12.2) verdes. `.docs/engine/tick.md` atualizado
  (parágrafo novo depois do de dividendos, deixando explícito que não existe tabela de histórico
  pra `net_worth`, só o valor mais recente exposto em `GET /assets/:id`). Validado ponta a ponta
  via `docker compose up -d --build` (sem `down -v`, mesmos dados reais de G.1) + 9 chamadas
  `POST /admin/tick` (dia 103→112, até bater o próximo ciclo quinzenal): `TJLO11.net_worth` saiu de
  `500000000.00` (valor fixo do seed) pra `495173146.68` exatamente no tick `is_report_day: true`
  (Selic simulada em 9,885%, levemente abaixo dos 10% neutros — pequena valorização esperada,
  parcialmente compensada pelo ruído da amostra), enquanto `PAPL11.portfolio_value` (perfil papel)
  ficou inalterado no mesmo tick, confirmando que a reavaliação não vaza pro outro perfil. Stack
  parada com `docker compose down` (sem `-v`) ao final.

### G.3 · Reavaliação periódica de `PortfolioValue` (FII papel) ✅

- **Descrição:** `fii.Details.PortfolioValue` (hoje fixo) passa a ser reavaliado no mesmo ciclo de
  14 dias, variando conforme o indexador da carteira (CDI/IPCA+/prefixado) — análogo a como um
  título de renda fixa acumula valor com o tempo.
- **Critérios de aceite:** teste table-driven cobrindo os 3 indexadores possíveis, confirmando que
  `PortfolioValue` acumula corretamente ao longo de ciclos sucessivos.
- **Referências:** proposta seção 4.
- **Dependências:** G.1.
- **Achado da sessão (decisão de escopo, conferir antes de reabrir):** IPCA+ **não** lê o IPCA
  simulado de verdade — `ipca.MonthlySeries` não tem nenhum consumidor no tick diário ainda
  (achado documentado na própria Fase M do backlog, que resolve isso), e essa tarefa depende só de
  G.1. `IPCA+`/`Prefixado` usam uma taxa anual nominal ilustrativa fixa
  (`fii.DefaultIPCAPlusAnnualRatePct`/`DefaultPrefixadoAnnualRatePct`, mesmo tratamento "sujeito à
  calibração 8.1" de todo coeficiente sem tabela fechada na spec) — só `CDI` reage a uma variável
  simulada de verdade (a Selic do dia, mesma simplificação de `tesouro_selic` ser 1:1 com a Selic
  em outras partes do motor). Diferente de G.2 (NetWorth, com ruído idiossincrático — avaliação de
  mercado), esta reavaliação é **determinística, sem ruído**: rendimento de carteira de renda fixa
  é contratado/indexado, não sujeito a surpresa.
- **Entregável:** pacote novo `engine/internal/domain/fii/portfoliovalue.go` — `IndexadorCDI`/
  `IndexadorIPCAPlus`/`IndexadorPrefixado` (constantes string; `fii_details.indexador` é
  `varchar(20)` livre no Postgres, sem `CHECK`/enum, então `PortfolioValueVariation` devolve
  `ErrUnknownIndexador` — não um `panic`/valor arbitrário — pra qualquer string fora das três) +
  `PortfolioValueVariation` (fração decimal por ciclo, `(1+taxaAnual/100)^(cycleDays/365) - 1`,
  dias corridos sobre 365 — FII não segue a convenção de 252 dias úteis de
  `fixedincome.BusinessDaysPerYear` em nenhum outro lugar do motor) + `NextPortfolioValue`
  (aplica multiplicativamente sobre o valor vigente, nunca regenera do zero — mesma decisão de
  `fii.NextNetWorth`/`equity.NextPrice`). `tick.go`: `PortfolioValueUpdate{AssetID,
  PortfolioValue}` novo (mesma natureza de `NetWorthUpdate` — `UPDATE`, não `INSERT`, sem tabela
  de histórico); `fiiPortfolioValueUpdatesForCycle` reaproveita a mesma lista `dividendPayers` de
  G.2 — `DividendPayerAsset` ganhou o campo `Indexador *string` (só preenchido pro perfil papel);
  filtra `Type == "fii" && PortfolioValue != nil && Indexador != nil`, pula (sem travar o tick)
  qualquer indexador que `fii.NextPortfolioValue` não reconheça. `Result.PortfolioValueUpdates`
  novo, preenchido em `Advance` no mesmo dia de relatório global de G.2 (independentes entre si —
  um FII só tem um dos dois perfis, nunca os dois). `internal/infra/db/tick_repository.go`:
  `ListDividendPayerAssets` ganha `fd.indexador` no `SELECT`/`Scan` (mesma query, sem JOIN novo);
  `SaveTick` ganha um loop `UPDATE fii_details SET portfolio_value = $1 WHERE asset_id = $2` por
  item, mesma transação. Testes novos: `fii/portfoliovalue_test.go` (table-driven — os 3
  indexadores em `TestPortfolioValueVariation_TresIndexadores`, indexador desconhecido devolvendo
  `ErrUnknownIndexador`, CDI reagindo a mudança de Selic, e
  `TestNextPortfolioValue_AcumulaCorretamenteAoLongoDeCiclosSucessivos` — 3 ciclos sucessivos por
  indexador batendo com a composição fechada `inicial × fator³` e crescendo monotonicamente);
  `tick/tick_test.go` — `TestAdvance_PortfolioValue_ReavaliaFIIPapelNoCalendarioGlobalDeRelatorio`
  (bate exatamente com `fii.NextPortfolioValue` chamada com os mesmos parâmetros que `Advance` usa
  de verdade), `TestAdvance_PortfolioValue_FIITijoloNuncaReavaliado`,
  `TestAdvance_PortfolioValue_IndexadorDesconhecidoNaoReavalia`,
  `TestAdvance_PortfolioValue_NaoReavaliaForaDoDiaDeRelatorioGlobal`. `gofmt`/`go vet`/`go build`/
  `go test ./...`/`golangci-lint run` (Docker, v2.12.2 — um achado de `staticcheck` QF1005 no teste,
  `math.Pow(x, 3)` trocado por `x*x*x`, corrigido antes do lint final) verdes. `.docs/engine/tick.md`
  atualizado (parágrafo novo depois do de G.2). Validado ponta a ponta via `docker compose up -d
  --build` (sem `down -v`, mesmos dados reais de G.1/G.2) + 14 `POST /admin/tick` (dia 112→126, até
  bater o próximo ciclo quinzenal): `PAPL11.portfolio_value` (indexador `CDI`) saiu de
  `300000000.00` pra `301091368.48` (+0,364%, batendo com Selic simulada ~9,93% a.a. sobre 14 dias
  corridos) exatamente no tick com `is_report_day: true`, no mesmo tick em que `TJLO11.net_worth`
  (G.2) também mudou — confirmando que as duas reavaliações convivem no mesmo ciclo sem interferir
  uma na outra. Stack parada com `docker compose down` (sem `-v`) ao final.

---

## Fase H — ETFs: NAV + Participante Autorizado + rebalanceamento

### H.1 · NAV / iNAV ✅

- **Descrição:** função pura que calcula o valor patrimonial do fundo a partir da soma do valor
  de mercado corrente de todos os ativos da cesta (renda variável, renda fixa marcada a mercado,
  ou cota de FII) mais caixa, menos passivos, dividido pelo número de cotas emitidas. Recalculável
  a cada rodada de negociação (D.1) como iNAV.
- **Critérios de aceite:** teste table-driven cobrindo cesta mista (Ação + renda fixa + FII),
  confirmando o cálculo correto de NAV pra cada combinação de preços de constituinte.
- **Referências:** proposta 5.1, 5.5.
- **Dependências:** G.1 (FII precisa já ter preço de mercado real se estiver na cesta).
- **Entregável:** `internal/domain/etf/nav.go` (pacote `etf` já existente, novo arquivo).
  Decisão de design desta sessão, documentada no comentário do pacote: `NAV` **não decide como
  cada classe de constituinte é precificada** — recebe `Constituent{Quantity int64, Price
  float64}` já com o preço correto resolvido por quem chama (preço de mercado corrente pra
  Ação/FII, PU marcado a mercado pra renda fixa) e só soma `Quantity×Price` de cada um, mais
  caixa, menos passivos, dividido por `sharesOutstanding` — mesmo raciocínio de "domínios irmãos
  não se importam" já registrado em `bot/allocation.go`. Isso é o que permite fechar H.1 sem
  esperar H.4 (schema real de `etf_holdings` com `asset_id`): a função é agnóstica a de onde vêm
  os valores, então o teste da cesta mista (Ação+FII+renda fixa) só precisa variar `Price` por
  constituinte, sem precisar de nenhuma tabela/migration nova. Mesma fórmula serve pro NAV oficial
  e pro iNAV (D.1) — não há função separada, só frequência de chamada diferente (documentado no
  comentário de `NAV`, confirmado por `TestNAV_UsaMesmaFormulaComoINAV`). Validações: cesta vazia
  (`ErrNoConstituents`, mesmo padrão de `ErrNoHoldings` já existente no pacote pra composição
  sintética), `sharesOutstanding <= 0` (`ErrInvalidSharesOutstanding`), caixa/passivo negativo
  (`ErrNegativeCashOrLiabilities`), quantidade/preço de constituinte negativo
  (`ErrNegativeConstituent`) — NAV resultante negativo (passivo > ativos) não é validado de
  propósito, é um resultado matematicamente válido ainda que degenerado, sem decisão confirmada na
  proposta pra travar isso. Testes novos (`nav_test.go`, table-driven):
  `TestNAV_CestaMistaComPrecoCorretoPorConstituinte` (3 cenários variando preço de
  Ação/FII/renda-fixa simultaneamente, com e sem passivo, incluindo deságio de renda fixa),
  `TestNAV_UsaMesmaFormulaComoINAV`, e um teste por validação (cesta vazia, cotas emitidas
  zero/negativa, caixa/passivo negativo, quantidade/preço de constituinte negativo, caso
  degenerado só-caixa-sem-passivo). `gofmt`/`go build`/`go vet`/`go test ./...`/
  `golangci-lint run` (Docker, v2.12.2, 0 issues) verdes. Sem `.docs/engine/` (sem rota HTTP nova)
  e sem `docker compose up` (função pura, sem infra/DB tocado — mesma nota de escopo já registrada
  em B.1/C.1-C.5; a integração real com `etf_holdings`/preço de mercado só chega em H.4).

### H.2 · Bot mecânico rebalanceador ✅

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
- **Entregável:** `internal/domain/etf/rebalance.go` (mesmo pacote `etf` de H.1). Decisão de
  design central desta sessão: `RebalanceConstituent{AssetID, CurrentQuantity int64, Price
  float64, TargetWeightPct float64}` é uma **reconciliação numa linha só por ativo** — zero value
  de `CurrentQuantity` é "ativo novo entrando na cesta", zero value de `TargetWeightPct` é "ativo
  saindo da cesta" — em vez de duas listas (cesta atual + composição-alvo) que a função precisaria
  casar por `AssetID` internamente; quem chama já monta a reconciliação. `RebalanceOrder` carrega
  `AssetID` (diferente de `bot.Decision`, que não precisa disso porque cada arquétipo decide um
  único ativo por rodada, C.2-C.5) — **não embrulha `bot.Decision`** de propósito, só reaproveita
  `orderbook.Side`/`orderbook.Type` (mesmo padrão de reuso já estabelecido por `bot.Decision`).
  `Type` é sempre `orderbook.TypeMarket` — o gestor mecânico não tem preço-limite, só converge
  pro peso-alvo (proposta 5.4: "100% determinístico dado o índice-alvo"). Os dois gatilhos da
  proposta (revisão periódica e evento corporativo) caem na **mesma função, sem distinção de
  código**: revisão periódica muda `TargetWeightPct` entre chamadas; evento corporativo muda
  `Price` de um constituinte o bastante pra desviar o peso real do peso-alvo mesmo com
  `TargetWeightPct` idêntico à chamada anterior — os testes tratam os dois como o mesmo mecanismo
  com inputs diferentes, confirmando que não precisava de nenhum código especial por gatilho.
  `netAssets` (a base sobre a qual os pesos-alvo são aplicados) é sempre calculado a partir da
  cesta **atual** (Σ CurrentQuantity×Price + caixa − passivos), nunca de um valor hipotético
  pós-rebalanceamento — mesmo raciocínio de "o teto é uma propriedade do snapshot" já usado em
  `position.ValidateFloatCeiling` (A.3). Quantidade-alvo por constituinte é `math.Round(peso-alvo
  × netAssets / preço)` — arredondamento pro inteiro de ações mais próximo, sem apportionment tipo
  Hamilton (B.1): o resíduo de caixa não alocado é o "cash drag" que a própria proposta 5.4 cita
  como gancho pedagógico, não um bug a esconder. Validação de soma de peso-alvo **reaproveita**
  `ErrWeightsDoNotSumTo100`/`WeightTolerance` (já existentes no pacote, de `NewDetails`/H.1) em vez
  de duplicar a mesma regra com um nome novo — mesma tolerância de ~100% vale pra composição
  cosmética (`etf.go`) e pra composição-alvo real do rebalanceamento. `ErrNegativeCashOrLiabilities`
  também reaproveitado de `nav.go` (mesma semântica exata). Testes novos (`rebalance_test.go`,
  table-driven): `TestRebalanceOrders_ComposicaoAntigaParaComposicaoNova` cobre os 2 cenários do
  critério de aceite (revisão periódica com pesos mudando sem variação de preço; evento
  corporativo com preço disparando sem o índice mudar) mais 4 cenários adicionais (constituinte
  novo entrando + outro perdendo peso, constituinte saindo inteiramente da cesta, cesta já
  convergida sem nenhuma ordem, caixa do fundo entrando no cálculo do peso-alvo) — todos com
  ordens esperadas calculadas à mão e comparadas via `reflect.DeepEqual`; mais um teste por
  validação (cesta vazia, caixa/passivo negativo, quantidade/peso negativo, preço zero/negativo,
  soma de peso fora/dentro da tolerância). `gofmt`/`go build`/`go vet`/`go test ./...`/
  `golangci-lint run` (Docker, v2.12.2, 0 issues) verdes. Sem `.docs/engine/` e sem
  `docker compose up` (mesma nota de escopo de H.1/B.1/C.1-C.5 — função pura; a orquestração real
  — "executando na última rodada do dia de rebalanceamento", com uma conta de bot mecânico de
  verdade e `etf_holdings` real — fica pra H.4/uma tarefa de integração futura, ver nota na
  memória de progresso sobre por que isso não é escopo de H.2).

### H.3 · Bot mecânico Participante Autorizado (creation/redemption) ✅

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
- **Entregável:** `internal/domain/etf/authorizedparticipant.go` (mesmo pacote `etf` de H.1/H.2).
  `DecideAuthorizedParticipantAction(etfAssetID string, marketPrice, nav float64, arbitrageShares
  int64, basket []BasketConstituentWeight) (AuthorizedParticipantAction, error)` — a "mesma função
  mecânica de H.2" do texto da tarefa vira **reuso literal de `RebalanceOrders`** (não só reuso
  conceitual do bot mecânico como ator): `basketOrdersFromWeights` (privada, novo arquivo) chama
  `RebalanceOrders` a partir de uma cesta **zerada** (`CurrentQuantity: 0` em todo constituinte —
  o bot-AP não carrega estoque próprio entre arbitragens, proposta 5.3) com
  `arbitrageShares×nav` como "caixa" disponível — como todo constituinte parte de zero, toda ordem
  nasce do lado de compra por construção (`diff = alvo − 0` nunca é negativo). A criação usa esse
  resultado direto (o bot-AP compra a cesta pra entregar ao fundo); o resgate reaproveita a
  **mesma chamada** (mesma matemática peso→quantidade) e só inverte `Side` de cada ordem pra venda
  (o bot-AP vende os ativos recebidos do fundo) — evita duplicar a fórmula duas vezes. Decisão de
  design que fecha o critério de aceite "arbitragem sempre empurra o preço em direção ao NAV": o
  lado de `ETFOrder` **é** a prova de direção — ágio (`marketPrice > nav`) gera `ETFOrder.Side =
  Sell` (aumenta oferta de cotas, pressão pra baixo, rumo ao NAV que é menor); deságio gera
  `ETFOrder.Side = Buy` (aumenta demanda, pressão pra cima, rumo ao NAV que é maior) — confirmado
  por asserção direta do `Side` nos dois testes principais, sem precisar simular o book de verdade
  (fora de escopo de um teste de domínio puro). `ArbitrageMispricingThresholdPct = 0.005` (faixa
  morta, mais estreita que `FundamentalistMispricingThresholdPct` do pacote `bot`, 0.01 — arbitragem
  NAV é mecânica/sem ruído, diferente da estimativa do Fundamentalista — valor ilustrativo sujeito
  a calibração, mesma nota já dada a outros coeficientes do motor). `arbitrageShares` é sempre
  parâmetro de quem chama (tamanho do lote da arbitragem) — mesmo padrão de "sizing é decisão de
  quem orquestra" já usado por `otherBotCount` em `bot.InitialAllocation` (B.1). Preço de
  referência pra dimensionar o valor da transação é sempre `nav` (não `marketPrice`) — é o valor
  pelo qual o fundo de fato troca cotas por cesta na criação/resgate real, `marketPrice` só entra
  no `ETFOrder` (onde o bot-AP negocia as próprias cotas). Testes novos
  (`authorizedparticipant_test.go`): `TestDecideAuthorizedParticipantAction_AgioGeraCriacaoQue...`/
  `...DesagioGeraResgateQue...` (os 2 cenários do critério de aceite, comparando a ação inteira —
  `ETFOrder`+`BasketOrders`+`SharesOutstandingDelta` — via `reflect.DeepEqual` contra valores
  calculados à mão, mais uma asserção explícita de sinal em `SharesOutstandingDelta`),
  `TestDecideAuthorizedParticipantAction_DentroDaToleranciaSemOportunidade` (5 casos incluindo os
  dois limites exatos da faixa morta — estritamente `>`/`<`, não `>=`/`<=`, documentado no teste),
  mais um teste por validação (preço/NAV inválido, `arbitrageShares` inválido,
  `TestDecideAuthorizedParticipantAction_CestaInvalidaPropagaErroDeRebalanceOrders` confirmando
  que os 3 erros de `RebalanceOrders` — cesta vazia, pesos fora da tolerância, preço de
  constituinte inválido — propagam sem tradução tanto no caminho de ágio quanto no de deságio).
  `gofmt`/`go build`/`go vet`/`go test ./...`/`golangci-lint run` (Docker, v2.12.2, 0 issues)
  verdes. Sem `.docs/engine/` e sem `docker compose up` (mesma nota de escopo de H.1/H.2 — função
  pura; nenhuma conta de bot-AP real, nenhum `bot_type`, nenhum gatilho em `tick.go` ainda — mesma
  integração futura já documentada como pendente na entrada de H.2).

### H.4 · `etf_holdings` suporta qualquer classe de ativo na cesta ✅

- **Descrição:** `etf_holdings` (hoje só pensado pra constituinte de renda variável com peso
  percentual) passa a referenciar qualquer `asset_id` do catálogo — Ação, FII ou instrumento de
  renda fixa. Migration de schema + validação de domínio.
- **Critérios de aceite:** teste confirmando que um ETF pode ter cesta mista (Ação + FII + renda
  fixa) e que H.1 precifica cada tipo pela regra correta.
- **Referências:** proposta 5.5.
- **Dependências:** H.1.
- **Entregável:** migration `000018_etf_holdings_asset_reference` — `asset_id uuid REFERENCES
  assets(id) ON DELETE CASCADE` **nullable**, sem backfill (`assets` é a tabela guarda-chuva que
  `positions`/`order_book` já referenciam, então um único FK cobre as 4 classes — Ação, FII, ETF,
  renda fixa — sem precisar de FK condicional por tabela de especialização). Nullable é a decisão
  de design central desta sessão: `etf_holdings` passa a servir dois papéis na mesma tabela —
  constituinte **cosmético** (nome de referência do índice real que o ETF replica, sem existir no
  catálogo simulado — ex: "Outros", ou empresa real fora do catálogo, `asset_id = NULL`) e
  constituinte **real** (`asset_id` preenchido, utilizável por H.1/H.2/H.3) — os dois coexistem na
  mesma cesta (tela de detalhe RF21 continua mostrando ambos; NAV/rebalanceamento só enxergam o
  segundo). `etf.Holding` (mesmo pacote `etf` de H.1-H.3, `etf.go`) ganhou `AssetID *string`;
  `etf.NewDetails` ganhou duas validações novas — `ErrEmptyHoldingAssetID` (ponteiro não-nil não
  pode apontar pra string vazia) e `ErrDuplicateHoldingAssetID` (mesmo `asset_id` em duas linhas da
  cesta — um fundo não detém o mesmo ativo duas vezes; dois holdings com `AssetID = nil` **não**
  contam como duplicata entre si, testado explicitamente). Peça central que fecha o critério de
  aceite: `etf.ConstituentsFromHoldings(holdings []Holding, quantities map[string]int64, prices
  map[string]float64) ([]Constituent, error)` (`basket.go`, novo) — converte a composição real
  (`Details.Holdings`) nos `Constituent` que `NAV` (H.1) já sabia consumir, ignorando (sem erro)
  holding sem `AssetID` (constituinte cosmético nunca entra no NAV) e devolvendo
  `ErrMissingConstituentQuantity`/`ErrMissingConstituentPrice` quando falta dado pra um holding
  real — mesma regra de "esta função não decide como precificar" já documentada em `Constituent`:
  `quantities`/`prices` chegam resolvidos por quem chama (cotação de mercado corrente pra Ação/FII,
  PU marcado a mercado pra renda fixa). `CatalogRepository.CreateETFDetails`/`FindETFDetails`
  (`catalog_repository.go`) persistem/leem a coluna nova (`sql.NullString` no scan, mesmo padrão já
  usado pro resto do pacote). Nenhuma rota HTTP tocada — `GET /assets/:id` (`assets.go`) continua
  serializando só `constituent_name`/`weight_pct` (decisão de escopo desta sessão: expor `asset_id`
  na API é passo de produto separado, sem pedido/consumidor ainda — nada no frontend ou em H.2/H.3
  precisa disso via HTTP, só via domínio) — por isso sem `.docs/engine/` atualizado. Testes novos:
  `etf_test.go` (cesta mista com/sem `AssetID` coexistindo, `AssetID` vazio rejeitado, `AssetID`
  duplicado rejeitado, dois holdings sem `AssetID` não conflitam), `basket_test.go` —
  `TestConstituentsFromHoldings_CestaMistaAcaoFiiRendaFixaPrecificadaCorretamente` é o teste do
  critério de aceite propriamente dito (3 holdings reais — Ação/FII/renda fixa — mais um cosmético,
  convertidos via `ConstituentsFromHoldings` e alimentando `NAV` de verdade, confirmando o valor
  exato) — mais holding cosmético ignorado sem erro e os dois erros de dado ausente. `gofmt`/
  `go build`/`go vet`/`go test ./...`/`golangci-lint run` (Docker, v2.12.2, 0 issues) verdes.
  **Validado ao vivo via `docker compose up -d --build`** (dados reais já seedados, sem `down -v`):
  migration aplicou limpo (`\d etf_holdings` confirmou a coluna + FK); holdings cosméticos
  pré-existentes do seed (`asset_id = NULL`) intocados; inserção manual de 3 holdings reais
  referenciando VALR3 (Ação)/TJLO11 (FII)/LFT2029 (renda fixa) — os três já seedados — bem-sucedida,
  coexistindo com os cosméticos na mesma cesta somando 100%; FK rejeitou (`23503`) uma inserção com
  `asset_id` inexistente, confirmando a integridade referencial na prática, não só pela declaração
  do schema. Estado revertido ao final (holdings de teste removidos, pesos originais restaurados) e
  stack parada com `docker compose down`.

  **Addendum — teste de ponta a ponta da Fase H inteira (sessão separada, 2026-09-19):** achou e
  corrigiu, mecanicamente, um gap que a validação acima não cobria — nada impedia um ETF de
  referenciar a si mesmo como constituinte da própria cesta (`etf_holdings.asset_id =
  etf_holdings.etf_asset_id`), o que faria H.1 (NAV) somar o valor do próprio ETF como parte do
  patrimônio que sustenta seu próprio preço. Migration `000019_etf_holdings_no_self_reference`
  (`CHECK (asset_id IS NULL OR asset_id <> etf_asset_id)`) fecha isso — validado ao vivo (inserção de
  auto-referência rejeitada pela CHECK nova; cesta mista real de H.4 e cascade de FK revalidados sem
  regressão). Achou também um segundo gap, este de decisão de produto (registrado e **já resolvido**
  como achado 006 em `pontos-em-aberto-decisao-produto.md`, seção "Resolvidos"): `RebalanceOrders`/
  H.2/H.3 exigem que `TargetWeightPct` some ~100%, mas os pesos reais de `Details.Holdings` sozinhos
  (excluindo cosmético) somam menos que isso sempre que a cesta documentada tem uma linha cosmética
  com peso não-trivial. **Decisão do autor:** como a plataforma nunca replicou a composição de um
  índice real (spec 3.6 já falava em "índice simulado" — `BenchmarkIndex` é só rótulo de exibição),
  não há motivo de produto pra um ETF operado pelo robô mecânico ter fatia cosmética — todo ETF
  elegível pra H.2/H.3 precisa nascer com cesta 100% real (todo `Holding` com `AssetID` preenchido);
  o constituinte cosmético (`AssetID = nil`, H.4) continua existindo no domínio só pra ETF puramente
  ilustrativo, nunca operado pelo robô. Regra de **dado/catálogo**, não mudança de código em `etf` —
  mas o único dado existente (`SINT11`, `cmd/seed/main.go:seedETF`) já foi corrigido na mesma sessão:
  as 2 empresas fictícias + "Outros" (100% cosmético) viraram 100% holdings reais (`VALR3` 50%/
  `TJLO11` 35%/`LFT2029` 15%), com `seedETF` reordenada em `main()` pra rodar só depois dos 3
  constituintes já seedados. Validado primeiro contra um Postgres descartável (não o volume de dev):
  migration + seed do zero, `etf_holdings` com as 3 linhas reais somando 100%, reexecução idempotente.
  **A pedido do autor, o volume de dev persistente também foi corrigido** (não só bancos novos
  criados a partir daqui): `SINT11` não tinha posição/ordem real referenciando o ativo (só cotação
  histórica de `asset_quotes`, intocada), então a cesta antiga foi substituída pela real via
  `DELETE`+`INSERT` direto em `etf_holdings` (mesmo resultado que `seedETF` produz), sem apagar
  `assets`/`etf_details`/cotações — `GET /assets/:id` contra o motor rodando confirmou a resposta
  certa depois da troca. Regressão viva em `basket_test.go`
  (`TestPesoDeHoldingRealNaoServeDiretoParaRebalanceOrders_QuandoCestaTemConstituinteCosmetico`)
  continua útil como documentação do porquê da regra existe.

---

## Fase I — Selic × IPCA (independente, pode rodar a qualquer momento)

### I.1 · Regra de reação à inflação em `selic.Config` ✅

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
- **Entregável (sessão 2026-09-19):** `selic.Config.InflationWeight` (novo, `DefaultInflationWeight
  = 1.5`, mesmo padrão de `Neutral`/`ReversionSpeed`/`Volatility`). `NextCalendarRate`/
  `CalendarSeries` ganham um parâmetro novo pro desvio do IPCA acumulado frente à meta —
  `ipcaAccumulatedDeviation float64` (escalar, `NextCalendarRate`) e `ipcaAccumulatedDeviations
  []float64` (paralelo aos dias, `CalendarSeries`) — em vez de o pacote `selic` importar `ipca`
  (domínios irmãos não se importam, `.claude/arquitetura-engine-go.md`, mesmo precedente de
  `equity.Series` recebendo a Selic simulada como parâmetro). **Decisão de acumulação (pergunta
  aberta no texto original da tarefa):** o cálculo do IPCA acumulado 12m fica com quem orquestra —
  hoje ninguém, porque `ipca.MonthlySeries` ainda não tem consumidor no tick diário (achado já
  documentado na Fase M); `tick.Advance` passa o desvio fixo em `0` (comentado no código,
  referenciando a Fase M) até M.1 gerar+persistir a série de verdade e alimentar esse valor —
  índice fora do slice (incluindo slice `nil`) também vale `0`, sem pânico, o mesmo tratamento
  usado por quem ainda não tem série de IPCA disponível. Nova função interna `reactionStep`
  (`copom.go`) unifica o cálculo do movimento bruto (reversão + inflação + ruído), compartilhada
  por `NextCalendarRate` e `CalendarSeries` — extraída na mesma tarefa porque I.2 (quantização)
  precisa do mesmo valor bruto nos dois pontos de entrada. `gofmt`/`go vet`/`go build`/`go test
  ./...`/`golangci-lint run` (Docker, `golangci/golangci-lint:v2.12.2`, 0 issues) verdes. `.docs/
  engine/tick.md` atualizado. Sem `.docs/engine/` novo nem `docker compose up` (função pura de
  domínio, sem rota HTTP nem schema tocado — mesma nota de escopo de B.1/C.1-C.5/H.1).

### I.2 · Passos discretos do Copom ✅

- **Descrição:** o tamanho do movimento em cada reunião do Copom simulado passa a ser quantizado
  em incrementos de 0,25 p.p. (arredondando o resultado da regra de reação, I.1, pro múltiplo de
  0,25 mais próximo) em vez de um valor decimal contínuo direto do ruído gaussiano.
- **Critérios de aceite:** teste confirmando que toda mudança de Selic simulada em dia de reunião
  é sempre um múltiplo de 0,25 p.p.
- **Referências:** proposta seção 6.
- **Dependências:** I.1.
- **Entregável (sessão 2026-09-19, mesma sessão da I.1):** `selic.CopomStepIncrement = 0.25` +
  `quantizeStep` (nova, `math.Round(step/CopomStepIncrement)*CopomStepIncrement`) aplicada ao
  resultado de `reactionStep` (I.1) antes de somar à taxa corrente, nos dois pontos de entrada
  (`NextCalendarRate`/`CalendarSeries`) — o piso de "Selic nunca negativa" continua aplicado
  **depois** da quantização, sobre a taxa já somada (não sobre o passo em si). **Achado de sessão
  que vale lembrar pra calibração futura (tarefa 8.1) ou pra qualquer teste novo desta regra:** com
  `InflationWeight` no default (1.5), um desvio de IPCA pequeno (ex: 2 p.p.) quantiza pra `0` —
  `1.5×0.02 = 0.03`, abaixo de meio passo (`0.125`) — e não move a Selic simulada sozinho numa
  única reunião; isso é o comportamento real esperado (o Copom não muda a taxa por um desvio
  insignificante), não um bug, mas os testes precisam de desvios grandes o bastante (usado `0.1`,
  10 p.p.) pra cruzar o arredondamento e provar a direção do efeito de forma determinística. Teste
  novo confere que toda mudança em dia de reunião, ao longo de 100 reuniões com ruído/inflação
  ativos, é sempre múltiplo exato de `CopomStepIncrement` (com uma exceção documentada no próprio
  teste: quando o piso de taxa-nunca-negativa clampa o resultado, o delta final deixa de ser um
  múltiplo — não é uma "decisão de tamanho" do Copom, é o clamp de não-negatividade já existente
  desde a tarefa 2.2). `gofmt`/`go vet`/`go build`/`go test ./...`/`golangci-lint run` (Docker,
  v2.12.2, 0 issues) verdes. Mesma nota de escopo de I.1 (sem `.docs/engine/` novo, sem `docker
  compose up`).
- **Nota do teste de ponta a ponta (sessão 2026-09-19, mesmo dia) — achado 007, resolvido:** o
  achado acima ("2 p.p. de IPCA não move a Selic, comportamento esperado") foi revisitado — o
  motivo raiz não era só "o Copom ignora desvio pequeno", era uma mistura de escala entre
  `ipcaAccumulatedDeviation` (decimal) e o passo medido em pontos percentuais inteiros: o limiar
  real pra cruzar meio passo era **8,33 p.p.** com o peso original (1.5), bem acima de qualquer
  desvio de IPCA realista que a composição de 12 meses da M.1 deve produzir. Registrado como achado
  007 em `pontos-em-aberto-decisao-produto.md` e, a pedido do autor na mesma sessão,
  **`DefaultInflationWeight` recalibrado de 1.5 pra 7.5** (mantendo `ipcaAccumulatedDeviation`
  decimal — trocar pra escala de pontos com o mesmo peso 1.5 foi testado e diverge, ver decisão
  completa no achado 007): agora um desvio de ruído (<1 p.p.) segue sem mover a Selic, mas um
  desvio persistente de 2-5 p.p. reage em passos de 0,25 realistas e converge a um patamar estável.
  Regressão viva em `TestNextCalendarRate_DesvioRealistaDeIPCAReageDeFormaGradualEEstavel`
  (`copom_test.go`). **M.1 não precisa mais resolver nada de escala** — só alimentar
  `ipcaAccumulatedDeviation` como decimal (`IPCA_acumulado - meta_IPCA`, sem multiplicar por 100),
  mesma convenção que `ipca.Config` já usa.

---

## Fase J — Ações ON/PN

### J.1 · Empresa com 1 ou 2 ativos de Ação vinculados ✅

- **Descrição:** o catálogo passa a suportar uma empresa (`company_id`) com dois ativos de Ação
  (`asset_id` diferentes, ON e PN), cada um com seu próprio ticker/book, ambos compartilhando o
  mesmo ciclo de `company_fundamentals`. Ver nota 6 da seção "Como usar este arquivo" sobre a
  interação com a tarefa `7.2` do backlog principal (`BNDD3`/`BNDD4`).
- **Critérios de aceite:** teste confirmando que duas ações da mesma empresa compartilham o mesmo
  `company_fundamentals` (mesmo balanço) mas têm preços independentes (books separados).
- **Referências:** proposta 2.8, item 1.
- **Dependências:** A.1, A.2 (book real já revertido).
- **Entregável:** achado principal desta sessão — **o catálogo já suportava isso desde antes deste
  redesenho começar**, por construção, sem precisar de nenhuma migration/mudança de domínio nova:
  `variable_income_assets.company_id` (schema `000001`) já é nullable e **sem nenhuma constraint de
  unicidade**, `catalog.NewVariableIncomeAsset` nunca validou "um ativo por empresa", e as três
  peças que leem por `company_id` (`ListCompaniesForFundamentals`/`companyRoundContexts` no motor de
  rodada, `ListAssetsByCompany`/`GET /companies/:id`) já são naturalmente 1-empresa-para-N-ativos —
  o único motivo de nunca ter existido na prática é o seed (`cmd/seed/main.go`) sempre ter criado
  uma empresa nova por ticker (`VALR3`/`BNDD4`), nunca reaproveitado uma já existente. Sessão foi
  majoritariamente prova, não implementação (mesmo precedente da F.1): nenhuma migration, nenhuma
  mudança em `internal/domain/catalog/`, `internal/infra/db/catalog_repository.go` ou
  `internal/infra/httpserver/companies.go` — só testes novos, mais uma nota de código já existente
  (`tick.go:486`) que documentava essa lacuna de cobertura desde a Fase D/E ("uma empresa com mais
  de um ativo vinculado usa o risk_class do primeiro encontrado... a função não trava se acontecer")
  e que este teste finalmente exercita de verdade.
  - `catalog/variableincome_test.go`: subteste novo `"duas classes (ON+PN) vinculadas à mesma
    empresa"` — confirma que dois `NewVariableIncomeAsset` com o mesmo `CompanyID` e `ShareClass`
    diferentes (`asset_id` também diferentes) são ambos válidos, sem nenhuma validação nova
    precisando ser escrita (o construtor já aceitava isso).
  - `tick/rounds_test.go`: dois testes novos cobrem as duas metades do critério de aceite
    separadamente. `TestCompanyRoundContexts_EmpresaComDoisAtivosDeAcaoCompartilhaMesmoContexto`
    prova "compartilham o mesmo `company_fundamentals`" no nível certo — `companyRoundContexts` é
    indexado por `CompanyID` (nunca por `AssetID`), então duas ações da mesma empresa produzem
    **uma única entrada** no mapa (`len(contexts) == 1`), e `assetCompanies` resolve as duas de
    volta pra essa mesma entrada — comparação direta de struct (`ctxForOn != ctxForPn`) confirma
    que são literalmente o mesmo valor, não só "parecidos". `TestRunIntradayRounds_
    DuasAcoesDaMesmaEmpresaNegociamEmBooksIndependentes` prova a outra metade ("preços
    independentes/books separados") via `runIntradayRounds` real (Market Maker, 20 rodadas,
    seed determinística — sem flakiness, `rand.Intn` seedado por `roundSeed` já era 100%
    reprodutível antes desta tarefa): `closing[on1]`/`closing[pn1]` batem exatamente com o último
    fill submetido pra cada `asset_id` respectivamente, provando que `state := equities[chosen.
    AssetID]` (o mecanismo de tracking de preço por ativo já existente desde D.2) nunca deixa um
    fill de uma classe vazar pro preço da outra.
  - **Achado explorado, não é regressão desta tarefa (documentado no próprio comentário de
    `companyEquityRiskClasses`, `tick.go:482-488`, desde a Fase D/E):** se duas classes da mesma
    empresa fossem seedadas com `risk_class` diferente entre si (não deveria acontecer na prática —
    é a mesma empresa, mesmo perfil de risco —, mas o schema não impede), o Fundamentalista usaria
    o risk_class "do primeiro encontrado" pras duas, nunca travando mas potencialmente inconsistente
    pra uma delas. Como isso não é uma regra de negócio testável isoladamente sem mudar a assinatura
    de `companyEquityRiskClasses`, e a J.4 (seed real) é quem decide os valores de `risk_class` de
    cada classe, não foi necessário registrar isso em `pontos-em-aberto-decisao-produto.md` — a
    decisão certa (mesma classe de risco pras duas classes da mesma empresa) é óbvia o suficiente
    pra não precisar de confirmação do autor, e a J.4 deve simplesmente seguir essa convenção.
  - **Validado ao vivo via `docker compose up -d --build`** (dados reais já seedados, sem `down
    -v`): inseri manualmente `VALR4` (PN, `outstanding_shares` 200.000.000) vinculado ao mesmo
    `company_id` da `Mineradora Vale do Rio S.A.` que já tinha `VALR3` (ON, 500.000.000) — `GET
    /companies/:id` real (via `curlimages/curl` na rede interna do Compose, mesma técnica de sessões
    anteriores) passou a devolver os dois ativos (`VALR3`/`VALR4`, `share_class` `ON`/`PN`) com a
    **mesma** lista de `fundamentals` (21 ciclos de relatório idênticos para os dois); `GET
    /assets/:id` de cada um confirmou `outstanding_shares` e indicadores por ação (LPA/VPA)
    diferentes entre as duas classes (esperado — dividem o mesmo lucro/patrimônio por uma base de
    ações diferente) enquanto `VALR3` manteve seu `current_price`/book histórico intocado e `VALR4`
    (recém-inserido, sem alocação de bot/float ainda — isso é trabalho da J.4, não desta tarefa)
    corretamente sem nenhum `current_price` ainda. `VALR4` de teste removido ao final (`DELETE` nas
    duas tabelas, mesma transação) — volume de dev restaurado ao estado anterior à sessão, `docker
    compose down` (sem `-v`).
  - `gofmt`/`go vet`/`go build`/`go test ./...`/`golangci-lint run` (Docker, v2.12.2, 0 issues)
    verdes. Sem `.docs/engine/` (nenhuma rota HTTP nova/alterada — `GET /companies/:id` e `GET
    /assets/:id` já existiam e já suportavam isso).

### J.2 · Dividendo com prioridade legal de PN ✅

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
- **Entregável:** migration `000020_company_pn_dividend_premium` adiciona
  `companies.pn_dividend_premium_pct numeric(5,2) NOT NULL DEFAULT 10` — empresa existente
  (`VALR3`/`BNDD4`, cada uma ainda só-ON/só-PN nesta tarefa, J.4 é quem funde num par real) recebeu
  o default via backfill automático da própria coluna `NOT NULL DEFAULT`, sem migration de dado
  separada. `dividend.EquityValuePerShare` (`dividend.go`) muda de assinatura — de
  `(netIncome, outstandingShares) (float64, bool)` pra
  `(netIncome, onShares, pnShares int64, pnPremiumPct float64) (onValue, pnValue float64, ok bool)`:
  o provento total do ciclo (`netIncome * DefaultEquityPayoutRatio`) é dividido entre as duas bases
  de forma que `pnValue` seja exatamente `pnPremiumPct`% maior que `onValue`, não uma divisão
  igualitária das duas bases — `onShares`/`pnShares` = 0 (empresa só de uma classe) reduz
  exatamente à fórmula antiga (`netIncome * payout / shares`), confirmando o critério de "sem
  quebra de compatibilidade". Nova constante `DefaultPnDividendPremiumPct = 10.0`.
  - `tick.go`: `CompanyForFundamentals` ganha `PnDividendPremiumPct`; `DividendPayerAsset` ganha
    `ShareClass *string` ("ON"/"PN", só preenchido pra "acao", mesma convenção do seed). Novo tipo
    `equityShareClasses` (`On`/`Pn int64`) e `equityShareClassesByCompany` agregam a base de ações
    de cada classe de uma empresa a partir da lista completa de `payers` (J.1 já permite 1 ou 2
    `asset_id` por `company_id`) — pré-computado uma vez por tick, não recalculado por ativo.
    `dividendRecordsForCycle` ganha o parâmetro `pnPremiumPctByCompany map[string]float64` e, pro
    caso `"acao"`, chama `dividend.EquityValuePerShare` com as duas bases agregadas + o premium da
    empresa, escolhendo `pnValue` ou `onValue` conforme `a.ShareClass` do ativo sendo processado.
  - `tick_repository.go`: `ListCompaniesForFundamentals` passa a ler `c.pn_dividend_premium_pct`;
    `ListDividendPayerAssets` passa a ler `via.share_class`.
  - Testes novos: `dividend_test.go` (`TestEquityValuePerShare` reescrito, 5 casos table-driven —
    só-ON normal/zero/negativo/net_income-negativo + ON+PN premium default 10% + ON+PN premium
    customizado 20%, todos os três critérios de aceite cobertos) e `tick_test.go`
    (`TestAdvance_Dividendos_EmpresaOnPnAplicaPrioridadeLegalDaPn`, prova de ponta a ponta dentro do
    domínio: duas `DividendPayerAsset` do mesmo `company_id` com `ShareClass` ON/PN geram dois
    `DividendRecord` distintos, com `pn.ValuePerShare == on.ValuePerShare * 1.25` pro premium de
    25% configurado no teste).
  - **Validado ao vivo via `docker compose up -d --build`** (mesma técnica de sessões
    anteriores — dados reais já seedados, sem `down -v`): confirmado `\d companies` com a coluna
    nova e as duas empresas existentes já com `pn_dividend_premium_pct = 10.00` via backfill
    automático do `DEFAULT`. Inseri manualmente `VALR4` (PN, `outstanding_shares` 250.000.000)
    vinculado ao mesmo `company_id` de `VALR3` (ON, 500.000.000, mesma técnica de inserção manual
    da J.1) e avancei o Temporizador via `POST /admin/tick` (rede interna do Compose) até o próximo
    dia de relatório da empresa — `dividend_events` gerado mostrou `VALR3 (ON) = 6.73` e
    `VALR4 (PN) = 7.40`, razão ≈ 1.10, exatamente o premium default de 10% configurado na empresa.
    `VALR4` de teste removido ao final (mesma transação cobrindo `dividend_event_recipients`,
    `dividend_events`, `order_book`, `asset_quotes`, `variable_income_assets`, `assets` — mais
    dependências de FK que a remoção da J.1 por causa dos fills de bot acumulados nas rodadas
    intradiárias entre os ticks avançados), `docker compose down` (sem `-v`). Efeito colateral
    aceito e não revertido: o dia simulado avançou de 293 pra 308 (15 ticks forçados pra alcançar o
    próximo ciclo de relatório de 14 dias) — mesmo tipo de avanço de tempo que qualquer validação
    ao vivo via `POST /admin/tick` já produz, não é um dado corrompido.
  - `gofmt`/`go vet`/`go build`/`go test ./...`/`golangci-lint run` (Docker, v2.12.2, 0 issues)
    verdes. Sem `.docs/engine/` (nenhuma rota HTTP nova/alterada).

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

### J.5 · Revisão da lição 2.3 (Nomenclatura de tickers) pro par ON/PN real + esclarecimento sobre units

- **Descrição:** pedido do autor além do que a proposta original cobria. Duas revisões de
  conteúdo, não de mecanismo (mesmo padrão de "autoria de conteúdo só" já usado nas sub-tarefas
  7.1.x do backlog principal):
  1. `7.1.3` (backlog principal, já concluída) escreveu a revelação de 2.3 contrastando
     `VALR3`/`BNDD4` como exemplo de ON/PN — mas essas são **duas empresas diferentes** (nota 9
     desta seção). Assim que `J.4` gerar um par real (mesma empresa, mesmo `company_id`, dois
     `asset_id`), a revelação passa a usar esse par de verdade — reforça o que a spec 5.1 já
     promete ("final 3 = ON, final 4 = PN" da mesma empresa) em vez de uma analogia entre
     empresas distintas.
  2. **Esclarecimento sobre units** (pedido do autor, decisão desta sessão — 2026-09-13,
     confirmada via pergunta ao autor: só conteúdo de lição, **sem** criar ativo negociável novo
     no catálogo, mantendo a decisão já registrada na proposta 2.8 de não reaproveitar o sufixo
     final 11 pra um instrumento novo). A revelação de 2.3 ganha um parágrafo citando que, no
     mercado real, o sufixo final 11 não é exclusivo de FII/ETF — units (ON+PN empacotadas numa
     unidade só, ex: `SANB11` na vida real) também terminam em 11, e a forma de diferenciar não é
     o sufixo (os três — FII, ETF, unit — compartilham o final 11 na B3 de verdade), é o tipo de
     instrumento por trás do ticker. Sem unit negociável no catálogo simulado (só FII/ETF usam 11
     aqui, `SINT11`/`TJLO11`/`PAPL11` já seedados) — o parágrafo é conceitual/comparativo com o
     mercado real, não introduz um terceiro tipo de ativo terminado em 11 na simulação.
- **Critérios de aceite:** revelação de 2.3 citando o ticker ON/PN real gerado pela J.4 (não mais
  `VALR3`/`BNDD4` como empresas separadas); parágrafo sobre units presente e tecnicamente correto
  (não afirma que a simulação tem um ativo unit, só explica o conceito do mercado real); nenhuma
  mudança em `unlocksKeys`/`unlocksAssetTicker`/gate de desbloqueio (já corretos desde a 7.1.3,
  esta tarefa não mexe em mecanismo).
- **Referências:** nota 9 desta seção; pedido do autor nesta sessão (2026-09-13); spec 5.1, linha
  247 (2.3).
- **Dependências:** J.4.

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

## Fase M — Indicadores macroeconômicos visíveis (Selic/IPCA)

Pedido do autor além do que a proposta original cobria (2026-09-13): hoje **não existe nenhuma
tela no frontend mostrando Selic/IPCA** — o usuário nunca vê os dois indicadores que o motor já
simula, só sente o efeito indireto deles no preço/rendimento dos produtos. E, mais grave, **IPCA
hoje não tem nenhum consumidor no tick diário** (`ipca.MonthlySeries` existe e é testado desde a
3.4, mas `tick.Advance`/`tick.go` nunca chama esse pacote — só serve hoje o cálculo sob demanda de
VNA na compra de Tesouro IPCA+, Fase L.2). Sem uma série de IPCA gerada e persistida dia a dia,
não tem o que mostrar num gráfico nem o que a Fase I precisa acumular. Esta fase resolve os dois
problemas juntos: gerar+persistir a série, expor via API, e só então mostrar no frontend.

### M.1 · Histórico diário persistido de Selic e IPCA

- **Descrição:** hoje `market_calendar` (migration `000004_market_calendar_and_quotes.up.sql`) é
  uma linha singleton só com o dia/Selic **corrente** — não guarda histórico, e IPCA não é gerado
  no tick (ver nota da Fase M acima). Tabela nova (ex: `market_indicator_history`, mesmo padrão de
  `asset_quotes` — uma linha por dia simulado, nunca atualizada depois de gravada, unicidade em
  `simulated_day`) grava, a cada tick: a Selic do dia (já calculada, só passa a ser também
  persistida em histórico, não só na linha singleton), o IPCA mensal do dia (`ipca.MonthlySeries`
  passa a ser chamado de dentro de `tick.Advance`, um valor novo por mês simulado — a decidir na
  sessão a cadência exata: todo dia repete o valor do mês corrente, ou só grava linha nova no dia
  que vira o mês) e o IPCA acumulado em 12 meses (soma/composição dos últimos 12 valores mensais).
  **Esta é a mesma peça que a I.1 já sinaliza precisar** ("precisa também de um jeito de acumular
  o IPCA simulado ao longo do tempo... a decidir na sessão se isso vive em `ipca` ou é calculado
  por quem orquestra `tick`") — quem pegar M.1 ou I.1 primeiro deve conferir se a outra já
  resolveu a acumulação antes de duplicar o mecanismo (mesmo padrão de coordenação da nota 6/9).
  **Achado 007 (`pontos-em-aberto-decisao-produto.md`, notado no teste de ponta a ponta da Fase I)
  já resolvido — `DefaultInflationWeight` recalibrado de 1.5 pra 7.5 na própria sessão da I.1/I.2.
  M.1 só precisa alimentar `ipcaAccumulatedDeviation` como decimal** (`IPCA_acumulado - meta_IPCA`,
  ex: `0.02` pra 2 p.p., sem multiplicar por 100 — mesma convenção que `ipca.Config` já usa), sem
  nenhum ajuste de escala adicional.
- **Critérios de aceite:** depois de N dias de tick simulado, a tabela nova tem exatamente uma
  linha por dia com Selic e IPCA coerentes; teste confirmando que o IPCA acumulado em 12 meses
  bate com a composição correta dos últimos 12 valores mensais (não soma simples); teste de
  regressão confirmando que `market_calendar` (linha singleton, leitura corrente) continua
  funcionando sem mudança de contrato.
- **Referências:** proposta seção 6; nota da tarefa I.1 sobre acumular IPCA; achado 007
  (`pontos-em-aberto-decisao-produto.md`); relatório `tmp/relatorio-logica-mercado.md` (IPCA sem
  consumidor).
- **Dependências:** nenhuma (mas ver nota de coordenação com I.1 acima).

### M.2 · Endpoint HTTP de série histórica (engine)

- **Descrição:** rota nova (ex: `GET /market/indicators/history`) devolvendo a série persistida em
  M.1 — Selic/IPCA mensal/IPCA acumulado 12m por dia simulado, com parâmetro de janela (ex: último
  N dias/meses, a decidir na sessão o range default). Mesmo padrão de autenticação/trust boundary
  das demais rotas de leitura de mercado (motor não valida role, backend decide o que expor
  publicamente).
- **Critérios de aceite:** teste de router cobrindo resposta com dados reais persistidos por M.1 e
  o caso de motor recém-subido (sem histórico ainda, resposta vazia sem erro).
- **Referências:** proposta seção 6.
- **Dependências:** M.1.

### M.3 · Rota no backend gamificado + cache Redis

- **Descrição:** módulo `market` (backend) ganha uma rota nova (ex: `GET /market/indicators`)
  proxying pro endpoint da M.2, com cache Redis de TTL curto (indicador só muda no máximo 1x por
  dia simulado — mesmo racional de cache já usado pra cotação/ranking, tarefa 5.7). Documentar em
  `.docs/backend/market.md` (payload, sucesso, erros, regra — template `.docs/README.md`).
- **Critérios de aceite:** rota valida entrada com Zod (parâmetro de janela, se exposto); teste de
  caso de uso com fake do port de leitura de mercado; teste de adapter contra Redis real; teste de
  router via supertest.
- **Referências:** `.claude/arquitetura-backend-ddd-lite.md`; `.docs/backend/market.md`.
- **Dependências:** M.2.

### M.4 · Tela "Indicadores Econômicos" no frontend

- **Descrição:** tela nova (a decidir na sessão o ponto de entrada exato — candidato natural é um
  card em Home/Mercado linkando pra uma tela dedicada, seguindo o padrão de sparkline já
  estabelecido pra ativos em `.claude/identidade-visual-padroes.md`) mostrando Selic atual + linha
  histórica, IPCA mensal + acumulado 12m + linha histórica, e a data do próximo Copom simulado
  (calendário já existente desde a 3.3). Responsiva nos três breakpoints (mobile/tablet/desktop,
  regra obrigatória do `CLAUDE.md`); desktop ganha composição própria, não coluna única esticada.
  Atualizar `.claude/inventario-telas-plataforma-investimentos.md` com a tela nova (objetivo,
  conteúdo, ações, navegação, dados envolvidos).
- **Critérios de aceite:** tela renderiza dado real do endpoint M.3 (não mockado); validada nos
  três breakpoints; entrada de navegação confirmada a partir de pelo menos um ponto existente do
  app (Home ou Mercado).
- **Referências:** `.claude/identidade-visual-padroes.md`, `.claude/identidade-visual-tokens.md`;
  `.claude/inventario-telas-plataforma-investimentos.md`.
- **Dependências:** M.3.

### M.5 · Novas lições: "Como a Selic é formada" e "O que é o IPCA"

- **Descrição:** pedido do autor além do que a proposta original cobria — currículo hoje (spec
  5.1) não tem nenhuma lição explicando **o mecanismo** por trás da Selic (Copom, reunião, decisão
  de reação à inflação) nem o que é o IPCA como índice (IBGE, cesta de bens, por que é a referência
  de meta) — 0.3 (Inflação e poder de compra) é conceitual/genérico, 1.2 (Tesouro Selic) ensina o
  produto não o indicador, 1.8 (Tesouro IPCA+) ensina VNA não o índice em si. Duas lições novas na
  Trilha 1 (Renda Fixa), posição sugerida a confirmar na sessão: "Como a Selic é formada" logo
  após 1.2 (usuário já conhece o produto que rastreia o indicador) e "O que é o IPCA" logo após 0.3
  ou antes de 1.8 (a decidir — 0.3 já dá o contexto de inflação, 1.8 é onde o aluno primeiro
  precisa do número de verdade pro VNA). Ambas `reflection`, sem produto novo pra desbloquear
  (`unlocksKeys` vazio) — mas a Revelação embute/referencia a tela ao vivo da M.4 (mesmo padrão já
  usado pelo `live_indicator` das lições 2.6.x, "aprender fazendo" com dado real da própria
  simulação em vez de número de papel). **Esta tarefa deve rodar depois de I.1/I.2** (Selic × IPCA)
  — sem a regra de reação à inflação implementada, a lição descreveria só reversão à média, não o
  mecanismo real que o motor de fato simula; rodar antes descreveria um comportamento que o motor
  ainda não tem. Atualiza a tabela de currículo da spec 5.1 (Trilha 1 passa de 9 para 11 lições,
  total do currículo de 33 para 35) e reordena `sortOrder` das lições subsequentes da Trilha 1 em
  `backend/src/db/seedLessons.ts` — mesma disciplina de "autoria real, sem placeholder" já usada
  em toda a 7.1.x do backlog principal.
- **Critérios de aceite:** as 2 lições com conteúdo real (`scenarioText`/`microDecisionPrompt`/
  `revelationText`), sem string vazia; Revelação de cada uma mostrando dado real vindo da M.4/M.3
  (não hardcoded); spec 5.1 atualizada com a contagem nova; seed idempotente (`onConflictDoUpdate`,
  mesmo padrão da 7.1.x) rodado duas vezes sem duplicar.
- **Referências:** spec 5.1 (Trilha 1); proposta seção 6; pedido do autor nesta sessão
  (2026-09-13).
- **Dependências:** I.1, I.2, M.4.

---

## Fase N — Painel Admin de Bots

Pedido do autor além do que a proposta original cobria (2026-09-13), **última prioridade da
sequência sugerida** (palavras do autor: "essa pode ser a última parte") — só depois do núcleo de
bots (Fase C) existir de verdade, senão não há o que listar/criar. Reaproveita o padrão visual já
estabelecido pelo Painel Admin de Eventos Macro (telas 10.1/10.2, tarefa 6.11).

### N.1 · Endpoints admin pra listar/criar/desativar bots

- **Descrição:** motor ganha rotas administrativas (mesmo trust boundary de `POST /admin/tick` —
  sem checagem de role aqui, backend valida `role = admin` antes de repassar, `admin.go:14-23`):
  `GET /admin/bots` (lista com personalidade/arquétipo, escopo de especialização, `is_active`
  (A.4), posição/caixa atual por ativo), `POST /admin/bots` (cria bot novo — personalidade (C.1),
  escopo de especialização, caixa/posição inicial, reaproveitando validação de domínio já existente
  em vez de duplicar), `PATCH /admin/bots/:id` (alterna `is_active`, A.4). Backend expõe as 3 rotas
  atrás de `authMiddleware`/`role = admin` (mesmo padrão do Painel Admin de Eventos Macro, 4.5),
  documentadas em `.docs/engine/<pacote>.md` e `.docs/backend/admin.md`.
- **Critérios de aceite:** teste table-driven de criação cobrindo personalidade/escopo válidos e
  inválidos (reaproveitando a validação da C.1); teste confirmando que `PATCH` alterna `is_active`
  sem tocar posição/caixa (mesmo critério da A.4); teste de router (backend) confirmando `403` pra
  usuário não-admin nas 3 rotas.
- **Referências:** proposta 2.3; `.docs/engine/admin.md` (a criar/estender); tela 10.1/10.2 como
  precedente de padrão admin.
- **Dependências:** A.4, C.1, C.6 (catálogo de bots já existente pra listar).

### N.2 · Tela "Painel Admin — Bots" no frontend

- **Descrição:** tela nova dentro da área admin (mesmo padrão visual/navegação do Painel Admin de
  Eventos Macro, 10.1/10.2) — lista de bots (ticker/setor de cobertura, arquétipo, `is_active`,
  posição/caixa atual), alternância ativo/inativo por linha, formulário de criação de bot novo
  (arquétipo, escopo de especialização, ativo(s)-alvo, caixa/posição inicial). Atualizar
  `.claude/inventario-telas-plataforma-investimentos.md` com a tela nova.
- **Critérios de aceite:** lista renderiza dado real da N.1; alternar `is_active` reflete na
  listagem sem reload manual; criação de bot novo confirmada aparecendo na listagem e participando
  da rodada de negociação seguinte (D.2); responsiva nos três breakpoints.
- **Referências:** `.claude/identidade-visual-padroes.md`; tela 10.1/10.2 como precedente.
- **Dependências:** N.1.

---

## Fase O — Cancelamento e validade de ordem (Day)

Lacuna identificada numa sessão posterior (2026-09-13), fora da proposta original: a reversão da
liquidez sintética (A.2) fez ordem limitada sem contraparte passar a ficar pendurada de verdade no
book (`status = pending`), mas **nada nunca tira ela de lá** — não existe cancelamento pelo usuário
nem qualquer noção de validade/expiração. Decisão de escopo confirmada com o autor: MVP suporta só
a modalidade **Day** (expira no fechamento do dia simulado corrente, sem GTC nem data específica) —
menor escopo, reaproveita o Temporizador que já existe em vez de introduzir coluna de validade e
scheduler próprios. Independente do núcleo de bots (Fases B-N) — só depende de A.2, já concluída.

**Achado confirmado ao vivo (review do PR da Fase E, 2026-09-16, `docker compose up` com seed real +
~100 ticks de negociação de bot sequenciais):** a falta de reserva de saldo/posição (nota de escopo
de `orderexecution.go`, citada no O.1 abaixo) não é só uma lacuna teórica — ela produz, na prática,
ordens penduradas **furadas** (o dono vendeu a posição por outra ordem depois de deixar esta
pendurada) com frequência real de negociação de bot, não um caso extremo raro. Sintoma observado:
`db.OrderExecutionRepository.Persist` tentando aplicar o fill do lado da contraparte pendurada
(`applyPositionFill` → `position.ApplySell`) contra a posição real da tabela (lida com `FOR UPDATE`
dentro da própria transação, não o snapshot que `Execute` validou) e recebendo
`position.ErrInsufficientQuantity` — que só foi corretamente reconhecido como rejeição de negócio
(não falha de IO) depois de uma correção de identidade de erro nessa mesma sessão
(`orderexecution.ErrInsufficientPosition` virou alias de `position.ErrInsufficientQuantity`, mesmo
padrão que `ErrFloatExceeded` já usava — antes disso, esse erro escapava de todo `errors.Is` rio
acima e abortava o tick inteiro). Com a correção, `tick.businessRejection` (rounds.go, Fase D.2)
passa a **pular só a ordem do bot que perdeu a corrida**, não abortar o tick — seguro, mas isso por
si só **não resolve a ordem pendurada furada**: ela continua em `status = pending`/
`partially_filled` no book, com a `RemainingQuantity` original intacta (o `Persist` da tentativa
falha faz rollback de tudo, inclusive de `fillRestingOrder`), pronta pra ser escolhida de novo no
replay do próximo incoming order que cruzar aquele preço — e falhar de novo, pulada de novo,
repetidamente, até o fim do dia simulado. A **O.2** abaixo (expiração no fechamento do dia) limita
até onde essa ordem furada pode viver (nunca atravessa pro dia seguinte), mas **não impede múltiplas
tentativas de match falhas contra ela dentro do mesmo dia** — não travou nada nos ~100 ticks
observados (fills variaram normalmente, sem padrão de queda), mas é um desperdício de replay
(`Execute` reconstrói o book inteiro a cada tentativa) que cresce com o volume de negociação, e
quem pegar a Fase O deveria decidir explicitamente se isso é aceitável pro MVP ou se O.1/O.2 (ou um
O.3 novo) devem também cancelar/marcar a ordem pendurada furada assim que ela falhar dessa forma,
em vez de só no fechamento do dia.

### O.1 · Cancelamento manual de ordem pendente

- **Descrição:** rota nova (`POST /orders/{id}/cancel` ou `DELETE /orders/{id}` — a definir na
  sessão que pegar a tarefa, seguindo o estilo REST já usado pelas demais rotas de `server.go`) que
  muda `order_book.status` pra `cancelled`, só quando `status` for `pending` ou `partially_filled`
  e o `user_id` da ordem for o do usuário autenticado (backend valida dono antes de repassar ao
  motor, mesmo padrão de trust boundary das demais rotas). `filled_quantity` já executado antes do
  cancelamento não é revertido — só a `RemainingQuantity` deixa de estar sujeita a execução futura.
  Sem reserva de saldo/posição pra liberar (decisão de escopo da A.2/`orderexecution.go`: ordem
  pendurada nunca reservou nada), então cancelar não mexe em `accounts`/`positions` — é exatamente
  essa ausência de reserva que produz a ordem pendurada furada do achado confirmado ao vivo logo
  acima (intro desta fase); um cancelamento manual (usuário percebendo que vendeu por outro canal)
  ajudaria, mas não é a única via de detecção — considerar se o caminho automático (`Execute`/
  `Persist`, quando o match falha por posição insuficiente do lado pendurado) também deveria
  cancelar a ordem furada ali mesmo, em vez de só no fechamento do dia (O.2).
- **Critérios de aceite:** teste cobrindo cancelamento de ordem `pending` e `partially_filled`
  (sucesso, status vira `cancelled`); teste confirmando rejeição (`404`/`409`, a decidir) pra ordem
  já `filled`/`cancelled` ou pertencente a outro usuário; teste de router confirmando `403`/`404`
  pra tentativa de cancelar ordem de terceiro.
- **Referências:** `orderexecution.go` (doc do pacote, decisão de escopo de reserva); `orders.go`/
  `server.go` como precedente de rota.
- **Dependências:** A.2 (já concluída).

### O.2 · Expiração automática no fechamento do dia simulado (ordem Day)

- **Descrição:** ao fechar o dia simulado (mesmo ponto do `tick.Advance`/Temporizador que já
  processa Selic/calendário/proventos 1x por dia — não precisa esperar a Fase D existir, mesmo sem
  rodadas intradiárias o dia já fecha hoje), toda ordem com `status` `pending` ou
  `partially_filled` daquele ativo tem a `RemainingQuantity` cancelada (`status = cancelled`) — o
  que já foi preenchido permanece. Isso implementa a modalidade única do MVP ("Day": válida só até
  o fechamento do pregão simulado daquele dia, nunca atravessa pro dia seguinte). Sem coluna nova
  de validade — toda ordem limitada é implicitamente Day.
- **Critérios de aceite:** teste table-driven confirmando que ordem `pending`/`partially_filled` no
  fechamento do dia vira `cancelled`; teste de regressão confirmando que ordem já `filled` ou
  criada num dia posterior não é afetada pelo fechamento de um dia anterior; teste confirmando que
  o `RemainingQuantity` de uma ordem cancelada por expiração não volta a ser considerado em nenhum
  replay de book futuro (`Repository.LoadContext`/`loadRestingOrders` só lê ordens ainda
  `pending`/`partially_filled`).
- **Referências:** `tick.go` (`Advance`, ponto de fechamento diário); nota da Fase D sobre o
  Temporizador não mudar de ritmo diário mesmo com rodadas intradiárias.
- **Dependências:** A.2 (já concluída). Não depende de D — o fechamento de dia já existe
  independente de sub-tick.

---

## Sequência sugerida

1. **A.1 → A.2 → A.3 → A.4** (fundação — pode já rodar em paralelo às Fases I, K, L, que são
   independentes; A.4 só depende de A.1, pode entrar assim que A.1 fechar).
2. **B.1 → B.2** (distribuição do float, depende de A).
3. **C.1 → C.2 → C.3 → C.4 → C.5 → C.6** (arquétipos, depende de B; ordem interna por
   complexidade crescente).
4. **D.1 → D.2** (cadência intradiária, depende de C).
5. **J.1 → J.2 → J.3 → J.4 → J.5** (ON/PN — só depende de A/C.5, pode entrar em paralelo a partir
   do passo 3; J.5 é revisão de conteúdo de lição, fecha a fase).
6. **E.1 → E.2** (eventos macro por alvo, depende de C.5/D.2).
7. **F.1** (balanços via negociação, depende de C.5/E).
8. **G.1 → G.2 → G.3** (FIIs, depende de D).
9. **H.1 → H.2 → H.3 → H.4** (ETFs, depende de D/G).
10. **I.1 → I.2** (Selic × IPCA — independente, pode ser feita a qualquer momento, inclusive
    antes de tudo).
11. **K.1 → K.2** (calibração de fundamentos — independente, idem).
12. **L.1 → L.2 → L.3 → L.4** (Renda Fixa — independente, idem).
13. **M.1 → M.2 → M.3 → M.4** (indicadores macro visíveis — M.1 independente como I/K/L, pode
    rodar a qualquer momento; M.5, a autoria das 2 lições novas, só depois de **I.1 → I.2**
    fechados, ver nota da M.5).
14. **N.1 → N.2** (painel admin de bots — última prioridade da sequência, só depois de A.4 e do
    núcleo de bots, C.1 → C.6, existirem).
15. **O.1 → O.2** (cancelamento e validade Day de ordem — independente como I/K/L, só depende de
    A.2, já concluída; pode ser feita a qualquer momento, inclusive antes de tudo acima).
