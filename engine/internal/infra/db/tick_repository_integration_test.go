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

// TestListCompaniesForFundamentals_TrazQualityMultiplier cobre o achado 025:
// o multiplicador gravado por CreateCompany chega em
// tick.CompanyForFundamentals, e a empresa criada sem personalizar usa o
// neutro (1.00). Usa o banco descartável (roda só com TEST_DATABASE_URL).
func TestListCompaniesForFundamentals_TrazQualityMultiplier(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	catalogRepo := NewCatalogRepository(conn, nil)

	for _, c := range []struct {
		name, cnpj string
		quality    float64
	}{
		{"Boa S.A.", "44444444000101", 1.25},
		{"Media S.A.", "44444444000102", catalog.DefaultQualityMultiplier},
		{"Ruim S.A.", "44444444000103", 0.75},
	} {
		company, err := catalog.NewCompany(c.name, c.cnpj, catalog.SectorMineracao, catalog.DefaultBaseGrowthPct, c.quality)
		if err != nil {
			t.Fatalf("NewCompany %s: %v", c.name, err)
		}
		if _, err := catalogRepo.CreateCompany(ctx, company); err != nil {
			t.Fatalf("CreateCompany %s: %v", c.name, err)
		}
	}

	companies, err := NewTickRepository(conn, nil).ListCompaniesForFundamentals(ctx)
	if err != nil {
		t.Fatalf("ListCompaniesForFundamentals: %v", err)
	}
	got := map[float64]bool{}
	for _, c := range companies {
		got[c.QualityMultiplier] = true
	}
	for _, want := range []float64{1.25, 1.0, 0.75} {
		if !got[want] {
			t.Errorf("multiplicador %v ausente em %+v", want, companies)
		}
	}
}

// TestListCompaniesForFundamentals_TrazAgendaDeBalanco cobre a RC.6.8: o offset de
// balanço da empresa e o dia de corte do escalonamento chegam em
// tick.CompanyForFundamentals. Usa o banco descartável (roda só com TEST_DATABASE_URL).
func TestListCompaniesForFundamentals_TrazAgendaDeBalanco(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	catalogRepo := NewCatalogRepository(conn, nil)

	company, err := catalog.NewCompany("Escalonada S.A.", "55555555000101", catalog.SectorMineracao, catalog.DefaultBaseGrowthPct, catalog.DefaultQualityMultiplier)
	if err != nil {
		t.Fatal(err)
	}
	id, err := catalogRepo.CreateCompany(ctx, company)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.ExecContext(ctx, `UPDATE companies SET report_offset_days = 12 WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.ExecContext(ctx, `INSERT INTO market_calendar (id, selic_rate, schedule_cutover_day) VALUES (1, 10, 77)
		 ON CONFLICT (id) DO UPDATE SET schedule_cutover_day = 77`); err != nil {
		t.Fatal(err)
	}

	companies, err := NewTickRepository(conn, nil).ListCompaniesForFundamentals(ctx)
	if err != nil {
		t.Fatalf("ListCompaniesForFundamentals: %v", err)
	}
	for _, c := range companies {
		if c.CompanyID == id {
			if c.ReportOffsetDays != 12 || c.ScheduleCutoverDay != 77 {
				t.Errorf("offset = %d, corte = %d, want 12 e 77", c.ReportOffsetDays, c.ScheduleCutoverDay)
			}
			return
		}
	}
	t.Fatalf("empresa %s ausente em %+v", id, companies)
}

// TestListCompaniesForFundamentals_TrazPoliticaELucrosAnteriores cobre a RC.6.9: a
// agenda de provento da empresa e os lucros dos balanços já persistidos (o mais
// recente primeiro, até 3) chegam ao tick.
func TestListCompaniesForFundamentals_TrazPoliticaELucrosAnteriores(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()

	company, err := catalog.NewCompany("Semestral S.A.", "66666666000101", catalog.SectorMineracao, catalog.DefaultBaseGrowthPct, catalog.DefaultQualityMultiplier)
	if err != nil {
		t.Fatal(err)
	}
	id, err := NewCatalogRepository(conn, nil).CreateCompany(ctx, company)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.ExecContext(ctx,
		`UPDATE companies SET schedule_assigned = true, dividend_policy = 'semiannual', com_lag_days = 2, payment_lag_days = 9 WHERE id = $1`, id); err != nil {
		t.Fatal(err)
	}
	for i, ni := range []float64{100, 200, 300, 400} {
		if _, err := conn.ExecContext(ctx,
			`INSERT INTO company_fundamentals (company_id, period_date, net_revenue, net_income) VALUES ($1, $2::date + $3::int, 1000, $4)`,
			id, "2026-01-01", i*91, ni); err != nil {
			t.Fatal(err)
		}
	}

	companies, err := NewTickRepository(conn, nil).ListCompaniesForFundamentals(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range companies {
		if c.CompanyID != id {
			continue
		}
		if !c.ScheduleAssigned || c.DividendPolicy != catalog.DividendSemiannual || c.ComLagDays != 2 || c.PaymentLagDays != 9 {
			t.Errorf("agenda = %+v", c)
		}
		if len(c.PriorNetIncomes) != 3 || c.PriorNetIncomes[0] != 400 || c.PriorNetIncomes[2] != 200 {
			t.Errorf("PriorNetIncomes = %v, want [400 300 200]", c.PriorNetIncomes)
		}
		return
	}
	t.Fatal("empresa ausente")
}
