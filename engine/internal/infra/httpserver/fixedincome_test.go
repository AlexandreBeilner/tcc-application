package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fixedincomeexecution"
)

type fakeFixedIncomeExecutor struct {
	purchaseOutcome fixedincomeexecution.PurchaseOutcome
	purchaseErr     error
	gotPurchaseReq  fixedincomeexecution.Request

	redeemOutcome fixedincomeexecution.RedeemOutcome
	redeemErr     error
	gotRedeemReq  fixedincomeexecution.RedeemRequest
}

func (f *fakeFixedIncomeExecutor) Purchase(_ context.Context, req fixedincomeexecution.Request) (fixedincomeexecution.PurchaseOutcome, error) {
	f.gotPurchaseReq = req
	return f.purchaseOutcome, f.purchaseErr
}

func (f *fakeFixedIncomeExecutor) Redeem(_ context.Context, req fixedincomeexecution.RedeemRequest) (fixedincomeexecution.RedeemOutcome, error) {
	f.gotRedeemReq = req
	return f.redeemOutcome, f.redeemErr
}

func fixedIncomeAssetReader() *fakeCatalogReader {
	return &fakeCatalogReader{
		asset:      catalog.AssetRecord{ID: validAssetID, Asset: catalog.Asset{Ticker: "CDB2027", Name: "CDB Banco Invest 2027", Type: catalog.AssetCDB}},
		assetFound: true,
	}
}

func postFixedIncome(t *testing.T, path string, reader catalogReader, exec fixedIncomeExecutor, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	New("", nil, reader, nil, nil, exec, nil, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func validPurchaseBody() string {
	return `{"user_id":"` + validUserID + `","asset_id":"` + validAssetID + `","amount":2000}`
}

func validRedeemBody() string {
	return `{"user_id":"` + validUserID + `","asset_id":"` + validAssetID + `"}`
}

func TestHandleFixedIncomePurchase(t *testing.T) {
	exec := &fakeFixedIncomeExecutor{purchaseOutcome: fixedincomeexecution.PurchaseOutcome{
		UnitPrice:         700,
		QuantityPurchased: 2.857142857,
	}}

	rec := postFixedIncome(t, "/fixed-income/purchases", fixedIncomeAssetReader(), exec, validPurchaseBody())
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body.String())
	}

	var body purchaseFixedIncomeResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.UnitPrice != 700 {
		t.Errorf("UnitPrice = %v, want 700", body.UnitPrice)
	}
	if exec.gotPurchaseReq.UserID != validUserID || exec.gotPurchaseReq.AssetID != validAssetID || exec.gotPurchaseReq.Amount != 2000 {
		t.Errorf("Purchase recebeu req = %+v, campos não repassados corretamente", exec.gotPurchaseReq)
	}
}

func TestHandleFixedIncomePurchase_ValidacaoDeEntrada(t *testing.T) {
	tests := map[string]string{
		"json quebrado":       `{`,
		"user_id não é UUID":  `{"user_id":"não-um-uuid","asset_id":"` + validAssetID + `","amount":2000}`,
		"asset_id não é UUID": `{"user_id":"` + validUserID + `","asset_id":"não-um-uuid","amount":2000}`,
		"amount zero":         `{"user_id":"` + validUserID + `","asset_id":"` + validAssetID + `","amount":0}`,
		"amount negativo":     `{"user_id":"` + validUserID + `","asset_id":"` + validAssetID + `","amount":-100}`,
	}

	for name, body := range tests {
		t.Run(name, func(t *testing.T) {
			rec := postFixedIncome(t, "/fixed-income/purchases", fixedIncomeAssetReader(), &fakeFixedIncomeExecutor{}, body)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
		})
	}
}

func TestHandleFixedIncomePurchase_AtivoNaoEncontrado(t *testing.T) {
	rec := postFixedIncome(t, "/fixed-income/purchases", &fakeCatalogReader{assetFound: false}, &fakeFixedIncomeExecutor{}, validPurchaseBody())
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandleFixedIncomePurchase_AtivoNaoRendaFixa(t *testing.T) {
	tests := map[string]catalog.AssetRecord{
		"renda variável": {ID: validAssetID, Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
	}

	for name, asset := range tests {
		t.Run(name, func(t *testing.T) {
			reader := &fakeCatalogReader{asset: asset, assetFound: true}
			rec := postFixedIncome(t, "/fixed-income/purchases", reader, &fakeFixedIncomeExecutor{}, validPurchaseBody())
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
		})
	}
}

// TestHandleFixedIncomePurchase_AtivoSandboxAceito confirma que ativo
// sandbox de renda fixa não é mais rejeitado (RF12, tarefa 4.11) — antes
// desta tarefa, is_sandbox = true caía no mesmo 400 de tipo de ativo
// errado. A taxa contratada sourced de sandbox.RateScript (em vez de
// fixed_income_assets.interest_rate) só existe no
// FixedIncomeExecutionRepository real (fixed_income_execution_repository.go)
// — exec aqui é fake, então este teste cobre só o portão de aceitação da
// rota, não o roteiro em si.
func TestHandleFixedIncomePurchase_AtivoSandboxAceito(t *testing.T) {
	reader := &fakeCatalogReader{
		asset:      catalog.AssetRecord{ID: validAssetID, Asset: catalog.Asset{Ticker: "SANDPRE", Name: "Tesouro Prefixado Sandbox", Type: catalog.AssetTesouroPrefixado, IsSandbox: true}},
		assetFound: true,
	}
	rec := postFixedIncome(t, "/fixed-income/purchases", reader, &fakeFixedIncomeExecutor{}, validPurchaseBody())
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body.String())
	}
}

func TestHandleFixedIncomePurchase_ErrosDeExecucao(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{"abaixo da aplicação mínima", fixedincomeexecution.ErrBelowMinimumInvestment, http.StatusUnprocessableEntity},
		{"saldo insuficiente", fixedincomeexecution.ErrInsufficientBalance, http.StatusUnprocessableEntity},
		{"valor inválido", fixedincomeexecution.ErrInvalidAmount, http.StatusBadRequest},
		{"conta não encontrada", fixedincomeexecution.ErrAccountNotFound, http.StatusNotFound},
		{"erro interno inesperado", context.DeadlineExceeded, http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postFixedIncome(t, "/fixed-income/purchases", fixedIncomeAssetReader(), &fakeFixedIncomeExecutor{purchaseErr: tt.err}, validPurchaseBody())
			if rec.Code != tt.want {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.want, rec.Body.String())
			}
		})
	}
}

func TestHandleFixedIncomePurchase_SemDependencias(t *testing.T) {
	t.Run("sem catalogReader", func(t *testing.T) {
		rec := postFixedIncome(t, "/fixed-income/purchases", nil, &fakeFixedIncomeExecutor{}, validPurchaseBody())
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
		}
	})

	t.Run("sem executor", func(t *testing.T) {
		rec := postFixedIncome(t, "/fixed-income/purchases", fixedIncomeAssetReader(), nil, validPurchaseBody())
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
		}
	})
}

func TestHandleFixedIncomeRedemption(t *testing.T) {
	exec := &fakeFixedIncomeExecutor{redeemOutcome: fixedincomeexecution.RedeemOutcome{TotalValue: 1234.56}}

	rec := postFixedIncome(t, "/fixed-income/redemptions", fixedIncomeAssetReader(), exec, validRedeemBody())
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body redeemFixedIncomeResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.TotalValue != 1234.56 {
		t.Errorf("TotalValue = %v, want 1234.56", body.TotalValue)
	}
	if exec.gotRedeemReq.UserID != validUserID || exec.gotRedeemReq.AssetID != validAssetID {
		t.Errorf("Redeem recebeu req = %+v, campos não repassados corretamente", exec.gotRedeemReq)
	}
}

func TestHandleFixedIncomeRedemption_ValidacaoDeEntrada(t *testing.T) {
	tests := map[string]string{
		"json quebrado":       `{`,
		"user_id não é UUID":  `{"user_id":"não-um-uuid","asset_id":"` + validAssetID + `"}`,
		"asset_id não é UUID": `{"user_id":"` + validUserID + `","asset_id":"não-um-uuid"}`,
	}

	for name, body := range tests {
		t.Run(name, func(t *testing.T) {
			rec := postFixedIncome(t, "/fixed-income/redemptions", fixedIncomeAssetReader(), &fakeFixedIncomeExecutor{}, body)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
		})
	}
}

func TestHandleFixedIncomeRedemption_AtivoNaoEncontrado(t *testing.T) {
	rec := postFixedIncome(t, "/fixed-income/redemptions", &fakeCatalogReader{assetFound: false}, &fakeFixedIncomeExecutor{}, validRedeemBody())
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandleFixedIncomeRedemption_AtivoNaoRendaFixa(t *testing.T) {
	reader := &fakeCatalogReader{
		asset:      catalog.AssetRecord{ID: validAssetID, Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
		assetFound: true,
	}
	rec := postFixedIncome(t, "/fixed-income/redemptions", reader, &fakeFixedIncomeExecutor{}, validRedeemBody())
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
}

// TestHandleFixedIncomeRedemption_AtivoSandboxAceito — mesma nota de
// TestHandleFixedIncomePurchase_AtivoSandboxAceito, pro resgate.
func TestHandleFixedIncomeRedemption_AtivoSandboxAceito(t *testing.T) {
	reader := &fakeCatalogReader{
		asset:      catalog.AssetRecord{ID: validAssetID, Asset: catalog.Asset{Ticker: "SANDPRE", Name: "Tesouro Prefixado Sandbox", Type: catalog.AssetTesouroPrefixado, IsSandbox: true}},
		assetFound: true,
	}
	rec := postFixedIncome(t, "/fixed-income/redemptions", reader, &fakeFixedIncomeExecutor{}, validRedeemBody())
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
}

func TestHandleFixedIncomeRedemption_ErrosDeExecucao(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{"posição não encontrada", fixedincomeexecution.ErrPositionNotFound, http.StatusNotFound},
		{"erro interno inesperado", context.DeadlineExceeded, http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postFixedIncome(t, "/fixed-income/redemptions", fixedIncomeAssetReader(), &fakeFixedIncomeExecutor{redeemErr: tt.err}, validRedeemBody())
			if rec.Code != tt.want {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.want, rec.Body.String())
			}
		})
	}
}

func TestHandleFixedIncomeRedemption_SemDependencias(t *testing.T) {
	t.Run("sem catalogReader", func(t *testing.T) {
		rec := postFixedIncome(t, "/fixed-income/redemptions", nil, &fakeFixedIncomeExecutor{}, validRedeemBody())
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
		}
	})

	t.Run("sem executor", func(t *testing.T) {
		rec := postFixedIncome(t, "/fixed-income/redemptions", fixedIncomeAssetReader(), nil, validRedeemBody())
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
		}
	})
}
