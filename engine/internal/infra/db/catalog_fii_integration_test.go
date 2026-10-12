package db

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fii"
)

// TestRecalibrateFIIBaseValueIfNeverQuoted cobre a tarefa U.5: só um FII que
// nunca teve cotação recebe o novo valor-base (net_worth no tijolo,
// portfolio_value no papel); com cotação, o valor evoluído pelo motor fica.
// Idempotente: uma segunda chamada com o mesmo valor não altera nada.
func TestRecalibrateFIIBaseValueIfNeverQuoted(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	repo := NewCatalogRepository(conn, nil)

	create := func(ticker string, details fii.Details) string {
		t.Helper()
		id, err := repo.CreateAsset(ctx, catalog.Asset{Ticker: ticker, Name: ticker, Type: catalog.AssetFII})
		if err != nil {
			t.Fatal(err)
		}
		shares := int64(1_000_000)
		if err := repo.CreateVariableIncomeAsset(ctx, catalog.VariableIncomeAsset{AssetID: id, OutstandingShares: &shares}); err != nil {
			t.Fatal(err)
		}
		if err := repo.CreateFIIDetails(ctx, id, details); err != nil {
			t.Fatal(err)
		}
		return id
	}
	segment, vacancy, netWorth := fii.SegmentLajesCorporativas, 5.2, 100_000_000.0
	tijolo, _ := fii.NewDetails(fii.TypeTijolo, &segment, &netWorth, &vacancy, nil, nil)
	indexador, portfolio := "CDI", 100_000_000.0
	papel, _ := fii.NewDetails(fii.TypePapel, nil, nil, nil, &indexador, &portfolio)

	tijoloID := create("TJLO11", tijolo)
	papelID := create("PAPL11", papel)
	quotedID := create("QUOT11", tijolo)
	if _, err := conn.ExecContext(ctx, `INSERT INTO asset_quotes (asset_id, simulated_day, price, total_quantity) VALUES ($1, 1, 100, 0)`, quotedID); err != nil {
		t.Fatal(err)
	}

	for _, id := range []string{tijoloID, quotedID} {
		if _, err := repo.RecalibrateFIIBaseValueIfNeverQuoted(ctx, id, 133_000_000); err != nil {
			t.Fatal(err)
		}
	}
	if changed, err := repo.RecalibrateFIIBaseValueIfNeverQuoted(ctx, papelID, 120_000_000); err != nil || !changed {
		t.Fatalf("papel: changed=%v err=%v, want true", changed, err)
	}
	if changed, err := repo.RecalibrateFIIBaseValueIfNeverQuoted(ctx, papelID, 120_000_000); err != nil || changed {
		t.Fatalf("segunda chamada: changed=%v err=%v, want false (idempotente)", changed, err)
	}

	get := func(id string) fii.Details {
		d, ok, err := repo.FindFIIDetails(ctx, id)
		if err != nil || !ok {
			t.Fatalf("FindFIIDetails: ok=%v err=%v", ok, err)
		}
		return d
	}
	// Valor com fração além de 2 casas: a segunda chamada também é no-op.
	if changed, err := repo.RecalibrateFIIBaseValueIfNeverQuoted(ctx, tijoloID, 133_000_000.123456); err != nil || !changed {
		t.Fatalf("tijolo fracionário: changed=%v err=%v, want true", changed, err)
	}
	if changed, err := repo.RecalibrateFIIBaseValueIfNeverQuoted(ctx, tijoloID, 133_000_000.123456); err != nil || changed {
		t.Fatalf("tijolo fracionário repetido: changed=%v err=%v, want false", changed, err)
	}
	if d := get(tijoloID); *d.NetWorth != 133_000_000.12 {
		t.Errorf("tijolo sem cotação: net_worth = %v, want 133000000.12", *d.NetWorth)
	}
	if d := get(quotedID); *d.NetWorth != 100_000_000 {
		t.Errorf("tijolo com cotação: net_worth = %v, want intocado 100000000", *d.NetWorth)
	}
	if d := get(papelID); *d.PortfolioValue != 120_000_000 || d.NetWorth != nil {
		t.Errorf("papel: portfolio=%v net_worth=%v, want 120000000/nil", *d.PortfolioValue, d.NetWorth)
	}
}

// TestFindFIIDetails_TrazCotasEmCirculacao cobre a tarefa U.6: o P/VP exibido
// precisa das cotas (variable_income_assets), vindas junto de fii_details.
func TestFindFIIDetails_TrazCotasEmCirculacao(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	repo := NewCatalogRepository(conn, nil)

	id, err := repo.CreateAsset(ctx, catalog.Asset{Ticker: "TJLO11", Name: "TJLO11", Type: catalog.AssetFII})
	if err != nil {
		t.Fatal(err)
	}
	shares := int64(1_000_000)
	if err := repo.CreateVariableIncomeAsset(ctx, catalog.VariableIncomeAsset{AssetID: id, OutstandingShares: &shares}); err != nil {
		t.Fatal(err)
	}
	segment, vacancy, netWorth := fii.SegmentLajesCorporativas, 5.2, 133_333_333.33
	details, _ := fii.NewDetails(fii.TypeTijolo, &segment, &netWorth, &vacancy, nil, nil)
	if err := repo.CreateFIIDetails(ctx, id, details); err != nil {
		t.Fatal(err)
	}

	got, ok, err := repo.FindFIIDetails(ctx, id)
	if err != nil || !ok {
		t.Fatalf("ok=%v err=%v", ok, err)
	}
	if got.OutstandingShares == nil || *got.OutstandingShares != shares {
		t.Fatalf("OutstandingShares = %v, want %d", got.OutstandingShares, shares)
	}
}

// TestListRecentPricesByAsset cobre a MO.9.5: uma consulta devolve os N
// preços mais recentes de cada ativo, em ordem cronológica, e ativo sem
// cotação fica fora do mapa.
func TestListRecentPricesByAsset(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	repo := NewCatalogRepository(conn, nil)

	create := func(ticker string) string {
		t.Helper()
		id, err := repo.CreateAsset(ctx, catalog.Asset{Ticker: ticker, Name: ticker, Type: catalog.AssetAcao})
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	a, b, semCotacao := create("SPKA3"), create("SPKB3"), create("SPKC3")
	for day, price := range []float64{10, 11, 12, 13} {
		if _, err := conn.ExecContext(ctx, `INSERT INTO asset_quotes (asset_id, simulated_day, price, total_quantity) VALUES ($1, $2, $3, 0)`, a, day+1, price); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := conn.ExecContext(ctx, `INSERT INTO asset_quotes (asset_id, simulated_day, price, total_quantity) VALUES ($1, 1, 50, 0)`, b); err != nil {
		t.Fatal(err)
	}

	series, err := repo.ListRecentPricesByAsset(ctx, 3)
	if err != nil {
		t.Fatal(err)
	}
	got := series[a]
	if len(got) != 3 || got[0] != 11 || got[1] != 12 || got[2] != 13 {
		t.Errorf("série de A = %v, want [11 12 13] (3 mais recentes, cronológicos)", got)
	}
	if len(series[b]) != 1 || series[b][0] != 50 {
		t.Errorf("série de B = %v, want [50]", series[b])
	}
	if _, ok := series[semCotacao]; ok {
		t.Errorf("ativo sem cotação apareceu no mapa")
	}
}
