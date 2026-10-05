package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/botadmin"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// Gestão de bots do painel (tarefa N.1). Mesmo trust boundary de POST /admin/tick:
// o backend valida role = admin antes de repassar.

// adminBotManager é o que as rotas precisam — *botadmin.Service.
type adminBotManager interface {
	List(ctx context.Context) (botadmin.Listing, error)
	Create(ctx context.Context, in botadmin.CreateInput) (botadmin.Bot, error)
	Update(ctx context.Context, accountID string, in botadmin.UpdateInput) (botadmin.Bot, error)
	Fund(ctx context.Context, accountID string, in botadmin.FundingInput) (botadmin.Bot, error)
}

// WithBotAdmin liga as rotas /admin/bots; sem ela respondem 503.
func WithBotAdmin(m adminBotManager) Option {
	return func(o *options) { o.botManager = m }
}

type assetRefResponse struct {
	AssetID string `json:"asset_id"`
	Ticker  string `json:"ticker"`
}

type botHoldingResponse struct {
	AssetID      string  `json:"asset_id"`
	Ticker       string  `json:"ticker"`
	Quantity     int64   `json:"quantity"`
	AveragePrice float64 `json:"average_price"`
}

type botScopeResponse struct {
	Sectors        []string `json:"sectors"`
	RiskClasses    []string `json:"risk_classes"`
	AssetClasses   []string `json:"asset_classes"`
	WithinScopePct float64  `json:"within_scope_pct"`
}

type botRiskProfileResponse struct {
	MaxPositionSizePct    float64 `json:"max_position_size_pct"`
	MarketOrderPreference float64 `json:"market_order_preference"`
	SpreadWidthPct        float64 `json:"spread_width_pct"`
}

type adminBotResponse struct {
	AccountID        string                 `json:"account_id"`
	Archetype        string                 `json:"archetype"`
	IsActive         bool                   `json:"is_active"`
	Cash             float64                `json:"cash"`
	Scope            botScopeResponse       `json:"scope"`
	KnowledgeLevel   *float64               `json:"knowledge_level"`
	RiskProfile      botRiskProfileResponse `json:"risk_profile"`
	MaxCoveredAssets *int                   `json:"max_covered_assets"`
	CoveredAssets    []assetRefResponse     `json:"covered_assets"`
	Holdings         []botHoldingResponse   `json:"holdings"`
}

func toAssetRefResponses(refs []botadmin.AssetRef) []assetRefResponse {
	out := make([]assetRefResponse, 0, len(refs))
	for _, r := range refs {
		out = append(out, assetRefResponse{AssetID: r.AssetID, Ticker: r.Ticker})
	}
	return out
}

func toAdminBotResponse(b botadmin.Bot) adminBotResponse {
	p := b.Personality
	scope := botScopeResponse{Sectors: []string{}, RiskClasses: []string{}, AssetClasses: []string{}, WithinScopePct: p.Scope.WithinScopePct}
	for _, s := range p.Scope.Sectors {
		scope.Sectors = append(scope.Sectors, string(s))
	}
	for _, rc := range p.Scope.RiskClasses {
		scope.RiskClasses = append(scope.RiskClasses, string(rc))
	}
	for _, ac := range p.Scope.AssetClasses {
		scope.AssetClasses = append(scope.AssetClasses, string(ac))
	}
	holdings := make([]botHoldingResponse, 0, len(b.Holdings))
	for _, h := range b.Holdings {
		holdings = append(holdings, botHoldingResponse{AssetID: h.AssetID, Ticker: h.Ticker, Quantity: h.Quantity, AveragePrice: h.AveragePrice})
	}
	return adminBotResponse{
		AccountID: b.AccountID, Archetype: string(p.Archetype), IsActive: b.IsActive, Cash: b.Cash, Scope: scope,
		KnowledgeLevel: p.KnowledgeLevel,
		RiskProfile: botRiskProfileResponse{
			MaxPositionSizePct: p.RiskProfile.MaxPositionSizePct, MarketOrderPreference: p.RiskProfile.MarketOrderPreference,
			SpreadWidthPct: p.RiskProfile.SpreadWidthPct,
		},
		MaxCoveredAssets: p.MaxCoveredAssets, CoveredAssets: toAssetRefResponses(b.Covered), Holdings: holdings,
	}
}

// handleAdminListBots serve GET /admin/bots.
func handleAdminListBots(m adminBotManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "gestão de bots indisponível")
			return
		}
		listing, err := m.List(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao listar os bots")
			return
		}
		bots := make([]adminBotResponse, 0, len(listing.Bots))
		for _, b := range listing.Bots {
			bots = append(bots, toAdminBotResponse(b))
		}
		writeJSON(w, http.StatusOK, map[string]any{"bots": bots, "uncovered_assets": toAssetRefResponses(listing.UncoveredAssets)})
	}
}

type createBotRequest struct {
	Archetype             string   `json:"archetype"`
	Sectors               []string `json:"sectors"`
	RiskClasses           []string `json:"risk_classes"`
	AssetClasses          []string `json:"asset_classes"`
	WithinScopePct        float64  `json:"within_scope_pct"`
	KnowledgeLevel        *float64 `json:"knowledge_level"`
	MaxPositionSizePct    float64  `json:"max_position_size_pct"`
	MarketOrderPreference float64  `json:"market_order_preference"`
	SpreadWidthPct        float64  `json:"spread_width_pct"`
	MaxCoveredAssets      *int     `json:"max_covered_assets"`
	InitialCash           float64  `json:"initial_cash"`
}

func (req createBotRequest) toInput() botadmin.CreateInput {
	in := botadmin.CreateInput{
		Archetype: bot.Archetype(req.Archetype), WithinScopePct: req.WithinScopePct, KnowledgeLevel: req.KnowledgeLevel,
		MaxPositionSizePct: req.MaxPositionSizePct, MarketOrderPreference: req.MarketOrderPreference,
		SpreadWidthPct: req.SpreadWidthPct, MaxCoveredAssets: req.MaxCoveredAssets, InitialCash: req.InitialCash,
	}
	for _, s := range req.Sectors {
		in.Sectors = append(in.Sectors, catalog.Sector(s))
	}
	for _, rc := range req.RiskClasses {
		in.RiskClasses = append(in.RiskClasses, equity.RiskClass(rc))
	}
	for _, ac := range req.AssetClasses {
		in.AssetClasses = append(in.AssetClasses, catalog.AssetType(ac))
	}
	return in
}

// handleAdminCreateBot serve POST /admin/bots.
func handleAdminCreateBot(m adminBotManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "gestão de bots indisponível")
			return
		}
		var req createBotRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		created, err := m.Create(r.Context(), req.toInput())
		if err != nil {
			writeBotAdminError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, toAdminBotResponse(created))
	}
}

type updateBotRequest struct {
	IsActive         *bool     `json:"is_active"`
	MaxCoveredAssets *int      `json:"max_covered_assets"`
	CoveredAssetIDs  *[]string `json:"covered_asset_ids"`
	// Personalidade (N.15). A preferência por ordem a mercado não é aceita (achado 001).
	Sectors            *[]string `json:"sectors"`
	RiskClasses        *[]string `json:"risk_classes"`
	AssetClasses       *[]string `json:"asset_classes"`
	WithinScopePct     *float64  `json:"within_scope_pct"`
	KnowledgeLevel     *float64  `json:"knowledge_level"`
	MaxPositionSizePct *float64  `json:"max_position_size_pct"`
	SpreadWidthPct     *float64  `json:"spread_width_pct"`
}

func (req updateBotRequest) toInput() botadmin.UpdateInput {
	in := botadmin.UpdateInput{
		IsActive: req.IsActive, MaxCoveredAssets: req.MaxCoveredAssets, CoveredAssetIDs: req.CoveredAssetIDs,
		WithinScopePct: req.WithinScopePct, KnowledgeLevel: req.KnowledgeLevel,
		MaxPositionSizePct: req.MaxPositionSizePct, SpreadWidthPct: req.SpreadWidthPct,
	}
	if req.Sectors != nil {
		sectors := make([]catalog.Sector, 0, len(*req.Sectors))
		for _, s := range *req.Sectors {
			sectors = append(sectors, catalog.Sector(s))
		}
		in.Sectors = &sectors
	}
	if req.RiskClasses != nil {
		riskClasses := make([]equity.RiskClass, 0, len(*req.RiskClasses))
		for _, rc := range *req.RiskClasses {
			riskClasses = append(riskClasses, equity.RiskClass(rc))
		}
		in.RiskClasses = &riskClasses
	}
	if req.AssetClasses != nil {
		assetClasses := make([]catalog.AssetType, 0, len(*req.AssetClasses))
		for _, ac := range *req.AssetClasses {
			assetClasses = append(assetClasses, catalog.AssetType(ac))
		}
		in.AssetClasses = &assetClasses
	}
	return in
}

// handleAdminUpdateBot serve PATCH /admin/bots/{id}.
func handleAdminUpdateBot(m adminBotManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "gestão de bots indisponível")
			return
		}
		id := r.PathValue("id")
		if !uuidPattern.MatchString(id) {
			writeCatalogError(w, http.StatusBadRequest, "id deve ser um UUID válido")
			return
		}
		var req updateBotRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		if req.CoveredAssetIDs != nil {
			for _, assetID := range *req.CoveredAssetIDs {
				if !uuidPattern.MatchString(assetID) {
					writeCatalogError(w, http.StatusBadRequest, "covered_asset_ids deve conter só UUIDs válidos")
					return
				}
			}
		}
		updated, err := m.Update(r.Context(), id, req.toInput())
		if err != nil {
			writeBotAdminError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, toAdminBotResponse(updated))
	}
}

type fundingHoldingRequest struct {
	AssetID  string `json:"asset_id"`
	Quantity int64  `json:"quantity"`
}

type fundBotRequest struct {
	Cash     float64                 `json:"cash"`
	Holdings []fundingHoldingRequest `json:"holdings"`
}

// handleAdminFundBot serve POST /admin/bots/{id}/funding.
func handleAdminFundBot(m adminBotManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "gestão de bots indisponível")
			return
		}
		id := r.PathValue("id")
		if !uuidPattern.MatchString(id) {
			writeCatalogError(w, http.StatusBadRequest, "id deve ser um UUID válido")
			return
		}
		var req fundBotRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		in := botadmin.FundingInput{Cash: req.Cash}
		for _, h := range req.Holdings {
			if !uuidPattern.MatchString(h.AssetID) {
				writeCatalogError(w, http.StatusBadRequest, "holdings deve conter só asset_id UUID válido")
				return
			}
			in.Holdings = append(in.Holdings, botadmin.FundingHolding{AssetID: h.AssetID, Quantity: h.Quantity})
		}
		funded, err := m.Fund(r.Context(), id, in)
		if err != nil {
			writeBotAdminError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, toAdminBotResponse(funded))
	}
}

// botValidationErrors são as recusas de regra de domínio (400): personalidade
// inválida, caixa fora da faixa, cobertura fora das regras.
var botValidationErrors = []error{
	bot.ErrUnknownArchetype, bot.ErrEmptySpecializationScope, bot.ErrUnknownSectorInScope,
	bot.ErrUnknownRiskClassInScope, bot.ErrUnknownAssetClassInScope, bot.ErrInvalidWithinScopePct,
	bot.ErrKnowledgeLevelWrongArchetype, bot.ErrMissingKnowledgeLevel, bot.ErrInvalidKnowledgeLevel,
	bot.ErrInvalidMaxPositionSizePct, bot.ErrInvalidMarketOrderPreferencePct, bot.ErrInvalidSpreadWidthPct,
	bot.ErrSpreadWidthAboveMax, bot.ErrInvalidMaxCoveredAssets, bot.ErrMaxCoveredAssetsWrongArchetype,
	botadmin.ErrInvalidInitialCash, botadmin.ErrNothingToUpdate, botadmin.ErrNotMarketMaker,
	botadmin.ErrAssetNotTradable, botadmin.ErrCoverageExceedsLimit, botadmin.ErrDuplicateAssetIDs,
	botadmin.ErrNothingToFund, botadmin.ErrInvalidFundingCash, botadmin.ErrInvalidFundingQuantity,
	botadmin.ErrDuplicateFundingAsset, botadmin.ErrNoQuoteToValue, botadmin.ErrNoOutstandingShares,
}

func writeBotAdminError(w http.ResponseWriter, err error) {
	var tooLarge *orderexecution.BatchTooLargeError
	switch {
	case errors.Is(err, botadmin.ErrBotNotFound):
		writeCatalogError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, botadmin.ErrAssetAlreadyCovered), errors.Is(err, botadmin.ErrFloatCeilingExceeded), errors.Is(err, account.ErrAlreadyExists):
		writeCatalogError(w, http.StatusConflict, err.Error())
	case errors.As(err, &tooLarge):
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{
			"error": err.Error(), "code": "batch_too_large", "matched": tooLarge.Matched, "max": tooLarge.Max,
		})
	case isBotValidationError(err):
		writeCatalogError(w, http.StatusBadRequest, err.Error())
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao processar o bot")
	}
}

func isBotValidationError(err error) bool {
	for _, target := range botValidationErrors {
		if errors.Is(err, target) {
			return true
		}
	}
	return false
}
