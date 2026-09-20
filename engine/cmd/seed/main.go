// Command seed popula um catálogo mínimo de mercado — não o catálogo
// completo do currículo (isso é a tarefa 7.2, semana 7), só o suficiente
// pra que as tarefas 3.10-3.14 tenham dados reais pra persistir/consultar
// (backlog, tarefa 3.9). Idempotente: rodar mais de uma vez não duplica
// nem falha, verifica existência por ticker/CNPJ antes de inserir.
//
// Uso:
//
//	DATABASE_URL=postgres://tcc:tcc@localhost:5432/market?sslmode=disable go run ./cmd/seed
package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/fii"
	"tcc-investimentos/engine/internal/domain/fixedincome"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/selic"
	"tcc-investimentos/engine/internal/domain/tick"
	"tcc-investimentos/engine/internal/infra/cache"
	"tcc-investimentos/engine/internal/infra/db"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("defina DATABASE_URL antes de rodar o seed")
	}

	pool, err := db.Open(databaseURL)
	if err != nil {
		log.Fatalf("erro ao abrir conexão com o banco market: %v", err)
	}
	defer func() { _ = pool.Close() }()

	// Script standalone de uma execução só — não serve leitura sob carga,
	// então nunca precisa de Redis de verdade (tarefa 5.7).
	repo := db.NewCatalogRepository(pool, cache.NoopQuoteCache{})
	accountRepo := db.NewAccountRepository(pool)
	botRepo := db.NewBotRepository(pool)
	ctx := context.Background()

	mineradora := ensureCompany(ctx, repo, "Mineradora Vale do Rio S.A.", "11222333000181", catalog.SectorMineracao)
	banco := ensureCompany(ctx, repo, "Banco Nordeste Digital S.A.", "22333444000162", catalog.SectorBancario)

	const valr3OutstandingShares = 500_000_000
	const bndd4OutstandingShares = 300_000_000
	valr3ID := seedEquity(ctx, repo, "VALR3", "Mineradora Vale do Rio ON", equityRiskConservador, &mineradora, "ON", valr3OutstandingShares)
	bndd4ID := seedEquity(ctx, repo, "BNDD4", "Banco Nordeste Digital PN", equityRiskSofisticado, &banco, "PN", bndd4OutstandingShares)
	seedInitialFundamentals(ctx, repo, mineradora, valr3OutstandingShares)
	seedInitialFundamentals(ctx, repo, banco, bndd4OutstandingShares)

	tjlo11ID := seedFIITijolo(ctx, repo)
	papl11ID := seedFIIPapel(ctx, repo)

	seedBotLiquidity(ctx, accountRepo, []botAssetSeed{
		{AssetID: valr3ID, OutstandingShares: valr3OutstandingShares},
		{AssetID: bndd4ID, OutstandingShares: bndd4OutstandingShares},
		{AssetID: tjlo11ID, OutstandingShares: fiiOutstandingShares},
		{AssetID: papl11ID, OutstandingShares: fiiOutstandingShares},
	})
	seedBotPersonalities(ctx, botRepo)

	// Produtos pós-fixados (fixedincome.IndexPosFixado, tarefa L.1 do
	// backlog-motor-mercado-realista) — o número abaixo não é mais "taxa
	// anual em %", é "% do CDI/Selic contratado" (ex: 110.00 = "110% do
	// CDI"), mesma convenção da lição 3.3 da spec ("CDB 110% CDI líquido
	// vs LCI 90% CDI isento"). Tesouro Selic ~100% (rastreia a Selic
	// quase 1:1, mesmo perfil de uma LFT real); CDB/CRI/CRA acima de 100%
	// (prêmio de crédito bancário/securitizadora, sem a isenção de IR de
	// LCI/LCA/CRI/CRA — CDB é tributado); LCI/LCA abaixo de 100% (isentos
	// de IR, rendimento líquido menor é o ponto pedagógico da lição 3.3);
	// CRI acima de CRA (sem garantia FGC nenhum dos dois, mas mantém a
	// mesma ordem relativa que já existia antes desta tarefa). Valores
	// ilustrativos, sujeitos à mesma calibração fina da tarefa 8.1 que já
	// se aplica a todo coeficiente sem tabela numérica fechada pela
	// spec/proposta.
	seedFixedIncome(ctx, repo, "LFT2029", "Tesouro Selic 2029", fixedincome.ProductTesouroSelic, "", 100.00, 30.00, false)
	// seedETF só pode rodar daqui em diante: sua cesta (achado 006,
	// pontos-em-aberto-decisao-produto.md) referencia VALR3/TJLO11/LFT2029
	// reais, então os 3 precisam já existir no catálogo.
	seedETF(ctx, repo)
	seedFixedIncome(ctx, repo, "LTN2027", "Tesouro Prefixado 2027", fixedincome.ProductTesouroPrefixado, "", 11.75, 30.00, false)
	seedFixedIncome(ctx, repo, "NTNB2035", "Tesouro IPCA+ 2035", fixedincome.ProductTesouroIPCA, "", 6.00, 30.00, false)
	seedFixedIncome(ctx, repo, "CDB2027", "CDB Banco Invest 2027", fixedincome.ProductCDB, "", 110.00, 100.00, false)
	seedFixedIncome(ctx, repo, "LCI2026", "LCI Banco Invest 2026", fixedincome.ProductLCI, "", 90.00, 500.00, false)
	seedFixedIncome(ctx, repo, "LCA2026", "LCA Banco Invest 2026", fixedincome.ProductLCA, "", 90.00, 500.00, false)
	seedFixedIncome(ctx, repo, "CRI2028", "CRI Securitizadora X 2028", fixedincome.ProductCRI, "AA", 115.00, 1000.00, false)
	seedFixedIncome(ctx, repo, "CRA2028", "CRA Securitizadora X 2028", fixedincome.ProductCRA, "A", 112.00, 1000.00, false)

	seedSandboxEquity(ctx, repo)
	seedSandboxFixedIncome(ctx, repo)

	log.Print("seed do catálogo mínimo concluído")
}

const (
	equityRiskConservador = "Conservador"
	equityRiskSofisticado = "Sofisticado"
)

func ensureCompany(ctx context.Context, repo *db.CatalogRepository, name, cnpj string, sector catalog.Sector) string {
	if id, found, err := repo.FindCompanyByCNPJ(ctx, cnpj); err != nil {
		log.Fatalf("erro ao buscar empresa %s: %v", cnpj, err)
	} else if found {
		log.Printf("empresa %s já existe (id %s) — pulando", name, id)
		return id
	}

	company, err := catalog.NewCompany(name, cnpj, sector)
	if err != nil {
		log.Fatalf("empresa %s inválida: %v", name, err)
	}
	id, err := repo.CreateCompany(ctx, company)
	if err != nil {
		log.Fatalf("erro ao criar empresa %s: %v", name, err)
	}
	log.Printf("empresa %s criada (id %s)", name, id)
	return id
}

// ensureAsset devolve (id, jaExistia).
func ensureAsset(ctx context.Context, repo *db.CatalogRepository, ticker, name string, assetType catalog.AssetType, riskClass *string, isSandbox bool) (string, bool) {
	if id, found, err := repo.FindAssetByTicker(ctx, ticker); err != nil {
		log.Fatalf("erro ao buscar ativo %s: %v", ticker, err)
	} else if found {
		log.Printf("ativo %s já existe (id %s) — pulando", ticker, id)
		return id, true
	}

	asset, err := catalog.NewAsset(ticker, name, assetType, riskClass, isSandbox)
	if err != nil {
		log.Fatalf("ativo %s inválido: %v", ticker, err)
	}
	id, err := repo.CreateAsset(ctx, asset)
	if err != nil {
		log.Fatalf("erro ao criar ativo %s: %v", ticker, err)
	}
	log.Printf("ativo %s criado (id %s)", ticker, id)
	return id, false
}

func seedEquity(ctx context.Context, repo *db.CatalogRepository, ticker, name, riskClass string, companyID *string, shareClass string, outstandingShares int64) string {
	id, existed := ensureAsset(ctx, repo, ticker, name, catalog.AssetAcao, &riskClass, false)
	if existed {
		return id
	}

	via, err := catalog.NewVariableIncomeAsset(id, companyID, &shareClass, &outstandingShares)
	if err != nil {
		log.Fatalf("variable_income_assets inválido pra %s: %v", ticker, err)
	}
	if err := repo.CreateVariableIncomeAsset(ctx, via); err != nil {
		log.Fatalf("erro ao criar variable_income_assets pra %s: %v", ticker, err)
	}
	return id
}

func seedInitialFundamentals(ctx context.Context, repo *db.CatalogRepository, companyID string, outstandingShares int64) {
	if _, found, err := repo.FindLatestFundamentals(ctx, companyID); err != nil {
		log.Fatalf("erro ao buscar fundamentos da empresa %s: %v", companyID, err)
	} else if found {
		log.Printf("empresa %s já tem fundamentos — pulando", companyID)
		return
	}

	// Sem uma linha inicial de company_fundamentals, a empresa cai no
	// fallback genérico fundamentals.DefaultBaseRevenue (1 milhão, pensado
	// pra uma "empresa pequena qualquer", nunca contra outstanding_shares
	// na casa das centenas de milhões dos ativos seedados aqui) — o preço
	// justo do Fundamentalista (bot.FundamentalistFairPrice) sai
	// microscópico (VPA≈0), o bot tenta convergir o mercado pra um valor
	// de bilhões e corrompe o book (achado 003 de
	// .claude/pontos-em-aberto-decisao-produto.md). Em vez de resolver
	// isso à mão por empresa (como a sessão D.2 fez, cravando uma
	// constante de receita-por-ação), BootstrapFinancialsForTargetPrice
	// deriva o net_revenue que faz o preço justo nascer exatamente em
	// tick.DefaultInitialPrice, pra qualquer outstandingShares — vale pra
	// qualquer empresa futura da tarefa 7.2, não só VALR3/BNDD4. A
	// diferenciação de coeficientes por setor (margens, sensibilidade à
	// Selic) continua fora de escopo, reservada pra Fase K (proposta
	// motor-mercado-realista seção 7) — problema separado deste.
	financials, err := fundamentals.BootstrapFinancialsForTargetPrice(
		tick.DefaultInitialPrice, outstandingShares, fundamentals.DefaultBaseGrowth, selic.DefaultNeutralRate/100)
	if err != nil {
		log.Fatalf("erro ao calibrar fundamentos iniciais da empresa %s: %v", companyID, err)
	}
	if err := repo.CreateInitialFundamentals(ctx, companyID, financials); err != nil {
		log.Fatalf("erro ao criar fundamentos iniciais da empresa %s: %v", companyID, err)
	}
	log.Printf("fundamentos iniciais da empresa %s criados (net_revenue=%.2f)", companyID, financials.NetRevenue)
}

// seedETF monta a cesta 100% em ativos reais do catálogo — decisão do
// achado 006 (pontos-em-aberto-decisao-produto.md, resolvido em
// 2026-09-19): a plataforma nunca pretendeu replicar a composição de um
// índice real (spec 3.6 já falava em "índice simulado" — o nome do índice
// abaixo é só rótulo de exibição pra familiaridade pedagógica, nunca uma
// promessa de bater com a composição real do Ibovespa), então não há razão
// de produto pra manter constituinte cosmético (`Holding.AssetID = nil`)
// no único ETF do seed: ele é o candidato natural a ganhar o robô mecânico
// (rebalanceamento H.2/Participante Autorizado H.3) quando essa integração
// for escrita, e `RebalanceOrders`/`DecideAuthorizedParticipantAction` só
// enxergam holding com AssetID preenchido. Precisa rodar depois de
// VALR3/TJLO11/LFT2029 já seedados (ver ordem em main()) — mesma
// combinação Ação/FII/renda fixa validada ao vivo na sessão de H.4.
func seedETF(ctx context.Context, repo *db.CatalogRepository) {
	const ticker = "SINT11"
	id, existed := ensureAsset(ctx, repo, ticker, "ETF Índice Sintético", catalog.AssetETF, nil, false)
	if existed {
		return
	}

	via, err := catalog.NewVariableIncomeAsset(id, nil, nil, nil)
	if err != nil {
		log.Fatalf("variable_income_assets inválido pra %s: %v", ticker, err)
	}
	if err := repo.CreateVariableIncomeAsset(ctx, via); err != nil {
		log.Fatalf("erro ao criar variable_income_assets pra %s: %v", ticker, err)
	}

	details, err := etf.NewDetails("Ibovespa", "Replicação sintética por amostragem representativa do índice.", []etf.Holding{
		{ConstituentName: "Mineradora Vale do Rio ON (VALR3)", AssetID: mustFindAssetID(ctx, repo, "VALR3"), WeightPct: 50},
		{ConstituentName: "FII Tijolo Corporativo (TJLO11)", AssetID: mustFindAssetID(ctx, repo, "TJLO11"), WeightPct: 35},
		{ConstituentName: "Tesouro Selic 2029 (LFT2029)", AssetID: mustFindAssetID(ctx, repo, "LFT2029"), WeightPct: 15},
	})
	if err != nil {
		log.Fatalf("etf_details inválido pra %s: %v", ticker, err)
	}
	if err := repo.CreateETFDetails(ctx, id, details); err != nil {
		log.Fatalf("erro ao criar etf_details pra %s: %v", ticker, err)
	}
}

// mustFindAssetID resolve o asset_id de um ticker já seedado — usado por
// seedETF pra montar a cesta 100% real do achado 006. Falha alto
// (log.Fatalf) se o ticker ainda não existir, porque isso só pode
// significar que seedETF foi movida pra antes do constituinte que ela
// referencia (ver comentário de ordem em main()).
func mustFindAssetID(ctx context.Context, repo *db.CatalogRepository, ticker string) *string {
	id, found, err := repo.FindAssetByTicker(ctx, ticker)
	if err != nil {
		log.Fatalf("erro ao buscar ativo %s pra cesta do ETF: %v", ticker, err)
	}
	if !found {
		log.Fatalf("ativo %s não encontrado — seedETF precisa rodar depois dele ser seedado", ticker)
	}
	return &id
}

// fiiOutstandingShares (cotas em circulação) — sem fórmula de geração ainda
// (mesmo tratamento ilustrativo de interest_rate/maturity_date, tarefa
// 3.9), mas precisa estar preenchido desde a tarefa 4.9: é o denominador de
// dividend.FIIValuePerShare (provento por cota) e, desde a tarefa B.2,
// também o float finito que bot.InitialAllocation distribui entre bots.
// Compartilhado pelos dois FIIs seedados (mesmo valor ilustrativo pros
// dois).
const fiiOutstandingShares = int64(1_000_000)

func seedFIITijolo(ctx context.Context, repo *db.CatalogRepository) string {
	const ticker = "TJLO11"
	id, existed := ensureAsset(ctx, repo, ticker, "FII Tijolo Corporativo", catalog.AssetFII, nil, false)
	if existed {
		return id
	}

	outstandingShares := fiiOutstandingShares
	via, err := catalog.NewVariableIncomeAsset(id, nil, nil, &outstandingShares)
	if err != nil {
		log.Fatalf("variable_income_assets inválido pra %s: %v", ticker, err)
	}
	if err := repo.CreateVariableIncomeAsset(ctx, via); err != nil {
		log.Fatalf("erro ao criar variable_income_assets pra %s: %v", ticker, err)
	}

	segment := "Lajes Corporativas"
	netWorth := 500_000_000.00
	vacancyRate := 5.2
	details, err := fii.NewDetails(fii.TypeTijolo, &segment, &netWorth, &vacancyRate, nil, nil)
	if err != nil {
		log.Fatalf("fii_details inválido pra %s: %v", ticker, err)
	}
	if err := repo.CreateFIIDetails(ctx, id, details); err != nil {
		log.Fatalf("erro ao criar fii_details pra %s: %v", ticker, err)
	}
	return id
}

func seedFIIPapel(ctx context.Context, repo *db.CatalogRepository) string {
	const ticker = "PAPL11"
	id, existed := ensureAsset(ctx, repo, ticker, "FII Papel Recebíveis", catalog.AssetFII, nil, false)
	if existed {
		return id
	}

	// outstanding_shares — ver nota de fiiOutstandingShares (tarefa 4.9).
	outstandingShares := fiiOutstandingShares
	via, err := catalog.NewVariableIncomeAsset(id, nil, nil, &outstandingShares)
	if err != nil {
		log.Fatalf("variable_income_assets inválido pra %s: %v", ticker, err)
	}
	if err := repo.CreateVariableIncomeAsset(ctx, via); err != nil {
		log.Fatalf("erro ao criar variable_income_assets pra %s: %v", ticker, err)
	}

	// portfolio_value (tarefa 4.10) — valor ilustrativo da carteira de
	// recebíveis, mesmo tratamento "sujeito à calibração 8.1" de net_worth
	// (seedFIITijolo) — é o denominador ausente que fazia PAPL11 nunca gerar
	// provento/Dividend Yield antes desta tarefa.
	indexador := "CDI"
	portfolioValue := 300_000_000.00
	details, err := fii.NewDetails(fii.TypePapel, nil, nil, nil, &indexador, &portfolioValue)
	if err != nil {
		log.Fatalf("fii_details inválido pra %s: %v", ticker, err)
	}
	if err := repo.CreateFIIDetails(ctx, id, details); err != nil {
		log.Fatalf("erro ao criar fii_details pra %s: %v", ticker, err)
	}
	return id
}

func seedFixedIncome(ctx context.Context, repo *db.CatalogRepository, ticker, name string, productType fixedincome.ProductType, creditRiskRating string, interestRate, minimumInvestment float64, isSandbox bool) {
	assetType := catalog.AssetType(productType)
	id, existed := ensureAsset(ctx, repo, ticker, name, assetType, nil, isSandbox)
	if existed {
		return
	}

	product, err := fixedincome.NewFixedIncomeProduct(productType, creditRiskRating)
	if err != nil {
		log.Fatalf("produto de renda fixa %s inválido: %v", ticker, err)
	}

	maturityDate := time.Now().AddDate(2, 0, 0)
	if err := repo.CreateFixedIncomeAsset(ctx, id, product, interestRate, maturityDate, minimumInvestment); err != nil {
		log.Fatalf("erro ao criar fixed_income_assets pra %s: %v", ticker, err)
	}
}

// seedSandboxEquity cria a ação sandbox da lição 2.3 (RF12, tarefa 4.11) —
// ticker precisa bater exatamente com a chave usada em
// internal/domain/sandbox/sandbox.go (priceScriptsByTicker), senão
// PriceScriptForTicker nunca encontra o roteiro e o ativo cai no fallback
// de asset_quotes (vazio pra sandbox — ver order_execution_repository.go).
// Sem empresa vinculada (companyID nil, mesmo tratamento de seedETF): uma
// empresa real ligada a um ativo sandbox entraria no ciclo de relatório do
// Temporizador (tick.Advance não filtra companies por is_sandbox, só a
// geração de cotação/dividendo do próprio ativo) sem necessidade nenhuma —
// orderexecution não usa nada de variable_income_assets além do asset_id.
func seedSandboxEquity(ctx context.Context, repo *db.CatalogRepository) {
	const ticker = "SAND3"
	id, existed := ensureAsset(ctx, repo, ticker, "Ação Sandbox — Lição 2.3", catalog.AssetAcao, nil, true)
	if existed {
		return
	}

	via, err := catalog.NewVariableIncomeAsset(id, nil, nil, nil)
	if err != nil {
		log.Fatalf("variable_income_assets inválido pra %s: %v", ticker, err)
	}
	if err := repo.CreateVariableIncomeAsset(ctx, via); err != nil {
		log.Fatalf("erro ao criar variable_income_assets pra %s: %v", ticker, err)
	}
}

// seedSandboxFixedIncome cria o Tesouro Prefixado sandbox da lição 1.7
// (RF12, tarefa 4.11) — ticker precisa bater com rateScriptsByTicker
// (internal/domain/sandbox/sandbox.go), mesma nota de seedSandboxEquity.
// interestRate/minimumInvestment aqui são só o dado de catálogo (exibido
// antes de qualquer compra, tela de listagem) — fixedincomeexecution
// sobrescreve a taxa contratada de verdade pelo roteiro no momento da
// compra (fixed_income_execution_repository.go), então o valor aqui não
// precisa ser o mesmo do dia 0 do roteiro (é só o que aparece na vitrine).
func seedSandboxFixedIncome(ctx context.Context, repo *db.CatalogRepository) {
	seedFixedIncome(ctx, repo, "SANDPRE", "Tesouro Prefixado Sandbox — Lição 1.7", fixedincome.ProductTesouroPrefixado, "", 10.0, 30.00, true)
}

// Configuração fixa do pool de bots de liquidez desta sessão (tarefa B.2
// do backlog-motor-mercado-realista) — um único pool compartilhado entre
// todos os ativos de Ação/FII, não um pool por ativo: a segmentação real de
// 15-25 bots *por ativo* (proposta 2.3.2, item 5) exigiria um pool
// dedicado por ativo, que este catálogo mínimo (4 ativos de Renda
// Variável) não tem razão de ter ainda — em vez disso, a tarefa C.6
// (seedBotPersonalities, abaixo) atribui personalidade/escopo de
// especialização a este mesmo pool de 20 contas já existente (1 Market
// Maker + botOtherBotCount direcionais), o que já cai dentro da faixa
// 15-25 confirmada, cobrindo todos os 6 setores fixos (spec 3.3.2) e as
// classes FII/ETF (Ação já é coberta via setor).
const (
	// botSeed é fixa (não derivada de time.Now()) pro seed continuar
	// determinístico/reprodutível entre execuções, mesmo padrão de
	// qualquer outro valor fixo deste script.
	botSeed                = int64(20260913)
	botMarketMakerSharePct = 0.50 // meio da faixa confirmada (bot.MarketMakerShareMin/Max, proposta 2.2)
	botOtherBotCount       = 19   // + 1 Market Maker = pool de 20, dentro da faixa 15-25 da proposta 2.3.2
	botMinimumOrderShares  = 100  // "ordem de tamanho médio" ilustrativa usada só pra calibrar o piso de caixa do seed
	marketMakerBotUserID   = "00000000-0000-0000-0000-000000000001"
)

// otherBotUserID gera um uuid fixo e determinístico pro bot direcional de
// índice i (0-based) — literais em vez de gerados em tempo de execução
// (uuid.New()) porque o seed precisa ser idempotente (ensureBotAccount
// busca por este mesmo userID numa segunda execução), mesmo raciocínio da
// tarefa A.1 sobre account.NewBot exigir formato de uuid mas não um usuário
// cadastrado de verdade.
func otherBotUserID(i int) string {
	return fmt.Sprintf("00000000-0000-0000-0000-%012d", i+2)
}

// botAssetSeed é a entrada de seedBotLiquidity — o outstandingShares de um
// ativo já seedado (Ação/FII, nunca ETF/sandbox) que bot.InitialAllocation
// (tarefa B.1) vai distribuir entre o pool de bots.
type botAssetSeed struct {
	AssetID           string
	OutstandingShares int64
}

// botHolding acumula, em memória, tudo que um bot recebe ao longo de vários
// ativos antes de gravar qualquer coisa no banco — precisa do valor de
// mercado agregado de todas as posições (não só a de um ativo) pra calcular
// o caixa inicial (bot.InitialCash) uma única vez por bot, não uma vez por
// ativo.
type botHolding struct {
	isMarketMaker bool
	positionValue float64
	positions     map[string]int64 // assetID -> quantidade
}

// seedBotLiquidity povoa o pool de bots de liquidez (tarefa B.2) com
// posição (bot.InitialAllocation, tarefa B.1) e caixa inicial
// (bot.InitialCash) pra cada ativo de Ação/FII já seedado — nunca ETF (sem
// outstanding_shares, fora do float finito) nem sandbox (exceção
// deliberada do redesenho de bots, proposta 2.7/tarefa A.2). Distribui só o
// que sobra do float depois de descontar o que humanos já detêm
// (AccountRepository.SumHumanHoldings) — nunca outstanding_shares cru, sob
// pena de violar o teto (position.ValidateFloatCeiling, tarefa A.3). Preço
// de referência pra tudo é tick.DefaultInitialPrice — o mesmo preço de
// partida que o Temporizador usa (tick.Advance) quando ainda não existe
// cotação anterior, então o bot nasce com average_price coerente com a
// primeira cotação que o ativo vai ter. Idempotente: ensureBotAccount/
// ensureBotPosition pulam o que já existe, mesma convenção de ensureAsset.
func seedBotLiquidity(ctx context.Context, accountRepo *db.AccountRepository, assets []botAssetSeed) {
	bots := map[string]*botHolding{
		marketMakerBotUserID: {isMarketMaker: true, positions: map[string]int64{}},
	}
	for i := 0; i < botOtherBotCount; i++ {
		bots[otherBotUserID(i)] = &botHolding{positions: map[string]int64{}}
	}

	// outstandingSharesByAsset alimenta a validação de teto
	// (position.ValidateFloatCeiling, tarefa A.3) que SeedInitialHolding faz
	// por posição gravada — precisa do outstanding_shares de cada ativo no
	// momento de gravar, não só no momento de calcular a alocação.
	outstandingSharesByAsset := make(map[string]int64, len(assets))
	for _, asset := range assets {
		outstandingSharesByAsset[asset.AssetID] = asset.OutstandingShares
	}

	for _, asset := range assets {
		// O float que os bots podem receber é outstanding_shares menos o
		// que humanos já detêm (accounts.is_bot = false) — nem sempre zero:
		// num banco que já vinha sendo usado antes deste redesenho, ordens
		// executadas pela antiga liquidez sintética (revertida na tarefa
		// A.2) já deixaram usuários reais com posição real em VALR3/BNDD4.
		// Distribuir 100% do outstanding_shares pros bots nesse caso
		// estouraria position.ValidateFloatCeiling (tarefa A.3) assim que
		// esses dois lados fossem somados.
		humanHoldings, err := accountRepo.SumHumanHoldings(ctx, asset.AssetID)
		if err != nil {
			log.Fatalf("erro ao somar posições humanas do ativo %s: %v", asset.AssetID, err)
		}
		botAvailableFloat := asset.OutstandingShares - humanHoldings
		if botAvailableFloat <= 0 {
			log.Printf("ativo %s: humanos já detêm %d/%d do float — nada sobrou pros bots, pulando", asset.AssetID, humanHoldings, asset.OutstandingShares)
			continue
		}

		allocation, err := bot.InitialAllocation(asset.AssetID, botAvailableFloat, botMarketMakerSharePct, botOtherBotCount, botSeed)
		if err != nil {
			log.Fatalf("erro ao calcular alocação inicial de bots pro ativo %s: %v", asset.AssetID, err)
		}

		marketMaker := bots[marketMakerBotUserID]
		marketMaker.positions[asset.AssetID] = allocation.MarketMaker
		marketMaker.positionValue += float64(allocation.MarketMaker) * tick.DefaultInitialPrice

		for i, shares := range allocation.Others {
			holder := bots[otherBotUserID(i)]
			holder.positions[asset.AssetID] = shares
			holder.positionValue += float64(shares) * tick.DefaultInitialPrice
		}
	}

	minimumCash := tick.DefaultInitialPrice * botMinimumOrderShares
	for userID, holding := range bots {
		cash := bot.InitialCash(holding.positionValue, minimumCash, holding.isMarketMaker)
		ensureBotAccount(ctx, accountRepo, userID, cash)

		for assetID, quantity := range holding.positions {
			if quantity == 0 {
				continue
			}
			ensureBotPosition(ctx, accountRepo, userID, assetID, int(quantity), tick.DefaultInitialPrice, outstandingSharesByAsset[assetID])
		}
	}
}

func ensureBotAccount(ctx context.Context, repo *db.AccountRepository, userID string, initialBalance float64) {
	if _, found, err := repo.FindByUserID(ctx, userID); err != nil {
		log.Fatalf("erro ao buscar conta de bot %s: %v", userID, err)
	} else if found {
		log.Printf("conta de bot %s já existe — pulando", userID)
		return
	}

	acc, err := account.NewBot(userID, initialBalance)
	if err != nil {
		log.Fatalf("conta de bot %s inválida: %v", userID, err)
	}
	if err := repo.Create(ctx, acc); err != nil {
		log.Fatalf("erro ao criar conta de bot %s: %v", userID, err)
	}
	log.Printf("conta de bot %s criada (caixa inicial %.2f)", userID, initialBalance)
}

func ensureBotPosition(ctx context.Context, repo *db.AccountRepository, userID, assetID string, quantity int, price float64, outstandingShares int64) {
	created, err := repo.SeedInitialHolding(ctx, userID, assetID, quantity, price, outstandingShares)
	if err != nil {
		log.Fatalf("erro ao gravar posição inicial do bot %s no ativo %s: %v", userID, assetID, err)
	}
	if !created {
		log.Printf("posição do bot %s no ativo %s já existe — pulando", userID, assetID)
		return
	}
	log.Printf("posição inicial do bot %s no ativo %s: %d unidades a %.2f", userID, assetID, quantity, price)
}

// botSpecializationWithinScopePct é fixo no meio da faixa confirmada
// (bot.SpecializationWithinScopeMin/Max, proposta 2.3.2) — mesmo raciocínio
// de botMarketMakerSharePct ficar no meio de MarketMakerShareMin/Max (B.2):
// quem decide o valor exato dentro da faixa é quem monta o catálogo, e
// meio da faixa é a escolha mais neutra possível sem nenhum motivo pra
// puxar pra uma ponta.
const botSpecializationWithinScopePct = (bot.SpecializationWithinScopeMin + bot.SpecializationWithinScopeMax) / 2

// botDirectionalMaxPositionSizePct/botMarketOrderPreference/
// botMarketMakerSpreadWidthPct são o perfil de risco (RiskProfile,
// tarefa C.1) desta sessão — valores ilustrativos sem calibração fina
// (mesmo tratamento de qualquer outro coeficiente deste seed), únicos por
// enquanto porque nenhuma tarefa até aqui (C.2-C.5) diferencia perfil de
// risco por bot individual, só por arquétipo. SpreadWidthPct só importa de
// fato pro Market Maker (DecideMarketMakerOrders, C.3) — os outros 3
// arquétipos não leem esse campo, por isso ficam com 0.
const (
	botDirectionalMaxPositionSizePct = 0.20
	botMarketOrderPreference         = 0.50
	botMarketMakerMaxPositionSizePct = 0.50
	botMarketMakerSpreadWidthPct     = 0.02
)

// sixFixedSectors são os 6 setores fixos da spec 3.3.2 — mesma lista que
// catalog.IsValidSector valida, repetida aqui como slice concreto porque
// bot.AssignSpecializations precisa iterar sobre eles (catalog não expõe
// essa lista como slice, só o predicado de validade).
var sixFixedSectors = []catalog.Sector{
	catalog.SectorMineracao, catalog.SectorAgronegocio, catalog.SectorBancario,
	catalog.SectorVarejo, catalog.SectorEnergia, catalog.SectorTecnologia,
}

// nonEquityAssetClasses são as classes de Renda Variável sem setor próprio
// no catálogo atual (FII/ETF, catalog.go) — Ação já é coberta via
// sixFixedSectors (todo ativo type=acao tem uma company_sector), então não
// entra aqui de novo (evita um bot "genérico de Ação" redundante com os
// grupos por setor).
var nonEquityAssetClasses = []catalog.AssetType{catalog.AssetFII, catalog.AssetETF}

// botDirectionalArchetypes são os 3 arquétipos que botOtherBotCount
// (direcionais) se dividem entre — Market Maker fica de fora porque já tem
// sua própria conta única e escopo próprio (todo o pool, ver
// seedBotPersonalities), não faz parte da distribuição por especialização.
var botDirectionalArchetypes = []bot.Archetype{bot.ArchetypeRuido, bot.ArchetypeChartista, bot.ArchetypeFundamentalista}

// seedBotPersonalities atribui personalidade (tarefa C.1) a cada conta do
// pool de bots já criado por seedBotLiquidity (B.2, tarefa anterior) — o
// Market Maker (marketMakerBotUserID) recebe escopo amplo (todos os 6
// setores + FII/ETF, WithinScopePct no teto da faixa — ele já concentra a
// maior fatia do float/caixa, então faz sentido que também tenha o maior
// alcance de especialização) e os botOtherBotCount bots direcionais se
// dividem entre os 3 arquétipos restantes via bot.AssignSpecializations
// (C.6), que garante que todo setor/classe tem pelo menos um bot de cada
// arquétipo cobrindo-o. Nível de conhecimento dos bots Fundamentalistas é
// sorteado (determinístico por botSeed) — o único jeito de ter bots "que
// sabem mais que outros" sem hardcodar um valor igual pra todos.
// Idempotente: ensureBotPersonality pula bots que já têm personalidade
// persistida, mesma convenção de ensureBotAccount/ensureBotPosition.
func seedBotPersonalities(ctx context.Context, repo *db.BotRepository) {
	marketMakerScope, err := bot.NewSpecializationScope(sixFixedSectors, nil, nonEquityAssetClasses, bot.SpecializationWithinScopeMax)
	if err != nil {
		log.Fatalf("escopo de especialização do Market Maker inválido: %v", err)
	}
	marketMakerRisk, err := bot.NewRiskProfile(botMarketMakerMaxPositionSizePct, botMarketOrderPreference, botMarketMakerSpreadWidthPct)
	if err != nil {
		log.Fatalf("perfil de risco do Market Maker inválido: %v", err)
	}
	marketMakerPersonality, err := bot.NewPersonality(bot.ArchetypeMarketMaker, marketMakerScope, nil, marketMakerRisk)
	if err != nil {
		log.Fatalf("personalidade do Market Maker inválida: %v", err)
	}
	ensureBotPersonality(ctx, repo, marketMakerBotUserID, marketMakerPersonality)

	assignments, err := bot.AssignSpecializations(botDirectionalArchetypes, sixFixedSectors, nonEquityAssetClasses, botOtherBotCount)
	if err != nil {
		log.Fatalf("erro ao distribuir especialização entre os %d bots direcionais: %v", botOtherBotCount, err)
	}

	knowledgeRNG := rand.New(rand.NewSource(botSeed))
	directionalRisk, err := bot.NewRiskProfile(botDirectionalMaxPositionSizePct, botMarketOrderPreference, 0)
	if err != nil {
		log.Fatalf("perfil de risco dos bots direcionais inválido: %v", err)
	}

	for i, assignment := range assignments {
		scope, err := bot.NewSpecializationScope(assignment.Sectors, nil, assignment.AssetClasses, botSpecializationWithinScopePct)
		if err != nil {
			log.Fatalf("escopo de especialização do bot direcional %d inválido: %v", i, err)
		}

		var knowledgeLevel *float64
		if assignment.Archetype == bot.ArchetypeFundamentalista {
			level := knowledgeRNG.Float64()
			knowledgeLevel = &level
		}

		personality, err := bot.NewPersonality(assignment.Archetype, scope, knowledgeLevel, directionalRisk)
		if err != nil {
			log.Fatalf("personalidade do bot direcional %d inválida: %v", i, err)
		}
		ensureBotPersonality(ctx, repo, otherBotUserID(i), personality)
	}
}

func ensureBotPersonality(ctx context.Context, repo *db.BotRepository, userID string, personality bot.Personality) {
	if _, found, err := repo.FindPersonalityByAccountID(ctx, userID); err != nil {
		log.Fatalf("erro ao buscar personalidade do bot %s: %v", userID, err)
	} else if found {
		log.Printf("personalidade do bot %s já existe — pulando", userID)
		return
	}

	if err := repo.CreatePersonality(ctx, userID, personality); err != nil {
		log.Fatalf("erro ao criar personalidade do bot %s: %v", userID, err)
	}
	log.Printf("personalidade do bot %s criada (arquétipo %s)", userID, personality.Archetype)
}
