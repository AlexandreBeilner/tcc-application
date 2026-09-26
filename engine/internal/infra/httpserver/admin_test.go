package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/tick"
)

type fakeTicker struct {
	result tick.Result
	err    error
}

func (f *fakeTicker) Run(_ context.Context) (tick.Result, error) {
	return f.result, f.err
}

func postTick(t *testing.T, ticker ticker) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/admin/tick", nil)
	rec := httptest.NewRecorder()
	New("", nil, nil, ticker, nil, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func TestHandleAdminTick(t *testing.T) {
	fake := &fakeTicker{result: tick.Result{
		State:                tick.State{Day: 1, SelicRate: 10.5},
		UncoveredAssetsCount: 2,
		IntradayRounds:       []tick.IntradayRound{{SequenceIndex: 0}, {SequenceIndex: 1}, {SequenceIndex: 2}},
		Quotes:               []tick.Quote{{AssetID: "a1", Price: 100}, {AssetID: "a2", Price: 200}},
		IsCopomDay:           false,
		IsReportDay:          false,
	}}

	rec := postTick(t, fake)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body tickResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.Day != 1 {
		t.Errorf("Day = %d, want 1", body.Day)
	}
	if body.QuotesCount != 2 {
		t.Errorf("QuotesCount = %d, want 2", body.QuotesCount)
	}
	if body.IntradayRoundsCount != 3 {
		t.Errorf("IntradayRoundsCount = %d, want 3", body.IntradayRoundsCount)
	}
	if body.UncoveredAssetsCount != 2 {
		t.Errorf("UncoveredAssetsCount = %d, want 2", body.UncoveredAssetsCount)
	}
}

func TestHandleAdminTick_SemTicker(t *testing.T) {
	rec := postTick(t, nil)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestHandleAdminTick_ErroInterno(t *testing.T) {
	rec := postTick(t, &fakeTicker{err: context.DeadlineExceeded})
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

// slowTicker simula um tick mais demorado que o WriteTimeout do servidor.
type slowTicker struct{ delay time.Duration }

func (s slowTicker) Run(_ context.Context) (tick.Result, error) {
	time.Sleep(s.delay)
	return tick.Result{State: tick.State{Day: 7}}, nil
}

func TestHandleAdminTick_SobreviveAoWriteTimeoutDoServidor(t *testing.T) {
	srv := httptest.NewUnstartedServer(handleAdminTick(slowTicker{delay: 300 * time.Millisecond}))
	srv.Config.WriteTimeout = 100 * time.Millisecond
	srv.Start()
	defer srv.Close()

	resp, err := http.Post(srv.URL, "application/json", nil)
	if err != nil {
		t.Fatalf("POST com tick mais lento que o WriteTimeout: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var body tickResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if resp.StatusCode != http.StatusOK || body.Day != 7 {
		t.Errorf("status = %d, day = %d, want 200 e 7", resp.StatusCode, body.Day)
	}
}
