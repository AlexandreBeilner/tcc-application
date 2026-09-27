package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// orderSubmitter é o colaborador que POST /orders precisa pra processar
// uma ordem recebida — implementado por *orderexecution.Service, injetado
// em New (tarefa 3.12).
type orderSubmitter interface {
	SubmitByUser(ctx context.Context, req orderexecution.Request) (orderexecution.Outcome, error)
	// Cancel marca como cancelled a ordem orderID de userID (tarefa O.1) —
	// implementado pelo mesmo *orderexecution.Service que já implementa
	// Submit, então não precisa de uma interface/parâmetro novo em New/Run.
	Cancel(ctx context.Context, orderID, userID string) error
	// ListOrders devolve todas as ordens de userID (tarefa O.3, GET
	// /orders) — mesmo *orderexecution.Service acima, idem.
	ListOrders(ctx context.Context, userID string) ([]orderexecution.OrderRecord, error)
}

// tradableAssetTypes são os únicos tipos de ativo que passam por matching
// de book — renda fixa (compra/resgate) tem fluxo próprio, fora do escopo
// desta rota (3.13). Ativo sandbox (`is_sandbox = true`) de um desses três
// tipos é aceito normalmente desde a tarefa 4.11 — só o preço de referência
// muda de fonte (sandbox.PriceScript em vez de asset_quotes,
// order_execution_repository.go), a rota e o matching continuam os mesmos.
var tradableAssetTypes = map[catalog.AssetType]bool{
	catalog.AssetAcao: true,
	catalog.AssetETF:  true,
	catalog.AssetFII:  true,
}

type submitOrderRequest struct {
	UserID   string  `json:"user_id"`
	AssetID  string  `json:"asset_id"`
	Side     string  `json:"side"`
	Type     string  `json:"type"`
	Price    float64 `json:"price,omitempty"`
	Quantity int     `json:"quantity"`
}

type fillResponse struct {
	Price     float64 `json:"price"`
	Quantity  int     `json:"quantity"`
	Synthetic bool    `json:"synthetic"`
}

type submitOrderResponse struct {
	// OrderID é o id da linha recém-criada em order_book (tarefa O.3,
	// achado 012) — antes desta tarefa a resposta nunca ecoava o id, então
	// POST /orders/{id}/cancel (O.1) não tinha nenhum caminho real pelo
	// qual um cliente descobrisse qual id passar.
	OrderID           string         `json:"order_id"`
	FilledQuantity    int            `json:"filled_quantity"`
	RemainingQuantity int            `json:"remaining_quantity"`
	Fills             []fillResponse `json:"fills"`
}

// handleSubmitOrder serve POST /orders — orquestra orderbook.Book (3.2)
// com persistência real e Event Sourcing (tarefa 3.12). catalogReader
// valida que o ativo existe e é negociável por essa rota antes de chamar
// orders.Submit; a validação de saldo/posição acontece dentro dele
// (orderexecution.Execute).
func handleSubmitOrder(catalogReader assetCatalogReader, orders orderSubmitter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if catalogReader == nil || orders == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de execução de ordens indisponível")
			return
		}

		var req submitOrderRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		if !uuidPattern.MatchString(req.UserID) || !uuidPattern.MatchString(req.AssetID) {
			writeCatalogError(w, http.StatusBadRequest, "user_id e asset_id são obrigatórios e devem ser UUIDs válidos")
			return
		}

		side := orderbook.Side(req.Side)
		if side != orderbook.SideBuy && side != orderbook.SideSell {
			writeCatalogError(w, http.StatusBadRequest, `side deve ser "buy" ou "sell"`)
			return
		}
		orderType := orderbook.Type(req.Type)
		if orderType != orderbook.TypeMarket && orderType != orderbook.TypeLimit {
			writeCatalogError(w, http.StatusBadRequest, `type deve ser "market" ou "limit"`)
			return
		}
		if req.Quantity <= 0 {
			writeCatalogError(w, http.StatusBadRequest, "quantity deve ser maior que zero")
			return
		}
		if orderType == orderbook.TypeLimit && req.Price <= 0 {
			writeCatalogError(w, http.StatusBadRequest, "price é obrigatório e deve ser maior que zero para ordem limitada")
			return
		}

		asset, found, err := catalogReader.FindAssetByID(r.Context(), req.AssetID)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar ativo")
			return
		}
		if !found {
			writeCatalogError(w, http.StatusNotFound, "ativo não encontrado")
			return
		}
		if !tradableAssetTypes[asset.Type] {
			writeCatalogError(w, http.StatusBadRequest, "execução de ordem só é suportada pra ativo de renda variável (ação, ETF, FII)")
			return
		}

		outcome, err := orders.SubmitByUser(r.Context(), orderexecution.Request{
			UserID:   req.UserID,
			AssetID:  req.AssetID,
			Side:     side,
			Type:     orderType,
			Price:    req.Price,
			Quantity: req.Quantity,
		})
		if err != nil {
			writeOrderExecutionError(w, err)
			return
		}

		fills := make([]fillResponse, 0, len(outcome.Fills))
		for _, f := range outcome.Fills {
			fills = append(fills, fillResponse{Price: f.Price, Quantity: f.Quantity, Synthetic: f.IsSynthetic()})
		}
		writeJSON(w, http.StatusCreated, submitOrderResponse{
			OrderID:           outcome.OrderID,
			FilledQuantity:    outcome.FilledQuantity,
			RemainingQuantity: outcome.RemainingQuantity,
			Fills:             fills,
		})
	}
}

func writeOrderExecutionError(w http.ResponseWriter, err error) {
	if writeMarketClosedIfClosed(w, err) {
		return
	}
	switch {
	case errors.Is(err, orderexecution.ErrInsufficientBalance), errors.Is(err, orderexecution.ErrInsufficientPosition),
		errors.Is(err, orderexecution.ErrRestingOrderNoLongerAvailable):
		writeCatalogError(w, http.StatusUnprocessableEntity, err.Error())
	case errors.Is(err, orderexecution.ErrInvalidQuantity), errors.Is(err, orderexecution.ErrInvalidPrice):
		writeCatalogError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, orderexecution.ErrAccountNotFound), errors.Is(err, orderexecution.ErrOrderNotFound):
		writeCatalogError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, orderexecution.ErrOrderNotCancellable):
		writeCatalogError(w, http.StatusConflict, err.Error())
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao executar ordem")
	}
}

type cancelOrderRequest struct {
	UserID string `json:"user_id"`
}

// handleCancelOrder serve POST /orders/{id}/cancel (tarefa O.1) — user_id
// vem do corpo, mesmo trust boundary de handleSubmitOrder (o motor não
// autentica ninguém; confia que o backend já validou o dono do token antes
// de repassar). filled_quantity já executado não é revertido — só a
// quantidade ainda não preenchida deixa de estar sujeita a execução
// futura (doc do pacote orderexecution, decisão de escopo da tarefa A.2).
func handleCancelOrder(orders orderSubmitter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if orders == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de execução de ordens indisponível")
			return
		}

		orderID := r.PathValue("id")
		if !uuidPattern.MatchString(orderID) {
			writeCatalogError(w, http.StatusBadRequest, "id deve ser um UUID válido")
			return
		}

		var req cancelOrderRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		if !uuidPattern.MatchString(req.UserID) {
			writeCatalogError(w, http.StatusBadRequest, "user_id é obrigatório e deve ser um UUID válido")
			return
		}

		if err := orders.Cancel(r.Context(), orderID, req.UserID); err != nil {
			writeOrderExecutionError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

type orderResponse struct {
	OrderID        string    `json:"order_id"`
	AssetID        string    `json:"asset_id"`
	Side           string    `json:"side"`
	Type           string    `json:"type"`
	Quantity       int       `json:"quantity"`
	FilledQuantity int       `json:"filled_quantity"`
	Price          float64   `json:"price"`
	Status         string    `json:"status"`
	CancelReason   *string   `json:"cancel_reason,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// handleListOrders serve GET /orders?user_id= (tarefa O.3) — todas as
// ordens do usuário, mais recente primeiro, sem paginação (escopo de
// protótipo) nem filtro de status: o agrupamento em Pendentes/Executadas/
// Recusadas (O.4) é responsabilidade do frontend. Fecha o achado 012 —
// antes desta rota, POST /orders/{id}/cancel (O.1) não tinha nenhum
// caminho real pelo qual um cliente descobrisse qual id de ordem passar
// depois de um reload de página.
func handleListOrders(orders orderSubmitter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if orders == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de execução de ordens indisponível")
			return
		}

		userID, ok := requireUserIDParam(w, r)
		if !ok {
			return
		}

		records, err := orders.ListOrders(r.Context(), userID)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar ordens")
			return
		}

		resp := make([]orderResponse, 0, len(records))
		for _, rec := range records {
			var cancelReason *string
			if rec.CancelReason != nil {
				reason := string(*rec.CancelReason)
				cancelReason = &reason
			}
			resp = append(resp, orderResponse{
				OrderID:        rec.ID,
				AssetID:        rec.AssetID,
				Side:           string(rec.Side),
				Type:           string(rec.Type),
				Quantity:       rec.Quantity,
				FilledQuantity: rec.FilledQuantity,
				Price:          rec.Price,
				Status:         rec.Status,
				CancelReason:   cancelReason,
				CreatedAt:      rec.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, resp)
	}
}
