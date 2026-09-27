package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fixedincome"
	"tcc-investimentos/engine/internal/domain/fixedincomeexecution"
)

// fixedIncomeExecutor é o colaborador que POST /fixed-income/purchases,
// POST /fixed-income/redemptions e GET /fixed-income/simulate precisam —
// implementado por *fixedincomeexecution.Service, injetado em New (tarefa
// 3.13; Simulate desde o teste de ponta a ponta da Fase L, achado do gap
// de VNA do Tesouro IPCA+: Simulate precisa de ipca.Config, que só o
// Service tem — GET /fixed-income/simulate deixou de chamar
// fixedincomeexecution.Simulate direto).
type fixedIncomeExecutor interface {
	Purchase(ctx context.Context, req fixedincomeexecution.Request) (fixedincomeexecution.PurchaseOutcome, error)
	Redeem(ctx context.Context, req fixedincomeexecution.RedeemRequest) (fixedincomeexecution.RedeemOutcome, error)
	Simulate(req fixedincomeexecution.SimulateRequest, ctx fixedincomeexecution.SimulateContext) (fixedincomeexecution.SimulateOutcome, error)
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
	NetValue     float64              `json:"net_value"`
	TaxRate      float64              `json:"tax_rate"`
	MarkToMarket markToMarketResponse `json:"mark_to_market"`
}

// simulateFixedIncomeResponse é a resposta de GET /fixed-income/simulate
// (tarefa 6.0.5) — simulação de aporte sem efeito colateral, sustenta o
// simulador da tela 4.3 e a Calculadora em modo comparação (6.1/6.2).
type simulateFixedIncomeResponse struct {
	UnitPrice           float64 `json:"unit_price"`
	QuantityPurchased   float64 `json:"quantity_purchased"`
	GrossProjectedValue float64 `json:"gross_projected_value"`
	TaxRate             float64 `json:"tax_rate"`
	NetProjectedValue   float64 `json:"net_projected_value"`
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
			NetValue:   outcome.NetValue,
			TaxRate:    outcome.TaxRate,
			MarkToMarket: markToMarketResponse{
				MarkToMarketPrice: outcome.MarkToMarket.MarkToMarketPrice,
				RealizedReturnPct: outcome.MarkToMarket.RealizedReturnPct,
				VsContractedRate:  outcome.MarkToMarket.VsContractedRate,
			},
		})
	}
}

// handleFixedIncomeSimulate serve GET /fixed-income/simulate (tarefa
// 6.0.5) — projeção de retorno de um aporte hipotético, sem gravar nada
// (nenhum market_events, nenhuma escrita em fixed_income_positions/
// accounts): lê o catálogo (mesmo assetCatalogReader dos outros handlers
// deste arquivo) e chama fixedIncomeExecutor.Simulate — desde o teste de
// ponta a ponta da Fase L, não mais a função pura
// fixedincomeexecution.Simulate direto: Tesouro IPCA+ precisa do VNA
// (ipca.Config, que só o *fixedincomeexecution.Service tem, mesma fonte
// de Purchase/Redeem). Diferente de compra/resgate, não recebe user_id —
// a simulação não depende de conta nem posição do usuário.
func handleFixedIncomeSimulate(catalogReader assetCatalogReader, exec fixedIncomeExecutor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if catalogReader == nil || exec == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de simulação de renda fixa indisponível")
			return
		}

		query := r.URL.Query()

		assetID := query.Get("asset_id")
		if !uuidPattern.MatchString(assetID) {
			writeCatalogError(w, http.StatusBadRequest, "asset_id é obrigatório e deve ser um UUID válido")
			return
		}

		amount, err := strconv.ParseFloat(query.Get("amount"), 64)
		if err != nil || amount <= 0 {
			writeCatalogError(w, http.StatusBadRequest, "amount é obrigatório e deve ser um número maior que zero")
			return
		}

		daysHeld, err := strconv.Atoi(query.Get("days_held"))
		if err != nil || daysHeld <= 0 {
			writeCatalogError(w, http.StatusBadRequest, "days_held é obrigatório e deve ser um inteiro maior que zero")
			return
		}

		asset, found, err := catalogReader.FindAssetByID(r.Context(), assetID)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar ativo")
			return
		}
		if !found {
			writeCatalogError(w, http.StatusNotFound, "ativo não encontrado")
			return
		}
		if !fixedIncomeAssetTypes[asset.Type] {
			writeCatalogError(w, http.StatusBadRequest, "simulação só é suportada pra ativo de renda fixa")
			return
		}

		spec, found, err := catalogReader.FindFixedIncomeSpecialization(r.Context(), asset.ID)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar especialização de renda fixa")
			return
		}
		if !found || spec.InterestRate == nil || spec.MaturityDate == nil {
			writeCatalogError(w, http.StatusInternalServerError, "dado de catálogo de renda fixa incompleto")
			return
		}

		today, err := catalogReader.CurrentSimulatedDay(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar dia simulado corrente")
			return
		}

		simCtx := fixedincomeexecution.SimulateContext{
			SimulatedDay:  today,
			AnnualRatePct: *spec.InterestRate,
			MaturityDate:  *spec.MaturityDate,
			TaxExempt:     spec.TaxExempt,
			ProductType:   fixedincome.ProductType(asset.Type),
		}
		// Produto pós-fixado (achado do teste de ponta a ponta da Fase L,
		// nota 3.2 do doc do pacote fixedincomeexecution): precisa da Selic
		// corrente pra projetar fixedincome.PostFixedValue — Prefixado/
		// IPCA+ não pagam essa query (CurrentMarketRatePct fica zero-value,
		// sem uso na branch que Simulate escolhe pra eles).
		if fixedincome.IsPostFixado(simCtx.ProductType) {
			selic, ok, err := catalogReader.CurrentSelicRatePct(r.Context())
			if err != nil {
				writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar Selic simulada corrente")
				return
			}
			if !ok {
				writeCatalogError(w, http.StatusServiceUnavailable, "temporizador ainda não rodou nenhum tick — sem taxa Selic simulada pra projetar produto pós-fixado")
				return
			}
			simCtx.CurrentMarketRatePct = selic
		}

		outcome, err := exec.Simulate(fixedincomeexecution.SimulateRequest{Amount: amount, DaysHeld: daysHeld}, simCtx)
		if err != nil {
			writeCatalogError(w, http.StatusBadRequest, err.Error())
			return
		}

		writeJSON(w, http.StatusOK, simulateFixedIncomeResponse{
			UnitPrice:           outcome.UnitPrice,
			QuantityPurchased:   outcome.QuantityPurchased,
			GrossProjectedValue: outcome.GrossProjectedValue,
			TaxRate:             outcome.TaxRate,
			NetProjectedValue:   outcome.NetProjectedValue,
		})
	}
}

// taxRateResponse é a resposta de GET /fixed-income/tax-rate (tarefa 6.7)
// — expõe só a alíquota de IR regressivo, sem exigir asset_id/amount como
// GET /fixed-income/simulate. Sustenta o modo comparação da Calculadora
// (6.2, lição 3.3 "CDB 110% CDI líquido vs. LCI 90% CDI isento"): os dois
// produtos ali são parâmetros hipotéticos digitados pelo usuário, não um
// ativo real do catálogo (decisão (b) do backlog 6.7) — por isso este
// endpoint, mais barato que .../simulate, não depende de assetCatalogReader.
type taxRateResponse struct {
	TaxRate float64 `json:"tax_rate"`
}

// handleFixedIncomeTaxRate serve GET /fixed-income/tax-rate — função pura
// (fixedincome.RegressiveIncomeTaxRate), sem colaborador nenhum, por isso
// não recebe nenhum parâmetro nem participa da checagem de 503 dos demais
// handlers deste arquivo.
func handleFixedIncomeTaxRate() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		daysHeld, err := strconv.Atoi(r.URL.Query().Get("days_held"))
		if err != nil || daysHeld <= 0 {
			writeCatalogError(w, http.StatusBadRequest, "days_held é obrigatório e deve ser um inteiro maior que zero")
			return
		}

		writeJSON(w, http.StatusOK, taxRateResponse{TaxRate: fixedincome.RegressiveIncomeTaxRate(daysHeld)})
	}
}

func writeFixedIncomePurchaseError(w http.ResponseWriter, err error) {
	if writeMarketClosedIfClosed(w, err) {
		return
	}
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
	if writeMarketClosedIfClosed(w, err) {
		return
	}
	switch {
	case errors.Is(err, fixedincomeexecution.ErrPositionNotFound):
		writeCatalogError(w, http.StatusNotFound, err.Error())
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao processar resgate de renda fixa")
	}
}
