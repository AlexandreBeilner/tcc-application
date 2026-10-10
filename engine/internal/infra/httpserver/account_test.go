package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/domain/position"
)

type fakeAccountOpener struct {
	err error

	creditErr      error
	creditedUserID string
	creditedAmount float64
	creditedMonth  string

	adminCreditErr      error
	adminCreditedUserID string
	adminCreditedAmount float64
}

func (f *fakeAccountOpener) Open(_ context.Context, userID string) (account.Account, error) {
	if f.err != nil {
		return account.Account{}, f.err
	}
	return account.New(userID), nil
}

func (f *fakeAccountOpener) CreditSalary(_ context.Context, userID string, amount float64, referenceMonth string) error {
	if f.creditErr != nil {
		return f.creditErr
	}
	f.creditedUserID, f.creditedAmount, f.creditedMonth = userID, amount, referenceMonth
	return nil
}

func (f *fakeAccountOpener) AdminCredit(_ context.Context, userID string, amount float64) (float64, error) {
	if f.adminCreditErr != nil {
		return 0, f.adminCreditErr
	}
	f.adminCreditedUserID, f.adminCreditedAmount = userID, amount
	return amount, nil
}

const validUserID = "8f14e45f-ceea-4a5c-8d1a-9f1d3e1c1234"

func postAccount(t *testing.T, opener accountWriter, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/accounts", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	New("", opener, nil, nil, nil, nil, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func TestHandleCreateAccount(t *testing.T) {
	rec := postAccount(t, &fakeAccountOpener{}, `{"user_id":"`+validUserID+`"}`)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body.String())
	}

	var body accountResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.UserID != validUserID {
		t.Errorf("UserID = %q, want %q", body.UserID, validUserID)
	}
	if body.CurrentBalance != account.InitialBalance {
		t.Errorf("CurrentBalance = %v, want %v", body.CurrentBalance, account.InitialBalance)
	}
}

func TestHandleCreateAccount_UserIDInvalido(t *testing.T) {
	tests := map[string]string{
		"ausente":       `{}`,
		"vazio":         `{"user_id":""}`,
		"não é UUID":    `{"user_id":"não-um-uuid"}`,
		"json quebrado": `{`,
	}

	for name, body := range tests {
		t.Run(name, func(t *testing.T) {
			rec := postAccount(t, &fakeAccountOpener{}, body)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestHandleCreateAccount_ContaJaExiste(t *testing.T) {
	rec := postAccount(t, &fakeAccountOpener{err: account.ErrAlreadyExists}, `{"user_id":"`+validUserID+`"}`)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusConflict)
	}
}

func TestHandleCreateAccount_ErroInterno(t *testing.T) {
	rec := postAccount(t, &fakeAccountOpener{err: context.DeadlineExceeded}, `{"user_id":"`+validUserID+`"}`)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleCreateAccount_SemAccountOpener(t *testing.T) {
	rec := postAccount(t, nil, `{"user_id":"`+validUserID+`"}`)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func postSalary(t *testing.T, crediter accountWriter, userID, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/accounts/"+userID+"/salary", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	New("", crediter, nil, nil, nil, nil, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func TestHandleCreditSalary(t *testing.T) {
	fake := &fakeAccountOpener{}
	rec := postSalary(t, fake, validUserID, `{"amount":1000,"reference_month":"2026-01"}`)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusNoContent, rec.Body.String())
	}
	if fake.creditedUserID != validUserID || fake.creditedAmount != 1000 || fake.creditedMonth != "2026-01" {
		t.Errorf("creditado = (%q, %v, %q), want (%q, 1000, \"2026-01\")", fake.creditedUserID, fake.creditedAmount, fake.creditedMonth, validUserID)
	}
}

func TestHandleCreditSalary_AmountInvalido(t *testing.T) {
	tests := map[string]string{
		"ausente":       `{"reference_month":"2026-01"}`,
		"zero":          `{"amount":0,"reference_month":"2026-01"}`,
		"negativo":      `{"amount":-1,"reference_month":"2026-01"}`,
		"json quebrado": `{`,
	}

	for name, body := range tests {
		t.Run(name, func(t *testing.T) {
			rec := postSalary(t, &fakeAccountOpener{}, validUserID, body)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
			}
		})
	}
}

// TestHandleCreditSalary_ReferenceMonthInvalido cobre o achado 025:
// reference_month obrigatório e no formato AAAA-MM.
func TestHandleCreditSalary_ReferenceMonthInvalido(t *testing.T) {
	tests := map[string]string{
		"ausente":       `{"amount":1000}`,
		"vazio":         `{"amount":1000,"reference_month":""}`,
		"sem mês":       `{"amount":1000,"reference_month":"2026"}`,
		"mal formatado": `{"amount":1000,"reference_month":"janeiro-2026"}`,
	}

	for name, body := range tests {
		t.Run(name, func(t *testing.T) {
			rec := postSalary(t, &fakeAccountOpener{}, validUserID, body)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
			}
		})
	}
}

func TestHandleCreditSalary_ContaNaoEncontrada(t *testing.T) {
	rec := postSalary(t, &fakeAccountOpener{creditErr: account.ErrNotFound}, validUserID, `{"amount":1000,"reference_month":"2026-01"}`)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandleCreditSalary_ErroInterno(t *testing.T) {
	rec := postSalary(t, &fakeAccountOpener{creditErr: context.DeadlineExceeded}, validUserID, `{"amount":1000,"reference_month":"2026-01"}`)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleCreditSalary_SemAccountSalaryCrediter(t *testing.T) {
	rec := postSalary(t, nil, validUserID, `{"amount":1000,"reference_month":"2026-01"}`)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func postAdminCredit(t *testing.T, crediter accountWriter, userID, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/admin/accounts/"+userID+"/credit", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	New("", crediter, nil, nil, nil, nil, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func TestHandleAdminCredit(t *testing.T) {
	fake := &fakeAccountOpener{}
	rec := postAdminCredit(t, fake, validUserID, `{"amount":2500.5}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if fake.adminCreditedUserID != validUserID || fake.adminCreditedAmount != 2500.5 {
		t.Errorf("creditado = (%q, %v), want (%q, 2500.5)", fake.adminCreditedUserID, fake.adminCreditedAmount, validUserID)
	}
	var body adminCreditResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.UserID != validUserID || body.Credited != 2500.5 {
		t.Errorf("body = %+v, want user_id e credited 2500.5", body)
	}
}

func TestHandleAdminCredit_Erros(t *testing.T) {
	tests := []struct {
		name   string
		userID string
		body   string
		fake   *fakeAccountOpener
		want   int
	}{
		{"user_id inválido", "nao-e-uuid", `{"amount":10}`, &fakeAccountOpener{}, http.StatusBadRequest},
		{"json quebrado", validUserID, `{`, &fakeAccountOpener{}, http.StatusBadRequest},
		{"valor recusado pelo domínio", validUserID, `{"amount":0}`, &fakeAccountOpener{adminCreditErr: account.ErrInvalidCreditAmount}, http.StatusBadRequest},
		{"conta inexistente", validUserID, `{"amount":10}`, &fakeAccountOpener{adminCreditErr: account.ErrNotFound}, http.StatusNotFound},
		{"estouro de saldo", validUserID, `{"amount":10}`, &fakeAccountOpener{adminCreditErr: account.ErrBalanceOverflow}, http.StatusUnprocessableEntity},
		{"erro interno", validUserID, `{"amount":10}`, &fakeAccountOpener{adminCreditErr: context.DeadlineExceeded}, http.StatusInternalServerError},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postAdminCredit(t, tt.fake, tt.userID, tt.body)
			if rec.Code != tt.want {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.want, rec.Body.String())
			}
		})
	}
}

func TestHandleAdminCredit_SemServicoDeContas(t *testing.T) {
	rec := postAdminCredit(t, nil, validUserID, `{"amount":10}`)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

// fakeUserMarketDataReader implementa userMarketDataReader (accountReader +
// userEventLister + positionLister + fixedIncomePositionLister) — usado
// pelos testes de leitura de estado de usuário (tarefa 4.7), mesmo padrão
// de fakeCatalogReader (assets_test.go).
type fakeUserMarketDataReader struct {
	account      account.Account
	accountFound bool
	accountErr   error

	events    []domain.MarketEventRecord
	eventsErr error
	gotLimit  int
	gotOffset int

	positions    []position.Record
	positionsErr error

	fixedIncomePositions    []fixedincomeposition.Record
	fixedIncomePositionsErr error
}

func (f *fakeUserMarketDataReader) FindByUserID(_ context.Context, _ string) (account.Account, bool, error) {
	return f.account, f.accountFound, f.accountErr
}

func (f *fakeUserMarketDataReader) ListMarketEventsByUser(_ context.Context, _ string, limit, offset int) ([]domain.MarketEventRecord, error) {
	f.gotLimit, f.gotOffset = limit, offset
	return f.events, f.eventsErr
}

func (f *fakeUserMarketDataReader) ListPositionsByUser(_ context.Context, _ string) ([]position.Record, error) {
	return f.positions, f.positionsErr
}

func (f *fakeUserMarketDataReader) ListFixedIncomePositionsByUser(_ context.Context, _ string) ([]fixedincomeposition.Record, error) {
	return f.fixedIncomePositions, f.fixedIncomePositionsErr
}

func getUserMarketData(t *testing.T, userData userMarketDataReader, path string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, userData, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func TestHandleGetAccount(t *testing.T) {
	reader := &fakeUserMarketDataReader{
		account:      account.Account{UserID: validUserID, CurrentBalance: 9500.50, TotalInvested: 500, TotalDisinvested: 80, TotalDividendsReceived: 12.30},
		accountFound: true,
	}

	rec := getUserMarketData(t, reader, "/accounts/"+validUserID)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body accountResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.CurrentBalance != 9500.50 || body.TotalInvested != 500 || body.TotalDisinvested != 80 || body.TotalDividendsReceived != 12.30 {
		t.Errorf("body = %+v, inesperado", body)
	}
}

func TestHandleGetAccount_NaoEncontrada(t *testing.T) {
	rec := getUserMarketData(t, &fakeUserMarketDataReader{accountFound: false}, "/accounts/"+validUserID)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandleGetAccount_ErroInterno(t *testing.T) {
	rec := getUserMarketData(t, &fakeUserMarketDataReader{accountErr: context.DeadlineExceeded}, "/accounts/"+validUserID)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetAccount_SemUserMarketDataReader(t *testing.T) {
	rec := getUserMarketData(t, nil, "/accounts/"+validUserID)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestHandleListAccountEvents(t *testing.T) {
	assetID := "a1"
	quantity := 10
	unitValue := 105.5
	reader := &fakeUserMarketDataReader{events: []domain.MarketEventRecord{
		{ID: "e1", MarketEvent: domain.MarketEvent{EventType: domain.EventBuyOrderExecuted, AssetID: &assetID, Quantity: &quantity, UnitValue: &unitValue}},
	}}

	rec := getUserMarketData(t, reader, "/accounts/"+validUserID+"/events")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if reader.gotLimit != defaultMacroEventListLimit || reader.gotOffset != 0 {
		t.Errorf("limit/offset default = %d/%d, want %d/0", reader.gotLimit, reader.gotOffset, defaultMacroEventListLimit)
	}

	var body []marketEventResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 1 || body[0].EventType != string(domain.EventBuyOrderExecuted) || body[0].AssetID == nil || *body[0].AssetID != assetID {
		t.Errorf("body = %+v, inesperado", body)
	}
}

func TestHandleListAccountEvents_PaginacaoRepassada(t *testing.T) {
	reader := &fakeUserMarketDataReader{}
	rec := getUserMarketData(t, reader, "/accounts/"+validUserID+"/events?limit=5&offset=10")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if reader.gotLimit != 5 || reader.gotOffset != 10 {
		t.Errorf("limit/offset = %d/%d, want 5/10", reader.gotLimit, reader.gotOffset)
	}
}

func TestHandleListAccountEvents_Vazio(t *testing.T) {
	rec := getUserMarketData(t, &fakeUserMarketDataReader{}, "/accounts/"+validUserID+"/events")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var body []marketEventResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 0 {
		t.Errorf("body = %+v, want lista vazia", body)
	}
}

func TestHandleListAccountEvents_PaginacaoInvalida(t *testing.T) {
	tests := map[string]string{
		"limit inválido":  "/accounts/" + validUserID + "/events?limit=0",
		"offset inválido": "/accounts/" + validUserID + "/events?offset=-1",
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

func TestHandleListAccountEvents_ErroInterno(t *testing.T) {
	rec := getUserMarketData(t, &fakeUserMarketDataReader{eventsErr: context.DeadlineExceeded}, "/accounts/"+validUserID+"/events")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleListAccountEvents_SemUserMarketDataReader(t *testing.T) {
	rec := getUserMarketData(t, nil, "/accounts/"+validUserID+"/events")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}
