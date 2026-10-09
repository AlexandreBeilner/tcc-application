package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tcc-investimentos/engine/internal/domain/assetprovision"
)

type fakeProvisioner struct {
	previewErr, createErr error
	createResult          assetprovision.Result
	specs                 []assetprovision.Spec
	created               int
}

func (f *fakeProvisioner) Preview(_ context.Context, s assetprovision.Spec) (assetprovision.Preview, error) {
	f.specs = append(f.specs, s)
	if f.previewErr != nil {
		return assetprovision.Preview{}, f.previewErr
	}
	shares := s.OutstandingShares
	return assetprovision.Preview{Kind: s.Kind, Ticker: s.Ticker, Name: s.Name, OutstandingShares: &shares,
		Pool: &assetprovision.PoolPreview{PoolBefore: 60, PoolAfter: 62, NewBots: 2, MarketMakerShares: shares / 2, BotShares: shares / 2, MarketMakerID: "mm-1"}}, nil
}

func (f *fakeProvisioner) Create(_ context.Context, s assetprovision.Spec) (assetprovision.Result, error) {
	f.specs = append(f.specs, s)
	f.created++
	if f.createErr != nil {
		return f.createResult, f.createErr
	}
	return assetprovision.Result{AssetID: "11111111-1111-4111-8111-111111111111", Preview: assetprovision.Preview{Kind: s.Kind, Ticker: s.Ticker}}, nil
}

func callProvision(t *testing.T, p assetProvisioner, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var opts []Option
	if p != nil {
		opts = append(opts, WithAssetProvision(p))
	}
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, opts...).Handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, strings.NewReader(body)))
	return rec
}

const equityBody = `{"kind":"acao","ticker":"NOVA3","name":"Nova ON","company_name":"Nova SA","cnpj":"44555666000177","sector":"Varejo","outstanding_shares":200000000,"base_growth_pct":3,"quality_multiplier":1`

func TestAdminCatalogCreate_503SemServico(t *testing.T) {
	for _, path := range []string{"/admin/catalog/preview", "/admin/catalog"} {
		if rec := callProvision(t, nil, path, `{}`); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("%s = %d, want 503", path, rec.Code)
		}
	}
}

func TestAdminCatalogPreview(t *testing.T) {
	p := &fakeProvisioner{}
	rec := callProvision(t, p, "/admin/catalog/preview", equityBody+`}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	var got assetPreviewResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Pool == nil || got.Pool.NewBots != 2 || got.Pool.PoolAfter != 62 || got.Ticker != "NOVA3" {
		t.Errorf("resposta = %+v", got)
	}
	if p.created != 0 || len(p.specs) != 1 || string(p.specs[0].Sector) != "Varejo" || p.specs[0].OutstandingShares != 200_000_000 {
		t.Errorf("spec = %+v, criados = %d", p.specs, p.created)
	}
	t.Run("não exige admin_id", func(t *testing.T) {
		if rec.Code != http.StatusOK {
			t.Error("preview não grava, então não precisa de admin_id")
		}
	})
}

func TestAdminCatalogCreate(t *testing.T) {
	const adminID = `,"admin_id":"33333333-3333-4333-8333-333333333333"}`
	t.Run("cria e devolve 201 com o id", func(t *testing.T) {
		p := &fakeProvisioner{}
		rec := callProvision(t, p, "/admin/catalog", equityBody+adminID)
		if rec.Code != http.StatusCreated || !strings.Contains(rec.Body.String(), "11111111-1111-4111-8111-111111111111") {
			t.Fatalf("status = %d: %s", rec.Code, rec.Body)
		}
	})
	t.Run("ETF leva a cesta", func(t *testing.T) {
		p := &fakeProvisioner{}
		body := `{"kind":"etf","ticker":"NOVE11","name":"ETF","benchmark_index":"Idx","holdings":[{"ticker":"VALR3","weight_pct":60},{"ticker":"TJLO11","weight_pct":40}]` + adminID
		if rec := callProvision(t, p, "/admin/catalog", body); rec.Code != http.StatusCreated {
			t.Fatalf("status = %d: %s", rec.Code, rec.Body)
		}
		if h := p.specs[0].Holdings; len(h) != 2 || h[0].Ticker != "VALR3" || h[1].WeightPct != 40 {
			t.Errorf("cesta = %+v", h)
		}
	})
	t.Run("sem admin_id é 400 e não cria", func(t *testing.T) {
		p := &fakeProvisioner{}
		if rec := callProvision(t, p, "/admin/catalog", equityBody+`}`); rec.Code != http.StatusBadRequest || p.created != 0 {
			t.Errorf("status = %d, criados = %d", rec.Code, p.created)
		}
	})
	t.Run("corpo inválido é 400", func(t *testing.T) {
		if rec := callProvision(t, &fakeProvisioner{}, "/admin/catalog", `nada`); rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d", rec.Code)
		}
	})
	t.Run("validação é 422 com o campo", func(t *testing.T) {
		p := &fakeProvisioner{createErr: &assetprovision.ValidationError{Field: "cnpj", Message: "CNPJ deve ter 14 dígitos"}}
		rec := callProvision(t, p, "/admin/catalog", equityBody+adminID)
		if rec.Code != http.StatusUnprocessableEntity || !strings.Contains(rec.Body.String(), `"field":"cnpj"`) {
			t.Errorf("status = %d: %s", rec.Code, rec.Body)
		}
	})
	t.Run("ticker em uso é 409", func(t *testing.T) {
		p := &fakeProvisioner{createErr: &assetprovision.ConflictError{Message: "o ticker NOVA3 já existe no catálogo"}}
		if rec := callProvision(t, p, "/admin/catalog", equityBody+adminID); rec.Code != http.StatusConflict {
			t.Errorf("status = %d", rec.Code)
		}
	})
	t.Run("falha depois do catálogo é 500 com o asset_id", func(t *testing.T) {
		p := &fakeProvisioner{createErr: errors.New("cobertura falhou"), createResult: assetprovision.Result{AssetID: "abc"}}
		rec := callProvision(t, p, "/admin/catalog", equityBody+adminID)
		if rec.Code != http.StatusInternalServerError || !strings.Contains(rec.Body.String(), `"asset_id":"abc"`) {
			t.Errorf("status = %d: %s", rec.Code, rec.Body)
		}
	})
	t.Run("falha antes do catálogo é 500 sem asset_id", func(t *testing.T) {
		p := &fakeProvisioner{createErr: errors.New("banco fora")}
		rec := callProvision(t, p, "/admin/catalog", equityBody+adminID)
		if rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "asset_id") {
			t.Errorf("status = %d: %s", rec.Code, rec.Body)
		}
	})
}

func TestAdminCatalogPreview_Erros(t *testing.T) {
	p := &fakeProvisioner{previewErr: &assetprovision.ConflictError{Message: "ticker em uso"}}
	if rec := callProvision(t, p, "/admin/catalog/preview", equityBody+`}`); rec.Code != http.StatusConflict {
		t.Errorf("status = %d", rec.Code)
	}
}
