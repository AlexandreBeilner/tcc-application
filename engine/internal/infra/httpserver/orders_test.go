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

	cancelErr        error
	cancelledOrderID string
	cancelledUserID  string

	listOrders    []orderexecution.OrderRecord
	listOrdersErr error
	listedUserID  string
}

func (f *fakeOrderSubmitter) Submit(_ context.Context, req orderexecution.Request) (orderexecution.Outcome, error) {
	f.got = req
	return f.outcome, f.err
}

func (f *fakeOrderSubmitter) Cancel(_ context.Context, orderID, userID string) error {
	f.cancelledOrderID = orderID
	f.cancelledUserID = userID
	return f.cancelErr
}

func (f *fakeOrderSubmitter) ListOrders(_ context.Context, userID string) ([]orderexecution.OrderRecord, error) {
	f.listedUserID = userID
	return f.listOrders, f.listOrdersErr
}

func postOrder(t *testing.T, reader catalogReader, orders orderSubmitter, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	New("", nil, reader, nil, orders, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

const validOrderID = "9c858901-8a57-4791-81fe-4c455b099bc9"

func postCancelOrder(t *testing.T, orders orderSubmitter, orderID, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/orders/"+orderID+"/cancel", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, orders, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func getOrders(t *testing.T, orders orderSubmitter, query string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/orders?"+query, nil)
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, orders, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, req)
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
		OrderID:        validOrderID,
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
	// order_id (tarefa O.3, achado 012): resposta ecoa o id que
	// Repository.Persist devolveu, sem ele nenhum cliente descobre qual id
	// passar pra POST /orders/{id}/cancel (O.1).
	if body.OrderID != validOrderID {
		t.Errorf("OrderID = %q, want %q", body.OrderID, validOrderID)
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

// TestHandleSubmitOrder_AtivoSandboxAceito confirma que ativo sandbox de
// renda variável não é mais rejeitado (RF12, tarefa 4.11) — antes desta
// tarefa, is_sandbox = true caía no mesmo 400 de ativo não negociável. O
// preço de referência sourced de sandbox.PriceScript (em vez de
// asset_quotes) só existe no OrderExecutionRepository real
// (order_execution_repository.go) — orderSubmitter aqui é fake, então este
// teste cobre só o portão de aceitação da rota, não o roteiro em si.
func TestHandleSubmitOrder_AtivoSandboxAceito(t *testing.T) {
	reader := &fakeCatalogReader{
		asset:      catalog.AssetRecord{ID: validAssetID, Asset: catalog.Asset{Ticker: "SAND3", Name: "Ação Sandbox", Type: catalog.AssetAcao, IsSandbox: true}},
		assetFound: true,
	}
	submitter := &fakeOrderSubmitter{outcome: orderexecution.Outcome{FilledQuantity: 10, Fills: []orderexecution.Fill{{Price: 100, Quantity: 10}}}}

	rec := postOrder(t, reader, submitter, validOrderBody())
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body.String())
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
		{"ordem pendurada cancelada durante o match", orderexecution.ErrRestingOrderNoLongerAvailable, http.StatusUnprocessableEntity},
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

// TestHandleCancelOrder cobre a tarefa O.1: sucesso devolve 204 e repassa
// orderID (da URL) + userID (do corpo) pro Service.Cancel.
func TestHandleCancelOrder(t *testing.T) {
	submitter := &fakeOrderSubmitter{}

	rec := postCancelOrder(t, submitter, validOrderID, `{"user_id":"`+validUserID+`"}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusNoContent, rec.Body.String())
	}
	if submitter.cancelledOrderID != validOrderID || submitter.cancelledUserID != validUserID {
		t.Errorf("Cancel chamado com (%q, %q), want (%q, %q)", submitter.cancelledOrderID, submitter.cancelledUserID, validOrderID, validUserID)
	}
}

func TestHandleCancelOrder_ValidacaoDeEntrada(t *testing.T) {
	tests := map[string]struct {
		orderID string
		body    string
	}{
		"id da URL não é UUID": {orderID: "não-um-uuid", body: `{"user_id":"` + validUserID + `"}`},
		"json quebrado":        {orderID: validOrderID, body: `{`},
		"user_id não é UUID":   {orderID: validOrderID, body: `{"user_id":"não-um-uuid"}`},
		"user_id ausente":      {orderID: validOrderID, body: `{}`},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			rec := postCancelOrder(t, &fakeOrderSubmitter{}, tt.orderID, tt.body)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
		})
	}
}

// TestHandleCancelOrder_ErrosDeExecucao cobre o mapeamento de
// ErrOrderNotFound (ordem inexistente OU de outro usuário, tarefa O.1) e
// ErrOrderNotCancellable (ordem já filled/cancelled) pro status HTTP certo.
func TestHandleCancelOrder_ErrosDeExecucao(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{"ordem não encontrada ou de outro usuário", orderexecution.ErrOrderNotFound, http.StatusNotFound},
		{"ordem já não está mais pending/partially_filled", orderexecution.ErrOrderNotCancellable, http.StatusConflict},
		{"erro interno inesperado", context.DeadlineExceeded, http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := postCancelOrder(t, &fakeOrderSubmitter{cancelErr: tt.err}, validOrderID, `{"user_id":"`+validUserID+`"}`)
			if rec.Code != tt.want {
				t.Errorf("status = %d, want %d, body = %s", rec.Code, tt.want, rec.Body.String())
			}
		})
	}
}

func TestHandleCancelOrder_SemOrderSubmitter(t *testing.T) {
	rec := postCancelOrder(t, nil, validOrderID, `{"user_id":"`+validUserID+`"}`)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
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

// TestHandleListOrders cobre a tarefa O.3 (achado 012): GET /orders?user_id=
// devolve as ordens do usuário, incluindo cancel_reason só pras que têm.
func TestHandleListOrders(t *testing.T) {
	reason := orderexecution.CancelReasonUserCancelled
	submitter := &fakeOrderSubmitter{listOrders: []orderexecution.OrderRecord{
		{ID: "o1", AssetID: validAssetID, Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10, FilledQuantity: 10, Price: 25, Status: "filled"},
		{ID: "o2", AssetID: validAssetID, Side: orderbook.SideSell, Type: orderbook.TypeLimit, Quantity: 5, FilledQuantity: 0, Price: 30, Status: "cancelled", CancelReason: &reason},
	}}

	rec := getOrders(t, submitter, "user_id="+validUserID)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if submitter.listedUserID != validUserID {
		t.Errorf("ListOrders chamado com userID = %q, want %q", submitter.listedUserID, validUserID)
	}

	var body []orderResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 2 {
		t.Fatalf("len(body) = %d, want 2", len(body))
	}
	if body[0].OrderID != "o1" || body[0].CancelReason != nil {
		t.Errorf("body[0] = %+v, want order_id=o1 sem cancel_reason", body[0])
	}
	if body[1].OrderID != "o2" || body[1].CancelReason == nil || *body[1].CancelReason != "user_cancelled" {
		t.Errorf("body[1] = %+v, want order_id=o2 com cancel_reason=user_cancelled", body[1])
	}
}

func TestHandleListOrders_ListaVazia(t *testing.T) {
	rec := getOrders(t, &fakeOrderSubmitter{}, "user_id="+validUserID)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body []orderResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body) != 0 {
		t.Errorf("len(body) = %d, want 0", len(body))
	}
}

func TestHandleListOrders_UserIDInvalido(t *testing.T) {
	rec := getOrders(t, &fakeOrderSubmitter{}, "user_id=não-um-uuid")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleListOrders_ErroDoRepositorio(t *testing.T) {
	rec := getOrders(t, &fakeOrderSubmitter{listOrdersErr: context.DeadlineExceeded}, "user_id="+validUserID)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleListOrders_SemOrderSubmitter(t *testing.T) {
	rec := getOrders(t, nil, "user_id="+validUserID)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}
