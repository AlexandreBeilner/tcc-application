package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/corporategovernance"
)

const (
	govAssembly = "11111111-1111-4111-8111-111111111111"
	govCompany  = "22222222-2222-4222-8222-222222222222"
)

type fakeGovernance struct {
	snapshotCreated, decisionCreated bool
	snapshotFound, decisionFound     bool
	err                              error
	gotDecision                      corporategovernance.DecisionInput
}

func (f *fakeGovernance) TakeSnapshot(_ context.Context, a, c string) (corporategovernance.Snapshot, bool, error) {
	return corporategovernance.Snapshot{
		AssemblyID: a, CompanyID: c, TakenAt: time.Unix(0, 0), SimulatedDay: 7,
		Holdings: []corporategovernance.Holding{{UserID: "u1", Quantity: 30}},
	}, f.snapshotCreated, f.err
}

func (f *fakeGovernance) GetSnapshot(_ context.Context, a string) (corporategovernance.Snapshot, bool, error) {
	return corporategovernance.Snapshot{AssemblyID: a}, f.snapshotFound, f.err
}

func (f *fakeGovernance) RecordDecision(_ context.Context, in corporategovernance.DecisionInput) (corporategovernance.Decision, bool, error) {
	f.gotDecision = in
	return corporategovernance.Decision{
		AssemblyID: in.AssemblyID, CompanyID: in.CompanyID, OptionKey: in.OptionKey, Metric: in.Effect.Metric,
		Direction: in.Effect.Direction, Intensity: in.Effect.Intensity, Status: corporategovernance.StatusScheduled,
		TotalDelta: 50, RampTicks: 30, StartDay: 8,
	}, f.decisionCreated, f.err
}

func (f *fakeGovernance) GetDecision(_ context.Context, a string) (corporategovernance.Decision, bool, error) {
	return corporategovernance.Decision{AssemblyID: a, Status: corporategovernance.StatusCompleted}, f.decisionFound, f.err
}

func callGovernance(t *testing.T, m governanceManager, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var opts []Option
	if m != nil {
		opts = append(opts, WithGovernance(m))
	}
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, opts...).Handler.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

const decisionBody = `{"assembly_id":"` + govAssembly + `","company_id":"` + govCompany + `","option_key":"reinvestir","effect":{"metric":"base_growth_pct","direction":1,"intensity":1}}`

func TestGovernance_503SemServico(t *testing.T) {
	for _, tc := range []struct{ method, path string }{
		{http.MethodPost, "/governance/snapshots"},
		{http.MethodGet, "/governance/snapshots/" + govAssembly},
		{http.MethodPost, "/governance/decisions"},
		{http.MethodGet, "/governance/decisions/" + govAssembly},
	} {
		if rec := callGovernance(t, nil, tc.method, tc.path, "{}"); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("%s %s = %d, esperado 503", tc.method, tc.path, rec.Code)
		}
	}
}

func TestGovernance_Snapshot(t *testing.T) {
	body := `{"assembly_id":"` + govAssembly + `","company_id":"` + govCompany + `"}`

	rec := callGovernance(t, &fakeGovernance{snapshotCreated: true}, http.MethodPost, "/governance/snapshots", body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("criado: status = %d: %s", rec.Code, rec.Body)
	}
	var resp snapshotResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.AssemblyID != govAssembly || resp.SimulatedDay != 7 || len(resp.Holdings) != 1 || resp.Holdings[0].Quantity != 30 {
		t.Errorf("resposta = %+v", resp)
	}

	if rec := callGovernance(t, &fakeGovernance{}, http.MethodPost, "/governance/snapshots", body); rec.Code != http.StatusOK {
		t.Errorf("repetido: status = %d, esperado 200 (idempotente)", rec.Code)
	}
	for name, bad := range map[string]string{
		"json inválido": `{`,
		"uuid inválido": `{"assembly_id":"x","company_id":"` + govCompany + `"}`,
	} {
		if rec := callGovernance(t, &fakeGovernance{}, http.MethodPost, "/governance/snapshots", bad); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, esperado 400", name, rec.Code)
		}
	}
	if rec := callGovernance(t, &fakeGovernance{err: corporategovernance.ErrUnknownCompany}, http.MethodPost, "/governance/snapshots", body); rec.Code != http.StatusNotFound {
		t.Errorf("empresa desconhecida: status = %d, esperado 404", rec.Code)
	}

	if rec := callGovernance(t, &fakeGovernance{snapshotFound: true}, http.MethodGet, "/governance/snapshots/"+govAssembly, ""); rec.Code != http.StatusOK {
		t.Errorf("GET existente = %d", rec.Code)
	}
	if rec := callGovernance(t, &fakeGovernance{}, http.MethodGet, "/governance/snapshots/"+govAssembly, ""); rec.Code != http.StatusNotFound {
		t.Errorf("GET inexistente = %d", rec.Code)
	}
	if rec := callGovernance(t, &fakeGovernance{}, http.MethodGet, "/governance/snapshots/abc", ""); rec.Code != http.StatusBadRequest {
		t.Errorf("GET com id inválido = %d", rec.Code)
	}
}

func TestGovernance_Decision(t *testing.T) {
	fake := &fakeGovernance{decisionCreated: true}
	rec := callGovernance(t, fake, http.MethodPost, "/governance/decisions", decisionBody)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	if fake.gotDecision.OptionKey != "reinvestir" || fake.gotDecision.Effect.Metric != corporategovernance.MetricBaseGrowthPct || fake.gotDecision.Effect.Direction != 1 {
		t.Errorf("repassou = %+v", fake.gotDecision)
	}
	var resp decisionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Status != "scheduled" || resp.TotalDelta != 50 || resp.RampTicks != 30 || resp.StartDay != 8 {
		t.Errorf("resposta = %+v", resp)
	}

	if rec := callGovernance(t, &fakeGovernance{}, http.MethodPost, "/governance/decisions", decisionBody); rec.Code != http.StatusOK {
		t.Errorf("repetida: status = %d, esperado 200 (idempotente)", rec.Code)
	}
	if rec := callGovernance(t, &fakeGovernance{err: corporategovernance.ErrInvalidInput}, http.MethodPost, "/governance/decisions", decisionBody); rec.Code != http.StatusBadRequest {
		t.Errorf("entrada inválida do domínio: status = %d, esperado 400", rec.Code)
	}
	if rec := callGovernance(t, &fakeGovernance{}, http.MethodPost, "/governance/decisions", `{"assembly_id":"x"}`); rec.Code != http.StatusBadRequest {
		t.Errorf("uuid inválido: status = %d", rec.Code)
	}

	if rec := callGovernance(t, &fakeGovernance{decisionFound: true}, http.MethodGet, "/governance/decisions/"+govAssembly, ""); rec.Code != http.StatusOK {
		t.Errorf("GET existente = %d", rec.Code)
	}
	if rec := callGovernance(t, &fakeGovernance{}, http.MethodGet, "/governance/decisions/"+govAssembly, ""); rec.Code != http.StatusNotFound {
		t.Errorf("GET inexistente = %d", rec.Code)
	}
}
