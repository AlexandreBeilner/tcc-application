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
	gotRelease                       string
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
	d := corporategovernance.Decision{AssemblyID: in.AssemblyID, CompanyID: in.CompanyID, OptionKey: in.OptionKey}
	for i, e := range in.Effects {
		d.Effects = append(d.Effects, corporategovernance.EffectRecord{
			Position: i, Metric: e.Metric, Direction: e.Direction, Intensity: e.Intensity,
			Status: corporategovernance.StatusScheduled, TotalDelta: 50, RampTicks: 30, StartDay: 8,
		})
	}
	return d, f.decisionCreated, f.err
}

func (f *fakeGovernance) GetDecision(_ context.Context, a string) (corporategovernance.Decision, bool, error) {
	return corporategovernance.Decision{AssemblyID: a, Effects: []corporategovernance.EffectRecord{{Status: corporategovernance.StatusCompleted}}}, f.decisionFound, f.err
}

func (f *fakeGovernance) RecentReports(_ context.Context, minDays, maxDays int) (corporategovernance.ReportsResult, error) {
	if maxDays < minDays {
		return corporategovernance.ReportsResult{}, corporategovernance.ErrInvalidInput
	}
	return corporategovernance.ReportsResult{SimulatedDay: 93, Reports: []corporategovernance.CompanyReport{
		{CompanyID: govCompany, Name: "Beta", Sector: "Varejo", Tickers: []string{"BETA3"}, ReportDay: 91, DaysSinceReport: 2},
	}}, f.err
}

func (f *fakeGovernance) Standing(_ context.Context, companyID, userID string) (corporategovernance.Standing, error) {
	return corporategovernance.Standing{
		CompanyID: companyID, Name: "Beta", Sector: "Varejo", HoldsShares: userID == govAssembly, CooldownDaysLeft: 12,
	}, f.err
}

func (f *fakeGovernance) ListPending(context.Context) ([]corporategovernance.PendingView, error) {
	assembly := "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
	return []corporategovernance.PendingView{{
		Pending: corporategovernance.Pending{
			ID: "33333333-3333-4333-8333-333333333333", CompanyID: govCompany, Name: "Beta", Sector: "Varejo", Tickers: []string{"BETA3"},
			CycleIndex: 1, ReportDay: 182, HeldDay: 182, DaysHeld: 3, PoolNetIncome: 999, DecisionAssemblyID: &assembly,
		},
		SafetyDeadlineDay: 242,
	}}, f.err
}

func (f *fakeGovernance) RequestRelease(_ context.Context, id string, reason corporategovernance.ReleaseReason) error {
	f.gotRelease = string(reason) + ":" + id
	return f.err
}

func TestGovernance_Standing(t *testing.T) {
	rec := callGovernance(t, &fakeGovernance{}, http.MethodGet, "/governance/companies/"+govCompany+"/standing?user_id="+govAssembly, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	var resp standingResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.CompanyID != govCompany || !resp.HoldsShares || resp.CooldownDaysLeft != 12 || resp.Sector != "Varejo" {
		t.Errorf("resposta = %+v", resp)
	}
	if rec := callGovernance(t, &fakeGovernance{}, http.MethodGet, "/governance/companies/"+govCompany+"/standing", ""); rec.Code != http.StatusBadRequest {
		t.Errorf("sem user_id = %d, esperado 400", rec.Code)
	}
	if rec := callGovernance(t, &fakeGovernance{}, http.MethodGet, "/governance/companies/xx/standing?user_id="+govAssembly, ""); rec.Code != http.StatusBadRequest {
		t.Errorf("empresa inválida = %d, esperado 400", rec.Code)
	}
	if rec := callGovernance(t, &fakeGovernance{err: corporategovernance.ErrUnknownCompany}, http.MethodGet, "/governance/companies/"+govCompany+"/standing?user_id="+govAssembly, ""); rec.Code != http.StatusNotFound {
		t.Errorf("empresa inexistente = %d, esperado 404", rec.Code)
	}
	if rec := callGovernance(t, nil, http.MethodGet, "/governance/companies/"+govCompany+"/standing?user_id="+govAssembly, ""); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("sem serviço = %d, esperado 503", rec.Code)
	}
}

func TestGovernance_Reports(t *testing.T) {
	rec := callGovernance(t, &fakeGovernance{}, http.MethodGet, "/governance/reports?min_days=2&max_days=9", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	var resp reportsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.SimulatedDay != 93 || len(resp.Reports) != 1 || resp.Reports[0].ReportDay != 91 || resp.Reports[0].Tickers[0] != "BETA3" || resp.Reports[0].Sector != "Varejo" {
		t.Errorf("resposta = %+v", resp)
	}
	for name, q := range map[string]string{"sem parâmetros": "", "não inteiro": "?min_days=a&max_days=9", "janela invertida": "?min_days=9&max_days=2"} {
		if rec := callGovernance(t, &fakeGovernance{}, http.MethodGet, "/governance/reports"+q, ""); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, esperado 400", name, rec.Code)
		}
	}
	if rec := callGovernance(t, nil, http.MethodGet, "/governance/reports?min_days=0&max_days=9", ""); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("sem serviço: status = %d, esperado 503", rec.Code)
	}
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
	if fake.gotDecision.OptionKey != "reinvestir" || len(fake.gotDecision.Effects) != 1 || fake.gotDecision.Effects[0].Metric != corporategovernance.MetricBaseGrowthPct || fake.gotDecision.Effects[0].Direction != 1 {
		t.Errorf("repassou = %+v", fake.gotDecision)
	}
	var resp decisionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Effects) != 1 || resp.Effects[0].Status != "scheduled" || resp.Effects[0].TotalDelta != 50 || resp.Effects[0].RampTicks != 30 || resp.Effects[0].StartDay != 8 {
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

const composedDecisionBody = `{"assembly_id":"` + govAssembly + `","company_id":"` + govCompany + `","option_key":"reinvestir","effects":[` +
	`{"metric":"payout_ratio_pct","direction":-1,"intensity":0.5},{"metric":"base_growth_pct","direction":1,"intensity":1}]}`

func TestGovernance_DecisionComposta(t *testing.T) {
	fake := &fakeGovernance{decisionCreated: true}
	rec := callGovernance(t, fake, http.MethodPost, "/governance/decisions", composedDecisionBody)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	if len(fake.gotDecision.Effects) != 2 || fake.gotDecision.Effects[0].Metric != corporategovernance.MetricPayoutRatioPct || fake.gotDecision.Effects[1].Metric != corporategovernance.MetricBaseGrowthPct {
		t.Errorf("repassou = %+v", fake.gotDecision.Effects)
	}
	var resp decisionResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Effects) != 2 || resp.Effects[0].Metric != "payout_ratio_pct" || resp.Effects[0].Intensity != 0.5 {
		t.Errorf("resposta = %+v", resp)
	}
	// Efeitos inválidos chegam ao serviço, que devolve 400.
	bad := &fakeGovernance{err: corporategovernance.ErrInvalidInput}
	if rec := callGovernance(t, bad, http.MethodPost, "/governance/decisions", composedDecisionBody); rec.Code != http.StatusBadRequest {
		t.Errorf("entrada inválida = %d, esperado 400", rec.Code)
	}
}

func TestGovernance_DeclaracoesPendentes(t *testing.T) {
	rec := callGovernance(t, &fakeGovernance{}, http.MethodGet, "/governance/pending-declarations", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	var resp struct {
		Declarations []pendingDeclarationResponse `json:"declarations"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Declarations) != 1 {
		t.Fatalf("resposta = %+v", resp)
	}
	d := resp.Declarations[0]
	if d.Name != "Beta" || d.CycleIndex != 1 || d.ReportDay != 182 || d.DaysHeld != 3 || d.SafetyDeadlineDay != 242 || d.DecisionAssemblyID == nil || d.Tickers[0] != "BETA3" {
		t.Errorf("declaração = %+v", d)
	}
	if strings.Contains(rec.Body.String(), "999") || strings.Contains(rec.Body.String(), "pool") {
		t.Errorf("o lucro do pool não sai do motor: %s", rec.Body)
	}
	if rec := callGovernance(t, nil, http.MethodGet, "/governance/pending-declarations", ""); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("sem serviço = %d, esperado 503", rec.Code)
	}
}

func TestGovernance_LiberarDeclaracao(t *testing.T) {
	const id = "33333333-3333-4333-8333-333333333333"
	fake := &fakeGovernance{}
	rec := callGovernance(t, fake, http.MethodPost, "/governance/pending-declarations/"+id+"/release", `{"reason":"no_decision"}`)
	if rec.Code != http.StatusOK || fake.gotRelease != "no_decision:"+id {
		t.Fatalf("status = %d, repassou %q: %s", rec.Code, fake.gotRelease, rec.Body)
	}
	for name, tc := range map[string]struct {
		path, body string
		err        error
		want       int
	}{
		"id inválido":            {"/governance/pending-declarations/x/release", `{"reason":"admin"}`, nil, http.StatusBadRequest},
		"json inválido":          {"/governance/pending-declarations/" + id + "/release", `{`, nil, http.StatusBadRequest},
		"motivo inválido":        {"/governance/pending-declarations/" + id + "/release", `{"reason":"x"}`, corporategovernance.ErrInvalidInput, http.StatusBadRequest},
		"declaração inexistente": {"/governance/pending-declarations/" + id + "/release", `{"reason":"admin"}`, corporategovernance.ErrUnknownDeclaration, http.StatusNotFound},
	} {
		if rec := callGovernance(t, &fakeGovernance{err: tc.err}, http.MethodPost, tc.path, tc.body); rec.Code != tc.want {
			t.Errorf("%s: status = %d, esperado %d", name, rec.Code, tc.want)
		}
	}
	if rec := callGovernance(t, nil, http.MethodPost, "/governance/pending-declarations/"+id+"/release", `{"reason":"admin"}`); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("sem serviço = %d, esperado 503", rec.Code)
	}
	// A decisão aceita o id da declaração, e recusa um id que não é UUID.
	fake = &fakeGovernance{decisionCreated: true}
	body := `{"assembly_id":"` + govAssembly + `","company_id":"` + govCompany + `","option_key":"o","declaration_id":"` + id + `","effects":[{"metric":"payout_ratio_pct","direction":-1,"intensity":1}]}`
	if rec := callGovernance(t, fake, http.MethodPost, "/governance/decisions", body); rec.Code != http.StatusCreated || fake.gotDecision.DeclarationID != id {
		t.Errorf("decisão com declaração: status = %d, repassou %q", rec.Code, fake.gotDecision.DeclarationID)
	}
	bad := strings.Replace(body, id, "x", 1)
	if rec := callGovernance(t, &fakeGovernance{}, http.MethodPost, "/governance/decisions", bad); rec.Code != http.StatusBadRequest {
		t.Errorf("declaration_id inválido = %d, esperado 400", rec.Code)
	}
}
