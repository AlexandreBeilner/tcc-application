package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"tcc-investimentos/engine/internal/domain/catalog"
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
			Sector:            sixFixedSectors[i%len(sixFixedSectors)],
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
		companyID := ensureCompany(ctx, repo, spec.Name, spec.CNPJ, spec.Sector)
		assetID := seedEquity(ctx, repo, spec.Ticker, spec.Name, spec.RiskClass, &companyID, "ON", spec.OutstandingShares)
		seedInitialFundamentals(ctx, repo, companyID, spec.Sector, spec.OutstandingShares)
		assets = append(assets, botAssetSeed{AssetID: assetID, OutstandingShares: spec.OutstandingShares})
	}
	return assets
}
