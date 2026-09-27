package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"tcc-investimentos/engine/internal/domain/tick"
)

type fakeIndicatorHistoryReader struct {
	entries []tick.IndicatorHistoryEntry
	err     error
	gotDays int
}

func (f *fakeIndicatorHistoryReader) ListIndicatorHistory(_ context.Context, days int) ([]tick.IndicatorHistoryEntry, error) {
	f.gotDays = days
	return f.entries, f.err
}

func getIndicatorHistory(t *testing.T, reader indicatorHistoryReader, query string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/market/indicators/history"+query, nil)
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, reader, nil).Handler.ServeHTTP(rec, req)
	return rec
}

// TestHandleGetIndicatorHistory_RealData cobre o critério de aceite da
// tarefa M.2: resposta com dados reais persistidos por M.1.
func TestHandleGetIndicatorHistory_RealData(t *testing.T) {
	fake := &fakeIndicatorHistoryReader{entries: []tick.IndicatorHistoryEntry{
		{SimulatedDay: 1, SelicRate: 10.0, IPCAMonthlyRate: 0.003758, IPCAAccumulated12m: 0.003758},
		{SimulatedDay: 2, SelicRate: 10.0, IPCAMonthlyRate: 0.003758, IPCAAccumulated12m: 0.007530},
	}}

	rec := getIndicatorHistory(t, fake, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if fake.gotDays != defaultIndicatorHistoryDays {
		t.Errorf("days = %d, want default %d", fake.gotDays, defaultIndicatorHistoryDays)
	}

	var body []indicatorHistoryEntryResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 2 {
		t.Fatalf("len(body) = %d, want 2", len(body))
	}
	if body[0].SimulatedDay != 1 || body[0].SelicRate != 10.0 || body[0].IPCAMonthlyRate != 0.003758 {
		t.Errorf("body[0] = %+v, want dados do primeiro dia simulado", body[0])
	}
	if body[1].IPCAAccumulated12m != 0.007530 {
		t.Errorf("body[1].IPCAAccumulated12m = %v, want 0.007530", body[1].IPCAAccumulated12m)
	}
}

// TestHandleGetIndicatorHistory_MotorRecemSubido cobre o segundo critério
// de aceite da tarefa M.2: motor recém-subido, sem nenhum tick rodado
// ainda — lista vazia, não erro (mesmo tratamento de
// handleGetAssetQuoteHistory/handleListMacroEvents).
func TestHandleGetIndicatorHistory_MotorRecemSubido(t *testing.T) {
	fake := &fakeIndicatorHistoryReader{entries: nil}

	rec := getIndicatorHistory(t, fake, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body []indicatorHistoryEntryResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 0 {
		t.Fatalf("len(body) = %d, want 0", len(body))
	}
}

func TestHandleGetIndicatorHistory_DaysParam(t *testing.T) {
	fake := &fakeIndicatorHistoryReader{}

	rec := getIndicatorHistory(t, fake, "?days=7")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if fake.gotDays != 7 {
		t.Errorf("days = %d, want 7", fake.gotDays)
	}
}

func TestHandleGetIndicatorHistory_InvalidDays(t *testing.T) {
	rec := getIndicatorHistory(t, &fakeIndicatorHistoryReader{}, "?days=0")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleGetIndicatorHistory_RepositoryError(t *testing.T) {
	fake := &fakeIndicatorHistoryReader{err: errors.New("falha de conexão")}

	rec := getIndicatorHistory(t, fake, "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetIndicatorHistory_ServiceUnavailable(t *testing.T) {
	rec := getIndicatorHistory(t, nil, "")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}
