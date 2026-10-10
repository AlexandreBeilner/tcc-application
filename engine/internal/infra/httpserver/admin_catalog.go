package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/catalogadmin"
)

// Catálogo de ativos no painel (tarefa N.12). Mesmo trust boundary de POST /admin/tick: o
// backend valida role = admin e informa o admin_id.

// catalogAdminManager é o que as rotas precisam — *catalogadmin.Service.
type catalogAdminManager interface {
	List(ctx context.Context) ([]catalogadmin.Entry, error)
	Update(ctx context.Context, assetID string, patch catalogadmin.Patch) (catalogadmin.Entry, error)
}

// WithCatalogAdmin liga as rotas /admin/catalog; sem ela respondem 503.
func WithCatalogAdmin(m catalogAdminManager) Option {
	return func(o *options) { o.catalogAdmin = m }
}

type catalogCompanyResponse struct {
	CompanyID           string  `json:"company_id"`
	Name                string  `json:"name"`
	Sector              string  `json:"sector"`
	ReportFrequencyDays int     `json:"report_frequency_days"`
	BaseGrowthPct       float64 `json:"base_growth_pct"`
	QualityMultiplier   float64 `json:"quality_multiplier"`
}

type catalogHoldingResponse struct {
	Name      string  `json:"name"`
	WeightPct float64 `json:"weight_pct"`
}

type catalogETFResponse struct {
	BenchmarkIndex         string                   `json:"benchmark_index"`
	MethodologySummary     *string                  `json:"methodology_summary"`
	ExpenseRatioPct        float64                  `json:"expense_ratio_pct"`
	RebalanceFrequencyDays int                      `json:"rebalance_frequency_days"`
	Holdings               []catalogHoldingResponse `json:"holdings"`
	HoldingsTotalWeightPct float64                  `json:"holdings_total_weight_pct"`
}

type catalogFIIResponse struct {
	FIIType     string   `json:"fii_type"`
	Segment     *string  `json:"segment"`
	VacancyRate *float64 `json:"vacancy_rate"`
	Indexador   *string  `json:"indexador"`
}

type catalogFixedIncomeResponse struct {
	InterestRate      *float64 `json:"interest_rate"`
	MaturityDate      *string  `json:"maturity_date"`
	IssuerType        string   `json:"issuer_type"`
	TaxExempt         bool     `json:"tax_exempt"`
	CreditRiskRating  *string  `json:"credit_risk_rating"`
	MinimumInvestment float64  `json:"minimum_investment"`
}

type catalogEntryResponse struct {
	AssetID           string                      `json:"asset_id"`
	Ticker            string                      `json:"ticker"`
	Name              string                      `json:"name"`
	Type              string                      `json:"type"`
	RiskClass         *string                     `json:"risk_class"`
	IsSandbox         bool                        `json:"is_sandbox"`
	ShareClass        *string                     `json:"share_class"`
	OutstandingShares *int64                      `json:"outstanding_shares"`
	Editable          []string                    `json:"editable"`
	Company           *catalogCompanyResponse     `json:"company"`
	ETF               *catalogETFResponse         `json:"etf"`
	FII               *catalogFIIResponse         `json:"fii"`
	FixedIncome       *catalogFixedIncomeResponse `json:"fixed_income"`
}

func toCatalogEntryResponse(e catalogadmin.Entry) catalogEntryResponse {
	resp := catalogEntryResponse{
		AssetID: e.AssetID, Ticker: e.Ticker, Name: e.Name, Type: string(e.Type), RiskClass: e.RiskClass,
		IsSandbox: e.IsSandbox, ShareClass: e.ShareClass, OutstandingShares: e.OutstandingShares, Editable: e.Editable(),
	}
	if c := e.Company; c != nil {
		resp.Company = &catalogCompanyResponse{
			CompanyID: c.CompanyID, Name: c.Name, Sector: c.Sector, ReportFrequencyDays: c.ReportFrequencyDays,
			BaseGrowthPct: c.BaseGrowthPct, QualityMultiplier: c.QualityMultiplier,
		}
	}
	if x := e.ETF; x != nil {
		holdings := make([]catalogHoldingResponse, 0, len(x.Holdings))
		for _, h := range x.Holdings {
			holdings = append(holdings, catalogHoldingResponse{Name: h.Name, WeightPct: h.WeightPct})
		}
		resp.ETF = &catalogETFResponse{
			BenchmarkIndex: x.BenchmarkIndex, MethodologySummary: x.MethodologySummary, ExpenseRatioPct: x.ExpenseRatioPct,
			RebalanceFrequencyDays: x.RebalanceFrequencyDays, Holdings: holdings, HoldingsTotalWeightPct: x.HoldingsTotalWeightPct,
		}
	}
	if f := e.FII; f != nil {
		resp.FII = &catalogFIIResponse{FIIType: f.FIIType, Segment: f.Segment, VacancyRate: f.VacancyRate, Indexador: f.Indexador}
	}
	if f := e.FixedIncome; f != nil {
		resp.FixedIncome = &catalogFixedIncomeResponse{
			InterestRate: f.InterestRate, MaturityDate: f.MaturityDate, IssuerType: f.IssuerType, TaxExempt: f.TaxExempt,
			CreditRiskRating: f.CreditRiskRating, MinimumInvestment: f.MinimumInvestment,
		}
	}
	return resp
}

// handleAdminCatalog serve GET /admin/catalog: todos os ativos (inclusive sandbox, marcado),
// ordenados por tipo e ticker. Filtro e ordenação ficam na tela.
func handleAdminCatalog(m catalogAdminManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "catálogo do painel indisponível")
			return
		}
		entries, err := m.List(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao listar o catálogo")
			return
		}
		assets := make([]catalogEntryResponse, 0, len(entries))
		for _, e := range entries {
			assets = append(assets, toCatalogEntryResponse(e))
		}
		writeJSON(w, http.StatusOK, map[string]any{"assets": assets})
	}
}

type patchCatalogRequest struct {
	Name               *string  `json:"name"`
	BaseGrowthPct      *float64 `json:"base_growth_pct"`
	QualityMultiplier  *float64 `json:"quality_multiplier"`
	MethodologySummary *string  `json:"methodology_summary"`
	AdminID            string   `json:"admin_id"`
}

func writeCatalogPatchError(w http.ResponseWriter, err error) {
	var notEditable *catalogadmin.FieldNotEditableError
	switch {
	case errors.Is(err, catalogadmin.ErrNotFound):
		writeCatalogError(w, http.StatusNotFound, err.Error())
	case errors.As(err, &notEditable),
		errors.Is(err, catalogadmin.ErrSandbox),
		errors.Is(err, catalogadmin.ErrNothingToUpdate),
		errors.Is(err, catalogadmin.ErrInvalidName),
		errors.Is(err, catalogadmin.ErrInvalidMethodology),
		errors.Is(err, catalog.ErrInvalidBaseGrowthPct),
		errors.Is(err, catalog.ErrInvalidQualityMultiplier):
		writeCatalogError(w, http.StatusUnprocessableEntity, err.Error())
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao gravar o ativo")
	}
}

// handleAdminCatalogPatch serve PATCH /admin/catalog/{id}: altera só os campos da lista
// fechada. Campo estrutural (ticker, tipo, setor, float) é 422, não é ignorado em silêncio.
func handleAdminCatalogPatch(m catalogAdminManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "catálogo do painel indisponível")
			return
		}
		id := r.PathValue("id")
		if !uuidPattern.MatchString(id) {
			writeCatalogError(w, http.StatusBadRequest, "id do ativo deve ser um UUID válido")
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<16))
		if err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo inválido")
			return
		}
		var raw map[string]json.RawMessage
		if err := json.Unmarshal(body, &raw); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo inválido")
			return
		}
		for field := range raw {
			switch field {
			case catalogadmin.FieldName, catalogadmin.FieldBaseGrowthPct, catalogadmin.FieldQualityMultiplier, catalogadmin.FieldMethodology, "admin_id":
			default:
				writeCatalogError(w, http.StatusUnprocessableEntity, "o campo "+field+" é somente leitura no catálogo")
				return
			}
		}
		var req patchCatalogRequest
		if err := json.Unmarshal(body, &req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "campo com tipo inválido")
			return
		}
		if !uuidPattern.MatchString(req.AdminID) {
			writeCatalogError(w, http.StatusBadRequest, "admin_id é obrigatório e deve ser um UUID válido")
			return
		}
		entry, err := m.Update(r.Context(), id, catalogadmin.Patch{
			Name: req.Name, BaseGrowthPct: req.BaseGrowthPct, QualityMultiplier: req.QualityMultiplier, Methodology: req.MethodologySummary,
		})
		if err != nil {
			writeCatalogPatchError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, toCatalogEntryResponse(entry))
	}
}
