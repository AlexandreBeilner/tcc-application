package httpserver

import (
	"context"
	"net/http"

	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/domain/position"
)

// positionLister é o colaborador que GET /positions precisa pra ler
// posições de renda variável — implementado por *db.AccountRepository,
// injetado em New (tarefa 4.7).
type positionLister interface {
	ListPositionsByUser(ctx context.Context, userID string) ([]position.Record, error)
}

// fixedIncomePositionLister é o colaborador que GET /fixed-income/positions
// precisa pra ler posições de renda fixa — implementado por
// *db.AccountRepository, injetado em New (tarefa 4.7).
type fixedIncomePositionLister interface {
	ListFixedIncomePositionsByUser(ctx context.Context, userID string) ([]fixedincomeposition.Record, error)
}

type positionResponse struct {
	AssetID           string  `json:"asset_id"`
	Ticker            string  `json:"ticker"`
	Name              string  `json:"name"`
	Type              string  `json:"type"`
	IsSandbox         bool    `json:"is_sandbox"`
	Quantity          int     `json:"quantity"`
	AveragePrice      float64 `json:"average_price"`
	DividendsReceived float64 `json:"dividends_received"`
}

type userFixedIncomePositionResponse struct {
	AssetID      string  `json:"asset_id"`
	Ticker       string  `json:"ticker"`
	Name         string  `json:"name"`
	Type         string  `json:"type"`
	IsSandbox    bool    `json:"is_sandbox"`
	Quantity     float64 `json:"quantity"`
	AveragePrice float64 `json:"average_price"`
	AverageRate  float64 `json:"average_rate"`
	// CurrentValue (bruto de IR) e NetValue (líquido, o que o resgate creditaria hoje) só vêm com
	// ?valuation=true e fora do sandbox. Ausentes quando a avaliação falhou: quem lê cai no custo.
	CurrentValue *float64 `json:"current_value,omitempty"`
	NetValue     *float64 `json:"net_value,omitempty"`
}

// requireUserIDParam lê ?user_id= da query string e valida como UUID —
// reaproveitado pelos dois handlers deste arquivo (mesmo formato de erro já
// usado pelo corpo de POST /fixed-income/purchases|redemptions).
func requireUserIDParam(w http.ResponseWriter, r *http.Request) (string, bool) {
	userID := r.URL.Query().Get("user_id")
	if !uuidPattern.MatchString(userID) {
		writeCatalogError(w, http.StatusBadRequest, "user_id é obrigatório e deve ser um UUID válido")
		return "", false
	}
	return userID, true
}

// handleListPositions serve GET /positions?user_id= — posições de renda
// variável do usuário, cada uma já enriquecida com ticker/nome/tipo do
// ativo (tarefa 4.7) e is_sandbox (tarefa 4.11, RF12 — distingue posição de
// sandbox da de Mercado Ao Vivo, tela 2.1). Lista vazia (não erro) pra
// usuário sem posição nenhuma.
func handleListPositions(positions positionLister) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if positions == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de posições indisponível")
			return
		}

		userID, ok := requireUserIDParam(w, r)
		if !ok {
			return
		}

		records, err := positions.ListPositionsByUser(r.Context(), userID)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar posições")
			return
		}

		resp := make([]positionResponse, 0, len(records))
		for _, rec := range records {
			resp = append(resp, positionResponse{
				AssetID:           rec.AssetID,
				Ticker:            rec.AssetTicker,
				Name:              rec.AssetName,
				Type:              rec.AssetType,
				IsSandbox:         rec.IsSandbox,
				Quantity:          rec.Quantity,
				AveragePrice:      rec.AveragePrice,
				DividendsReceived: rec.DividendsReceived,
			})
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// handleListFixedIncomePositions serve GET /fixed-income/positions?user_id=
// — mesmo padrão de handleListPositions, pra fixed_income_positions,
// incluindo average_rate (tarefa 4.7) e is_sandbox (tarefa 4.11). Com ?valuation=true cada
// posição de Mercado Ao Vivo ganha current_value/net_value (valor de hoje pela mesma conta do
// resgate); fica opt-in porque custa uma consulta por posição.
func handleListFixedIncomePositions(positions fixedIncomePositionLister, valuer fixedIncomeExecutor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if positions == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de posições indisponível")
			return
		}

		userID, ok := requireUserIDParam(w, r)
		if !ok {
			return
		}

		records, err := positions.ListFixedIncomePositionsByUser(r.Context(), userID)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar posições de renda fixa")
			return
		}

		withValuation := r.URL.Query().Get("valuation") == "true" && valuer != nil
		resp := make([]userFixedIncomePositionResponse, 0, len(records))
		for _, rec := range records {
			item := userFixedIncomePositionResponse{
				AssetID:      rec.AssetID,
				Ticker:       rec.AssetTicker,
				Name:         rec.AssetName,
				Type:         rec.AssetType,
				IsSandbox:    rec.IsSandbox,
				Quantity:     rec.Quantity,
				AveragePrice: rec.AveragePrice,
				AverageRate:  rec.AverageRate,
			}
			if withValuation && !rec.IsSandbox {
				if outcome, err := valuer.Value(r.Context(), userID, rec.AssetID); err == nil {
					item.CurrentValue = &outcome.TotalValue
					item.NetValue = &outcome.NetValue
				}
			}
			resp = append(resp, item)
		}
		writeJSON(w, http.StatusOK, resp)
	}
}
