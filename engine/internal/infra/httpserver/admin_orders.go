package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"tcc-investimentos/engine/internal/domain/adminview"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// Rotas de ordens do painel (tarefa N.10): consulta e cancelamento por
// intervenção. Mesmo trust boundary de POST /admin/tick: o backend valida
// role = admin antes de repassar.

// adminOrderReader é o que GET /admin/orders precisa — *db.AdminReadRepository.
type adminOrderReader interface {
	AdminOrders(ctx context.Context, filter adminview.OrderFilter) ([]adminview.OrderRow, int, error)
}

// adminOrderCanceller é o que as rotas de cancelamento precisam —
// *orderexecution.AdminService.
type adminOrderCanceller interface {
	Cancel(ctx context.Context, orderID string) error
	CancelBatch(ctx context.Context, filter orderexecution.CancelFilter) ([]string, error)
}

// WithAdminOrderCanceller liga o cancelamento por intervenção; sem ela as duas
// rotas de cancelamento respondem 503.
func WithAdminOrderCanceller(c adminOrderCanceller) Option {
	return func(o *options) { o.orderCanceller = c }
}

type adminOrderResponse struct {
	OrderID        string    `json:"order_id"`
	AssetID        string    `json:"asset_id"`
	Ticker         string    `json:"ticker"`
	UserID         string    `json:"user_id"`
	IsBot          bool      `json:"is_bot"`
	BotArchetype   *string   `json:"bot_archetype"`
	Side           string    `json:"side"`
	Type           string    `json:"type"`
	Quantity       int       `json:"quantity"`
	FilledQuantity int       `json:"filled_quantity"`
	Price          float64   `json:"price"`
	Status         string    `json:"status"`
	CancelReason   *string   `json:"cancel_reason"`
	SimulatedDay   int       `json:"simulated_day"`
	CreatedAt      time.Time `json:"created_at"`
}

var (
	validOrderSides    = map[string]bool{"": true, "buy": true, "sell": true}
	validOrderStatuses = map[string]bool{"": true, "open": true, "pending": true, "partially_filled": true, "filled": true, "cancelled": true}
)

// handleAdminOrders serve GET /admin/orders: busca de ordens por dono, ativo, lado,
// status e período, mais recentes primeiro, paginada.
func handleAdminOrders(reader adminOrderReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if reader == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "leituras do painel indisponíveis")
			return
		}
		filter, message := parseAdminOrderFilter(r)
		if message != "" {
			writeCatalogError(w, http.StatusBadRequest, message)
			return
		}
		rows, total, err := reader.AdminOrders(r.Context(), filter)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar as ordens")
			return
		}
		orders := make([]adminOrderResponse, 0, len(rows))
		for _, row := range rows {
			orders = append(orders, adminOrderResponse{
				OrderID: row.OrderID, AssetID: row.AssetID, Ticker: row.Ticker, UserID: row.UserID,
				IsBot: row.IsBot, BotArchetype: row.Archetype, Side: row.Side, Type: row.Type,
				Quantity: row.Quantity, FilledQuantity: row.FilledQuantity, Price: row.Price,
				Status: row.Status, CancelReason: row.CancelReason, SimulatedDay: row.SimulatedDay, CreatedAt: row.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"orders": orders, "total": total})
	}
}

// parseAdminOrderFilter lê e valida a query de GET /admin/orders. Devolve a
// mensagem de erro (vazia quando válida).
func parseAdminOrderFilter(r *http.Request) (adminview.OrderFilter, string) {
	q := r.URL.Query()
	filter := adminview.OrderFilter{
		UserID: q.Get("user_id"), AssetID: q.Get("asset_id"), Side: q.Get("side"), Status: q.Get("status"),
	}
	if filter.UserID != "" && !uuidPattern.MatchString(filter.UserID) {
		return filter, "user_id deve ser um UUID válido"
	}
	if filter.AssetID != "" && !uuidPattern.MatchString(filter.AssetID) {
		return filter, "asset_id deve ser um UUID válido"
	}
	if !validOrderSides[filter.Side] {
		return filter, `side deve ser "buy" ou "sell"`
	}
	if !validOrderStatuses[filter.Status] {
		return filter, "status deve ser open, pending, partially_filled, filled ou cancelled"
	}
	for name, dest := range map[string]**time.Time{"from": &filter.From, "to": &filter.To} {
		raw := q.Get(name)
		if raw == "" {
			continue
		}
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return filter, name + " deve ser uma data ISO 8601"
		}
		*dest = &t
	}
	for name, dest := range map[string]*int{"limit": &filter.Limit, "offset": &filter.Offset} {
		raw := q.Get(name)
		if raw == "" {
			continue
		}
		n, err := strconv.Atoi(raw)
		if err != nil || n < 0 {
			return filter, name + " deve ser um inteiro não negativo"
		}
		*dest = n
	}
	return filter, ""
}

// handleAdminCancelOrder serve POST /admin/orders/{id}/cancel.
func handleAdminCancelOrder(c adminOrderCanceller) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if c == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de ordens indisponível")
			return
		}
		orderID := r.PathValue("id")
		if !uuidPattern.MatchString(orderID) {
			writeCatalogError(w, http.StatusBadRequest, "id deve ser um UUID válido")
			return
		}
		if err := c.Cancel(r.Context(), orderID); err != nil {
			writeAdminCancelError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

type adminCancelBatchRequest struct {
	AssetID string `json:"asset_id"`
	UserID  string `json:"user_id"`
}

// handleAdminCancelBatch serve POST /admin/orders/cancel-batch: cancela as ordens
// em repouso de um ativo, de um dono ou da interseção dos dois, até o teto.
func handleAdminCancelBatch(c adminOrderCanceller) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if c == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de ordens indisponível")
			return
		}
		var req adminCancelBatchRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		if (req.AssetID != "" && !uuidPattern.MatchString(req.AssetID)) || (req.UserID != "" && !uuidPattern.MatchString(req.UserID)) {
			writeCatalogError(w, http.StatusBadRequest, "asset_id e user_id devem ser UUIDs válidos")
			return
		}
		ids, err := c.CancelBatch(r.Context(), orderexecution.CancelFilter{AssetID: req.AssetID, UserID: req.UserID})
		if err != nil {
			writeAdminCancelError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"cancelled_count": len(ids), "cancelled_ids": ids})
	}
}

func writeAdminCancelError(w http.ResponseWriter, err error) {
	var tooLarge *orderexecution.BatchTooLargeError
	switch {
	case errors.Is(err, orderexecution.ErrOrderNotFound):
		writeCatalogError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, orderexecution.ErrOrderNotCancellable):
		writeCatalogError(w, http.StatusConflict, err.Error())
	case errors.Is(err, orderexecution.ErrCancelFilterRequired):
		writeCatalogError(w, http.StatusBadRequest, err.Error())
	case errors.As(err, &tooLarge):
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{
			"error": err.Error(), "code": "batch_too_large", "matched": tooLarge.Matched, "max": tooLarge.Max,
		})
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao cancelar a ordem")
	}
}
