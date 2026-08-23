package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/fii"
)

// assetCatalogReader é o colaborador que os handlers de /assets precisam
// pra ler o catálogo — implementado por *db.CatalogRepository, injetado em
// New (tarefa 3.10). Sem cotação corrente (asset_quotes existe desde a
// tarefa 3.11, mas ainda não é exposta por essas rotas) — só dado
// cadastral/quase-estático do seed da 3.9.
type assetCatalogReader interface {
	ListAssets(ctx context.Context, assetType string) ([]catalog.AssetRecord, error)
	FindAssetByID(ctx context.Context, id string) (catalog.AssetRecord, bool, error)
	FindFixedIncomeSpecialization(ctx context.Context, assetID string) (catalog.FixedIncomeSpecialization, bool, error)
	FindEquitySpecialization(ctx context.Context, assetID string) (catalog.EquitySpecialization, bool, error)
	FindETFDetails(ctx context.Context, assetID string) (etf.Details, bool, error)
	FindFIIDetails(ctx context.Context, assetID string) (fii.Details, bool, error)
}

type assetSummaryResponse struct {
	ID        string  `json:"id"`
	Ticker    string  `json:"ticker"`
	Name      string  `json:"name"`
	Type      string  `json:"type"`
	RiskClass *string `json:"risk_class,omitempty"`
	IsSandbox bool    `json:"is_sandbox"`
}

func toAssetSummaryResponse(rec catalog.AssetRecord) assetSummaryResponse {
	return assetSummaryResponse{
		ID:        rec.ID,
		Ticker:    rec.Ticker,
		Name:      rec.Name,
		Type:      string(rec.Type),
		RiskClass: rec.RiskClass,
		IsSandbox: rec.IsSandbox,
	}
}

// fixedIncomeDetailResponse é o payload extra de GET /assets/:id pra
// qualquer um dos 8 asset_type de renda fixa (RF21).
type fixedIncomeDetailResponse struct {
	InterestRate     *float64   `json:"interest_rate,omitempty"`
	MaturityDate     *time.Time `json:"maturity_date,omitempty"`
	IssuerType       string     `json:"issuer_type"`
	TaxExempt        bool       `json:"tax_exempt"`
	CreditRiskRating *string    `json:"credit_risk_rating,omitempty"`
}

// equityCompanyResponse é a empresa emissora embutida no payload de ação —
// nunca reaproveitado por ETF/FII, que não têm empresa (RF21, CLAUDE.md).
type equityCompanyResponse struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	CNPJ   string `json:"cnpj"`
	Sector string `json:"sector"`
}

type equityDetailResponse struct {
	Company           equityCompanyResponse `json:"company"`
	ShareClass        *string               `json:"share_class,omitempty"`
	OutstandingShares *int64                `json:"outstanding_shares,omitempty"`
}

type etfHoldingResponse struct {
	ConstituentName string  `json:"constituent_name"`
	WeightPct       float64 `json:"weight_pct"`
}

// etfDetailResponse substitui indicadores fundamentalistas de empresa pro
// payload de ETF — índice de referência, metodologia e composição
// sintética, nunca o layout de equityDetailResponse (RF21, CLAUDE.md).
type etfDetailResponse struct {
	BenchmarkIndex     string               `json:"benchmark_index"`
	MethodologySummary string               `json:"methodology_summary,omitempty"`
	Holdings           []etfHoldingResponse `json:"holdings"`
}

// fiiDetailResponse traz os campos próprios por perfil (tijolo/papel,
// mutuamente exclusivos — mesma regra de fii.NewDetails), nunca o layout de
// equityDetailResponse (RF21, CLAUDE.md).
type fiiDetailResponse struct {
	FIIType     string   `json:"fii_type"`
	Segment     *string  `json:"segment,omitempty"`
	NetWorth    *float64 `json:"net_worth,omitempty"`
	VacancyRate *float64 `json:"vacancy_rate,omitempty"`
	Indexador   *string  `json:"indexador,omitempty"`
}

type assetDetailResponse struct {
	assetSummaryResponse
	FixedIncome *fixedIncomeDetailResponse `json:"fixed_income,omitempty"`
	Equity      *equityDetailResponse      `json:"equity,omitempty"`
	ETF         *etfDetailResponse         `json:"etf,omitempty"`
	FII         *fiiDetailResponse         `json:"fii,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeCatalogError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// handleListAssets serve GET /assets, com filtro opcional por `type` (um
// dos 11 valores de catalog.AssetType) — tarefa 3.10.
func handleListAssets(catalogReader assetCatalogReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if catalogReader == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de catálogo indisponível")
			return
		}

		assetType := r.URL.Query().Get("type")
		if assetType != "" && !catalog.IsValidAssetType(catalog.AssetType(assetType)) {
			writeCatalogError(w, http.StatusBadRequest, "type inválido")
			return
		}

		records, err := catalogReader.ListAssets(r.Context(), assetType)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao listar ativos")
			return
		}

		summaries := make([]assetSummaryResponse, 0, len(records))
		for _, rec := range records {
			summaries = append(summaries, toAssetSummaryResponse(rec))
		}
		writeJSON(w, http.StatusOK, summaries)
	}
}

// handleGetAsset serve GET /assets/:id — o payload varia por classe de
// ativo (renda fixa vs. ação vs. ETF vs. FII), refletindo RF21: nunca
// reaproveita o layout de indicadores de Ações pra ETF/FII (CLAUDE.md).
func handleGetAsset(catalogReader assetCatalogReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if catalogReader == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de catálogo indisponível")
			return
		}

		id := r.PathValue("id")

		rec, found, err := catalogReader.FindAssetByID(r.Context(), id)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar ativo")
			return
		}
		if !found {
			writeCatalogError(w, http.StatusNotFound, "ativo não encontrado")
			return
		}

		resp := assetDetailResponse{assetSummaryResponse: toAssetSummaryResponse(rec)}

		switch rec.Type {
		case catalog.AssetAcao:
			spec, found, err := catalogReader.FindEquitySpecialization(r.Context(), rec.ID)
			if err != nil {
				writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar especialização de ação")
				return
			}
			if found {
				resp.Equity = &equityDetailResponse{
					Company: equityCompanyResponse{
						ID:     spec.CompanyID,
						Name:   spec.CompanyName,
						CNPJ:   spec.CompanyCNPJ,
						Sector: string(spec.CompanySector),
					},
					ShareClass:        spec.ShareClass,
					OutstandingShares: spec.OutstandingShares,
				}
			}
		case catalog.AssetETF:
			details, found, err := catalogReader.FindETFDetails(r.Context(), rec.ID)
			if err != nil {
				writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar especialização de ETF")
				return
			}
			if found {
				holdings := make([]etfHoldingResponse, 0, len(details.Holdings))
				for _, h := range details.Holdings {
					holdings = append(holdings, etfHoldingResponse{ConstituentName: h.ConstituentName, WeightPct: h.WeightPct})
				}
				resp.ETF = &etfDetailResponse{
					BenchmarkIndex:     details.BenchmarkIndex,
					MethodologySummary: details.MethodologySummary,
					Holdings:           holdings,
				}
			}
		case catalog.AssetFII:
			details, found, err := catalogReader.FindFIIDetails(r.Context(), rec.ID)
			if err != nil {
				writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar especialização de FII")
				return
			}
			if found {
				resp.FII = &fiiDetailResponse{
					FIIType:     string(details.Type),
					Segment:     details.Segment,
					NetWorth:    details.NetWorth,
					VacancyRate: details.VacancyRate,
					Indexador:   details.Indexador,
				}
			}
		default:
			spec, found, err := catalogReader.FindFixedIncomeSpecialization(r.Context(), rec.ID)
			if err != nil {
				writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar especialização de renda fixa")
				return
			}
			if found {
				resp.FixedIncome = &fixedIncomeDetailResponse{
					InterestRate:     spec.InterestRate,
					MaturityDate:     spec.MaturityDate,
					IssuerType:       string(spec.IssuerType),
					TaxExempt:        spec.TaxExempt,
					CreditRiskRating: spec.CreditRiskRating,
				}
			}
		}

		writeJSON(w, http.StatusOK, resp)
	}
}
