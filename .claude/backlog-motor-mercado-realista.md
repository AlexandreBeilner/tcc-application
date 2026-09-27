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
parte da proposta original. As Fases O a Q vieram de achados de teste ponta a ponta (cancelamento de ordem, cobertura
contínua de Market Maker, liquidez que escala com o catálogo) e a **Fase R** (2026-09-26) liga o ETF ao motor de negociação real,
que as tarefas H.1 a H.4 deixaram só como funções puras.

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
10. **Achados sem tarefa própria neste backlog** (`.claude/pontos-em-aberto-decisao-produto.md`,
    seção "Em aberto", auditados de novo em 2026-09-20 — nenhum é bug mecânico, todos dependem de
    decisão de produto/design ainda não tomada): achado 001 (`RiskProfile.MarketOrderPreference`
    nunca lido por nenhum arquétipo), achado 004 (`macroPriceEffectsByCompany` soma sem teto, pode
    inverter o sinal do preço justo em eventos concorrentes extremos), achado 008 (Fundamentalista
    lê sensibilidade à Selic por `risk_class` pro retorno exigido, mas por setor — K.2 — pro
    crescimento; as duas podem divergir pra mesma empresa). Nenhum dos três bloqueia nenhuma tarefa
    listada acima nem tem uma tarefa própria aberta — ficam pendentes até o autor decidir corrigir
    ou documentar como comportamento aceito. **Achado 002** (teto de `SpreadWidthPct` do Market
    Maker) é diferente dos outros três — tem localização concreta, ver nota da tarefa `N.1` abaixo.

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

### J.3 · Bot Fundamentalista valoriza por classe ✅

- **Descrição:** o arquétipo Fundamentalista (C.5) calcula "preço justo" separadamente pra ON e
  PN da mesma empresa — mesmo fundamento (lucro, ROE), mas dividendo esperado por ação diferente
  (J.2), então o valor justo difere ligeiramente entre as duas classes.
- **Critérios de aceite:** teste confirmando que, pra uma empresa ON+PN com premium de dividendo
  configurado, o "preço justo" estimado pelo Fundamentalista pra PN é consistentemente maior que
  o de ON, proporcional ao premium.
- **Referências:** proposta 2.8, item 3.
- **Dependências:** J.2, C.5.
- **Entregável:** `bot.FundamentalistFairPrice` (`fundamentalist.go`) ganha um parâmetro novo,
  `pnPremiumPct` (posicionado ao lado de `macroEffectPct`, mesmo tratamento multiplicativo) —
  `fairPrice = vpa × (roe/requiredReturn) × (1+growthRate) × (1+macroEffectPct/100) ×
  (1+pnPremiumPct/100)`. `pnPremiumPct = 0` (ação ON, ou empresa só de uma classe) reduz
  exatamente à fórmula anterior — sem quebra de compatibilidade, mesma nota já dada a
  `macroEffectPct = 0` na E.2. Diferente de `macroEffectPct`, **não** passa pelo filtro de
  `personality.KnowledgeLevel` em `DecideFundamentalistOrder` — é um fato estrutural conhecido da
  empresa (`companies.pn_dividend_premium_pct`, J.2), mesma categoria de `growthRate`/Selic, não
  uma leitura ruidosa de evento ao vivo. `DecideFundamentalistOrder` e `bot.DecisionInput`
  (`round.go`) ganham o mesmo parâmetro/campo, repassado sem tradução.
  - `tick/tick.go`: `AssetForPricing` ganha `ShareClass *string` (mesma convenção "ON"/"PN" de
    `DividendPayerAsset.ShareClass`, J.2) — nil (ou != "PN") conta como ON. `companyRoundContexts`
    passa a copiar `CompanyForFundamentals.PnDividendPremiumPct` (já existente desde a J.2) pro
    novo campo `CompanyRoundContext.PnDividendPremiumPct` (`tick/rounds.go`), compartilhado pelas
    duas classes da mesma empresa (indexado por `company_id`, não por `asset_id`, mesma garantia
    já provada pela J.1).
  - `tick/rounds.go`: `equityRoundState` ganha `ShareClass *string` (espelha
    `AssetForPricing.ShareClass`, populado em `buildEquityUniverse`). `decisionInputFor` (case
    `ArchetypeFundamentalista`) só preenche `input.PnDividendPremiumPct` quando
    `state.ShareClass != nil && *state.ShareClass == "PN"` — fica em 0 (fórmula original) pra
    qualquer ativo ON.
  - `infra/db/tick_repository.go`: `ListPricingAssets` passa a ler `via.share_class` (mesma
    coluna que `ListDividendPayerAssets`, J.2, já lia) — sem migration nova, coluna já existia
    desde a J.1.
  - Testes novos: `bot/fundamentalist_test.go` —
    `TestFundamentalistFairPrice_PnPremiumDeslocaOPrecoJustoProporcionalmente` (table-driven,
    10/20/25% de premium, confirma `pnPrice == onPrice × (1+premium/100)` exatamente) e
    `TestFundamentalistFairPrice_PnPremiumZeroMantemFormulaOriginal` (regressão, mesmo padrão do
    par de testes já existente pra `macroEffectPct`). `tick/rounds_test.go` —
    `TestRunIntradayRounds_FundamentalistaValorizaPnAcimaDeOnProporcionalAoPremium`, prova de
    ponta a ponta dentro do domínio via `runIntradayRounds` real (Fundamentalista com
    `knowledgeLevel = 1.0`, sem ruído): dois ativos (`on1`/`pn1`) do mesmo `company_id`,
    `CompanyRoundContext.PnDividendPremiumPct = 20`, confirma os preços submetidos batendo
    exatamente com `10.3`/`12.36` (VPA=10, ROE=0.1, requiredReturn=0.10, growthRate=0.03).
  - **Validado ao vivo via `docker compose up -d --build`** (dados reais já seedados, sem `down
    -v`): inseri manualmente `VALR4` (PN, `outstanding_shares` 500.000.000) vinculado ao mesmo
    `company_id` de `VALR3` (ON) — mesma técnica de inserção manual da J.1/J.2 — `GET
    /companies/:id` real confirmou os dois ativos com `share_class` corretos e `fundamentals`
    compartilhados; consulta SQL direta reproduzindo `ListPricingAssets` confirmou `share_class`
    vindo certo via `via.share_class` pra `VALR3`("ON")/`VALR4`("PN")/`BNDD4`("PN"). `POST
    /admin/tick` avançado várias vezes sem erro (migrations/wiring OK). **Achado, não corrigido
    nesta sessão:** o mercado ao vivo desta instância de dev está com liquidez travada há vários
    dias simulados (`asset_quotes.total_quantity = 0` pra todo ativo nos últimos 5+ dias, `POST
    /admin/tick` reportando `bot_fills_count: 0` de forma consistente) — não é uma regressão desta
    tarefa: `effectiveOrderSizeCeiling` (`rounds.go`, achado 005 parte B) usa a média de volume dos
    últimos `ChartistPriceHistoryDays` dias como teto de tamanho de ordem, e quando essa média é 0
    (não "sem histórico", mas "histórico todo zerado"), o teto trava em 0 pra sempre — nenhuma
    ordem de compra consegue quantidade ≥ 1 (`quantityForSide`/`capToFloat`), então nenhuma ordem
    de compra nova entra no book, e sem contraparte de compra as vendas também nunca casam,
    perpetuando o próprio travamento. Isso impediu observar convergência de preço via fills reais
    pra `VALR4` (ficou parado no `DefaultInitialPrice` = 100 pelos ticks avançados) — a fórmula em
    si já está integralmente coberta pelos testes automatizados acima (valores exatos). Já é a
    mesma causa raiz que o comentário de `MaxOrderPctOfAverageVolumePct` (`rounds.go`) documenta
    como "deferida pra Fase K (calibração com dados reais B3/CVM), decisão confirmada com o
    autor" — não é um gap novo, só a manifestação prática desse limite já conhecido; não registrado
    em `pontos-em-aberto-decisao-produto.md` por não ser uma decisão de produto em aberto (é
    mecânico, e a causa raiz já tem dono — Fase K). `VALR4` de teste removido ao final (mesma
    transação cobrindo `order_book`, `asset_quotes`, `variable_income_assets`, `assets`), `docker
    compose down` (sem `-v`).
  - `gofmt`/`go vet`/`go build`/`go test ./...`/`golangci-lint run` (Docker, v2.12.2, 0 issues)
    verdes. Sem `.docs/engine/` (nenhuma rota HTTP nova/alterada — `ListPricingAssets` ganhou uma
    coluna a mais na mesma query, `GET /companies/:id`/`GET /assets/:id` já existiam).

### J.4 · Seed reflete a composição real do mercado ✅

- **Descrição:** ajusta `cmd/seed/main.go` pra que a maioria das empresas nasça só-ON (padrão
  Novo Mercado), com pelo menos uma ou duas empresas clássicas ON+PN (aproveitando ou substituindo
  o par `BNDD3`/`BNDD4` já planejado em `7.2`, conforme a nota 6) — pra exercitar de verdade o
  cenário da lição 2.3 do currículo e o spread de preço entre classes (proposta seção 2).
- **Critérios de aceite:** seed confirmado gerando pelo menos 1 empresa ON+PN funcional (dividendo
  com prioridade, preços independentes) e maioria só-ON entre as demais.
- **Referências:** proposta 2.8, item 5.
- **Dependências:** J.1, J.2, J.3.
- **Entregável:** `cmd/seed/main.go` ganha `BNDD3` (ON) como par real de `BNDD4` (PN, já existia),
  usando exatamente o par citado na nota 6 — como a Fase J rodou antes da `7.2` (backlog
  principal, ainda não concluída), é esta tarefa quem entrega o par corretamente; `7.2` só precisa
  reconhecer que ele já existe, sem duplicar. `Mineradora Vale do Rio S.A.` (`VALR3`) continua
  só-ON — com só 2 empresas no catálogo mínimo desta fase (3.9, não o catálogo completo da `7.2`,
  que não rodou ainda), "maioria só-ON entre as demais" já é satisfeito por construção (a única
  empresa fora do par ON+PN é só-ON). **Decisão de design desta sessão:** `BNDD3`/`BNDD4` nascem
  com a **mesma** `outstanding_shares` (300.000.000, constante única `bancoOutstandingShares`,
  substituindo a antiga `bndd4OutstandingShares`) — deliberadamente igual, não uma base diferente
  por classe. Isso isola o spread de preço entre as duas classes a uma causa só, o premium de
  dividendo da PN (`companies.pn_dividend_premium_pct`, J.2/J.3, default 10%), em vez de misturar
  esse efeito com uma diluição de VPA por base de ações diferente — sinal mais limpo pra lição 2.3
  (`J.5`) explicar a causa raiz certa. Valor idêntico ao antigo `bndd4OutstandingShares`
  (só-PN, pré-J.4) de propósito: um banco de dev que já tinha `BNDD4` sozinho (sem `BNDD3`) não
  tem seus fundamentos recalibrados por esta tarefa — `seedInitialFundamentals` já é idempotente
  (pula se a empresa já tem fundamentos), então o `net_revenue`/histórico de `BNDD4` pré-existente
  continua intocado, só `BNDD3` nasce novo compartilhando o mesmo `company_fundamentals`. Mesmo
  `risk_class` (`Sofisticado`) nas duas classes — convenção que a própria J.1 já apontava como "a
  decisão certa, óbvia o suficiente pra não precisar confirmação do autor"
  (`companyEquityRiskClasses` usa o risk_class "do primeiro encontrado" pra toda ação da mesma
  empresa; divergir aqui produziria inconsistência sem motivo de produto). `seedBotLiquidity`
  ganha `BNDD3` na lista de `botAssetSeed` (mesmo pool de 20 bots compartilhado desde B.2/C.6, sem
  pool novo) — `bot.InitialAllocation` distribui o float de `BNDD3` entre os bots exatamente como
  já fazia pra qualquer outro ativo de Ação. Sem migration nova (schema já suportava desde J.1/J.2)
  e sem teste Go novo — `cmd/seed/main.go` é script, não domínio/fórmula (mesmo precedente de
  B.2/C.6, sessões de seed sem tarefa de teste table-driven própria); a lógica de domínio que o
  seed agora exercita pra valer (prioridade de dividendo, preço justo por classe) já está coberta
  por testes exatos desde J.2/J.3.
  - `gofmt`/`go vet`/`go build`/`go test ./...`/`golangci-lint run` (Docker, v2.12.2, 0 issues)
    verdes. Sem `.docs/engine/` (nenhuma rota HTTP nova/alterada — só dado de seed).
  - **Validado ao vivo via `docker compose up -d --build`** (volume de dev existente, sem
    `down -v` — já tinha só `BNDD4` sozinho de sessões anteriores à Fase J): `go run ./cmd/seed`
    real (via `DATABASE_URL` apontando pra `localhost:5432`, porta já exposta no
    `docker-compose.yml`) criou `BNDD3` novo e confirmou, via `psql` direto, os dois ativos
    compartilhando `company_id`/`pn_dividend_premium_pct = 10.00` e `outstanding_shares =
    300.000.000` cada; `SUM(positions.quantity)` bateu exatamente 300.000.000 nos dois (float
    100% distribuído entre os 20 bots, sem violar `position.ValidateFloatCeiling`). `GET
    /companies/:id` real confirmou os dois ativos (`share_class` ON/PN) com a mesma lista de
    `fundamentals`. 22 `POST /admin/tick` consecutivos: preços de `BNDD3`/`BNDD4` divergiram pra
    valores bem diferentes (89-100 vs ~27) — divergência maior do que só o premium explicaria,
    causada pelo histórico de negociação de semanas de `BNDD4` (pré-existente à sessão) vs.
    `BNDD3` nascendo do zero em `tick.DefaultInitialPrice` sem esse histórico; **não é regressão
    desta tarefa**, é o retrato exato do critério "preços independentes" (dois books realmente
    desacoplados, cada um com sua própria trajetória) — o mecanismo do premium em si (não a
    trajetória de preço acumulada) já está coberto por valor exato nos testes automatizados de
    J.2/J.3. O dia de relatório seguinte (`is_report_day: true`) confirmou a prioridade de
    dividendo funcionando pro par novo: `BNDD3 (ON) = 4.99` / `BNDD4 (PN) = 5.48`, razão ≈ 1.10,
    batendo exatamente o premium de 10% da empresa. `docker compose down` (sem `-v`) ao final —
    dia simulado do volume de dev avançou de ~306 pra 342 (efeito colateral aceito de avançar o
    Temporizador manualmente pra alcançar o próximo ciclo de relatório, mesmo padrão de toda
    validação anterior deste backlog).

### J.5 · Revisão da lição 2.3 (Nomenclatura de tickers) pro par ON/PN real + esclarecimento sobre units ✅

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
- **Entregável:** `backend/src/db/seedLessons.ts`, lição `2.3` — `scenarioText`/`microDecisionPrompt`/
  `microDecisionOptions`/`revelationText` reescritos usando `BNDD3`/`BNDD4` (par real ON/PN da
  mesma empresa, Banco Nordeste Digital, gerado pela `J.4`) em vez do contraste `VALR3`/`BNDD4`
  entre empresas diferentes. `revelationText` ganhou o parágrafo de units: final 11 não é exclusivo
  de FII/ETF, no mercado real também identifica units (ON+PN empacotadas, ex: `SANB11`), o que
  diferencia os três é o tipo de instrumento, não o número; deixa explícito que esta plataforma não
  tem unit negociável no catálogo. `unlocksKeys`/`unlocksAssetTicker` (`VALR3`) e `unlocksDescription`
  não mudaram, por critério de aceite — a lição ensina o conceito ON/PN com o par real, mas o
  primeiro ativo liberado pra compra continua sendo `VALR3` (ON única, sem escolha de classe,
  mais simples pra uma primeira operação, já apresentada desde a `2.1`). Comentário de auditoria do
  índice de opção correta (linha ~71) atualizado de `VALR3 e BNDD4` pra `BNDD3 e BNDD4` pra não
  ficar desatualizado. Sem migration, sem teste Go/TS novo (autoria de conteúdo só, mesmo
  precedente das sub-tarefas `7.1.x` do backlog principal e da `J.4`/`B.2`/`C.6` deste backlog) —
  `npm run build`/`npm run lint`/`npm test` (565 testes) verdes, sem regressão. Validado via seed
  real: `DATABASE_URL=... npm run db:seed:lessons` contra o Postgres do `docker compose` (container
  `tcc-postgres` já em execução, reaproveitado — outra sessão em paralelo, mesmo padrão da `J.3`),
  `SELECT` na tabela `lessons` confirmou o texto novo persistido e `unlocks_asset_ticker` continua
  `VALR3` (`onConflictDoUpdate`, seed idempotente). **Fase J fechada por completo** (`J.1`-`J.5`);
  `J.6` abaixo foi acrescentada depois, a partir de um achado do teste de ponta a ponta desta fase.

### J.6 · Corrige o travamento de liquidez quando o volume médio real zera (achado 005, Parte C) ✅

- **Descrição:** `tick.effectiveOrderSizeCeiling` (`rounds.go`, achado 005 Parte B) usa o menor
  entre o float e `MaxOrderPctOfAverageVolumePct` da média de volume real dos últimos
  `ChartistPriceHistoryDays` dias (`TickRepository.RecentTradedVolume`). Quando essa média
  **cai a zero de verdade** (dias reais sem nenhum fill — diferente de "sem dado ainda", já
  tratado pela própria Parte B via `total_quantity` nullable), o teto trava em 0 pra sempre:
  nenhuma ordem de compra nova consegue tamanho ≥ 1 (`quantityForSide`/`capToFloat`), e sem
  contraparte de compra as vendas também param de casar — autoperpetuando o zero indefinidamente,
  sem nenhum caminho de recuperação sozinho. Achado do teste de ponta a ponta desta Fase J
  (2026-09-19/20, antes e depois do merge com a Fase K): partindo de um seed novo (sem nenhum
  histórico prévio), `BNDD4`/`PAPL11` travaram assim dentro de ~50 dias simulados e nunca se
  recuperaram nos ticks seguintes observados — não é um cenário raro/extremo, aconteceu em 2 de 5
  ativos negociáveis do catálogo mínimo em ambos os testes. Impacto real: uma vez travado, um
  usuário fica sem contraparte pra **vender** aquele ativo (o lado comprador nunca mais se
  regenera) — o core loop de compra/venda para de funcionar pra aquele ativo especificamente, não
  é só um problema estético de preço congelado. Correção puramente mecânica (piso mínimo no teto,
  nunca removendo o teto em si) — deliberadamente **não** inclui a recalibração de
  `bot.InitialCash`/`InitialAllocation` (capital/alocação inicial do bot com pesquisa B3/CVM
  dedicada), que fica registrada à parte como melhoria de realismo futura, sem tarefa de backlog
  aberta (achado 009, `.claude/pontos-em-aberto-decisao-produto.md`) — mais capital reduziria a
  chance estatística do travamento, mas não o eliminaria sozinho, e não é o que resolve o bug
  observado.
- **Critérios de aceite:** teste table-driven confirmando que `effectiveOrderSizeCeiling` nunca
  devolve um teto que zere a quantidade comprável quando o float disponível é positivo, mesmo com
  a média de volume real em zero (piso mínimo — não removendo o teto, só impedindo o colapso
  total); teste de regressão confirmando que o comportamento das Partes A/B continua idêntico
  quando a média de volume é positiva (teto = menor entre float e volume) e que "sem dado ainda"
  (`total_quantity` nulo) continua caindo pro float sozinho, não pro piso novo; teste de ponta a
  ponta (mesmo padrão de `TestRunIntradayRounds_*`) reproduzindo o cenário observado — vários dias
  seguidos de volume real zero — e confirmando que uma ordem de compra volta a ser possível depois
  da correção.
- **Referências:** achado 005 (Parte C), `.claude/pontos-em-aberto-decisao-produto.md`;
  `engine/internal/domain/tick/rounds.go` (`effectiveOrderSizeCeiling`,
  `MaxOrderPctOfAverageVolumePct`); `engine/internal/infra/db/tick_repository.go`
  (`RecentTradedVolume`).
- **Dependências:** nenhuma — correção isolada em `rounds.go`/`tick_repository.go`, não depende
  de nenhuma tarefa J.1-J.5 nem da Fase K (calibração de fundamentos é área diferente do motor).
- **Entregável:** `tick.MinOrderSizeCeiling = 1` (`rounds.go`) — piso mínimo aplicado depois de
  computar `volumeCeiling` em `effectiveOrderSizeCeiling`: quando o histórico real de volume existe
  mas a média é 0, `volumeCeiling` é elevado pro piso antes da comparação com `floatCeiling`, em vez
  de propagar 0. Nenhuma mudança em `tick_repository.go`/`RecentTradedVolume` — a distinção "sem
  dado ainda" vs "histórico real zerado" já estava correta desde a Parte B (`total_quantity`
  nullable), a correção é só no piso do lado do domínio. Comportamento preservado por construção
  pros dois lados do critério de aceite: `floatCeiling == nil` continua caindo pro teto de volume
  sozinho (agora com piso), `recentVolume` vazio continua caindo pro float sozinho (piso nunca entra
  em jogo), e `floatCeiling` já zerado continua devolvendo 0 mesmo com o piso ativo (o piso nunca
  infla o teto além do que o float realmente permite — caso novo coberto no teste table-driven).
  - `rounds.go`: `effectiveOrderSizeCeiling` ganha `if volumeCeiling < MinOrderSizeCeiling { volumeCeiling = MinOrderSizeCeiling }`
    logo após o cálculo de `volumeCeiling`, antes da comparação com `floatCeiling` — sem alterar a
    assinatura da função nem nenhum outro call site (`decisionInputFor`, wiring já existente desde a
    Parte B).
  - `rounds_test.go`: `TestEffectiveOrderSizeCeiling` — o caso "histórico existente mas todo zerado"
    (antes documentado como "comportamento emergente aceito") passa a esperar
    `ptr(MinOrderSizeCeiling)` em vez de `ptr(0)`, mais um caso novo confirmando que `floatCeiling`
    zerado continua devolvendo 0 mesmo com o piso ativo. `TestRunIntradayRounds_
    VolumeRealZeradoPorVariosDiasNaoTravaOrdemDeCompra` (novo, mesmo padrão de
    `TestRunIntradayRounds_TetoDeVolumeLimitaOrdemQuandoMenorQueOFloat`) prova de ponta a ponta via
    `runIntradayRounds` real: bot Ruído sem posição, `RecentTradedVolume` devolvendo `{0,0,0,0,0}`
    (5 dias reais zerados) — antes da correção o teste falharia com `fills == 0`
    (`DecideNoiseOrder` nunca gera ordem de compra viável com `orderSizeCeiling == 0` e sem posição
    pra vender); depois da correção, `fills > 0` e toda ordem de compra submetida tem
    `Quantity == MinOrderSizeCeiling` (exatamente 1, o teto no piso).
  - `gofmt`/`go vet`/`go build`/`go test ./...`/`golangci-lint run` (Docker, v2.12.2, 0 issues)
    verdes. Sem `.docs/engine/` (nenhuma rota HTTP nova/alterada — correção isolada em domínio).
  - **Validado ao vivo via `docker compose up -d --build`** (volume de dev existente, sem `down
    -v` — o mesmo travamento observado no teste de ponta a ponta da J.3, `BNDD4`/`PAPL11` com
    `total_quantity = 0` por 20+ dias simulados seguidos e preço congelado em 27.17/89.76): antes de
    aplicar o build novo, confirmado via `psql` direto que os dois ativos estavam de fato travados
    (dias 330-351, `total_quantity = 0` ininterrupto). `POST /admin/tick` real (rede interna do
    Compose, `curlimages/curl`) avançado 26 vezes seguidas após o build com a correção — `BNDD4`
    voltou a negociar já no primeiro tick seguinte (`total_quantity` 5/2/4/4/7/6/6/2/6/3 nos dias
    352-361, preço saindo de 27.17 fixo pra variar entre 25.13-29.26) e `PAPL11` também recuperou
    (`total_quantity` 2/0/0/0/4/2/1/2/2/1, preço variando 84.20-90.33) — confirma o critério de
    aceite "uma ordem de compra volta a ser possível depois da correção" com o cenário real que
    motivou a tarefa, não só o teste sintético. `SINT11` (ETF, mecanismo de NAV/AP da Fase H, fora do
    escopo desta tarefa — nunca passou por `effectiveOrderSizeCeiling`) permaneceu com
    `total_quantity = 0` nos mesmos ticks, confirmado via `psql` que isso é o padrão em toda a
    história do ativo (376 dias, nunca teve `total_quantity > 0`), não uma regressão desta correção.
    `docker compose down` (sem `-v`) ao final — dia simulado do volume de dev avançou de 350 pra 376
    (mesmo efeito colateral aceito de toda validação ao vivo anterior deste backlog via `POST
    /admin/tick`).

---

## Fase K — Calibração de fundamentos por setor (independente)

### K.1 · Pesquisa de dados reais por setor ✅

- **Descrição:** levantamento de margens/alavancagem médias reais e públicas (B3/CVM/relatórios
  setoriais) pros 6 setores fixos da spec 3.3.2 (Mineração, Agronegócio, Bancário/Financeiro,
  Varejo, Energia, Tecnologia), pra substituir os coeficientes hoje "ilustrativos" de
  `fundamentals.go` (margem líquida 10%, margem EBIT 18%, patrimônio = 1.2×receita, dívida =
  0.4×patrimônio, caixa = 15%×receita, sensibilidade à Selic 0.02/0.06 por `risk_class`).
- **Critérios de aceite:** tabela de coeficientes propostos por setor, com fonte citada pra cada
  número, entregue como documento/anexo (não precisa de código nesta tarefa — é pesquisa).
- **Referências:** proposta seção 7.
- **Dependências:** nenhuma.
- **Entregável:** `.claude/calibracao-fundamentos-setor.md` — tabela dos 6 coeficientes de
  `fundamentals.go` por setor (margem líquida, margem EBIT, patrimônio/receita, dívida/patrimônio,
  caixa/receita, sensibilidade à Selic), cada um com **valor central + faixa plausível de variação
  entre empresas do mesmo setor** (pedido explícito do autor nesta sessão — média é base, não
  valor único aplicado a toda empresa do setor) e fonte real citada por setor (Vale/PwC pra
  Mineração, SLC Agrícola pra Agronegócio, Banco Central/Índice de Basileia pra Bancário, Lojas
  Renner + Magazine Luiza pra Varejo — as duas pontas da mesma faixa —, Equatorial/Energisa pra
  Energia, TOTVS pra Tecnologia). Inclui ressalva de que o proxy de "dívida/patrimônio" pra
  Bancário é simplificado (banco não tem dívida bruta convencional, captação é o próprio negócio)
  e uma seção de recomendações não-vinculantes pra `K.2` (sensibilidade migra de `risk_class` pra
  `Sector`, threading do setor até `DeriveFinancials`/`BootstrapFinancialsForTargetPrice`,
  mecanismo de sorteio determinístico por empresa pra aplicar a faixa sem re-sortear a cada ciclo,
  Bancário como setor de maior risco de preço-justo implausível a validar primeiro). Nenhum código
  tocado nesta sessão (fora de escopo de K.1).

### K.2 · Aplicação da calibração em `fundamentals.go` ✅

- **Descrição:** os coeficientes agora variam por setor (K.1) em vez de um único conjunto genérico
  pra toda empresa — `fundamentals.go` passa a receber o setor da empresa como insumo pra escolher
  os coeficientes certos.
- **Critérios de aceite:** teste table-driven cobrindo pelo menos 2 setores diferentes com
  coeficientes visivelmente distintos; teste de regressão confirmando que o restante da fórmula
  (crescimento base + ruído + fator Selic) continua funcionando igual, só os coeficientes mudam.
- **Referências:** proposta seção 7.
- **Dependências:** K.1.
- **Entregável:** `fundamentals.SectorCoefficients` (5 coeficientes de `DeriveFinancials` +
  `SelicSensitivity`) e `fundamentals.CoefficientsBySector map[catalog.Sector]SectorCoefficients`,
  populado com os valores centrais da pesquisa da K.1 (`.claude/calibracao-fundamentos-setor.md`)
  pros 6 setores fixos da spec 3.3.2 — `fundamentals.CoefficientsForSector(sector)` resolve o
  conjunto certo, com fallback pros 5 antigos `Default*` (mantidos só como fallback, não mais
  aplicados a toda empresa) quando `sector` não é um dos 6 fixos (não deveria acontecer com o
  catálogo validado). `DeriveFinancials(sector, netRevenue)` e
  `BootstrapFinancialsForTargetPrice(sector, targetPrice, outstandingShares, growthRate,
  selicNeutral)` ganharam `sector` como primeiro parâmetro; `ExpectedGrowth`/`GrowthSeries`/
  `NextGrowth` não mudaram de assinatura — só a fonte do `Config.Sensitivity` que os alimenta
  (`tick.fundamentalsConfig`) migrou de `fundamentals.SensitivityByRiskClass[equityRiskClass]` pra
  `fundamentals.CoefficientsForSector(sector).SelicSensitivity`, usando `CompanyForFundamentals.
  Sector` (já existente, cru, convertido só na borda de chamada — `catalog.Sector(c.Sector)`, mesmo
  padrão de conversão cru→domínio já usado por `riskClassForPricing`). `companyRoundContexts`
  perdeu o parâmetro `equityRiskClasses` (não usado mais depois da migração). `cmd/seed/main.go`
  (`seedInitialFundamentals`) passou a receber e repassar o `catalog.Sector` de cada empresa
  seedada (Mineração pra VALR3, Bancário pra BNDD4). **Escopo deliberadamente não coberto** (achado
  008, `pontos-em-aberto-decisao-produto.md`): `bot.FundamentalistFairPrice`/
  `DecideFundamentalistOrder` (retorno exigido na fórmula de Justified Price-to-Book) continuam
  lendo `fundamentals.SensitivityByRiskClass` por `risk_class`, não por setor — migrar isso também
  rippla pela Fase C/D/E já fechadas (assinatura de 11 parâmetros, `bot.DecisionInput.RiskClass`,
  call sites e testes de C.5/D.2/E.2), fora do escopo de uma sessão cujo texto era "aplicação da
  calibração em `fundamentals.go`"; registrado como decisão de design pendente, não gap mecânico.
  `SensitivityByRiskClass` (2 valores) continua existindo só pra esse consumo.
  Testes novos/atualizados em `fundamentals_test.go`
  (`TestDeriveFinancials_CoeficientesVariamPorSetor` — os 6 setores, valores exatos, nenhum
  colidindo com outro; `TestDeriveFinancials_SetorDesconhecidoUsaFallbackGenerico` — regressão do
  fallback; `TestBootstrapFinancialsForTargetPrice_RoundTripReproduzPrecoAlvo` — round-trip exato
  agora variando o setor entre os casos, incluindo um setor desconhecido) e em `tick/*_test.go`
  (`TestAdvance_DiaDeRelatorioGeraOsSeisCamposDeFundamentals`, `findReportGrowthSeed` e os 3 testes
  de ponta a ponta da F.1 que dependem dele, adaptados de `riskClass` pra `sector`). A antiga âncora
  numérica `TestBootstrapFinancialsForTargetPrice_ReproduzConstanteHistorica` (~97.0, calibrada só
  contra o coeficiente genérico) foi recalculada pra Mineração (~64.72,
  `TestBootstrapFinancialsForTargetPrice_RevenuePorAcaoReflecteCoeficientesDoSetor`) — mudança de
  número esperada e documentada, não regressão. `gofmt`/`go vet`/`go build`/`go test ./...`/
  `golangci-lint run` (Docker, v2.12.2, 0 issues) verdes. `.docs/engine/tick.md` atualizado.
  **Validado ponta a ponta via `docker compose up -d --build`** (volume novo, isolado deste
  worktree — stack compartilhado já em uso por outra sessão foi derrubado e resubido com
  autorização do autor): seed real gravou `company_fundamentals` de VALR3/BNDD4 já com as razões
  exatas do setor (Mineração: margem 0.15/patrimônio 1.3×/dívida 0.45×; Bancário: margem
  0.22/patrimônio 2.2×/dívida 1.5×, confirmado via `psql` direto); 14 `POST /admin/tick`
  consecutivos (dia 1→14, até bater o ciclo de relatório) sem erro, `fundamentals_count: 2` no dia
  14, razões calibradas preservadas na nova linha de `company_fundamentals` de cada empresa após o
  ciclo; `SUM(positions.quantity) = outstanding_shares` intacto nos 4 ativos, nenhuma conta com
  saldo negativo. Stack parada com `docker compose down` (sem `-v`) ao final.

---

## Fase L — Renda Fixa: correções cirúrgicas (independente)

Nenhuma destas depende do redesenho de bots/order book — são correções de fórmula já existente e
não usada (relatório `tmp/relatorio-logica-mercado.md`, seções 8.3-8.6).

### L.1 · Rendimento pós-fixado real (Tesouro Selic/CDB %CDI) ✅

- **Descrição:** implementa uma fórmula de rendimento pós-fixado de verdade — hoje usa
  `PrefixedPrice` com taxa estática do catálogo, nunca acompanhando a Selic simulada dia a dia.
  Ganha ainda mais relevância depois da Fase I (Selic reagindo ao IPCA).
- **Critérios de aceite:** teste table-driven confirmando que o rendimento acumulado de um título
  pós-fixado acompanha a série de Selic simulada dia a dia (não uma taxa fixa travada na compra).
- **Referências:** proposta seção 9, item 1; relatório seção 8.3.
- **Dependências:** nenhuma.
- **Entregável:** classificação nova `fixedincome.IndexType`/`IndexOf`/`IsPostFixado` (`product.go`)
  marca os 6 tipos pós-fixados (Tesouro Selic, CDB, LCI, LCA, CRI, CRA — mesma lista que a L.3 já
  cita como "isentos de risco de mercado") vs. `IndexPrefixado` (só Tesouro Prefixado) vs.
  `IndexIPCAMais` (Tesouro IPCA+, fora do escopo, L.2). Fórmula pura nova `fixedincome.
  PostFixedFactor`/`PostFixedValue` (`postfixado.go`) compõe um fator diário por dia útil a partir
  de uma série de Selic simulada (mesmo padrão `[]float64` de `equity.Config.SelicAnnualRates`) —
  tabela-driven prova (desigualdade de Jensen) que uma série que varia rende diferente de aplicar a
  média constante, não só "trava a taxa da compra". `fixedincomeexecution.Purchase`/`Redeem`
  ganharam `ProductType` no contexto: produto pós-fixado compra "ao par" (`unitPrice = FaceValue`,
  sem deságio) e resgata via `PostFixedValue` (principal × fator, usando a Selic corrente do
  resgate — não mais marcado a mercado, `VsContractedRate` sempre 0); qualquer outro tipo continua
  no caminho anterior (`PrefixedPrice`/`EarlyRedemption`), comportamento inalterado. Decisão de
  escopo tomada na sessão (documentada no cabeçalho de `fixedincomeexecution.go`, notas 1/3/3.1/3.2,
  e em `.docs/engine/fixedincome.md`): como `market_calendar` só guarda a Selic corrente (histórico
  diário é a M.1, independente desta), a série usada em `Redeem` repete o valor corrente por todo o
  período decorrido — mesma simplificação de `fii.PortfolioValueVariation`/indexador CDI; o
  mecanismo aceita qualquer série, então a troca por histórico real (pós-M.1) não muda a fórmula.
  `GET /fixed-income/simulate` deliberadamente **não** foi corrigido nesta sessão (gap conhecido,
  documentado — exigiria um colaborador novo na camada HTTP pra ler `market_calendar.selic_rate`,
  fora do escopo cirúrgico). `fixed_income_assets.interest_rate` mudou de significado pros 6 tipos
  pós-fixados — "% do CDI/Selic" (ex: `110` = "110% do CDI", convenção da lição 3.3) em vez de "%
  a.a." — catálogo reseedado (`cmd/seed/main.go`: LFT2029 100, CDB2027 110, LCI/LCA2026 90,
  CRI2028 115, CRA2028 112) e label do frontend (`FixedIncomeDetail`, tela 4.3) ajustado pra mostrar
  "do CDI" nesses 6 tipos e "a.a." só pra Tesouro Prefixado/IPCA+ (`fixedIncomeRateLabel`,
  `features/market/format`). Validado ponta a ponta via `docker compose up`: CDB a 110% CDI/Selic
  10% rendeu exatamente 11% em 1 ano simulado (dia de compra retroativo via `UPDATE
  fixed_income_positions.created_at`); Tesouro Selic a 100% CDI rendeu exatamente os 10% da Selic;
  subir a Selic pra 20% antes do resgate (mesma posição) fez o retorno pular pra 22% — prova de que
  reage à Selic **corrente** no resgate, não à taxa da compra. `go test ./...`, `golangci-lint run`
  (via Docker, 0 issues) e os 666 testes do frontend (`npx vitest run`) verdes.

### L.2 · VNA real pro Tesouro IPCA+ ✅

- **Descrição:** liga `fixedincome.VNAProjected`/`IPCAPrice` (já implementado e testado, sem
  consumidor) na compra/resgate real de Tesouro IPCA+, em vez de continuar usando deságio nominal.
  Exige um `ipca.Config` calibrado (hoje não existe, `ipca.go` documenta isso explicitamente) e
  uma série mensal de IPCA persistida.
- **Critérios de aceite:** teste ponta a ponta confirmando que compra/resgate de Tesouro IPCA+
  usa VNA de verdade, não mais deságio nominal; teste de regressão nos outros 7 produtos
  confirmando que eles continuam usando deságio nominal sem mudança.
- **Referências:** proposta seção 9, item 2; relatório seção 8.4.
- **Dependências:** nenhuma.
- **Entregável:** `ipca.DefaultConfig(seed)` (novo, `ipca.go`) calibra a meta contínua real do CMN
  (3% a.a. → `DefaultMonthlyTarget = 0.0025` via composição, não divisão simples por 12) com banda/
  volatilidade aproximando a tolerância oficial — mesmo tratamento de "default calibrado, ajustável
  na semana 8" já dado a `selic.DefaultConfig`. Decisão de escopo desta sessão que diverge do texto
  original da tarefa ("uma série mensal de IPCA persistida"): em vez de gravar um estado mutável
  (linha singleton tipo `market_calendar`, avançada por `tick.Advance`), `fixedincome.
  CurrentVNAWindow` (novo, `ipcaplus.go`) deriva `(vnaBase, monthlyIPCA)` **sem nenhuma persistência**
  — encadeia `ipca.MonthlySeries` desde `fixedincome.VNAEpoch` (data-base fixa, 15/07/2000, mesma
  convenção do Tesouro Direto real) até a janela de `now` via `VNAMonthlySeries`, puramente como
  função de `(cfg, now)`. Mesma cfg/seed sempre reproduz o mesmo VNA numa data (RNF08), então nenhum
  consumidor precisa de histórico gravado dia a dia — isso ficou para a tarefa M.1 (independente,
  cobre EXIBIR a série ao usuário/painel admin, não CALCULAR o VNA) evitar duplicar. `fixedincome.
  IsIPCAMais` (novo, `product.go`, mesmo padrão de `IsPostFixado` da L.1) decide o branch em
  `fixedincomeexecution.Purchase`/`Redeem`: Purchase precifica `unitPrice = IPCAPrice(VNAProjected(
  vnaBase, monthlyIPCA, now), IPCAQuote(taxaReal, DU))` no lugar de `PrefixedPrice`; Redeem usa
  `fixedincome.IPCAEarlyRedemption` (novo, `ipcaplus.go` — mesma decomposição de `EarlyRedemption`,
  só que sobre o VNA em vez do Valor Nominal fixo) no lugar de `EarlyRedemption`. Taxa real
  contratada (`Position.AverageRate`) continua travada na compra (nota 2 do doc do pacote
  `fixedincomeexecution`, atualizada) — só o VNA multiplicador varia; taxa de mercado pro resgate
  continua reaproveitando `ctx.CurrentMarketRatePct` (Selic nominal) como proxy de taxa REAL de
  mercado, sem correção de Fisher — mesma simplificação documentada (nota 3), decisão de escopo não
  confirmada com o usuário, a L.3 decide se essa marcação a mercado deveria valer pra IPCA+. `ipca.
  Config` é injetado em `fixedincomeexecution.Service` (não em `Purchase`/`Redeem`, que ganharam só
  `vnaBase`/`monthlyIPCA float64` resolvidos — mantém as duas funções puras/testáveis sem RNG),
  composto em `cmd/api/main.go` com `ipcaSeed := seed + 1` — nunca a mesma raw seed de
  `selicConfig`, pra não correlacionar o ruído dos dois processos estocásticos independentes.
  Testes novos: `TestMonthsBetween`, `TestCurrentVNAWindow_*` (5 casos, incl. consistência com
  `VNAMonthlySeries` computado manualmente e reprodutibilidade) e `TestIPCAEarlyRedemption_*` (3
  casos) em `fixedincome`; `TestPurchase_IPCAMais_UsaVNAEmVezDeDesagioNominal` e `TestRedeem_
  IPCAMais_VNACrescePorInflacaoAumentaOResgate` em `fixedincomeexecution` (ponta a ponta, critério
  de aceite principal) — os 16 testes pré-existentes de `Purchase`/`Redeem` (Prefixado/pós-fixado)
  seguem passando inalterados com os dois parâmetros novos ignorados (`fixedincome.IsIPCAMais` dá
  `false`), cobrindo a regressão dos outros 7 produtos. `go build`/`go test ./...`/`golangci-lint
  run` (Docker, 0 issues) verdes. Validado ao vivo via `docker compose up`: compra de NTNB2035
  (Tesouro IPCA+, taxa real 6%) devolveu `unit_price = 1953.13` (bem acima do deságio nominal
  puro, ~943 — prova de que o VNA composto por ~26 anos de IPCA simulado desde `VNAEpoch` está em
  jogo); com a Selic simulada temporariamente igualada à taxa contratada (6%, via `UPDATE
  market_calendar`), resgate no mesmo dia devolveu `total_value ≈ 2000` (o valor aportado) e
  `vs_contracted_rate = 0`, confirmando a mecânica; Tesouro Prefixado e CDB (pós-fixado) comprados/
  resgatados na sequência devolveram exatamente os preços/mecânica de antes (regressão), sem
  nenhuma mudança de comportamento.

### ✅ L.3 · Marcação a mercado restrita a produtos prefixados

- **Descrição:** hoje a marcação a mercado via Selic se aplica uniformemente aos 8 tipos de
  produto. Restringe a produtos prefixados de verdade (spec 3.2.1), removendo o efeito de
  produtos pós-fixados/isentos de risco de mercado (Tesouro Selic, CDB %CDI, LCI/LCA, CRI/CRA).
- **Critérios de aceite:** teste confirmando que resgate antecipado de um produto pós-fixado não
  sofre marcação a mercado (ganho/perda sempre proporcional ao rendimento acumulado real, L.1),
  enquanto produto prefixado continua sofrendo normalmente.
- **Referências:** proposta seção 9, item 3; relatório seção 8.5.
- **Dependências:** L.1 (produto pós-fixado precisa já ter rendimento real pra fazer sentido não
  sofrer marcação a mercado via Selic).
- **Entregável:** a exclusão dos 6 pós-fixados já tinha sido resolvida na prática pela L.1
  (`IsPostFixado` não passa mais por `EarlyRedemption`) — o que faltava era a pergunta que a
  própria L.2 tinha deixado em aberto (`fixedincomeexecution.go:43-57`, nota 3): a spec 3.2.1 fala
  só em "títulos prefixados", então Tesouro IPCA+ deveria continuar sofrendo marcação a mercado
  ou virar um sétimo/oitavo tipo isento junto dos pós-fixados? **Perguntado ao usuário nesta
  sessão** (não estava em nenhum dos documentos de referência) — decisão: IPCA+ **continua**
  sofrendo marcação a mercado junto com o Prefixado, porque a taxa real contratada na compra
  funciona como uma prefixada sobre o VNA (`fixedincome.IPCAEarlyRedemption`, já implementada na
  L.2), diferente dos 6 pós-fixados cujo rendimento já É o índice de mercado. Como a mecânica de
  código já estava correta desde a L.1/L.2 (nenhuma mudança de fórmula necessária), o trabalho
  desta sessão foi: (1) fechar o gap de teste ponta a ponta que faltava — o único teste de resgate
  de IPCA+ existente (`TestRedeem_IPCAMais_VNACrescePorInflacaoAumentaOResgate`) isolava
  deliberadamente `VsContractedRate ≈ 0`, então não provava a marcação a mercado de verdade;
  `TestRedeem_IPCAMais_MarcacaoAMercado_TaxaRealSubiu_RentabilidadeInferiorAContratada` (novo,
  `fixedincomeexecution_test.go`) reproduz o mesmo cenário do teste ponta a ponta do Prefixado
  (`TestRedeem_MarcacaoAMercado_TaxaSubiu_RentabilidadeInferiorAContratada`) — VNA parado na mesma
  janela da compra, taxa real de mercado subindo de 6% pra 9%, confirma `VsContractedRate < 0`; e
  (2) formalizar a decisão nos três lugares que sinalizavam "não confirmada com o usuário":
  `fixedincomeexecution.go:43-62` (nota 3 do doc do pacote), `fixedincome/product.go`
  (`IndexType`/`IndexIPCAMais`) e `.docs/engine/fixedincome.md` (`POST /fixed-income/redemptions`
  e a nota 3 de "Escopo não coberto"). A simplificação separada de reaproveitar a Selic NOMINAL
  como proxy de taxa REAL de mercado (sem correção de Fisher) continua sem confirmação — não é o
  que a L.3 pediu pra decidir, fica pra L.4 revisitar. `go build`/`go test ./...`/`golangci-lint
  run` (Docker, `v2.12.2`, 0 issues) verdes. **`docker compose up` não repetido nesta sessão:**
  outro worktree (`fase-m-indicadores-macro-selic-ipca`) já tinha a stack de pé nos mesmos
  nomes/portas fixos de container (`tcc-engine`/`tcc-postgres`/etc.) no momento desta sessão —
  subir/derrubar por cima arriscaria interromper esse outro trabalho em andamento. Como a mudança
  desta tarefa é só teste + comentário/doc (nenhum caminho de execução HTTP/infra mudou — a lógica
  de precificação já estava correta desde a L.1/L.2), `go test ./...` já cobre o critério de
  aceite ponta a ponta no nível de domínio; fica pra uma sessão futura confirmar via HTTP se
  necessário.

### ✅ L.4 · Revisitar as 5 decisões de escopo do `fixedincomeexecution`

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
- **Entregável:** as 5 decisões confirmadas com o autor via `AskUserQuestion` — **Fase L inteira
  fechada** depois desta tarefa. Ver Entregável completo em `.docs/engine/fixedincome.md` ("Decisões
  de escopo") e no cabeçalho de `fixedincomeexecution.go`. Resumo:
  - **Decisão 1 (taxa contratada estática) virou trabalho real, não só confirmação** — o autor
    pediu pra reprecificar a taxa OFERTADA (não a já contratada de uma posição existente, essa
    continua travada pra sempre) pela Selic simulada corrente, pra Prefixado/IPCA+ (pós-fixado
    já tinha isso resolvido pela L.1, de um jeito diferente). `fixedincome.OfferedRate(spread,
    benchmark)` (novo, `offeredrate.go`) soma um spread contratual (reinterpretação de
    `fixed_income_assets.interest_rate` — mesmo padrão de L.1) a um benchmark corrente: Selic
    nominal pro Prefixado, taxa real via Fisher pro IPCA+. Escopo confirmado com o autor em 2 rodadas
    de pergunta: alcance completo (compra + `GET /assets/:id` + `GET /fixed-income/simulate` — os
    3 consumidores de `interest_rate`), não só a compra sozinha (deixaria a listagem mostrando um
    spread pequeno, sem sentido, diferente do que a compra cobraria).
  - **Decisão 2 (VNA do IPCA+):** já resolvida pela L.2, sem mudança nesta tarefa.
  - **Decisão 3 (taxa de mercado = Selic uniforme), sub-decisão de Fisher:** o autor confirmou puxar
    a Fase M (já mesclada na `main`, trazida pra este worktree via `git merge origin/main` — só 1
    conflito real, duas calibrações divergentes de `ipca.DefaultConfig` que colidiram ao trazer M.1
    por cima de L.1/L.2, unificadas numa só) e aplicar a correção de Fisher de verdade.
    `fixedincome.FisherRealRate(nominal, inflação)` (novo, `offeredrate.go`) substitui a
    simplificação (Selic nominal reaproveitada direto como taxa real) tanto na reprecificação da
    compra quanto na marcação a mercado do resgate — `IPCAAccumulated12m` vem da linha mais recente
    de `market_indicator_history` (M.1), nunca uma aproximação paralela por relógio de parede (é o
    mesmo número que `GET /market/indicators/history` mostra).
  - **Decisão 4 (DU por relógio real):** confirmado manter como está.
  - **Decisão 5 (resgate sempre integral):** confirmado manter como está.
  - `PurchaseContext`/`RedeemContext` ganharam `CurrentMarketRatePct`/`IPCAAccumulated12m`
    (+ `IsSandbox` só em `PurchaseContext` — roteiro sandbox já entrega taxa absoluta pronta,
    `Purchase` pula a soma de benchmark pra não duplicar o efeito da Selic). Repositório
    (`fixed_income_execution_repository.go`) só paga o custo de ler Selic/IPCA pra Prefixado/IPCA+
    não-sandbox — pós-fixado nem toca `market_calendar`/`market_indicator_history`. `CatalogRepository.
    FindFixedIncomeSpecialization` (consumida por `GET /assets/:id` E `GET /fixed-income/simulate`,
    mesmo leitor) ganhou `reprecificarOfertaParaExibicao` — mesmas fórmulas, garante que listagem/
    simulador nunca mostrem um número diferente do que a compra de verdade cobraria; cai de volta
    pro spread cru só se o Temporizador ainda não rodou nenhum tick (não é erro, é exibição antes da
    primeira precondição existir). Novo helper compartilhado `internal/infra/db/
    market_indicator_helpers.go` (`currentSelicRatePct`/`currentIPCAAccumulated12m`) evita duplicar a
    query entre os dois repositórios que agora precisam dela. Catálogo reseedado (`cmd/seed/main.go`):
    `LTN2027` (Prefixado) `interest_rate` de `11.75` pra `1.75` (spread, reproduz os mesmos 11,75%
    a.a. iniciais com Selic seed = 10%), `NTNB2035` (IPCA+) de `6.00` pra `0.50` (spread sobre a taxa
    real implícita da Selic seed via Fisher, ~6,75%, perto dos 6% reais originais).
  - **Gap remanescente, fora do escopo das 5 decisões (documentado, não uma delas):** a série diária
    de Selic que `PostFixedValue` usa no resgate pós-fixado continua repetindo a Selic corrente (nota
    3.1, pré-existente desde L.1) — não corrigida, mesmo com M.1 já trazendo o histórico real que
    tornaria isso possível; e `GET /fixed-income/simulate` continua com `PrefixedPrice` (fórmula
    errada) pra pós-fixado/IPCA+ — só a taxa que alimenta essa fórmula ficou correta pra Prefixado
    (pra IPCA+ a fórmula em si segue incompatível com a taxa real, mesma categoria de erro
    pré-existente, não uma regressão desta tarefa).
  - `gofmt`/`go vet`/`go build`/`go test ./...` (testes novos: `TestOfferedRate_*`/
    `TestFisherRealRate_*` em `fixedincome`; `TestPurchase_Prefixado_TaxaOfertadaAcompanhaSelicCorrente`/
    `TestPurchase_Prefixado_Sandbox_NaoSomaSelicSobreORoteiro`/
    `TestPurchase_IPCAMais_TaxaOfertadaUsaCorrecaoDeFisherNaoSelicNominalDireta`/
    `TestRedeem_IPCAMais_MarcacaoAMercadoUsaCorrecaoDeFisher` em `fixedincomeexecution` — os testes
    pré-existentes continuam passando sem alteração, `FisherRealRate(x, 0) = x` e
    `OfferedRate(spread, 0) = spread` são identidades que preservam o comportamento antigo quando os
    campos novos ficam zero-value)/`golangci-lint run` (Docker, `v2.12.2`, 0 issues) verdes.
    `.docs/engine/fixedincome.md`/`.docs/engine/catalog.md` atualizados.
  - **Validado ponta a ponta via `docker compose up -d --build`** (volume de dev existente, sem
    `down -v`): `GET /assets/:id` de `LTN2027` devolveu `interest_rate: 21.75` (spread 1,75 + Selic
    20% simulada no volume); `NTNB2035` devolveu `20.19` (spread 0,5 + Fisher(20%, IPCA acumulado
    real do dia) — bateu o cálculo manual exato); `SANDPRE` (sandbox) e `LFT2029` (pós-fixado)
    continuaram com o valor cru do catálogo, sem reprecificação. `POST /fixed-income/purchases` real
    de `LTN2027`/`NTNB2035` travou `average_rate` idêntico ao `interest_rate` da listagem; subir a
    Selic pra 25% antes de uma segunda compra do mesmo `LTN2027` travou uma taxa maior na mesma
    posição (blend entre as duas). Cenário de Fisher no resgate: Selic nominal 30% + IPCA acumulado
    12% (`FisherRealRate ≈ 16,07%`) contra taxa real contratada de ~20,19% devolveu
    `vs_contracted_rate` **positivo** (ganho extraordinário) — a leitura ingênua antiga (Selic
    nominal 30% direto vs. contratada 20,19%) teria devolvido o sinal oposto (perda), prova viva de
    que a correção de Fisher está em vigor. Stack parada com `docker compose down` (sem `-v`) ao
    final.

**Fase L fechada** (L.1-L.4).

### Achado do teste de ponta a ponta (pós-fechamento)

Sessão de review dedicada (não uma tarefa numerada) rodou um teste de ponta a ponta sobre L.1-L.4
depois da fase fechada, caçando bug/gap além do caminho feliz já validado nas sessões acima.
Achado real, corrigido na mesma sessão (bug mecânico, sem decisão de produto envolvida — CLAUDE.md):
`GET /fixed-income/simulate` (`fixedincomeexecution.Simulate`) continuava alimentando
`fixedincome.PrefixedPrice` (deságio nominal) com `interest_rate` cru pra **qualquer** tipo de
produto — pré-existente desde a 6.0.5, mas a L.1 reinterpretou esse campo de "% a.a." pra "% do
CDI" pros 6 tipos pós-fixados (ex: `110` = "110% do CDI"), o que transformou um gap conhecido numa
distorção de ordem de grandeza: o simulador projetava um CDB 110% CDI como se rendesse **110% a.a.**
(deveria ser ~11% a.a. com Selic 10%) — uma regressão introduzida pela própria L.1, não coberta
pelas notas "gap remanescente" de L.1/L.2/L.4 (que só falavam da taxa estar desatualizada, não da
fórmula estar errada por uma ordem de grandeza). Corrigido: `SimulateContext` ganhou
`ProductType`/`CurrentMarketRatePct`; `Simulate` ramifica pra `fixedincome.PostFixedValue` (compra
ao par, `UnitPrice = FaceValue`, projeção via Selic corrente repetida pelos dias simulados — mesma
mecânica de `Redeem`) quando `fixedincome.IsPostFixado(ProductType)`. `CatalogRepository` ganhou
`CurrentSelicRatePct` (método público, reaproveita o helper `currentSelicRatePct` já usado por
`Purchase`/`Redeem`/`reprecificarOfertaParaExibicao`), exposto em `assetCatalogReader`;
`handleFixedIncomeSimulate` lê a Selic corrente só pra produto pós-fixado e devolve `503`
(`ErrMarketCalendarNotInitialized`, mesmo tratamento de precondição de `Purchase`/`Redeem`) se o
Temporizador ainda não rodou nenhum tick. Testes novos:
`TestSimulate_PosFixadoCompraAoParEProjetaPostFixedValue`
(`fixedincomeexecution_test.go`); `TestHandleFixedIncomeSimulate_PosFixadoUsaPostFixedValueNaoDesagioNominal`/
`TestHandleFixedIncomeSimulate_PosFixadoSemTickDoTemporizadorDevolve503` (`fixedincome_test.go`,
httpserver) — os dois testes de simulate pré-existentes que já usavam CDB/LCI (postfixado) como
fixture (`fixedIncomeSimulateReader`, `TestHandleFixedIncomeSimulate_AtivoIsentoNuncaAplicaImposto`)
foram ajustados pra fornecer `selicRateOK`/`selicRate` (antes passavam só porque só checavam
positividade, nunca o valor exato — não pegavam esse achado). Achado secundário, só documentação:
o comentário de `fixedincome.IPCAEarlyRedemption` (`ipcaplus.go`) ainda dizia "nenhuma correção de
Fisher feita aqui" — verdade quando escrito na L.2, defasado depois da L.4 aplicar Fisher no
chamador (`fixedincomeexecution.Redeem`); comentário atualizado, nenhuma mudança de comportamento.
`go build`/`go test ./...`/`golangci-lint run` (Docker, `v2.12.2`, 0 issues) verdes.

**Terceiro achado — Tesouro IPCA+ do `GET /fixed-income/simulate`, registrado como gap remanescente
na primeira passada desta sessão e corrigido depois do autor pedir explicitamente pra fechar os dois
gaps documentados, não só o achado 011:** mesma distorção de fundo do achado do pós-fixado
(`Simulate` alimentando `PrefixedPrice` com um número que não é uma taxa nominal simples), mas
pré-existente desde a 6.0.5/L.2, não uma regressão da L.1 — `unit_price` chegava a menos da metade
do preço real de compra (deságio nominal ignorando o VNA composto por anos de IPCA simulado).
Corrigido: `fixedIncomeExecutor` (a interface que o handler consome) ganhou `Simulate` como método —
`*fixedincomeexecution.Service.Simulate` resolve `vnaBase`/`monthlyIPCA` (na compra) e
`projectedVNABase`/`projectedMonthlyIPCA` (na projeção futura, `days_held` à frente — pode cair numa
janela de VNA diferente) via `fixedincome.CurrentVNAWindow`, mesma fonte de `Purchase`/`Redeem`; a
função pura `Simulate` ganhou esses 4 parâmetros e uma branch nova (`simulateIPCAMais`) que precifica
via `IPCAPrice`/`VNAProjected` em vez de `PrefixedPrice`. `handleFixedIncomeSimulate` deixou de chamar
a função pura direto — chama `exec.Simulate` agora. Teste novo:
`TestSimulate_IPCAMaisUsaVNAEmVezDeDesagioNominal`; `fakeFixedIncomeExecutor` (httpserver) ganhou
`Simulate` delegando pra função pura de verdade (não um outcome canônico, pra continuar provando o
cálculo real nos testes HTTP já existentes).

**Quarto achado — Selic repetida no resgate de pós-fixado, mesmo gap "aceitável" registrado na nota
3.1 desde a L.1, também fechado a pedido do autor:** sem histórico diário persistido, `Redeem`
repetia a Selic do dia do RESGATE por todo o período decorrido — uma alta de Selic no fim do período
rendia retroativamente sobre os dias em que a Selic estava baixa, um ganho que um investidor real
nunca teria (só se beneficiaria da alta dali pra frente). Como a Fase M já persiste o histórico
diário real (`market_indicator_history`, com `created_at` — timestamp real, não só `simulated_day`),
corrigido: `RedeemContext` ganhou `SelicRatesSincePurchase []float64`; `LoadRedeemContext` lê a série
real via `db.selicRatesSince(ctx, db, positionCreatedAt)` (`WHERE created_at >= $1 ORDER BY
simulated_day`) só pra produto pós-fixado; `Redeem` usa essa série direto em `PostFixedValue`, em vez
de sintetizar uma série repetida internamente (`postFixedDailyRates` continua servindo só `Simulate`
— uma projeção pro FUTURO nunca tem histórico real pra usar). Testes novos/ajustados:
`TestRedeem_PosFixado_RendeDeVerdadeComASelicCorrente`/`TestRedeem_PosFixado_SelicMaisAltaRendeMais`
passaram a montar `SelicRatesSincePurchase` explicitamente (helper `flatSelicSeries`);
`TestRedeem_PosFixado_RendeConformeOCaminhoRealNaoUmaTaxaFinalRetroativa` (novo) prova o critério de
aceite central: dois cenários com a MESMA Selic final, um que ficou nela o ano inteiro e outro que só
chegou nela no fim, têm que render valores diferentes (o segundo, menos). Validado ao vivo via
`docker compose up`: posição de Tesouro Selic backdatada 400 dias, com 252 linhas sintéticas de
histórico real a 5% inseridas em `market_indicator_history` (cobrindo o período da posição) enquanto
`market_calendar.selic_rate` corrente ficava em 30% — resgate devolveu `realized_return_pct ≈ 5,08%`
(a série real), não ~30% (o que a Selic corrente teria dado sob o comportamento antigo). IPCA+
simulado antes/depois: `unit_price` do NTNB2035 foi de `735,89` (deságio nominal puro, achado) pra
`1614,98` (com VNA — bate exatamente com o preço que uma compra real cobraria no mesmo instante).
`go build`/`go test ./...`/`golangci-lint run` (Docker, `v2.12.2`, 0 issues) verdes pros dois achados.

**Segundo achado, mais grave — registrado como 011 em `pontos-em-aberto-decisao-produto.md` e
corrigido na mesma sessão** depois do autor pedir o impacto do achado e confirmar a correção
recomendada: a marcação a mercado de `Redeem` (Prefixado/IPCA+) comparava a taxa CHEIA travada na
compra (spread + benchmark, `fixedincome.OfferedRate`, tarefa L.4) contra o benchmark corrente SEM o
mesmo spread — como esse número vira `total_value`/`net_value` de verdade em
`accounts.current_balance` (não só o rótulo `vs_contracted_rate`), isso não era uma inconsistência de
exibição, era **dinheiro duplicável de verdade**: compra e resgate instantâneo do mesmo título, sem
nenhum tick do Temporizador entre os dois, sem carência nenhuma na API, creditava mais do que foi
investido — validado ao vivo repetindo o ciclo 4 vezes em LTN2027 (Selic parada em 30%): saldo foi de
R$ 10.000,00 pra R$ 11.129,06 em segundos, compondo a cada rodada. Corrigido pela fórmula (opção
recomendada e confirmada com o autor, não uma carência mínima — a fórmula fecha o exploit por
completo, a carência só desaceleraria): `RedeemContext` ganhou `AnnualRatePct` (spread do catálogo,
mesma fonte de `PurchaseContext.AnnualRatePct`) e `IsSandbox`; `Redeem` soma esse spread ao benchmark
corrente antes de marcar a mercado (Prefixado via Selic nominal, IPCA+ via Fisher), exceto sandbox
(taxa do roteiro já vem pronta, sem spread separado). `LoadRedeemContext` passou a ler
`fixed_income_assets.interest_rate` (mesma query, mais uma coluna) e propagar `is_sandbox`. Testes
novos: `TestRedeem_Prefixado_SpreadNaoGeraGanhoArtificialQuandoSelicNaoMudou`,
`TestRedeem_Prefixado_ComSpread_SelicSubiuAindaGeraPerdaReal` (prova que a marcação genuína continua
funcionando),
`TestRedeem_Prefixado_Sandbox_NaoSomaSpreadSobreATaxaDoRoteiro`,
`TestRedeem_IPCAMais_SpreadNaoGeraGanhoArtificialQuandoBenchmarkNaoMudou` — os testes pré-existentes
de marcação a mercado continuam passando sem alteração (não setavam `AnnualRatePct`, zero-value é
identidade em `OfferedRate`). Validado ao vivo repetindo o mesmo cenário de exploração pós-correção:
saldo ficou em R$ 10.000,00 nos 4 ciclos seguidos (antes: R$ 11.129,06). `go build`/`go test
./...`/`golangci-lint run` (Docker, `v2.12.2`, 0 issues) verdes. Detalhe completo do achado (com/sem
a correção) em `pontos-em-aberto-decisao-produto.md`, achado 011 (seção "Resolvidos").

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

### M.1 · Histórico diário persistido de Selic e IPCA ✅

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
- **Entregável:** tabela nova `market_indicator_history` (migration `000021`, `simulated_day`
  único, `selic_rate`/`ipca_monthly`/`ipca_accumulated_12m`) gravada a cada tick por
  `TickRepository.SaveTick`, sem mudar o contrato de `market_calendar` (continua a linha singleton
  de leitura corrente). Cadência decidida: **todo dia repete o valor do mês corrente** — pacote
  `ipca` ganhou `CurrentMonthIndex(dayIndex, monthDays)` (todo dia simulado já pertence a um mês
  desde o dia 0, diferente de `IsReportDay`/`IsCopomMeetingDay`, que só disparam no último dia de
  um ciclo) e `DefaultMonthDays = 30` (mês simulado ilustrativo, dias fixos — mesma simplificação
  de `CopomMeetingIntervalDays` pro Copom, não um mês de calendário real). **Acumulação resolvida
  aqui, não em `ipca`** (a pergunta que I.1 deixava em aberto): `ipca.MonthlyRate(cfg, monthIndex)`
  deriva sua própria rng de `(cfg.Seed, monthIndex)` — IPCA não tem memória entre meses (cada mês é
  a meta mais ruído), então, diferente de `selic.NextCalendarRate`, `Advance` nunca precisa de
  nenhum estado persistido pra IPCA: recalcula o mês corrente e o acumulado de 12 meses
  (`ipca.Accumulated12m`, composição por produto — não soma simples, janela parcial antes do
  primeiro ano simulado) inteiramente a partir de `dayIndex`, sempre O(12), a cada tick.
  `ipcaAccumulatedDeviation` (o placeholder `0` que a I.1 deixava em `tick.go`) agora vem de
  `ipca.AccumulatedDeviation`, que fechou o achado desta sessão: comparar um acumulado de poucos
  meses contra a meta **anualizada** (12 meses fixos) sempre pareceria "abaixo da meta" antes do
  primeiro ano simulado, mesmo com o IPCA mensal batendo exatamente a própria meta — corrigido
  comparando sempre contra `ipca.TargetForWindow` com a MESMA janela do acumulado (não sempre 12
  meses), eliminando o viés. `ipca.DefaultConfig(seed+1)` (offset fixo, não a mesma seed de
  `selicConfig` — os dois são singletons globais do processo, sem id de entidade pra decorrelacionar
  via hash) com meta/banda/volatilidade ilustrativas (`DefaultMonthlyTarget = 0.00367` ≈ 4,5% a.a.,
  coerente com `selic.DefaultNeutralRate = 10%`), documentadas como sujeitas a calibração futura,
  mesmo tratamento já dado a outros defaults do motor. `tick.Advance`/`tick.Service`/`NewService`
  ganharam o parâmetro `ipcaCfg ipca.Config` (56 call-sites de teste atualizados). Testes novos:
  pacote `ipca` (`MonthlyRate`/`Accumulated12m`/`TargetForWindow`/`AnnualizedTarget`/
  `AccumulatedDeviation`/`CurrentMonthIndex`, incluindo o teste que provou e depois fechou o viés de
  janela parcial) e pacote `tick` (IPCA repete dentro do mês/muda quando o mês vira, acumulado bate
  a composição, Selic recebe exatamente o desvio que `ipca.AccumulatedDeviation` calcula no dia de
  reunião). `gofmt`/`go vet`/`go build`/`go test ./...`/`golangci-lint run` (Docker, v2.12.2, 0
  issues) verdes. `.docs/engine/tick.md` atualizado (tabela nova, parágrafo da regra de Selic, nota
  da G.3 sobre IPCA+ de FII papel corrigida — deixou de ser "sem consumidor"). **Validado ponta a
  ponta via `docker compose up -d --build`** (worktree com volume novo, sem dado pré-existente):
  seed + 34 `POST /admin/tick` (dias 1→35) confirmaram — `market_indicator_history` com exatamente
  35 linhas, uma por dia; `ipca_monthly` idêntico do dia 1 ao 30 (0.003758) e mudando exatamente no
  dia 31 (0.002307, primeiro dia do mês simulado 1); `ipca_accumulated_12m` bate a composição por
  produto dos dois meses (0.006073, não a soma 0.006065); `selic_rate` mudou exatamente no dia 21
  (10.000 → 9.750, dia de reunião do Copom) e ficou constante nos dias vizinhos; `market_calendar`
  (`current_day = 35`, `selic_rate = 9.750`) continua espelhando a última linha do histórico sem
  mudança de contrato. Stack parada com `docker compose down` (sem `-v`) ao final.

### M.2 · Endpoint HTTP de série histórica (engine) ✅

- **Descrição:** rota nova (ex: `GET /market/indicators/history`) devolvendo a série persistida em
  M.1 — Selic/IPCA mensal/IPCA acumulado 12m por dia simulado, com parâmetro de janela (ex: último
  N dias/meses, a decidir na sessão o range default). Mesmo padrão de autenticação/trust boundary
  das demais rotas de leitura de mercado (motor não valida role, backend decide o que expor
  publicamente).
- **Critérios de aceite:** teste de router cobrindo resposta com dados reais persistidos por M.1 e
  o caso de motor recém-subido (sem histórico ainda, resposta vazia sem erro).
- **Referências:** proposta seção 6.
- **Dependências:** M.1.
- **Entregável:** `GET /market/indicators/history` (`internal/infra/httpserver/indicators.go`),
  mesmo padrão de trust boundary de `POST /admin/tick`/`GET /macro-events` (motor não valida role).
  `?days=` opcional, default `defaultIndicatorHistoryDays = 90` — bem maior que os 30 de `GET
  /assets/:id/quotes` (tarefa 4.6) porque Selic/IPCA só mudam por ciclo (Copom a cada 21 dias
  simulados, mês de IPCA a cada 30), 90 dias cobre ~4 ciclos de Copom e 3 meses de IPCA, o bastante
  pra um gráfico com movimento real (tarefa M.4). `TickRepository.ListIndicatorHistory`
  (`internal/infra/db/tick_repository.go`) lê `market_indicator_history` com o mesmo padrão SQL de
  `CatalogRepository.ListQuoteHistory` (subquery `ORDER BY ... DESC LIMIT $1` seguida de `ORDER BY
  ... ASC`) — `TickRepository` já é quem escreve a tabela desde M.1, então ganhar a leitura também
  é só um método a mais no mesmo adapter, não uma responsabilidade nova. Tipo novo
  `tick.IndicatorHistoryEntry` (dia + os três indicadores juntos — diferente de `Result`, que já
  tem os mesmos três valores achatados sem o dia, porque `Result` é sempre "o dia que acabou de ser
  gerado"; aqui é uma série, precisa do dia explícito). Lista vazia (nunca `null`) se o Temporizador
  nunca rodou — mesmo tratamento de `GET /assets/:id/quotes`/`GET /macro-events`. `New`/`Run`
  (`server.go`) ganharam o parâmetro `indicatorHistory indicatorHistoryReader`, preenchido em
  `main.go` pela mesma instância de `tickRepository` já usada pelo `tick.Service` (nenhum
  repositório novo instanciado) — 13 call-sites de teste (`New("", ...)`) atualizados com mais um
  `nil`/fake posicional. Testes novos em `indicators_test.go`: dados reais persistidos, motor
  recém-subido (lista vazia sem erro), `?days=` custom, `days` inválido (400), erro de repositório
  (500), serviço indisponível (503) — os dois primeiros são exatamente os critérios de aceite desta
  tarefa. `gofmt`/`go vet`/`go build`/`go test ./...`/`golangci-lint run` (Docker, v2.12.2, 0
  issues) verdes. `.docs/engine/tick.md` atualizado (seção nova do endpoint + nota da tabela
  `market_indicator_history` que dizia "sem rota de leitura própria até a tarefa M.2" corrigida).
  **Validado ponta a ponta via `docker compose up -d --build engine postgres redis`**, reusando o
  volume Postgres da validação da M.1 (35 dias já persistidos, sem reseed): `?days=5` devolveu
  exatamente os dias 31-35 (`selic_rate = 9.750`, `ipca_monthly_rate` do segundo mês simulado,
  0.002307); sem `?days=`, default 90 devolveu os 35 dias inteiros (dia 1 ao 35, janela maior que o
  histórico existente); `?days=0` devolveu `400`; um novo `POST /admin/tick` (dia 36) apareceu
  imediatamente em `?days=1` sem reiniciar o motor. Stack parada com `docker compose down` (sem
  `-v`, volume preservado) ao final.

### M.3 · Rota no backend gamificado + cache Redis ✅

- **Descrição:** módulo `market` (backend) ganha uma rota nova (ex: `GET /market/indicators`)
  proxying pro endpoint da M.2, com cache Redis de TTL curto (indicador só muda no máximo 1x por
  dia simulado — mesmo racional de cache já usado pra cotação/ranking, tarefa 5.7). Documentar em
  `.docs/backend/market.md` (payload, sucesso, erros, regra — template `.docs/README.md`).
- **Critérios de aceite:** rota valida entrada com Zod (parâmetro de janela, se exposto); teste de
  caso de uso com fake do port de leitura de mercado; teste de adapter contra Redis real; teste de
  router via supertest.
- **Referências:** `.claude/arquitetura-backend-ddd-lite.md`; `.docs/backend/market.md`.
- **Dependências:** M.2.
- **Entregável:** `GET /market/indicators` (`marketRouter.ts`) — mesma convenção de autenticação
  do resto do módulo (Bearer token, qualquer usuário, motor não valida role). Porta nova
  `IndicatorHistoryReader` (`application/ports/indicatorHistoryReader.ts`) — deliberadamente **não**
  estendida de `CatalogReader`: indicador macro não é um ativo do catálogo, mesmo racional de
  `market` já ter portas finas separadas por natureza do dado (`accountReader`/`orderExecutor`
  etc.), não uma porta única genérica. `GetIndicatorHistoryUseCase` → adapter de motor
  (`engineIndicatorHistoryReader.ts`, `GET /market/indicators/history?days=`) decorado com cache
  Redis em `app.ts` (`createRedisIndicatorHistoryCache`/`redisIndicatorHistoryCacheStore.ts`) —
  mesmo padrão de `createRedisNetWorthCache`/`redisNetWorthCacheStore.ts` de `modules/ranking`
  (tarefa 5.7): TTL curto (`DEFAULT_TTL_SECONDS = 5 * 60`, mesmo valor de `redisNetWorthCache.ts`
  por simplicidade), chave por `days` (`indicators:history:<days|'default'>`) em vez de userId/asOf
  — a série histórica é a mesma pra qualquer chamador, não por usuário. Redis fora do ar cai pro
  motor direto (mesma garantia best-effort do cache de ranking, nunca propaga erro do store).
  Resposta wrapada em `{ indicators: [...] }` (mesma convenção de `{ quotes: [...] }` da
  `GET /market/assets/:id/quotes`), campos em snake_case sem tradução (`simulated_day`/
  `selic_rate`/`ipca_monthly_rate`/`ipca_accumulated_12m`, 1:1 com o motor). Query `days` validada
  por `indicatorHistoryQuerySchema` (`z.coerce.number().int().min(1).optional()`, mesma forma de
  `getAssetQuotesQuerySchema`) — omitido, sem default próprio neste módulo, o motor decide
  (`defaultIndicatorHistoryDays = 90`). Testes novos: `getIndicatorHistory.test.ts` (caso de uso
  com fake), `engineIndicatorHistoryReader.test.ts` (adapter, `fetch` mockado — mesmo padrão de
  `engineCatalogReader.test.ts`), `redisIndicatorHistoryCacheStore.test.ts` (adapter contra cliente
  `ioredis` mockado — mesmo padrão de `redisNetWorthCacheStore.test.ts`, não Redis real: é o padrão
  já estabelecido pelo precedente da 5.7 nesta base de código), `redisIndicatorHistoryCache.test.ts`
  (decorator — cache frio/quente, chaves distintas por `days`, Redis fora do ar não quebra leitura),
  e 5 testes novos em `marketRouter.test.ts` (401 sem token, 200 com série, `days` repassado sem
  default do backend, 400 pra `days` inválido, erro do motor traduzido 1:1). `npm run lint`/
  `build`/`test` (582 testes) verdes; `npx prettier --check` verde. `.docs/backend/market.md`
  atualizado (seção nova `GET /market/indicators` na categoria Catálogo). **Validado ponta a ponta
  via `docker compose up -d --build postgres redis engine backend`** (worktree própria, volume
  Postgres/Redis já com ~36 dias de tick de sessões anteriores): 10 `POST /admin/tick` avançaram
  pra dia 46, cadastro de usuário via `POST /auth/register` gerou token, `GET
  /market/indicators?days=5` devolveu exatamente os dias 42-46; `redis-cli -n 1 keys
  'indicators:*'` confirmou a chave `indicators:history:5` populada com TTL ~300s; um novo
  `POST /admin/tick` (dia 47) seguido do mesmo `?days=5` continuou servindo o dado velho (dia 46 no
  topo, cache quente), enquanto `?days=1` (chave nova, nunca cacheada) foi direto ao motor e trouxe
  o dia 47 fresco — confirma cache por chave de `days`, não global. `?days=0` devolveu `400`; sem
  token devolveu `401`. Stack parada com `docker compose down` (sem `-v`) ao final.

### M.4 · Tela "Indicadores Econômicos" no frontend ✅

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
- **Entregável:** ponto de entrada decidido na sessão — card novo "Indicadores Econômicos" no hub
  de Mercado (4.1, `pages/Market`), 3ª coluna a partir do desktop (`Market/index.module.css`, regra
  nova de `grid-template-columns: repeat(3, 1fr)` em `min-width: 1024px`, pra não sobrar um card
  órfão numa grade de 2 colunas). Tela nova `pages/IndicadoresEconomicos` (4.9 no inventário,
  rota `/mercado/indicadores`, irmã de `/mercado/*`, sem `RequiresUnlock` — dado informativo, não
  produto da trilha) consome uma única fonte de dado (`GET /market/indicators`, M.3, via
  `useIndicatorHistoryQuery` novo) pra alimentar tanto os cards de valor corrente quanto os dois
  gráficos: o último item da série (ordem cronológica, mais recente por último) vira "valor
  corrente". Organism novo `IndicatorSummaryCards` (4 cards: Selic meta anual — `formatRatePercent`,
  já em pontos percentuais —, IPCA mensal e IPCA acumulado 12m — `formatPercentage`, razão 0–1,
  mesma distinção de escala de `services/market/types.ts` — e Próximo Copom simulado) —
  deliberadamente **sem sparkline por card** (identidade-visual-padroes.md §2: a regra é só pra
  card monetário ou de métrica de progresso, nenhum dos dois é o caso de dado macro). "Próximo
  Copom simulado" não vem de nenhum endpoint novo — o motor só marca reunião já ocorrida, nunca a
  próxima — então é derivado no cliente por `features/market/nextCopomDay`
  (`nextCopomSimulatedDay`, espelha `selic.CopomMeetingIntervalDays = 21` do motor: reunião cai em
  todo `simulated_day` múltiplo de 21, próxima é sempre o múltiplo estritamente maior que o último
  dia conhecido). Gráficos: `features/market/indicatorChartLayout`
  (`computeIndicatorChartLayout`, generaliza `priceChartLayout` por `value` em vez de `price` — sem
  semântica de ganho/perda, sempre `--color-brand-500`, nunca `--color-gain-*`/`--color-loss-*`,
  que têm semântica própria de rentabilidade) + organism `IndicatorLineChart` (mesmo motivo visual
  "papel de gráfico"/área preenchida/hover com tooltip de `PriceChart`, mas com `title` +
  `formatValue` próprios por instância — reusado 2x na tela: "Selic (meta anual)" e "IPCA acumulado
  12m", com o mesmo seletor de intervalo 3M/6M/1A compartilhado, dias maiores que o `RANGES` de
  ativo (4.5) porque Selic/IPCA só mudam por ciclo de ~21-30 dias). IPCA mensal aparece só como
  stat corrente, não charted — ele e o acumulado 12m têm ordem de grandeza ~12x diferente (mensal
  ~0,3-0,4%, acumulado ~4-5%), um eixo compartilhado deixaria o mensal ilegível; acumulado 12m é o
  número "de manchete" de qualquer forma. Responsivo nos 3 breakpoints: mobile/tablet 1 coluna
  empilhada (2 colunas de stat card a partir de 768px), desktop (≥1024px) ganha composição própria
  — 4 colunas de stat card, 2 colunas de gráfico lado a lado, nunca coluna única esticada.
  `npm run lint` (oxlint, 0 issues novos)/`tsc -b`/`npm test` (684 testes, frontend) verdes;
  `npx prettier --check` verde. `.claude/inventario-telas-plataforma-investimentos.md` atualizado
  (4.9 nova + 4.1 com o card novo). **Validado ponta a ponta via `docker compose up -d --build
  postgres redis engine backend gateway`** (worktree própria) + `vite` local apontando pro gateway
  containerizado (`VITE_GATEWAY_URL` default `http://localhost:8000`): cadastro via
  `POST /auth/register` + 47 `POST /admin/tick` deram um usuário logado com histórico real; tela
  acessada via Chrome (login por `localStorage` direto, mesmo mecanismo de `AuthContext`) mostrou
  Selic `9,8%`/IPCA mensal `0.2%`/IPCA acumulado `0.6%`/Próximo Copom `Dia 63` (bate com
  `nextCopomSimulatedDay(47) = 63`) e os dois gráficos desenhando o degrau real do dia 21 (Copom) e
  do dia 31 (virada de mês do IPCA); troca de intervalo (3M→1A) e hover com tooltip (`Dia 24` /
  `9,8%`) confirmados interativamente; os 3 breakpoints confirmados via aba própria por largura
  (420px mobile — tab bar inferior fixa; 834px tablet — nav horizontal, 2 colunas de stat card,
  gráficos empilhados; 1920px desktop — 3 colunas no hub de Mercado, 4 colunas de stat card, 2
  colunas de gráfico lado a lado). Stack parada com `docker compose down` (sem `-v`) ao final.

### M.5 · Novas lições: "Como a Selic é formada" e "O que é o IPCA" ✅

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
- **Entregável:** posição decidida na sessão — "Como a Selic é formada" logo após 1.2 (código
  `1.3`) e "O que é o IPCA" logo antes de 1.8/Tesouro IPCA+ (código `1.9`, não após 0.3: a opção de
  0.3 colocaria a lição na Trilha 0, contradizendo o "Duas lições novas na Trilha 1" da descrição
  original) — Trilha 1 renumerada `1.1`-`1.11` (`code`/`sortOrder` das 7 lições entre `1.3` e `1.9`
  originais deslocados um degrau, Trilhas 2/3 só com `sortOrder` +2, `code` intocado), currículo
  35 lições. Tipo de Micro-decisão novo `live_macro_indicator` (`lesson_micro_decision_type`,
  migration `0015`, `ALTER TYPE ... ADD VALUE`, sem TTY) — mesmo padrão do `live_indicator` das
  2.6.x, mas a Revelação busca `GET /market/indicators` (M.3) via `useIndicatorHistoryQuery` (ganhou
  `options.enabled`) em vez de um ticker de ativo, renderizando `IndicatorSummaryCards` (M.4)
  dentro de `pages/Lesson`. As duas lições ganham aposta real (`microDecisionOptions`/
  `microDecisionCorrectOption`), consistente com as demais da Trilha 1. `backend`: 582 testes (1
  novo, `Lesson` reaproveitado sem teste de domínio novo — nenhuma regra de negócio nova além do
  enum); `frontend`: 685 testes (1 novo, cobrindo a Revelação `live_macro_indicator`);
  `npm run lint`/`npm run build`/`prettier --check` verdes nos dois lados (únicos warnings restantes
  são os 5/7 já pré-existentes, confirmados via `git stash` antes desta sessão). Achado registrado
  em `.claude/pontos-em-aberto-decisao-produto.md` (008): a renumeração de `code` faz o seed
  reaproveitar a linha física de uma lição existente em vez de criar linha nova, então
  `user_lesson_progress` de ambiente já usado antes da M.5 pode ficar atribuído à lição errada após
  o reseed — sem correção mecânica possível, decisão de produto em aberto. Achievement "Formado na
  Trilha" recalibrado de 33 para 35 (`seedAchievements.ts`, mesma ressalva: seed só insere por nome,
  não atualiza um ambiente que já tinha a conquista). **Validado ponta a ponta via
  `docker compose up -d --build postgres redis engine backend gateway`** (worktree própria,
  migration `0015` aplicada automaticamente no start do backend) + `db:seed:lessons`/
  `db:seed:achievements` contra o Postgres do compose (35 lições confirmadas via
  `select count(*) from lessons`, sem duplicata, reseed rodado 2x idempotente) + `vite` local
  apontando pro gateway containerizado. Usuário novo registrado via `POST /auth/register`, 7
  primeiras lições completadas via API pra desbloquear `1.3`; Chrome real (login via UI, não
  localStorage — porta do Vite precisa bater com o `CORS_ORIGIN` do backend, `5173`) confirmou
  Cenário/Micro-decisão (aposta "Sobe" acertada, badge "Você acertou")/Revelação da lição `1.3`
  mostrando os 4 cards ao vivo (Selic `9,8%`/IPCA mensal `0.2%`/IPCA acumulado `0.6%`/Próximo Copom
  `Dia 63`) com dado real do endpoint, mesmo painel da tela Indicadores Econômicos (M.4)
  reaproveitado dentro da lição. Hub da Trilha confirmado mostrando "7 de 35 lições concluídas no
  total" e "2/11 lições" na Trilha 1. Stack parada com `docker compose down` (sem `-v`) ao final.

### M.6 · `lessons.stable_key` como chave de upsert do seed, liberando `code` pra ser mutável ✅

- **Descrição:** resolve o achado 010 (`.claude/pontos-em-aberto-decisao-produto.md`) — opção (c)
  escolhida pelo autor (2026-09-20): hoje `seedLessons.ts` casa o upsert por `lessons.code`
  (`onConflictDoUpdate({ target: lessons.code })`) e nunca inclui `code` no `set`; toda renumeração
  de `code` (como a que a própria M.5 fez em 7 lições) reaproveita a linha física/`id` existente em
  vez de criar linha nova, arrastando `user_lesson_progress` de quem já tinha progresso real pra uma
  lição de conteúdo diferente, sem erro nem log. Muda a chave de casamento do upsert pra uma coluna
  nova e estável (`stable_key`, `varchar`, `UNIQUE`, nunca reordenada — um valor por lição, atribuído
  uma vez e nunca mais tocado mesmo que a posição didática mude), deixando `code` livre pra refletir
  só a posição atual no currículo e podendo, portanto, entrar no `set` do upsert dali em diante.
  Análise de impacto feita nesta sessão (2026-09-20, ver achado 010) confirmou que gating de
  trilha/desbloqueio usa inteiramente `sortOrder` (nunca `code`) tanto no backend
  (`modules/lessons/domain/lesson.ts`) quanto no espelho do frontend (`features/lessons/
  unlockedKeys`, `nextUnlockFor`) — risco de regressão em desbloqueio é baixo. `user_lesson_progress`
  já referencia `lessons.id` (uuid), não `code` — não precisa de mudança de schema própria. Como a
  aplicação **não está em produção**, não há dado real a preservar: a tarefa pode truncar
  `lessons`/`user_lesson_progress` (e o que mais depender deles, ex: XP já concedido por lição) e
  reseedar do zero com o schema novo, sem precisar de uma política de migração de dado legado.
  Dois efeitos colaterais que a análise encontrou e que entram no mesmo escopo (não são bugs à
  parte, são consequência direta de `code` virar mutável):
  1. `application/useCases/advanceLesson.ts:160` usa `` `licao:${lesson.code}` `` como chave de
     idempotência do XP (`xpAwarder.award`) — se `code` mudar numa renumeração futura, essa chave
     muda junto e abre brecha pra reconceder XP da mesma lição já concluída. Trocar pra uma chave
     baseada em `id`/`stable_key` (imutável) no mesmo commit.
  2. `.docs/backend/lessons.md:73` já documenta o seed incorretamente (`ON CONFLICT (code) DO
     NOTHING`, quando o código real sempre fez `onConflictDoUpdate`) — corrigir junto e documentar o
     `stable_key` novo, regra do CLAUDE.md de doc no mesmo commit.
  Fora de escopo: o markup de conteúdo `{{ref:X.Y}}` (`pages/Lesson/index.tsx`, resolvido comparando
  `code`) continua funcionando sem mudança — é responsabilidade de quem edita conteúdo manter esse
  texto em sincronia com o `code` vigente quando a posição de uma lição mudar, mesma natureza de
  qualquer outro texto de lição, não uma regra de sistema.
- **Critérios de aceite:** migration nova adiciona `lessons.stable_key` (`UNIQUE NOT NULL`);
  `seedLessons.ts` casa por `stable_key`, inclui `code` no `set`; rodar o seed duas vezes seguidas
  sem duplicar linha nem trocar `id` de nenhuma lição; teste cobrindo o cenário do achado 010 (mudar
  o `code` de uma entrada de `LESSON_SEEDS` mantendo o mesmo `stable_key` e confirmar que o upsert
  atualiza a linha existente, não cria uma nova, e preserva `id`); chave de idempotência de XP em
  `advanceLesson.ts` não depende mais de `code`; `.docs/backend/lessons.md` atualizado; `npm run
  lint`/`npm run build`/`npm test` verdes.
- **Referências:** achado 010 (`.claude/pontos-em-aberto-decisao-produto.md`); decisão do autor
  (2026-09-20, opção (c)).
- **Dependências:** nenhuma (independente do núcleo A-M, é uma correção de infraestrutura de seed).
- **Entregável:** `lessons.stable_key` (`varchar(20) UNIQUE NOT NULL`, migration `0016`) — chave de
  upsert nova e imutável, atribuída uma vez por lição (hoje coincide com o `code` vigente no momento em
  que a coluna nasceu). `seedLessons.ts`: upsert extraído pra `upsertLessonSeed` (testável), `target:
  lessons.stableKey`, `code` agora no `set`. Migration trunca `user_lesson_progress`/`lessons` antes de
  tornar `stable_key` NOT NULL (app não está em produção, sem dado real a preservar). `AdvanceLessonUseCase`:
  chave de idempotência do XP trocada de `licao:${lesson.code}` pra `licao:${lesson.id}` (imutável,
  efeito colateral direto de `code` virar mutável). `.docs/backend/lessons.md` corrigido (documentava
  `ON CONFLICT (code) DO NOTHING`, nunca foi verdade) e atualizado com `stable_key`. Achado 010 movido
  pra "Resolvidos" em `.claude/pontos-em-aberto-decisao-produto.md`. Teste novo
  (`seedLessons.test.ts`, fake in-memory reproduzindo `ON CONFLICT` do Postgres) cobrindo o cenário do
  achado — renumerar `code` mantendo `stableKey` atualiza a linha existente sem duplicar, preservando
  `id`. Validado ponta a ponta via `docker compose up` (postgres+redis+engine+backend): migration
  aplicada sobre um banco já seedado por sessões anteriores (truncate rodou), seed rodado 2x seguidas —
  35 lições, mesmos `id`s nas duas rodadas, `GET /lessons` respondendo. `npm run lint`/`npm run
  build`/`npm test` verdes (585 testes).

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
  (A.4), posição/caixa atual por ativo e, para Market Maker, os ativos que cobre, o teto `max_covered_assets` e quantos
  ativos negociáveis estão sem Market Maker ativo cobrindo, P.9), `POST /admin/bots` (cria bot novo — personalidade (C.1),
  escopo de especialização, caixa/posição inicial, reaproveitando validação de domínio já existente
  em vez de duplicar), `PATCH /admin/bots/:id` (alterna `is_active`, A.4; para Market Maker também ajusta `max_covered_assets`, validado como positivo por `bot.Personality.WithMaxCoveredAssets`, e reatribui cobertura: ao tirar um ativo de um Market Maker, cancelar as ordens em repouso dele nesse ativo, porque a cotação de Market Maker ativo não expira por dia, P.5; e ao criar Market Maker novo, usar `coverage.Ensurer`/`Assign`, não caminho paralelo, P.9). Backend expõe as 3 rotas
  atrás de `authMiddleware`/`role = admin` (mesmo padrão do Painel Admin de Eventos Macro, 4.5),
  documentadas em `.docs/engine/<pacote>.md` e `.docs/backend/admin.md`.
- **Critérios de aceite:** teste table-driven de criação cobrindo personalidade/escopo válidos e
  inválidos (reaproveitando a validação da C.1); teste confirmando que `PATCH` alterna `is_active`
  sem tocar posição/caixa (mesmo critério da A.4); teste de router (backend) confirmando `403` pra
  usuário não-admin nas 3 rotas.
- **Referências:** proposta 2.3; `.docs/engine/admin.md` (a criar/estender); tela 10.1/10.2 como
  precedente de padrão admin.
- **Nota (achado 002, `.claude/pontos-em-aberto-decisao-produto.md`):** `POST /admin/bots` é o
  primeiro consumidor real de `bot.NewRiskProfile` fora do seed (que hoje só cria com `0.02`
  fixo) — `SpreadWidthPct` não tem teto superior (só rejeita `< 0`) antes do `>= 2` de
  `DecideMarketMakerOrders` colapsar o book. Achado ainda sem decisão de produto (qual teto máximo
  é razoável) — resolver antes de aceitar esse campo vindo de input externo nesta tarefa.
- **Dependências:** A.4, C.1, C.6 (catálogo de bots já existente pra listar).

### N.2 · Tela "Painel Admin — Bots" no frontend

- **Descrição:** tela nova dentro da área admin (mesmo padrão visual/navegação do Painel Admin de
  Eventos Macro, 10.1/10.2) — lista de bots (ticker/setor de cobertura, arquétipo, `is_active`,
  posição/caixa atual; para Market Maker, ativos cobertos e teto, com aviso dos ativos sem cobertura ativa, P.9), alternância ativo/inativo por linha, formulário de criação de bot novo
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

### O.1 · Cancelamento manual de ordem pendente ✅

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
- **Entregável (sessão 2026-09-21):** decisão de rota tomada — `POST /orders/{id}/cancel` (não
  `DELETE`), consistente com toda mutação existente em `server.go` já ser `POST` (`/admin/tick`,
  `/orders`, `/fixed-income/purchases|redemptions`, `/macro-events`), nenhuma rota usa `DELETE`
  hoje. Motor: `orderexecution.ErrOrderNotFound`/`ErrOrderNotCancellable` (novos erros de domínio);
  `Service.Cancel(ctx, orderID, userID)` repassa direto pro repositório (nenhuma regra de domínio
  própria — cancelar é só uma transição de status); `OrderExecutionRepository.CancelOrder` lê
  dono/status com `SELECT ... FOR UPDATE` dentro de uma transação antes de decidir (`UPDATE ...
  WHERE` sozinho não distingue "não existe" de "é de outro usuário" de "status errado" a partir de
  "0 linhas afetadas") — ordem inexistente e ordem de outro usuário colapsam no mesmo
  `ErrOrderNotFound` (404) de propósito, pra não vazar a existência de uma ordem alheia; status já
  `filled`/`cancelled` vira `ErrOrderNotCancellable` (409). Rota nova registrada em `server.go`
  (`orderSubmitter` ganhou o método `Cancel`, implementado pelo mesmo `*orderexecution.Service` que
  já implementa `Submit` — não precisou de parâmetro novo em `New`/`Run`/`main.go`). Backend:
  `OrderExecutor.cancel`/`CancelOrderUseCase` (sem gate de desbloqueio da 7.0.1 — cancelar não é
  "comprar produto travado") → `POST /market/orders/:id/cancel`, `user_id` sempre de
  `req.auth.userId`, nunca de parâmetro/corpo. `engineFetch` (`engineHttp.ts`) ganhou tratamento de
  `204` (chamar `res.json()` num corpo vazio rejeitava com "Unexpected end of JSON input") — só
  afeta quem devolve `204`, nenhum adapter existente muda de comportamento. Testes novos em todas
  as camadas (Go: `service_test.go`/`orders_test.go`; Node: `cancelOrder.test.ts`/
  `engineOrderExecutor.test.ts`/`marketRouter.test.ts`) cobrindo sucesso, `404`/`409`/`400` e
  ausência de dependência. `go build`/`go vet`/`go test ./...`/`golangci-lint run` (Docker,
  `v2.12.2`, 0 issues) e `npm run build`/`npm run lint`/`npx vitest run` (594 testes) verdes.
  `.docs/engine/orders.md`/`.docs/backend/market.md` atualizados. Validado ponta a ponta via
  `docker compose up -d --build` (2 usuários reais registrados via `POST /auth/register`, ordem
  limitada sem contraparte deixada pendurada em ativo sandbox `SAND3`): `POST
  /market/orders/:id/cancel` do dono devolveu `204` e o `order_book.status` virou `cancelled` no
  Postgres; cancelar de novo a mesma ordem devolveu `409`; ID inexistente devolveu `404`; sem
  `Authorization` devolveu `401`; e o segundo usuário tentando cancelar a ordem do primeiro também
  devolveu `404` (não `403`) — confirma ao vivo que "ordem de outro usuário" e "ordem inexistente"
  colapsam no mesmo erro, exatamente a decisão de não vazar existência tomada no design.
- **Teste de ponta a ponta e correção de bug (sessão 2026-09-21, branch `fase-o-cancelamento-ordem`):**
  achado ao vivo — `fillRestingOrder` (`order_execution_repository.go`) sobrescrevia `status =
  cancelled` de volta pra `partially_filled`/`filled` quando uma ordem pendurada era cancelada
  (`CancelOrder`) no meio de uma corrida contra um match concorrente decidido antes do cancelamento
  (`Execute` decide contra `Context.Resting`, lido fora de transação por `LoadContext`; a escrita só
  acontece depois, em `Persist`). Reproduzido manualmente contra Postgres real com duas transações
  concorrentes (uma imitando `CancelOrder`, outra imitando o `UPDATE` de `fillRestingOrder`) — sem a
  correção, a ordem "ressuscitava" com `filled_quantity` movido e saldo/posição reais debitados/
  creditados dos dois lados mesmo depois do dono já ter recebido `204` do cancelamento. Corrigido na
  mesma sessão (bug mecânico, sem decisão de produto envolvida): `fillRestingOrder` ganhou `AND
  status IN ('pending', 'partially_filled')` no `WHERE` + checagem de `RowsAffected()`; `0` linhas
  afetadas devolve `orderexecution.ErrRestingOrderNoLongerAvailable` (erro novo, mapeado pra `422`,
  mesma consequência de `ErrInsufficientPosition` contra a ordem "furada" do achado 005 — aborta a
  transação inteira do submissor, nada fica persistido); `tick.businessRejection` (`rounds.go`)
  também passou a reconhecer esse erro como rejeição de negócio normal, não falha de infraestrutura
  que abortaria o tick inteiro. Testes novos: `TestRunIntradayRounds_RejeicaoDeNegocioDoSubmitNaoAbortaOTick`
  (`rounds_test.go`, tabela ganhou o erro novo) e `TestHandleSubmitOrder_ErrosDeExecucao` (`orders_test.go`,
  idem). `go build`/`go vet`/`go test ./...`/`golangci-lint run` (Docker, `v2.12.2`, 0 issues) verdes
  depois da correção. Reproduzido de novo depois do fix, mesmas duas transações concorrentes: o
  `UPDATE` do fill afeta `0` linhas e a ordem permanece `cancelled`. Detalhe completo em
  `.docs/engine/orders.md`.
- **Achado desta sessão, gap de produto (não corrigido — registrado como 012 em
  `.claude/pontos-em-aberto-decisao-produto.md`):** `POST /market/orders`/`POST /orders` nunca
  devolvem o `order_id` da ordem recém-criada, e não existe nenhuma rota `GET` que liste as ordens do
  usuário. Resultado: `POST /market/orders/:id/cancel` está correto em todas as camadas, mas nenhum
  cliente real tem como descobrir qual `id` passar pra ele — a funcionalidade só foi exercitada nesta
  sessão consultando `order_book` direto no Postgres. Exige decisão de design de API/tela fora do
  escopo descrito em O.1 (ver opções no achado 012).
- **Achado desta sessão, registrado em `.claude/pontos-em-aberto-decisao-produto.md`:** a tarefa
  **O.2** abaixo já estava de fato implementada antes desta sessão, sob outro nome — o achado 005
  (Parte A, sessão 2026-09-19, `OrderExecutionRepository.ExpireStaleOrders`) resolve exatamente o
  que O.2 descreve (expira toda ordem `pending`/`partially_filled` de um dia simulado anterior, no
  fechamento do dia). Marcada ✅ abaixo por isso, sem nenhuma linha de código nova desta sessão — só
  a leitura cruzada entre o achado e esta tarefa, que nunca tinha sido feita.

### O.2 · Expiração automática no fechamento do dia simulado (ordem Day) ✅

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
- **Entregável (achado retroativo, sessão 2026-09-21 — implementação real é da sessão 2026-09-19,
  achado 005 Parte A):** `OrderExecutionRepository.ExpireStaleOrders` (`order_execution_repository.go`),
  chamada por `tick.Service.Run` antes de `runIntradayRounds` de cada dia novo, cancela toda ordem
  `pending`/`partially_filled` com `simulated_day` anterior ao dia que está começando — mesmo
  contrato desta tarefa, escrito sem saber que O.2 existia como tarefa nomeada. `order_book.
  simulated_day` (migration `000017`) é o carimbo de dia que a tarefa previa.
  Nenhum código novo desta sessão — só a atualização deste arquivo pra refletir o que já existia.
- **Nota sobre os critérios de aceite (sessão 2026-09-21, confirmado com o autor):** os 3 critérios
  acima pedem teste table-driven/regressão em código — o que existe de fato é orquestração testada
  (`service_test.go`, pacote `tick`: `Service.Run` chama `ExpireStaleOrders` com o dia certo e
  propaga erro) mais validação ao vivo via `docker compose` na sessão do achado 005 original
  (1.891 ordens obsoletas reais expiradas no primeiro tick pós-deploy, `order_book` estável por
  ~20 ticks sem crescer). **Não existe teste Go contra Postgres real pra `ExpireStaleOrders` em si**
  (nem regressão explícita de "ordem `filled`/de dia posterior não é afetada", nem de "ordem
  expirada nunca reaparece em replay" — essa última garantida estruturalmente por
  `loadRestingOrders` só ler `status IN ('pending','partially_filled')`, verificado por leitura de
  código, não por teste). Auditado nesta sessão: **nenhum repositório de `internal/infra/db` tem
  teste Go contra Postgres real** (`quote_cache_test.go` é o único teste do pacote, 100% em
  memória) — a convenção real e já estabelecida do projeto pra essa camada é validar SQL via
  `docker compose` ao vivo, nunca por teste automatizado. Decisão do autor: **O.2 segue essa mesma
  convenção existente, sem gap novo a registrar** — não abrir tarefa nem entrada em
  `pontos-em-aberto-decisao-produto.md` pra isso.
- **Atualização (tarefa P.5):** a expiração por dia deixou de valer para ordem de Market Maker ativo, cuja cotação
  é "de pé" (ver P.5 e `.docs/engine/orders.md`). Day order continua valendo para todo o resto.

### O.3 · `order_id` na resposta, listagem de ordens e motivo do cancelamento ✅

- **Descrição:** fecha o achado 012 (`pontos-em-aberto-decisao-produto.md`, decisão do autor
  2026-09-21) — hoje `POST /orders`/`POST /market/orders` não devolvem o `id` da ordem recém-criada
  e não existe nenhuma rota `GET` que liste as ordens do usuário, então `POST /orders/{id}/cancel`
  (O.1) não tem nenhum caminho real pelo qual um cliente descubra qual `id` passar.
  1. **`order_id` na resposta de sucesso:** `insertIncomingOrder` (`order_execution_repository.go`)
     ganha `RETURNING id`; `Repository.Persist` muda de assinatura pra devolver o id junto do erro
     (`Persist(ctx, req, outcome) (orderID string, err error)`); `orderexecution.Outcome` ganha
     `OrderID string`, preenchido por `Service.SubmitWithContext` antes de devolver. `POST /orders`
     (`submitOrderResponse`) e `POST /market/orders` (`OrderResult`/`PlaceOrderUseCase`) passam a
     ecoar `order_id`.
  2. **`order_book.cancel_reason` (coluna nova, migration):** enum/texto com 4 valores —
     `user_cancelled` (`CancelOrder`, O.1), `expired` (`ExpireStaleOrders`, O.2), `no_liquidity`
     (branch de `insertIncomingOrder` que já marca ordem `market` sem nenhum fill como `cancelled`
     direto, ver `.docs/engine/orders.md`) e `requoted` (`CancelUserRestingOrders`, achado 005 A.4 —
     só bot `market_maker`, nunca aparece pro usuário real, mas mantém a coluna sempre preenchida
     pra todo `status = cancelled`, sem `NULL` órfão). `NULL` pra qualquer outro status.
  3. **`GET /orders`/`GET /market/orders`:** lista todas as ordens do `user_id` (motor: query param;
     backend: `req.auth.userId`), mais recente primeiro, sem paginação (escopo de protótipo) — `id`,
     `order_id` (mesmo campo, nome consistente com o item 1), `asset_id` (+ ticker/nome via
     `CatalogReader` no backend, mesmo padrão de outras respostas de mercado), `side`, `type`,
     `quantity`, `filled_quantity`, `price`, `status`, `cancel_reason`, `created_at`. Sem filtro de
     status na query — o agrupamento em 3 grupos (Pendentes/Executadas/Recusadas, decisão de produto
     da sessão 2026-09-21) é responsabilidade do frontend (O.4): Pendentes =
     `pending`/`partially_filled`; Executadas = `filled`; Recusadas = `cancelled` (qualquer
     `cancel_reason`, a aba mostra o motivo humanizado por linha, não separa em sub-abas).
- **Critérios de aceite:** teste confirmando que `POST /orders` devolve `order_id` batendo com a
  linha correspondente em `order_book`; teste table-driven cobrindo os 4 caminhos de cancelamento
  gravando o `cancel_reason` esperado; teste de `GET /orders` com lista vazia (usuário sem ordens) e
  lista populada em ordem decrescente de `created_at`; teste de `GET /market/orders` confirmando
  `401` sem token e enriquecimento por `CatalogReader`.
- **Referências:** `order_execution_repository.go` (`Persist`/`insertIncomingOrder`/`CancelOrder`/
  `ExpireStaleOrders`/`CancelUserRestingOrders`); `orders.go`/`server.go` como precedente de rota;
  achado 012 em `pontos-em-aberto-decisao-produto.md` (decisão completa registrada lá, seção
  Resolvidos).
- **Dependências:** O.1, O.2 (ambas concluídas).
- **Entregável (sessão 2026-09-21):** os 3 itens da descrição implementados como desenhado. Motor:
  `orderexecution.Outcome.OrderID`/`OrderRecord`/`CancelReason` (4 constantes) novos;
  `Repository.Persist` muda de assinatura pra `(orderID string, err error)`
  (`insertIncomingOrder` ganha `RETURNING id`); `Repository.ListOrders(ctx, userID)` novo, exposto
  em `Service.ListOrders` e na interface `orderSubmitter` do `httpserver` (mesmo
  `*orderexecution.Service` que já implementa `Submit`/`Cancel`, sem parâmetro novo em `New`/`Run`).
  `cancel_reason` gravado nos 4 pontos do achado 012: `CancelOrder` → `user_cancelled`,
  `ExpireStaleOrders` → `expired`, `insertIncomingOrder` (branch de ordem `market` sem fill) →
  `no_liquidity`, `CancelUserRestingOrders` → `requoted`. Migration `000022`
  (`order_cancel_reason` enum + coluna nullable em `order_book`). Rota nova `GET /orders?user_id=`
  (`handleListOrders`), `POST /orders` (`submitOrderResponse`) ganhou `order_id`. Backend:
  `EngineOrderRecord`/`OrderExecutor.list` no port; `ListMyOrdersUseCase` (novo) enriquece
  `asset_id` cru do motor com `ticker`/`name` via `CatalogReader.getAsset`, deduplicado por
  `asset_id` (evita 1 chamada ao motor por ordem repetida do mesmo ativo) — mesmo padrão de
  `assertProductUnlocked` já usar `getAsset` por id. Rota nova `GET /market/orders`
  (`user_id` sempre `req.auth.userId`, nunca aceito de query/corpo do cliente); `OrderResult`
  (`PlaceOrderUseCase`) ganhou `order_id`. Testes novos em todas as camadas (Go:
  `service_test.go` — `OrderID`/`ListOrders`; `orders_test.go` — `handleListOrders`, `order_id` na
  resposta de `POST /orders`; Node: `listMyOrders.test.ts`, `engineOrderExecutor.test.ts` —
  `list()`, `marketRouter.test.ts` — `GET /market/orders`, mais os call-sites existentes de
  `OrderResult` ajustados pro campo novo obrigatório). `go build`/`go vet`/`go test ./...`/
  `golangci-lint run` (Docker, `v2.12.2`, 0 issues) e `npm run build`/`npm run lint`/`npx vitest run`
  (599 testes) verdes. `.docs/engine/orders.md`/`.docs/backend/market.md` atualizados.
  **Nota sobre os critérios de aceite (mesma decisão da O.2, mesma sessão):** o critério "teste
  table-driven cobrindo os 4 caminhos de cancelamento gravando o `cancel_reason` esperado" pede
  teste automatizado contra Postgres real pra lógica que vive inteira em `order_execution_repository.go`
  (`internal/infra/db`) — camada que, por decisão já confirmada com o autor na O.2 desta mesma
  sessão, segue a convenção existente do projeto (validação via `docker compose` ao vivo, nunca
  teste automatizado contra Postgres real). Aplicada a mesma convenção aqui, sem gap novo a
  registrar. Validado ao vivo via `docker compose up -d --build`: usuário real registrado, ordem
  `market` sandbox (`SAND3`) executada (`order_id` no `201`, sem `cancel_reason` no `GET
  /market/orders`, `status = filled`), ordem `limit` sem contraparte deixada pendurada e cancelada
  via `POST /market/orders/:id/cancel` (`cancel_reason = user_cancelled` confirmado tanto no
  Postgres quanto no `GET /market/orders`, mais recente primeiro), `GET /market/orders` sem token
  devolveu `401`, `GET /orders` do motor sem `user_id` devolveu `400`. Caminhos `no_liquidity`/
  `expired`/`requoted` não reproduzidos ao vivo nesta sessão (`no_liquidity` exigiria um ativo real
  sem nenhuma liquidez de bot no momento do teste, não garantido com os bots já ativos no ambiente;
  `expired`/`requoted` exigiriam avançar dia simulado/rodar Market Maker) — cobertos por leitura de
  código (mesmo `switch`/`UPDATE` já testado indiretamente pelas Fases D/O.1/O.2) e pelos testes de
  unidade acima. Containers parados ao final (`docker compose stop`, sem `-v`).

### O.4 · Tela "Minhas Ordens" no frontend ✅

- **Descrição:** tela nova (candidato natural de entrada: ícone/link a partir do hub de Mercado,
  mesmo padrão de ponto de entrada da M.4) com 3 abas — **Pendentes**, **Executadas**, **Recusadas**
  — consumindo `GET /market/orders` (O.3) e agrupando client-side pelo critério decidido na sessão
  2026-09-21 (ver O.3, item 3). Cada linha mostra ativo (ticker/nome), lado (compra/venda), tipo,
  quantidade (preenchida/total quando parcial) e preço; só na aba Recusadas, o motivo humanizado a
  partir de `cancel_reason` (`user_cancelled` → "Cancelada por você"; `expired` → "Expirada no
  fechamento do dia"; `no_liquidity` → "Sem liquidez disponível"; `requoted` nunca aparece pra
  usuário real). Aba Pendentes ganha um botão "Cancelar" por linha, chamando
  `POST /market/orders/:id/cancel` (O.1) com confirmação antes de disparar (ação irreversível) e
  refetch da lista após sucesso. Responsiva nos três breakpoints (regra obrigatória do `CLAUDE.md`);
  desktop ganha composição própria, não coluna única esticada. Envolve um padrão de lista com abas
  ainda não estabelecido em `identidade-visual-padroes.md` — vale um rascunho de layout antes da
  implementação, mesmo critério das telas âncora do backlog principal. Atualizar
  `.claude/inventario-telas-plataforma-investimentos.md` com a tela nova (objetivo, conteúdo, ações,
  navegação, dados envolvidos).
- **Critérios de aceite:** tela renderiza dado real de `GET /market/orders` (não mockado); as 3
  abas agrupam corretamente por `status`; botão "Cancelar" da aba Pendentes chama O.1 de verdade e
  reflete o resultado (linha sai de Pendentes, entra em Recusadas com motivo "Cancelada por você");
  motivo humanizado correto nas 3 outras causas de `cancel_reason`; validada nos três breakpoints.
- **Referências:** `.claude/identidade-visual-padroes.md`, `.claude/identidade-visual-tokens.md`;
  `.claude/inventario-telas-plataforma-investimentos.md`.
- **Dependências:** O.3.
- **Entregável (sessão 2026-09-21):** ponto de entrada decidido — 4º card "Minhas Ordens" no hub de
  Mercado (`pages/Market`, mesmo padrão de entrada da M.4), grid do hub passou de 3 pra 4 colunas no
  desktop (`Market/index.module.css`, `repeat(4, 1fr)` em `min-width: 1024px` — nenhum card órfão
  sobrando numa linha final). Tela nova `pages/MinhasOrdens` (4.10 no inventário, rota
  `/mercado/ordens`, irmã de `/mercado/*`, sem `RequiresUnlock` — mesmo tratamento de 4.9, histórico
  da própria conta não é produto travado pela trilha). Serviço: `listMyOrders`/`cancelOrder`
  (`services/market`, `GET`/`POST /market/orders...`), `PlaceOrderResult` ganhou `order_id` (campo
  que já existia no motor/backend desde a O.3 mas nunca tinha chegado ao tipo do frontend) e
  `MyOrderRecord` novo espelhando a resposta de `GET /market/orders`. `features/market/
  useMyOrdersQuery`/`useCancelOrderMutation` (o segundo só invalida a própria lista de ordens, não
  conta/extrato — cancelar não mexe em `accounts`/`positions`, `.docs/engine/orders.md`). Organism
  novo `OrdersList` — mesma tela-tipo "lista com abas" de `pages/EquityList`/`pages/FixedIncomeList`
  (nunca documentada até agora, fechada nesta sessão em `identidade-visual-padroes.md` §4c), com a
  mesma dupla tabela (≥1024px)/cards empilhados de `AssetTable`, mas **sem reaproveitar
  `AssetTable`**: a linha aqui não navega (sem `onSelect`) e a aba Pendentes precisa de um botão de
  ação por linha ("Cancelar ordem"), que o card-como-`<button>` de `AssetTable` não comporta (elemento
  interativo aninhado) — decisão registrada em §4c como regra geral pra qualquer lista futura com
  ação por item. Agrupamento client-side (decisão da O.3): Pendentes = `pending`/`partially_filled`
  (quantidade mostra `filled_quantity/quantity` só quando parcial), Executadas = `filled`, Recusadas
  = `cancelled` (motivo humanizado por `cancel_reason`, `requoted` mapeado mas nunca alcançável por
  usuário real). Cancelamento segue a mesma confirmação leve em duas etapas de "Desfazer amizade"
  (`FriendsList`, tarefa 6.9.3) — sem `window.confirm` nativo. `npx tsc -b`/`npm run lint`
  (oxlint, 0 issues novos)/`npx vitest run` (695 testes)/`npx prettier --check`/`npm run build`
  verdes. `.claude/inventario-telas-plataforma-investimentos.md` (4.10 nova + 4.1 atualizada pro 4º
  card) e `.claude/identidade-visual-padroes.md` (§4c nova) atualizados — sem alteração em `.docs/`,
  nenhuma rota HTTP nova ou mudou nesta tarefa (O.3 já documentou `GET`/`POST /market/orders...`).
  Validado ponta a ponta via `docker compose up -d --build postgres redis engine backend gateway`
  (worktree própria) + `vite` local apontando pro gateway containerizado: usuário real registrado
  (`POST /auth/register`), ordem `limit` em ativo sandbox (`SAND3`) deixada pendurada de propósito
  (sem contraparte de bot em sandbox) + ordem `market` no mesmo ativo (preenchimento sintético
  imediato) via chamada direta ao gateway — tela acessada via Chrome (login por `localStorage`
  direto, mesmo mecanismo de `AuthContext`, mesmo precedente da M.4) mostrou a ordem `limit` em
  Pendentes (`Limitada`, `5`, `R$ 10,00`) e a ordem `market` em Executadas (`Mercado`, `3`,
  `R$ 100,00`); clique em "Cancelar ordem" → confirmação em duas etapas (`Voltar`/`Confirmar
  cancelamento`) → `POST /market/orders/:id/cancel` real → aba Pendentes esvaziou, aba Recusadas
  passou a mostrar a ordem com motivo "Cancelada por você", confirmando o refetch automático.
  Breakpoint desktop (1920px) confirmado interativamente (grid 4 colunas no hub, tabela na tela de
  ordens). **Breakpoints mobile/tablet não confirmados visualmente nesta sessão** — o ambiente de
  automação de browser disponível não conseguiu redimensionar a janela real (`resize_window`
  reportou sucesso mas `window.innerWidth` seguiu preso à resolução do display virtual, 1920px, em
  duas tentativas incluindo aba nova) — verificado por alternativa: a dupla marcação tabela/cards
  (técnica idêntica, já validada ao vivo em telas anteriores como 4.2/4.4/4.9) está de fato no DOM
  com o conteúdo correto (`getComputedStyle` confirmou `display: table` ativo e `display: none` no
  container de cards na largura atual — exatamente a regra do `@media (min-width: 1024px)`), e a
  mesma regra de mídia (`1024px`) é copiada literalmente de `AssetTable`, já confirmada ao vivo em
  420px/834px por sessões anteriores (M.4). Sem regressão esperada, mas não é a mesma barra de
  confirmação ao vivo das demais tarefas — registrar se uma sessão futura tiver acesso a
  redimensionamento de janela real. Stack parada com `docker compose stop` (sem `-v`) ao final.
- **Teste de ponta a ponta e correção de bug (sessão 2026-09-21, mesmo dia, revisão da Fase O
  inteira):** achado ao vivo — a coluna Quantidade da aba Recusadas usava `order.status ===
  'partially_filled'` pra decidir entre mostrar `preenchida/total` ou só `total`
  (`formatQuantity`, `OrdersList/index.tsx`). Depois de um cancelamento manual (O.1) de uma ordem
  que já tinha preenchimento parcial, `status` vira `cancelled` (nunca mais `partially_filled`) —
  então a linha em Recusadas mostrava só a quantidade original (ex: `6`), escondendo que parte dela
  (ex: `2`) já tinha executado de verdade (saldo/posição já debitados/creditados do usuário, O.1 não
  reverte `filled_quantity`) antes do cancelamento. Reproduzido ao vivo via `docker compose up`:
  usuário real vendeu 6 unidades de `SAND3` (limite), outro usuário comprou 2 (fill parcial
  confirmado em `positions`/`accounts` dos dois lados), dono cancelou o restante — a aba Recusadas
  mostrava `6`, não `2/6`, pro fill que realmente aconteceu. Corrigido na mesma sessão (bug
  mecânico de UI, sem decisão de produto envolvida): `formatQuantity` passou a checar
  `filled_quantity > 0 && filled_quantity < quantity` diretamente, em vez do `status` — mostra
  `preenchida/total` em qualquer status (`partially_filled` ou `cancelled` com fill parcial), só
  `total` quando não há fill nenhum ou a ordem preencheu por completo. Teste novo:
  `'aba Recusadas mostra preenchida/total quando a ordem cancelada tinha fill parcial'`
  (`OrdersList/index.test.tsx`). Demais fluxos de O.1–O.4 confirmados ao vivo na mesma sessão sem
  achado novo: `404`/`409`/`400`/`401` de `POST /market/orders/:id/cancel` (id de terceiro, id
  inexistente, já cancelada, uuid malformado, sem token), `no_liquidity` reproduzido de verdade
  (`GET /market/orders` mostrando `cancel_reason: no_liquidity`, `price: 0`), expiração Day
  confirmada em dois ticks consecutivos (ordem criada no dia N sobrevive ao tick que fecha o dia N —
  correto, ainda participa das rodadas desse dia — e só expira no tick que fecha o dia N+1), saldo/
  posição íntegros depois do cancelamento parcial (conferido direto no Postgres). `npx tsc -b`/
  `npm run lint` (oxlint, 0 issues novos)/`npx vitest run` (696 testes)/`npx prettier --check`/
  `npm run build` verdes; `go build`/`go test ./...` e `npm run build`/`npx vitest run` (599 testes)
  do backend confirmados verdes antes do teste ao vivo, sem alteração nessas duas camadas nesta
  sessão. Stack parada com `docker compose stop` (sem `-v`) ao final.

---

## Fase P — Cobertura contínua de Market Maker escalável

Lacuna achada no teste de ponta a ponta da correção do achado 009 (2026-09-23), registrada como achado
013 de `pontos-em-aberto-decisao-produto.md`: a venda a mercado logo após uma compra não preenche, porque
o book de um ativo termina o dia sem ordens de compra. Causa raiz medida: um único Market Maker sorteia
**um** ativo por rodada e a expiração diária (O.2) apaga a cotação, então cada ativo só fica cotado em
parte dos dias. Desenho completo, medições, orçamento e decisões fechadas em
`.claude/proposta-cobertura-market-maker.md` (**leia antes de pegar qualquer tarefa desta fase**, as
seções citadas abaixo são dele). Diretriz do autor que rege a fase: a solução precisa escalar com o
catálogo e com o número de bots, nunca ser dimensionada só pelos 5 ativos do seed de hoje.

Independente das outras fases. Depende de A.4 (`is_active`), C.6 (Market Maker), D.2 (rodadas), O.2
(expiração) e do PR do achado 009 (`tick.MinOrderPctOfFloat`). Cada tarefa é escopo de uma sessão, com
teste no mesmo commit, `golangci-lint` e `go test ./...` verdes, docs em `.docs/engine/` e validação por
`docker compose up`, como manda o checklist do CLAUDE.md para o `engine/`.

### P.1 · Modelo de dados e domínio da cobertura ✅
- **Descrição:** migration `000023` com a tabela `market_maker_coverage (asset_id, mm_account_id,
  created_at)` (chave primária composta) e a coluna `bot_personalities.max_covered_assets` (padrão 10,
  nulo para arquétipos que não são Market Maker); pacote de domínio novo sem I/O com o tipo de cobertura
  e a função pura `Assign` (Market Maker ativo com menos ativos cobertos entre os que têm folga, desempate
  por ID); repositório em `internal/infra/db/`, interface pequena declarada no ponto de consumo.
- **Critérios de aceite:** `Assign` em teste de tabela (folga, empate, nenhum com folga, Market Maker
  inativo ignorado); migration aplica e reverte.
- **Referências:** proposta seções 3.1 a 3.3.
- **Entregável (sessão 2026-09-23):** migration `000023` (tabela `market_maker_coverage` com PK composta e
  índice por Market Maker; `bot_personalities.max_covered_assets` com backfill 10 no Market Maker existente
  e CHECK que espelha o domínio: obrigatório e positivo só no `market_maker`). Pacote novo
  `internal/domain/coverage`: `MarketMaker`, `Assign(assetID, mms)` (menos carregado com folga, desempate
  por `AccountID`, ignora inativo e quem já cobre o ativo; `ok=false` = precisa criar Market Maker) e as
  interfaces `MarketMakerLister`/`Writer`, declaradas no ponto de consumo. `bot.Personality` ganhou
  `MaxCoveredAssets *int` (`DefaultMaxCoveredAssets = 10` no Market Maker, `WithMaxCoveredAssets` valida
  positivo e arquétipo), lido/gravado por `BotRepository`. `CoverageRepository` (`ListMarketMakers` em uma
  consulta, `AddCoverage` idempotente). Decisões de sessão: `Assign` recebe o `assetID` para não reatribuir
  quem já cobre o ativo (a redundância do modelo continua possível); `AddCoverage` devolve
  `ErrNotMarketMaker` para conta que não é Market Maker, porque o teste ao vivo mostrou que só o FK deixava
  um bot `ruido` entrar na tabela. Validado no Postgres do compose: migration aplicada, `down`+`up` em
  transação, CHECKs rejeitando teto em bot não-Market Maker e teto 0, e o repositório real exercitado por
  teste temporário (não commitado, convenção da camada). Sem rota HTTP alterada, então sem `.docs/`.
  `golangci-lint`, `go build` e `go test ./...` passam.

### P.2 · Provisionamento reutilizável (`EnsureCoverage`) e migração do seed ✅
- **Descrição:** caso de uso `EnsureCoverage` (atribui, cria Market Maker novo quando nenhum tem folga,
  provisiona caixa e posição proporcionais ao float por Event Sourcing); o seed passa a chamá-lo no lugar
  do laço atual e de `marketMakerBotUserID`; backfill de banco existente com o Market Maker único, sem
  criar conta nem mexer em saldo.
- **Critérios de aceite:** seed idempotente (duas execuções não duplicam nada); catálogo com mais ativos
  que o teto cria Market Makers adicionais e cada ativo fica com exatamente um.
- **Referências:** proposta seção 3.4. **Dependências:** P.1.
- **Entregável (sessão 2026-09-23):** `coverage.Ensurer.EnsureCoverage` (`internal/domain/coverage/ensure.go`):
  se algum Market Maker já cobre o ativo, não faz nada; senão `Assign`, e sem folga cria um Market Maker
  novo (`NewMarketMakerID`: o primeiro mantém o ID `...0001` do seed antigo, os seguintes são
  `00000000-0000-0000-0001-<n>`, determinísticos porque o ID entra na semente das rodadas, RNF08) com
  `bot.DefaultMarketMakerPersonality()` (perfil que estava no seed). Caixa provisionado é `bot.InitialCash`
  (2x o valor da posição). Colaboradores pequenos no ponto de consumo (`MarketMakerLister`, `Provisioner`).
  Adapter `CoverageRepository`: `CreateMarketMaker` (conta com saldo zero mais personalidade, cada passo
  idempotente) e `ProvisionCoverage` (uma transação: cobertura, posição, teto de float, evento
  `bot_initial_allocation`, evento `bot_initial_cash` com `asset_id` preenchido e soma ao saldo; se o
  Market Maker já tinha posição no ativo, grava só a cobertura). O seed deixou de ter
  `marketMakerBotUserID` e o bloco do Market Maker em `seedBotPersonalities`; `seedBotLiquidity` chama
  `EnsureCoverage` por ativo com `allocation.MarketMaker`. Migration `000024` faz o backfill (cobertura de
  todo ativo Ação/FII não sandbox em que um Market Maker já tem posição). Decisões de sessão: (1) ativo
  coberto só por Market Maker **inativo** não é reprovisionado, porque reatribuir é do painel (Fase N,
  proposta 3.9) e um segundo float estouraria o teto; (2) o `Writer`/`AddCoverage` da P.1 foi trocado por
  `Provisioner`/`ProvisionCoverage`, que carrega a guarda `ErrNotMarketMaker`. Validado ao vivo: banco de
  dev legado (migration 24 criou 5 coberturas, seed reexecutado deixou contas, posições, eventos e saldos
  idênticos); banco novo (seed do zero, caixa do Market Maker = 2x posição, R$ 110,2 bi, 5 coberturas);
  12 ativos sintéticos com `EnsureCoverage` duas vezes cada (17 ativos em 2 Market Makers, 10 e 7, cada
  ativo exatamente 1 vez, reexecução sem efeito). Testes temporários não commitados (convenção da camada).
  `golangci-lint`, `go build`, `go test ./...` passam. Sem rota HTTP alterada.

### P.3 · Rodada: Market Maker cota todos os ativos que cobre ✅
- **Descrição:** `runIntradayRounds` deixa de passar o Market Maker por `SelectAssetForRound` e o faz
  cotar toda a sua cobertura em cada rodada, em ordem por ID; os outros três arquétipos ficam
  intocados; `BotRoster` devolve os ativos cobertos; contagem de ativos sem cobertura ativa no log e em
  `POST /admin/tick`.
- **Critérios de aceite:** teste de rodada com N ativos cobertos cota os N em toda rodada; ativo fora do
  universo negociável é ignorado; determinismo preservado.
- **Referências:** proposta seções 3.5 e 3.9. **Dependências:** P.1, P.2.
- **Entregável (sessão 2026-09-23):** `runIntradayRounds` foi decomposto em `assetsForBot` (Market Maker: cobertura
  ordenada por ID e filtrada pelo universo negociável; demais: sorteio como antes), `runBotOnAsset` (o corpo por
  bot e ativo, sem mudança de comportamento) e `countUncoveredAssets`, com o estado compartilhado em `roundRun`.
  `runIntradayRounds` devolve um 5º valor (ativos sem cobertura), propagado para `Result.UncoveredAssetsCount`,
  log do tick e `uncovered_assets_count` em `POST /admin/tick`. `BotForRound.CoveredAssetIDs` é preenchido por
  `BotRepository.ListEligibleForTradingRound` com uma consulta para todo o roster (sem N+1). Testes novos:
  cotar todos os N cobertos em toda rodada (cobertura fora de ordem), ativo fora do universo ignorado, contagem
  de descobertos (Market Maker inativo não conta, bot não Market Maker ignora `CoveredAssetIDs`), determinismo;
  os testes de Market Maker existentes ganharam cobertura na fixture. `golangci-lint`, `go build`,
  `go test ./...` passam; documentado em `.docs/engine/tick.md`. Validado ao vivo em `docker compose` (3 ticks,
  `uncovered_assets_count: 0`, Market Maker com ordens nos 5 ativos ao fim do tick). **Achado para a P.4/P.8:**
  compra e venda a mercado de 100 unidades logo após um tick preencheram em 4 dos 5 ativos; o `PAPL11` falhou
  na venda porque a compra do Market Maker (2.000) foi consumida por bots direcionais **depois** da última
  cotação do dia, já que o Market Maker é o primeiro do roster (`UserID` `...0001`) em toda rodada. A cobertura
  por rodada não elimina esse caso. Duas saídas a avaliar na P.4: uma passada final de recotação do Market
  Maker depois da última rodada (custo `ativos x ~26` statements, cabe no orçamento se a P.4 recotar só o lado
  consumido) ou processar o Market Maker por último na rodada.

### P.4 · Manutenção de cotação ✅
- **Descrição:** função pura `NeedsRequote` (cotação boa = compra e venda em repouso dentro da tolerância
  do preço de referência, com quantidade restante acima do mínimo); leitura em lote das ordens em repouso
  por Market Maker; recotar só o lado consumido, vencido ou fora da tolerância, no lugar do "cancelar tudo".
- **Critérios de aceite:** cotação boa não gera cancelamento nem submissão; lado consumido é recotado;
  regime estável dentro do orçamento (média de até 12 comandos SQL por ativo-rodada, seção 6.1).
- **Referências:** proposta seção 3.6. **Dependências:** P.3.
- **Entregável (sessão 2026-09-23):** `bot.NeedsRequote` (pura, lado a lado: sem ordem, fora da tolerância ou
  quantidade restante abaixo do mínimo), `bot.MarketMakerQuotePrices` (os preços ideais, reaproveitados por
  `DecideMarketMakerOrders`), `bot.EffectiveQuoteTolerance` (0,5%, limitada a 1/4 do spread para o lado
  mantido nunca cruzar o ideal do outro e o Market Maker não negociar contra si mesmo) e `bot.MinQuoteQuantity`.
  `OrderLifecycleManager` trocou `CancelUserRestingOrders` por `ListRestingOrders` (uma consulta por
  Market Maker e rodada, `= ANY`) e `CancelRestingOrders` (por ID, `cancel_reason = 'requoted'`).
  `runIntradayRounds` chama `maintainMarketMakerQuotes` por Market Maker e rodada e faz uma **passada final**
  depois da última rodada (fecha o caso do `PAPL11` do achado da P.3). `AssetForPricing.OutstandingShares`
  alimenta o mínimo sem leitura extra por ativo. **Medição (A/B em bancos clonados do mesmo estado, 25 ativos,
  código do PR 1 contra o novo, 7 ticks com mais de uma rodada):** 13.558 contra 9.092 comandos SQL, **-33%**.
  Com só os 5 ativos reais quase todo ativo é negociado em toda rodada e a redução some (o +5% do A/B de 5
  ativos vem da passada final), o que confirma a diretriz de validar em catálogo maior. **Erro achado só
  por essa medição:** o mínimo inicial era o piso inteiro do teto de ordem (0,4% do float), mas a cotação usa
  metade dele, então uma cotação recém-criada já nascia "vencida" e era refeita toda rodada; corrigido com
  `MinQuoteQuantity` (teste de regressão incluso). **Pendente para a P.5/P.6:** o regime estável de 12
  comandos por ativo-rodada só é alcançável com a P.5, porque enquanto a cotação expira por dia o primeiro
  turno do dia recota tudo (dia de 1 rodada custou +82 no A/B); e a "quantidade mínima por lado = piso do float"
  da P.6 conflita com a cotação de metade do teto, então a P.6 precisa decidir qual dos dois muda.
  `golangci-lint`, `go build`, `go test ./...` passam; documentado em `.docs/engine/orders.md` e `tick.md`.

### P.5 · Cotação de Market Maker não expira por dia ✅
- **Descrição:** `ExpireStaleOrders` deixa de cancelar ordens do arquétipo Market Maker; a recotação as
  substitui com o `cancel_reason` já existente. Exceção documentada à regra de ordem Day (O.2).
- **Critérios de aceite:** a cotação atravessa a virada de dia; ordem de qualquer outro bot continua
  expirando; exceção documentada em `.docs/engine/orders.md`, `.docs/engine/tick.md` e na O.2.
- **Referências:** proposta seção 3.7. **Dependências:** P.4 (a manutenção é o que impede acúmulo de
  cotação velha).
- **Entregável (sessão 2026-09-23):** `OrderExecutionRepository.ExpireStaleOrders` ganhou
  `AND NOT EXISTS (Market Maker ativo dono da ordem)`. Decisão de sessão: só Market Maker **ativo** tem a
  exceção, então desativar um bot tira a cotação dele do book no tick seguinte sem ninguém cancelar à mão
  (a proposta dizia "quando o bot é desativado" sem dizer quem cancela, e não existe caminho de desativação
  no repositório ainda). Validado ao vivo: cotações de Market Maker com 1 a 3 dias de idade em repouso, no
  máximo 1 ordem por (ativo, lado), todos os cancelamentos do Market Maker em 8 dias com motivo `requoted`
  (nenhum `expired`); Market Maker desativado: cotações expiram no tick seguinte e `uncovered_assets_count`
  sobe para 5; **cenário do achado 013 (compra e venda de 100 a mercado logo após o tick) preenche nos 5
  ativos**, incluindo o `PAPL11` que falhava depois da P.3. Documentado em `.docs/engine/orders.md`,
  `tick.md` e na O.2 (abaixo). **Ponto em aberto para a Fase N:** ordem de Market Maker de um ativo que ele
  deixou de cobrir (reatribuição) fica no book até o painel cancelá-la; a reatribuição precisa incluir
  esse cancelamento.

### P.6 · Obrigações do formador (fecha o achado 002) ✅
- **Descrição:** teto de spread de 0,10 validado em `NewRiskProfile` (valor ilustrativo, seção 3.8) e
  quantidade mínima por lado ligada a `MinOrderPctOfFloat`, para uma cotação simbólica não contar como
  cobertura.
- **Critérios de aceite:** `NewRiskProfile` rejeita spread acima do teto; cotação abaixo do mínimo não
  conta como cobertura.
- **Referências:** proposta seção 3.8. **Dependências:** P.1.
- **Entregável (sessão 2026-09-23):** `bot.MaxSpreadWidthPct = 0.10` validado em `NewRiskProfile`
  (`ErrSpreadWidthAboveMax`); achado 002 movido para Resolvidos. `DecideMarketMakerOrders` ganhou o parâmetro
  `minQuantity` (`DecisionInput.MinQuoteQuantity`, preenchido pelo motor com `minOrderSizeCeiling`, o piso de
  `MinOrderPctOfFloat` = 0,4% do float): a cotação de cada lado é `max(fração do que cabe, piso)` e o lado
  que não chega ao piso **não é cotado**, em vez de uma cotação simbólica que pareceria cobrir o ativo.
  **Resolve o conflito anotado na P.4:** o mínimo da manutenção de cotação passou a ser o próprio piso
  (`bot.MinQuoteQuantity` removida), e uma cotação recém-criada nunca nasce abaixo dele (teste de regressão
  do erro da P.4). Validado ao vivo: as cotações do Market Maker nos 5 ativos ficam no piso (compras) ou acima
  (vendas). Efeito colateral aceito: um Market Maker que não consegue comprar o piso fica sem o lado da
  compra (custo de um turno de leitura por rodada, igual ao comportamento antigo), o que aparece como esgotamento
  na P.8. Testes de spread nos 3 pontos (`0.1`, `0.1001`, `1.999999`) e do piso por lado.
  `golangci-lint`, `go build`, `go test ./...` passam.

### P.7 · Catálogo sintético e benchmark ✅
- **Descrição:** opção `--synthetic-assets N` no seed, restrita ao stack de teste; script de medição
  (comandos SQL por tick e por ativo-rodada do Market Maker via log do Postgres, tempo do tick, cobertura,
  caixa e posição por Market Maker, volume por ativo).
- **Critérios de aceite:** execução de 60 dias com 30 e 50 ativos, resultados registrados na proposta e
  comparados ao orçamento da seção 6.1.
- **Referências:** proposta seções 6 e 6.1. **Dependências:** P.2.
- **Entregável (sessão 2026-09-23):** `seed --synthetic-assets N` (`cmd/seed/synthetic.go`): N ações sintéticas
  determinísticas (empresa própria, 6 setores em rodízio, perfil de risco alternado, float de 50 milhões a 1,5
  bilhão), com fundamentos iniciais e liquidez de bot pelo mesmo `seedBotLiquidity`/`EnsureCoverage`; exige
  `SEED_ALLOW_SYNTHETIC=true` (nunca entra no seed de desenvolvimento). `engine/scripts/benchmark-cobertura.sh`
  cria um banco isolado, roda os ticks e mede comandos SQL por tick (log do Postgres), tempo, cobertura, caixa e
  posição dos Market Makers, volume por ativo e o cenário do achado 013. `POST /admin/tick` ganhou
  `intraday_rounds_count` (só observabilidade, para o custo por ativo-rodada). **Resultado (60 dias, 30 e 50
  sintéticos): dentro do orçamento da 6.1 em tudo** (máximo de 3.350 comandos por tick com 55 ativos contra 3.500;
  custo por ativo-rodada 2,4 de média e 18 no pior caso contra 12 e 30; 55 de 55 ativos cotados nos dois lados; nenhum
  Market Maker esgotado); tabela completa em `proposta-cobertura-market-maker.md` seção 6.2. **Achado para a P.8:** o
  volume diário médio ficou em 0,06 a 0,08% do float, abaixo da faixa de 0,3 a 0,7%, porque o pool de bots
  direcionais é fixo (19) e cada um negocia 1 ativo por rodada. O custo por ativo-rodada é estimativa (linha de base
  de 800 comandos), e o tempo usa o banco local (~0,2 ms por comando).

### P.8 · Validação ponta a ponta e ajuste de calibração ✅
- **Descrição:** repetir os cenários da proposta (compra e venda de 100 ações a mercado em vários ativos
  no fim do dia 60, cinco eventos severos no mesmo setor, desativação de um Market Maker no meio da
  execução) contra o catálogo sintético e contra o seed real; reconferir o volume contra
  `calibracao-liquidez-bots.md` e ajustar `MinOrderPctOfFloat` se sair da faixa de 0,3% a 0,7% do float
  por dia; confirmar que contas `is_bot` ficam fora do ranking e do perfil público (RNF09).
- **Critérios de aceite:** compra e venda de 100 ações preenchem nos ativos cobertos (fecha o achado 013);
  o teste de eventos macro ainda reage; nenhum Market Maker esgotado no fim dos 60 dias; tick dentro do
  orçamento da seção 6.1.
- **Dependências:** P.3, P.4, P.5, P.6, P.7.
- **Entregável (sessão 2026-09-23):** validação contra o seed real (5 ativos) e catálogos sintéticos de 15, 35 e 55 ativos,
  60 dias cada (`engine/scripts/benchmark-cobertura.sh`). **Achado 013 fechado:** compra e venda a mercado preenchem em
  todos os ativos testados (6 de 6 no seed real, 20 de 20 nos demais). **Eventos macro ainda reagem:** cinco eventos
  severos negativos no setor de Mineração fizeram `VALR3` cair de 104,06 para 96,02 (-7,7%) em 4 dias, com recuperação
  quando os eventos expiram, e o setor Bancário (`BNDD3`) não foi afetado. **Desativação do Market Maker:** com o
  Market Maker de 10 ativos inativo, o tick não falha, `uncovered_assets_count` = 10 e a cobertura volta a 15 de 15 no
  tick seguinte à reativação. **Nenhum Market Maker esgotado** (menor posição 321.443, contra 500.000 iniciais no ativo
  mais raso). **Tick dentro do orçamento da 6.1** (máximo de 3.350 comandos com 55 ativos). **RNF09:** contas `is_bot`
  ficam fora de ranking, busca de amigos e perfil público por construção (o ranking e o diretório leem só `users`, e os
  Market Makers criados pela P.2 também não têm linha lá). **Calibração de volume:** com o seed real o volume médio é
  0,45% do float por dia (faixa 0,3 a 0,7), então `MinOrderPctOfFloat` **não foi alterado**. **Achado novo (achado 014
  em `pontos-em-aberto-decisao-produto.md`):** o volume por ativo cai com o tamanho do catálogo (0,20% com 15 ativos,
  0,08% com 35) porque o pool de bots é fixo; a constante não é a alavanca certa, e escalar o pool custa comandos SQL de
  forma linear, então depende de uma decisão do autor sobre o volume-alvo por ativo. Não bloqueia a Fase P.

### P.9 · Integração com a Fase N (só documentação) ✅
- **Descrição:** atualizar N.1 e N.2 para listar a cobertura por Market Maker, os ativos sem cobertura
  ativa, a reatribuição e o ajuste de `max_covered_assets` pelo painel. Sem código novo.
- **Critérios de aceite:** as descrições de N.1/N.2 citam o modelo de cobertura.
- **Entregável (sessão 2026-09-23):** N.1 e N.2 agora citam a cobertura por Market Maker, o teto `max_covered_assets`,
  os ativos sem cobertura ativa e a reatribuição (com o cancelamento das ordens do Market Maker no ativo que ele deixa e
  o uso de `coverage.Ensurer`/`Assign`).

### P.10 · Deadline do disparo manual do tick ✅
- **Descrição:** `POST /admin/tick` herda o `WriteTimeout` de 5 s do servidor do motor
  (`httpserver/server.go`) e roda o tick de forma síncrona; com ~2 ms por comando de banco o disparo manual
  estoura os 5 s com pouco mais de 20 ativos cotados. Levantar o deadline só nessa rota
  (`http.ResponseController.SetWriteDeadline`); o tick automático diário não tem o limite.
- **Critérios de aceite:** com o catálogo sintético de 50 ativos, o disparo manual retorna `200` com o
  resultado completo, sem timeout do servidor; documentado em `.docs/engine/tick.md`.
- **Referências:** proposta seção 6.1. **Independente**, pode abrir a fase.
- **Entregável (sessão 2026-09-23):** `handleAdminTick` (`httpserver/admin.go`) chama
  `extendWriteDeadline(w, adminTickWriteTimeout)` antes de rodar o tick: prazo de escrita de 2 minutos só
  nessa requisição (`http.ResponseController.SetWriteDeadline`); `http.ErrNotSupported` é ignorado (o
  `httptest.Recorder` não tem prazo). Teste `TestHandleAdminTick_SobreviveAoWriteTimeoutDoServidor` sobe um
  servidor real com `WriteTimeout` de 100 ms e um ticker de 300 ms; confirmado que falha com `EOF` sem a
  correção. `golangci-lint` (0 issues), `go build` e `go test ./...` passam; `POST /admin/tick` validado
  em `docker compose` (200). Documentado em `.docs/engine/tick.md`. **Pendente:** o critério "catálogo
  sintético de 50 ativos" só pode ser medido quando a P.7 existir; o mecanismo já está coberto pelo teste
  com timeout reduzido, então recheque esse ponto na P.8. Se o tick passar de 2 minutos, a saída
  documentada na proposta é o disparo assíncrono (`202`).

## Fase Q — Liquidez dos bots que escala com o catálogo

**Origem:** achado 014 de `pontos-em-aberto-decisao-produto.md` (medição da P.8): o volume diário por ativo cai com o
tamanho do catálogo porque o pool de 19 bots direcionais é fixo (5 ativos 0,45%, 15 ativos 0,20%, 35 ativos 0,08%,
55 ativos 0,06% do float, contra a faixa de 0,3% a 0,7%). O autor pediu para desenhar para **pelo menos 30 ativos e
crescendo**, não para os 12 a 15 da tarefa 7.2.

**Princípio:** o custo do tick é limitado por um orçamento e o que se ajusta é a distribuição dos turnos de bot entre os
ativos. O volume de um ativo é proporcional aos turnos que ele recebe por dia (cerca de 0,05% a 0,07% do float por
turno, estimativa de 4 pontos de medição) e cada turno custa hoje cerca de 17 comandos SQL. Pool que cresce sem limite
estoura o orçamento; pool fixo esvazia os ativos. Estimativa de partida para 30 ativos com o orçamento atual: sobram
cerca de 165 turnos por dia (um pool de uns 65 bots), suficiente para os líderes na faixa e a cauda perto de 0,2%.
Todos esses números são estimativas a validar na Q.4.

**Decisões do autor (2026-09-25):**
1. **Alvo de volume:** ativos líderes na faixa de 0,3% a 0,7% do float por dia; ativo mediano de pelo menos 0,15%;
   nenhum ativo sem negociação (piso de 1 turno por dia).
2. **Orçamento de tick:** teto de **5.000 comandos SQL** (o gatilho de revisão obrigatória da seção 6.1 da proposta de
   cobertura), com **meta de 3.500 com 30 ativos**.
3. **Horizonte:** desenhar para **100 ativos**. As partes 1 a 3 (Q.1 a Q.3) primeiro, benchmark (Q.4), e só então
   decidir a parte 4 (Q.5).

### Q.1 · Baratear o turno de bot ✅
- **Descrição:** medir a decomposição atual dos ~17 comandos por turno de um bot direcional e reduzi-la para no máximo
  8: cachear no tick as leituras estáticas (ticker e `is_sandbox`, `outstanding_shares`, dia simulado) e carregar em
  lote os saldos e posições dos bots. Sem mudança de comportamento: mesma seed produz o mesmo mercado.
- **Critérios de aceite:** comandos por turno medidos antes e depois (log do Postgres, script da P.7); determinismo
  preservado (mesma seed, mesmo `Result`); teste de que um cache de tick não vaza entre ticks; nenhuma escrita de saldo
  ou posição sem evento (Event Sourcing).
- **Dependências:** nenhuma (independente das decisões acima).
- **Entregável (sessão 2026-09-25):** decomposição medida de um turno de bot direcional: `LoadContext` fazia **8 leituras**
  (saldo, posição, ticker e `is_sandbox`, cotação em cache, ordens em repouso, `outstanding_shares`, soma das posições, dia
  simulado) mais 3 comandos de escrita (BEGIN, INSERT, COMMIT), **11 por turno sem fill**. Agora **6**: (1) saldo e posição
  viraram uma consulta só (`LEFT JOIN`); (2) ticker, `is_sandbox` e `outstanding_shares` viraram uma consulta só
  (`assetStatic`); (3) `assetStatic` e o dia simulado ficam em cache **dentro de um escopo de leitura por tick**
  (`OrderExecutionRepository.WithReadScope`, `tick.OrderContextLoader`, aberto uma vez em `runIntradayRounds`), então cada
  ativo é lido uma vez por tick e o dia uma vez. O cache mora no `context.Context` do tick: requisição HTTP de usuário não
  passa por ele e nunca lê dado velho; erro nunca é cacheado; dois ticks nunca compartilham cache (testes). Ficam as 3
  leituras dinâmicas (saldo/posição, ordens em repouso, soma das posições). **Validação A/B** (bancos clonados do mesmo
  estado, 8 ticks, código do PR #42 contra o novo): **mercado idêntico** (hash de preços, volumes e saldos igual, mesmos
  fills por tick) com **-27% de comandos SQL** (6.644 para 4.868) no seed real. Meta de no máximo 8 por turno atendida
  (6 sem fill; fill acrescenta o custo próprio de posição, evento e saldo, fora do escopo desta tarefa).
  `golangci-lint`, `go build`, `go test ./...` passam. Sem rota HTTP alterada.

### Q.2 · Pool de bots dimensionado pelo orçamento ✅
- **Descrição:** `EnsureBotPool` (mesmo padrão de `coverage.EnsureCoverage`): dado o catálogo e o orçamento de turnos
  do tick, garante o número de bots direcionais, com personalidade e escopo por `bot.AssignSpecializations` (todo setor
  e classe seguem cobertos por cada arquétipo), caixa por Event Sourcing e ID determinístico (o ID entra na semente,
  RNF08). Bot novo não redistribui o float já alocado: entra com caixa e compra. Idempotente, chamado pelo seed e
  reaproveitável pelo painel da Fase N.
- **Critérios de aceite:** seed idempotente; catálogo maior gera mais bots até o teto do orçamento; teste table-driven
  da regra de tamanho do pool; nenhum arquétipo perde cobertura de setor.
- **Dependências:** Q.1 (o custo por turno define quantos turnos cabem no orçamento).
- **Entregável (sessão 2026-09-25):** `bot.PoolSize(assetCount)` (`internal/domain/bot/pool.go`, pura e monotônica): 2 bots
  direcionais por ativo (`BotsPerAsset`), entre 19 (`MinPoolSize`, o pool de sempre) e 150 (`MaxPoolSize`, ~3.400 comandos
  por tick com ~9 por turno depois da Q.1 e ~2,5 rodadas, dentro do teto de 5.000); todos ilustrativos, a validar na Q.4.
  Exemplos: 5 ativos, 19 bots; 15, 30; 30, 60; 50, 100; 75 ou mais, 150. O seed calcula o pool pelo catálogo e
  passa a **não redistribuir float de ativo já coberto** (senão um pool maior estouraria o teto do float): bot novo de um
  banco já semeado entra só com caixa (referência: valor médio de posição de um bot sobre o catálogo) e compra; ativo
  novo é distribuído entre o pool inteiro. Bots antes da cobertura no seed (se cair no meio, o ativo continua sem
  cobertura e a próxima execução refaz, em vez de ficar coberto e sem bots). Personalidade: os 19 primeiros mantêm
  exatamente a de sempre; os extras repetem ciclicamente a especialização dos originais (preserva a proporção de
  arquétipos, 24 Ruído, 18 Chartista e 18 Fundamentalista com 60 bots, e a cobertura de todo setor) com sorteio de
  conhecimento próprio por bot. **Validação** (bancos de teste isolados): seed real (N=19) **idêntico ao anterior**
  (hash de contas, posições, personalidades e cobertura, apagando os bots e semeando de novo no mesmo banco) e
  reexecução sem efeito; crescer um banco já semeado de 5 para 30 ativos (pool 19 para 60) deixa as posições dos 5 ativos
  antigos **inalteradas**, cria 41 bots com caixa que só negociam os ativos novos, float máximo 1,0000 do
  `outstanding_shares`, 30 ativos cobertos por 3 Market Makers; seed do zero com 30 ativos, todo bot com posição.
  **Desvio do texto da tarefa, declarado:** a regra de tamanho é o que ficou reaproveitável no domínio (`PoolSize`); o
  provisionamento continua no seed, e não num caso de uso `EnsureBotPool` separado, porque o painel da Fase N (N.1) cria
  bots individualmente pela mesma validação de domínio. `golangci-lint`, `go build`, `go test ./...` passam.

### Q.3 · Escolha de ativo ponderada por valor de mercado, com piso ✅
- **Descrição:** `bot.SelectAssetForRound` deixa de sortear uniforme e pondera pelo valor de mercado do ativo (float
  vezes preço) dentro do escopo do bot, com garantia de pelo menos 1 turno por dia por ativo. Líderes emergem sem impor
  perfil fixo por ativo (opção C do achado 009, descartada). Determinístico.
- **Critérios de aceite:** teste de distribuição (ativo maior recebe proporcionalmente mais turnos; nenhum ativo abaixo
  do piso); determinismo preservado; custo por tick inalterado.
- **Dependências:** Q.1.
- **Entregável (sessão 2026-09-25):** `bot.EquityForRound.MarketValue` (float vezes preço, preenchido por
  `buildEquityUniverse`; 0 sem float conhecido) e `pickWeighted` em `SelectAssetForRound`: dentro do grupo sorteado (escopo
  ou fora dele, a divisão `WithinScopePct` não muda), peso `(1 - MarketValueWeight)/n + MarketValueWeight x fração do valor
  de mercado`, com `MarketValueWeight = 0,5`. O líder recebe mais turnos e o menor ativo nunca recebe menos que metade da
  taxa uniforme. Custo por tick inalterado (mesma quantidade de turnos). Testes: frequência proporcional ao peso misto
  (valores 30, 10 e 1), piso do menor ativo (valor 3e-7 do total ainda recebe >= metade do uniforme), uniforme sem valor
  de mercado, determinismo por seed e divisão escopo/fora do escopo mantida. **Desvio do texto da tarefa, declarado:** o
  piso é **estatístico**, não uma garantia rígida de 1 turno por dia por ativo (um sorteio ponderado não garante isso);
  o piso de metade da taxa uniforme faz um dia sem turno ser raro com o pool da Q.2, e a Q.4 passa a medir dias sem
  negociação por ativo. Limitação conhecida: o peso atua dentro do escopo do bot, então o volume entre setores depende de
  quantos bots se especializam em cada um. **Teste de fumaça** (30 ativos, pool de 60, 60 dias): volume médio **0,29%** do
  float (mín. 0,12%, máx. 0,78%), contra 0,08% antes da Fase Q; 30 de 30 ativos cotados, 20 de 20 ordens do cenário do 013;
  **alerta para a Q.4:** média de 2.440 comandos por tick (meta 3.500), mas pico de 5.654, acima do teto de 5.000
  (dias de 4 rodadas com muitos fills), então `BotsPerAsset` e `MaxPoolSize` precisam de calibração.
  `golangci-lint`, `go build`, `go test ./...` passam.

### Q.4 · Benchmark em 30, 50 e 100 ativos e gatilho da parte 4 ✅
- **Descrição:** repetir `engine/scripts/benchmark-cobertura.sh` (P.7) com 30, 50 e 100 ativos sintéticos, medindo
  volume dos líderes e do ativo mediano, comandos por tick e o efeito de cinco eventos severos num ativo da cauda.
- **Critérios de aceite:** líderes na faixa de 0,3% a 0,7%, mediano de pelo menos 0,15%, tick de no máximo 5.000 comandos
  (meta de 3.500 com 30 ativos); resultados registrados na proposta de cobertura e neste backlog. **Gatilho:** se com 100
  ativos o tick passar de 5.000 comandos depois de Q.1 a Q.3, abrir a Q.5.
- **Dependências:** Q.1, Q.2, Q.3.
- **Resultado final (2026-09-26, depois de Q.7 a Q.10, 60 dias, seed 42):**

  | | 30 ativos | 50 ativos | 100 ativos |
  |---|---|---|---|
  | Comandos por tick, média / máx. | 2.163 / 2.600 | 3.600 / 4.700 | 4.644 / 6.442 |
  | Ticks acima de 5.000 | 0 | 0 | 3 de 60 (p95 = 5.051) |
  | Líderes (% do float/dia) | 0,54 | 0,53 | 0,34 (0,26 a 0,42) |
  | Volume mediano | 0,33 | 0,30 | 0,24 |
  | Ativos abaixo de 0,15% | 1 de 30 | 0 de 50 | 0 de 100 |
  | Dias sem negociação | 0 de 600 | 4 de 1.000 | 11 de 2.000 |
  | Reação da cauda a 5 eventos severos | -8,2% | -5,8% | mediana -4,9% (6 execuções) |
  | Cotados dos dois lados / cenário 013 | 30 de 30 / 20 de 20 | 50 de 50 (8 de 8 execuções) / 20 de 20 | 100 de 100 / 20 de 20 |

  Todos os alvos das decisões do autor atendidos: líderes na faixa de 0,3% a 0,7% (com 100 ativos, na parte baixa), mediano
  acima de 0,15%, nenhum ativo sem negociação estruturalmente (piso rígido, os poucos dias sem negócio são o turno de piso sem
  fill), custo médio e p95 dentro de 5.000 e a meta de 3.500 com 30 ativos (2.163). A Q.5 não foi necessária no horizonte de 100
  ativos. Ver a seção 6.4 da `proposta-cobertura-market-maker.md`.
- **Decisão (2026-09-26, autor aprovou a recomendação):** o teto de 5.000 comandos por tick vale como **média e p95** (a
  média de 4.620 e o p95 de 5.024 com 100 ativos o cumprem). Os poucos ticks acima (3 de 60, máx. 6.393) são dias de 4 rodadas
  com muitos fills; um teto rígido no pico exigiria um limite de fills por tick, que não se justifica pelo custo de realismo.
- **Resultado do benchmark (2026-09-26, 60 dias, seed 42, script corrigido para ler o log do Postgres uma vez no fim):**

  | | 30 ativos (pool 60) | 50 ativos (pool 100) | 100 ativos (pool 150) |
  |---|---|---|---|
  | Comandos por tick, média / máx. | 2.160 / 3.713 | 3.482 / 5.701 | 5.335 / 9.014 |
  | Ticks acima de 5.000 | 0 | 9 | 28 de 60 |
  | p50 / p95 / p99 | 1.965 / 3.534 / 3.713 | 3.117 / 5.569 / 5.701 | 4.696 / 8.550 / 9.014 |
  | Volume dos líderes (% do float/dia) | 0,50 | 0,44 | 0,32 (0,13 a 0,52) |
  | Volume mediano | 0,24 | 0,21 | 0,14 |
  | Ativos abaixo de 0,15% | 7 de 30 | 12 de 50 | 52 de 100 |
  | Dias sem negociação | 22% | 26% | 36% |
  | Reação a 5 eventos severos na cauda | -1,0% | 0,0% | -1,0% |
  | Cotados dos dois lados / cenário 013 | 30 de 30 / 20 de 20 | 50 de 50 / 20 de 20 | 100 de 100 / 20 de 20 |

  **Leitura:** 30 ativos dentro do alvo; 50 estoura o teto de custo; 100 estoura o custo (o gatilho da Q.5 disparou), deixa o
  mediano abaixo de 0,15% e 36% dos ativo-dias sem negócio. Causa comum: cada bot sorteia um ativo por rodada, então custo e
  volume dependem do mesmo botão (o tamanho do pool) e cada ativo novo dilui os turnos dos outros. A Q.4 só fecha depois
  de Q.7 a Q.10, que corrigem isso, e de uma nova execução do benchmark (feita na Q.9, resultados no Entregável dela).

### Q.5 · (Reserva) Sessão de tick em memória ✅ (dispensada, não implementada)
- **Descrição:** carregar o estado uma vez (saldos, posições e books), simular os turnos em memória e gravar em lote,
  de modo que o custo dependa dos fills e não dos turnos. Refatoração grande do caminho de execução, com Event
  Sourcing preservado. **O gatilho da Q.4 disparou (100 ativos, média de 5.335 comandos por tick), mas a tarefa fica em
  reserva:** o orçamento de turnos (Q.8) torna o custo controlável e a Q.7 mede onde ele está. Só se abre se, depois de
  Q.7 a Q.10, 100 ativos ainda passarem de 5.000 comandos por tick. **Resultado (Q.9): média de 4.620 e p95 de 5.024
  com 100 ativos, então a Q.5 não é necessária no horizonte de 100 ativos** (reabrir se o catálogo passar muito disso).
- **Dependências:** Q.7, Q.8, Q.9, Q.10 e nova execução da Q.4.

### Q.6 · Dividendos em lote (custo que escala com bots x ativos) ✅
- **Origem:** achado no teste de fumaça da Q.3 (30 ativos, pool de 60): os picos de 5.654 comandos por tick caíam nos dias
  de pagamento de dividendo (5 dias depois de cada dia de relatório), com apenas 2 rodadas. Gerar o dividendo custava 1
  comando por detentor e pagá-lo 2 por detentor (evento e saldo), ou seja, **bots x ativos** comandos por pagamento: 63
  detentores x 30 ativos, e 150 x 100 seria da ordem de 30.000. Nenhum ajuste de pool corrige isso, então precisava
  ser resolvido antes do benchmark da Q.4.
- **Descrição:** `saveNewDividends` insere os detentores de cada dividendo com um `INSERT ... unnest` só; `payDueDividends`
  grava os eventos `dividend_payment` com `eventstore.AppendBatchTx` (um `INSERT` em lote, ANTES da projeção, Event
  Sourcing preservado) e projeta os saldos com um `UPDATE ... FROM unnest` só. Os valores numéricos usam a mesma
  representação que o driver dá a um `float64` avulso, então o que é gravado é idêntico.
- **Critérios de aceite:** estado final idêntico ao do código anterior (contas, eventos e tabelas de dividendos); comandos
  por dia de pagamento independentes do número de detentores.
- **Entregável (sessão 2026-09-25):** `eventstore.AppendBatchTx` (rejeita lote com tipos diferentes ou campos ausentes
  antes de gravar, `ErrInvalidBatch`, testado) e as duas reescritas em `tick_repository.go`. **Validação A/B** (banco
  clonado do benchmark de 30 ativos, dia 61 com 30 dividendos pagos e dia 70 com 30 gerados): **estado final idêntico**
  (hash de contas, dos 7.320 eventos e das tabelas de dividendos) com **dia de pagamento 5.675 para 2.075 comandos
  (-63%)** e dia de geração 3.569 para 1.769 (-50%). `golangci-lint`, `go build`, `go test ./...` passam.
- **Dependências:** nenhuma; feita antes da Q.4 porque muda o que ela mede.

### Q.7 · Medir a divisão do custo do tick (Market Maker x bots direcionais x fixo) ✅
- **Origem:** benchmark da Q.4 com 100 ativos (média de 5.335 comandos por tick, 28 de 60 ticks acima de 5.000). Não se
  sabe quanto vem dos 10 Market Makers (10 ativos cada, recotados a cada rodada), quanto dos 150 bots direcionais e quanto
  do custo fixo (dividendos, cotações do dia, eventos). Sem isso, não dá para dizer se a Q.5 mira o alvo certo.
- **Descrição:** o script de benchmark atribui os comandos do log do Postgres a categorias (por usuário da sessão ou por
  padrão da consulta: Market Maker, bot direcional, fixo do tick) e imprime a divisão média e a de p95 por categoria.
- **Critérios de aceite:** divisão medida com 30, 50 e 100 ativos e registrada aqui e na seção 6 da proposta de cobertura;
  dizer explicitamente qual categoria domina o estouro de 100 ativos.
- **Dependências:** nenhuma (usa o script já corrigido na Q.4).
- **Entregável (sessão 2026-09-26):** `benchmark-cobertura.sh` grava `cmd_mm`, `cmd_bots` e `cmd_fixo` por tick e imprime a
  média por categoria e a média dos ticks acima de 5.000. Como o log do Postgres só traz o usuário nos parâmetros da
  primeira consulta de um turno (leitura de saldo/posição do bot ou de ordens em repouso do Market Maker), cada turno herda
  esse ator até o próximo; calendário, gravação de cotações do dia, expiração, dividendos e cargas de roster voltam ao custo
  fixo; o custo de um fill é cobrado a quem iniciou a ordem. Validado contra a contagem total de comandos de um tick
  capturado (6.342 nos dois métodos). Medição (60 dias, seed 42, média por tick):

  | | 30 ativos (pool 60) | 50 ativos (pool 100) | 100 ativos (pool 150) |
  |---|---|---|---|
  | Market Makers | 533 (25%) | 838 (24%) | 1.380 (26%) |
  | Bots direcionais | 1.542 (72%) | 2.570 (73%) | 3.823 (71%) |
  | Fixo do tick | 64 (3%) | 91 (3%) | 158 (3%) |
  | Total, ticks acima de 5.000 | nenhum | 9 ticks: 1.245 + 4.177 + 88 | 28 ticks: 1.835 + 5.102 + 143 |

  **Conclusão:** o estouro é dos **bots direcionais** (cerca de 72% em todos os tamanhos), não do Market Maker (cerca de 25%,
  crescendo linear: ~14 comandos por ativo por tick) nem do fixo (3%). Um turno de bot custa ~10 comandos com os fills
  incluídos (3.823 para ~370 turnos e 184 fills por tick com 100 ativos): ~6 são o turno em si (3 leituras, BEGIN, INSERT,
  COMMIT) e cada fill acrescenta cerca de 9 (posições, eventos, saldos, ordem). Implicações: (1) o orçamento de turnos da Q.8
  é a alavanca certa; (2) o teto de 5.000 com 100 ativos deixa ~3.460 para os bots, ou seja, **~335 turnos por tick em média**;
  (3) o custo varia muito (p95 = 8.498 contra p50 = 4.731 com 100 ativos, dias de 4 rodadas e muitos fills), então o
  orçamento precisa ser **por tick** (não por rodada) e ter teto de fills, senão o pico continua acima de 5.000; (4) se
  depois da Q.8 ainda faltar, a Q.5 mira as leituras dos turnos (~40% do custo do bot); (5) recotação do Market Maker menos
  frequente é uma alavanca secundária (~1.400 comandos com 100 ativos). Nota: o custo total medido aqui (5.360 de média
  com 100 ativos) difere ~0,5% do benchmark anterior (5.335) porque o método de contagem mudou.

### Q.8 · Orçamento de turnos por ativo com piso rígido ✅
- **Origem:** dias sem negociação de 22% a 36% e volume mediano abaixo de 0,15% com 100 ativos. Hoje cada bot sorteia um
  ativo por rodada, o custo e o volume dependem do tamanho do pool, e o piso da Q.3 é só estatístico.
- **Descrição:** o tick passa a definir um **orçamento de turnos** (parâmetro de custo, independente do tamanho do
  catálogo) e o distribui entre os ativos: `piso + parte proporcional` ao peso do ativo (valor de mercado misturado a um
  piso uniforme, como na Q.3), com fechamento pelo método do maior resto, determinístico pela seed. Cada turno de ativo
  escolhe depois um bot elegível de escopo compatível. O piso é **1 turno por ativo por dia**, garantido por construção,
  e esse turno é marketable (a mercado, ou limite que cruza a cotação do Market Maker), para imprimir um negócio real e
  o preço de fechamento do dia refletir atividade. `BotsPerAsset` e `MaxPoolSize` deixam de ser o botão de custo: o pool
  só garante diversidade de arquétipos e escopos.
- **Critérios de aceite:** nenhum ativo do catálogo sem turno em nenhum dia (teste com catálogo sintético de 100);
  soma dos turnos por tick igual ao orçamento; ativo maior recebe proporcionalmente mais turnos acima do piso;
  determinismo preservado; custo por tick com 100 ativos depende do orçamento, não do número de ativos (benchmark).
- **Dependências:** Q.7 (define o orçamento viável: ~335 turnos por tick com 100 ativos, orçamento por tick e não por rodada), Q.3.
- **Entregável (sessão 2026-09-26):** `bot.TurnBudget` (turnos por ativo até um teto, nunca menos de 1 por ativo),
  `bot.AllocateTurns` (piso de 1 turno por ativo mais o resto pelo peso da Q.3, com fechamento exato por amostragem
  sistemática, determinístico pela seed) e `bot.SelectBotForTurn` (bot escolhido pelo escopo, 87,5% dentro dele);
  `runIntradayRounds` divide os turnos do **dia** entre as rodadas (1 ou 4 rodadas gastam o mesmo), o Market Maker cota
  primeiro em toda rodada e o turno de piso é a mercado, tentando até 4 bots até haver um fill. O universo de sorteio tem ordem
  estável por ID. Removidos `SelectAssetForRound`, `pickWeighted` e `ErrNoEquityAvailable` (código morto). **Medição só com a
  Q.8** (`TurnsPerAsset = 5`, teto de 330 turnos): 30 ativos 2.571 comandos por tick, líderes 0,71%, mediano 0,40%, 1 dia sem
  negócio em 600; 50 ativos 4.236 (máx. 4.934), 0 abaixo de 0,15%; 100 ativos 6.283 (todos os ticks acima de 5.000), líderes
  0,39%, mediano 0,24%, 3 dias sem negócio em 2.000. O piso e o volume foram atendidos; o custo com 100 ativos não, e cortar
  o teto para 250 turnos deu 5.267 com 15 ativos abaixo de 0,15% (sem folga de volume), o que motivou a Q.9. Testes de
  distribuição, piso rígido, orçamento independente do número de rodadas e nova tentativa do turno de piso;
  `golangci-lint`, `go build`, `go test ./...` passam.
- **Decisão (2026-09-26, autor delegou a escolha):** o piso passa de estatístico (desvio declarado na Q.3) para **rígido, 1
  turno marketable por ativo por dia**. Motivo: é o que a decisão 1 já pedia ("nenhum ativo sem negociação"); custa só 1 turno
  por ativo (100 dos ~350 do orçamento com 100 ativos); e o Market Maker já cota todo ativo, então o turno de piso sempre
  encontra contraparte e o preço de fechamento vira dado do dia. Descartada a alternativa de 1 turno a cada 2 dias no
  último quintil: imitaria melhor o papel ilíquido real, mas reabriria o buraco que o autor quer fechar.

### Q.9 · Giro-alvo por ativo via tamanho de ordem ✅
- **Origem:** volume dos líderes e do mediano abaixo da faixa com 100 ativos, e custo que não pode subir para corrigi-lo.
- **Descrição:** o volume deixa de depender só do número de turnos: cada ativo tem um **giro-alvo** diário (fração do float
  escalada por valor de mercado, dentro de 0,15% a 0,6%) e a quantidade típica de uma ordem de bot é o giro-alvo dividido
  pelos turnos esperados do ativo, sempre sujeita ao teto de 20% do volume médio recente já existente
  (`effectiveOrderSizeCeiling`). Fundamentalista e Chartista fazem ordens maiores que o Ruído (lote institucional contra
  varejo). Não adiciona nenhum comando SQL por tick.
- **Critérios de aceite:** líderes na faixa de 0,3% a 0,7% e mediano de pelo menos 0,15% com 30, 50 e 100 ativos; sem
  aumento de comandos SQL por tick; volatilidade diária dos ativos e esgotamento de caixa/posição dos Market Makers
  medidos e dentro do aceitável (risco: ordens maiores movem mais o preço e consomem a cotação do Market Maker).
- **Dependências:** Q.8.
- **Entregável (sessão 2026-09-26):** `bot.TargetTurnoverPct` (giro-alvo de 0,25% do float por dia no ativo mediano,
  crescendo com (valor de mercado / mediana)^0,3, entre 0,2% e 0,6%), `bot.MedianMarketValue` e `bot.OrderCeilingPct` (teto de
  tamanho de ordem que faz o ativo render o giro-alvo com os turnos que recebeu no dia: giro = turnos x 0,21 x teto, com
  0,21 medido como o volume por turno em fração do teto; no máximo 1,2% do float). O piso do teto de ordem dos bots
  direcionais deixa de ser um percentual fixo do float e passa a ser esse valor por ativo (nunca abaixo de 0,4%, o piso
  do achado 009); o Market Maker segue com o piso antigo. Orçamento recalibrado: `TurnsPerAsset = 4` e `MaxTurnsPerTick = 200`.
  Nenhum comando SQL novo. **Medição** (60 dias, seed 42, a cada execução o banco recebe UUIDs novos, então há variação
  pequena entre execuções):

  | | 30 ativos | 50 ativos | 100 ativos |
  |---|---|---|---|
  | Comandos por tick, média / máx. | 2.163 / 2.600 | 3.599 / 4.306 | 4.620 / 6.393 |
  | Ticks acima de 5.000 | 0 | 0 | 3 de 60 (p95 = 5.024) |
  | Líderes (% do float/dia) | 0,54 (0,39 a 0,65) | 0,53 (0,37 a 0,63) | 0,31 (0,19 a 0,47) |
  | Volume mediano | 0,33 | 0,30 | 0,25 |
  | Ativos abaixo de 0,15% | 1 de 30 | 0 de 50 | 1 de 100 |
  | Dias sem negociação | 0 de 600 | 4 de 1.000 | 6 de 2.000 |
  | Reação a 5 eventos severos na cauda | -8,2% | -5,8% | -3,9% |
  | Volatilidade diária (100 ativos) | | | mediana 1,10%, p95 1,51%, máx. 2,21% |
  | Cenário do achado 013 | 20 de 20 | 20 de 20 | 20 de 20 |

  Market Makers sem esgotamento (menor posição de um Market Maker com 100 ativos: 174 mil ações, caixa acima de R$ 4 bi).
  **Achado e correção (mesma sessão):** em 2 de 4 execuções com 50 ativos, 1 a 2 ativos terminavam o dia sem a **compra**
  (48 e 49 de 50 cotados dos dois lados). Causa provável: a recotação do Market Maker na passada final casa de cara com uma ordem
  de bot que ficou do outro lado do preço e é consumida inteira, sem deixar o lado em repouso. A passada final agora repete até
  nada mudar (`finalPassMaxIterations = 3`, uma consulta por Market Maker por repetição). Depois da correção, 4 de 4 execuções
  com 50 ativos e 1 com 100 deram todos os ativos cotados dos dois lados, sem custo perceptível (média de 3.600 e 4.644
  comandos por tick). O script de benchmark lista os ativos sem um dos lados quando isso ocorre. `golangci-lint`, `go build`, `go test ./...` passam.

### Q.10 · Atenção por evento: turnos extras e reação do Fundamentalista ✅
- **Origem:** reação a cinco eventos severos num ativo da cauda de apenas -1,0% (0,0% com 50 ativos), contra -7,7% em 4
  dias do `VALR3` no seed real (P.8): ativo pouco negociado quase não reage.
- **Descrição:** evento macro ou balanço aplica um **multiplicador de atenção** (por exemplo x3 no dia, decaindo em 3 a 5
  dias) sobre a alocação de turnos dos ativos-alvo. Os turnos extras vão preferencialmente a bots Fundamentalistas de
  escopo compatível, pelo caminho de reação por negociação (nunca multiplicador direto de preço, proposta 2.3.2). O
  orçamento total continua fixo: a atenção redistribui turnos, não soma.
- **Critérios de aceite:** ativo da cauda alvo de eventos severos reage de forma comparável à do seed real (ordem de
  grandeza da queda do `VALR3` na P.8); orçamento total de turnos inalterado; sem evento, a alocação é a da Q.8; teste
  de decaimento da atenção.
- **Dependências:** Q.8. Se a Q.8 já resolver a reação (piso rígido), medir antes de implementar e fechar como
  "desnecessária" com a medição registrada.
- **Reaberta (2026-09-26):** a primeira medição pós-Q.9 (-8,2%, -5,8% e -3,9% com 30, 50 e 100 ativos) sugeria que a reação
  da cauda já estava boa e a tarefa foi fechada como desnecessária, mas a reação varia muito entre execuções (o banco recebe UUIDs
  novos, o ativo da cauda e o sorteio mudam). Quatro execuções com 100 ativos deram **-3,9%, -1,0%, -0,0% e -3,0%**
  (mediana perto de -2%), a metade ou menos da queda do `VALR3` no seed real (-7,7% em 4 dias, P.8). Uma amostra só não sustenta o
  fechamento, então a Q.10 volta a ser implementada como descrito acima. Critério de aceite reforçado: reação medida em pelo
  menos 4 execuções, com mediana da mesma ordem de grandeza da do `VALR3`.
- **Entregável (sessão 2026-09-26):** `bot.AttentionMultiplier` (1 sem evento, até 1 + 4 = 5 vezes com efeito de preço combinado de
  15% ou mais, só pela magnitude), `EquityForRound.Attention` e `Turn.Attention`. O multiplicador entra no peso de
  `AllocateTurns` (o orçamento total e o piso de 1 turno por ativo não mudam) e `SelectBotForTurn` passou a receber
  `TurnCandidate` (escopo e arquétipo): num turno de ativo sob atenção, 75% das vezes só Fundamentalistas concorrem (sem nenhum,
  todos concorrem). O giro-alvo do ativo também sobe com a atenção (pico de volume, dentro do teto de 1,2% do float por ordem).
  O tick lê a atenção do `MacroEffectPct` por empresa que já existia (só é diferente de zero enquanto o evento dura, então o
  decaimento é o fim do evento, sem estado novo): `applyEventAttention`. Balanços (dia de relatório) ficaram fora, só evento macro
  gera atenção. **Medição** (100 ativos, 6 execuções, cinco eventos severos no setor do ativo de menor float): **-4,0%, -3,9%,
  -5,8%, -2,0%, -5,9% e -12,0%, mediana -4,9%**, contra -3,9%, -1,0%, -0,0% e -3,0% (mediana perto de -2%, com dois casos sem
  reação) antes da Q.10, e -7,7% do `VALR3` no seed real. Nenhuma execução sem reação. Testes de multiplicador, redistribuição sem
  mudar o orçamento, preferência por Fundamentalista, marcação no universo e giro-alvo com atenção; `golangci-lint`, `go build`,
  `go test ./...` passam.

### Q.11 · Teste ponta a ponta da Fase Q: achados e correções ✅
- **Origem:** teste de ponta a ponta pedido pelo autor depois da Q.10 (2026-09-26), fora do caminho feliz: banco isolado com o
  catálogo real mais 30 sintéticos, 200 dias simulados, usuários reais pelo motor e pelo backend, evento macro, catálogo crescendo
  com o mercado rodando, bots desativados, ticks concorrentes e ordens de usuário durante o tick.
- **O que passou (sem achado):** conciliação de saldo e de posição contra `market_events` (0 divergências em 165 contas, 200 dias,
  dividendos em lote incluídos: 19.879 pagamentos, soma idêntica ao gerado); float nunca ultrapassado; compra igual a venda por ativo;
  **determinismo** (banco clonado, dois motores, 12 ticks, hash idêntico de cotações, saldos, posições e ordens: o cache de leitura
  do tick da Q.1 não vaza nem altera nada); ticks concorrentes se serializam (dias 148 e 149, sem cotação duplicada); 20 ordens de
  usuário em paralelo com um tick; seed idempotente (reexecutar com 60 sintéticos não muda nenhuma contagem) e guarda
  `SEED_ALLOW_SYNTHETIC`; catálogo crescendo de 30 para 60 ativos com o mercado no ar (pool 60 para 137, posições antigas
  intactas, 65 ativos cobertos); todos os bots direcionais desativados, só 1 ativo, todos os Market Makers desativados, nada ativo, e
  reativação (nenhum erro, `uncovered_assets_count` correto); float `NULL` em um ativo; evento macro severo no setor Varejo (volume
  do setor 0,98% do float contra 0,36% na linha de base, queda de 4% a 15%, decaimento ao fim do evento, orçamento de turnos igual);
  preços da API iguais ao banco; backend (cadastro, gate de lição, ordem, cancelamento, extrato, ranking sem bots e sem valor
  absoluto) sobre o motor novo.
- **Achado 1 (corrigido): primeiro dia de um ativo negociava até 99% do float.** Sem histórico de volume, `effectiveOrderSizeCeiling`
  devolvia o float inteiro como teto de ordem, então a Q.9 (giro-alvo) só valia a partir do segundo dia. No seed do zero, o volume do
  dia 1 chegou a 25% do float (média de 1,73% nos dias 1 a 5, contra a faixa de 0,3% a 0,7%; `VALR3` 2,44% e 2,90% nos dois
  primeiros dias) e o mesmo aconteceu com cada ativo novo de um catálogo que cresce (média de 9,45%, máximo de 38,3%), inflando
  ainda o volume médio que dimensiona os dias seguintes. Agora o teto sem histórico é o piso proporcional (giro-alvo) do ativo.
  **Depois:** dia 1 com média de 0,33% (máx. 1,0%) e ativos novos com média de 0,26% (máx. 0,8%).
- **Achado 2 (corrigido): turno de FII gastava tentativa com Fundamentalista.** Fundamentalista não decide sem empresa, então o
  sorteio de bot de um FII perdia cerca de metade dos turnos (e o turno de piso esgotava as 4 tentativas): 3,77% dos dias de FII
  sem negócio contra 0,17% nas ações. `runTurn` não sorteia mais Fundamentalista para ativo sem empresa com fundamentos.
  **Depois:** 0 de 78 dias de FII sem negócio.
- **Achado 3 (corrigido, decisão do autor): achado 015** de `pontos-em-aberto-decisao-produto.md` (ordem em repouso não reservava
  nem revalidava saldo/posição): saldo negativo de usuário (-R$ 6.402) e de bot (-R$ 17,8 mi), e ordem fantasma dentro do spread que
  travava todas as compras de um ativo. `Execute` agora revalida o dono da ordem em repouso no match (saldo e posição vêm na
  consulta do book, sem comando extra), pula e cancela a ordem sem fundos (`cancel_reason = insufficient_funds`, enum novo em
  backend e frontend) e a migration `000025` acrescenta `CHECK` de saldo e posição não negativos, mapeados para `422`.
  **Validação ao vivo:** fantasma pulada e cancelada, compra em repouso sem caixa não preenche, ordem válida preenche, 12 compras
  concorrentes (1 executada, 11 rejeitadas), 180 ticks com catálogo crescendo com 0 saldos negativos e 0 divergências, mesmo
  hash em dois motores.
- **Observações sem correção:** o preço de fechamento anda em degraus de cerca de 1% porque o turno de piso executa contra a
  cotação do Market Maker (efeito do desenho da Q.8); FII e ETF não ganham atenção por evento (só ação tem empresa alvo,
  já dito na Q.10); dia de relatório com ativo novo ainda sem fundamentos faz o Fundamentalista pular o turno até o primeiro
  relatório (turno perdido, sem erro).
- **Testes:** `TestEffectiveOrderSizeCeiling` (sem histórico usa o piso proporcional) e
  `TestRunIntradayRounds_TurnoDeFIINaoSorteiaFundamentalista` (falha no código anterior, passa no novo) e 4 testes de `Execute` da revalidação (fantasma, compra sem saldo, saldo consumido entre ordens do mesmo dono, dono que pode honrar); `golangci-lint`,
  `go build`, `go test ./...` passam.

## Fase R — ETF no motor de negociação real (NAV, Participante Autorizado, rebalanceamento, dividendos)

**Origem:** achado do teste ponta a ponta da Fase Q (2026-09-26): as tarefas H.1 a H.4 entregaram as funções puras de ETF
(`internal/domain/etf/`: `NAV`, `RebalanceOrders`, `DecideAuthorizedParticipantAction`, cesta com `asset_id` real), mas **nada
disso está ligado ao tick**. Hoje o preço do ETF ainda nasce do GBM (`equity.NextPrice`, `tick.go`), ele não tem book, bots nem
Market Maker, não tem número de cotas (`outstanding_shares` é `NULL`), não reage a evento macro nem a balanço e não distribui
nada. Isso é o oposto do que a Fase Q fez para ações e FIIs. A proposta (`proposta-motor-mercado-realista.md`, seção 5) já
define o modelo (NAV + Participante Autorizado + rebalanceamento mecânico); esta fase é a **integração**, não um desenho novo.

**Decisões do autor (2026-09-26):**
1. **Dividendos dos constituintes são distribuídos aos cotistas** (não acumulados no NAV), pelo mesmo mecanismo de dividendo em
   lote da Q.6. Não haverá opção de acumulação nesta fase.
2. **Primeira versão da cesta: só Ação e FII, sem renda fixa.** O schema (`etf_holdings.asset_id`, H.4) e o seed atual **já
   permitem** renda fixa na cesta: o `SINT11` tem 15% em `LFT2029`, hoje só decorativo (não entra em NAV nenhum). A R.1 muda o seed
   para uma cesta só de Ação e FII e passa a **rejeitar** constituinte de renda fixa num ETF negociável; a capacidade do schema
   fica intacta, e o ETF com renda fixa fica como tarefa de reserva (R.13) e não faz parte desta fase.
3. **Fora de escopo:** IR sobre a venda de cotas (o motor só tem IR de renda fixa; ação e FII também não têm, então o ETF não
   teria por que ter), acumulação de dividendo no NAV e ETF de renda fixa.

**Princípios (herdados da Fase Q):** desenhar para catálogo que cresce (vários ETFs, cestas maiores), nunca dimensionar pelo
único `SINT11`; custo de tick em comandos SQL proporcional à atividade (o Participante Autorizado só age fora de uma faixa
morta, com teto diário), dentro do orçamento de 5.000 comandos por tick; nenhuma escrita de saldo, posição ou cota sem evento
imutável antes (Event Sourcing); determinismo pela seed (RNF08); ETF nunca ganha multiplicador direto de preço, só reage pela
negociação dos constituintes.

### R.1 · Fundo como conta, modelo de dados e cesta v1 (Ação e FII) ✅
- **Descrição:** cada ETF ganha uma **conta de fundo** (`accounts`, mecânica, fora de ranking/social como todo bot) que detém a
  cesta como posições reais nos constituintes e o caixa do fundo; o número de cotas passa a viver em
  `variable_income_assets.outstanding_shares` do ETF e deixa de ser `NULL`. Migration: `etf_details` ganha `fund_account_id`,
  `expense_ratio_pct`, `rebalance_frequency_days` e `last_rebalance_day`; tipos novos em `market_event_type`
  (`etf_creation`, `etf_redemption`, uma linha por constituinte e uma pelas cotas) e o passivo de dividendo a pagar do fundo.
  `etf.NewDetails` passa a validar cesta negociável só com Ação/FII (renda fixa rejeitada com erro próprio), e o seed do
  `SINT11` vira uma cesta de ações e FII.
- **Critérios de aceite:** seed idempotente; ETF sem constituinte de renda fixa; NAV calculável a partir das posições do fundo;
  fundo nunca aparece em ranking, busca de amigos ou perfil; teste de validação da cesta (renda fixa rejeitada, duplicata
  rejeitada, peso somando ~100%).
- **Dependências:** nenhuma.
- **Entregável (2026-09-26):** migration `000026_etf_fund_account`: `etf_details` ganha `fund_account_id` (uuid único, FK para
  `accounts`, nulo só para o banco anterior ao seed), `expense_ratio_pct` (padrão 0,50 ao ano), `rebalance_frequency_days`
  (padrão 14), `last_rebalance_day` e `dividends_payable` (passivo de dividendo a pagar, insumo do `liabilities` do NAV na R.8);
  enum `market_event_type` ganha `etf_creation` e `etf_redemption` (`domain.EventETFCreation`/`EventETFRedemption`, usados a partir
  da R.2). `etf.Holding` ganha `Class` (`HoldingClass`: acao, fii, renda_fixa, etf) e `etf.NewDetails` passa a rejeitar constituinte
  real de renda fixa, de outro ETF ou de classe desconhecida (`ErrNonTradableConstituent`) e sem classe (`ErrMissingHoldingClass`),
  além da duplicata e do peso que já rejeitava; constituinte cosmético (sem `asset_id`) segue livre. `etf.FundAccountID` deriva o
  uuid da conta de fundo do `asset_id` do ETF (determinístico, sem colisão com os uuids de bot), então o seed é idempotente sem
  lookup. Seed: `SINT11` vira `VALR3` 40%, `BNDD3` 20%, `TJLO11` 25%, `PAPL11` 15%; cria a conta de fundo (`is_bot`, saldo 0, sem
  linha em `users` e sem `bot_personalities`, então fora de ranking, busca de amigos e de qualquer rodada de negociação) e liga ao
  ETF; `outstanding_shares` deixa de ser `NULL` e vira a soma das posições existentes (0 num ETF sem ninguém posicionado, até a
  criação inicial da R.3), o que faz o teto de float da A.3 valer para o ETF. Num banco que já tinha o `SINT11` com a cesta antiga
  (15% em `LFT2029`), o seed troca a composição (`ReplaceETFHoldings`) e cria o fundo, sem tocar o resto. Repositório:
  `ReplaceETFHoldings`, `FindETFFundAccountID`, `AttachETFFundAccount`.
- **Testes:** validação da cesta (renda fixa, outro ETF, classe desconhecida, classe ausente, cosmético, duplicata, peso),
  `FundAccountID` (uuid bem formado, determinístico, distinto por ETF) e NAV calculado só a partir das posições do fundo
  (`ConstituentsFromHoldings` + `NAV`); `golangci-lint` (0 issues), `go build` e `go test ./...` passam. Validado ao vivo contra o
  Postgres do `docker compose` (banco na migration 24 com a cesta antiga): migrations 25 e 26 aplicadas, seed migrou a cesta,
  criou o fundo (evento `bot_initial_cash` de valor 0) e a segunda execução não mudou nada.
- **Sem rota HTTP alterada** (o bloco de ETF de `GET /assets/{id}` só ganha NAV na R.3), então sem mudança em `.docs/engine/`.

### R.2 · Criação e resgate de cotas como operação atômica e sourced ✅
- **Descrição:** a primitiva que o Participante Autorizado e a emissão inicial usam. Criação: o AP entrega a cesta ao fundo
  (posições do AP nos constituintes passam ao fundo) e recebe cotas novas (`outstanding_shares` sobe); resgate faz o inverso.
  Tudo numa transação, com os eventos `etf_creation`/`etf_redemption` gravados **antes** de projetar posições e cotas, e a
  checagem de float (A.3) valendo nos constituintes e no ETF: o total de cotas em posições é sempre igual a
  `outstanding_shares`. Falha de saldo ou posição do AP aborta tudo (mesma revalidação da Q.11, rede de `CHECK` incluída).
- **Critérios de aceite:** conservação (constituintes do AP mais os do fundo antes e depois; cotas emitidas = cotas em posições);
  reconciliação de saldo e posição contra `market_events` continua com 0 divergências; teste de criação e de resgate com cesta
  mista Ação+FII; rejeição atômica se o AP não tem a cesta.
- **Dependências:** R.1.
- **Entregável (2026-09-26):** `etf.ShareExchange` (ETF, conta do fundo, participante, cotas, preço da cota, cesta de `BasketLeg`)
  com `Validate` (cotas e cesta positivas e dentro de 32 bits, sem duplicata, sem o ETF na própria cesta, participante diferente do
  fundo), `etf.ProRataBasket` (cesta proporcional às cotas: arredonda para cima na criação, para baixo no resgate, para nunca diluir
  cotistas) e a interface `etf.ShareExchanger`. Implementação `db.ETFShareRepository` (`Create`/`Redeem`), numa transação: trava a
  linha do ETF (serializa trocas do mesmo fundo), confere que a conta de fundo é a do ETF, **grava os eventos antes de projetar** e
  então move as posições (`applyPositionFill`, com a rede de `CHECK` da migration 000025 mapeada para `ErrInsufficientPosition`),
  valida o teto de float de cada constituinte (A.3), atualiza `outstanding_shares` e exige que o total de cotas em posições seja
  igual a ele (`ErrShareConservation`). **Convenção dos eventos:** `etf_creation`/`etf_redemption` levam quantidade **com sinal**,
  igual ao delta da posição daquela conta naquele ativo (participante e fundo em cada constituinte, participante nas cotas), então a
  posição de qualquer conta continua reconstruível somando os eventos. Nenhum caixa se move (troca em espécie); a compra da cesta nos
  books é da R.3/R.6. Nenhuma rota HTTP.
- **Testes:** validação e cesta pro-rata table-driven (`shares_test.go`). O repositório segue a convenção do pacote `db` (sem teste
  contra Postgres): validado ao vivo no Postgres do compose com um bot real como participante e cesta mista `VALR3`+`TJLO11`:
  criação de 1.000 cotas, resgate de 400, rejeição atômica sem a cesta, resgate acima das cotas e fundo errado (nenhum evento nem
  posição gravados nas falhas), soma dos eventos igual às posições do fundo e das cotas, constituintes conservados, e resgate total
  final devolvendo o fundo a 0 cotas e 0 posições; `golangci-lint` (0 issues), `go build`, `go test ./...` passam.

### R.3 · Emissão inicial por criação e NAV/iNAV ligado ao tick ✅
- **Descrição:** o ETF nasce (e todo ETF novo de um catálogo que cresce nasce) por uma **criação inicial** do AP, comprando a
  cesta nos books dos constituintes com o caixa do AP (provisionado por Event Sourcing, como `bot_initial_cash`), sem
  redistribuir o float de ações já alocado. NAV/iNAV calculado por `etf.NAV` a partir das posições do fundo e dos preços
  correntes dos constituintes (preço de rodada em `equityRoundState`), a cada rodada e no fechamento. Persistência diária
  (`etf_nav_history`: dia, NAV, preço de fechamento, ágio/deságio) e exposição no bloco de ETF de `GET /assets/{id}`
  (documentar em `.docs/engine/catalog.md`).
- **Critérios de aceite:** ETF novo com N cotas e NAV coerente com a cesta comprada; seed com ETF adicionado a um banco que já
  roda deixa os bots e as posições antigas intactas; NAV recalculado a cada rodada sem comando SQL por constituinte além da
  leitura em lote das posições do fundo (medir); determinismo.
- **Dependências:** R.2.
- **Entregável (2026-09-26):** migration `000027_etf_nav_history` (ETF, dia simulado, NAV, preço de fechamento, ágio/deságio).
  Domínio (`etf/issuance.go`): `InitialTargetBasket` (quantidades-alvo pelos pesos), `InitialIssuance` (o maior número de cotas que o
  que foi de fato comprado sustenta, sem nunca criar "pela metade"; sobra fica com o participante), `NAVFromSnapshot`, `PremiumPct`,
  `FundSnapshot`, `PendingIssuance` e as constantes `InitialSharePrice` (100), `InitialFundValue` (R$ 1.000.000) e
  `ParticipantCashMargin` (1,5), todas ilustrativas. **Participante Autorizado:** uma conta única `is_bot`, sem personalidade
  (`etf.AuthorizedParticipantAccountID`, criada pelo seed), para todos os ETFs, de modo que o custo não cresça com o catálogo. Tick
  (`tick/etf.go`, ligado por `Service.WithETF`, que mantém `NewService` intacto): `issueETFs` roda no fim das rodadas, com os books já
  cotados; provisiona o caixa por evento `bot_initial_cash`, compra a cesta a mercado pelo `Submit` normal (o volume e o preço de
  fechamento dos constituintes refletem a compra), lê o que o participante detém e cria as cotas por `ETFShareRepository.Create`;
  constituinte sem liquidez ou falha de negócio adia a emissão ao próximo tick sem abortar. `closingETFNAVs` faz **uma leitura em
  lote** das posições de todos os fundos (`ETFFundRepository.ListFunds`) e grava o NAV de fechamento em `etf_nav_history` dentro do
  `SaveTick`. Um ETF novo entra sozinho na fila (fundo ligado e 0 cotas), então o catálogo pode crescer sem mexer nas posições
  existentes. `GET /assets/{id}` ganha `nav`, `premium_pct`, `nav_day` e `shares_outstanding` no bloco de ETF (omitidos até a
  emissão), documentado em `.docs/engine/catalog.md` e `.docs/engine/tick.md`.
- **Testes:** cesta-alvo, emissão (completa, book que absorveu só parte, sem constituinte), NAV e ágio (table-driven); no tick,
  emissão completa, parcial, sem liquidez, constituinte fora do universo, falha do exchanger e ausência de `WithETF`, e NAV de
  fechamento; handler com e sem NAV e com erro. `golangci-lint` (0 issues), `go build`, `go test ./...` passam. **Validado ao vivo**
  no compose: o primeiro tick emitiu 9.938 cotas com a cesta dos 4 constituintes, NAV 100,01 na emissão, cotas em posições iguais a
  `outstanding_shares`, float de cada constituinte conservado (soma das posições igual a `outstanding_shares`), 0 saldos negativos, e
  o segundo tick gravou o NAV do dia seguinte (99,22).
- **Limites conhecidos, para não parecerem resolvidos:** (1) o **iNAV por rodada não foi calculado**: só o NAV de fechamento, porque
  nada o consome antes da R.5 (Market Maker ancorado no iNAV), que o calcula em memória a partir de `equityRoundState` e do
  `ListFunds` já lido. (2) **Não medi a contagem de comandos SQL por tick com 1, 5 e 10 ETFs** (critério de aceite): o custo
  estrutural é 1 consulta de pendentes, 1 de fundos com cotas, 1 de posições em lote e 1 INSERT por ETF no `SaveTick`, mas a
  medição fica para a R.12. (3) O preço do próprio ETF ainda vem do GBM, então o ágio/deságio (-9%, depois -4,6%) diverge até a R.4.
  (4) Os 9.938 cotas emitidas ficam com o Participante Autorizado; quem as vende ao mercado é a R.4/R.6.

### R.4 · ETF entra no book real (fim do GBM) ✅
- **Descrição:** ETF entra no universo de negociação (`buildEquityUniverse`, hoje só Ação e FII), sai do GBM (`tick.go`) e passa
  a formar preço pela última negociação. Cobertura de Market Maker (`market_maker_coverage`, teto de 10 ativos por MM) e
  provisionamento das cotas do MM pela mesma criação da R.3. Escopo de bot por classe de ativo (`AssetClasses`, como o FII);
  Fundamentalista não concorre (sem empresa, mesma regra do FII); peso do ETF no orçamento de turnos por valor de mercado
  (cotas x preço); giro-alvo, piso de 1 turno por dia e teto de ordem sem histórico (Q.8, Q.9, Q.11) valendo para ele.
- **Critérios de aceite:** ETF cotado dos dois lados todos os dias; nenhum dia sem negócio (piso rígido); volume dentro da faixa
  do giro-alvo; compra e venda a mercado de um usuário preenchem (cenário do achado 013); custo por tick medido com 1, 5 e 10
  ETFs.
- **Dependências:** R.3.
- **Entregável (2026-09-26):** `Advance` deixou de gerar cotação por GBM para ETF (`assetTypeETF`); `buildEquityUniverse` inclui ETF com
  cotas emitidas (ETF com `outstanding_shares` 0 ou nulo fica fora até a emissão), o que faz valerem para ele, sem código novo, o peso
  de turnos por valor de mercado, o piso de 1 turno a mercado por dia, o giro-alvo (Q.9) e o teto de ordem sem histórico (Q.11); o
  Fundamentalista não concorre (sem empresa, mesma regra do FII) e o escopo por classe (`AssetClasses`) já cobria ETF (Market Maker
  padrão e bots do seed). **Liquidez:** `coverETFs` (tick/etf.go, antes de ler o roster) garante a cobertura pelo `coverage.Ensurer`
  (teto de 10 ativos por Market Maker) e entrega ao Market Maker as cotas que o Participante Autorizado detém, por
  `ETFShareRepository.Transfer` (migration `000028`, evento `etf_share_transfer` com quantidade com sinal, sem caixa e sem alterar
  `outstanding_shares`, conservação conferida), mais o caixa de Market Maker (`bot.InitialCash`). O critério é "candidato = ETF com
  cotas e (sem cobertura ou participante com inventário)", então um banco que já tinha o ETF emitido (R.3) é coberto no primeiro tick
  e uma falha no meio é retomada no seguinte. `ETFFundRepository` ganhou `ProvisionCash(conta, valor)` e
  `ListMarketMakingCandidates`; `Service.WithETF` agora recebe um `ETFDeps`.
- **Testes:** cobertura e entrega das cotas (caixa de 2x), participante sem cotas (só cobertura), ETF fora do universo, erro de infra,
  universo com ETF emitido/novo/sem float, `Advance` sem quote de ETF e validação de `ShareTransfer`. `golangci-lint` (0 issues),
  `go build`, `go test ./...` passam. **Validado ao vivo** (banco já com o `SINT11` emitido na R.3): o primeiro tick cobriu o ETF com o
  Market Maker 1 e transferiu as 9.897 cotas do participante; o ETF passou a formar preço por negociação (cotações 95,63, 96,59 e
  97,56 nos 3 dias, volume diário de 28, 3 e 10 cotas, ágio de -3,7% a -3,4%, contra -9% com o GBM), o book teve os dois lados
  cotados, cotas em posições iguais a `outstanding_shares` (9.938) e, no cenário do achado 013, compra e venda a mercado de um usuário
  novo preencheram (5 cotas a 98,54 e 5 a 96,58).
- **Limites conhecidos:** (1) **não medi o custo por tick com 1, 5 e 10 ETFs nem o giro-alvo em várias semanas**, que ficam para a
  R.12 (só há 1 ETF no seed); o volume diário observado é baixo (3 a 28 cotas, 0,03% a 0,3% do float) porque o ETF, com valor de
  mercado de ~R$ 1 milhão, recebe só o turno de piso e ordens dimensionadas pelo giro-alvo, mas isso ainda não foi confrontado com a
  faixa alvo. (2) Um ETF emitido num tick só negocia a partir do tick seguinte. (3) A cotação do Market Maker ainda gira em torno do
  último preço, não do iNAV (R.5).

### R.5 · Market Maker do ETF ancorado no iNAV ✅
- **Descrição:** o formador de mercado de um ETF real cota em torno do iNAV, não do último preço. `MarketMakerQuotePrices`
  recebe um preço de referência opcional (o iNAV do ETF); ações e FIIs seguem cotando pelo último preço. Manutenção de cotação
  (P.4) passa a recotar quando o iNAV se move além da tolerância, não só quando o preço muda; spread e obrigações do formador
  (P.6) valem também para o ETF.
- **Critérios de aceite:** com os bots sem ordem, o preço do ETF fica dentro do spread do MM em torno do iNAV; ágio/deságio
  médio medido pequeno num mercado calmo; teste da referência opcional sem mudar o preço das ações (mesma seed, mesmo mercado).
- **Dependências:** R.4.
- **Entregável (2026-09-26):** `bot.QuoteReferencePrice(último preço, iNAV opcional)` (função pura; iNAV nulo ou não positivo cai no último
  preço) e `MarketMakerQuotePrices` recebe a referência já escolhida, então o cálculo de spread não mudou e Ação e FII seguem
  exatamente como antes (iNAV nil). No tick, `loadETFFunds` lê uma vez por tick o estado dos fundos (`ListFunds`, 2 consultas) e
  `roundRun.inav` calcula o iNAV em memória a cada chamada, com os preços correntes dos constituintes (os fills das rodadas já
  contam), sem comando de banco. `maintainQuote` usa a referência tanto para os preços ideais e a tolerância de recotação quanto
  para a decisão de cotação (uma cópia do estado com o preço trocado; o estado real, com o último preço, segue sendo o que os fills
  atualizam), então o Market Maker recota quando o iNAV se move além da tolerância, não só quando o preço muda. Spread e obrigações
  do formador (P.6) já valiam, por serem do arquétipo.
- **Testes:** `QuoteReferencePrice` table-driven; no tick, Market Maker cobrindo uma ação e um ETF (iNAV 120 contra último preço 90):
  ETF cotado a 118,8 e 121,2 e a ação a 99 e 101 (referência opcional sem mudar a ação); `roundRun.inav` acompanhando um fill,
  constituinte fora do universo e ativo que não é ETF. `golangci-lint` (0 issues), `go build`, `go test ./...` passam.
  **Validado ao vivo** (12 ticks no `SINT11`): ágio/deságio médio absoluto de **1,04%** (máximo 3,66%), contra -9% a -3,4% com o
  Market Maker no último preço (R.4).
- **Limites conhecidos:** o critério "ágio médio pequeno num mercado calmo" foi medido só num ETF e em 12 dias, com bots direcionais
  ativos; o "mercado calmo" sem ordem de bot e a série longa ficam para a R.12. O ágio máximo de 3,66% ocorreu num dia em que ordens
  de bot moveram o preço além do spread, e é o que a arbitragem da R.6 deve reduzir. Não investiguei o salto do NAV de 98,3 para
  107,5 entre os dias 425 e 426: o NAV só acompanha os preços dos constituintes, então a origem está no movimento deles nesse dia.

### R.6 · Participante Autorizado ligado ao tick (arbitragem NAV x preço) ✅
- **Descrição:** ator mecânico (mesma conta/pipeline de ordens dos bots, `is_bot`) que roda depois das rodadas e usa
  `DecideAuthorizedParticipantAction` (H.3): ágio além da faixa morta gera criação (compra a cesta, cria cotas e as vende),
  deságio gera resgate. Executa a cesta pelo `orderexecution` nos books dos constituintes com a primitiva da R.2, escalando o
  tamanho ao que os books absorvem (fill parcial reduz a arbitragem, nunca deixa criação pela metade). Teto diário de cotas
  criadas ou resgatadas (fração do float do ETF) e só age fora da faixa morta, para o custo acompanhar a atividade e não o
  tamanho do catálogo.
- **Critérios de aceite:** com ágio induzido (ordem grande de compra de cotas), a arbitragem cria cotas e o preço volta ao NAV
  dentro de N dias; com deságio, resgata; conservação e reconciliação da R.2 mantidas; comandos por tick medidos com 1, 5 e 10
  ETFs dentro do orçamento; sem ágio, nenhum comando extra.
- **Dependências:** R.2, R.4 (R.5 melhora o resultado, mas não é pré-requisito).
- **Entregável (2026-09-26):** `etf/arbitrage.go` (funções puras): `ArbitrageSignal` (direção e desvio de preço contra iNAV), `ArbitrageShares` (lote
  proporcional ao desvio, teto diário de 2% das cotas, mínimo de 1) e `SupportedShares` (o maior lote que a cesta obtida sustenta). Tick
  (`tick/etf_arbitrage.go`, `arbitrageETFs`): ágio compra a cesta pro-rata dos constituintes (descontando o que o participante já detém), cria as cotas
  que ela sustenta e as vende a mercado; deságio compra cotas, resgata e vende a cesta; uma ação por ETF por tick, só fora da faixa. Roda **depois da
  passada final de cotação** (extraída para `finalQuotePass`) e, se negociou, uma segunda passada recota o que consumiu. Caixa provisionado só pelo que falta
  (`ETFParticipant.ParticipantCash`, novo). `FundSnapshot` ganhou `FundAccountID`. **A faixa de ação é de 1,5% (`ArbitrageActionBandPct`), não a de 0,5% da
  função pura da H.3:** o Market Maker cota o ETF com spread de 2% (±1%) em torno do iNAV, então um último preço no bid ou no ask dele é ruído de spread; a
  H.3 (`DecideAuthorizedParticipantAction`) ficou de fora porque monta a cesta pelos pesos-alvo, e o fundo real deriva deles, então a criação e o resgate usam
  a cesta pro-rata das posições reais (`ProRataBasket`).
- **Bug real achado na validação ao vivo e corrigido:** o cache de leitura do tick (Q.1) guarda `outstanding_shares` do ativo como dado estático, mas criar ou
  resgatar cotas o muda no meio do tick; a venda das cotas recém-criadas era rejeitada por "soma das posições excede outstanding_shares" (0 vendidas). Agora
  `ETFShareRepository.Create`/`Redeem` chamam `readScope.forget` do ETF depois do commit (`read_scope.go`, teste próprio).
- **Testes:** funções puras table-driven; no tick, sem desvio (nenhum comando), ágio (lote de 200 cotas, cesta 120/80, cotas vendidas), deságio, book que absorveu
  só parte (lote cai pela metade), sem liquidez, caixa já suficiente (sem provisionar), uso de sobra de constituinte, constituinte fora do universo e sem `WithETF`.
  `golangci-lint` (0 issues), `go build`, `go test ./...` passam. **Validado ao vivo** (compose, `SINT11`): compras grandes de um usuário de teste induziram ágio e
  deságio; o participante criou e resgatou (91 criações e 106 resgates em `market_events` ao fim), cotas em posições sempre iguais a `outstanding_shares`,
  0 saldos negativos, e o ágio/deságio saiu de -9,8% (mercado drenado pelo teste) para dentro de ±1,5% em cerca de 10 dias.
- **Limites conhecidos:** (1) **não medi os comandos por tick com 1, 5 e 10 ETFs** (critério de aceite), fica para a R.12; a estrutura é 0 comando sem desvio e, com
  desvio, as compras e vendas da cesta do lote mais 2 leituras de posição e 1 de caixa. (2) A execução é a mercado, então o participante paga o spread do formador
  (perde dinheiro em cada ciclo, coberto pelo provisionamento de caixa, que cresce só pelo que falta); calibrar isso e o tamanho do lote é da R.12. (3) Quando o
  book do lado necessário está vazio (por exemplo, um usuário concentrou as cotas), a arbitragem adia sem agir e o desvio persiste até o Market Maker recotar. (4) A
  validação ao vivo deixou o usuário de teste `11111111-1111-1111-1111-111111111111` com ~9.000 cotas do `SINT11` no banco de desenvolvimento (o book só absorve ~40
  por dia); resetar o volume do Postgres restaura o mercado.

### R.7 · Rebalanceamento periódico e tracking error ✅
- **Descrição:** a cada `rebalance_frequency_days` (padrão 14, o ciclo de relatório) e quando o peso de um constituinte deriva
  além de um limite (variação forte de preço), o fundo calcula com `RebalanceOrders` (H.2) as ordens necessárias e as executa a
  mercado na última rodada do dia (análogo ao leilão de fechamento), pela conta do fundo. Grava o **tracking error** contra o
  índice teórico (pesos-alvo sem atrito) em `etf_nav_history`.
- **Critérios de aceite:** teste table-driven "composição de partida, preços, pesos-alvo, ordens esperadas"; tracking error
  medido e diferente de zero (atrito do spread e do timing); nenhuma ordem fora do dia de rebalanceamento ou de deriva; fundo
  sem caixa negativo (venda antes de compra quando faltar caixa).
- **Dependências:** R.3.
- **Entregável (2026-09-26):** `etf/rebalance_plan.go` (funções puras): `RebalanceDue` (calendário), `WeightDriftPct` (gatilho de deriva, 5 pontos percentuais),
  `PlanRebalance` (`RebalanceOrders` sobre a cesta real, pesos reescalados, ordens abaixo de 0,5% do patrimônio descartadas, vendas antes de compras),
  `AffordableBuyQuantity` (compra limitada ao caixa, folga de 2%), `TheoreticalIndex` e `TrackingErrorPct`. Tick (`tick/etf_rebalance.go`, `rebalanceETFs`): depois da
  passada final e antes da arbitragem, pela conta do fundo, a mercado, `MarkRebalanced` grava `last_rebalance_day`; se negociou, o estado dos fundos em memória é relido
  antes da arbitragem. Migration `000029` (`etf_nav_history.index_value` e `tracking_error_pct`); `closingETFNAVs` avança o índice com o fechamento do dia anterior
  (`AssetForPricing.LastPrice`) e o último índice gravado (`LatestIndexValues`). `FundSnapshot` ganhou frequência, último rebalanceamento e alvos (`ListFunds` faz 1 consulta a mais, em lote).
- **Testes:** funções puras table-driven (calendário, plano com valorização, sem ordem no peso, ruído abaixo do mínimo, vendas antes de compras, cesta com constituinte cosmético,
  erros, deriva, compra ao alcance do caixa, índice e tracking); no tick, dia do calendário (venda de 200 de a e compra de 196 de b, marcação gravada), fora do calendário e sem deriva
  (nenhum comando), deriva forte fora do calendário, compra limitada ao caixa da venda, constituinte fora do universo, sem `WithETF` e índice/tracking no NAV de fechamento.
  `golangci-lint` (0 issues), `go build`, `go test ./...` passam. **Validado ao vivo** (40 ticks no `SINT11`): rebalanceou nos dias 580, 594 e 608 (14 em 14), nenhuma ordem fora
  deles, 0 saldos negativos, cotas em posições iguais a `outstanding_shares`; tracking error entre -0,01% e +0,09% nos dias comuns (atrito e arredondamento, diferente de zero).
- **Limites conhecidos:** (1) **(Na R.7 original) o tracking error subia em degrau (+7,5%, +16%, +25%) a cada ciclo de relatório** porque o dividendo dos constituintes cai no caixa do fundo
  (pago em `SaveTick`, então o NAV o vê no dia seguinte) e o índice é só de preço; a R.8 distribui esse caixa (feita), então o degrau virou oscilação. (2) (Corrigido na R.8) o rebalanceamento chegou a reinvestir o caixa de dividendo do fundo; agora usa só as posições e o que as vendas geram. (3) Não medi o custo em comandos por
  tick com 1, 5 e 10 ETFs (R.12); sem gatilho o custo é 0 comando. (4) A exposição de `index_value`/`tracking_error_pct` na API e na tela fica para a R.11.

### R.8 · Dividendos distribuídos aos cotistas ✅
- **Descrição:** o fundo é detentor dos constituintes, então já recebe os dividendos deles pelo pagamento em lote existente
  (`dividend_payment` no caixa do fundo). O ETF passa a ser **pagador de provento**: no dia de relatório ele gera um
  `dividend_event` do ETF cujo valor por cota é o caixa de dividendos acumulado dividido pelas cotas, com os cotistas
  (usuários e bots) na data-ex e pagamento dias depois, em lote (`AppendBatchTx`, Q.6). O valor a pagar entra em passivos do
  fundo (parâmetro `liabilities` do `NAV`), então o NAV cai na data-ex, como o preço de uma ação; o pagamento quita o passivo.
- **Critérios de aceite:** soma dos pagamentos aos cotistas igual ao caixa de dividendos que o fundo recebeu (sem criar nem
  destruir dinheiro); reconciliação de saldo com 0 divergências; NAV cai na data-ex e o passivo zera no pagamento; `tick` e
  `.docs/engine/tick.md` ajustados (`tick_repository.go:267` hoje diz que ETF nunca é pagador); custo do pagamento
  independente do número de cotistas.
- **Dependências:** R.3.
- **Entregável (2026-09-26):** `etf/dividend.go` (`DistributionPerShare`, `DistributionTotal`), migration `000030` (evento `etf_dividend_payout`), `tick.etfDividends`
  (chamado por `closingETFNAVs` no dia de relatório, que agora devolve também os `DividendRecord`s do ETF, somados a `Result.NewDividends`), `DividendRecord.FundLiability` e
  `PendingDividendPayment.FundAccountID`. `saveNewDividends` soma o total a `etf_details.dividends_payable` na data-ex (só quando há passivo) e `payDueDividends` chama
  `debitFundForPayout` (evento antes, depois débito do caixa do fundo e quitação do passivo). O NAV do dia da data-ex já inclui o passivo. `ETFFunds.ListShareHolders` (1 consulta em
  lote). **Decisão de sessão:** o rebalanceamento da R.7 passou a ignorar o caixa do fundo (pesos só das posições, compra só com o que a venda gera), porque senão ele reinvestia o
  dividendo dos constituintes no mesmo dia em que o fundo o distribuiria (visto ao vivo: o primeiro ciclo distribuiu R$ 0,13 por cota).
- **Testes:** `DistributionPerShare` table-driven e o total nunca acima do caixa; no tick, distribuição do caixa livre com NAV caindo na data-ex, fora do dia de relatório (nada), sem
  caixa livre (passivo anterior já cobre o caixa), arredondamento para baixo e o rebalanceamento sem tocar o caixa do fundo. `golangci-lint` (0 issues), `go build`, `go test ./...`
  passam. **Validado ao vivo** (45 ticks): 5 proventos do `SINT11`; passivo zera no pagamento; **soma dos `etf_dividend_payout` (R$ 640.889,38) igual à soma dos `dividend_payment` pagos
  aos cotistas do ETF (R$ 640.889,38)**; 0 saldos negativos; cotas em posições iguais a `outstanding_shares`; NAV cai na data-ex (por exemplo 479 para 447).
- **Limites conhecidos:** (1) o NAV faz **dente de serra de ~14 dias**: sobe quando o dividendo dos constituintes chega ao caixa (data de pagamento deles) e cai na data-ex do ETF,
  no ciclo seguinte; um ETF real distribui em janelas semelhantes, mas aqui o degrau é grande porque o dividendo sintético dos constituintes é alto. (2) O índice teórico da R.7 é só
  de preço, então o tracking error passa a oscilar (cerca de 43% a 54% no teste) em vez de crescer sem limite; torná-lo retorno total é da R.11/R.12. (3) O dividendo de ETF não tem
  IR (fora de escopo, decisão do autor em 2026-09-26). (4) Não medi o custo por tick com 1, 5 e 10 ETFs (R.12).

### R.9 · Taxa de administração ✅
- **Descrição:** o fundo acumula diariamente `expense_ratio_pct` (ao ano, sobre o patrimônio) como passivo, o que reduz o NAV;
  a quitação sai do caixa do fundo e, quando faltar caixa, o rebalanceamento vende constituintes (R.7 já trata caixa
  negativo). Gancho pedagógico do "cash drag" da proposta 5.4.
- **Critérios de aceite:** NAV do fundo sem negociação cai a taxa esperada por dia (teste numérico); tracking error acompanha a
  taxa; nenhum saldo negativo.
- **Dependências:** R.3, R.7.
- **Entregável (2026-09-26):** `etf/expense.go` (`DailyExpense`, `ExpensePayment`, `CashShortfall`, `RaiseCashOrders`, `FundSnapshot.DividendsPayable`), migration `000031`
  (`etf_details.fees_payable` e evento `etf_expense_payout`). `closingETFNAVs` acumula a taxa do dia e, no dia de relatório, quita a acumulada do caixa livre antes de calcular o provento e o NAV
  (`ETFNAVEntry.ExpenseAccrued`/`ExpensePaid`); `saveETFExpenses` (`SaveTick`) grava o evento antes de debitar o caixa e ajusta o passivo. `raiseFundCash` (tick/etf_rebalance.go)
  vende constituintes pro-rata quando o caixa livre não cobre a taxa, antes do rebalanceamento. `ListFunds` soma a taxa a pagar em `Liabilities` e lê `expense_ratio_pct`.
- **Testes:** funções puras table-driven (taxa diária, 365 dias acumulados perto da taxa anual, pagamento limitado ao caixa livre, falta de caixa, ordens de levantar caixa proporcionais e
  limitadas ao que o fundo detém); no tick, NAV sem negociação cai exatamente a taxa do dia, dia de relatório quita do caixa sem mudar o NAV, taxa fora do caixa livre do provento,
  levantar caixa vende só pela conta do fundo e nada quando o caixa cobre ou fora do dia de relatório. `golangci-lint` (0 issues), `go build`, `go test ./...` passam. **Validado ao vivo**
  (45 ticks, `SINT11`): a taxa acumulou ~R$ 61 por dia (patrimônio ~R$ 4,5 milhões x 0,5% / 365), foi quitada a cada 14 dias (3 eventos, R$ 2.728,13), 0 saldos negativos; e, forçando via SQL uma
  taxa acumulada de R$ 500.000 acima do caixa, o fundo vendeu constituintes para levantar os R$ 140.198 que faltavam e pagou tudo no dia de relatório.
- **Limites conhecidos:** (1) a taxa anual de 0,5% é pequena diante da variação do NAV por dividendo e preço (dente de serra da R.8), então o "tracking error acompanha a taxa" fica
  visível só numa série longa sem dividendo; a comparação numérica está no teste unitário (NAV cai a taxa do dia). (2) O dinheiro da taxa sai da economia (não há conta de administrador). (3) O
  levantamento de caixa não foi exercido ao vivo sem a manipulação por SQL, porque nos dados reais o dividendo dos constituintes sempre cobre a taxa. (4) Sem custo medido por tick com 1, 5
  e 10 ETFs (R.12); o custo é 1 UPDATE e (no dia de relatório) 1 evento e 1 UPDATE por ETF.

### R.10 · Reação do ETF a evento macro e balanço (atenção derivada da cesta) ✅
- **Descrição:** o ETF nunca recebe efeito direto (proposta 2.3.2). Ele reage porque os constituintes se movem, o iNAV muda e o
  arbitrador e o MM transmitem (R.5, R.6). Além disso, `applyEventAttention` (Q.10) passa a derivar a atenção do ETF da média
  ponderada da atenção dos seus constituintes, para o volume do ETF subir quando a cesta está em evento.
- **Critérios de aceite:** cinco eventos severos num setor presente na cesta movem o NAV e o preço do ETF em proporção ao peso
  do setor; ETF sem constituinte afetado não muda; orçamento total de turnos inalterado (a atenção redistribui).
- **Dependências:** R.4, R.6.
- **Entregável (2026-09-26):** `etf/attention.go` (`DerivedAttention`: média dos multiplicadores de atenção dos constituintes ponderada pelos pesos-alvo; constituinte fora do universo
  fora da média; 0 conta como 1) e `applyEventAttention` recebe os fundos carregados (`roundRun.etfFunds`) e, depois de marcar a atenção dos constituintes, marca a do ETF quando maior que 1.
  Nada muda no preço: a reação do ETF em preço e NAV continua vindo só da negociação dos constituintes (R.5, R.6). O evento por balanço também entra, porque a atenção da Q.10 já vem
  de `MacroEffectPct` por empresa, o mesmo campo que os eventos macro preenchem.
- **Testes:** `DerivedAttention` table-driven; no tick, ETF com metade da cesta em evento ganha a média ponderada, ETF sem constituinte afetado fica em 0 e os constituintes não mudam.
  `golangci-lint` (0 issues), `go build`, `go test ./...` passam. **Validado ao vivo** (5 eventos severos `negativo` no setor Mineração, `VALR3` com 40% da cesta): o volume diário do `SINT11`
  foi de ~33 cotas (média de 12 dias) para 250 no dia do evento e 65 e 62 nos dois seguintes; NAV e preço do ETF caíram junto com os constituintes.
- **Limites conhecidos:** (1) a queda de NAV do dia do evento (-11%) está misturada com a data-ex do provento (R.8, ~8%), então a proporção "peso do setor x movimento do NAV" não foi
  isolada ao vivo; o teste unitário cobre só a atenção, não a magnitude da reação. (2) Um único ETF no seed, sem grupo de controle no mesmo dia. (3) Orçamento total de turnos inalterado é
  propriedade de `AllocateTurns` (a atenção só muda os pesos do sorteio), não recoberta por teste novo. Validação de magnitude com vários ETFs fica para a R.12.

### R.11 · Frontend, lições e documentação ✅
- **Descrição:** bloco de ETF do detalhe do ativo passa a mostrar NAV, ágio/deságio, tracking error e dividendos distribuídos,
  além da composição; extrato e "Minhas Ordens" já cobrem o restante. Revisar o conteúdo da lição 2.9 (ETFs) para citar NAV,
  ágio/deságio e o Participante Autorizado (só texto, sem mudar a estrutura da trilha). `.docs/engine/catalog.md`,
  `.docs/engine/tick.md`, `.docs/backend/market.md`. Responsivo nos três breakpoints e sem travessão em texto de interface.
- **Critérios de aceite:** tela conferida no navegador nos três breakpoints; sem valor absoluto de patrimônio de outro usuário
  (RNF09); documentação de todo contrato novo no mesmo commit.
- **Dependências:** R.3 (NAV e catálogo), R.7, R.8 (tracking error e dividendos).
- **Entregável (2026-09-26):** `GET /assets/{id}` (bloco `etf`) ganha `tracking_error_pct` (`ETFNAV.TrackingErrorPct`, ponteiro porque a coluna é anulável) e `dividend_history` (reusa
  `ListDividendHistory` e `toDividendHistoryResponse`). Backend Node segue proxy 1:1, só tipos (`EtfDetails`). Frontend: `EtfCompositionPanel` mostra NAV por cota, ágio ou deságio (o rótulo
  muda pelo sinal), tracking error, cotas emitidas e uma frase de explicação (bloco omitido até o NAV existir); a página de detalhe ganha a seção "Proventos distribuídos" com o
  `DividendHistoryList` já usado por ação e FII. Lição 2.9 (`seedLessons.ts`, só texto): a revelação cita NAV, ágio/deságio, Participante Autorizado, dividendos distribuídos e a taxa de
  administração. `.docs/engine/catalog.md` e `.docs/backend/market.md` atualizados.
- **Testes:** motor (`assets_test.go`: tracking error e proventos no bloco, erro ao buscar proventos), frontend (painel com NAV, deságio, ágio e sem NAV; página do ETF), backend 599 testes, `tsc`,
  oxlint, prettier, eslint e `golangci`/`go test` do pacote passam. **Validado ao vivo** no motor rebuildado: `SINT11` devolveu NAV 431,27, deságio -0,66%, tracking error 52,6%, 9.949 cotas e
  proventos distribuídos.
- **Limites conhecidos:** (1) Tela conferida no navegador (SINT11, usuário de teste local com lições liberadas por SQL): desktop, tablet (iframe de 820px) e smartphone (iframe de 390px, tab bar embaixo, rótulo do tracking error quebra em duas linhas sem estourar). (2) [Resolvido na R.11b] O tracking error de ~52% era o efeito conhecido da R.8 (índice teórico só de preço, dente de serra do
  dividendo); um número desses na tela precisa da correção para retorno total (R.12) para não confundir quem aprende. (3) A lição 2.9 só é atualizada num banco depois de `db:seed:lessons` (rodado e conferido no banco local).

### R.11b · Índice teórico de retorno total (correção do tracking error) ✅
- **Origem:** limite conhecido da R.8 e da R.11: o índice teórico da R.7 era só de preço, então o dividendo dos constituintes (que entra no NAV) e a distribuição do fundo (que sai) apareciam como desvio, e o `SINT11` mostrava tracking error de ~52%.
- **Entregável (2026-09-26):** `etf.TheoreticalIndex` passa a somar o provento pago (`(preço + provento) / preço anterior`), `etf.IndexAfterPayout` desconta a distribuição do próprio fundo na data-ex (nunca no primeiro dia, quando o índice nasce igual ao NAV), `ETFFunds.ConstituentDividendsPaid` (1 consulta em lote por tick, `dividend_events` pagos com `payment_day` do dia anterior, que é o caixa que o NAV já enxerga) e `closingETFNAVs` recebe o dia. Sem migration nem mudança de contrato HTTP.
- **Testes:** índice com provento e desconto de distribuição table-driven; no tick, índice de retorno total com provento pago e distribuição descontada do índice (com e sem histórico). `golangci-lint` (0 issues), `go test ./...` passam. **Validado ao vivo** (série de índice zerada no banco local e 47 ticks): tracking error passou de +52% para entre 0 e -1,9%, com NAV e índice andando juntos.
- **Limites conhecidos:** (1) a série anterior de `index_value` no banco de quem já rodou a R.7 a R.11 é de preço e continua dali; para recomeçar é preciso zerar `index_value` e `tracking_error_pct` (feito só no banco local). (2) A deriva negativa (~-1,9% em 47 dias) mistura taxa de administração, caixa parado até o dia de distribuição e atrito do rebalanceamento; a decomposição por causa fica para a R.12. (3) O índice assume que o dividendo é reinvestido na hora, enquanto o fundo o segura em caixa até a distribuição, de propósito: esse é o cash drag da proposta 5.4.

### R.12 · Validação ponta a ponta e benchmark com ETFs sintéticos ✅ (dois critérios de aceite não atendidos na primeira medição: o achado 017 foi aceito sem correção; o 016 foi corrigido na R.12b)
- **Descrição:** o seed sintético (`--synthetic-assets`) ganha ETFs sintéticos; o `benchmark-cobertura.sh` mede, com 30, 50 e 100
  ativos mais 1, 5 e 10 ETFs: comandos por tick, ágio/deságio médio e máximo, tracking error, cotas criadas e resgatadas por
  dia, reação a cinco eventos severos na cesta e o cenário do achado 013. Teste ponta a ponta fora do caminho feliz: catálogo
  crescendo com o mercado no ar, ETF adicionado depois, AP sem caixa, constituinte sem liquidez, ETF com um só constituinte,
  ordens de usuário concorrentes com a arbitragem, determinismo (banco clonado), conciliação de saldo, posição e cotas.
- **Critérios de aceite:** tick médio e p95 dentro de 5.000 comandos com 100 ativos e 10 ETFs; ágio médio abaixo de 1%;
  conservação de constituintes e cotas; 0 saldos negativos; 0 divergências de conciliação; resultados registrados aqui.
- **Dependências:** R.1 a R.10.
- **Entregável (2026-09-26):** `seed --synthetic-etfs M` (`cmd/seed/synthetic.go`, só stack de teste, exige `--synthetic-assets`): ETFs `SYE0111` em diante com cestas de 5, 3, 8, 1 e 4 ações
  sintéticas em rodízio (deslocadas, então se sobrepõem) e o FII `TJLO11` nos de índice ímpar, pesos que somam exatamente 100. `engine/scripts/benchmark-cobertura.sh N DIAS M` mede, com ETFs: ágio e
  tracking error por ETF, criações e resgates por dia, reação a cinco eventos severos, o cenário do achado 013 nos ETFs e as invariantes. `engine/scripts/validacao-etf.sql` (saldos negativos, conciliação de
  saldo e de posição contra `market_events`, float e cotas iguais às posições, proventos de ETF pagos iguais aos recebidos, passivos não negativos). `engine/scripts/validacao-etf-e2e.sh` roda os cenários
  fora do caminho feliz num banco isolado.
- **Resultados do benchmark (40 dias cada, seed 42):**

  | Catálogo | Comandos/tick (média, p95) | Ticks > 5.000 | Ágio médio / máx (em módulo) | Tracking error médio / máx | Ordens do 013 nos ETFs |
  |---|---|---|---|---|---|
  | 30 ativos, 1 ETF (+SINT11) | 2.740, 3.128 | 0 de 40 | 1,30% / 5,36% | 0,24% / 0,61% | 4 de 4 |
  | 50 ativos, 5 ETFs (+SINT11) | 4.033, 5.135 | 2 de 40 | 1,32% / 6,18% | 0,19% / 0,42% | 12 de 12 |
  | 100 ativos, 10 ETFs (+SINT11) | 5.384, 6.844 | 32 de 40 | 1,35% / 6,83% | 0,11% / 0,50% | 20 de 20 |
  | 100 ativos, 0 ETF (base) | 4.818, 5.191 | 6 de 40 | n/a | n/a | n/a |

  Todos os ETFs emitidos (11 de 11 na maior), 0 saldos negativos, 0 divergências de conciliação de saldo e de posição, float e cotas iguais às posições, proventos de ETF pagos iguais aos recebidos, em todas as três
  configurações. Criações por dia: 2,8 (1 ETF), 7,9 (5) e 12,2 (10); resgates 1,8, 3,5 e 7,9. Reação a cinco eventos severos no setor de um constituinte (`SYE0111`, 20% da cesta): o valor da cesta a preço
  seguiu a soma dos pesos pelos preços dos constituintes (+2,63% contra +2,64 pp esperado); o NAV bruto oscila mais por causa do caixa de dividendos (R.8), por isso o script mede a cesta a preço.
- **Testes ponta a ponta (`validacao-etf-e2e.sh`, todos verdes, invariantes em zero em cada etapa):** (1) ETF adicionado com o mercado rodando: 3 ETFs novos emitidos em até 3 ticks, bots direcionais intactos (a cobertura
  criou um Market Maker novo para eles); (2) catálogo crescendo de 30 para 50 ações com o mercado no ar; (3) Market Maker de um constituinte desligado: o tick segue e a arbitragem não aborta; (4) 12 ordens de usuário
  concorrentes com o tick, sem posição negativa; (5) determinismo: banco clonado, dois motores, mesmo hash de cotações, posições, saldos e NAV. Testes unitários novos: ETF de um só constituinte (emissão, NAV e
  rebalanceamento) e `syntheticETFs`. `golangci-lint` (0 issues), `go test ./...` passam.
- **Critérios de aceite não atendidos, com registro:** (1) **tick com 100 ativos e 10 ETFs acima de 5.000 comandos** (média 5.384, p95 6.844), mas o catálogo de 100 ativos sem ETF já passa (média 4.818): os ETFs
  custam ~570 comandos por tick, o resto é o catálogo de ações; achado 017, aceito sem correção pelo autor em 2026-09-26 (o catálogo real vai demorar a chegar a 100 ativos). (2) **Ágio médio de ~1,3% contra o critério de 1%**: dispersão simétrica, e baixar a faixa da arbitragem de 1,5% para 0,75% não melhorou
  (1,58%) e quadruplicou a arbitragem; causas medidas depois (achado 016): o último negócio cai no bid ou no ask em 72% dos fechamentos (contra o ponto médio do book o ágio médio é 0,34%) e nos dias de relatório os ETFs abrem 3% a 6% de ágio por um degrau de 1 dia na data-ex do provento do ETF (sem esses dias, 0,96%).
- **Limites conhecidos:** (1) O cenário "AP sem caixa" não tem teste ao vivo: o participante recebe caixa por evento a cada operação, então falta de caixa só existe como falha do caminho de provisão, coberta no teste
  unitário (`TestArbitrageETFs_RespeitaCaixaJaExistente`); zerar o saldo por SQL quebraria a conciliação. (2) Os eventos macro do benchmark caíram num setor cujo constituinte não caiu no período (contribuição do setor
  +0,52 pp no experimento, -0,99 pp na matriz), então a magnitude de reação por peso do setor não foi validada com uma queda isolada, só a consistência entre cesta e constituintes. (3) A matriz de 40 dias por
  configuração é curta para o tracking error de longo prazo (a deriva de ~-1,9% em 47 dias da R.11b não foi decomposta em taxa, caixa e atrito). (4) O experimento da faixa de 0,75% foi só uma execução (50 ativos, 5 ETFs) e foi
  revertido no código.


### R.13 · (Reserva, não agendada) ETF com renda fixa na cesta
- **Descrição:** cesta com Tesouro, CDB etc. exige marcação a mercado da renda fixa a cada rodada para o NAV e criação e resgate
  em instrumentos que não têm book. Só se abre com decisão do autor; a Fase L (correções de renda fixa) é pré-requisito.
- **Dependências:** R.12 e a Fase L.

### R.12b · Provento do ETF anunciado no iNAV das rodadas (correção do degrau na data-ex) ✅
- **Origem:** achado 016 (medição da R.12): nos dias de relatório todos os ETFs abriam 3% a 6% de ágio (média de 3,22% nesses dias contra 0,96% nos demais), porque o passivo do provento do
  ETF só nascia no fechamento (`closingETFNAVs`), depois das rodadas. O Market Maker cotava o dia inteiro com o iNAV sem o passivo e o mercado só ajustava no dia seguinte; numa ação real o preço cai na data-ex.
- **Entregável (2026-09-26):** `announcedDistributions` (`tick/etf.go`) calcula, no dia de relatório, o provento de cada ETF (`etf.DistributionPerShare` e `DistributionTotal`, que dependem só de caixa, passivo e cotas)
  e `roundRun.etfAnnounced` o soma ao passivo em `roundRun.inav`. Só o iNAV usa o valor antecipado: o evento, o passivo do fundo e o NAV de fechamento seguem de `etfDividends`, então a conservação de dinheiro não muda.
  Não mexeu em `raiseFundCash` nem no rebalanceamento (o anúncio fica num campo à parte, não em `etfFunds`, senão a falta de caixa da taxa seria calculada errado).
- **Testes:** `announcedDistributions` (caixa livre, passivo anterior, sem caixa, fora do dia de relatório, sem fundos) e iNAV que cai o provento anunciado. `golangci-lint` (0 issues), `go test ./...` passam. **Validado ao vivo**
  (50 ativos, 5 ETFs, 40 dias, mesma seed): nos dias de relatório o ágio médio caiu de **3,22% para 1,15%** e o máximo de 6,48% para 2,30%; ágio médio geral de 1,32% para **1,04%** (0,92% na série de 40 dias);
  contra o ponto médio do book, 0,28% (máx 1,47%); invariantes de `validacao-etf.sql` em zero; comandos por tick sem custo novo (média 4.057).
- **Limites conhecidos:** (1) o ágio contra o último negócio segue perto de 1% porque o último negócio cai no bid ou no ask em 175 de 234 fechamentos (o spread do Market Maker); a métrica contra o ponto médio do book é a
  que mede desequilíbrio de verdade. (2) A taxa acumulada do dia não entra no anúncio (~0,001% do patrimônio). (3) Se `raiseFundCash` vender constituintes por falta de caixa, o anúncio pode ter sido calculado antes disso;
  nesse caso o caixa livre é zero e o fechamento não distribui nada, então o iNAV das rodadas ficou com um passivo que não se confirma, por um dia, sem efeito nos saldos.

## Fase S — Correções da validação ponta a ponta do mercado simulado (achados 018 a 023)

**Origem:** validação ponta a ponta de 2026-09-26 (`tmp/relatorio-e2e-mercado-simulado.md`, scripts em
`engine/scripts/e2e-mercado-simulado/`), que passou nas invariantes financeiras mas expôs 6 pontos de decisão, todos decididos
pelo autor em 2026-09-26 (registro completo em `pontos-em-aberto-decisao-produto.md`, achados 018 a 023).

**Decisões do autor (2026-09-26):**
1. **Escala de tempo (019 + 022):** calendário real acelerado: **1 dia real = 5 dias simulados** (fator 5 ajustável), 5 ticks por
   dia real espaçados (~4h48). **Dia simulado = dia de calendário** (7 por semana, data-base fixa numa segunda-feira, feriados
   ignorados por ora). Tempos do mundo real: trimestre/ciclo de relatório = 91 dias (crescimento de 3% e DY reais por trimestre),
   Copom = 45 dias, rebalanceamento de ETF trimestral (91), FII paga proventos a cada 30 dias, mês de IPCA = 30 dias. Selic/CDI
   rendem só em dia útil (base 252); IR da renda fixa conta dias corridos direto. Tudo que usa relógio de parede (prazo/IR/VNA da
   renda fixa, datas de dividendo e DY de 12 meses, dia do roteiro sandbox) passa a derivar do dia simulado.
   **Fim de semana simulado (~9h30 reais) com mercado fechado:** negociação de renda variável e renda fixa bloqueada com aviso
   claro; sandbox, lições e cancelamento de ordem seguem abertos; bots não negociam nesses dias.
   **Calendário da simulação no frontend:** relógio do mercado no TopBar mais tela Calendário (mobile first, gamificada), com
   eventos macro, Copom, balanços, dividendos e os eventos do próprio usuário.
2. **Agenda do tick (018):** horário fixo (00:00 America/Sao_Paulo) com recuperação limitada de dias perdidos (teto de K dias,
   ex.: 3) e trava contra tick duplicado.
3. **Gate de lições (020):** passos sequenciais (`step` só `currentStep` ou `currentStep + 1`) mais tempo mínimo entre avanços
   (ex.: 5 s, ajustável).
4. **Preço e book (021):** bid/ask e profundidade visíveis, custo estimado e preço médio executado no diálogo, mensagem clara
   para all-in; carteira, patrimônio e ranking marcados a **ponto médio do book** (fallback: último negócio).
5. **Sandbox (023):** escondido do mercado real; só pelo Modo Aprendizado e pelas lições.

### S.1 · Dia simulado como única fonte de tempo (renda fixa, dividendos, sandbox) ✅
- **Descrição:** substituir `time.Now()` por dia simulado em `fixedincomeexecution` (DU restante até o vencimento, `days_held` do
  IR regressivo, janela do VNA), nas datas de dividendo (`period_date`/`ex_date` e `sumDividendsLast12Months`) e no índice de dia do
  roteiro sandbox. `maturity_date` e `created_at` de posição passam a ter equivalente em dia simulado (migration + backfill dos
  dados existentes). Introduz o calendário simulado (`internal/domain/simcalendar`: data-base fixa numa segunda-feira, dia simulado
  para data, dia da semana, dia útil sem fins de semana). IR regressivo conta dias simulados direto (= dias corridos). Selic/CDI
  rendem só em dia útil (base 252) e o DU restante do Prefixado/IPCA+ conta dias úteis do calendário simulado.
- **Critérios de aceite:** 21 ticks seguidos rendem Prefixado e IR coerentes com 21 dias simulados (o Prefixado deixa de resgatar
  ao preço da compra); nenhum `time.Now()` de regra de negócio restante em `internal/domain`; fecha o achado 022.
- **Dependências:** nenhuma.
- **Entregável:** `internal/domain/simcalendar` (`BaseDate` = segunda-feira 2026-01-05, `DateOf`/`DayOf`, `Weekday`, `IsBusinessDay`,
  `BusinessDaysBetween(from, to]`), com teste table-driven. `fixedincomeexecution`: `PurchaseContext`/`RedeemContext`/`SimulateContext`
  ganham `SimulatedDay` (lido de `market_calendar.current_day` pelo repositório) e `Service` deriva `now` de `simcalendar.DateOf`;
  `remainingBusinessDays` passou a contar dias úteis reais do calendário simulado (não mais `dias × 252/365`), `calendarToBusinessDays`
  virou `businessDaysAhead`; IR regressivo conta dias corridos simulados (`now - PurchasedAt`). Migration `000032_simulated_clock`:
  `positions.created_day` e `fixed_income_positions.created_day` (gravados no INSERT a partir de `market_calendar`; recompra sobre
  posição de renda variável zerada reinicia o dia, o que antes só era tratado na leitura), backfill de `created_day`, `maturity_date`,
  `dividend_events.ex_date/payment_date` e `company_fundamentals.period_date` (tempo real decorrido vira dias simulados anteriores ao dia
  corrente, ordem preservada). `sandbox.DaysSince(firstDay, currentDay)` em dias simulados. `selicRatesSince` lê
  `market_indicator_history` só de dias úteis depois do dia da compra (Selic/CDI não rendem em fim de semana nem no dia da compra).
  `saveNewDividends`/`SaveTick`/seed usam datas simuladas; `GET /assets/:id` calcula o DY de 12 meses contra o dia simulado (novo
  `CurrentSimulatedDay` no leitor de catálogo). Fora de `internal/domain`, `time.Now()` só sobrou em semente do RNG do macroevent e no
  deadline HTTP do admin (não são regra de negócio). Docs: `.docs/engine/fixedincome.md` (nota 4 reescrita), `orders.md`, `tick.md`.
  Testes: `simcalendar`, `TestService_Redeem_UsaODiaSimuladoParaPrazoEIR`, `TestRemainingBusinessDays_...`, `sandbox.DaysSince`. E2E
  (`compose.e2e.yml`): LTN2027 e LFT2029 comprados no dia 42 e resgatados no 63 renderam +0,65% (antes: 0%) e +0,56% (15 dias úteis de 21),
  IR 22,5%; SAND3 no dia 2 do roteiro vende a 102; `gating.py` sem falhas; `neg.py` ajustado pra `include_sandbox=true` (S.8). Limite
  conhecido: a Selic do tick de fim de semana ainda é gravada em `market_indicator_history` (só não rende); a S.3 decide se o tick de fim
  de semana avança Selic/IPCA.

### S.2 · Trimestre real e recalibração de fundamentos e dividendos ✅
- **Descrição:** alinhar as constantes de tempo ao mundo real em dias de calendário: `DefaultReportFrequencyDays` de 14 para 91;
  Copom de 21 para 45 (`selic.CopomMeetingIntervalDays`); rebalanceamento de ETF de 14 para 91; FII passa a pagar proventos a cada
  30 dias (hoje junto do balanço); mês de IPCA fica em 30; conferir a janela de `fundamentals_report_day` e a duração das bandas de
  evento macro (1 a 3 dias, mantidas). Refazer os benchmarks (Q.4/R.12).
- **Critérios de aceite:** retorno esperado de renda variável próximo de Selic mais prêmio de risco (não +40%/ano) num run de
  ~250 dias simulados com 20 ativos; DY anual plausível; benchmarks de custo por tick dentro do critério aceito.
- **Dependências:** S.1.
- **Entregável:** `fundamentals.DefaultReportFrequencyDays` e `catalog.DefaultReportFrequencyDays` 14 → 91; `selic.CopomMeetingIntervalDays` 21 → 45;
  `etf.DefaultRebalanceFrequencyDays` 14 → 91; novo `dividend.FIIPayoutIntervalDays` = 30 (FII paga mensal, `dividendRecordsForCycle` deixou de
  usar o dia de relatório) com `DefaultFIIYieldPerCyclePct` 0,5 → 1,1 por pagamento (~13% a.a.); reavaliação de patrimônio/carteira do FII segue
  no ciclo trimestral. `DefaultMonthDays` do IPCA já era 30 e as bandas de evento macro (1 a 3 dias) ficaram como estavam. Migration `000033`
  (default e backfill de `companies.report_frequency_days` e `etf_details.rebalance_frequency_days` de 14 para 91). Seed: patrimônio/carteira
  dos FIIs passa a `cotas × preço inicial` (P/VP = 1; com 500M/300M o patrimônio por cota era 3 a 5 vezes o preço e o provento dava DY absurdo;
  só vale pra banco novo). Testes ajustados (dia de relatório 91, `Day: 90`) e novo `TestAdvance_Dividendos_FIIPagaMensalEEmpresaTrimestral`
  (12 pagamentos em 365 dias). Validação e2e (compose.e2e, 20 ativos sintéticos, 200 dias): ações +5% de preço médio em 200 dias e DY
  ~17% a.a. (antes de S.2: ciclo quinzenal, ~+40% a.a. de crescimento), Selic 10,5%; a média de retorno total fica na faixa Selic mais
  prêmio, com DY das ações acima do real (payout de 50% do lucro trimestral, calibração fina segue na Fase K). **Não refeito:** os
  benchmarks Q.4/R.12 de custo por tick (`benchmark-cobertura.sh`), que rodam contra o Postgres do compose de desenvolvimento; a
  mudança de cadência não altera o número de comandos por rodada, só a frequência de dia de relatório. Achado novo 024 (deriva de FII
  sem âncora, -49% em 200 dias, já existente antes da S.2) registrado em `pontos-em-aberto-decisao-produto.md`. Docs: `.docs/engine/{tick,macroevent,catalog}.md`.

### S.3 · Agenda do tick: 5 ticks por dia real, horário fixo e recuperação limitada ✅
- **Descrição:** (fim de semana simulado: o tick avança o calendário mas não roda rodada de bot nem cotação de Market Maker.) `scheduler.RunDaily` vira agenda ancorada (00:00 America/Sao_Paulo, 5 ticks espaçados por ~4h48), lê o último
  tick de `market_calendar` na subida, recupera dias perdidos até o teto K e usa trava (advisory lock) contra tick duplicado entre
  instâncias e contra o `POST /admin/tick`. Fator 5 e teto K configuráveis por env. Ordem "day order" passa a valer por dia simulado
  (~5h reais): conferir a mensagem de expiração no frontend.
- **Critérios de aceite:** deploy repetido no mesmo dia não impede nem duplica tick; motor fora N dias recupera até K; teste com
  relógio injetado; fecha os achados 018 e 019.
- **Dependências:** S.1, S.2.
- **Entregável:** `scheduler.RunDaily` virou `scheduler.Run` com `Config` (slots ancorados na meia-noite de `America/Sao_Paulo`, 5 por dia,
  espaçados por 4h48; `SlotOf`/`NextSlotStart`/`Plan` puros, relógio injetável). Na subida e a cada slot, `tick.Service.RunScheduled(plan)` pega a
  trava e só então lê o último tick (`market_calendar.updated_at`, `TickRepository.LastTickAt`) e decide quantos rodar (slots perdidos, teto
  `TICK_MAX_CATCHUP` = 3, excedente descartado com log; nunca rodou = 1). Trava: `pg_try_advisory_lock` numa conexão dedicada
  (`TickRepository.TryLockTick`, interface `tick.Guard` via `WithGuard`), compartilhada com `POST /admin/tick`, que responde `409` (`ErrTickInProgress`) se
  outro tick está rodando; a agenda com trava ocupada apenas pula. Fim de semana simulado: `execute` não passa rodadas de bot (sem
  Market Maker nem cotação nova), o calendário/Selic/dividendos/fundamentos seguem. Env: `SIMULATION_DAYS_PER_REAL_DAY` (5), `TICK_MAX_CATCHUP` (3),
  `SCHEDULER_TIMEZONE`, `TICK_SCHEDULER_ENABLED` (`compose.e2e.yml` desliga e segue manual); `time/tzdata` embutido. Backend:
  `engineAssetPriceHistoryReader` (janela do ranking) deixou de supor 1 tick = 1 dia real: mapeia data real para dia simulado (×5) e escolhe a última
  cotação até ele, já que o fim de semana não tem cotação (teste novo). Frontend: "Expirada no fechamento do dia" segue correto (dia de mercado), sem mudança.
  Testes: `scheduler` (slots, próximo slot, plano, recuperação na subida), `tick` (plano sob trava, plano 0, trava ocupada, fim de semana sem rodadas), `admin` 409.
  E2E (motor com agenda ligada contra o compose): 1ª subida roda 1 tick; reinício no mesmo slot roda 0; 12 h de atraso recupera 2; 3 dias de atraso recupera 3 (de 15).
  Docs: `.docs/engine/tick.md`. Fecha os achados 018 e 019 (revalidação final na S.9). Pendências resolvidas em 2026-09-27 (decisão do autor): (1) `selic.IsCopomMeetingDay` empurra a reunião nominal
  (dias 45, 90, 135...) que cai em sábado/domingo simulado pro próximo dia útil (dia 90 vira 91, dia 180 vira 182), uma reunião por intervalo, sempre em dia
  útil, com testes; a Selic só muda em dia útil e o IPCA mensal segue como estava. (2) Testes da trava: `db/tick_lock_integration_test.go`
  contra Postgres real (duas instâncias = dois pools; exclusão mútua, disputa de 8 goroutines com um só vencedor, liberação quando a sessão dona cai;
  roda com `TEST_DATABASE_URL`, senão é pulado) e `TestService_TickAgendadoEmAndamentoBloqueiaManualEOutraInstancia` (manual e agenda de outra instância
  durante um tick em andamento, com `-race`).

### S.4 · Gate de lições: passos sequenciais e tempo mínimo ✅
- **Descrição:** `POST /lessons/:id/progress` só aceita `step` igual a `currentStep` ou `currentStep + 1`; avanço exige tempo mínimo
  desde o último passo (constante configurável, ex.: 5 s), com coluna/timestamp em `user_lesson_progress`. Caso de uso, erro de
  domínio (`422`), teste, `.docs/backend/lessons.md`. Reabrir lição concluída e o passo 0 não são afetados.
- **Critérios de aceite:** pular direto para o passo 3 e avançar sem esperar retornam `422`; fluxo normal do frontend inalterado; o
  script de `gating.py` passa a levar o tempo mínimo por passo; fecha o achado 020.
- **Dependências:** nenhuma.
- **Entregável:** `AdvanceLessonUseCase.assertStepAllowed` (só lição não concluída): `step` precisa ser o `currentStep` gravado
  (0 se sem linha) ou o seguinte, senão `LessonStepOutOfOrderError`; avançar pro seguinte antes de `LESSON_MIN_STEP_INTERVAL_MS`
  (padrão 5000, env de mesmo nome lida em `app.ts`, valor inválido cai no padrão) desde `user_lesson_progress.updated_at` dá
  `LessonStepTooFastError` com `retryAfterMs`. Router responde `422` com `code` `step_out_of_order`/`step_too_fast`. Sem migration:
  reaproveita `updated_at` (exposto como `LessonProgressRecord.updatedAt`); relógio injetável no caso de uso e no fake do repositório
  pros testes. Decisões: reenviar o passo atual não espera (idempotente, ex: trocar aposta); sem linha ainda o primeiro avanço nunca
  espera (o frontend só chama a rota ao sair do passo 0, então não há "início" no servidor); voltar de passo numa lição não concluída
  é recusado. Frontend inalterado (só avança `step + 1`, lê o passo do servidor; um clique antes de 5 s cai no erro genérico "Tente de
  novo"). Docs em `.docs/backend/lessons.md`. E2E: `compose.e2e.yml` ganha `LESSON_MIN_STEP_INTERVAL_MS=300`, `lib.complete_lessons`
  espera 0,35 s por passo, `gating.py` afirma os dois `422`; trilha de 35 lições pelo fluxo normal em 38 s, pulo direto retorna `422`.

### S.5 · Rota de book: melhor bid/ask e profundidade resumida ✅
- **Descrição:** `GET /assets/{id}/book` no motor (melhor bid, melhor ask, ponto médio, profundidade agregada nos N primeiros níveis,
  sem expor ordens nem donos) e proxy `GET /market/assets/:id/book` no backend, com Zod, teste e docs (`.docs/engine/`,
  `.docs/backend/market.md`). Ativo sandbox devolve o preço do roteiro sem book.
- **Critérios de aceite:** nunca vaza identidade nem tamanho de ordem individual; lado vazio devolvido como nulo; fecha a parte (a).
- **Dependências:** nenhuma.
- **Entregável:** motor: `orderbook.Level`/`orderbook.Snapshot`/`BuildSnapshot` (função pura nova, `internal/domain/orderbook/snapshot.go`) —
  agrega bids/asks em níveis por preço, ordena por prioridade, recorta aos `depth` primeiros e calcula melhor bid/ask/ponto médio;
  `BestBid`/`BestAsk`/`MidPrice` e `Bids`/`Asks` ficam `nil` (JSON `null`) quando o lado correspondente está vazio.
  `orderexecution.BookResult`/`Repository.AssetBook`/`Service.AssetBook` (novos, `service.go`) — sem regra de domínio própria, só
  repassam pro repositório. `db.OrderExecutionRepository.AssetBook`/`BookLevels` (`order_execution_repository.go`): ramo sandbox
  reaproveita `sandboxPriceForUser` (extraído do ramo sandbox de `referencePrice` — mesma fórmula, dois consumidores agora) com
  `userID` opcional (sem posição/usuário cai no dia 0 do roteiro, mesmo fallback já existente de quem nunca operou o ativo); ramo
  Mercado Ao Vivo lê `BookLevels` (`SELECT side, price, SUM(quantity - filled_quantity) ... GROUP BY side, price`, mesmo filtro de
  `loadRestingOrders` mas sem juntar `accounts`/`positions`) e agrega via `BuildSnapshot`. `httpserver.handleGetAssetBook`
  (`book.go`, rota `GET /assets/{id}/book`, `defaultBookDepth = 5`) valida `user_id` opcional (UUID) e monta a resposta
  `{ is_sandbox, price, best_bid, best_ask, mid_price, bids, asks }` — sandbox só preenche `price`, o resto vem `null`.
  `orderSubmitter` ganhou `AssetBook` (mesmo `*orderexecution.Service` que já implementa `Cancel`/`ListOrders`). Testes:
  `orderbook` (6 casos da função pura), `orderexecution.Service` (passthrough + propagação de erro), `httpserver` (Mercado Ao Vivo,
  lado vazio devolve `null`, sandbox, 404/400/500/503). Backend: `CatalogReader.getAssetBook(id, userId)`
  (`application/ports/catalogReader.ts`, tipo `AssetBook`), `engineCatalogReader.getAssetBook` (query `user_id`),
  `GetAssetBookUseCase`, rota `GET /market/assets/:id/book` (`marketRouter.ts`) — sempre injeta o `userId` do token (mesmo padrão de
  `GET /market/calendar`), nunca aceita um da requisição; sandbox resolve o dia do roteiro específico desse usuário. `go build`/
  `go test ./...`/`golangci-lint run` (Docker, v2.12.2, 0 issues) e `tsc --noEmit`/`eslint`/`vitest run` (646 testes) verdes. Docs:
  `.docs/engine/orders.md`, `.docs/backend/market.md`. Validado ao vivo via `docker compose up -d --build` (sem `down -v`, dados
  reais já seedados): motor direto devolveu book real de VALR3 (2 níveis por lado, melhor bid/ask/ponto médio corretos) e preço do
  roteiro de SAND3 (100 sem `user_id`/posição zerada, 103 com `user_id` de um usuário com posição real — `created_day` 818 contra
  `current_day` 826); 404 (ativo inexistente) e 400 (`user_id` não-UUID) confirmados; ponta a ponta pelo gateway
  (`POST /auth/register` → `GET /market/assets/:id/book` com o token) confirmou 401 sem token, `book` correto pros dois casos e a
  injeção do `userId` do token.

### S.6 · Marcação a ponto médio (carteira, patrimônio e ranking) ✅
- **Descrição:** patrimônio de posição de renda variável marcado ao ponto médio do book, com fallback para o último negócio quando
  falta um dos lados; aplicar em `GET /market/me/account`, no cálculo de patrimônio do ranking e no perfil. Gráfico e variação do
  dia seguem no último negócio.
- **Critérios de aceite:** um negócio de 1 cota não altera o patrimônio marcado de outra carteira além do ponto médio; teste de
  não manipulação por wash trade; fecha a parte (b).
- **Dependências:** S.5.
- **Entregável:** sem mudança no motor — reaproveita `GET /assets/:id/book` (S.5, `mid_price`) e `GET /assets` (`current_price`,
  fallback) já existentes. `markPrice(bookMidPrice, lastTradePrice) = bookMidPrice ?? lastTradePrice`, função pura duplicada (mesma
  decisão de pequena duplicação entre módulos de `inProcessProfitabilityReader.ts`) em `modules/market/domain/markPrice.ts` e
  `modules/ranking/domain/markPrice.ts`, cada uma com teste table-driven incluindo o caso de wash trade (mid presente ignora
  qualquer último preço, por mais distante que esteja). `GetMyAccountUseCase` (`GET /market/me/account`) ganhou dependência de
  `CatalogReader` e `loadMarkPrices`: só ativos distintos de renda variável **não sandbox** da carteira do usuário (sandbox nunca
  teve book real, RF12/RNF08, fica sem o campo) — um `GET .../book` por ativo distinto mais um `GET /assets` pro fallback; usuário
  sem posição real não faz nenhuma chamada extra. Cada `MyAccountPosition` ganhou `markPrice?: number` (`getMyAccount.ts`,
  `services/market/types.ts`). `engineCurrentAccountStateReader.ts` (ranking "agora", usada também pelo perfil via
  `GetNetWorthUseCase`/`inProcessProfitabilityReader`) trocou o `current_price` de `GET /assets` por essa mesma marcação por ativo
  distinto da carteira — cobre "ranking" e "perfil" com uma única mudança, já que o perfil reaproveita o mesmo `NetWorthReader`.
  Replay (`asOf` passado, baseline) continua no último preço histórico (`GET /assets/:id/quotes`) — o motor não guarda histórico de
  book, só de última cotação; documentado em `.docs/backend/ranking.md`. Frontend: `MyAccountPosition`/`PositionLike` ganharam
  `markPrice?`; `calculateAccountTotals` usa `markPrice ?? averagePrice` (só muda o resultado pra posição real de renda variável,
  sandbox/renda fixa inalterados) — fecha o "fora de escopo" documentado antes na S.6.0.3 em `NetWorthCards` (comentário
  reescrito). Fakes: `fakeCatalogReader.booksByAssetId` (book por ativo distinto, precedência sobre `book` único). Testes: 659
  backend (13 novos: `markPrice` × 2 módulos com 3 casos cada, `getMyAccount` com 4 casos incluindo sandbox sem `markPrice` e
  fallback, `engineCurrentAccountStateReader` com 5 casos incluindo wash trade explícito), 755 frontend (1 novo em `accountTotals`);
  `npm run lint`/`build` (backend) e `tsc`/`oxlint` (frontend) verdes nos dois. Validado ao vivo via `docker compose up -d --build` (stack `tccsim`, seed do motor + lições): compra
  real de VALR3 (book com os dois lados, mid 97,44) devolveu `markPrice: 97.44` em `GET /market/me/account` igual ao `mid_price` do
  book (preço executado da ordem foi 98,41, nunca usado como marcação); `GET /ranking` do mesmo usuário bateu com o cálculo manual
  usando 97,44; posição sandbox (SAND3) confirmada sem `markPrice`.

### S.7 · Frontend: bid/ask, custo estimado e preço executado no diálogo de ordem ✅
- **Descrição:** painel "Nova ordem" mostra melhor bid/ask e "custo estimado" contra o book; resultado informa preço médio
  executado; "comprar o máximo" calcula pela profundidade real e o `422` de saldo/quantidade ganha mensagem clara com a quantidade
  máxima. Responsivo nos três breakpoints e tokens de identidade visual; sem em dash no texto de UI.
- **Critérios de aceite:** all-in por último preço deixa de cair em `422` genérico; teste de componente e navegação real.
- **Dependências:** S.5.
- **Entregável:** frontend só (`frontend/`, sem mudança de rota — reaproveita `GET /market/assets/:id/book` da S.5 e
  `GET /market/me/account` já existentes). Serviço `getAssetBook` + tipos `AssetBook`/`BookLevel` (`services/market`) e
  `useAssetBookQuery` (relê a cada 15s, mesmo padrão do relógio). Lógica pura nova em `features/market/orderBook`
  (`estimateExecution`/`estimateOrderCost` — caminha os níveis do book pro lado certo da ordem e extrapola o resto pelo preço
  médio já encontrado quando a profundidade visível de 5 níveis não cobre a quantidade pedida, em vez de cair pro último negócio
  como o achado 021 descrevia; `maxAffordableQuantity` — mesma conta pra "comprar o máximo"; `averageFillPrice` — preço médio
  ponderado dos `fills` da ordem) e `features/market/orderRejection` (`classifyOrderRejection` distingue as duas causas de `422`
  que não são `market_closed` nem ordem pendurada furada pelo texto de `err.message`, já que o motor não devolve `code` pra
  elas; `describeOrderRejection` monta a mensagem clara — compra usa `maxAffordableQuantity` contra o book, venda usa a posição
  em carteira direto, sem depender do book). `EquityOrderTicket` ganhou `book`/`cashBalance`/`ownedQuantity`: com book real (não
  sandbox) mostra a linha "Compra · Venda (book)" e troca "Preço unitário"/"Total" por "Preço médio estimado"/"Custo estimado"
  calculado pela profundidade do lado certo (asks pra compra, bids pra venda); sem book (sandbox ou ainda carregando) mantém o
  fallback de sempre (último negócio × quantidade), sem regressão. Botão "Usar o máximo" (só aparece com saldo/posição
  disponíveis) usa `maxAffordableQuantity` na compra e a posição possuída na venda. `OrderConfirmationDialog` passou a consultar
  o book (mesmo padrão de `assetQuery`) e a posição da carteira; no catch de `handleConfirm`, `classifyOrderRejection` decide
  entre o banner de trava (já existia), a mensagem clara nova (saldo/posição) e o erro genérico de sempre; `successMessage`
  ganhou o preço médio executado via `averageFillPrice(fills)` em toda mensagem de compra/venda (inclusive nas duas variações
  de execução parcial já existentes, que continuam idênticas quando `fills` vem vazio — nenhuma quebra nos testes anteriores).
  `AssetDetail` injeta `book`/`cashBalance`/`ownedQuantity` via `useAssetBookQuery`/`useMyAccountQuery`. Testes: 792 frontend
  passando no total (novos: `orderBook`/`orderRejection` table-driven, `EquityOrderTicket` com book real/sem book/profundidade
  insuficiente/"Usar o máximo" nos dois lados, `OrderConfirmationDialog` com preço médio no resultado e as duas mensagens de 422
  claras); `npx tsc --noEmit`, `npm run build` e `npx oxlint` verdes (só os avisos antigos de
  `only-export-components`/`set-state-in-effect` alheios a esta tarefa). Validado ao vivo via `docker compose up -d --build` (stack `tccsim`) + `npm run dev`: usuário novo
  registrado via API, lições 0.1–2.3 marcadas concluídas direto no Postgres do stack de desenvolvimento só pra alcançar o gate
  da trilha (RF/7.0.1) sem repetir 19 lições na mão — dado descartável, não é seed do produto. Compra real de VALR3 (book com
  bid 786,74/ask 792,22): ticket mostrou a linha de book, "Preço médio estimado"/"Custo estimado" no ask; "Usar o máximo" com
  R$ 10.000 calculou 12 cotas (limitado pela profundidade do book, não só pelo saldo) e o price-flash disparou; confirmação e
  resultado bateram no preço do ask (792,22), mensagem final "Você comprou 12 VALR3 a preço médio de R$ 792,22."; do lado da
  venda, "Usar o máximo" ofereceu as 12 cotas possuídas (não a profundidade do book) e uma tentativa de vender 15 (3 a mais do
  que a posição) devolveu ao vivo "Você só tem 12 VALR3 disponíveis pra vender." em vez do `422` genérico do motor. Não coberto:
  navegação real em 375px/768px (a tela não ganhou layout novo, só linhas/botão dentro do card já responsivo do ticket — sem
  achado na revisão do CSS existente, mas sem screenshot dedicado nesta sessão).

### S.8 · Sandbox fora da lista do mercado real ✅
- **Descrição:** `GET /market/assets` (e o proxy do motor) exclui ativos `is_sandbox` por padrão, com parâmetro explícito para
  incluí-los; a tabela de Renda Variável não os mostra; Modo Aprendizado e lições continuam achando o ativo pelo ticker.
- **Critérios de aceite:** `SAND3`/`SANDPRE` somem da tabela real e continuam operáveis pelas lições; fecha o achado 023.
- **Dependências:** nenhuma.
- **Entregável:** o filtro vive no backend, não no motor (que segue devolvendo o catálogo completo, `is_sandbox` incluso):
  `ListAssetsUseCase` exclui `is_sandbox` salvo `includeSandbox`; `GET /market/assets` ganha `include_sandbox=true|false` (Zod,
  outro valor é `400`; padrão `false`). `GET /market/assets/:id` segue achando sandbox. Frontend: `listAssets`/`useAssetsQuery`
  ganham `includeSandbox` (entra na query key); só `useAssetByTicker` (lições) e `Statement` (rótulo de ativo do extrato) o pedem,
  então tabelas de Ações/Renda Fixa, Notícias, Painel Admin e o formulário de evento macro nunca veem sandbox. Docs em
  `.docs/backend/market.md`. E2E: `SAND3`/`SANDPRE` ausentes da lista padrão, presentes com `include_sandbox=true`, detalhe `200`.

### S.9 · Revalidação ponta a ponta e fechamento dos achados (por último, depois de S.10 a S.16)
- **Descrição:** rodar de novo `engine/scripts/e2e-mercado-simulado/` (sim, neg, gating, liq) com o relógio novo, conferir o retorno
  médio de renda variável, a renda fixa em 21 ticks, o all-in e o gate; marcar 018 a 023 como Resolvido em
  `pontos-em-aberto-decisao-produto.md`. Movida pra depois de S.13 a S.16 (adicionadas em 2026-09-27, fora da origem dos achados
  018 a 023) pra ser de fato a validação final única da fase, em vez de rodar o mesmo script de e2e duas vezes — a S.13 já teria
  rodado o script isoladamente no seu próprio critério de aceite, mas o fechamento formal da fase fica só aqui.
- **Critérios de aceite:** zero violação de invariante; os 6 achados (018 a 023) fechados com evidência;
  `go test ./internal/infra/db -run TickLock` com `TEST_DATABASE_URL` apontando pro Postgres do stack de teste (trava do tick,
  S.3); provento de ação (S.13) reduzindo o preço médio de mercado nos dias seguintes à data-ex no mesmo run; posição com provento
  mostrando retorno total maior que retorno de preço na proporção certa (S.15/S.16), verificado ponta a ponta pelo gateway (não só
  teste de componente).
- **Dependências:** S.1 a S.8, S.10 a S.16.

### S.10 · Calendário da simulação: endpoint de relógio e linha do tempo ✅
- **Descrição:** rota do motor + proxy no backend (`GET /market/clock` e `GET /market/calendar?from=&to=`): dia simulado, data, dia
  da semana, `market_open` (falso em sábado/domingo simulado), fator de aceleração, instante do próximo tick, dias até a abertura e
  trimestre corrente (dia N de 91). A data do Copom é a efetiva (já empurrada pra dia útil, `selic.IsCopomMeetingDay`). O calendário devolve, por dia, os fatos globais (eventos macro disparados, reunião do Copom com a
  Selic resultante, dia de relatório, data-ex e pagamento de proventos, com os futuros previsíveis marcados como próximos) e, por
  usuário autenticado, os fatos dele (ordens executadas, proventos recebidos, vencimentos e resgates de renda fixa). Nunca expõe
  patrimônio absoluto de terceiros. Zod, testes, `.docs/engine/` e `.docs/backend/`.
- **Critérios de aceite:** relógio consistente com `market_calendar`; eventos futuros só os determinísticos (Copom, relatório,
  proventos já anunciados, vencimentos do usuário), nunca evento macro ainda não disparado; paginação por janela de datas.
- **Dependências:** S.1, S.3.
- **Entregável:** novo pacote de domínio `internal/domain/marketcalendar` (`ClockAt` puro; `Service.Calendar` monta um `DayEntry` por dia da janela a partir de duas portas pequenas, `GlobalFacts` e `UserFacts`, e reaproveita `selic.IsCopomMeetingDay` e `fundamentals.IsReportDay` sem duplicar regra; teto de janela `MaxWindowDays` = 92). Infra: `db.CalendarRepository` (só leitura) e `httpserver/calendar.go` (`GET /market/clock`, `GET /market/calendar?from=&to=&user_id=`, `CalendarAPI` injetado em `httpserver.New/Run`, `next_tick_at` vem de `scheduler.Config.NextSlotStart` e é `null` com a agenda desligada). Migration `000034`: `market_events.simulated_day` (gravado no INSERT do eventstore, unitário e em lote, a partir de `market_calendar`; backfill aproximado como na 000032; índice `(user_id, simulated_day)`), porque o extrato só tinha o instante real. Futuro só com fatos determinísticos (Copom sem resultado, relatório, proventos anunciados, vencimentos do usuário); evento macro futuro nunca aparece; Copom passado traz Selic anterior e resultante; sandbox fora. Backend: port `MarketCalendarReader`, casos de uso `GetMarketClock`/`GetMarketCalendar`, adapter `engineMarketCalendarReader`, rotas `GET /market/clock` e `GET /market/calendar` (Zod nas datas; o `userId` é sempre o do token, `user_id` na query é ignorado). Testes: `marketcalendar` (relógio em sexta/sábado/domingo/virada de trimestre, janela inválida, Copom empurrado do dia 90 pro 91, Copom futuro sem resultado, evento macro futuro, proventos, fatos do usuário, sem usuário), `httpserver/calendar_test.go`, backend (caso de uso, adapter, router). E2E (`compose.e2e.yml` + seed): relógio no dia 8 e 13, calendário com Copom do dia 45 futuro, compras de renda fixa no dia 12 e vencimento futuro no dia 16 aparecendo só pro dono, `400` em data inválida e janela de 1 ano. Docs: `.docs/engine/calendar.md`, `.docs/backend/market.md`. Limites: ordem de ação a mercado não foi exercitada no e2e (o gate de produto pela trilha bloqueia o usuário de teste; a gravação de `simulated_day` é a mesma nos dois tipos de evento); o backfill de `market_events` antigos é aproximado.

### S.11 · Mercado fechado no fim de semana simulado ✅
- **Descrição:** `orderexecution` (ordens novas, a mercado e limitadas) e `fixedincomeexecution` (compra e resgate) recusam com erro de
  domínio próprio quando o dia simulado é sábado ou domingo (`422`, código `market_closed`, com `opens_at`/dias restantes); backend
  repassa e documenta. Cancelar ordem, sandbox e lições seguem abertos; bots não negociam. Frontend: botão de ordem e de aporte
  desabilitados com o motivo em texto ("Mercado fechado: fim de semana simulado. Abre em 4h12, segunda 12/01"), sem depender só de cor.
- **Critérios de aceite:** ordem no sábado simulado devolve `market_closed` sem gravar nada; sandbox continua operável; teste de
  fronteira (sexta para sábado, domingo para segunda); script de e2e ganha dia de semana no relógio.
- **Dependências:** S.1, S.10.
- **Entregável:** `simcalendar.MarketClosedError` (`Day`, `OpensOnDay`, `DaysUntilOpen()`, `OpensOn()`) e `simcalendar.CheckMarketOpen(day)`. `orderexecution.Service.SubmitByUser` (novo, usado por `POST /orders`) confere o calendário depois do `LoadContext` e recusa em sábado/domingo sem gravar nada; `fixedincomeexecution.Service.Purchase/Redeem` fazem a mesma checagem. Sandbox (`Context.Sandbox`/`IsSandbox`) e `Cancel` seguem abertos. **Decisão de desenho:** só a ordem humana é barrada; `Submit`/`SubmitWithContext` (bots de liquidez e ETF, que rodam em todo tick, fim de semana incluso: rebalanceamento e arbitragem) não checam o calendário. A primeira versão checava em `SubmitWithContext` e derrubou o tick de fim de semana com 500 (achado no e2e), por isso a separação, com teste dedicado. HTTP: `422` `{ error, code: "market_closed", opens_on, days_until_open }` (`writeMarketClosedIfClosed`) em ordem e em compra/resgate de renda fixa. Backend: `EngineRequestError` ganhou `details` (campos extras do corpo do motor) e o router os repassa 1:1. Frontend: `getMarketClock`, `useMarketClockQuery` (relê a cada 60 s), `describeMarketClosed` (função pura: "Mercado fechado: fim de semana simulado. Abre em 4h12, segunda 12/01"; a duração soma o próximo tick e os intervalos de 24h/fator), `useMarketClosedReason(isSandbox)` (não bloqueia enquanto o relógio não carrega), `MarketClosedNotice`; `EquityOrderTicket`, `FixedIncomeSimulator` e o botão Resgatar ficam desabilitados com o motivo em texto (`role="status"`, não depende de cor). Testes: `simcalendar` (fronteira sexta/sábado, domingo/segunda), `orderexecution`, `fixedincomeexecution`, `httpserver/market_closed_test.go`, backend (adapter e router), frontend (função pura, ticket, simulador, serviço). E2E: `engine/scripts/e2e-mercado-simulado/weekend.py` (usa o gateway; completa a trilha e exige `seedLessons` no backend do stack): sábado e domingo recusam ordem a mercado, limitada, compra e resgate de renda fixa com `days_until_open` 2 e 1, nada gravado, sandbox de ação e de renda fixa abertos, ticks de fim de semana sem falha com ETF ativo, segunda reabre. Docs: `.docs/engine/orders.md`, `.docs/engine/fixedincome.md`, `.docs/backend/market.md`. Não coberto: navegação real no navegador nos 3 breakpoints (a tela âncora de calendário é a S.12); o dialog de confirmação mostra a mensagem do motor se o usuário chegar a confirmar com o relógio do front defasado.

### S.12 · Frontend: relógio do mercado e tela Calendário (mobile first, gamificado) ✅
- **Descrição:** (1) chip fixo no TopBar com "Dia 132 · qua 08/07 · próximo dia em 2h14", ponteiro que avança e selo "mercado
  fechado" no fim de semana; (2) tela Calendário (bottom sheet no mobile, painel lateral fixo no desktop, composição própria por
  breakpoint): faixa horizontal de dias com marcadores (macro, Copom, balanço, dividendo, meus eventos), trimestre como barra de
  progresso "dia N de 91", listas "aconteceu" e "vem aí", legenda de convenção sólido/tracejado (passado/futuro) e linha fixa "cada
  dia real = 5 dias de mercado"; (3) teatro de recompensa leve na virada de dia (animação e toast "Novo dia: Selic X%"), respeitando
  `prefers-reduced-motion`; (4) passo novo no onboarding explicando o tempo acelerado e o fim de semana fechado; (5) responsividade nos
  três breakpoints, tokens de `identidade-visual-tokens.md`, padrões de `identidade-visual-padroes.md`, acessibilidade (alvos de
  toque ≥ 44px, texto além de cor, foco visível), sem em dash em texto de UI. Nova tela registrada em
  `inventario-telas-plataforma-investimentos.md` e mockup vivo antes da implementação (tela âncora).
- **Critérios de aceite:** usuário novo entende em uma olhada em que dia estamos, que o tempo é acelerado e por que o mercado está
  fechado; testes de componente e navegação real em 375px, 768px e 1280px.
- **Dependências:** S.10, S.11.
- **Estado de partida (2026-09-27, fim da sessão de S.10/S.11, ainda sem commit na branch `s-correcoes-validacao-e2e`):**
  - **Backend e motor prontos:** `GET /market/clock` e `GET /market/calendar?from=&to=` (datas `AAAA-MM-DD`, janela máx. 92 dias, padrão 7 atrás e 14 à frente; o backend sempre injeta o usuário do token). Contratos completos em `.docs/engine/calendar.md` e `.docs/backend/market.md`. Resumo do relógio: `{ simulated_day, date, weekday (sun..sat), market_open, days_until_open, days_per_real_day, next_tick_at (null com agenda desligada), quarter_day, quarter_length (91) }`. Resumo do calendário: `{ from_day, to_day, days: [{ simulated_day, date, weekday, market_open, events: [{ kind, scope (global|user), future, title?, direction?, ticker?, side?, quantity?, unit_value?, selic_rate?, previous_selic_rate? }] }] }`; `kind`: `macro_event`, `copom`, `report`, `dividend_ex_date`, `dividend_payment_date` (globais) e `order_executed`, `dividend_received`, `fixed_income_purchase`, `fixed_income_redemption`, `fixed_income_maturity` (do usuário). Um item por dia da janela, dias sem fato vêm com `events: []`.
  - **Frontend já existente (feito na S.11, reaproveitar, não recriar):** `services/market` (`getMarketClock`, tipo `MarketClock`), `features/market/useMarketClockQuery` (relê a cada 60 s), `features/market/marketClosedReason` (`describeMarketClosed`, a conta de "abre em 4h12, segunda 12/01"), `features/market/useMarketClosedReason`, `components/molecules/MarketClosedNotice`. **Falta** o serviço `getMarketCalendar` e seus tipos (`CalendarEvent`, `CalendarDay`, `MarketCalendar`) em `services/market`, e o hook do calendário.
  - **Mockup vivo (fonte de verdade do layout e dos textos):** https://claude.ai/artifact/CqcmBmoJfpEKeUBAnks8zn (código-fonte em `/tmp/.../scratchpad/calendario-mercado.html` pode não existir mais; o artefato é a referência; leia com `Artifact action: read`). Tela 4.11 no `inventario-telas-plataforma-investimentos.md`, TopBar em 0.2, link em `identidade-visual-padroes.md` seção 0.
- **Decisões fechadas com o autor (2026-09-27):** (a) o Calendário abre **só pelo chip do relógio** (bottom sheet no mobile, painel no tablet, painel lateral fixo no desktop), sem rota própria nem item de menu; (b) o Copom exibido é a data efetiva já empurrada pra dia útil (decisão anterior, `selic.IsCopomMeetingDay`); (c) o ponteiro do relógio **anda durante o dia**: fração = 1 - (`next_tick_at` - agora) / (24h / `days_per_real_day`), limitada a 0..1, timer local de ~30 s, relê `GET /market/clock` ao completar a volta; sem `next_tick_at` (agenda desligada) o ponteiro fica parado e o texto "próximo dia em" some. Mockup vivo: https://claude.ai/artifact/CqcmBmoJfpEKeUBAnks8zn
- **Roteiro sugerido (uma sessão só, na ordem):**
  1. `getMarketCalendar` + tipos + teste de serviço; `useMarketCalendarQuery(from, to)` (queryKey com a janela, só habilitada com o painel aberto).
  2. Função pura da posição do ponteiro (`clockProgress(clock, now)` = 1 - (`next_tick_at` - agora) / (24h / `days_per_real_day`), limitada a 0..1, `null` sem `next_tick_at`) e hook `useClockProgress` com timer de ~30 s; ao completar a volta, invalidar `MARKET_CLOCK_QUERY_KEY`. Testes table-driven da função pura (início, meio, fim, além do fim, sem `next_tick_at`).
  3. Chip do relógio no `components/organisms/TopBar` (organismo novo `MarketClock` ou molécula, seguindo atomic design), com o estado fechado tracejado e o texto de `describeMarketClosed`; no mobile só a primeira linha. Acessível: `aria-label` com dia e estado, alvo de toque >= 44px.
  4. Painel do Calendário (organismo `MarketCalendarPanel` + subcomponentes: barra do trimestre, faixa de dias, detalhe do dia, grade do trimestre no desktop, legenda). Abertura por estado no `AppShell` (contexto ou estado local), sem rota (decisão a). Mobile: bottom sheet com scrim, fecha por scrim, Esc e botão; tablet: painel abaixo da barra; desktop: painel lateral fixo/sticky ao lado da grade do trimestre (composição própria, não mobile esticado). Convenção sólido/tracejado do `identidade-visual-padroes.md` §3, ícone mais texto em todo marcador (`lucide-react`), sem em dash em texto de UI.
  5. Virada de dia: comparar `simulated_day` entre leituras do relógio; ao mudar, animação do ponteiro (respeitando `prefers-reduced-motion`) e toast dourado "Novo dia: Selic X%" (Selic vem do evento `copom` do dia, senão do último Copom; fim de semana: "Mercado fechado até segunda. Hora de estudar."). Preferir o teatro de recompensa já existente em `features/shell/RewardRevealProvider` se couber; senão um toast leve próprio.
  6. Passo novo no onboarding (`pages/Onboarding`): "Aqui o tempo passa mais rápido", 1 dia real contra 5 dias de mercado, semana com sábado e domingo tracejados, o que segue aberto (lições, Modo Aprendizado, cancelar ordem); texto e desenho do mockup.
  7. Testes de componente (chip aberto/fechado/sem agenda, painel com e sem eventos, seleção de dia, "Vem aí" só com futuros, toast) e navegação real em 375px, 768px e 1280px (checar contraste nos dois temas). Atualizar a seção 0.2 e 4.11 do inventário se algo mudar; marcar a S.12 ✅ com o Entregável.
- **Armadilhas conhecidas:** (0) **a faixa horizontal de dias nunca pode rolar na vertical** (achado do autor no mockup): `overflow-x: auto` sozinho faz o `overflow-y` virar `auto`, e a borda de 2px do dia de hoje ou o outline de foco geram rolagem vertical. Na aplicação, usar `overflow-x: auto; overflow-y: hidden`, `overscroll-behavior-x: contain`, itens com `flex: none` e folga no padding pra caber borda e foco (`outline-offset: -2px` nos dias); conferir em 375px com o dia de hoje e o dia focado no teclado; (i) `frontend/` roda no host, não em container; o e2e do backend usa `engine/scripts/e2e-mercado-simulado/compose.e2e.yml` (agenda desligada, então `next_tick_at` vem `null` lá: pra ver o ponteiro andar, subir o motor de desenvolvimento com a agenda ligada); (ii) rodar `npx prettier --write` só nos arquivos tocados, não em `src` inteiro (na S.11 ele reformatou 5 arquivos alheios); (iii) hooks antes de qualquer `return` antecipado nas páginas; (iv) lint é `oxlint` (avisos antigos de `only-export-components` não são seus); (v) checar `frontend/src/components/organisms/TopBar` e `AppShell` antes, o TopBar hoje só tem logo, `FriendsBell`, `NewsBell` e `AvatarMenu`.
- **Entregável:** frontend (`frontend/`, sem backend novo). Serviço `getMarketCalendar` + tipos (`services/market`). Lógica em `features/market/`: `calendarFormat` (rótulos, datas UTC, `formatSelic` com 2 casas), `calendarEvents` (`describeCalendarEvent`; evento macro só com título, sem a direção; Copom futuro não revela resultado), `clockProgress`/`useClockProgress` (ponteiro anda com timer de 30 s e relê o relógio ao completar a volta), `quarterCells` (91 dias do trimestre derivados só do relógio), `useMarketCalendarQuery`, `dayFlipReveal` + `useDayFlipReveal` (toast dourado via `RewardRevealProvider`, Selic do último `/market/indicators`, ponteiro gira, sem animação com `prefers-reduced-motion`), `hooks/useMediaQuery`. Componentes: `atoms/CalendarKindIcon`, `molecules/MarketClockChip` (no `TopBar`, único ponto de abertura, devolve o foco ao fechar), `CalendarDayStrip` (`overflow-y: hidden`, `flex: none`, sem rolagem vertical), `CalendarEventItem`, `QuarterGrid`, `organisms/MarketCalendarPanel`; `AppShell` guarda o estado aberto/fechado e a composição por CSS (mobile bottom sheet com fundo e Esc, tablet painel em fluxo, desktop coluna de 440px com a grade do trimestre dentro do painel, consulta do trimestre só no desktop). Onboarding ganhou o 3º slide "Aqui o tempo passa mais rápido" (1 dia x 5 dias, semana com sábado e domingo tracejados). Testes: 753 passando (função pura, chip, painel, AppShell, onboarding, serviço). Navegação real com `docker compose up` + `vite` em 375px, 800px e 1280px, tema escuro e claro: chip fechado com "Abre em 5h28, segunda 10/04", painel nos três formatos, sem rolagem vertical na faixa. Achados na navegação e corrigidos: faixa de dias colapsava no desktop (faltava `flex: none`) e a grade do trimestre transbordava (`minmax(0, 1fr)`). **Bug da S.10 achado e corrigido aqui:** a migration `000034` falhava em banco com eventos já gravados (o backfill é UPDATE e `market_events` tem gatilho append-only); agora desliga o gatilho só durante o backfill (29.946 linhas migradas no volume de desenvolvimento). Desvios do mockup: a grade do trimestre mora dentro do painel (o chip é o único acesso, decisão a); textos de provento dizem "por unidade" (o motor não distingue ação de cota no calendário). **Revisão do autor (2026-09-27, depois do mockup v2):** sem barra de progresso do trimestre (`QuarterProgress` removido); o último dia do trimestre é um bloco dourado com "fim do trim." na faixa, na grade (agora "Visão geral dos dias") e na legenda, com a etiqueta "Fim do trimestre" no detalhe; chip do relógio em duas linhas curtas no mobile ("Dia 135" / "qua 08/07", "Fechado" / "sáb 11/07"), logo em 15px, medido em 375px sem estouro (chip de 105px, gutter de 16px preservado). Não coberto: a virada de dia com o painel aberto foi coberta só por teste (o tick real leva ~4h48); alvos da grade do desktop têm ~26px (a faixa de dias, que é o caminho por toque, tem 58px).

**Origem (S.13 a S.16):** discussão com o autor em 2026-09-27, separada dos achados 018 a 023 que abrem esta fase — o autor perguntou
se o preço de uma ação cai na data-ex do dividendo (como na vida real) e se a rentabilidade mostrada ao usuário separa retorno de
preço de retorno total (preço + provento), lembrando que uma queda de preço igual ao provento pago não é perda nenhuma pro
acionista. Levantamento desta sessão confirmou dois problemas reais, sem decisão de produto pendente pra corrigir (mecanismo já
decidido pela arquitetura fechada da Fase R: preço só muda por reação de negociação dos bots, nunca um degrau/salto calculado
direto): (1) hoje o preço da ação **não reage nada** ao provento pago — `company_fundamentals.net_equity` é recalculado do zero a
cada ciclo trimestral a partir da receita (`fundamentals.DeriveFinancials`), nunca decrementado pelo valor de fato distribuído, então
o VPA que alimenta `FundamentalistFairPrice` não "sente" a saída de caixa (S.13); (2) nenhuma tela mostra ganho/perda de uma posição,
com ou sem provento — `AssetDetail` (4.5) só usa `ownedQuantity`, `Portfolio` (2.1) só agrega patrimônio total (S.15/S.16). ETF já
resolvido (R.8 credita o provento ao cotista e desconta o passivo do NAV; R.12b corrigiu o degrau de 1 dia na data-ex); FII fica
registrado como reserva (S.14) por depender de um bot de preço justo que FII não tem hoje. **S.15/S.16 são úteis e corretas
independente da S.13 rodar** — mostram o retorno real da posição (preço + provento) mesmo que o preço ainda não reaja
mecanicamente na data-ex; a ordem sugerida é S.15 → S.16 → S.13 → S.14, mas S.13 não bloqueia S.15/S.16 nem o contrário.

### S.13 · Provento de ação reduz o preço justo do Fundamentalista (conservação de valor, sem degrau direto de preço) ✅
- **Descrição:** pagar dividendo de ação credita o caixa do usuário corretamente (Event Sourcing, `payDueDividends`), mas nada do
  lado da empresa reflete essa saída — `dividendRecordsForCycle` (tick.go) gera o provento a partir de `net_income`, e
  `fundamentals.DeriveFinancials` recalcula `net_equity` do zero a cada ciclo trimestral a partir da receita, sem nunca subtrair o
  que já foi distribuído. Resultado: o preço justo do Fundamentalista (`FundamentalistFairPrice` = VPA × ROE/retorno_exigido × ...)
  não muda por causa do provento, e como o Market Maker de ação ancora a cotação no último negócio (`state.Price`, não numa fórmula
  de valor — diferente do ETF, que ancora no iNAV), nada empurra o preço pra baixo na data-ex nem depois. O retorno de preço mostrado
  ao usuário fica artificialmente inflado pelo valor do próprio provento, que já foi pago à parte em caixa.
  Correção alinhada à arquitetura já fechada (evento macro/balanço só muda preço via reação de negociação dos bots, nunca
  multiplicador/degrau direto — o mesmo motivo que vetou o "salto calculado" do motor antigo): tratar o provento pago como mais um
  input transitório de `FundamentalistFairPrice`, no mesmo padrão de `macroEffectPct` hoje — um efeito negativo (`valorPorAção / VPA`
  do ciclo em que foi pago) resolvido externamente (mesmo caminho de `tick.companyRoundContexts`) e ativo por uma banda curta de
  dias simulados (mesmo espírito de `macroevent.EffectRange`, ilustrativo/sujeito a calibração como os demais coeficientes do
  motor) — decai a zero sozinho quando o próximo ciclo trimestral já recalculou `net_equity` do zero, sem precisar de estado
  persistente novo. O Fundamentalista negocia pra convergir o preço de mercado pra baixo, exatamente como já faz hoje com uma
  surpresa de balanço ruim ou um evento macro negativo — nenhum código novo mexe em book/quote/preço diretamente.
  **Atenção não esquecer:** a atenção extra de turno (Q.10, `applyEventAttention`) hoje só liga em cima de `MacroEffectPct != 0` —
  sem incluir o efeito do provento nesse mesmo gatilho (somado a `MacroEffectPct` no ponto em que `AttentionMultiplier` é aplicado,
  ou generalizando a checagem), a fórmula fica correta mas o Fundamentalista pode não ganhar turno suficiente pra agir a tempo
  perto da data-ex, e o efeito passa quase despercebido na prática.
- **Critérios de aceite:** teste table-driven da função pura do efeito (provento zero, normal, e maior que o VPA — clampado, nunca
  preço justo negativo/zero só por este termo, reaproveitando `FundamentalistMinFairPrice`); teste de `FundamentalistFairPrice`
  mostrando o preço justo caindo proporcionalmente ao provento por ação dentro da banda de dias e voltando ao padrão fora dela;
  rodando `engine/scripts/e2e-mercado-simulado` num ativo pagador de dividendo por 2+ ciclos, o preço médio de mercado nos dias
  seguintes à data-ex fica mensuravelmente mais baixo que numa run sem a mudança, sem violar nenhuma invariante financeira já
  coberta pelo script; zero mudança em `orderbook`/`orderexecution`/Market Maker (só `bot`/`tick`/`fundamentals`, domínio puro).
- **Dependências:** nenhuma (reaproveita `dividendRecordsForCycle`, `companyRoundContexts` e o padrão de `macroEffectPct` já
  existentes).
- **Entregável:** `dividend.EquityPriceEffectPct(netIncome, netEquity)` (novo, `dividend.go`) — conservação de valor pura: o pool
  distribuído (`netIncome × DefaultEquityPayoutRatio`) reduz o preço justo na mesma proporção que reduziria o patrimônio líquido,
  válido pra ON e PN sem precisar da base de ações de cada classe; clampado em `MinEquityPriceEffectPct` (-100%). `tick.go` ganhou
  `dividendPriceEffectPct`/`dividendPriceEffectBandDays` (10 dias simulados, ilustrativo) — deriva "dias desde o último relatório"
  de `(dayIndex+1) % reportFrequencyDays` sem nenhum estado persistido novo, com guarda pro primeiro ciclo (nenhum relatório
  aconteceu ainda). `CompanyRoundContext.DividendEffectPct` (novo campo) alimenta `FundamentalistFairPrice` como um multiplicador
  a mais (`× (1 + dividendEffectPct/100)`, mesmo padrão de `macroEffectPct`/`pnPremiumPct` — não passa pelo filtro de
  `personality.KnowledgeLevel`, mesmo tratamento de "fato estrutural conhecido" já dado a `pnPremiumPct`) e é somado a
  `MacroEffectPct` no gatilho de atenção extra de turno (`applyEventAttention`, Q.10). Testes: tabela nova em
  `dividend_test.go` (zero/normal/clampado/patrimônio inválido); os dois testes de regressão ponta a ponta da F.1
  (`TestService_Run_Relatorio...`) precisaram ser ajustados — o cenário de teste sempre paga um provento no dia de relatório, então
  passaram a comparar contra um piso `noSurpriseClosing` (startPrice já com o efeito do provento) em vez de `startPrice` puro,
  já que "sem surpresa" deixou de significar "sem movimento" (o provento move o preço mesmo sem surpresa de balanço). Validação
  ponta a ponta real (não o script `e2e-mercado-simulado` — troca por verificação direta contra o catálogo seedado já existente no
  volume de dev via `docker compose up` + `POST /admin/tick`, mais direta que orquestrar o script python pra um efeito de poucos
  dias): avançando o tick do dia 900 ao 910 (dia de relatório real de BNDD3/BNDD4/VALR3 no catálogo seedado), BNDD3 caiu **-5,11%**
  exatamente no dia do provento (`day:910`) e o preço se estabilizou no novo patamar nos dias seguintes (911-914), sem voltar a
  cair — confirma o "degrau único, não continuado" pretendido pela tarefa. `go test ./...` e `golangci-lint run` (via Docker,
  0 issues) limpos.

### S.14 · (Reserva, não agendada) Provento de FII sem efeito no preço — falta bot de preço justo pro FII
- **Descrição:** o mesmo problema da S.13 existe pro provento de FII — `fii_details.net_worth`/`portfolio_value` também são
  recalculados do zero por Selic/indexador a cada ciclo (`fii.NextNetWorth`/`NextPortfolioValue`), nunca decrementados pelo valor
  distribuído mensalmente (`dividend.FIIValuePerShare`). A correção da S.13 não é diretamente portável: hoje nenhum bot lê
  `net_worth`/`portfolio_value` de FII pra decidir preço (só Chartista/Ruído/Market Maker reagem ao preço que já mudou por
  negociação) — corrigir isso primeiro exige dar ao FII um arquétipo com noção de "preço justo" (o equivalente de P/VP pra FII),
  trabalho de arquitetura maior que um ajuste pontual e fora do escopo de uma correção. Registrado como reserva pra não se perder,
  não como pendência bloqueante — a S.15/S.16 já tornam visível o retorno total real (preço + provento) de FII, então o efeito
  prático de não ter a queda ex-provento é o mesmo viés que a S.13 corrige pra ação (retorno de preço um pouco inflado), só que sem
  correção prevista ainda.
- **Dependências:** um arquétipo de bot com "preço justo" de FII (não existe hoje) — provável pré-requisito de uma fase futura, não
  desta.

### S.15 · Provento recebido por posição, exposto por ativo (motor + backend) ✅
- **Descrição:** `accounts.total_dividends_received` só existe agregado por conta (`GET /market/me/account`), sem quebra por
  ativo — hoje é impossível responder "quanto este ativo específico já me pagou de provento". A fonte já existe em
  `market_events` (`event_type = 'dividend_payment'`, `user_id` + `asset_id` + `quantity` + `unit_value`, gravado por
  `payDueDividends`, Event Sourcing) — falta só agregar. Motor: `GET /positions?user_id=` ganha `dividends_received` (soma de
  `quantity * unit_value` dos eventos `dividend_payment` daquele usuário+ativo — `AccountRepository.ListPositionsByUser` ganha
  um `LEFT JOIN`/subquery agregando por `asset_id`, sem migration nova). Backend: `PositionRecord`/`MyAccountPosition` ganham
  `dividendsReceived`, `GetMyAccountUseCase` repassa 1:1 (sem cálculo novo no backend).
- **Critérios de aceite:** usuário com 2+ ciclos de provento recebidos numa ação vê `dividends_received` bater com a soma manual
  dos eventos `dividend_payment` daquele ativo; posição sem provento nenhum devolve `0`, não `null`/omitido (mesmo tratamento de
  campo numérico sempre presente de `average_price`/`quantity`); teste do repositório (motor, contra Postgres real) e do handler
  HTTP; teste do caso de uso e do router (backend, com fake); `.docs/engine/` (onde `GET /positions` já está documentado) e
  `.docs/backend/market.md` atualizados com o campo novo.
- **Dependências:** nenhuma.
- **Entregável:** `position.Record` ganhou `DividendsReceived float64` (`domain/position/position.go`).
  `AccountRepository.ListPositionsByUser` (`infra/db/account_repository.go`) agrega via `LEFT JOIN` numa subquery
  `SUM(quantity * unit_value)` de `market_events` (`event_type = 'dividend_payment'`) por `asset_id`, `COALESCE`ado pra `0` — sem
  migration nova, exatamente como previsto. `GET /positions` (`infra/httpserver/positions.go`) expõe `dividends_received` sem
  `omitempty`, mesmo tratamento de `quantity`/`average_price`. Backend: `PositionRecord`/`MyAccountPosition`
  (`accountReader.ts`/`getMyAccount.ts`) ganharam `dividends_received`/`dividendsReceived` — como `FixedIncomePositionRecord`/
  `MyAccountFixedIncomePosition` não têm esse campo (renda fixa não gera `dividend_payment`), os dois pares deixaram de usar
  `extends` direto um do outro e passaram a compartilhar uma interface base sem o campo nem `averageRate`/`markPrice`, pra não
  forçar um campo inexistente na resposta real de `GET /fixed-income/positions`. Testes: tabela nova em `positions_test.go`
  (handler), teste de repositório novo contra Postgres real (`account_repository_integration_test.go`, dois cenários — 2 ciclos de
  provento somados e posição sem provento devolvendo `0`) e `getMyAccount.test.ts` (backend) atualizados. `.docs/engine/account.md`
  e `.docs/backend/market.md` atualizados.
  **Achado da validação (registrado aqui, não é pendência de produto):** o teste de repositório inicial rodou contra o banco
  `market` de desenvolvimento compartilhado (mesmo `TEST_DATABASE_URL` de `tick_lock_integration_test.go`) e tentou limpar suas
  próprias linhas de `market_events` no `t.Cleanup` — só que `market_events` é append-only (trigger
  `prevent_market_events_mutation`, CLAUDE.md: Event Sourcing é a fonte da verdade, nunca mutável), então o `DELETE` falhou
  silenciosamente e deixou 3 ativos/contas de teste (`VALS15`, `S157dc650e`, `S15829f424`) e 6 eventos `dividend_payment` presos no
  `market` de dev — não puderam ser removidos depois porque removê-los exigiria desabilitar o trigger append-only numa base com
  dados reais, ação que a sessão corretamente recusou. Corrigido criando um banco descartável por execução do teste
  (`CREATE DATABASE`/`Migrate`/`DROP DATABASE`, mesmo espírito de `market_e2e`/`market_e2e_b` dos scripts de validação), que não
  reincide. As 3 linhas de teste que já vazaram continuam no `market` de dev (`is_sandbox: false`, então aparecem em
  `GET /assets?type=acao`) — o autor decide se quer limpá-las manualmente (exige desabilitar o trigger append-only) ou deixá-las.

### S.16 · Frontend: retorno de preço vs. retorno total (com proventos) na posição do ativo ✅
- **Descrição:** hoje nenhuma tela mostra ganho/perda de uma posição (nem preço médio vs. preço atual) — `AssetDetail` (4.5,
  âncora) só usa `ownedQuantity` pro ticket de ordem, sem card de "sua posição"; `Portfolio` (2.1) só agrega patrimônio total, sem
  itemizar por ativo. Adicionar um card "Sua posição" em `AssetDetail`, só quando o usuário tem posição real (renda variável, não
  sandbox): quantidade, preço médio, preço atual (`markPrice ?? averagePrice`, mesma função da S.6), retorno de preço
  (`(atual - médio) / médio`), proventos recebidos nesse ativo em R$ (S.15) e retorno total
  (`((atual - médio) × quantidade + proventos) / (médio × quantidade)`) — os dois retornos lado a lado, com um texto curto
  explicando a diferença (mesmo espírito pedagógico do RF21: a diferença não é inconsistência, é o provento já recebido em
  caixa). Sem em dash no texto de UI; responsivo nos três breakpoints; sem posição real no ativo, o card não aparece.
- **Critérios de aceite:** ativo com provento pago mostra retorno total maior que retorno de preço na proporção exata do
  provento recebido; ativo sem provento nenhum mostra os dois retornos iguais; teste de componente cobrindo posição com e sem
  provento e sem posição (card ausente); navegação real em 375px/768px/1280px, tema claro e escuro.
- **Dependências:** S.6 (`markPrice`, já ✅), S.15 (`dividendsReceived` por posição).
- **Entregável:** `components/organisms/PositionSummaryCard/` (novo) — recebe `quantity`/`averagePrice`/`markPrice?`/
  `dividendsReceived` como props (não busca dado sozinho), reaproveita `OrderSummaryList` (já existente) pras linhas
  quantidade/preço médio/preço atual/proventos recebidos e ganha um bloco novo com os dois retornos lado a lado
  (`flex-wrap`, sem media query dedicada — mesmo padrão de `.priceRow`), coloridos com as mesmas classes `.gain`/`.loss` (tokens
  `--color-gain-*`/`--color-loss-*`) já usadas por `AssetDetail` pra `daily_change_pct`. `AssetDetail` (`pages/AssetDetail/`)
  passou a capturar a posição inteira (não só `.quantity`) do `find()` que já existia em `accountQuery.data.positions`, e
  renderiza o card entre o preço/gráfico e o bloco de indicadores por tipo, condicionado a
  `position && !position.isSandbox && position.quantity > 0` (posição de renda variável, nunca sandbox, com quantidade real).
  `services/market/types.ts` (frontend) ganhou o mesmo ajuste de tipo que o backend já tinha feito na S.15 —
  `MyAccountPosition`/`MyAccountFixedIncomePosition` passaram a compartilhar uma base sem `dividendsReceived`/`markPrice`/
  `averageRate`, pra não sugerir um campo que `fixedIncomePositions` nunca tem. Testes: 3 casos novos em
  `PositionSummaryCard/index.test.tsx` (com provento, sem provento, sem `markPrice`) e 3 casos novos em `AssetDetail/index.test.tsx`
  (retorno total maior com provento, retornos iguais sem provento, posição zerada sem card) mais uma asserção nova no teste já
  existente confirmando que o card não aparece sem posição. `tsc --noEmit`, `oxlint` (sem warning novo) e `prettier --check`
  limpos; suíte completa (798 testes) verde.
  **Achado revisado a pedido do autor logo depois do primeiro fechamento desta tarefa:** a condição inicial só checava
  `position && !position.isSandbox`, sem `quantity > 0` — `positions` nunca é deletada numa venda total (UPSERT em
  `order_execution_repository.go`, `ON CONFLICT ... DO UPDATE`), a linha fica com `quantity: 0` e `average_price` do último preço
  médio. Sem a checagem, o card apareceria pra um ativo que o usuário não tem mais e a divisão do retorno total por
  `averagePrice × quantity` (= 0) quebraria (`NaN`/`Infinity`). Corrigido antes do commit; teste novo cobre exatamente esse
  cenário (posição com `quantity: 0` e `average_price`/`dividendsReceived` > 0, card ausente).
  **Critério de aceite não fechado nesta sessão, registrado aqui em vez de reivindicado:** "navegação real em
  375px/768px/1280px, tema claro e escuro" não foi feita — gerar uma posição real (não sandbox) pra ver o card ao vivo exige
  passar pelo gate de lição da S.4 (passos sequenciais **com tempo mínimo entre eles**), o mesmo obstáculo já documentado na
  sessão da S.15 pra comprar um ativo real com um usuário novo; não é algo que dá pra contornar rápido numa sessão (é o próprio
  RF de gating funcionando como projetado, não um bug). Decisão desta sessão: substituir pela cobertura automatizada acima
  (que já verifica o texto/percentual renderizado nos dois cenários e a ausência do card), em vez de inventar um atalho pelo
  gate. Se o autor quiser a validação visual real nos 3 breakpoints/2 temas, precisa ser feita à parte (usuário com lições já
  completas, ou avançando o tempo mínimo entre os passos manualmente).

## Fase T — Salário mensal simulado (renda recorrente independente de investimento)

**Origem:** discussão com o autor nesta sessão (2026-09-27), sem documento de proposta prévio — decisões fechadas
diretamente na conversa, registradas abaixo.

**Decisões do autor (2026-09-27):**
1. **Motivação:** hoje a única fonte de crescimento de patrimônio é a rentabilidade sobre os R$10.000 iniciais (RNF06) —
   não há nenhuma injeção externa de capital, diferente da vida real, onde a maior parte da capacidade de investir vem de
   renda de trabalho, não de retorno de investimento.
2. **Modelo:** salário mensal, creditado como caixa livre na conta (não afeta rentabilidade, ver decisão 4).
3. **Valor:** cresce com o nível de gamificação (`gamification.levelForXp`, curva já existente, sem teto), em degraus
   também sem teto: nível 1-10 soma R$100/nível, nível 10-20 soma R$200/nível, nível 20-30 soma R$300/nível, e assim por
   adiante (tier `k = ⌈nível/10⌉`, incremento por nível dentro do tier = R$100×k). Forma fechada:
   `salário(nível) = 1000·(k-1)·k/2 + 100·k·(nível - 10·(k-1))`. Valores de referência confirmados com o autor: nível 10 →
   R$1.000/mês, nível 20 → R$3.000/mês, nível 30 → R$6.000/mês. Aceito que, pra um usuário muito engajado por muito tempo
   (missão diária é fonte de XP infinita, ao contrário das 35 lições), o salário eventualmente supere qualquer retorno de
   investimento razoável — decisão explícita do autor, não um efeito colateral.
4. **Sem novo ranking por patrimônio absoluto** (RNF09 continua intocado — valor absoluto nunca exposto a outro usuário).
   A rentabilidade % (RF17, o único ranking afetado) passa a ser calculada só sobre capital que já foi de risco em algum
   momento (compras históricas, líquidas de vendas/resgates realizados e dividendos), nunca sobre caixa nunca investido —
   isso exclui salário (e o próprio depósito inicial não investido) do cálculo, mas **preserva lucro já realizado e
   guardado em caixa** (decisão explícita: vender com lucro e não reinvestir continua contando na rentabilidade).
5. **Cadência:** 5º dia útil de cada mês-**calendário real** — o dia simulado já mapeia 1:1 pra uma data real a partir de
   2026-01-05 (`simcalendar.BaseDate`), então usa mês/ano dessa data real, não o bloco de 30 dias fixos do IPCA (que é
   convenção só daquele cálculo, ver S.2). Igual à vida real.
6. Precisa virar informação visual no Calendário (S.10-S.12) — pedido explícito do autor.

### T.1 · Rentabilidade calculada só sobre capital de risco (pré-requisito antes do salário)
- **Descrição:** hoje `backend/src/modules/ranking/domain/profitability.ts` (`profitabilityPct(baseline, current)`) compara
  o patrimônio total (caixa + posições, `networth.ts` `replay().total`) contra a baseline fixa de R$10.000 — só funciona
  hoje porque a única fonte de caixa é o depósito inicial. Redefinir como retorno sobre capital de risco:
  `retorno% = investedCost === 0 ? 0 : ((currentInvestedValue + disinvestedProceeds + dividendsReceived - investedCost) / investedCost) * 100`,
  onde `investedCost` = soma bruta histórica de compras (renda variável + renda fixa, nunca líquida de venda),
  `disinvestedProceeds` = soma bruta de vendas + resgates de renda fixa, `dividendsReceived` = soma de dividendos,
  `currentInvestedValue` = valor atual das posições abertas (como já é hoje). O motor já mantém `accounts.total_invested`
  (incrementado em `order_execution_repository.go:628` e `fixed_income_execution_repository.go:246`, exposto em
  `GET /accounts/{user_id}`, ainda não consumido pelo backend) e `accounts.total_dividends_received` — falta
  simetricamente um `accounts.total_disinvested` (novo, incrementado nos mesmos pontos onde hoje só `current_balance` é
  creditado na venda/resgate: `order_execution_repository.go:635` e `fixed_income_execution_repository.go:287`),
  migration `000035`.
- **Critérios de aceite:** vender um ativo com lucro e não reinvestir continua contando na rentabilidade (teste
  explícito); nunca investir nada dá 0% (não -100%); teste table-driven da nova função pura cobrindo compra parcial,
  venda com lucro/perda, dividendo recebido ainda posicionado, e o caso atual (só depósito inicial, sem operação)
  permanecendo 0%; `engineCurrentAccountStateReader` (leitura "agora") e `networth.replay` (leitura `asOf` passado, janela
  do ranking) produzem o mesmo número pro mesmo instante.
- **Dependências:** nenhuma (pode rodar em paralelo a T.2/T.3/T.4).
- **Entregável esperado:** migration `000035_total_disinvested`; `account.Account.TotalDisinvested` (Go) + repositório +
  `httpserver/account.go`; `AccountResponse.total_disinvested` consumido em `engineCurrentAccountStateReader.ts`;
  `networth.ts` (`replay`) ganha os mesmos 3 acumuladores; `profitability.ts` reescrito (nome novo, ex.
  `investmentReturnPct`); todos os consumidores de `profitabilityPct` atualizados (`getRanking.ts`, perfil público);
  `.docs/engine/orders.md`/`fixedincome.md`, `.docs/backend/ranking.md`.

### T.2 · Evento de salário no motor e endpoint de crédito
- **Descrição:** novo tipo de evento `salary_payment` no enum Postgres `market_event_type` (`ALTER TYPE ... ADD VALUE`,
  migration `000036`) + constante `EventSalaryPayment` em `eventstore.go`, travada no teste que confere o enum do banco
  (mesmo padrão de `bot_initial_cash`). Novo endpoint `POST /accounts/{user_id}/salary` (`{ amount }`, `amount > 0`) que
  grava o evento (dia simulado automático via o gatilho já existente da migration `000034`) e credita
  `accounts.current_balance` na mesma transação — mesmo padrão de Event Sourcing do `initial_deposit`. Nunca incrementa
  `total_invested`/`total_disinvested` (T.1): é caixa livre, não capital de risco. O motor só executa o crédito; a
  decisão de quando/quanto pagar vem de fora (T.5).
- **Critérios de aceite:** crédito grava evento imutável + saldo atualizado atomicamente; endpoint rejeita `amount <= 0`
  (`400`); não altera `total_invested`/`total_disinvested`; teste de domínio, de repositório (Postgres real) e de
  `httpserver`.
- **Dependências:** nenhuma (pode rodar em paralelo a T.1).

### T.3 · Fórmula de salário por nível (função pura no backend)
- **Descrição:** `monthlySalaryForLevel(level: number): number`, novo módulo `backend/src/modules/payroll/domain/` (módulo
  próprio — cruza `gamification`, dono do nível, com `market`, que credita caixa; não pertence a nenhum dos dois). Fórmula
  em degraus confirmada com o autor: tier `k = Math.ceil(level / 10)`,
  `salário = 1000·(k-1)·k/2 + 100·k·(level - 10·(k-1))`. Sem teto.
- **Critérios de aceite:** teste table-driven cobrindo nível 1 (R$100), 10 (R$1.000), 11, 20 (R$3.000), 21, 30 (R$6.000) e
  um nível alto (ex. 100); função pura, sem I/O.
- **Dependências:** nenhuma.

### T.4 · Detecção do 5º dia útil do mês-calendário real
- **Descrição:** função pura que recebe os dias do mês corrente (reaproveitando
  `GET /market/calendar?from=<1º dia do mês>&to=<hoje>`, que já devolve `weekday` por dia — S.10) e determina se o dia
  simulado de hoje é o 5º dia útil desse mês-calendário real (mês/ano da data mapeada pelo dia simulado, nunca o bloco de
  30 dias fixos do IPCA). Sem duplicar `simcalendar.IsBusinessDay` no backend — só conta os `weekday` que a API já
  devolve.
- **Critérios de aceite:** teste table-driven com meses que abrem em dia de semana diferente (deslocando o 5º dia útil,
  ex. mês que começa numa sexta/sábado/domingo); nunca conta sábado/domingo.
- **Dependências:** nenhuma.

### T.5 · Job de folha de pagamento com catch-up e idempotência
- **Descrição:** novo caso de uso em `payroll` (T.3) que, por conta: lê o nível (`gamification`), verifica se hoje é o 5º
  dia útil do mês (T.4) e se esse mês-calendário já foi pago (nova coluna/tabela, ex.
  `user_progression.last_salary_paid_month` ou tabela própria `salary_payments`), calcula o valor (T.3) e credita via o
  endpoint novo do motor (T.2). Disparado por um job periódico no backend (ancorado como o `scheduler.Run` do motor na
  S.3) — nunca paga o mesmo mês duas vezes; se o backend ficar fora do ar e perder o dia exato, paga no próximo check
  (catch-up), com teto de meses em atraso recuperáveis de uma vez (mesmo espírito do `TICK_MAX_CATCHUP` do motor).
- **Critérios de aceite:** dois checks no mesmo dia não pagam duas vezes; reinício do backend depois de perder o dia de
  pagamento ainda paga esse mês (uma vez, não retroativo pra sempre); teste do caso de uso com fakes (relógio do motor,
  leitor de nível, port de crédito) cobrindo pago/já pago/fora do dia/catch-up.
- **Dependências:** T.2, T.3, T.4.

### T.6 · Salário no calendário do usuário
- **Descrição:** o evento `salary_payment` (T.2) precisa aparecer em `GET /market/calendar` como fato do usuário (novo
  `kind: salary_payment` em `marketcalendar.UserFacts`, ao lado de `dividend_received` etc. — S.10). Diferente de
  dividendo/vencimento (determinísticos), o valor de um pagamento futuro depende do nível no momento do pagamento, que
  pode mudar até lá — calendário mostra o dia de pagamento como "vem aí" sem valor, e o valor só aparece depois de pago
  (passado).
- **Critérios de aceite:** salário pago aparece na linha do tempo do usuário no dia certo, nunca pra outro usuário; item
  futuro nunca mostra valor.
- **Dependências:** T.2, T.5.

### T.7 · Frontend: marcador de salário no calendário e teatro de recompensa
- **Descrição:** `CalendarEventItem`/`CalendarKindIcon` ganham o `kind: salary_payment` (ícone e rótulo próprios:
  "Salário: R$ X" no passado, "Dia de pagamento" sem valor no futuro); ao detectar salário recebido na virada de dia,
  reaproveitar `dayFlipReveal`/`RewardRevealProvider` (S.12) com um toast dedicado ("Salário do mês: R$ X caiu na sua
  conta").
- **Critérios de aceite:** marcador visível na faixa de dias e no painel de detalhe; toast só dispara pro próprio
  usuário; responsivo nos três breakpoints; sem em dash em texto de UI.
- **Dependências:** T.6.

### T.8 · Salário exposto na resposta de progressão (fonte única do valor)
- **Descrição:** `GET /gamification/progression` (`progressionRouter.ts`) passa a incluir `monthlySalary` no payload,
  calculado via `monthlySalaryForLevel` (T.3) — única fonte do valor pro frontend, a fórmula em degraus nunca é
  duplicada lá. `useProgressionQuery` ganha o campo no tipo de retorno.
- **Critérios de aceite:** valor bate com T.3 pro nível atual do usuário; teste de router/serviço.
- **Dependências:** T.3.

### T.9 · Indicador persistente de salário no Dashboard
- **Descrição:** pequeno card/linha perto de `components/organisms/ProgressionSummary` (dentro dele ou ao lado, a
  decidir na sessão de implementação — não é tela âncora, mas segue `identidade-visual-tokens.md`/`padroes.md`) com
  "Salário: R$X/mês" e o próximo pagamento (reaproveita `useMarketCalendarQuery`, achando o próximo `salary_payment`
  "vem aí" do usuário — T.6). Responsivo nos três breakpoints.
- **Critérios de aceite:** mostra o valor certo pro nível atual (T.8); "próximo pagamento em N dias" consistente com
  T.4/T.5; não quebra layout em nenhum breakpoint.
- **Dependências:** T.6, T.8.

### T.10 · Salário no teatro de recompensa do level-up
- **Descrição:** `XpRewardSource` (`features/shell/xpRewardReveal/types.ts`, usado por `xpRevealContent`) ganha
  `newLevel?: number`, vindo de `AdvanceLessonResult`/`CompleteMissionResult` (que já calculam o novo nível ao chamar
  `AwardXpUseCase` — só falta expor esse número na resposta). `xpRevealContent` (quando `leveledUp`) calcula
  `monthlySalaryForLevel(newLevel)` e `monthlySalaryForLevel(newLevel - 1)` (T.3, mesma função, sem duplicar) pra
  preencher `description` do `RewardRevealContent` (campo já existe no tipo, só não é usado hoje pro level-up):
  "Salário mensal agora é R$X (+R$Y)".
- **Critérios de aceite:** reveal de level-up mostra o salário novo e a diferença; teste da função pura
  `xpRevealContent` com o novo campo; nível 1 (sem nível anterior) não quebra.
- **Dependências:** T.3.

### T.11 · Passo no onboarding explicando o salário
- **Descrição:** novo slide no onboarding, mesma sequência da S.12 ("Aqui o tempo passa mais rápido"): explica que o
  salário mensal cresce com o nível e cai automaticamente no 5º dia útil do mês, sem precisar fazer nada.
- **Critérios de aceite:** slide navegável nos três breakpoints, sem em dash em texto de UI.
- **Dependências:** nenhuma tecnicamente, mas só faz sentido publicar depois de T.5 estar em produção (senão o
  onboarding promete um mecanismo que ainda não existe).

## Sequência sugerida

1. **A.1 → A.2 → A.3 → A.4** (fundação — pode já rodar em paralelo às Fases I, K, L, que são
   independentes; A.4 só depende de A.1, pode entrar assim que A.1 fechar).
2. **B.1 → B.2** (distribuição do float, depende de A).
3. **C.1 → C.2 → C.3 → C.4 → C.5 → C.6** (arquétipos, depende de B; ordem interna por
   complexidade crescente).
4. **D.1 → D.2** (cadência intradiária, depende de C).
5. **J.1 → J.2 → J.3 → J.4 → J.5** (ON/PN — só depende de A/C.5, pode entrar em paralelo a partir
   do passo 3; J.5 é revisão de conteúdo de lição, fecha a fase). **J.6** é independente do resto
   da fase (achado 005 Parte C, mecanismo de `rounds.go`) — pode entrar a qualquer momento depois
   de D.2 (precisa de `effectiveOrderSizeCeiling` já existir), inclusive antes de J.1-J.5 ou em
   paralelo a qualquer outra fase.
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
15. **O.1 → O.2 → O.3 → O.4** (cancelamento e validade Day de ordem — independente como I/K/L, só
    depende de A.2, já concluída; pode ser feita a qualquer momento, inclusive antes de tudo acima.
    O.3/O.4 fecham o achado 012 — sem elas, o cancelamento fica correto no motor mas inutilizável
    ponta a ponta, ver `pontos-em-aberto-decisao-produto.md`).
16. **P.10 → P.1 → P.2 → P.3** (cobertura contínua de Market Maker — PR 1; P.10 é independente e pode
    abrir a fase), depois **P.4 → P.5** (PR 2, otimização de custo e cotação de pé), depois **P.6, P.7,
    P.8** (PR 3; P.6 só depende de P.1 e P.7 de P.2, então podem entrar antes). **P.9** a qualquer momento
    antes da Fase N. Fecha os achados 013 e 002 de `pontos-em-aberto-decisao-produto.md`.
17. **Q.1** (sem decisão, pode abrir a fase), depois **Q.2** e **Q.3** (dependem de Q.1) e **Q.6** (dividendos em lote,
    achada na Q.3, independente), depois **Q.4** (benchmark e gatilho). O primeiro benchmark da Q.4 (2026-09-26) estourou o custo e o volume com 100 ativos, então seguem
    **Q.7** (medir a divisão do custo), **Q.8** (orçamento de turnos com piso rígido), **Q.9** (giro-alvo via tamanho de ordem)
    e **Q.10** (atenção por evento), e depois uma nova execução da Q.4. **Q.5** só se, depois disso, 100 ativos ainda passarem
    de 5.000 comandos por tick. Fecha o achado 014.
18. **R.1 → R.2 → R.3** (fundo, criação/resgate e NAV), depois **R.4 → R.5** (ETF no book e Market Maker ancorado no iNAV),
    **R.6** (Participante Autorizado), **R.7** (rebalanceamento), **R.8** (dividendos, só depende da R.3, pode entrar antes da R.6),
    **R.9** (taxa de administração), **R.10** (atenção derivada da cesta), **R.11** (frontend, lições e docs) e **R.12** (validação
    ponta a ponta e benchmark, fecha a fase). **R.13** só se o autor pedir. Sem dependência das Fases M e N.
19. **S.4** e **S.8** são independentes (podem abrir a fase). **S.1 → S.2 → S.3** (escala de tempo e agenda do tick), **S.10 → S.11 → S.12** (calendário, mercado fechado no fim de semana e frontend, depois de S.1 e S.3), **S.5 → S.6
    e S.7** (book, marcação a ponto médio e diálogo), e **S.9** fecha a fase. Fecha os achados 018 a 023 de
    `pontos-em-aberto-decisao-produto.md`.
20. **T.1** (rentabilidade sobre capital de risco) e **T.2/T.3/T.4** (evento de salário, fórmula por nível, detecção do
    5º dia útil) são todas independentes entre si e podem abrir a fase em paralelo. **T.5** depende de T.2, T.3 e T.4.
    **T.6** depende de T.2 e T.5 (calendário do motor). **T.7** (frontend do calendário) depende de T.6. **T.8**
    depende só de T.3 (pode entrar em paralelo a T.5/T.6/T.7), **T.9** depende de T.6 e T.8, **T.10** depende só de
    T.3 (paralelo, mesmo ponto de entrada de T.8), **T.11** fecha a fase (publicar só depois de T.5 em produção). T.1
    precisa estar em produção antes de T.5 ir ao ar (senão o salário corrompe a rentabilidade publicada durante a
    janela em que uma existe sem a outra), mesmo sem dependência técnica direta entre elas.
