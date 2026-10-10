package main

import (
	"context"
	"fmt"
	"log"
	"math"
	"os"
	"tcc-investimentos/engine/internal/domain/botpool"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/infra/db"
)

// allowSyntheticEnv precisa estar "true" para --synthetic-assets funcionar:
// o catálogo sintético é só para stack de teste (benchmark da cobertura de
// Market Maker, tarefa P.7) e nunca deve entrar no seed de desenvolvimento.
const allowSyntheticEnv = "SEED_ALLOW_SYNTHETIC"

// syntheticFloats varia o float entre ativos (de 50 milhões a 1,5 bilhão de
// ações), pra medir a cobertura com tamanhos de mercado diferentes.
var syntheticFloats = []int64{50_000_000, 120_000_000, 300_000_000, 700_000_000, 1_500_000_000}

// syntheticEquity é um ativo de Ação sintético (empresa própria, um ativo por
// empresa) gerado de forma determinística por índice.
type syntheticEquity struct {
	Ticker            string
	Name              string
	CNPJ              string
	Sector            catalog.Sector
	RiskClass         string
	OutstandingShares int64
}

// syntheticEquities gera n ações sintéticas, distribuídas em rodízio pelos 6
// setores fixos, alternando o perfil de risco e variando o float. Função pura
// e determinística: mesmo n, mesmo catálogo.
func syntheticEquities(n int) []syntheticEquity {
	specs := make([]syntheticEquity, n)
	for i := 0; i < n; i++ {
		riskClass := equityRiskConservador
		if i%2 == 1 {
			riskClass = equityRiskSofisticado
		}
		specs[i] = syntheticEquity{
			Ticker:            fmt.Sprintf("SYN%03d3", i+1),
			Name:              fmt.Sprintf("Sintética %03d ON", i+1),
			CNPJ:              fmt.Sprintf("99%012d", i+1),
			Sector:            botpool.SixFixedSectors[i%len(botpool.SixFixedSectors)],
			RiskClass:         riskClass,
			OutstandingShares: syntheticFloats[(i*7)%len(syntheticFloats)],
		}
	}
	return specs
}

// seedSyntheticEquities cria (idempotente) as n ações sintéticas com empresa e
// fundamentos iniciais e devolve a entrada de liquidez de bot de cada uma.
func seedSyntheticEquities(ctx context.Context, repo *db.CatalogRepository, n int) []botAssetSeed {
	if os.Getenv(allowSyntheticEnv) != "true" {
		log.Fatalf("--synthetic-assets só roda em stack de teste: defina %s=true", allowSyntheticEnv)
	}

	assets := make([]botAssetSeed, 0, n)
	for _, spec := range syntheticEquities(n) {
		companyID := ensureCompany(ctx, repo, spec.Name, spec.CNPJ, spec.Sector, catalog.DefaultBaseGrowthPct, catalog.DefaultQualityMultiplier)
		assetID := seedEquity(ctx, repo, spec.Ticker, spec.Name, spec.RiskClass, &companyID, "ON", spec.OutstandingShares)
		seedInitialFundamentals(ctx, repo, companyID, spec.Sector, spec.OutstandingShares, catalog.DefaultBaseGrowthPct, catalog.DefaultQualityMultiplier)
		assets = append(assets, botAssetSeed{AssetID: assetID, OutstandingShares: spec.OutstandingShares})
	}
	return assets
}

// syntheticETFBasketSizes varia o tamanho da cesta entre os ETFs sintéticos, de um
// único constituinte (caso de borda da R.12) a oito.
var syntheticETFBasketSizes = []int{5, 3, 8, 1, 4}

// syntheticETFFII é o FII real do seed que entra na cesta dos ETFs sintéticos de
// índice ímpar, pra exercitar a cesta mista Ação e FII.
const syntheticETFFII = "TJLO11"

// syntheticETFConstituent é um constituinte da cesta de um ETF sintético.
type syntheticETFConstituent struct {
	Ticker    string
	Name      string
	WeightPct float64
}

// syntheticETF é um ETF sintético (tarefa R.12) cuja cesta usa as ações sintéticas.
type syntheticETF struct {
	Ticker       string
	Name         string
	Constituents []syntheticETFConstituent
}

// syntheticETFs gera m ETFs sintéticos sobre as nEquities ações sintéticas de
// syntheticEquities. Cada ETF pega um bloco de ações consecutivas (deslocado por
// ETF, então cestas se sobrepõem e o catálogo cruza constituintes), com pesos
// iguais em centésimos que somam exatamente 100; os de índice ímpar levam também o
// FII real do seed. Função pura e determinística: mesmo (m, nEquities), mesmo catálogo.
func syntheticETFs(m, nEquities int) []syntheticETF {
	if nEquities <= 0 {
		return nil
	}
	etfs := make([]syntheticETF, 0, m)
	for i := 0; i < m; i++ {
		size := syntheticETFBasketSizes[i%len(syntheticETFBasketSizes)]
		if size > nEquities {
			size = nEquities
		}
		names := make([]syntheticETFConstituent, 0, size+1)
		for k := 0; k < size; k++ {
			idx := (i*3 + k) % nEquities
			names = append(names, syntheticETFConstituent{
				Ticker: fmt.Sprintf("SYN%03d3", idx+1),
				Name:   fmt.Sprintf("Sintética %03d ON (SYN%03d3)", idx+1, idx+1),
			})
		}
		if i%2 == 1 {
			names = append(names, syntheticETFConstituent{Ticker: syntheticETFFII, Name: "FII Tijolo Corporativo (TJLO11)"})
		}
		each := math.Floor(10000/float64(len(names))) / 100
		var assigned float64
		for k := range names {
			names[k].WeightPct = each
			assigned += each
		}
		names[len(names)-1].WeightPct = math.Round((names[len(names)-1].WeightPct+100-assigned)*100) / 100
		etfs = append(etfs, syntheticETF{Ticker: fmt.Sprintf("SYE%02d11", i+1), Name: fmt.Sprintf("ETF Sintético %02d", i+1), Constituents: names})
	}
	return etfs
}

// seedSyntheticETFs cria (idempotente) os m ETFs sintéticos com a cesta e o fundo
// ligado; a emissão inicial acontece sozinha no primeiro tick (R.3). Só stack de teste.
func seedSyntheticETFs(ctx context.Context, repo *db.CatalogRepository, accountRepo *db.AccountRepository, m, nEquities int) {
	if os.Getenv(allowSyntheticEnv) != "true" {
		log.Fatalf("--synthetic-etfs só roda em stack de teste: defina %s=true", allowSyntheticEnv)
	}
	if nEquities <= 0 {
		log.Fatal("--synthetic-etfs precisa de --synthetic-assets maior que zero (a cesta usa as ações sintéticas)")
	}
	for _, spec := range syntheticETFs(m, nEquities) {
		id, existed := ensureAsset(ctx, repo, spec.Ticker, spec.Name, catalog.AssetETF, nil, false)
		if !existed {
			via, err := catalog.NewVariableIncomeAsset(id, nil, nil, nil)
			if err != nil {
				log.Fatalf("variable_income_assets inválido pra %s: %v", spec.Ticker, err)
			}
			if err := repo.CreateVariableIncomeAsset(ctx, via); err != nil {
				log.Fatalf("erro ao criar variable_income_assets pra %s: %v", spec.Ticker, err)
			}
			holdings := make([]etf.Holding, 0, len(spec.Constituents))
			for _, c := range spec.Constituents {
				holdings = append(holdings, mustHolding(ctx, repo, c.Name, c.Ticker, c.WeightPct))
			}
			details, err := etf.NewDetails("Índice sintético", "Cesta sintética do benchmark da Fase R.", holdings)
			if err != nil {
				log.Fatalf("etf_details inválido pra %s: %v", spec.Ticker, err)
			}
			if err := repo.CreateETFDetails(ctx, id, details); err != nil {
				log.Fatalf("erro ao criar etf_details pra %s: %v", spec.Ticker, err)
			}
		}
		ensureETFFund(ctx, repo, accountRepo, id)
	}
}
