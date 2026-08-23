package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
)

func TestHandleGetCompany(t *testing.T) {
	shareClass := "ON"
	reader := &fakeCatalogReader{
		company: catalog.CompanyRecord{
			ID:      "c1",
			Company: catalog.Company{Name: "Mineradora Vale do Rio S.A.", CNPJ: "11222333000181", Sector: catalog.SectorMineracao},
		},
		companyFound: true,
		companyAssets: []catalog.IssuedAsset{
			{AssetID: "1", Ticker: "VALR3", Name: "Vale ON", ShareClass: &shareClass},
		},
	}

	rec := getCatalog(t, reader, "/companies/c1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body companyDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Name != "Mineradora Vale do Rio S.A." || body.Sector != string(catalog.SectorMineracao) {
		t.Errorf("body = %+v, inesperado", body)
	}
	if len(body.Assets) != 1 || body.Assets[0].Ticker != "VALR3" {
		t.Errorf("Assets = %+v, want 1 ativo VALR3", body.Assets)
	}
}

func TestHandleGetCompany_NaoEncontrada(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{companyFound: false}, "/companies/inexistente")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandleGetCompany_SemCatalogReader(t *testing.T) {
	rec := getCatalog(t, nil, "/companies/c1")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestHandleGetCompany_ErroBuscarEmpresa(t *testing.T) {
	rec := getCatalog(t, &fakeCatalogReader{companyErr: context.DeadlineExceeded}, "/companies/c1")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetCompany_ErroListarAtivos(t *testing.T) {
	reader := &fakeCatalogReader{companyFound: true, companyAssetsErr: context.DeadlineExceeded}
	rec := getCatalog(t, reader, "/companies/c1")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetCompany_ComHistoricoDeFundamentos(t *testing.T) {
	netRevenue := 1_050_000.0
	periodDate := time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC)
	reader := &fakeCatalogReader{
		companyFound: true,
		companyFundamentals: []catalog.FundamentalsEntry{
			{PeriodDate: periodDate, NetRevenue: &netRevenue},
		},
	}

	rec := getCatalog(t, reader, "/companies/c1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body companyDetailResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body.Fundamentals) != 1 {
		t.Fatalf("Fundamentals = %+v, want 1 entrada", body.Fundamentals)
	}
	if body.Fundamentals[0].NetRevenue == nil || *body.Fundamentals[0].NetRevenue != netRevenue {
		t.Errorf("Fundamentals[0].NetRevenue = %v, want %v", body.Fundamentals[0].NetRevenue, netRevenue)
	}
}

func TestHandleGetCompany_ErroListarFundamentos(t *testing.T) {
	reader := &fakeCatalogReader{companyFound: true, companyFundamentalsErr: context.DeadlineExceeded}
	rec := getCatalog(t, reader, "/companies/c1")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}
