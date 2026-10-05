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

	"tcc-investimentos/engine/internal/domain/adminview"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

type fakeAdminCanceller struct {
	cancelErr   error
	cancelledID string
	batchIDs    []string
	batchErr    error
	batchFilter orderexecution.CancelFilter
}

func (f *fakeAdminCanceller) Cancel(_ context.Context, id string) error {
	f.cancelledID = id
	return f.cancelErr
}

func (f *fakeAdminCanceller) CancelBatch(_ context.Context, filter orderexecution.CancelFilter) ([]string, error) {
	f.batchFilter = filter
	return f.batchIDs, f.batchErr
}

func callAdminOrders(t *testing.T, canceller adminOrderCanceller, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var opts []Option
	if canceller != nil {
		opts = append(opts, WithAdminOrderCanceller(canceller))
	}
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, opts...).Handler.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

func TestAdminOrders_RotasRespondem503SemDependencia(t *testing.T) {
	if rec := callAdminReader(t, nil, "/admin/orders"); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("GET /admin/orders sem leitor = %d, want 503", rec.Code)
	}
	for _, path := range []string{"/admin/orders/" + validOrderID + "/cancel", "/admin/orders/cancel-batch"} {
		if rec := callAdminOrders(t, nil, http.MethodPost, path, `{}`); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("POST %s sem serviço = %d, want 503", path, rec.Code)
		}
	}
}

func TestAdminOrders_ListaERepassaOsFiltros(t *testing.T) {
	archetype := "market_maker"
	reason := "admin"
	reader := &fakeAdminReader{total: 3, orders: []adminview.OrderRow{
		{OrderID: "o1", Ticker: "ACME3", UserID: "u1", IsBot: true, Archetype: &archetype, Side: "sell", Type: "limit",
			Quantity: 100, FilledQuantity: 20, Price: 22.2, Status: "cancelled", CancelReason: &reason, SimulatedDay: 7, CreatedAt: time.Unix(0, 0).UTC()},
	}}
	path := "/admin/orders?user_id=" + validUserID + "&asset_id=" + validAssetID + "&side=sell&status=open&from=2026-01-01T00:00:00Z&limit=10&offset=20"
	rec := callAdminReader(t, reader, path)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	f := reader.filter
	if f.UserID != validUserID || f.AssetID != validAssetID || f.Side != "sell" || f.Status != "open" || f.Limit != 10 || f.Offset != 20 || f.From == nil || f.To != nil {
		t.Errorf("filtro repassado = %+v", f)
	}
	var got struct {
		Total  int              `json:"total"`
		Orders []map[string]any `json:"orders"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Total != 3 || len(got.Orders) != 1 || got.Orders[0]["bot_archetype"] != "market_maker" || got.Orders[0]["cancel_reason"] != "admin" {
		t.Errorf("resposta = %+v", got)
	}
}

func TestAdminOrders_RecusaFiltroInvalido(t *testing.T) {
	for _, query := range []string{"user_id=x", "asset_id=x", "side=hold", "status=weird", "from=ontem", "to=amanha", "limit=abc", "offset=-1"} {
		if rec := callAdminReader(t, &fakeAdminReader{}, "/admin/orders?"+query); rec.Code != http.StatusBadRequest {
			t.Errorf("GET /admin/orders?%s = %d, want 400", query, rec.Code)
		}
	}
}

func TestAdminOrders_ListaVaziaEhArrayVazio(t *testing.T) {
	rec := callAdminReader(t, &fakeAdminReader{}, "/admin/orders")
	if !strings.Contains(rec.Body.String(), `"orders":[]`) {
		t.Errorf("corpo = %s, want orders: []", rec.Body)
	}
}

func TestAdminCancelOrder_MapeiaOsErros(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{"sucesso", nil, http.StatusNoContent},
		{"inexistente", orderexecution.ErrOrderNotFound, http.StatusNotFound},
		{"já executada", orderexecution.ErrOrderNotCancellable, http.StatusConflict},
		{"falha de banco", errors.New("boom"), http.StatusInternalServerError},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeAdminCanceller{cancelErr: tt.err}
			rec := callAdminOrders(t, fake, http.MethodPost, "/admin/orders/"+validOrderID+"/cancel", "")
			if rec.Code != tt.want {
				t.Errorf("status = %d, want %d", rec.Code, tt.want)
			}
			if fake.cancelledID != validOrderID {
				t.Errorf("id repassado = %q", fake.cancelledID)
			}
		})
	}
	if rec := callAdminOrders(t, &fakeAdminCanceller{}, http.MethodPost, "/admin/orders/nao-uuid/cancel", ""); rec.Code != http.StatusBadRequest {
		t.Errorf("id inválido = %d, want 400", rec.Code)
	}
}

func TestAdminCancelBatch(t *testing.T) {
	t.Run("cancela e devolve os ids", func(t *testing.T) {
		fake := &fakeAdminCanceller{batchIDs: []string{"a", "b"}}
		rec := callAdminOrders(t, fake, http.MethodPost, "/admin/orders/cancel-batch", `{"asset_id":"`+validAssetID+`"}`)
		if rec.Code != http.StatusOK || fake.batchFilter.AssetID != validAssetID || fake.batchFilter.UserID != "" {
			t.Fatalf("status = %d filtro = %+v", rec.Code, fake.batchFilter)
		}
		if !strings.Contains(rec.Body.String(), `"cancelled_count":2`) {
			t.Errorf("corpo = %s", rec.Body)
		}
	})
	t.Run("lote grande demais devolve 422 com contagem", func(t *testing.T) {
		fake := &fakeAdminCanceller{batchErr: &orderexecution.BatchTooLargeError{Matched: 501, Max: 500}}
		rec := callAdminOrders(t, fake, http.MethodPost, "/admin/orders/cancel-batch", `{"user_id":"`+validUserID+`"}`)
		var got map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &got)
		if rec.Code != http.StatusUnprocessableEntity || got["code"] != "batch_too_large" || got["matched"] != 501.0 || got["max"] != 500.0 {
			t.Errorf("status = %d corpo = %v", rec.Code, got)
		}
	})
	t.Run("filtro vazio devolve 400", func(t *testing.T) {
		fake := &fakeAdminCanceller{batchErr: orderexecution.ErrCancelFilterRequired}
		if rec := callAdminOrders(t, fake, http.MethodPost, "/admin/orders/cancel-batch", `{}`); rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", rec.Code)
		}
	})
	t.Run("corpo e ids inválidos", func(t *testing.T) {
		for _, body := range []string{`nao-json`, `{"asset_id":"x"}`, `{"user_id":"x"}`} {
			if rec := callAdminOrders(t, &fakeAdminCanceller{}, http.MethodPost, "/admin/orders/cancel-batch", body); rec.Code != http.StatusBadRequest {
				t.Errorf("corpo %q = %d, want 400", body, rec.Code)
			}
		}
	})
}
