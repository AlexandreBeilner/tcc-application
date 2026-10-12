package httpserver

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/fii"
)

// fakeCatalogReader implementa catalogReader (assetCatalogReader +
// companyCatalogReader) devolvendo valores canônicos configurados por
// teste — mesmo padrão de fakeAccountOpener (account_test.go).
type fakeCatalogReader struct {
	assets    []catalog.AssetRecord
	assetsErr error

	asset      catalog.AssetRecord
	assetFound bool
	assetErr   error

	fixedIncome    catalog.FixedIncomeSpecialization
	fixedIncomeOK  bool
	fixedIncomeErr error

	selicRate    float64
	selicRateOK  bool
	selicRateErr error

	equity    catalog.EquitySpecialization
	equityOK  bool
	equityErr error

	etfDetails etf.Details
	etfOK      bool
	etfErr     error

	fiiDetails fii.Details
	fiiOK      bool
	fiiErr     error

	company      catalog.CompanyRecord
	companyFound bool
	companyErr   error

	companyAssets    []catalog.IssuedAsset
	companyAssetsErr error

	companyFundamentals    []catalog.FundamentalsEntry
	companyFundamentalsErr error

	currentQuote      catalog.Quote
	currentQuoteFound bool
	currentQuoteErr   error

	currentQuotes    map[string]catalog.Quote
	currentQuotesErr error

	quoteHistory    []catalog.QuoteHistoryEntry
	quoteHistoryErr error
	recentPrices    map[string][]float64
	recentPricesErr error

	etfNAV      catalog.ETFNAV
	etfNAVFound bool
	etfNAVErr   error

	latestFundamentals    catalog.FundamentalsSnapshot
	latestFundamentalsOK  bool
	latestFundamentalsErr error

	dividendHistory    []catalog.DividendHistoryEntry
	dividendHistoryErr error
}

func (f *fakeCatalogReader) ListAssets(_ context.Context, _ string) ([]catalog.AssetRecord, error) {
	return f.assets, f.assetsErr
}

func (f *fakeCatalogReader) FindAssetByID(_ context.Context, _ string) (catalog.AssetRecord, bool, error) {
	return f.asset, f.assetFound, f.assetErr
}

func (f *fakeCatalogReader) FindFixedIncomeSpecialization(_ context.Context, _ string) (catalog.FixedIncomeSpecialization, bool, error) {
	return f.fixedIncome, f.fixedIncomeOK, f.fixedIncomeErr
}

func (f *fakeCatalogReader) CurrentSimulatedDay(_ context.Context) (int, error) {
	return 0, nil
}

func (f *fakeCatalogReader) CurrentSelicRatePct(_ context.Context) (float64, bool, error) {
	return f.selicRate, f.selicRateOK, f.selicRateErr
}

func (f *fakeCatalogReader) FindEquitySpecialization(_ context.Context, _ string) (catalog.EquitySpecialization, bool, error) {
	return f.equity, f.equityOK, f.equityErr
}

func (f *fakeCatalogReader) FindLatestETFNAV(_ context.Context, _ string) (catalog.ETFNAV, bool, error) {
	return f.etfNAV, f.etfNAVFound, f.etfNAVErr
}

func (f *fakeCatalogReader) FindETFDetails(_ context.Context, _ string) (etf.Details, bool, error) {
	return f.etfDetails, f.etfOK, f.etfErr
}

func (f *fakeCatalogReader) FindFIIDetails(_ context.Context, _ string) (fii.Details, bool, error) {
	return f.fiiDetails, f.fiiOK, f.fiiErr
}

func (f *fakeCatalogReader) FindCurrentQuote(_ context.Context, _ string) (catalog.Quote, bool, error) {
	return f.currentQuote, f.currentQuoteFound, f.currentQuoteErr
}

func (f *fakeCatalogReader) ListCurrentQuotes(_ context.Context) (map[string]catalog.Quote, error) {
	return f.currentQuotes, f.currentQuotesErr
}

func (f *fakeCatalogReader) ListQuoteHistory(_ context.Context, _ string, _ int) ([]catalog.QuoteHistoryEntry, error) {
	return f.quoteHistory, f.quoteHistoryErr
}

func (f *fakeCatalogReader) ListRecentPricesByAsset(_ context.Context, _ int) (map[string][]float64, error) {
	return f.recentPrices, f.recentPricesErr
}

func (f *fakeCatalogReader) FindLatestFundamentals(_ context.Context, _ string) (catalog.FundamentalsSnapshot, bool, error) {
	return f.latestFundamentals, f.latestFundamentalsOK, f.latestFundamentalsErr
}

func (f *fakeCatalogReader) ListDividendHistory(_ context.Context, _ string) ([]catalog.DividendHistoryEntry, error) {
	return f.dividendHistory, f.dividendHistoryErr
}

func (f *fakeCatalogReader) FindCompanyByID(_ context.Context, _ string) (catalog.CompanyRecord, bool, error) {
	return f.company, f.companyFound, f.companyErr
}

func (f *fakeCatalogReader) ListAssetsByCompany(_ context.Context, _ string) ([]catalog.IssuedAsset, error) {
	return f.companyAssets, f.companyAssetsErr
}

func (f *fakeCatalogReader) ListFundamentalsByCompany(_ context.Context, _ string) ([]catalog.FundamentalsEntry, error) {
	return f.companyFundamentals, f.companyFundamentalsErr
}

func getCatalog(t *testing.T, reader catalogReader, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	New("", nil, reader, nil, nil, nil, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func TestHandleListAssets(t *testing.T) {
	reader := &fakeCatalogReader{assets: []catalog.AssetRecord{
		{ID: "1", Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
	}}

	rec := getCatalog(t, reader, "/assets")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body []assetSummaryResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 1 || body[0].Ticker != "VALR3" {
		t.Errorf("body = %+v, want ticker VALR3", body)
	}
}

func TestHandleListAssets_TipoInvalido(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{}, "/assets?type=cripto")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleListAssets_SemCatalogReader(t *testing.T) {
	rec := getCatalog(t, nil, "/assets")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestHandleListAssets_ErroInterno(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{assetsErr: context.DeadlineExceeded}, "/assets")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetAsset_ErroBuscarAtivo(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{assetErr: context.DeadlineExceeded}, "/assets/1")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetAsset_ErroEspecializacao(t *testing.T) {
	tests := map[string]struct {
		assetType catalog.AssetType
		reader    *fakeCatalogReader
	}{
		"renda fixa": {catalog.AssetCDB, &fakeCatalogReader{fixedIncomeErr: context.DeadlineExceeded}},
		"ação":       {catalog.AssetAcao, &fakeCatalogReader{equityErr: context.DeadlineExceeded}},
		"etf":        {catalog.AssetETF, &fakeCatalogReader{etfErr: context.DeadlineExceeded}},
		"fii":        {catalog.AssetFII, &fakeCatalogReader{fiiErr: context.DeadlineExceeded}},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			tt.reader.asset = catalog.AssetRecord{ID: "1", Asset: catalog.Asset{Ticker: "X", Name: "X", Type: tt.assetType}}
			tt.reader.assetFound = true

			rec := getCatalog(t, tt.reader, "/assets/1")
			if rec.Code != http.StatusInternalServerError {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
			}
		})
	}
}

func TestHandleGetAsset_RendaFixa(t *testing.T) {
	interestRate := 12.0
	rating := "AA"
	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "1",
			Asset: catalog.Asset{Ticker: "CRI2028", Name: "CRI Securitizadora X 2028", Type: catalog.AssetCRI},
		},
		assetFound: true,
		fixedIncome: catalog.FixedIncomeSpecialization{
			InterestRate:     &interestRate,
			IssuerType:       "securitizadora",
			TaxExempt:        true,
			CreditRiskRating: &rating,
		},
		fixedIncomeOK: true,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body assetDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.FixedIncome == nil {
		t.Fatalf("FixedIncome = nil, want preenchido")
	}
	if body.FixedIncome.IssuerType != "securitizadora" || !body.FixedIncome.TaxExempt {
		t.Errorf("FixedIncome = %+v, inesperado", body.FixedIncome)
	}
	if body.Equity != nil || body.ETF != nil || body.FII != nil {
		t.Errorf("classes erradas preenchidas: %+v", body)
	}
}

func TestHandleGetAsset_Acao(t *testing.T) {
	shareClass := "ON"
	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "1",
			Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao},
		},
		assetFound: true,
		equity: catalog.EquitySpecialization{
			CompanyID:     "c1",
			CompanyName:   "Mineradora Vale do Rio S.A.",
			CompanyCNPJ:   "11222333000181",
			CompanySector: catalog.SectorMineracao,
			ShareClass:    &shareClass,
		},
		equityOK: true,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body assetDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Equity == nil {
		t.Fatalf("Equity = nil, want preenchido")
	}
	if body.Equity.Company.Name != "Mineradora Vale do Rio S.A." || body.Equity.Company.Sector != string(catalog.SectorMineracao) {
		t.Errorf("Equity.Company = %+v, inesperado", body.Equity.Company)
	}
	if body.FixedIncome != nil || body.ETF != nil || body.FII != nil {
		t.Errorf("classes erradas preenchidas: %+v", body)
	}
	if body.Equity.Indicators != nil {
		t.Errorf("Indicators = %+v, want nil (empresa sem ciclo de relatório rodado nesta fake)", body.Equity.Indicators)
	}
	if body.Equity.DividendHistory == nil {
		t.Error("DividendHistory = nil, want slice vazia (não nil) — ativo sem provento gerado ainda")
	}
}

// TestHandleGetAsset_AcaoComIndicadores é o critério de aceite central da
// tarefa 4.8: os 8 indicadores calculados corretamente contra um cenário
// de teste com números conhecidos.
func TestHandleGetAsset_AcaoComIndicadores(t *testing.T) {
	outstandingShares := int64(10_000)
	netRevenue, netIncome, ebit, netEquity, grossDebt, cash := 1_000_000.0, 100_000.0, 180_000.0, 1_200_000.0, 480_000.0, 150_000.0

	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "1",
			Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao},
		},
		assetFound: true,
		equity: catalog.EquitySpecialization{
			CompanyID:         "c1",
			CompanyName:       "Mineradora Vale do Rio S.A.",
			CompanyCNPJ:       "11222333000181",
			CompanySector:     catalog.SectorMineracao,
			OutstandingShares: &outstandingShares,
		},
		equityOK:          true,
		currentQuote:      catalog.Quote{Price: 150},
		currentQuoteFound: true,
		latestFundamentals: catalog.FundamentalsSnapshot{
			NetRevenue:      &netRevenue,
			NetIncome:       &netIncome,
			EBIT:            &ebit,
			NetEquity:       &netEquity,
			GrossDebt:       &grossDebt,
			CashEquivalents: &cash,
		},
		latestFundamentalsOK: true,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body assetDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Equity == nil || body.Equity.Indicators == nil {
		t.Fatalf("Equity.Indicators = nil, want preenchido")
	}
	ind := body.Equity.Indicators

	want := map[string]struct {
		got, want *float64
	}{
		"earnings_per_share":   {ind.EarningsPerShare, floatPtr(10)},                 // 100.000 / 10.000
		"book_value_per_share": {ind.BookValuePerShare, floatPtr(120)},               // 1.200.000 / 10.000
		"roe":                  {ind.ROE, floatPtr(100_000.0 / 1_200_000.0)},         // net_income / net_equity
		"ebit_margin":          {ind.EBITMargin, floatPtr(0.18)},                     // 180.000 / 1.000.000
		"net_margin":           {ind.NetMargin, floatPtr(0.1)},                       // 100.000 / 1.000.000
		"net_debt_to_ebit":     {ind.NetDebtToEBIT, floatPtr(330_000.0 / 180_000.0)}, // (480.000 - 150.000) / 180.000
		"price_to_earnings":    {ind.PriceToEarnings, floatPtr(15)},                  // 150 / 10 (LPA)
		"price_to_book_value":  {ind.PriceToBookValue, floatPtr(1.25)},               // 150 / 120 (VPA)
	}
	for name, tt := range want {
		if tt.got == nil {
			t.Errorf("%s = nil, want %v", name, *tt.want)
			continue
		}
		if *tt.got != *tt.want {
			t.Errorf("%s = %v, want %v", name, *tt.got, *tt.want)
		}
	}
}

// TestHandleGetAsset_AcaoErroFundamentos confere que erro na leitura do
// fundamento mais recente da empresa devolve 500, mesmo padrão dos demais
// colaboradores de handleGetAsset.
func TestHandleGetAsset_AcaoErroFundamentos(t *testing.T) {
	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "1",
			Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao},
		},
		assetFound:            true,
		equity:                catalog.EquitySpecialization{CompanyID: "c1"},
		equityOK:              true,
		latestFundamentalsErr: context.DeadlineExceeded,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

// TestHandleGetAsset_AcaoComDividendYield confere o Dividend Yield (tarefa
// 4.9, 9º indicador de RF21, calculado independentemente dos outros 8) —
// só o provento pago dentro dos últimos 12 meses entra na soma.
func TestHandleGetAsset_AcaoComDividendYield(t *testing.T) {
	now := time.Now()
	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "1",
			Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao},
		},
		assetFound:        true,
		equity:            catalog.EquitySpecialization{CompanyID: "c1"},
		equityOK:          true,
		currentQuote:      catalog.Quote{Price: 100},
		currentQuoteFound: true,
		dividendHistory: []catalog.DividendHistoryEntry{
			{ValuePerShare: 2, ExDate: now.AddDate(0, -1, 0), PaymentDate: now.AddDate(0, -1, 0)},
			{ValuePerShare: 3, ExDate: now.AddDate(-2, 0, 0), PaymentDate: now.AddDate(-2, 0, 0)},
		},
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body assetDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body.Equity.DividendHistory) != 2 {
		t.Fatalf("len(DividendHistory) = %d, want 2 (histórico completo, não só os últimos 12 meses)", len(body.Equity.DividendHistory))
	}
	if body.Equity.Indicators == nil || body.Equity.Indicators.DividendYield == nil {
		t.Fatalf("DividendYield = nil, want preenchido")
	}
	if *body.Equity.Indicators.DividendYield != 0.02 {
		t.Errorf("DividendYield = %v, want 0.02 (2/100 — o provento de 2 anos atrás fica fora da janela de 12 meses)", *body.Equity.Indicators.DividendYield)
	}
}

// TestHandleGetAsset_AcaoErroHistoricoDividendos confere que erro na
// leitura do histórico de dividend_events devolve 500, mesmo padrão dos
// demais colaboradores de handleGetAsset.
func TestHandleGetAsset_AcaoErroHistoricoDividendos(t *testing.T) {
	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "1",
			Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao},
		},
		assetFound:         true,
		equity:             catalog.EquitySpecialization{CompanyID: "c1"},
		equityOK:           true,
		dividendHistoryErr: context.DeadlineExceeded,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func floatPtr(v float64) *float64 { return &v }

func TestHandleGetAsset_ETF(t *testing.T) {
	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "1",
			Asset: catalog.Asset{Ticker: "SINT11", Name: "ETF Índice Sintético", Type: catalog.AssetETF},
		},
		assetFound: true,
		etfDetails: etf.Details{
			BenchmarkIndex:     "Ibovespa",
			MethodologySummary: "Replicação sintética.",
			Holdings: []etf.Holding{
				{ConstituentName: "Mineradora Vale do Rio S.A.", WeightPct: 40},
				{ConstituentName: "Outros", WeightPct: 60},
			},
		},
		etfOK: true,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body assetDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.ETF == nil {
		t.Fatalf("ETF = nil, want preenchido")
	}
	if body.ETF.BenchmarkIndex != "Ibovespa" || len(body.ETF.Holdings) != 2 {
		t.Errorf("ETF = %+v, inesperado", body.ETF)
	}
	if body.FixedIncome != nil || body.Equity != nil || body.FII != nil {
		t.Errorf("classes erradas preenchidas: %+v", body)
	}
	if body.ETF.NAV != nil || body.ETF.SharesOutstanding != nil {
		t.Errorf("NAV = %+v, want ausente antes da emissão inicial", body.ETF)
	}
}

func TestHandleGetAsset_ETFComNAV(t *testing.T) {
	trackingError := 2.75
	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "1",
			Asset: catalog.Asset{Ticker: "SINT11", Name: "ETF Índice Sintético", Type: catalog.AssetETF},
		},
		assetFound:  true,
		etfDetails:  etf.Details{BenchmarkIndex: "Ibovespa", Holdings: []etf.Holding{{ConstituentName: "X", WeightPct: 100}}},
		etfOK:       true,
		etfNAV:      catalog.ETFNAV{SimulatedDay: 7, NAV: 101.25, PremiumPct: -1.5, TrackingErrorPct: &trackingError, OutstandingShares: 10000},
		etfNAVFound: true,
		dividendHistory: []catalog.DividendHistoryEntry{
			{ValuePerShare: 0.42, ExDate: time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC), PaymentDate: time.Date(2026, 3, 6, 0, 0, 0, 0, time.UTC)},
		},
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var body assetDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.ETF == nil || body.ETF.NAV == nil || *body.ETF.NAV != 101.25 || *body.ETF.PremiumPct != -1.5 ||
		*body.ETF.NAVDay != 7 || *body.ETF.SharesOutstanding != 10000 {
		t.Errorf("ETF = %+v, want NAV 101.25, ágio -1.5, dia 7, 10000 cotas", body.ETF)
	}
	if body.ETF.TrackingErrorPct == nil || *body.ETF.TrackingErrorPct != 2.75 {
		t.Errorf("TrackingErrorPct = %v, want 2.75", body.ETF.TrackingErrorPct)
	}
	if len(body.ETF.DividendHistory) != 1 || body.ETF.DividendHistory[0].ValuePerShare != 0.42 {
		t.Errorf("DividendHistory = %+v, want 1 provento de 0.42 por cota", body.ETF.DividendHistory)
	}
}

func TestHandleGetAsset_ETFErroAoBuscarProventos(t *testing.T) {
	reader := &fakeCatalogReader{
		asset:              catalog.AssetRecord{ID: "1", Asset: catalog.Asset{Ticker: "SINT11", Name: "ETF", Type: catalog.AssetETF}},
		assetFound:         true,
		etfDetails:         etf.Details{BenchmarkIndex: "Ibovespa", Holdings: []etf.Holding{{ConstituentName: "X", WeightPct: 100}}},
		etfOK:              true,
		dividendHistoryErr: context.DeadlineExceeded,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetAsset_ETFErroAoBuscarNAV(t *testing.T) {
	reader := &fakeCatalogReader{
		asset:      catalog.AssetRecord{ID: "1", Asset: catalog.Asset{Ticker: "SINT11", Name: "ETF", Type: catalog.AssetETF}},
		assetFound: true,
		etfDetails: etf.Details{BenchmarkIndex: "Ibovespa", Holdings: []etf.Holding{{ConstituentName: "X", WeightPct: 100}}},
		etfOK:      true,
		etfNAVErr:  context.DeadlineExceeded,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetAsset_FII(t *testing.T) {
	segment := "Lajes Corporativas"
	netWorth := 500_000_000.00
	vacancyRate := 5.2
	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "1",
			Asset: catalog.Asset{Ticker: "TJLO11", Name: "FII Tijolo Corporativo", Type: catalog.AssetFII},
		},
		assetFound: true,
		fiiDetails: fii.Details{
			Type:        fii.TypeTijolo,
			Segment:     &segment,
			NetWorth:    &netWorth,
			VacancyRate: &vacancyRate,
		},
		fiiOK: true,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body assetDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.FII == nil {
		t.Fatalf("FII = nil, want preenchido")
	}
	if body.FII.FIIType != string(fii.TypeTijolo) || body.FII.Indexador != nil {
		t.Errorf("FII = %+v, inesperado", body.FII)
	}
	if body.FixedIncome != nil || body.Equity != nil || body.ETF != nil {
		t.Errorf("classes erradas preenchidas: %+v", body)
	}
	if body.FII.DividendHistory == nil {
		t.Error("DividendHistory = nil, want slice vazia (não nil) — ativo sem provento gerado ainda")
	}
	if body.FII.DividendYield != nil {
		t.Errorf("DividendYield = %v, want nil (sem cotação corrente nesta fake)", *body.FII.DividendYield)
	}
}

// TestHandleGetAsset_FIIPapel confere que FII papel (tarefa 4.10) expõe
// PortfolioValue (nunca NetWorth/VacancyRate) — o achado da tarefa 4.9 era
// que FII papel nunca tinha grandeza numérica própria no catálogo.
func TestHandleGetAsset_FIIPapel(t *testing.T) {
	indexador := "CDI"
	portfolioValue := 300_000_000.00
	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "2",
			Asset: catalog.Asset{Ticker: "PAPL11", Name: "FII Papel Recebíveis", Type: catalog.AssetFII},
		},
		assetFound: true,
		fiiDetails: fii.Details{
			Type:           fii.TypePapel,
			Indexador:      &indexador,
			PortfolioValue: &portfolioValue,
		},
		fiiOK: true,
	}

	rec := getCatalog(t, reader, "/assets/2")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body assetDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.FII == nil {
		t.Fatalf("FII = nil, want preenchido")
	}
	if body.FII.FIIType != string(fii.TypePapel) {
		t.Errorf("FIIType = %v, want %v", body.FII.FIIType, fii.TypePapel)
	}
	if body.FII.PortfolioValue == nil || *body.FII.PortfolioValue != portfolioValue {
		t.Errorf("PortfolioValue = %v, want %v", body.FII.PortfolioValue, portfolioValue)
	}
	if body.FII.NetWorth != nil || body.FII.VacancyRate != nil {
		t.Errorf("FII = %+v, tijolo-only fields deveriam estar nil pro perfil papel", body.FII)
	}
}

// TestHandleGetAsset_FIIComDividendYield confere o Dividend Yield de FII
// (tarefa 4.9, RF21) — mesmo cálculo do bloco de ação, mas exposto direto
// em fiiDetailResponse (nunca reaproveita equityIndicatorsResponse,
// CLAUDE.md).
func TestHandleGetAsset_FIIComDividendYield(t *testing.T) {
	now := time.Now()
	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "1",
			Asset: catalog.Asset{Ticker: "TJLO11", Name: "FII Tijolo Corporativo", Type: catalog.AssetFII},
		},
		assetFound:        true,
		fiiDetails:        fii.Details{Type: fii.TypeTijolo},
		fiiOK:             true,
		currentQuote:      catalog.Quote{Price: 100},
		currentQuoteFound: true,
		dividendHistory: []catalog.DividendHistoryEntry{
			{ValuePerShare: 1, ExDate: now.AddDate(0, -1, 0), PaymentDate: now.AddDate(0, -1, 0)},
		},
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body assetDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.FII == nil || body.FII.DividendYield == nil {
		t.Fatalf("FII.DividendYield = nil, want preenchido")
	}
	if *body.FII.DividendYield != 0.01 {
		t.Errorf("DividendYield = %v, want 0.01 (1/100)", *body.FII.DividendYield)
	}
	if len(body.FII.DividendHistory) != 1 {
		t.Errorf("len(DividendHistory) = %d, want 1", len(body.FII.DividendHistory))
	}
}

// TestHandleGetAsset_FIIErroHistoricoDividendos confere que erro na
// leitura do histórico de dividend_events devolve 500, mesmo padrão do
// equivalente de ação.
func TestHandleGetAsset_FIIErroHistoricoDividendos(t *testing.T) {
	reader := &fakeCatalogReader{
		asset: catalog.AssetRecord{
			ID:    "1",
			Asset: catalog.Asset{Ticker: "TJLO11", Name: "FII Tijolo Corporativo", Type: catalog.AssetFII},
		},
		assetFound:         true,
		fiiDetails:         fii.Details{Type: fii.TypeTijolo},
		fiiOK:              true,
		dividendHistoryErr: context.DeadlineExceeded,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetAsset_NaoEncontrado(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{assetFound: false}, "/assets/inexistente")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandleListAssets_ComCotacao(t *testing.T) {
	changePct := 2.5
	reader := &fakeCatalogReader{
		assets: []catalog.AssetRecord{
			{ID: "1", Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
			{ID: "2", Asset: catalog.Asset{Ticker: "CDB2028", Name: "CDB Banco X", Type: catalog.AssetCDB}},
		},
		currentQuotes: map[string]catalog.Quote{
			"1": {Price: 105.0, DailyChangePct: &changePct},
		},
	}

	rec := getCatalog(t, reader, "/assets")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body []assetSummaryResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body[0].CurrentPrice == nil || *body[0].CurrentPrice != 105.0 || body[0].DailyChangePct == nil || *body[0].DailyChangePct != 2.5 {
		t.Errorf("ativo com cotação = %+v, inesperado", body[0])
	}
	if body[1].CurrentPrice != nil || body[1].DailyChangePct != nil {
		t.Errorf("renda fixa não deveria ter cotação: %+v", body[1])
	}
}

func TestHandleListAssets_ErroCotacoes(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{currentQuotesErr: context.DeadlineExceeded}, "/assets")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetAsset_ComCotacao(t *testing.T) {
	changePct := -1.2
	reader := &fakeCatalogReader{
		asset:             catalog.AssetRecord{ID: "1", Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
		assetFound:        true,
		equityOK:          true,
		currentQuote:      catalog.Quote{Price: 98.8, DailyChangePct: &changePct},
		currentQuoteFound: true,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body assetDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.CurrentPrice == nil || *body.CurrentPrice != 98.8 || body.DailyChangePct == nil || *body.DailyChangePct != -1.2 {
		t.Errorf("cotação = %+v, inesperado", body.assetSummaryResponse)
	}
}

func TestHandleGetAsset_SemCotacao(t *testing.T) {
	reader := &fakeCatalogReader{
		asset:      catalog.AssetRecord{ID: "1", Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
		assetFound: true,
		equityOK:   true,
	}

	rec := getCatalog(t, reader, "/assets/1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body assetDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.CurrentPrice != nil || body.DailyChangePct != nil {
		t.Errorf("sem tick gerado ainda, cotação deveria vir omitida: %+v", body.assetSummaryResponse)
	}
}

func TestHandleGetAsset_ErroCotacao(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{
		asset:           catalog.AssetRecord{ID: "1", Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
		assetFound:      true,
		currentQuoteErr: context.DeadlineExceeded,
	}, "/assets/1")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetAssetQuoteHistory(t *testing.T) {
	reader := &fakeCatalogReader{
		asset:      catalog.AssetRecord{ID: "1", Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
		assetFound: true,
		quoteHistory: []catalog.QuoteHistoryEntry{
			{SimulatedDay: 1, Price: 100.0},
			{SimulatedDay: 2, Price: 101.5},
		},
	}

	rec := getCatalog(t, reader, "/assets/1/quotes?days=10")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body []quoteHistoryEntryResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 2 || body[0].SimulatedDay != 1 || body[1].SimulatedDay != 2 {
		t.Errorf("body = %+v, want série cronológica de 2 dias", body)
	}
}

func TestHandleListRecentPrices(t *testing.T) {
	reader := &fakeCatalogReader{recentPrices: map[string][]float64{"a": {10, 11, 12}, "b": {5}}}

	rec := getCatalog(t, reader, "/assets/quotes?days=10")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var body recentPricesResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body.Series) != 2 || len(body.Series["a"]) != 3 || body.Series["b"][0] != 5 {
		t.Errorf("body = %+v, want 2 séries", body)
	}
}

func TestHandleListRecentPrices_SemCotacaoDevolveMapaVazio(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{}, "/assets/quotes")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if got := rec.Body.String(); got != "{\"series\":{}}\n" && got != "{\"series\":{}}" {
		t.Errorf("body = %q, want série vazia (objeto, nunca null)", got)
	}
}

func TestHandleListRecentPrices_DaysInvalido(t *testing.T) {
	for _, q := range []string{"0", "91", "abc"} {
		rec := getCatalog(t, &fakeCatalogReader{}, "/assets/quotes?days="+q)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("days=%s: status = %d, want %d", q, rec.Code, http.StatusBadRequest)
		}
	}
}

func TestHandleListRecentPrices_SemCatalogReader(t *testing.T) {
	rec := getCatalog(t, nil, "/assets/quotes")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestHandleListRecentPrices_ErroInterno(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{recentPricesErr: context.DeadlineExceeded}, "/assets/quotes")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetAssetQuoteHistory_VazioSemTick(t *testing.T) {
	reader := &fakeCatalogReader{
		asset:      catalog.AssetRecord{ID: "1", Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
		assetFound: true,
	}

	rec := getCatalog(t, reader, "/assets/1/quotes")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body []quoteHistoryEntryResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 0 {
		t.Errorf("body = %+v, want lista vazia", body)
	}
}

func TestHandleGetAssetQuoteHistory_NaoEncontrado(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{assetFound: false}, "/assets/inexistente/quotes")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandleGetAssetQuoteHistory_DaysInvalido(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{}, "/assets/1/quotes?days=0")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleGetAssetQuoteHistory_SemCatalogReader(t *testing.T) {
	rec := getCatalog(t, nil, "/assets/1/quotes")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestHandleGetAssetQuoteHistory_ErroInterno(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{
		asset:           catalog.AssetRecord{ID: "1", Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
		assetFound:      true,
		quoteHistoryErr: context.DeadlineExceeded,
	}, "/assets/1/quotes")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

// TestHandleGetAsset_FIIPriceToBook cobre a tarefa U.6: o P/VP do FII é o
// preço sobre o valor patrimonial por cota (tijolo: net_worth; papel:
// portfolio_value), e some quando falta cotação, valor-base ou cotas.
func TestHandleGetAsset_FIIPriceToBook(t *testing.T) {
	shares := int64(1_000_000)
	netWorth := 133_333_333.33
	portfolio := 100_000_000.0
	zeroShares := int64(0)

	tests := []struct {
		name    string
		details fii.Details
		quote   bool
		want    *float64
	}{
		{"tijolo com cotação", fii.Details{Type: fii.TypeTijolo, NetWorth: &netWorth, OutstandingShares: &shares}, true, ptrFloat(75.0 / (133_333_333.33 / 1_000_000))},
		{"papel usa portfolio_value", fii.Details{Type: fii.TypePapel, PortfolioValue: &portfolio, OutstandingShares: &shares}, true, ptrFloat(0.75)},
		{"sem cotação", fii.Details{Type: fii.TypeTijolo, NetWorth: &netWorth, OutstandingShares: &shares}, false, nil},
		{"sem cotas", fii.Details{Type: fii.TypeTijolo, NetWorth: &netWorth}, true, nil},
		{"cotas zero", fii.Details{Type: fii.TypeTijolo, NetWorth: &netWorth, OutstandingShares: &zeroShares}, true, nil},
		{"sem valor-base", fii.Details{Type: fii.TypePapel, OutstandingShares: &shares}, true, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := &fakeCatalogReader{
				asset:      catalog.AssetRecord{ID: "1", Asset: catalog.Asset{Ticker: "TJLO11", Name: "FII", Type: catalog.AssetFII}},
				assetFound: true,
				fiiDetails: tt.details,
				fiiOK:      true,
			}
			if tt.quote {
				reader.currentQuote, reader.currentQuoteFound = catalog.Quote{Price: 75}, true
			}
			rec := getCatalog(t, reader, "/assets/1")
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
			}
			var body assetDetailResponse
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			got := body.FII.PriceToBookValue
			switch {
			case tt.want == nil && got != nil:
				t.Fatalf("PriceToBookValue = %v, want omitido", *got)
			case tt.want != nil && (got == nil || math.Abs(*got-*tt.want) > 1e-9):
				t.Fatalf("PriceToBookValue = %v, want %v", got, *tt.want)
			}
		})
	}
}

func ptrFloat(v float64) *float64 { return &v }
