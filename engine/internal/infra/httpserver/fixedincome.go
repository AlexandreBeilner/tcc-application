package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fixedincomeexecution"
)

// fixedIncomeExecutor é o colaborador que POST /fixed-income/purchases e
// POST /fixed-income/redemptions precisam pra processar compra/resgate —
// implementado por *fixedincomeexecution.Service, injetado em New (tarefa
// 3.13).
type fixedIncomeExecutor interface {
	Purchase(ctx context.Context, req fixedincomeexecution.Request) (fixedincomeexecution.PurchaseOutcome, error)
	Redeem(ctx context.Context, req fixedincomeexecution.RedeemRequest) (fixedincomeexecution.RedeemOutcome, error)
}

// fixedIncomeAssetTypes são os únicos tipos de ativo que passam por essas
// rotas — o inverso de tradableAssetTypes (orders.go): renda variável tem
// fluxo próprio, fora do escopo desta tarefa. Ativo sandbox
// (`is_sandbox = true`) de um desses 8 tipos é aceito normalmente desde a
// tarefa 4.11 — só a taxa contratada/de mercado muda de fonte
// (sandbox.RateScript em vez de fixed_income_assets.interest_rate/
// market_calendar.selic_rate, fixed_income_execution_repository.go), a
// rota e as fórmulas continuam as mesmas.
var fixedIncomeAssetTypes = map[catalog.AssetType]bool{
	catalog.AssetTesouroSelic:     true,
	catalog.AssetTesouroPrefixado: true,
	catalog.AssetTesouroIPCA:      true,
	catalog.AssetCDB:              true,
	catalog.AssetLCI:              true,
	catalog.AssetLCA:              true,
	catalog.AssetCRI:              true,
	catalog.AssetCRA:              true,
}

type purchaseFixedIncomeRequest struct {
	UserID  string  `json:"user_id"`
	AssetID string  `json:"asset_id"`
	Amount  float64 `json:"amount"`
}

type fixedIncomePositionResponse struct {
	Quantity     float64 `json:"quantity"`
	AveragePrice float64 `json:"average_price"`
	AverageRate  float64 `json:"average_rate"`
}

type purchaseFixedIncomeResponse struct {
	UnitPrice         float64                     `json:"unit_price"`
	QuantityPurchased float64                     `json:"quantity_purchased"`
	Position          fixedIncomePositionResponse `json:"position"`
}

type redeemFixedIncomeRequest struct {
	UserID  string `json:"user_id"`
	AssetID string `json:"asset_id"`
}

type markToMarketResponse struct {
	MarkToMarketPrice float64 `json:"mark_to_market_price"`
	RealizedReturnPct float64 `json:"realized_return_pct"`
	VsContractedRate  float64 `json:"vs_contracted_rate"`
}

type redeemFixedIncomeResponse struct {
	TotalValue   float64              `json:"total_value"`
	MarkToMarket markToMarketResponse `json:"mark_to_market"`
}

func handleFixedIncomePurchase(catalogReader assetCatalogReader, exec fixedIncomeExecutor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if catalogReader == nil || exec == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de compra de renda fixa indisponível")
			return
		}

		var req purchaseFixedIncomeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		if !uuidPattern.MatchString(req.UserID) || !uuidPattern.MatchString(req.AssetID) {
			writeCatalogError(w, http.StatusBadRequest, "user_id e asset_id são obrigatórios e devem ser UUIDs válidos")
			return
		}
		if req.Amount <= 0 {
			writeCatalogError(w, http.StatusBadRequest, "amount deve ser maior que zero")
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
		if !fixedIncomeAssetTypes[asset.Type] {
			writeCatalogError(w, http.StatusBadRequest, "compra só é suportada pra ativo de renda fixa")
			return
		}

		outcome, err := exec.Purchase(r.Context(), fixedincomeexecution.Request{
			UserID:  req.UserID,
			AssetID: req.AssetID,
			Amount:  req.Amount,
		})
		if err != nil {
			writeFixedIncomePurchaseError(w, err)
			return
		}

		writeJSON(w, http.StatusCreated, purchaseFixedIncomeResponse{
			UnitPrice:         outcome.UnitPrice,
			QuantityPurchased: outcome.QuantityPurchased,
			Position: fixedIncomePositionResponse{
				Quantity:     outcome.NewPosition.Quantity,
				AveragePrice: outcome.NewPosition.AveragePrice,
				AverageRate:  outcome.NewPosition.AverageRate,
			},
		})
	}
}

func handleFixedIncomeRedemption(catalogReader assetCatalogReader, exec fixedIncomeExecutor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if catalogReader == nil || exec == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de resgate de renda fixa indisponível")
			return
		}

		var req redeemFixedIncomeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		if !uuidPattern.MatchString(req.UserID) || !uuidPattern.MatchString(req.AssetID) {
			writeCatalogError(w, http.StatusBadRequest, "user_id e asset_id são obrigatórios e devem ser UUIDs válidos")
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
		if !fixedIncomeAssetTypes[asset.Type] {
			writeCatalogError(w, http.StatusBadRequest, "resgate só é suportado pra ativo de renda fixa")
			return
		}

		outcome, err := exec.Redeem(r.Context(), fixedincomeexecution.RedeemRequest{
			UserID:  req.UserID,
			AssetID: req.AssetID,
		})
		if err != nil {
			writeFixedIncomeRedemptionError(w, err)
			return
		}

		writeJSON(w, http.StatusOK, redeemFixedIncomeResponse{
			TotalValue: outcome.TotalValue,
			MarkToMarket: markToMarketResponse{
				MarkToMarketPrice: outcome.MarkToMarket.MarkToMarketPrice,
				RealizedReturnPct: outcome.MarkToMarket.RealizedReturnPct,
				VsContractedRate:  outcome.MarkToMarket.VsContractedRate,
			},
		})
	}
}

func writeFixedIncomePurchaseError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, fixedincomeexecution.ErrInvalidAmount):
		writeCatalogError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, fixedincomeexecution.ErrBelowMinimumInvestment), errors.Is(err, fixedincomeexecution.ErrInsufficientBalance):
		writeCatalogError(w, http.StatusUnprocessableEntity, err.Error())
	case errors.Is(err, fixedincomeexecution.ErrAccountNotFound):
		writeCatalogError(w, http.StatusNotFound, err.Error())
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao processar compra de renda fixa")
	}
}

func writeFixedIncomeRedemptionError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, fixedincomeexecution.ErrPositionNotFound):
		writeCatalogError(w, http.StatusNotFound, err.Error())
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao processar resgate de renda fixa")
	}
}
