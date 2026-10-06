package httpserver

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"tcc-investimentos/engine/internal/domain/adminexport"
)

// Exportação de dados do painel (tarefa N.21): linhas brutas de ordens e de eventos num
// período, com teto. O CSV é montado pelo backend (que também audita); aqui só JSON.

// adminExporter é o que as rotas precisam — *db.AdminExportRepository.
type adminExporter interface {
	ExportOrders(ctx context.Context, rng adminexport.Range, limit int) ([]adminexport.OrderRow, bool, error)
	ExportEvents(ctx context.Context, rng adminexport.Range, limit int) ([]adminexport.EventRow, bool, error)
}

// WithAdminExport liga as rotas de exportação; sem ela respondem 503.
func WithAdminExport(e adminExporter) Option {
	return func(o *options) { o.exporter = e }
}

// parseExportQuery lê `from`, `to` (RFC 3339) e `limit`. Devolve a mensagem de erro em
// português, vazia se tudo certo.
func parseExportQuery(r *http.Request) (adminexport.Range, int, string) {
	var rng adminexport.Range
	q := r.URL.Query()
	if v := q.Get("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return rng, 0, "from deve ser uma data RFC 3339"
		}
		rng.From = &t
	}
	if v := q.Get("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return rng, 0, "to deve ser uma data RFC 3339"
		}
		rng.To = &t
	}
	if rng.From != nil && rng.To != nil && rng.From.After(*rng.To) {
		return rng, 0, "from não pode ser depois de to"
	}
	limit := 0
	if v := q.Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			return rng, 0, "limit deve ser um inteiro positivo"
		}
		limit = n
	}
	return rng, adminexport.ClampLimit(limit), ""
}

type exportOrderResponse struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id"`
	IsBot          bool      `json:"is_bot"`
	Ticker         string    `json:"ticker"`
	Side           string    `json:"side"`
	Type           string    `json:"type"`
	Quantity       int       `json:"quantity"`
	FilledQuantity int       `json:"filled_quantity"`
	Price          string    `json:"price"`
	Status         string    `json:"status"`
	CancelReason   *string   `json:"cancel_reason"`
	SimulatedDay   int       `json:"simulated_day"`
	CreatedAt      time.Time `json:"created_at"`
}

type exportEventResponse struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	IsBot        bool      `json:"is_bot"`
	Ticker       *string   `json:"ticker"`
	EventType    string    `json:"event_type"`
	Quantity     *int      `json:"quantity"`
	UnitValue    *string   `json:"unit_value"`
	SimulatedDay int       `json:"simulated_day"`
	Timestamp    time.Time `json:"timestamp"`
}

// handleAdminExportOrders serve GET /admin/export/orders.
func handleAdminExportOrders(e adminExporter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if e == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "exportação indisponível")
			return
		}
		rng, limit, problem := parseExportQuery(r)
		if problem != "" {
			writeCatalogError(w, http.StatusBadRequest, problem)
			return
		}
		rows, truncated, err := e.ExportOrders(r.Context(), rng, limit)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao exportar as ordens")
			return
		}
		out := make([]exportOrderResponse, 0, len(rows))
		for _, o := range rows {
			out = append(out, exportOrderResponse{
				ID: o.ID, UserID: o.UserID, IsBot: o.IsBot, Ticker: o.Ticker, Side: o.Side, Type: o.Type, Quantity: o.Quantity,
				FilledQuantity: o.FilledQuantity, Price: o.Price, Status: o.Status, CancelReason: optional(o.CancelReason),
				SimulatedDay: o.SimulatedDay, CreatedAt: o.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"rows": out, "truncated": truncated})
	}
}

// handleAdminExportEvents serve GET /admin/export/events.
func handleAdminExportEvents(e adminExporter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if e == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "exportação indisponível")
			return
		}
		rng, limit, problem := parseExportQuery(r)
		if problem != "" {
			writeCatalogError(w, http.StatusBadRequest, problem)
			return
		}
		rows, truncated, err := e.ExportEvents(r.Context(), rng, limit)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao exportar os eventos")
			return
		}
		out := make([]exportEventResponse, 0, len(rows))
		for _, ev := range rows {
			out = append(out, exportEventResponse{
				ID: ev.ID, UserID: ev.UserID, IsBot: ev.IsBot, Ticker: optional(ev.Ticker), EventType: ev.EventType,
				Quantity: ev.Quantity, UnitValue: ev.UnitValue, SimulatedDay: ev.SimulatedDay, Timestamp: ev.Timestamp,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"rows": out, "truncated": truncated})
	}
}
