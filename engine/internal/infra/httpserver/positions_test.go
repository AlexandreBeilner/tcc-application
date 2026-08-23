package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/domain/position"
)

func TestHandleListPositions(t *testing.T) {
	reader := &fakeUserMarketDataReader{positions: []position.Record{
		{AssetID: "a1", AssetTicker: "VALR3", AssetName: "Vale ON", AssetType: "acao", Position: position.Position{Quantity: 10, AveragePrice: 100.5}},
	}}

	rec := getUserMarketData(t, reader, "/positions?user_id="+validUserID)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body []positionResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 1 || body[0].Ticker != "VALR3" || body[0].Quantity != 10 || body[0].AveragePrice != 100.5 {
		t.Errorf("body = %+v, inesperado", body)
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
			AssetID: "a2", AssetTicker: "LFT2029", AssetName: "Tesouro Selic 2029", AssetType: "tesouro_selic",
			Position: fixedincomeposition.Position{Quantity: 3.5, AveragePrice: 1000.10, AverageRate: 12.3},
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
	if len(body) != 1 || body[0].Ticker != "LFT2029" || body[0].AverageRate != 12.3 {
		t.Errorf("body = %+v, inesperado", body)
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
