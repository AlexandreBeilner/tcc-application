package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/adminexport"
	"tcc-investimentos/engine/internal/domain/integrity"
)

type fakeIntegrityChecker struct {
	startRun integrity.Run
	startErr error
	latest   *integrity.Run
}

func (f *fakeIntegrityChecker) Start() (integrity.Run, error) { return f.startRun, f.startErr }
func (f *fakeIntegrityChecker) Latest() (integrity.Run, bool) {
	if f.latest == nil {
		return integrity.Run{}, false
	}
	return *f.latest, true
}

func callWith(t *testing.T, opt Option, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	var opts []Option
	if opt != nil {
		opts = append(opts, opt)
	}
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, opts...).Handler.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader("")))
	return rec
}

func TestIntegrity_503SemServico(t *testing.T) {
	for _, tc := range []struct{ method, path string }{
		{http.MethodPost, "/admin/integrity/check"},
		{http.MethodGet, "/admin/integrity/check"},
		{http.MethodGet, "/admin/export/orders"},
		{http.MethodGet, "/admin/export/events"},
	} {
		if rec := callWith(t, nil, tc.method, tc.path); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("%s %s = %d; quer 503", tc.method, tc.path, rec.Code)
		}
	}
}

func TestIntegrity_StartDevolve202(t *testing.T) {
	started := time.Date(2026, 10, 6, 12, 0, 0, 0, time.UTC)
	f := &fakeIntegrityChecker{startRun: integrity.Run{ID: "r1", Status: integrity.StatusRunning, StartedAt: started}}
	rec := callWith(t, WithIntegrity(f), http.MethodPost, "/admin/integrity/check")
	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d; quer 202 (%s)", rec.Code, rec.Body)
	}
	var body integrityRunResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.ID != "r1" || body.Status != "running" || body.Report != nil || body.FinishedAt != nil {
		t.Fatalf("corpo inesperado: %+v", body)
	}
}

func TestIntegrity_StartEmAndamentoDevolve409(t *testing.T) {
	f := &fakeIntegrityChecker{startErr: integrity.ErrAlreadyRunning}
	if rec := callWith(t, WithIntegrity(f), http.MethodPost, "/admin/integrity/check"); rec.Code != http.StatusConflict {
		t.Fatalf("status = %d; quer 409", rec.Code)
	}
}

func TestIntegrity_LatestSemExecucaoDevolveRunNulo(t *testing.T) {
	rec := callWith(t, WithIntegrity(&fakeIntegrityChecker{}), http.MethodGet, "/admin/integrity/check")
	if rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"run":null}` {
		t.Fatalf("resposta = %d %s", rec.Code, rec.Body)
	}
}

func TestIntegrity_LatestConcluidaTrazRelatorioComTodasAsCategorias(t *testing.T) {
	finished := time.Date(2026, 10, 6, 12, 0, 3, 0, time.UTC)
	f := &fakeIntegrityChecker{latest: &integrity.Run{
		ID: "r1", Status: integrity.StatusDone, StartedAt: finished.Add(-3 * time.Second), FinishedAt: &finished,
		Report: &integrity.Report{
			Checked: integrity.Counters{Events: 10, Accounts: 2},
			Counts:  map[integrity.Kind]int{integrity.KindBalanceMismatch: 1},
			Total:   1,
			Divergences: []integrity.Divergence{
				{Kind: integrity.KindBalanceMismatch, UserID: "u1", Expected: "10.00", Found: "11.00"},
			},
		},
	}}
	rec := callWith(t, WithIntegrity(f), http.MethodGet, "/admin/integrity/check")
	var body struct {
		Run integrityRunResponse `json:"run"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	report := body.Run.Report
	if report == nil || report.Total != 1 || report.Checked.Events != 10 {
		t.Fatalf("relatório inesperado: %+v", report)
	}
	if len(report.Counts) != len(integrity.AllKinds) || report.Counts["balance_mismatch"] != 1 || report.Counts["float_mismatch"] != 0 {
		t.Fatalf("toda categoria deveria aparecer, com zero quando vazia: %v", report.Counts)
	}
	d := report.Divergences[0]
	if d.UserID == nil || *d.UserID != "u1" || d.AssetID != nil || d.OrderID != nil {
		t.Fatalf("campos opcionais vazios devem sair nulos: %+v", d)
	}
}

type fakeExporter struct {
	gotRange  adminexport.Range
	gotLimit  int
	orders    []adminexport.OrderRow
	events    []adminexport.EventRow
	truncated bool
	err       error
}

func (f *fakeExporter) ExportOrders(_ context.Context, rng adminexport.Range, limit int) ([]adminexport.OrderRow, bool, error) {
	f.gotRange, f.gotLimit = rng, limit
	return f.orders, f.truncated, f.err
}

func (f *fakeExporter) ExportEvents(_ context.Context, rng adminexport.Range, limit int) ([]adminexport.EventRow, bool, error) {
	f.gotRange, f.gotLimit = rng, limit
	return f.events, f.truncated, f.err
}

func TestExport_FiltroELimiteChegamAoLeitor(t *testing.T) {
	f := &fakeExporter{}
	rec := callWith(t, WithAdminExport(f), http.MethodGet, "/admin/export/orders?from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z&limit=500")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d (%s)", rec.Code, rec.Body)
	}
	if f.gotRange.From == nil || f.gotRange.To == nil || f.gotLimit != 500 {
		t.Fatalf("filtro não chegou: %+v limit=%d", f.gotRange, f.gotLimit)
	}
}

func TestExport_LimiteAcimaDoTetoViraTeto(t *testing.T) {
	f := &fakeExporter{}
	callWith(t, WithAdminExport(f), http.MethodGet, "/admin/export/events?limit=999999999")
	if f.gotLimit != adminexport.MaxRows {
		t.Fatalf("limite = %d; quer o teto %d", f.gotLimit, adminexport.MaxRows)
	}
	callWith(t, WithAdminExport(f), http.MethodGet, "/admin/export/events")
	if f.gotLimit != adminexport.DefaultRows {
		t.Fatalf("limite padrão = %d; quer %d", f.gotLimit, adminexport.DefaultRows)
	}
}

func TestExport_ParametrosInvalidosDevolvem400(t *testing.T) {
	f := &fakeExporter{}
	for _, q := range []string{
		"from=ontem",
		"to=amanha",
		"limit=0",
		"limit=abc",
		"from=2026-10-02T00:00:00Z&to=2026-10-01T00:00:00Z",
	} {
		if rec := callWith(t, WithAdminExport(f), http.MethodGet, "/admin/export/orders?"+q); rec.Code != http.StatusBadRequest {
			t.Errorf("?%s = %d; quer 400", q, rec.Code)
		}
	}
}

func TestExport_LinhasETruncadoNaResposta(t *testing.T) {
	qty := 3
	unit := "10.00"
	f := &fakeExporter{
		truncated: true,
		events: []adminexport.EventRow{
			{ID: "e1", UserID: "u1", EventType: "buy_order_executed", Ticker: "ACME3", Quantity: &qty, UnitValue: &unit, Timestamp: time.Unix(0, 0).UTC()},
			{ID: "e2", UserID: "u1", EventType: "initial_deposit", Timestamp: time.Unix(0, 0).UTC()},
		},
	}
	rec := callWith(t, WithAdminExport(f), http.MethodGet, "/admin/export/events")
	var body struct {
		Rows      []exportEventResponse `json:"rows"`
		Truncated bool                  `json:"truncated"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if !body.Truncated || len(body.Rows) != 2 {
		t.Fatalf("resposta inesperada: %+v", body)
	}
	if body.Rows[0].Ticker == nil || *body.Rows[0].Ticker != "ACME3" || body.Rows[1].Ticker != nil || body.Rows[1].Quantity != nil {
		t.Fatalf("campos opcionais errados: %+v", body.Rows)
	}
}
