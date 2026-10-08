package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/catalogadmin"
)

const (
	catalogAcao    = "11111111-1111-4111-8111-111111111111"
	catalogSandbox = "22222222-2222-4222-8222-222222222222"
	catalogAdminID = "33333333-3333-4333-8333-333333333333"
)

// memoryCatalogRepo guarda os ativos em memória; o serviço é o real, então a validação
// testada aqui é a do domínio.
type memoryCatalogRepo struct{ entries map[string]catalogadmin.Entry }

func (m *memoryCatalogRepo) List(context.Context) ([]catalogadmin.Entry, error) {
	out := []catalogadmin.Entry{}
	for _, e := range m.entries {
		out = append(out, e)
	}
	return out, nil
}

func (m *memoryCatalogRepo) Get(_ context.Context, id string) (catalogadmin.Entry, error) {
	e, ok := m.entries[id]
	if !ok {
		return e, catalogadmin.ErrNotFound
	}
	return e, nil
}

func (m *memoryCatalogRepo) Update(_ context.Context, id string, p catalogadmin.Patch) (catalogadmin.Entry, error) {
	e := m.entries[id]
	if p.Name != nil {
		e.Name = *p.Name
	}
	if p.BaseGrowthPct != nil {
		c := *e.Company
		c.BaseGrowthPct = *p.BaseGrowthPct
		e.Company = &c
	}
	m.entries[id] = e
	return e, nil
}

func newCatalogManager() catalogAdminManager {
	return catalogadmin.NewService(&memoryCatalogRepo{entries: map[string]catalogadmin.Entry{
		catalogAcao: {
			AssetID: catalogAcao, Ticker: "ACME3", Name: "Acme", Type: catalog.AssetAcao,
			Company: &catalogadmin.CompanyParams{CompanyID: "c1", Sector: "Varejo", ReportFrequencyDays: 91, BaseGrowthPct: 3, QualityMultiplier: 1},
		},
		catalogSandbox: {AssetID: catalogSandbox, Ticker: "SBX3", Name: "Sandbox", Type: catalog.AssetAcao, IsSandbox: true},
	}})
}

func callCatalog(t *testing.T, m catalogAdminManager, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var opts []Option
	if m != nil {
		opts = append(opts, WithCatalogAdmin(m))
	}
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, opts...).Handler.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

func TestAdminCatalog_503SemServico(t *testing.T) {
	if rec := callCatalog(t, nil, http.MethodGet, "/admin/catalog", ""); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("GET = %d, want 503", rec.Code)
	}
	if rec := callCatalog(t, nil, http.MethodPatch, "/admin/catalog/"+catalogAcao, `{}`); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("PATCH = %d, want 503", rec.Code)
	}
}

func TestAdminCatalog_ListaComSandboxMarcadoESemEditaveis(t *testing.T) {
	rec := callCatalog(t, newCatalogManager(), http.MethodGet, "/admin/catalog", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	var resp struct {
		Assets []catalogEntryResponse `json:"assets"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Assets) != 2 {
		t.Fatalf("len = %d", len(resp.Assets))
	}
	for _, a := range resp.Assets {
		switch a.Ticker {
		case "ACME3":
			if len(a.Editable) != 3 || a.Company == nil || a.Company.ReportFrequencyDays != 91 {
				t.Errorf("ACME3 = %+v", a)
			}
		case "SBX3":
			if !a.IsSandbox || len(a.Editable) != 0 {
				t.Errorf("SBX3 = %+v", a)
			}
		}
	}
}

func TestAdminCatalog_Patch(t *testing.T) {
	tests := []struct {
		name string
		path string
		body string
		want int
	}{
		{"edita nome e crescimento", catalogAcao, `{"name":"Acme Brasil","base_growth_pct":6.5,"admin_id":"` + catalogAdminID + `"}`, http.StatusOK},
		{"crescimento inválido é 422 com a mensagem do domínio", catalogAcao, `{"base_growth_pct":-100,"admin_id":"` + catalogAdminID + `"}`, http.StatusUnprocessableEntity},
		{"qualidade fora da faixa é 422", catalogAcao, `{"quality_multiplier":3,"admin_id":"` + catalogAdminID + `"}`, http.StatusUnprocessableEntity},
		{"campo estrutural é 422", catalogAcao, `{"ticker":"NOVO3","admin_id":"` + catalogAdminID + `"}`, http.StatusUnprocessableEntity},
		{"campo estrutural de float é 422", catalogAcao, `{"outstanding_shares":1,"admin_id":"` + catalogAdminID + `"}`, http.StatusUnprocessableEntity},
		{"ciclo de relatório é somente leitura", catalogAcao, `{"report_frequency_days":30,"admin_id":"` + catalogAdminID + `"}`, http.StatusUnprocessableEntity},
		{"sandbox é 422", catalogSandbox, `{"name":"x","admin_id":"` + catalogAdminID + `"}`, http.StatusUnprocessableEntity},
		{"sem campo é 422", catalogAcao, `{"admin_id":"` + catalogAdminID + `"}`, http.StatusUnprocessableEntity},
		{"tipo errado é 400", catalogAcao, `{"name":5,"admin_id":"` + catalogAdminID + `"}`, http.StatusBadRequest},
		{"sem admin_id é 400", catalogAcao, `{"name":"x"}`, http.StatusBadRequest},
		{"id inválido é 400", "abc", `{"name":"x","admin_id":"` + catalogAdminID + `"}`, http.StatusBadRequest},
		{"ativo inexistente é 404", "44444444-4444-4444-8444-444444444444", `{"name":"x","admin_id":"` + catalogAdminID + `"}`, http.StatusNotFound},
		{"corpo que não é JSON é 400", catalogAcao, `nada`, http.StatusBadRequest},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := callCatalog(t, newCatalogManager(), http.MethodPatch, "/admin/catalog/"+tc.path, tc.body)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d: %s", rec.Code, tc.want, rec.Body)
			}
			if tc.want == http.StatusOK {
				var got catalogEntryResponse
				_ = json.Unmarshal(rec.Body.Bytes(), &got)
				if got.Name != "Acme Brasil" || got.Company.BaseGrowthPct != 6.5 {
					t.Errorf("resposta = %+v", got)
				}
			}
		})
	}
}
