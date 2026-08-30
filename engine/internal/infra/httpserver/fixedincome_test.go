package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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
	exec := &fakeFixedIncomeExecutor{redeemOutcome: fixedincomeexecution.RedeemOutcome{TotalValue: 1234.56, NetValue: 1000.00, TaxRate: 0.175}}

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
	if body.NetValue != 1000.00 {
		t.Errorf("NetValue = %v, want 1000.00", body.NetValue)
	}
	if body.TaxRate != 0.175 {
		t.Errorf("TaxRate = %v, want 0.175", body.TaxRate)
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

func fixedIncomeSimulateReader() *fakeCatalogReader {
	rate := 10.0
	maturity := time.Now().AddDate(1, 0, 0)
	return &fakeCatalogReader{
		asset:         catalog.AssetRecord{ID: validAssetID, Asset: catalog.Asset{Ticker: "CDB2027", Name: "CDB Banco Invest 2027", Type: catalog.AssetCDB}},
		assetFound:    true,
		fixedIncome:   catalog.FixedIncomeSpecialization{InterestRate: &rate, MaturityDate: &maturity, TaxExempt: false},
		fixedIncomeOK: true,
	}
}

func getFixedIncomeSimulate(t *testing.T, reader catalogReader, query string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/fixed-income/simulate?"+query, nil)
	rec := httptest.NewRecorder()
	New("", nil, reader, nil, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func TestHandleFixedIncomeSimulate(t *testing.T) {
	rec := getFixedIncomeSimulate(t, fixedIncomeSimulateReader(), "asset_id="+validAssetID+"&amount=2000&days_held=180")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body simulateFixedIncomeResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.UnitPrice <= 0 || body.QuantityPurchased <= 0 || body.GrossProjectedValue <= 0 {
		t.Errorf("resposta com valores não positivos inesperados: %+v", body)
	}
}

func TestHandleFixedIncomeSimulate_ValidacaoDeEntrada(t *testing.T) {
	tests := map[string]string{
		"asset_id ausente":      "amount=2000&days_held=180",
		"asset_id não é UUID":   "asset_id=não-um-uuid&amount=2000&days_held=180",
		"amount ausente":        "asset_id=" + validAssetID + "&days_held=180",
		"amount zero":           "asset_id=" + validAssetID + "&amount=0&days_held=180",
		"amount não numérico":   "asset_id=" + validAssetID + "&amount=abc&days_held=180",
		"days_held ausente":     "asset_id=" + validAssetID + "&amount=2000",
		"days_held zero":        "asset_id=" + validAssetID + "&amount=2000&days_held=0",
		"days_held não inteiro": "asset_id=" + validAssetID + "&amount=2000&days_held=abc",
	}

	for name, query := range tests {
		t.Run(name, func(t *testing.T) {
			rec := getFixedIncomeSimulate(t, fixedIncomeSimulateReader(), query)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
		})
	}
}

func TestHandleFixedIncomeSimulate_AtivoNaoEncontrado(t *testing.T) {
	rec := getFixedIncomeSimulate(t, &fakeCatalogReader{assetFound: false}, "asset_id="+validAssetID+"&amount=2000&days_held=180")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandleFixedIncomeSimulate_AtivoNaoRendaFixa(t *testing.T) {
	reader := &fakeCatalogReader{
		asset:      catalog.AssetRecord{ID: validAssetID, Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
		assetFound: true,
	}
	rec := getFixedIncomeSimulate(t, reader, "asset_id="+validAssetID+"&amount=2000&days_held=180")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
	}
}

func TestHandleFixedIncomeSimulate_SemEspecializacao(t *testing.T) {
	reader := &fakeCatalogReader{
		asset:         catalog.AssetRecord{ID: validAssetID, Asset: catalog.Asset{Ticker: "CDB2027", Name: "CDB Banco Invest 2027", Type: catalog.AssetCDB}},
		assetFound:    true,
		fixedIncomeOK: false,
	}
	rec := getFixedIncomeSimulate(t, reader, "asset_id="+validAssetID+"&amount=2000&days_held=180")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusInternalServerError, rec.Body.String())
	}
}

func TestHandleFixedIncomeSimulate_AtivoIsentoNuncaAplicaImposto(t *testing.T) {
	rate := 10.0
	maturity := time.Now().AddDate(1, 0, 0)
	reader := &fakeCatalogReader{
		asset:         catalog.AssetRecord{ID: validAssetID, Asset: catalog.Asset{Ticker: "LCI2027", Name: "LCI Banco Invest 2027", Type: catalog.AssetLCI}},
		assetFound:    true,
		fixedIncome:   catalog.FixedIncomeSpecialization{InterestRate: &rate, MaturityDate: &maturity, TaxExempt: true},
		fixedIncomeOK: true,
	}

	rec := getFixedIncomeSimulate(t, reader, "asset_id="+validAssetID+"&amount=2000&days_held=360")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body simulateFixedIncomeResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.TaxRate != 0 {
		t.Errorf("TaxRate = %v, want 0 (ativo isento)", body.TaxRate)
	}
	if body.NetProjectedValue != body.GrossProjectedValue {
		t.Errorf("NetProjectedValue = %v, want igual a GrossProjectedValue = %v (ativo isento)", body.NetProjectedValue, body.GrossProjectedValue)
	}
}

func TestHandleFixedIncomeSimulate_SemCatalogReader(t *testing.T) {
	rec := getFixedIncomeSimulate(t, nil, "asset_id="+validAssetID+"&amount=2000&days_held=180")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
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

func getFixedIncomeTaxRate(t *testing.T, query string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/fixed-income/tax-rate?"+query, nil)
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

// TestHandleFixedIncomeTaxRate (tarefa 6.7) — sem catalogReader/executor
// nenhum (ambos nil em getFixedIncomeTaxRate acima): diferente de
// GET /fixed-income/simulate, esta rota nunca responde 503 por
// dependência ausente, já que não tem nenhuma — só chama
// fixedincome.RegressiveIncomeTaxRate direto.
func TestHandleFixedIncomeTaxRate(t *testing.T) {
	tests := []struct {
		name     string
		daysHeld string
		wantRate float64
	}{
		{name: "limite superior da primeira faixa", daysHeld: "180", wantRate: 0.225},
		{name: "início da segunda faixa", daysHeld: "181", wantRate: 0.20},
		{name: "limite superior da segunda faixa", daysHeld: "360", wantRate: 0.20},
		{name: "início da terceira faixa", daysHeld: "361", wantRate: 0.175},
		{name: "limite superior da terceira faixa", daysHeld: "720", wantRate: 0.175},
		{name: "início da quarta faixa", daysHeld: "721", wantRate: 0.15},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := getFixedIncomeTaxRate(t, "days_held="+tt.daysHeld)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
			}

			var body taxRateResponse
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("decode body: %v", err)
			}
			if body.TaxRate != tt.wantRate {
				t.Errorf("TaxRate = %v, want %v", body.TaxRate, tt.wantRate)
			}
		})
	}
}

func TestHandleFixedIncomeTaxRate_ValidacaoDeEntrada(t *testing.T) {
	tests := map[string]string{
		"days_held ausente":     "",
		"days_held zero":        "days_held=0",
		"days_held negativo":    "days_held=-10",
		"days_held não inteiro": "days_held=abc",
	}

	for name, query := range tests {
		t.Run(name, func(t *testing.T) {
			rec := getFixedIncomeTaxRate(t, query)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
		})
	}
}
