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
	"log"
	"os"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/fii"
	"tcc-investimentos/engine/internal/domain/fixedincome"
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

	repo := db.NewCatalogRepository(pool)
	ctx := context.Background()

	mineradora := ensureCompany(ctx, repo, "Mineradora Vale do Rio S.A.", "11222333000181", catalog.SectorMineracao)
	banco := ensureCompany(ctx, repo, "Banco Nordeste Digital S.A.", "22333444000162", catalog.SectorBancario)

	seedEquity(ctx, repo, "VALR3", "Mineradora Vale do Rio ON", equityRiskConservador, &mineradora, "ON", 500_000_000)
	seedEquity(ctx, repo, "BNDD4", "Banco Nordeste Digital PN", equityRiskSofisticado, &banco, "PN", 300_000_000)

	seedETF(ctx, repo)
	seedFIITijolo(ctx, repo)
	seedFIIPapel(ctx, repo)

	seedFixedIncome(ctx, repo, "LFT2029", "Tesouro Selic 2029", fixedincome.ProductTesouroSelic, "", 10.50, 30.00, false)
	seedFixedIncome(ctx, repo, "LTN2027", "Tesouro Prefixado 2027", fixedincome.ProductTesouroPrefixado, "", 11.75, 30.00, false)
	seedFixedIncome(ctx, repo, "NTNB2035", "Tesouro IPCA+ 2035", fixedincome.ProductTesouroIPCA, "", 6.00, 30.00, false)
	seedFixedIncome(ctx, repo, "CDB2027", "CDB Banco Invest 2027", fixedincome.ProductCDB, "", 12.00, 100.00, false)
	seedFixedIncome(ctx, repo, "LCI2026", "LCI Banco Invest 2026", fixedincome.ProductLCI, "", 9.50, 500.00, false)
	seedFixedIncome(ctx, repo, "LCA2026", "LCA Banco Invest 2026", fixedincome.ProductLCA, "", 9.50, 500.00, false)
	seedFixedIncome(ctx, repo, "CRI2028", "CRI Securitizadora X 2028", fixedincome.ProductCRI, "AA", 11.00, 1000.00, false)
	seedFixedIncome(ctx, repo, "CRA2028", "CRA Securitizadora X 2028", fixedincome.ProductCRA, "A", 10.50, 1000.00, false)

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

func seedEquity(ctx context.Context, repo *db.CatalogRepository, ticker, name, riskClass string, companyID *string, shareClass string, outstandingShares int64) {
	id, existed := ensureAsset(ctx, repo, ticker, name, catalog.AssetAcao, &riskClass, false)
	if existed {
		return
	}

	via, err := catalog.NewVariableIncomeAsset(id, companyID, &shareClass, &outstandingShares)
	if err != nil {
		log.Fatalf("variable_income_assets inválido pra %s: %v", ticker, err)
	}
	if err := repo.CreateVariableIncomeAsset(ctx, via); err != nil {
		log.Fatalf("erro ao criar variable_income_assets pra %s: %v", ticker, err)
	}
}

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
		{ConstituentName: "Mineradora Vale do Rio S.A.", WeightPct: 40},
		{ConstituentName: "Banco Nordeste Digital S.A.", WeightPct: 35},
		{ConstituentName: "Outros", WeightPct: 25},
	})
	if err != nil {
		log.Fatalf("etf_details inválido pra %s: %v", ticker, err)
	}
	if err := repo.CreateETFDetails(ctx, id, details); err != nil {
		log.Fatalf("erro ao criar etf_details pra %s: %v", ticker, err)
	}
}

func seedFIITijolo(ctx context.Context, repo *db.CatalogRepository) {
	const ticker = "TJLO11"
	id, existed := ensureAsset(ctx, repo, ticker, "FII Tijolo Corporativo", catalog.AssetFII, nil, false)
	if existed {
		return
	}

	// outstanding_shares (cotas em circulação) — sem fórmula de geração
	// ainda (mesmo tratamento ilustrativo de interest_rate/maturity_date,
	// tarefa 3.9), mas precisa estar preenchido desde a tarefa 4.9: é o
	// denominador de dividend.FIIValuePerShare (provento por cota).
	outstandingShares := int64(1_000_000)
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
}

func seedFIIPapel(ctx context.Context, repo *db.CatalogRepository) {
	const ticker = "PAPL11"
	id, existed := ensureAsset(ctx, repo, ticker, "FII Papel Recebíveis", catalog.AssetFII, nil, false)
	if existed {
		return
	}

	// outstanding_shares — ver nota de seedFIITijolo (tarefa 4.9).
	outstandingShares := int64(1_000_000)
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
