package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/orderexecution"
	"tcc-investimentos/engine/internal/domain/tradinghalt"
)

type fakeHaltManager struct {
	pauseErr, liftErr error
	pausedScope       tradinghalt.Scope
	pausedAsset       string
	pausedReason      string
	pausedBy          string
	liftedID          string
	listing           tradinghalt.Listing
	status            tradinghalt.PublicStatus
}

func (f *fakeHaltManager) Pause(_ context.Context, scope tradinghalt.Scope, assetID, reason, adminID string) (tradinghalt.Halt, error) {
	f.pausedScope, f.pausedAsset, f.pausedReason, f.pausedBy = scope, assetID, reason, adminID
	return tradinghalt.Halt{ID: "h1", Scope: scope, Reason: reason, CreatedBy: adminID, CreatedAt: time.Unix(0, 0).UTC()}, f.pauseErr
}

func (f *fakeHaltManager) Lift(_ context.Context, id, _ string) (tradinghalt.Halt, error) {
	f.liftedID = id
	return tradinghalt.Halt{ID: id}, f.liftErr
}

func (f *fakeHaltManager) List(context.Context) (tradinghalt.Listing, error) { return f.listing, nil }
func (f *fakeHaltManager) Status(context.Context) (tradinghalt.PublicStatus, error) {
	return f.status, nil
}

func callHalts(t *testing.T, m tradingHaltManager, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var opts []Option
	if m != nil {
		opts = append(opts, WithTradingHalts(m))
	}
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, opts...).Handler.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

func TestHalts_RotasRespondem503SemServico(t *testing.T) {
	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/admin/halts"},
		{http.MethodPost, "/admin/halts"},
		{http.MethodPost, "/admin/halts/" + validOrderID + "/lift"},
		{http.MethodGet, "/market/halts"},
	} {
		if rec := callHalts(t, nil, tc.method, tc.path, `{}`); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("%s %s sem serviço = %d, want 503", tc.method, tc.path, rec.Code)
		}
	}
}

func TestAdminPause(t *testing.T) {
	t.Run("cria pausa de ativo e repassa os campos", func(t *testing.T) {
		fake := &fakeHaltManager{}
		body := `{"scope":"asset","asset_id":"` + validAssetID + `","reason":"volatilidade","admin_id":"` + validUserID + `"}`
		rec := callHalts(t, fake, http.MethodPost, "/admin/halts", body)
		if rec.Code != http.StatusCreated {
			t.Fatalf("status = %d: %s", rec.Code, rec.Body)
		}
		if fake.pausedScope != tradinghalt.ScopeAsset || fake.pausedAsset != validAssetID || fake.pausedReason != "volatilidade" || fake.pausedBy != validUserID {
			t.Errorf("repassado = %+v", fake)
		}
	})

	t.Run("mapeia os erros do domínio", func(t *testing.T) {
		tests := []struct {
			err  error
			want int
		}{
			{tradinghalt.ErrAlreadyHalted, http.StatusConflict},
			{tradinghalt.ErrAssetNotFound, http.StatusNotFound},
			{tradinghalt.ErrAssetNotTradable, http.StatusBadRequest},
			{tradinghalt.ErrReasonRequired, http.StatusBadRequest},
			{tradinghalt.ErrInvalidScope, http.StatusBadRequest},
			{errors.New("boom"), http.StatusInternalServerError},
		}
		for _, tt := range tests {
			rec := callHalts(t, &fakeHaltManager{pauseErr: tt.err}, http.MethodPost, "/admin/halts", `{"scope":"global","reason":"m","admin_id":"`+validUserID+`"}`)
			if rec.Code != tt.want {
				t.Errorf("%v = %d, want %d", tt.err, rec.Code, tt.want)
			}
		}
	})

	t.Run("recusa corpo e ids inválidos", func(t *testing.T) {
		for _, body := range []string{`nao-json`, `{"scope":"global","reason":"m"}`, `{"scope":"asset","asset_id":"x","reason":"m","admin_id":"` + validUserID + `"}`} {
			if rec := callHalts(t, &fakeHaltManager{}, http.MethodPost, "/admin/halts", body); rec.Code != http.StatusBadRequest {
				t.Errorf("corpo %q = %d, want 400", body, rec.Code)
			}
		}
	})
}

func TestAdminLift(t *testing.T) {
	fake := &fakeHaltManager{}
	rec := callHalts(t, fake, http.MethodPost, "/admin/halts/"+validOrderID+"/lift", `{"admin_id":"`+validUserID+`"}`)
	if rec.Code != http.StatusOK || fake.liftedID != validOrderID {
		t.Fatalf("status = %d lifted = %q", rec.Code, fake.liftedID)
	}
	for _, tt := range []struct {
		err  error
		want int
	}{{tradinghalt.ErrHaltNotFound, http.StatusNotFound}, {tradinghalt.ErrAlreadyLifted, http.StatusConflict}} {
		rec := callHalts(t, &fakeHaltManager{liftErr: tt.err}, http.MethodPost, "/admin/halts/"+validOrderID+"/lift", `{"admin_id":"`+validUserID+`"}`)
		if rec.Code != tt.want {
			t.Errorf("%v = %d, want %d", tt.err, rec.Code, tt.want)
		}
	}
	if rec := callHalts(t, fake, http.MethodPost, "/admin/halts/x/lift", `{}`); rec.Code != http.StatusBadRequest {
		t.Errorf("id inválido = %d, want 400", rec.Code)
	}
	if rec := callHalts(t, fake, http.MethodPost, "/admin/halts/"+validOrderID+"/lift", `{}`); rec.Code != http.StatusBadRequest {
		t.Errorf("sem admin_id = %d, want 400", rec.Code)
	}
}

func TestAdminListHalts(t *testing.T) {
	ticker := "ACME3"
	fake := &fakeHaltManager{listing: tradinghalt.Listing{
		Active: []tradinghalt.Halt{{ID: "h1", Scope: tradinghalt.ScopeAsset, Ticker: &ticker, Reason: "motivo"}},
	}}
	rec := callHalts(t, fake, http.MethodGet, "/admin/halts", "")
	var got struct {
		Active []map[string]any `json:"active"`
		Recent []map[string]any `json:"recent"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusOK || len(got.Active) != 1 || got.Active[0]["ticker"] != "ACME3" || got.Recent == nil {
		t.Errorf("status = %d corpo = %s", rec.Code, rec.Body)
	}
}

func TestMarketHalts_NaoExpoeMotivoNemAutor(t *testing.T) {
	fake := &fakeHaltManager{status: tradinghalt.PublicStatus{Global: true, AssetIDs: []string{validAssetID}}}
	rec := callHalts(t, fake, http.MethodGet, "/market/halts", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var got map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if got["global"] != true || len(got["asset_ids"].([]any)) != 1 || len(got) != 2 {
		t.Errorf("corpo = %v, want só global e asset_ids", got)
	}
}

func TestSubmitOrder_PausaDeNegociacaoDevolve409ComCodigo(t *testing.T) {
	for _, tt := range []struct {
		name      string
		err       error
		wantScope string
	}{
		{"pausa global", &orderexecution.TradingHaltedError{Global: true}, "global"},
		{"pausa do ativo", &orderexecution.TradingHaltedError{}, "asset"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			writeOrderExecutionError(rec, tt.err)
			var got map[string]any
			_ = json.Unmarshal(rec.Body.Bytes(), &got)
			if rec.Code != http.StatusConflict || got["code"] != "trading_halted" || got["scope"] != tt.wantScope {
				t.Errorf("status = %d corpo = %v", rec.Code, got)
			}
		})
	}
}
