package db

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fii"
)

// TestAssetsWithCompany_DistingueAcaoFIIEInexistente cobre o achado 028 na
// camada de banco: ação (com empresa) vira true, FII e ETF (sem empresa)
// viram false, id inexistente ou malformado fica fora do mapa (nunca erro de
// sintaxe de uuid). Usa o banco descartável (roda só com TEST_DATABASE_URL).
func TestAssetsWithCompany_DistingueAcaoFIIEInexistente(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	catalogRepo := NewCatalogRepository(conn, nil)

	company, err := catalog.NewCompany("Acao S.A.", "55555555000101", catalog.SectorMineracao, catalog.DefaultBaseGrowthPct, catalog.DefaultQualityMultiplier)
	if err != nil {
		t.Fatal(err)
	}
	companyID, err := catalogRepo.CreateCompany(ctx, company)
	if err != nil {
		t.Fatal(err)
	}

	shares := int64(1_000_000)
	newAsset := func(ticker string, typ catalog.AssetType, companyID *string) string {
		t.Helper()
		id, err := catalogRepo.CreateAsset(ctx, catalog.Asset{Ticker: ticker, Name: ticker, Type: typ})
		if err != nil {
			t.Fatalf("CreateAsset %s: %v", ticker, err)
		}
		if err := catalogRepo.CreateVariableIncomeAsset(ctx, catalog.VariableIncomeAsset{AssetID: id, CompanyID: companyID, OutstandingShares: &shares}); err != nil {
			t.Fatalf("CreateVariableIncomeAsset %s: %v", ticker, err)
		}
		return id
	}
	acao := newAsset("ACAO3", catalog.AssetAcao, &companyID)
	fiiID := newAsset("FIIX11", catalog.AssetFII, nil)
	segment := fii.SegmentShoppingCenters
	netWorth, vacancy := 100_000_000.0, 5.0
	details, err := fii.NewDetails(fii.TypeTijolo, &segment, &netWorth, &vacancy, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := catalogRepo.CreateFIIDetails(ctx, fiiID, details); err != nil {
		t.Fatal(err)
	}
	etfID := newAsset("ETFX11", catalog.AssetETF, nil)

	got, err := NewMacroEventRepository(conn).AssetsWithCompany(ctx, []string{acao, fiiID, etfID, "00000000-0000-0000-0000-000000000000", "'; DROP TABLE assets;--"})
	if err != nil {
		t.Fatalf("AssetsWithCompany: %v", err)
	}
	if !got[acao] {
		t.Errorf("ação deveria ter empresa: %v", got)
	}
	for name, id := range map[string]string{"FII": fiiID, "ETF": etfID} {
		if has, exists := got[id]; !exists || has {
			t.Errorf("%s: exists=%v hasCompany=%v, want exists e sem empresa", name, exists, has)
		}
	}
	if len(got) != 3 {
		t.Errorf("ids inexistentes/malformados deveriam ficar fora do mapa, len = %d (%v)", len(got), got)
	}
}
