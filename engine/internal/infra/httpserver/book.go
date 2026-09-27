package httpserver

import (
	"context"
	"net/http"

	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// bookReader é o colaborador que GET /assets/{id}/book precisa (tarefa
// S.5) — implementado por *orderexecution.Service (mesmo que já
// implementa orderSubmitter, injetado em New).
type bookReader interface {
	AssetBook(ctx context.Context, assetID, userID string, depth int) (orderexecution.BookResult, error)
}

// defaultBookDepth é "os N primeiros níveis" do critério de aceite da
// tarefa S.5 — mesmo tratamento de defaultQuoteHistoryDays (assets.go):
// sem critério de aceite fixando um valor, um default razoável.
const defaultBookDepth = 5

type priceLevelResponse struct {
	Price    float64 `json:"price"`
	Quantity int     `json:"quantity"`
}

// toPriceLevelResponses devolve nil (não slice vazio) pra levels vazio, pro
// contrato JSON responder `null` em "lado vazio" (critério de aceite de
// S.5) em vez de `[]`.
func toPriceLevelResponses(levels []orderbook.Level) []priceLevelResponse {
	if len(levels) == 0 {
		return nil
	}
	out := make([]priceLevelResponse, 0, len(levels))
	for _, l := range levels {
		out = append(out, priceLevelResponse{Price: l.Price, Quantity: l.Quantity})
	}
	return out
}

type bookResponse struct {
	IsSandbox bool `json:"is_sandbox"`
	// Price só vem preenchido pra ativo sandbox (preço do roteiro) — os
	// quatro campos de book abaixo ficam todos nulos nesse caso, sandbox
	// nunca teve, nem vai ter, book real (RF12/RNF08).
	Price    *float64             `json:"price"`
	BestBid  *float64             `json:"best_bid"`
	BestAsk  *float64             `json:"best_ask"`
	MidPrice *float64             `json:"mid_price"`
	Bids     []priceLevelResponse `json:"bids"`
	Asks     []priceLevelResponse `json:"asks"`
}

// handleGetAssetBook serve GET /assets/{id}/book (tarefa S.5): melhor
// bid/ask, ponto médio e profundidade agregada nos defaultBookDepth
// primeiros níveis de cada lado — nunca expõe ordem individual nem dono.
// Ativo sandbox devolve só o preço do roteiro (price), sem nenhum campo de
// book (doc de orderexecution.BookResult). user_id (opcional, query) resolve
// o dia do roteiro sandbox específico desse usuário — o backend sempre
// injeta o do token (mesmo padrão de GET /market/calendar); sem ele cai no
// dia 0 do roteiro, mesmo fallback de quem nunca operou esse ativo.
func handleGetAssetBook(catalogReader assetCatalogReader, books bookReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if catalogReader == nil || books == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de book indisponível")
			return
		}

		id := r.PathValue("id")
		_, found, err := catalogReader.FindAssetByID(r.Context(), id)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar ativo")
			return
		}
		if !found {
			writeCatalogError(w, http.StatusNotFound, "ativo não encontrado")
			return
		}

		userID := r.URL.Query().Get("user_id")
		if userID != "" && !uuidPattern.MatchString(userID) {
			writeCatalogError(w, http.StatusBadRequest, "user_id deve ser um UUID válido")
			return
		}

		result, err := books.AssetBook(r.Context(), id, userID, defaultBookDepth)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar book do ativo")
			return
		}

		resp := bookResponse{IsSandbox: result.Sandbox}
		if result.Sandbox {
			resp.Price = &result.SandboxPrice
		} else {
			resp.BestBid = result.Book.BestBid
			resp.BestAsk = result.Book.BestAsk
			resp.MidPrice = result.Book.MidPrice
			resp.Bids = toPriceLevelResponses(result.Book.Bids)
			resp.Asks = toPriceLevelResponses(result.Book.Asks)
		}
		writeJSON(w, http.StatusOK, resp)
	}
}
