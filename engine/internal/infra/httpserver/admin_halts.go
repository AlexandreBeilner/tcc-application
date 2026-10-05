package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"tcc-investimentos/engine/internal/domain/orderexecution"
	"tcc-investimentos/engine/internal/domain/tradinghalt"
)

// Pausa de negociação (tarefa N.9). As rotas /admin/halts seguem o trust boundary de
// POST /admin/tick (o backend valida role = admin e informa o admin_id); GET
// /market/halts é a leitura pública mínima pro aviso ao usuário.

// tradingHaltManager é o que as rotas precisam — *tradinghalt.Service.
type tradingHaltManager interface {
	Pause(ctx context.Context, scope tradinghalt.Scope, assetID, reason, adminID string) (tradinghalt.Halt, error)
	Lift(ctx context.Context, id, adminID string) (tradinghalt.Halt, error)
	List(ctx context.Context) (tradinghalt.Listing, error)
	Status(ctx context.Context) (tradinghalt.PublicStatus, error)
}

// WithTradingHalts liga as rotas de pausa; sem ela respondem 503.
func WithTradingHalts(m tradingHaltManager) Option {
	return func(o *options) { o.tradingHalts = m }
}

type haltResponse struct {
	ID        string     `json:"id"`
	Scope     string     `json:"scope"`
	AssetID   *string    `json:"asset_id"`
	Ticker    *string    `json:"ticker"`
	Reason    string     `json:"reason"`
	CreatedBy string     `json:"created_by"`
	CreatedAt time.Time  `json:"created_at"`
	LiftedAt  *time.Time `json:"lifted_at"`
	LiftedBy  *string    `json:"lifted_by"`
}

func toHaltResponse(h tradinghalt.Halt) haltResponse {
	return haltResponse{
		ID: h.ID, Scope: string(h.Scope), AssetID: h.AssetID, Ticker: h.Ticker, Reason: h.Reason,
		CreatedBy: h.CreatedBy, CreatedAt: h.CreatedAt, LiftedAt: h.LiftedAt, LiftedBy: h.LiftedBy,
	}
}

func toHaltResponses(halts []tradinghalt.Halt) []haltResponse {
	out := make([]haltResponse, 0, len(halts))
	for _, h := range halts {
		out = append(out, toHaltResponse(h))
	}
	return out
}

// handleAdminListHalts serve GET /admin/halts: pausas vigentes e as últimas encerradas.
func handleAdminListHalts(m tradingHaltManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "pausa de negociação indisponível")
			return
		}
		listing, err := m.List(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao listar as pausas")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"active": toHaltResponses(listing.Active), "recent": toHaltResponses(listing.Recent)})
	}
}

type pauseRequest struct {
	Scope   string `json:"scope"`
	AssetID string `json:"asset_id"`
	Reason  string `json:"reason"`
	AdminID string `json:"admin_id"`
}

// handleAdminPause serve POST /admin/halts: cria a pausa global ou de um ativo.
func handleAdminPause(m tradingHaltManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "pausa de negociação indisponível")
			return
		}
		var req pauseRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		if !uuidPattern.MatchString(req.AdminID) {
			writeCatalogError(w, http.StatusBadRequest, "admin_id é obrigatório e deve ser um UUID válido")
			return
		}
		if req.AssetID != "" && !uuidPattern.MatchString(req.AssetID) {
			writeCatalogError(w, http.StatusBadRequest, "asset_id deve ser um UUID válido")
			return
		}
		halt, err := m.Pause(r.Context(), tradinghalt.Scope(req.Scope), req.AssetID, req.Reason, req.AdminID)
		if err != nil {
			writeHaltError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, toHaltResponse(halt))
	}
}

type liftRequest struct {
	AdminID string `json:"admin_id"`
}

// handleAdminLift serve POST /admin/halts/{id}/lift: retoma a negociação.
func handleAdminLift(m tradingHaltManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "pausa de negociação indisponível")
			return
		}
		id := r.PathValue("id")
		if !uuidPattern.MatchString(id) {
			writeCatalogError(w, http.StatusBadRequest, "id deve ser um UUID válido")
			return
		}
		var req liftRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || !uuidPattern.MatchString(req.AdminID) {
			writeCatalogError(w, http.StatusBadRequest, "admin_id é obrigatório e deve ser um UUID válido")
			return
		}
		halt, err := m.Lift(r.Context(), id, req.AdminID)
		if err != nil {
			writeHaltError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, toHaltResponse(halt))
	}
}

func writeHaltError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, tradinghalt.ErrInvalidScope), errors.Is(err, tradinghalt.ErrAssetRequired),
		errors.Is(err, tradinghalt.ErrAssetNotAllowed), errors.Is(err, tradinghalt.ErrReasonRequired),
		errors.Is(err, tradinghalt.ErrReasonTooLong), errors.Is(err, tradinghalt.ErrAssetNotTradable):
		writeCatalogError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, tradinghalt.ErrAssetNotFound), errors.Is(err, tradinghalt.ErrHaltNotFound):
		writeCatalogError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, tradinghalt.ErrAlreadyHalted), errors.Is(err, tradinghalt.ErrAlreadyLifted):
		writeCatalogError(w, http.StatusConflict, err.Error())
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao processar a pausa")
	}
}

// handleMarketHalts serve GET /market/halts: o que o usuário pode saber da pausa vigente
// (se é global e em quais ativos), nunca o motivo interno nem quem pausou.
func handleMarketHalts(m tradingHaltManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "pausa de negociação indisponível")
			return
		}
		status, err := m.Status(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao ler as pausas")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"global": status.Global, "asset_ids": status.AssetIDs})
	}
}

// writeTradingHaltedIfHalted responde 409 com code trading_halted (tarefa N.9) quando a
// ordem foi barrada por uma pausa de negociação. scope diz se a pausa é global ou do ativo.
func writeTradingHaltedIfHalted(w http.ResponseWriter, err error) bool {
	var halted *orderexecution.TradingHaltedError
	if !errors.As(err, &halted) {
		return false
	}
	scope := "asset"
	if halted.Global {
		scope = "global"
	}
	writeJSON(w, http.StatusConflict, map[string]any{"error": halted.Error(), "code": "trading_halted", "scope": scope})
	return true
}
