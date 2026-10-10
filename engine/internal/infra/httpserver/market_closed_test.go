package httpserver

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// Sábado simulado (dia 5): a próxima abertura é a segunda-feira do dia 7 (2026-01-12).
func closedOnSaturday() error { return simcalendar.CheckMarketOpen(5) }

func assertMarketClosed(t *testing.T, rec *httptest.ResponseRecorder) {
	t.Helper()
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422, body = %s", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["code"] != "market_closed" || body["opens_on"] != "2026-01-12" || body["days_until_open"] != float64(2) || body["error"] != "Mercado fechado: fim de semana simulado. Abre na segunda-feira, 12/01." {
		t.Errorf("corpo = %v", body)
	}
}

func TestMercadoFechado_OrdemDevolve422ComCodigo(t *testing.T) {
	assertMarketClosed(t, postOrder(t, tradableAssetReader(), &fakeOrderSubmitter{err: closedOnSaturday()}, validOrderBody()))
}

func TestMercadoFechado_CompraEResgateDeRendaFixaDevolvem422ComCodigo(t *testing.T) {
	exec := &fakeFixedIncomeExecutor{purchaseErr: closedOnSaturday(), redeemErr: closedOnSaturday()}
	assertMarketClosed(t, postFixedIncome(t, "/fixed-income/purchases", fixedIncomeAssetReader(), exec, validPurchaseBody()))
	assertMarketClosed(t, postFixedIncome(t, "/fixed-income/redemptions", fixedIncomeAssetReader(), exec,
		`{"user_id":"`+validUserID+`","asset_id":"`+validAssetID+`"}`))
}
