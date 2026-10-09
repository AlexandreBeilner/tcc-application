package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"tcc-investimentos/engine/internal/domain/assetprovision"
	"tcc-investimentos/engine/internal/domain/catalog"
)

// Cadastro de ativo novo pelo painel (tarefa N.13). Mesmo trust boundary de POST /admin/tick: o
// backend valida role = admin e informa o admin_id.

// assetProvisioner é o que as rotas precisam — *assetprovision.Service.
type assetProvisioner interface {
	Preview(ctx context.Context, spec assetprovision.Spec) (assetprovision.Preview, error)
	Create(ctx context.Context, spec assetprovision.Spec) (assetprovision.Result, error)
}

// WithAssetProvision liga as rotas de cadastro; sem ela respondem 503.
func WithAssetProvision(p assetProvisioner) Option {
	return func(o *options) { o.assetProvision = p }
}

type holdingRequest struct {
	Ticker    string  `json:"ticker"`
	WeightPct float64 `json:"weight_pct"`
}

type createAssetRequest struct {
	Kind              string           `json:"kind"`
	Ticker            string           `json:"ticker"`
	Name              string           `json:"name"`
	CompanyName       string           `json:"company_name"`
	CNPJ              string           `json:"cnpj"`
	Sector            string           `json:"sector"`
	OutstandingShares int64            `json:"outstanding_shares"`
	BaseGrowthPct     float64          `json:"base_growth_pct"`
	QualityMultiplier float64          `json:"quality_multiplier"`
	Segment           string           `json:"segment"`
	VacancyRate       float64          `json:"vacancy_rate"`
	Indexador         string           `json:"indexador"`
	BenchmarkIndex    string           `json:"benchmark_index"`
	Methodology       string           `json:"methodology"`
	Holdings          []holdingRequest `json:"holdings"`
	AdminID           string           `json:"admin_id"`
}

func (r createAssetRequest) spec() assetprovision.Spec {
	holdings := make([]assetprovision.HoldingSpec, 0, len(r.Holdings))
	for _, h := range r.Holdings {
		holdings = append(holdings, assetprovision.HoldingSpec{Ticker: h.Ticker, WeightPct: h.WeightPct})
	}
	return assetprovision.Spec{
		Kind: assetprovision.Kind(r.Kind), Ticker: r.Ticker, Name: r.Name, CompanyName: r.CompanyName, CNPJ: r.CNPJ,
		Sector: catalog.Sector(r.Sector), OutstandingShares: r.OutstandingShares, BaseGrowthPct: r.BaseGrowthPct,
		QualityMultiplier: r.QualityMultiplier, Segment: r.Segment, VacancyRate: r.VacancyRate, Indexador: r.Indexador,
		BenchmarkIndex: r.BenchmarkIndex, Methodology: r.Methodology, Holdings: holdings,
	}
}

type poolPreviewResponse struct {
	PoolBefore         int    `json:"pool_before"`
	PoolAfter          int    `json:"pool_after"`
	NewBots            int    `json:"new_bots"`
	MarketMakerShares  int64  `json:"market_maker_shares"`
	BotShares          int64  `json:"bot_shares"`
	MarketMakerID      string `json:"market_maker_id"`
	CreatesMarketMaker bool   `json:"creates_market_maker"`
}

type assetPreviewResponse struct {
	Kind              string               `json:"kind"`
	Ticker            string               `json:"ticker"`
	Name              string               `json:"name"`
	OutstandingShares *int64               `json:"outstanding_shares"`
	Pool              *poolPreviewResponse `json:"pool"`
}

func toAssetPreviewResponse(p assetprovision.Preview) assetPreviewResponse {
	resp := assetPreviewResponse{Kind: string(p.Kind), Ticker: p.Ticker, Name: p.Name, OutstandingShares: p.OutstandingShares}
	if p.Pool != nil {
		resp.Pool = &poolPreviewResponse{
			PoolBefore: p.Pool.PoolBefore, PoolAfter: p.Pool.PoolAfter, NewBots: p.Pool.NewBots,
			MarketMakerShares: p.Pool.MarketMakerShares, BotShares: p.Pool.BotShares,
			MarketMakerID: p.Pool.MarketMakerID, CreatesMarketMaker: p.Pool.CreatesMarketMaker,
		}
	}
	return resp
}

func decodeCreateAsset(w http.ResponseWriter, r *http.Request, requireAdmin bool) (createAssetRequest, bool) {
	var req createAssetRequest
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<16))
	if err != nil || json.Unmarshal(body, &req) != nil {
		writeCatalogError(w, http.StatusBadRequest, "corpo inválido")
		return req, false
	}
	if requireAdmin && !uuidPattern.MatchString(req.AdminID) {
		writeCatalogError(w, http.StatusBadRequest, "admin_id é obrigatório e deve ser um UUID válido")
		return req, false
	}
	return req, true
}

func writeProvisionError(w http.ResponseWriter, err error) {
	var ve *assetprovision.ValidationError
	var ce *assetprovision.ConflictError
	switch {
	case errors.As(err, &ve):
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"error": ve.Message, "field": ve.Field})
	case errors.As(err, &ce):
		writeCatalogError(w, http.StatusConflict, ce.Message)
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao cadastrar o ativo")
	}
}

// handleAdminCatalogPreview serve POST /admin/catalog/preview: valida o pedido e devolve o que
// o cadastro criaria (bots novos, Market Maker que cobre, float distribuído), sem gravar nada.
func handleAdminCatalogPreview(p assetProvisioner) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if p == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "cadastro de ativos indisponível")
			return
		}
		req, ok := decodeCreateAsset(w, r, false)
		if !ok {
			return
		}
		preview, err := p.Preview(r.Context(), req.spec())
		if err != nil {
			writeProvisionError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, toAssetPreviewResponse(preview))
	}
}

// handleAdminCatalogCreate serve POST /admin/catalog: cadastra o ativo e provisiona bots e
// cobertura. Se o catálogo gravou mas a etapa dos bots falhou, devolve 500 com o asset_id: o ativo
// existe e aparece sem cobertura no painel de bots.
func handleAdminCatalogCreate(p assetProvisioner) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if p == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "cadastro de ativos indisponível")
			return
		}
		req, ok := decodeCreateAsset(w, r, true)
		if !ok {
			return
		}
		result, err := p.Create(r.Context(), req.spec())
		if err != nil {
			var ve *assetprovision.ValidationError
			var ce *assetprovision.ConflictError
			if result.AssetID != "" && !errors.As(err, &ve) && !errors.As(err, &ce) {
				writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error(), "asset_id": result.AssetID})
				return
			}
			writeProvisionError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]any{"asset_id": result.AssetID, "preview": toAssetPreviewResponse(result.Preview)})
	}
}
