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
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"time"

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/coverage"
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
	syntheticAssets := flag.Int("synthetic-assets", 0, "gera N ações sintéticas extras (só stack de teste, exige "+allowSyntheticEnv+"=true)")
	syntheticETFCount := flag.Int("synthetic-etfs", 0, "gera M ETFs sintéticos sobre as ações sintéticas (só stack de teste, exige "+allowSyntheticEnv+"=true e --synthetic-assets)")
	flag.Parse()
	if *syntheticETFCount < 0 {
		log.Fatal("--synthetic-etfs não pode ser negativo")
	}
	if *syntheticAssets < 0 {
		log.Fatal("--synthetic-assets não pode ser negativo")
	}

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
	coverageRepo := db.NewCoverageRepository(pool)
	ctx := context.Background()

	mineradora := ensureCompany(ctx, repo, "Mineradora Vale do Rio S.A.", "11222333000181", catalog.SectorMineracao)
	banco := ensureCompany(ctx, repo, "Banco Nordeste Digital S.A.", "22333444000162", catalog.SectorBancario)

	const valr3OutstandingShares = 500_000_000
	// bancoOutstandingShares é compartilhado por BNDD3 (ON) e BNDD4 (PN) —
	// decisão da tarefa J.4 (backlog-motor-mercado-realista): as duas classes
	// nascem com a MESMA base de ações, então o spread de preço entre elas
	// vem só do premium de dividendo da PN (companies.pn_dividend_premium_pct,
	// J.2/J.3, default 10%), não de uma VPA diferente por diluição de base —
	// sinal mais limpo pra lição 2.3 (J.5) atribuir a causa certa. Valor
	// idêntico ao antigo bndd4OutstandingShares (só-PN, pré-J.4) de propósito:
	// um banco de dev que já seedou BNDD4 sozinho não tem seus fundamentos
	// recalibrados por esta tarefa (seedInitialFundamentals já é idempotente).
	const bancoOutstandingShares = 300_000_000
	valr3ID := seedEquity(ctx, repo, "VALR3", "Mineradora Vale do Rio ON", equityRiskConservador, &mineradora, "ON", valr3OutstandingShares)
	// Mesmo risk_class (Sofisticado) nas duas classes de ação do banco —
	// convenção confirmada pela própria J.1 (companyEquityRiskClasses usa o
	// risk_class "do primeiro encontrado" pra toda ação da mesma empresa,
	// então divergir entre ON/PN aqui produziria inconsistência sem sentido
	// de produto, já que é a mesma empresa/mesmo perfil de risco).
	bndd3ID := seedEquity(ctx, repo, "BNDD3", "Banco Nordeste Digital ON", equityRiskSofisticado, &banco, "ON", bancoOutstandingShares)
	bndd4ID := seedEquity(ctx, repo, "BNDD4", "Banco Nordeste Digital PN", equityRiskSofisticado, &banco, "PN", bancoOutstandingShares)
	seedInitialFundamentals(ctx, repo, mineradora, catalog.SectorMineracao, valr3OutstandingShares)
	seedInitialFundamentals(ctx, repo, banco, catalog.SectorBancario, bancoOutstandingShares)

	tjlo11ID := seedFIITijolo(ctx, repo)
	papl11ID := seedFIIPapel(ctx, repo)

	botAssets := []botAssetSeed{
		{AssetID: valr3ID, OutstandingShares: valr3OutstandingShares},
		{AssetID: bndd3ID, OutstandingShares: bancoOutstandingShares},
		{AssetID: bndd4ID, OutstandingShares: bancoOutstandingShares},
		{AssetID: tjlo11ID, OutstandingShares: fiiOutstandingShares},
		{AssetID: papl11ID, OutstandingShares: fiiOutstandingShares},
	}
	if *syntheticAssets > 0 {
		botAssets = append(botAssets, seedSyntheticEquities(ctx, repo, *syntheticAssets)...)
	}
	poolSize := bot.PoolSize(len(botAssets))
	log.Printf("pool de bots direcionais: %d (catálogo de %d ativos)", poolSize, len(botAssets))
	seedBotLiquidity(ctx, accountRepo, coverageRepo, coverage.NewEnsurer(coverageRepo, coverageRepo), botAssets, poolSize)
	seedBotPersonalities(ctx, botRepo, poolSize)

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
	// pontos-em-aberto-decisao-produto.md; só Ação e FII desde a R.1)
	// referencia VALR3/BNDD3/TJLO11/PAPL11 reais, então já precisam existir.
	ensureAuthorizedParticipant(ctx, accountRepo)
	seedETF(ctx, repo, accountRepo)
	if *syntheticETFCount > 0 {
		seedSyntheticETFs(ctx, repo, accountRepo, *syntheticETFCount, *syntheticAssets)
	}
	// LTN2027/NTNB2035 (tarefa L.4): interest_rate deixou de ser a taxa
	// ofertada em si e virou o SPREAD sobre o benchmark de mercado corrente
	// (Selic nominal pro Prefixado, taxa real via Fisher pro IPCA+) — mesmo
	// raciocínio da reinterpretação que a L.1 já tinha aplicado aos 6 tipos
	// pós-fixados abaixo ("% do CDI" em vez de "% a.a."). 1,75 p.p. sobre
	// Selic=10% (selic.DefaultNeutralRate, seed) reproduz os 11,75% a.a.
	// que o catálogo oferecia antes desta tarefa; 0,5 p.p. sobre a taxa
	// real implícita da Selic seed (~6,75%, Fisher com IPCA acumulado ~3%
	// a.a., ipca.DefaultConfig) fica perto dos 6,00% reais que NTNB2035
	// oferecia antes — os dois passam a se mover com a Selic/IPCA simulada
	// a partir daqui, em vez de ficar travados nesse valor pra sempre.
	seedFixedIncome(ctx, repo, "LTN2027", "Tesouro Prefixado 2027", fixedincome.ProductTesouroPrefixado, "", 1.75, 30.00, false)
	seedFixedIncome(ctx, repo, "NTNB2035", "Tesouro IPCA+ 2035", fixedincome.ProductTesouroIPCA, "", 0.50, 30.00, false)
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

func seedInitialFundamentals(ctx context.Context, repo *db.CatalogRepository, companyID string, sector catalog.Sector, outstandingShares int64) {
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
	// tick.DefaultInitialPrice, pra qualquer sector/outstandingShares —
	// vale pra qualquer empresa futura da tarefa 7.2, não só VALR3/BNDD4.
	// Os coeficientes já variam por setor desde a tarefa K.2 (margens,
	// alavancagem, sensibilidade à Selic — fundamentals.CoefficientsBySector,
	// calibrados na pesquisa da K.1, .claude/calibracao-fundamentos-setor.md).
	financials, err := fundamentals.BootstrapFinancialsForTargetPrice(
		sector, tick.DefaultInitialPrice, outstandingShares, fundamentals.DefaultBaseGrowth, selic.DefaultNeutralRate/100)
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
// no único ETF do seed. Desde a tarefa R.1 (decisão do autor de
// 2026-09-26) a cesta é só de Ação e FII — renda fixa exige marcação a
// mercado por rodada e criação/resgate em instrumento sem book (R.13) — e
// o ETF ganha uma conta de fundo (ensureETFFund). Precisa rodar depois de
// VALR3/BNDD3/TJLO11/PAPL11 já seedados (ver ordem em main()).
//
// Idempotente e retrocompatível: num banco que já tinha o SINT11 com a
// cesta antiga (15% em LFT2029), a composição é substituída e o fundo é
// criado, sem tocar o resto do ETF.
func seedETF(ctx context.Context, repo *db.CatalogRepository, accountRepo *db.AccountRepository) {
	const ticker = "SINT11"
	id, existed := ensureAsset(ctx, repo, ticker, "ETF Índice Sintético", catalog.AssetETF, nil, false)
	if existed {
		migrateETFBasketIfNeeded(ctx, repo, id)
		ensureETFFund(ctx, repo, accountRepo, id)
		return
	}

	via, err := catalog.NewVariableIncomeAsset(id, nil, nil, nil)
	if err != nil {
		log.Fatalf("variable_income_assets inválido pra %s: %v", ticker, err)
	}
	if err := repo.CreateVariableIncomeAsset(ctx, via); err != nil {
		log.Fatalf("erro ao criar variable_income_assets pra %s: %v", ticker, err)
	}

	details := buildETFDetails(ctx, repo, ticker)
	if err := repo.CreateETFDetails(ctx, id, details); err != nil {
		log.Fatalf("erro ao criar etf_details pra %s: %v", ticker, err)
	}
	ensureETFFund(ctx, repo, accountRepo, id)
}

// ensureAuthorizedParticipant cria a conta única do Participante Autorizado
// (tarefa R.3) com saldo zero: o caixa vem, quando precisa, de um evento
// bot_initial_cash provisionado pelo tick a cada emissão. Sem personalidade,
// então nunca entra numa rodada de bots. Idempotente.
func ensureAuthorizedParticipant(ctx context.Context, accountRepo *db.AccountRepository) {
	if _, exists, err := accountRepo.FindByUserID(ctx, etf.AuthorizedParticipantAccountID); err != nil {
		log.Fatalf("erro ao buscar a conta do Participante Autorizado: %v", err)
	} else if exists {
		return
	}
	ap, err := account.NewBot(etf.AuthorizedParticipantAccountID, 0)
	if err != nil {
		log.Fatalf("conta do Participante Autorizado inválida: %v", err)
	}
	if err := accountRepo.Create(ctx, ap); err != nil {
		log.Fatalf("erro ao criar a conta do Participante Autorizado: %v", err)
	}
	log.Printf("conta do Participante Autorizado criada (%s)", ap.UserID)
}

// buildETFDetails monta e valida a cesta v1 do SINT11 (Ação e FII).
func buildETFDetails(ctx context.Context, repo *db.CatalogRepository, ticker string) etf.Details {
	details, err := etf.NewDetails("Ibovespa", "Replicação sintética por amostragem representativa do índice.", []etf.Holding{
		mustHolding(ctx, repo, "Mineradora Vale do Rio ON (VALR3)", "VALR3", 40),
		mustHolding(ctx, repo, "Banco Nordeste Digital ON (BNDD3)", "BNDD3", 20),
		mustHolding(ctx, repo, "FII Tijolo Corporativo (TJLO11)", "TJLO11", 25),
		mustHolding(ctx, repo, "FII Papel Recebíveis (PAPL11)", "PAPL11", 15),
	})
	if err != nil {
		log.Fatalf("etf_details inválido pra %s: %v", ticker, err)
	}
	return details
}

// migrateETFBasketIfNeeded troca a cesta de um ETF que ainda tem constituinte
// de renda fixa (SINT11 do seed anterior à R.1) pela cesta v1.
func migrateETFBasketIfNeeded(ctx context.Context, repo *db.CatalogRepository, etfID string) {
	current, found, err := repo.FindETFDetails(ctx, etfID)
	if err != nil {
		log.Fatalf("erro ao ler a cesta do ETF %s: %v", etfID, err)
	}
	if !found {
		return
	}
	for _, h := range current.Holdings {
		if h.AssetID == nil {
			continue
		}
		record, ok, err := repo.FindAssetByID(ctx, *h.AssetID)
		if err != nil {
			log.Fatalf("erro ao ler o constituinte %s do ETF: %v", *h.AssetID, err)
		}
		if ok && holdingClassOf(record.Type) == etf.HoldingClassFixedIncome {
			if err := repo.ReplaceETFHoldings(ctx, etfID, buildETFDetails(ctx, repo, "SINT11")); err != nil {
				log.Fatalf("erro ao migrar a cesta do ETF %s: %v", etfID, err)
			}
			log.Printf("cesta do ETF %s migrada: constituinte de renda fixa removido (tarefa R.1)", etfID)
			return
		}
	}
}

// ensureETFFund cria a conta de fundo do ETF (bot sem personalidade, então
// nunca entra numa rodada de negociação, saldo zero) e a liga a etf_details —
// idempotente, tarefa R.1. O caixa e as cotas nascem depois, na criação
// inicial (R.3).
func ensureETFFund(ctx context.Context, repo *db.CatalogRepository, accountRepo *db.AccountRepository, etfID string) {
	if _, linked, err := repo.FindETFFundAccountID(ctx, etfID); err != nil {
		log.Fatalf("erro ao buscar o fundo do ETF %s: %v", etfID, err)
	} else if linked {
		return
	}

	fundID := etf.FundAccountID(etfID)
	if _, exists, err := accountRepo.FindByUserID(ctx, fundID); err != nil {
		log.Fatalf("erro ao buscar a conta de fundo %s: %v", fundID, err)
	} else if !exists {
		fund, err := account.NewBot(fundID, 0)
		if err != nil {
			log.Fatalf("conta de fundo inválida pro ETF %s: %v", etfID, err)
		}
		if err := accountRepo.Create(ctx, fund); err != nil {
			log.Fatalf("erro ao criar a conta de fundo do ETF %s: %v", etfID, err)
		}
	}
	if err := repo.AttachETFFundAccount(ctx, etfID, fundID); err != nil {
		log.Fatalf("erro ao ligar o fundo %s ao ETF %s: %v", fundID, etfID, err)
	}
	log.Printf("conta de fundo %s ligada ao ETF %s", fundID, etfID)
}

// holdingClassOf traduz o tipo do ativo no catálogo pra classe de constituinte
// que etf.NewDetails valida.
func holdingClassOf(t catalog.AssetType) etf.HoldingClass {
	switch t {
	case catalog.AssetAcao:
		return etf.HoldingClassEquity
	case catalog.AssetFII:
		return etf.HoldingClassFII
	case catalog.AssetETF:
		return etf.HoldingClassETF
	default:
		return etf.HoldingClassFixedIncome
	}
}

// mustHolding resolve um ticker já seedado num constituinte da cesta. Falha
// alto (log.Fatalf) se o ticker ainda não existir, porque isso só pode
// significar que seedETF foi movida pra antes do constituinte que ela
// referencia (ver comentário de ordem em main()).
func mustHolding(ctx context.Context, repo *db.CatalogRepository, name, ticker string, weightPct float64) etf.Holding {
	id, found, err := repo.FindAssetByTicker(ctx, ticker)
	if err != nil {
		log.Fatalf("erro ao buscar ativo %s pra cesta do ETF: %v", ticker, err)
	}
	if !found {
		log.Fatalf("ativo %s não encontrado — seedETF precisa rodar depois dele ser seedado", ticker)
	}
	record, _, err := repo.FindAssetByID(ctx, id)
	if err != nil {
		log.Fatalf("erro ao ler o ativo %s pra cesta do ETF: %v", ticker, err)
	}
	return etf.Holding{ConstituentName: name, AssetID: &id, Class: holdingClassOf(record.Type), WeightPct: weightPct}
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
	// legacyPoolSize é o pool de bots direcionais de antes da Fase Q (o mesmo que
	// bot.MinPoolSize): os bots de índice abaixo dele mantêm exatamente a
	// personalidade que sempre tiveram, então o seed real (5 ativos) não muda.
	legacyPoolSize        = bot.MinPoolSize
	botMinimumOrderShares = 100 // "ordem de tamanho médio" ilustrativa usada só pra calibrar o piso de caixa do seed
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
func seedBotLiquidity(ctx context.Context, accountRepo *db.AccountRepository, coverageLister coverage.MarketMakerLister, ensurer *coverage.Ensurer, assets []botAssetSeed, poolSize int) {
	bots := map[string]*botHolding{}
	for i := 0; i < poolSize; i++ {
		bots[otherBotUserID(i)] = &botHolding{positions: map[string]int64{}}
	}

	// Ativo já coberto por um Market Maker já teve o float distribuído entre os
	// bots do pool daquela época (tarefa Q.2): não se redistribui, senão um pool
	// maior estouraria position.ValidateFloatCeiling. Bot novo de um banco já
	// semeado entra só com caixa e compra.
	alreadyDistributed := map[string]bool{}
	marketMakers, err := coverageLister.ListMarketMakers(ctx)
	if err != nil {
		log.Fatalf("erro ao listar Market Makers: %v", err)
	}
	for _, mm := range marketMakers {
		for _, assetID := range mm.CoveredAssetIDs {
			alreadyDistributed[assetID] = true
		}
	}

	// outstandingSharesByAsset alimenta a validação de teto
	// (position.ValidateFloatCeiling, tarefa A.3) que SeedInitialHolding faz
	// por posição gravada — precisa do outstanding_shares de cada ativo no
	// momento de gravar, não só no momento de calcular a alocação.
	outstandingSharesByAsset := make(map[string]int64, len(assets))
	for _, asset := range assets {
		outstandingSharesByAsset[asset.AssetID] = asset.OutstandingShares
	}

	// meanBotValue é o valor médio de posição de um bot do pool sobre todo o
	// catálogo (coberto ou não), referência de caixa para um bot que nasce sem
	// posição num banco já semeado.
	var meanBotValue float64
	var newlyDistributed []botAssetSeed
	allocations := map[string]bot.Allocation{}

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
		meanBotValue += float64(botAvailableFloat) * (1 - botMarketMakerSharePct) / float64(poolSize) * tick.DefaultInitialPrice

		if alreadyDistributed[asset.AssetID] {
			log.Printf("ativo %s já distribuído entre os bots — pulando", asset.AssetID)
			continue
		}

		allocation, err := bot.InitialAllocation(asset.AssetID, botAvailableFloat, botMarketMakerSharePct, poolSize, botSeed)
		if err != nil {
			log.Fatalf("erro ao calcular alocação inicial de bots pro ativo %s: %v", asset.AssetID, err)
		}
		allocations[asset.AssetID] = allocation
		newlyDistributed = append(newlyDistributed, asset)

		for i, shares := range allocation.Others {
			holder := bots[otherBotUserID(i)]
			holder.positions[asset.AssetID] = shares
			holder.positionValue += float64(shares) * tick.DefaultInitialPrice
		}
	}

	// Bots primeiro, cobertura depois: se o seed cair no meio, o ativo continua
	// sem cobertura e a próxima execução redistribui (idempotente, as posições
	// que já existem são puladas) em vez de deixar o ativo coberto e sem bots.
	minimumCash := tick.DefaultInitialPrice * botMinimumOrderShares
	for i := 0; i < poolSize; i++ {
		userID := otherBotUserID(i)
		holding := bots[userID]
		value := holding.positionValue
		if value == 0 {
			value = meanBotValue
		}
		ensureBotAccount(ctx, accountRepo, userID, bot.InitialCash(value, minimumCash, false))

		for assetID, quantity := range holding.positions {
			if quantity == 0 {
				continue
			}
			ensureBotPosition(ctx, accountRepo, userID, assetID, int(quantity), tick.DefaultInitialPrice, outstandingSharesByAsset[assetID])
		}
	}

	// Cobertura de Market Maker (P.2): quem cobre o ativo é decidido pela
	// cobertura, que também cria um Market Maker novo quando os existentes
	// estão no teto.
	for _, asset := range newlyDistributed {
		allocation := allocations[asset.AssetID]
		result, err := ensurer.EnsureCoverage(ctx, coverage.Input{
			AssetID:           asset.AssetID,
			OutstandingShares: asset.OutstandingShares,
			MarketMakerShares: allocation.MarketMaker,
			Price:             tick.DefaultInitialPrice,
		})
		if err != nil {
			log.Fatalf("erro ao garantir cobertura de Market Maker do ativo %s: %v", asset.AssetID, err)
		}
		log.Printf("ativo %s coberto pelo Market Maker %s (%d unidades)", asset.AssetID, result.MarketMakerID, allocation.MarketMaker)
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

// botDirectionalMaxPositionSizePct/botMarketOrderPreference são o perfil de
// risco (RiskProfile, tarefa C.1) dos bots direcionais (o do Market Maker é
// bot.DefaultMarketMakerPersonality, P.2) — valores ilustrativos sem calibração fina
// (mesmo tratamento de qualquer outro coeficiente deste seed), únicos por
// enquanto porque nenhuma tarefa até aqui (C.2-C.5) diferencia perfil de
// risco por bot individual, só por arquétipo. SpreadWidthPct só importa de
// fato pro Market Maker (DecideMarketMakerOrders, C.3) — os direcionais não
// leem esse campo, por isso ficam com 0.
const (
	botDirectionalMaxPositionSizePct = 0.20
	botMarketOrderPreference         = 0.50
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
// pool de bots direcionais já criado por seedBotLiquidity (B.2, tarefa
// anterior) — o Market Maker não passa mais por aqui: conta e personalidade
// dele nascem em coverage.EnsureCoverage (P.2). Os botOtherBotCount bots
// direcionais se dividem entre os 3 arquétipos restantes via bot.AssignSpecializations
// (C.6), que garante que todo setor/classe tem pelo menos um bot de cada
// arquétipo cobrindo-o. Nível de conhecimento dos bots Fundamentalistas é
// sorteado (determinístico por botSeed) — o único jeito de ter bots "que
// sabem mais que outros" sem hardcodar um valor igual pra todos.
// Idempotente: ensureBotPersonality pula bots que já têm personalidade
// persistida, mesma convenção de ensureBotAccount/ensureBotPosition.
func seedBotPersonalities(ctx context.Context, repo *db.BotRepository, poolSize int) {
	// Os legacyPoolSize primeiros bots mantêm a distribuição e o sorteio de
	// conhecimento de sempre (o seed real não muda). Os bots acima dele (tarefa
	// Q.2, catálogo maior) repetem ciclicamente a especialização dos originais,
	// então a proporção entre arquétipos e a cobertura de todo setor e classe de
	// ativo se mantêm por construção, e crescer o pool nunca altera um bot que já
	// existe. O sorteio de conhecimento deles é próprio por bot.
	legacy, err := bot.AssignSpecializations(botDirectionalArchetypes, sixFixedSectors, nonEquityAssetClasses, legacyPoolSize)
	if err != nil {
		log.Fatalf("erro ao distribuir especialização entre os %d bots direcionais: %v", legacyPoolSize, err)
	}
	assignments := append([]bot.SpecializationAssignment{}, legacy...)
	for i := legacyPoolSize; i < poolSize; i++ {
		assignments = append(assignments, legacy[i%legacyPoolSize])
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
			var level float64
			if i < legacyPoolSize {
				level = knowledgeRNG.Float64()
			} else {
				level = rand.New(rand.NewSource(botSeed + int64(i))).Float64()
			}
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
