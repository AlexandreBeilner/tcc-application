package db

import (
	"context"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fixedincome"
)

// TestListFixedIncomeRates: a lista de Renda Fixa (GET /assets) mostra a taxa
// de cada título lida numa consulta só; ativo que não é renda fixa não entra
// no mapa.
func TestListFixedIncomeRates(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	repo := NewCatalogRepository(conn, nil)

	cdbID, err := repo.CreateAsset(ctx, catalog.Asset{Ticker: "CDB2027", Name: "CDB 2027", Type: catalog.AssetCDB})
	if err != nil {
		t.Fatal(err)
	}
	product, err := fixedincome.NewFixedIncomeProduct(fixedincome.ProductCDB, "")
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.CreateFixedIncomeAsset(ctx, cdbID, product, 110, time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC), 100); err != nil {
		t.Fatal(err)
	}
	risk := "Conservador"
	acaoID, err := repo.CreateAsset(ctx, catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao, RiskClass: &risk})
	if err != nil {
		t.Fatal(err)
	}

	rates, err := repo.ListFixedIncomeRates(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if rates[cdbID] != 110 {
		t.Errorf("taxa do CDB = %v, want 110", rates[cdbID])
	}
	if _, ok := rates[acaoID]; ok {
		t.Errorf("ação não deveria ter taxa: %v", rates)
	}
}
