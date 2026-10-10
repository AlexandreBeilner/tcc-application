package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

func getAssetBook(t *testing.T, reader catalogReader, orders orderSubmitter, assetID, query string) *httptest.ResponseRecorder {
	t.Helper()
	url := "/assets/" + assetID + "/book"
	if query != "" {
		url += "?" + query
	}
	req := httptest.NewRequest(http.MethodGet, url, nil)
	rec := httptest.NewRecorder()
	New("", nil, reader, nil, orders, nil, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

// TestHandleGetAssetBook_MercadoAoVivo cobre a tarefa S.5: melhor bid/ask,
// ponto médio e profundidade agregada, sem nenhum campo de sandbox.
func TestHandleGetAssetBook_MercadoAoVivo(t *testing.T) {
	submitter := &fakeOrderSubmitter{bookResult: orderexecution.BookResult{
		Book: orderbook.BuildSnapshot(
			[]orderbook.Level{{Price: 10, Quantity: 100}},
			[]orderbook.Level{{Price: 10.5, Quantity: 50}},
			5,
		),
	}}

	rec := getAssetBook(t, tradableAssetReader(), submitter, validAssetID, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if submitter.bookAssetID != validAssetID || submitter.bookDepth != defaultBookDepth {
		t.Errorf("AssetBook chamado com (%q, depth=%d), want (%q, depth=%d)", submitter.bookAssetID, submitter.bookDepth, validAssetID, defaultBookDepth)
	}

	var body bookResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.IsSandbox {
		t.Errorf("IsSandbox = true, want false")
	}
	if body.Price != nil {
		t.Errorf("Price = %v, want nil (só sandbox tem preço de roteiro)", body.Price)
	}
	if body.BestBid == nil || *body.BestBid != 10 || body.BestAsk == nil || *body.BestAsk != 10.5 {
		t.Fatalf("BestBid/BestAsk = %v/%v, want 10/10.5", body.BestBid, body.BestAsk)
	}
	if body.MidPrice == nil || *body.MidPrice != 10.25 {
		t.Errorf("MidPrice = %v, want 10.25", body.MidPrice)
	}
	if len(body.Bids) != 1 || body.Bids[0].Price != 10 || body.Bids[0].Quantity != 100 {
		t.Errorf("Bids = %+v, want um nível a 10/100", body.Bids)
	}
}

// TestHandleGetAssetBook_LadoVazioDevolveNulo cobre o critério de aceite
// "lado vazio devolvido como nulo".
func TestHandleGetAssetBook_LadoVazioDevolveNulo(t *testing.T) {
	submitter := &fakeOrderSubmitter{bookResult: orderexecution.BookResult{
		Book: orderbook.BuildSnapshot(nil, []orderbook.Level{{Price: 10.5, Quantity: 50}}, 5),
	}}

	rec := getAssetBook(t, tradableAssetReader(), submitter, validAssetID, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var raw map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&raw); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if v, ok := raw["bids"]; !ok || v != nil {
		t.Errorf(`raw["bids"] = %#v, want nil (JSON null)`, v)
	}
	if v, ok := raw["best_bid"]; !ok || v != nil {
		t.Errorf(`raw["best_bid"] = %#v, want nil (JSON null)`, v)
	}
	if v, ok := raw["mid_price"]; !ok || v != nil {
		t.Errorf(`raw["mid_price"] = %#v, want nil (só um lado disponível)`, v)
	}
}

// TestHandleGetAssetBook_Sandbox cobre "ativo sandbox devolve o preço do
// roteiro sem book".
func TestHandleGetAssetBook_Sandbox(t *testing.T) {
	submitter := &fakeOrderSubmitter{bookResult: orderexecution.BookResult{Sandbox: true, SandboxPrice: 102.5}}

	rec := getAssetBook(t, tradableAssetReader(), submitter, validAssetID, "user_id="+validUserID)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if submitter.bookUserID != validUserID {
		t.Errorf("AssetBook chamado com userID = %q, want %q", submitter.bookUserID, validUserID)
	}

	var body bookResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if !body.IsSandbox {
		t.Fatalf("IsSandbox = false, want true")
	}
	if body.Price == nil || *body.Price != 102.5 {
		t.Fatalf("Price = %v, want 102.5", body.Price)
	}
	if body.BestBid != nil || body.BestAsk != nil || body.MidPrice != nil || body.Bids != nil || body.Asks != nil {
		t.Errorf("book de sandbox devia vir todo nulo, got %+v", body)
	}
}

func TestHandleGetAssetBook_AtivoNaoEncontrado(t *testing.T) {
	rec := getAssetBook(t, &fakeCatalogReader{assetFound: false}, &fakeOrderSubmitter{}, validAssetID, "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHandleGetAssetBook_UserIDInvalido(t *testing.T) {
	rec := getAssetBook(t, tradableAssetReader(), &fakeOrderSubmitter{}, validAssetID, "user_id=não-um-uuid")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleGetAssetBook_ErroDoServico(t *testing.T) {
	rec := getAssetBook(t, tradableAssetReader(), &fakeOrderSubmitter{bookErr: context.DeadlineExceeded}, validAssetID, "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleGetAssetBook_SemServico(t *testing.T) {
	rec := getAssetBook(t, tradableAssetReader(), nil, validAssetID, "")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}
