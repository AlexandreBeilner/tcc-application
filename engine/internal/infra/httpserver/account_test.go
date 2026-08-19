package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tcc-investimentos/engine/internal/domain/account"
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
	New("", opener).Handler.ServeHTTP(rec, req)
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
