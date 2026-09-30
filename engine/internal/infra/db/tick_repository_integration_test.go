package db

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fii"
)

// TestListDividendPayerAssets_FIITrazTipoESegmento cobre a tarefa U.2: o
// insumo do contexto de preço justo de FII (fii_details.fii_type e segment)
// chega em tick.DividendPayerAsset junto com NetWorth/PortfolioValue/
// Indexador. Usa o banco descartável de openAccountRepositoryOnScratchDB
// (roda só com TEST_DATABASE_URL, senão é pulado).
func TestListDividendPayerAssets_FIITrazTipoESegmento(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	repo := NewCatalogRepository(conn, nil)

	shares := int64(1_000_000)
	create := func(ticker string, details fii.Details) string {
		t.Helper()
		id, err := repo.CreateAsset(ctx, catalog.Asset{Ticker: ticker, Name: ticker, Type: catalog.AssetFII})
		if err != nil {
			t.Fatalf("CreateAsset %s: %v", ticker, err)
		}
		if err := repo.CreateVariableIncomeAsset(ctx, catalog.VariableIncomeAsset{AssetID: id, OutstandingShares: &shares}); err != nil {
			t.Fatalf("CreateVariableIncomeAsset %s: %v", ticker, err)
		}
		if err := repo.CreateFIIDetails(ctx, id, details); err != nil {
			t.Fatalf("CreateFIIDetails %s: %v", ticker, err)
		}
		return id
	}

	segment := fii.SegmentShoppingCenters
	netWorth, vacancy := 100_000_000.0, 8.5
	tijoloDetails, err := fii.NewDetails(fii.TypeTijolo, &segment, &netWorth, &vacancy, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	indexador, portfolio := "CDI", 100_000_000.0
	papelDetails, err := fii.NewDetails(fii.TypePapel, nil, nil, nil, &indexador, &portfolio)
	if err != nil {
		t.Fatal(err)
	}
	tijoloID := create("TIJO11", tijoloDetails)
	papelID := create("PAPE11", papelDetails)

	payers, err := NewTickRepository(conn, nil).ListDividendPayerAssets(ctx)
	if err != nil {
		t.Fatalf("ListDividendPayerAssets: %v", err)
	}

	byID := map[string]int{}
	for i, p := range payers {
		byID[p.AssetID] = i
	}
	tijolo, ok := byID[tijoloID]
	if !ok {
		t.Fatal("FII tijolo ausente da listagem")
	}
	if p := payers[tijolo]; p.FIIType == nil || *p.FIIType != "tijolo" || p.Segment == nil || *p.Segment != segment || p.NetWorth == nil {
		t.Errorf("tijolo = %+v, want FIIType=tijolo Segment=%q NetWorth preenchido", p, segment)
	}
	papel, ok := byID[papelID]
	if !ok {
		t.Fatal("FII papel ausente da listagem")
	}
	if p := payers[papel]; p.FIIType == nil || *p.FIIType != "papel" || p.Segment != nil || p.PortfolioValue == nil {
		t.Errorf("papel = %+v, want FIIType=papel Segment=nil PortfolioValue preenchido", p)
	}
}
