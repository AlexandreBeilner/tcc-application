package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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

func (f *fakeCatalogReader) FindEquitySpecialization(_ context.Context, _ string) (catalog.EquitySpecialization, bool, error) {
	return f.equity, f.equityOK, f.equityErr
}

func (f *fakeCatalogReader) FindETFDetails(_ context.Context, _ string) (etf.Details, bool, error) {
	return f.etfDetails, f.etfOK, f.etfErr
}

func (f *fakeCatalogReader) FindFIIDetails(_ context.Context, _ string) (fii.Details, bool, error) {
	return f.fiiDetails, f.fiiOK, f.fiiErr
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
	New("", nil, reader, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
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
}

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
}

func TestHandleGetAsset_NaoEncontrado(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{assetFound: false}, "/assets/inexistente")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}
