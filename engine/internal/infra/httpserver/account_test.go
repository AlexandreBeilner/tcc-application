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
}

func (f *fakeAccountOpener) Open(_ context.Context, userID string) (account.Account, error) {
	if f.err != nil {
		return account.Account{}, f.err
	}
	return account.New(userID), nil
}

const validUserID = "8f14e45f-ceea-4a5c-8d1a-9f1d3e1c1234"

func postAccount(t *testing.T, opener accountOpener, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/accounts", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	New("", opener, nil, nil, nil, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
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
	New("", nil, nil, nil, nil, nil, nil, nil, userData, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func TestHandleGetAccount(t *testing.T) {
	reader := &fakeUserMarketDataReader{
		account:      account.Account{UserID: validUserID, CurrentBalance: 9500.50, TotalInvested: 500, TotalDividendsReceived: 12.30},
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
	if body.CurrentBalance != 9500.50 || body.TotalInvested != 500 || body.TotalDividendsReceived != 12.30 {
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
