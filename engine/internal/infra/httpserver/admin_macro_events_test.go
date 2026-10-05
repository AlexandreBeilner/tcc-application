package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/macroevent"
	"tcc-investimentos/engine/internal/domain/macroeventadmin"
	"tcc-investimentos/engine/internal/domain/tick"
)

type fakeMacroEventAdmin struct {
	detail    macroeventadmin.Detail
	rec       macroevent.Record
	err       error
	gotWindow int
}

func (f *fakeMacroEventAdmin) Detail(_ context.Context, _ string, window int) (macroeventadmin.Detail, error) {
	f.gotWindow = window
	return f.detail, f.err
}

func (f *fakeMacroEventAdmin) Cancel(context.Context, string) (macroevent.Record, error) {
	return f.rec, f.err
}

func callMacroAdmin(t *testing.T, m macroEventAdmin, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	var opts []Option
	if m != nil {
		opts = append(opts, WithMacroEventAdmin(m))
	}
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, opts...).Handler.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
	return rec
}

func TestMacroEventAdmin_503SemServicoE400ComIdInvalido(t *testing.T) {
	for _, method := range []string{http.MethodGet, http.MethodDelete} {
		if rec := callMacroAdmin(t, nil, method, "/macro-events/"+validOrderID); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("%s sem serviço = %d, want 503", method, rec.Code)
		}
		if rec := callMacroAdmin(t, &fakeMacroEventAdmin{}, method, "/macro-events/nao-uuid"); rec.Code != http.StatusBadRequest {
			t.Errorf("%s com id inválido = %d, want 400", method, rec.Code)
		}
	}
}

func TestMacroEventAdmin_DetalheTrazEstadoRelatorioEImpacto(t *testing.T) {
	sector := catalog.Sector("Financeiro")
	report := 91
	avg := 7.5
	fake := &fakeMacroEventAdmin{detail: macroeventadmin.Detail{
		Record: macroevent.Record{ID: validOrderID, Event: macroevent.Event{
			Title: "t", Status: macroevent.StatusAplicado, TriggeredOnDay: 50, FundamentalsReportDay: &report,
			Targets: []macroevent.Target{{Sector: &sector}},
		}},
		CurrentDay: 60, Scheduled: false, Cancellable: false,
		Impact: macroeventadmin.Impact{
			Available: true, WindowDays: 5, BaseDay: 49, EndDay: 54, AvailableOnDay: 54,
			Targets: []macroeventadmin.TargetImpact{{
				Target:           macroevent.Target{Sector: &sector},
				Assets:           []macroeventadmin.AssetImpact{{AssetID: "a1", Ticker: "ACME3", PriceBefore: 10, PriceAfter: 11, ChangePct: 10}},
				AverageChangePct: &avg,
			}},
		},
	}}
	rec := callMacroAdmin(t, fake, http.MethodGet, "/macro-events/"+validOrderID+"?window_days=7")
	if rec.Code != http.StatusOK || fake.gotWindow != 7 {
		t.Fatalf("status = %d, window = %d: %s", rec.Code, fake.gotWindow, rec.Body)
	}
	var resp macroEventDetailResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.CurrentDay != 60 || resp.ReportDate == nil || *resp.Cancellable || !resp.Impact.Available || !resp.PubliclyVisible {
		t.Errorf("resp = %+v", resp)
	}
	if len(resp.Impact.Targets) != 1 || *resp.Impact.Targets[0].Sector != "Financeiro" || resp.Impact.Targets[0].Assets[0].Ticker != "ACME3" {
		t.Errorf("alvos do impacto = %+v", resp.Impact.Targets)
	}

	if rec := callMacroAdmin(t, fake, http.MethodGet, "/macro-events/"+validOrderID+"?window_days=x"); rec.Code != http.StatusBadRequest {
		t.Errorf("window_days inválido = %d, want 400", rec.Code)
	}
}

func TestMacroEventAdmin_MapeiaErros(t *testing.T) {
	tests := []struct {
		err  error
		want int
	}{
		{macroeventadmin.ErrNotFound, http.StatusNotFound},
		{macroeventadmin.ErrInvalidWindow, http.StatusBadRequest},
		{macroevent.ErrNotPending, http.StatusConflict},
		{macroevent.ErrEffectStarted, http.StatusConflict},
		{tick.ErrTickInProgress, http.StatusConflict},
		{context.DeadlineExceeded, http.StatusInternalServerError},
	}
	for _, tt := range tests {
		for _, method := range []string{http.MethodGet, http.MethodDelete} {
			if rec := callMacroAdmin(t, &fakeMacroEventAdmin{err: tt.err}, method, "/macro-events/"+validOrderID); rec.Code != tt.want {
				t.Errorf("%s com %v = %d, want %d", method, tt.err, rec.Code, tt.want)
			}
		}
	}
}

func TestMacroEventAdmin_CancelDevolveOEventoCancelado(t *testing.T) {
	fake := &fakeMacroEventAdmin{rec: macroevent.Record{ID: validOrderID, Event: macroevent.Event{Status: macroevent.StatusCancelado}}}
	rec := callMacroAdmin(t, fake, http.MethodDelete, "/macro-events/"+validOrderID)
	var resp macroEventResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if rec.Code != http.StatusOK || resp.Status != "cancelado" || *resp.Cancellable {
		t.Errorf("status = %d, resp = %+v", rec.Code, resp)
	}
}
