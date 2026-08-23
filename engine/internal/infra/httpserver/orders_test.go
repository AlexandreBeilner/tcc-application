package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

const validAssetID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"

type fakeOrderSubmitter struct {
	outcome orderexecution.Outcome
	err     error
	got     orderexecution.Request
}

func (f *fakeOrderSubmitter) Submit(_ context.Context, req orderexecution.Request) (orderexecution.Outcome, error) {
	f.got = req
	return f.outcome, f.err
}

func postOrder(t *testing.T, reader catalogReader, orders orderSubmitter, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	New("", nil, reader, nil, orders, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func tradableAssetReader() *fakeCatalogReader {
	return &fakeCatalogReader{
		asset:      catalog.AssetRecord{ID: validAssetID, Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao}},
		assetFound: true,
	}
}

func validOrderBody() string {
	return `{"user_id":"` + validUserID + `","asset_id":"` + validAssetID + `","side":"buy","type":"market","quantity":10}`
}

func TestHandleSubmitOrder(t *testing.T) {
	submitter := &fakeOrderSubmitter{outcome: orderexecution.Outcome{
		FilledQuantity: 10,
		Fills:          []orderexecution.Fill{{Price: 25, Quantity: 10}},
	}}

	rec := postOrder(t, tradableAssetReader(), submitter, validOrderBody())
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body.String())
	}

	var body submitOrderResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.FilledQuantity != 10 || body.RemainingQuantity != 0 {
		t.Errorf("FilledQuantity/RemainingQuantity = %d/%d, want 10/0", body.FilledQuantity, body.RemainingQuantity)
	}
	if len(body.Fills) != 1 || body.Fills[0].Price != 25 {
		t.Errorf("Fills = %+v, want um fill a 25", body.Fills)
	}

	if submitter.got.UserID != validUserID || submitter.got.AssetID != validAssetID {
		t.Errorf("Submit recebeu req = %+v, user/asset não repassados corretamente", submitter.got)
	}
	if submitter.got.Side != orderbook.SideBuy || submitter.got.Type != orderbook.TypeMarket || submitter.got.Quantity != 10 {
		t.Errorf("Submit recebeu req = %+v, campos de ordem não repassados corretamente", submitter.got)
	}
}

func TestHandleSubmitOrder_ValidacaoDeEntrada(t *testing.T) {
	tests := map[string]string{
		"json quebrado":        `{`,
		"user_id não é UUID":   `{"user_id":"não-um-uuid","asset_id":"` + validAssetID + `","side":"buy","type":"market","quantity":10}`,
		"asset_id não é UUID":  `{"user_id":"` + validUserID + `","asset_id":"não-um-uuid","side":"buy","type":"market","quantity":10}`,
		"side inválido":        `{"user_id":"` + validUserID + `","asset_id":"` + validAssetID + `","side":"hold","type":"market","quantity":10}`,
		"type inválido":        `{"user_id":"` + validUserID + `","asset_id":"` + validAssetID + `","side":"buy","type":"stop","quantity":10}`,
		"quantity zero":        `{"user_id":"` + validUserID + `","asset_id":"` + validAssetID + `","side":"buy","type":"market","quantity":0}`,
		"quantity negativa":    `{"user_id":"` + validUserID + `","asset_id":"` + validAssetID + `","side":"buy","type":"market","quantity":-5}`,
		"limit sem price":      `{"user_id":"` + validUserID + `","asset_id":"` + validAssetID + `","side":"buy","type":"limit","quantity":10}`,
		"limit com price zero": `{"user_id":"` + validUserID + `","asset_id":"` + validAssetID + `","side":"buy","type":"limit","price":0,"quantity":10}`,
	}

	for name, body := range tests {
		t.Run(name, func(t *testing.T) {
			rec := postOrder(t, tradableAssetReader(), &fakeOrderSubmitter{}, body)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
		})
	}
}

func TestHandleSubmitOrder_AtivoNaoEncontrado(t *testing.T) {
	rec := postOrder(t, &fakeCatalogReader{assetFound: false}, &fakeOrderSubmitter{}, validOrderBody())
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandleSubmitOrder_AtivoNaoNegociavel(t *testing.T) {
	tests := map[string]catalog.AssetRecord{
		"renda fixa": {ID: validAssetID, Asset: catalog.Asset{Ticker: "TS-01", Name: "Tesouro Selic", Type: catalog.AssetTesouroSelic}},
		"sandbox":    {ID: validAssetID, Asset: catalog.Asset{Ticker: "VALR3", Name: "Vale ON", Type: catalog.AssetAcao, IsSandbox: true}},
	}

	for name, asset := range tests {
		t.Run(name, func(t *testing.T) {
			reader := &fakeCatalogReader{asset: asset, assetFound: true}
			rec := postOrder(t, reader, &fakeOrderSubmitter{}, validOrderBody())
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
		})
	}
}

func TestHandleSubmitOrder_ErrosDeExecucao(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{"saldo insuficiente", orderexecution.ErrInsufficientBalance, http.StatusUnprocessableEntity},
		{"posição insuficiente", orderexecution.ErrInsufficientPosition, http.StatusUnprocessableEntity},
		{"conta não encontrada", orderexecution.ErrAccountNotFound, http.StatusNotFound},
		{"erro interno inesperado", context.DeadlineExceeded, http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postOrder(t, tradableAssetReader(), &fakeOrderSubmitter{err: tt.err}, validOrderBody())
			if rec.Code != tt.want {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.want, rec.Body.String())
			}
		})
	}
}

func TestHandleSubmitOrder_SemDependencias(t *testing.T) {
	t.Run("sem catalogReader", func(t *testing.T) {
		rec := postOrder(t, nil, &fakeOrderSubmitter{}, validOrderBody())
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
		}
	})

	t.Run("sem orderSubmitter", func(t *testing.T) {
		rec := postOrder(t, tradableAssetReader(), nil, validOrderBody())
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
		}
	})
}
