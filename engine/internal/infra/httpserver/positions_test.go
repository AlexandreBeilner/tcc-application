package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tcc-investimentos/engine/internal/domain/fixedincomeexecution"
	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/domain/position"
)

func TestHandleListPositions(t *testing.T) {
	reader := &fakeUserMarketDataReader{positions: []position.Record{
		{AssetID: "a1", AssetTicker: "VALR3", AssetName: "Vale ON", AssetType: "acao", IsSandbox: false, DividendsReceived: 42.5, Position: position.Position{Quantity: 10, AveragePrice: 100.5}},
		{AssetID: "a2", AssetTicker: "SAND3", AssetName: "Ação Sandbox", AssetType: "acao", IsSandbox: true, Position: position.Position{Quantity: 5, AveragePrice: 101}},
	}}

	rec := getUserMarketData(t, reader, "/positions?user_id="+validUserID)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body []positionResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 2 || body[0].Ticker != "VALR3" || body[0].Quantity != 10 || body[0].AveragePrice != 100.5 || body[0].IsSandbox || body[0].DividendsReceived != 42.5 {
		t.Errorf("body[0] = %+v, inesperado", body[0])
	}
	if body[1].Ticker != "SAND3" || !body[1].IsSandbox || body[1].DividendsReceived != 0 {
		t.Errorf("body[1] = %+v, esperava is_sandbox = true e dividends_received = 0", body[1])
	}
}

func TestHandleListPositions_Vazio(t *testing.T) {
	rec := getUserMarketData(t, &fakeUserMarketDataReader{}, "/positions?user_id="+validUserID)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var body []positionResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 0 {
		t.Errorf("body = %+v, want lista vazia", body)
	}
}

func TestHandleListPositions_UserIDInvalido(t *testing.T) {
	tests := map[string]string{
		"ausente":    "/positions",
		"vazio":      "/positions?user_id=",
		"não é UUID": "/positions?user_id=abc",
	}
	for name, path := range tests {
		t.Run(name, func(t *testing.T) {
			rec := getUserMarketData(t, &fakeUserMarketDataReader{}, path)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestHandleListPositions_ErroInterno(t *testing.T) {
	rec := getUserMarketData(t, &fakeUserMarketDataReader{positionsErr: context.DeadlineExceeded}, "/positions?user_id="+validUserID)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleListPositions_SemUserMarketDataReader(t *testing.T) {
	rec := getUserMarketData(t, nil, "/positions?user_id="+validUserID)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestHandleListFixedIncomePositions(t *testing.T) {
	reader := &fakeUserMarketDataReader{fixedIncomePositions: []fixedincomeposition.Record{
		{
			AssetID: "a2", AssetTicker: "LFT2029", AssetName: "Tesouro Selic 2029", AssetType: "tesouro_selic", IsSandbox: false,
			Position: fixedincomeposition.Position{Quantity: 3.5, AveragePrice: 1000.10, AverageRate: 12.3},
		},
		{
			AssetID: "a3", AssetTicker: "SANDPRE", AssetName: "Tesouro Prefixado Sandbox", AssetType: "tesouro_prefixado", IsSandbox: true,
			Position: fixedincomeposition.Position{Quantity: 1, AveragePrice: 900, AverageRate: 10},
		},
	}}

	rec := getUserMarketData(t, reader, "/fixed-income/positions?user_id="+validUserID)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body []userFixedIncomePositionResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 2 || body[0].Ticker != "LFT2029" || body[0].AverageRate != 12.3 || body[0].IsSandbox {
		t.Errorf("body[0] = %+v, inesperado", body[0])
	}
	if body[1].Ticker != "SANDPRE" || !body[1].IsSandbox {
		t.Errorf("body[1] = %+v, esperava is_sandbox = true", body[1])
	}
}

func TestHandleListFixedIncomePositions_Vazio(t *testing.T) {
	rec := getUserMarketData(t, &fakeUserMarketDataReader{}, "/fixed-income/positions?user_id="+validUserID)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var body []userFixedIncomePositionResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 0 {
		t.Errorf("body = %+v, want lista vazia", body)
	}
}

func TestHandleListFixedIncomePositions_UserIDInvalido(t *testing.T) {
	rec := getUserMarketData(t, &fakeUserMarketDataReader{}, "/fixed-income/positions?user_id=abc")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleListFixedIncomePositions_ErroInterno(t *testing.T) {
	rec := getUserMarketData(t, &fakeUserMarketDataReader{fixedIncomePositionsErr: context.DeadlineExceeded}, "/fixed-income/positions?user_id="+validUserID)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleListFixedIncomePositions_SemUserMarketDataReader(t *testing.T) {
	rec := getUserMarketData(t, nil, "/fixed-income/positions?user_id="+validUserID)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func getFixedIncomePositionsWithValuer(t *testing.T, reader userMarketDataReader, valuer fixedIncomeExecutor, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, valuer, nil, nil, reader, nil, nil).Handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec
}

func TestHandleListFixedIncomePositions_Valuation(t *testing.T) {
	reader := &fakeUserMarketDataReader{fixedIncomePositions: []fixedincomeposition.Record{
		{AssetID: "live", AssetTicker: "LFT2029", IsSandbox: false, Position: fixedincomeposition.Position{Quantity: 1, AveragePrice: 1000, AverageRate: 1}},
		{AssetID: "sbx", AssetTicker: "SANDPRE", IsSandbox: true, Position: fixedincomeposition.Position{Quantity: 1, AveragePrice: 900, AverageRate: 10}},
	}}
	valuer := &fakeFixedIncomeExecutor{valueOutcomes: map[string]fixedincomeexecution.RedeemOutcome{
		"live": {TotalValue: 1100, NetValue: 1085},
		"sbx":  {TotalValue: 999, NetValue: 999},
	}}

	rec := getFixedIncomePositionsWithValuer(t, reader, valuer, "/fixed-income/positions?valuation=true&user_id="+validUserID)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	var body []userFixedIncomePositionResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body[0].CurrentValue == nil || *body[0].CurrentValue != 1100 || body[0].NetValue == nil || *body[0].NetValue != 1085 {
		t.Errorf("body[0] = %+v, want current_value 1100 e net_value 1085", body[0])
	}
	if body[1].CurrentValue != nil || body[1].NetValue != nil {
		t.Errorf("body[1] = %+v, sandbox não deveria ser avaliado", body[1])
	}
}

func TestHandleListFixedIncomePositions_SemValuationNaoAvalia(t *testing.T) {
	reader := &fakeUserMarketDataReader{fixedIncomePositions: []fixedincomeposition.Record{
		{AssetID: "live", IsSandbox: false, Position: fixedincomeposition.Position{Quantity: 1, AveragePrice: 1000}},
	}}
	valuer := &fakeFixedIncomeExecutor{valueOutcomes: map[string]fixedincomeexecution.RedeemOutcome{"live": {TotalValue: 1100}}}

	rec := getFixedIncomePositionsWithValuer(t, reader, valuer, "/fixed-income/positions?user_id="+validUserID)
	var body []userFixedIncomePositionResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body[0].CurrentValue != nil {
		t.Errorf("current_value = %v, want ausente sem ?valuation=true", *body[0].CurrentValue)
	}
}

func TestHandleListFixedIncomePositions_ValuationComFalhaDeixaOCampoAusente(t *testing.T) {
	reader := &fakeUserMarketDataReader{fixedIncomePositions: []fixedincomeposition.Record{
		{AssetID: "live", IsSandbox: false, Position: fixedincomeposition.Position{Quantity: 1, AveragePrice: 1000}},
	}}
	valuer := &fakeFixedIncomeExecutor{valueErr: context.DeadlineExceeded}

	rec := getFixedIncomePositionsWithValuer(t, reader, valuer, "/fixed-income/positions?valuation=true&user_id="+validUserID)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var body []userFixedIncomePositionResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body[0].CurrentValue != nil {
		t.Errorf("current_value deveria ficar ausente quando a avaliação falha")
	}
}
