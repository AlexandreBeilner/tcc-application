package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"tcc-investimentos/engine/internal/domain/adminview"
)

type fakeAdminReader struct {
	overview adminview.Overview
	err      error
}

func (f *fakeAdminReader) Overview(context.Context) (adminview.Overview, error) {
	return f.overview, f.err
}

func callAdminReader(t *testing.T, reader adminOverviewReader, path string) *httptest.ResponseRecorder {
	t.Helper()
	var opts []Option
	if reader != nil {
		opts = append(opts, WithAdminReader(reader))
	}
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, opts...).Handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec
}

func TestAdminOverview_Responde503SemLeitor(t *testing.T) {
	if rec := callAdminReader(t, nil, "/admin/overview"); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("GET /admin/overview sem leitor = %d, want 503", rec.Code)
	}
}

func TestAdminOverview_Responde500NoErroDoLeitor(t *testing.T) {
	if rec := callAdminReader(t, &fakeAdminReader{err: errors.New("banco caiu")}, "/admin/overview"); rec.Code != http.StatusInternalServerError {
		t.Errorf("GET /admin/overview com erro = %d, want 500", rec.Code)
	}
}

func TestAdminOverview_DevolveOResumoDoMercado(t *testing.T) {
	monthly := 0.42
	reader := &fakeAdminReader{overview: adminview.Overview{
		SimulatedDay: 120, SelicRate: 10.75, IPCAMonthly: &monthly, PendingMacroEvents: 2,
		UncoveredAssets: 1, TradableAssets: 5, ActiveBots: 3, TotalBots: 4, Trades: 9, Volume: 1234.5, RestingOrders: 17,
	}}
	rec := callAdminReader(t, reader, "/admin/overview")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var got map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	want := map[string]any{
		"simulated_day": 120.0, "selic_rate": 10.75, "ipca_monthly": 0.42, "ipca_accumulated_12m": nil,
		"pending_macro_events": 2.0, "uncovered_assets": 1.0, "tradable_assets": 5.0, "active_bots": 3.0,
		"total_bots": 4.0, "day_trades": 9.0, "day_volume": 1234.5, "resting_orders": 17.0,
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s = %v, want %v", k, got[k], v)
		}
	}
}
