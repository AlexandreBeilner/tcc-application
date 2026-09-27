package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/dividend"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/fii"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// assetCatalogReader é o colaborador que os handlers de /assets precisam
// pra ler o catálogo — implementado por *db.CatalogRepository, injetado em
// New (tarefa 3.10; cotação corrente/histórico desde a tarefa 4.6).
type assetCatalogReader interface {
	ListAssets(ctx context.Context, assetType string) ([]catalog.AssetRecord, error)
	FindAssetByID(ctx context.Context, id string) (catalog.AssetRecord, bool, error)
	FindFixedIncomeSpecialization(ctx context.Context, assetID string) (catalog.FixedIncomeSpecialization, bool, error)
	// CurrentSelicRatePct devolve a Selic simulada corrente (%) —
	// consumida só por handleFixedIncomeSimulate (achado do teste de ponta
	// a ponta da Fase L, fixedincome.go) pra projetar produto pós-fixado
	// (fixedincome.IsPostFixado). ok = false antes do primeiro tick do
	// Temporizador.
	CurrentSelicRatePct(ctx context.Context) (float64, bool, error)
	// CurrentSimulatedDay devolve market_calendar.current_day — o "agora" do
	// Dividend Yield de 12 meses e da simulação de renda fixa (tarefa S.1).
	CurrentSimulatedDay(ctx context.Context) (int, error)
	FindEquitySpecialization(ctx context.Context, assetID string) (catalog.EquitySpecialization, bool, error)
	FindETFDetails(ctx context.Context, assetID string) (etf.Details, bool, error)
	// FindLatestETFNAV devolve o NAV mais recente e as cotas emitidas do ETF
	// (tarefa R.3); found = false antes da emissão inicial.
	FindLatestETFNAV(ctx context.Context, assetID string) (catalog.ETFNAV, bool, error)
	FindFIIDetails(ctx context.Context, assetID string) (fii.Details, bool, error)
	// FindCurrentQuote/ListCurrentQuotes devolvem a cotação corrente
	// (asset_quotes, tarefa 3.11) — só existe pra acao/etf/fii, e só depois
	// do Temporizador ter rodado pelo menos um tick pro ativo (tarefa 4.6).
	FindCurrentQuote(ctx context.Context, assetID string) (catalog.Quote, bool, error)
	ListCurrentQuotes(ctx context.Context) (map[string]catalog.Quote, error)
	// ListQuoteHistory devolve a série histórica de cotações de um ativo —
	// usado só por GET /assets/:id/quotes (tarefa 4.6).
	ListQuoteHistory(ctx context.Context, assetID string, days int) ([]catalog.QuoteHistoryEntry, error)
	// FindLatestFundamentals devolve o ciclo de relatório mais recente da
	// empresa emissora — usado só pelo bloco de especialização de ação de
	// GET /assets/:id, pra calcular os indicadores de RF21 (tarefa 4.8).
	FindLatestFundamentals(ctx context.Context, companyID string) (catalog.FundamentalsSnapshot, bool, error)
	// ListDividendHistory devolve o histórico de dividend_events do ativo
	// — usado só pelo bloco de ação/FII de GET /assets/:id, pra expor o
	// histórico de proventos e calcular o Dividend Yield (RF21, tarefa
	// 4.9).
	ListDividendHistory(ctx context.Context, assetID string) ([]catalog.DividendHistoryEntry, error)
}

type assetSummaryResponse struct {
	ID             string   `json:"id"`
	Ticker         string   `json:"ticker"`
	Name           string   `json:"name"`
	Type           string   `json:"type"`
	RiskClass      *string  `json:"risk_class,omitempty"`
	IsSandbox      bool     `json:"is_sandbox"`
	CurrentPrice   *float64 `json:"current_price,omitempty"`
	DailyChangePct *float64 `json:"daily_change_pct,omitempty"`
}

// toAssetSummaryResponse monta o resumo do ativo — quote é a cotação
// corrente já resolvida pelo chamador (nil se o ativo não tem uma: renda
// fixa nunca tem, tarefa 4.6; acao/etf/fii sem tick gerado ainda também
// não), pra não repetir a decisão de "tem ou não cotação" aqui.
func toAssetSummaryResponse(rec catalog.AssetRecord, quote *catalog.Quote) assetSummaryResponse {
	resp := assetSummaryResponse{
		ID:        rec.ID,
		Ticker:    rec.Ticker,
		Name:      rec.Name,
		Type:      string(rec.Type),
		RiskClass: rec.RiskClass,
		IsSandbox: rec.IsSandbox,
	}
	if quote != nil {
		resp.CurrentPrice = &quote.Price
		resp.DailyChangePct = quote.DailyChangePct
	}
	return resp
}

// fixedIncomeDetailResponse é o payload extra de GET /assets/:id pra
// qualquer um dos 8 asset_type de renda fixa (RF21).
type fixedIncomeDetailResponse struct {
	InterestRate      *float64   `json:"interest_rate,omitempty"`
	MaturityDate      *time.Time `json:"maturity_date,omitempty"`
	IssuerType        string     `json:"issuer_type"`
	TaxExempt         bool       `json:"tax_exempt"`
	CreditRiskRating  *string    `json:"credit_risk_rating,omitempty"`
	MinimumInvestment float64    `json:"minimum_investment"`
}

// equityCompanyResponse é a empresa emissora embutida no payload de ação —
// nunca reaproveitado por ETF/FII, que não têm empresa (RF21, CLAUDE.md).
type equityCompanyResponse struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	CNPJ   string `json:"cnpj"`
	Sector string `json:"sector"`
}

// equityIndicatorsResponse são os 8 indicadores de ação de RF21 (tarefa
// 4.8), calculados por fundamentals.LPA/VPA/ROE/EBITMargin/NetMargin/
// NetDebtToEBIT/PriceToEarnings/PriceToBookValue. Cada campo fica omitido
// (não 0) quando o dado de origem falta — empresa sem ciclo de relatório
// ainda, ou (só pra P/L e P/VP) ativo sem cotação corrente ainda.
type equityIndicatorsResponse struct {
	PriceToEarnings   *float64 `json:"price_to_earnings,omitempty"`
	PriceToBookValue  *float64 `json:"price_to_book_value,omitempty"`
	EarningsPerShare  *float64 `json:"earnings_per_share,omitempty"`
	BookValuePerShare *float64 `json:"book_value_per_share,omitempty"`
	ROE               *float64 `json:"roe,omitempty"`
	EBITMargin        *float64 `json:"ebit_margin,omitempty"`
	NetMargin         *float64 `json:"net_margin,omitempty"`
	NetDebtToEBIT     *float64 `json:"net_debt_to_ebit,omitempty"`
	// DividendYield (tarefa 4.9) é o 9º indicador de RF21 — soma dos
	// proventos por ação pagos nos últimos 12 meses sobre o preço
	// corrente (dividend.Yield), calculado independentemente dos outros 8
	// (que dependem de company_fundamentals, não de dividend_events).
	DividendYield *float64 `json:"dividend_yield,omitempty"`
}

// toEquityIndicatorsResponse combina o fundamento mais recente da empresa
// (f), outstanding_shares do catálogo e a cotação corrente do ativo (quote,
// pode ser nil — ativo sem tick gerado ainda) pra calcular os 8
// indicadores — cada um independentemente, omitido (nil) quando algum dos
// seus insumos falta ou a fórmula correspondente devolve ok = false (ex:
// outstanding_shares ausente, EBIT = 0).
func toEquityIndicatorsResponse(f catalog.FundamentalsSnapshot, outstandingShares *int64, quote *catalog.Quote) equityIndicatorsResponse {
	var resp equityIndicatorsResponse
	var lpa, vpa *float64

	if f.NetIncome != nil && outstandingShares != nil {
		if v, ok := fundamentals.LPA(*f.NetIncome, *outstandingShares); ok {
			lpa = &v
			resp.EarningsPerShare = &v
		}
	}
	if f.NetEquity != nil && outstandingShares != nil {
		if v, ok := fundamentals.VPA(*f.NetEquity, *outstandingShares); ok {
			vpa = &v
			resp.BookValuePerShare = &v
		}
	}
	if f.NetIncome != nil && f.NetEquity != nil {
		if v, ok := fundamentals.ROE(*f.NetIncome, *f.NetEquity); ok {
			resp.ROE = &v
		}
	}
	if f.EBIT != nil && f.NetRevenue != nil {
		if v, ok := fundamentals.EBITMargin(*f.EBIT, *f.NetRevenue); ok {
			resp.EBITMargin = &v
		}
	}
	if f.NetIncome != nil && f.NetRevenue != nil {
		if v, ok := fundamentals.NetMargin(*f.NetIncome, *f.NetRevenue); ok {
			resp.NetMargin = &v
		}
	}
	if f.GrossDebt != nil && f.CashEquivalents != nil && f.EBIT != nil {
		if v, ok := fundamentals.NetDebtToEBIT(*f.GrossDebt, *f.CashEquivalents, *f.EBIT); ok {
			resp.NetDebtToEBIT = &v
		}
	}
	if quote != nil && lpa != nil {
		if v, ok := fundamentals.PriceToEarnings(quote.Price, *lpa); ok {
			resp.PriceToEarnings = &v
		}
	}
	if quote != nil && vpa != nil {
		if v, ok := fundamentals.PriceToBookValue(quote.Price, *vpa); ok {
			resp.PriceToBookValue = &v
		}
	}
	return resp
}

type equityDetailResponse struct {
	Company           equityCompanyResponse     `json:"company"`
	ShareClass        *string                   `json:"share_class,omitempty"`
	OutstandingShares *int64                    `json:"outstanding_shares,omitempty"`
	Indicators        *equityIndicatorsResponse `json:"indicators,omitempty"`
	// DividendHistory (tarefa 4.9) é o histórico de dividend_events do
	// ativo (RF21, tela 4.5) — sempre presente, lista vazia se a empresa
	// nunca gerou provento nenhum.
	DividendHistory []dividendHistoryEntryResponse `json:"dividend_history"`
}

// dividendHistoryEntryResponse é uma linha do histórico de proventos
// (dividend_events) de uma ação ou FII — tarefa 4.9, RF21/tela 4.5.
type dividendHistoryEntryResponse struct {
	ValuePerShare float64   `json:"value_per_share"`
	ExDate        time.Time `json:"ex_date"`
	PaymentDate   time.Time `json:"payment_date"`
}

func toDividendHistoryResponse(history []catalog.DividendHistoryEntry) []dividendHistoryEntryResponse {
	entries := make([]dividendHistoryEntryResponse, 0, len(history))
	for _, h := range history {
		entries = append(entries, dividendHistoryEntryResponse{
			ValuePerShare: h.ValuePerShare,
			ExDate:        h.ExDate,
			PaymentDate:   h.PaymentDate,
		})
	}
	return entries
}

// sumDividendsLast12Months soma value_per_share de todo DividendHistoryEntry
// pago (PaymentDate, data simulada) nos últimos 12 meses simulados a partir
// de now (a data do dia simulado corrente, simcalendar.DateOf) — insumo de
// dividend.Yield.
func sumDividendsLast12Months(history []catalog.DividendHistoryEntry, now time.Time) float64 {
	cutoff := now.AddDate(-1, 0, 0)
	var sum float64
	for _, h := range history {
		if h.PaymentDate.After(cutoff) {
			sum += h.ValuePerShare
		}
	}
	return sum
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
	// NAV, PremiumPct e SharesOutstanding (tarefa R.3) só vêm depois da
	// emissão inicial e do primeiro tick seguinte.
	NAV               *float64 `json:"nav,omitempty"`
	PremiumPct        *float64 `json:"premium_pct,omitempty"`
	NAVDay            *int     `json:"nav_day,omitempty"`
	SharesOutstanding *int64   `json:"shares_outstanding,omitempty"`
	// TrackingErrorPct e DividendHistory (tarefa R.11): desvio do NAV contra o
	// índice teórico e proventos que o fundo distribuiu aos cotistas (R.8).
	TrackingErrorPct *float64                       `json:"tracking_error_pct,omitempty"`
	DividendHistory  []dividendHistoryEntryResponse `json:"dividend_history"`
}

// fiiDetailResponse traz os campos próprios por perfil (tijolo/papel,
// mutuamente exclusivos — mesma regra de fii.NewDetails), nunca o layout de
// equityDetailResponse (RF21, CLAUDE.md).
type fiiDetailResponse struct {
	FIIType        string   `json:"fii_type"`
	Segment        *string  `json:"segment,omitempty"`
	NetWorth       *float64 `json:"net_worth,omitempty"`
	VacancyRate    *float64 `json:"vacancy_rate,omitempty"`
	Indexador      *string  `json:"indexador,omitempty"`
	PortfolioValue *float64 `json:"portfolio_value,omitempty"`
	// DividendYield/DividendHistory (tarefa 4.9, RF21) — mesma fonte
	// (dividend_events) e mesmo cálculo (dividend.Yield) do bloco de ação,
	// nunca o layout de equityIndicatorsResponse (RF21, CLAUDE.md: FII não
	// mostra indicador de empresa nenhum).
	DividendYield   *float64                       `json:"dividend_yield,omitempty"`
	DividendHistory []dividendHistoryEntryResponse `json:"dividend_history"`
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

// writeMarketClosedIfClosed responde 422 com code market_closed (tarefa S.11)
// e devolve true quando err é a recusa de negociar em fim de semana simulado.
// opens_on é a data da próxima abertura e days_until_open quantos dias
// simulados faltam, pro cliente montar "abre segunda 12/01" sem outra chamada.
func writeMarketClosedIfClosed(w http.ResponseWriter, err error) bool {
	var closed *simcalendar.MarketClosedError
	if !errors.As(err, &closed) {
		return false
	}
	writeJSON(w, http.StatusUnprocessableEntity, map[string]any{
		"error":           "Mercado fechado: fim de semana simulado. Abre na segunda-feira, " + closed.OpensOn().Format("02/01") + ".",
		"code":            "market_closed",
		"opens_on":        closed.OpensOn().Format(dateLayout),
		"days_until_open": closed.DaysUntilOpen(),
	})
	return true
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

		quotes, err := catalogReader.ListCurrentQuotes(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar cotações")
			return
		}

		summaries := make([]assetSummaryResponse, 0, len(records))
		for _, rec := range records {
			var quote *catalog.Quote
			if q, ok := quotes[rec.ID]; ok {
				quote = &q
			}
			summaries = append(summaries, toAssetSummaryResponse(rec, quote))
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

		quote, quoteFound, err := catalogReader.FindCurrentQuote(r.Context(), rec.ID)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar cotação")
			return
		}
		var quotePtr *catalog.Quote
		if quoteFound {
			quotePtr = &quote
		}
		resp := assetDetailResponse{assetSummaryResponse: toAssetSummaryResponse(rec, quotePtr)}

		today, err := catalogReader.CurrentSimulatedDay(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar dia simulado corrente")
			return
		}

		switch rec.Type {
		case catalog.AssetAcao:
			spec, found, err := catalogReader.FindEquitySpecialization(r.Context(), rec.ID)
			if err != nil {
				writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar especialização de ação")
				return
			}
			if found {
				equityDetail := &equityDetailResponse{
					Company: equityCompanyResponse{
						ID:     spec.CompanyID,
						Name:   spec.CompanyName,
						CNPJ:   spec.CompanyCNPJ,
						Sector: string(spec.CompanySector),
					},
					ShareClass:        spec.ShareClass,
					OutstandingShares: spec.OutstandingShares,
				}

				var indicators equityIndicatorsResponse
				var hasIndicators bool

				latestFundamentals, fundamentalsFound, err := catalogReader.FindLatestFundamentals(r.Context(), spec.CompanyID)
				if err != nil {
					writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar fundamentos da empresa")
					return
				}
				if fundamentalsFound {
					indicators = toEquityIndicatorsResponse(latestFundamentals, spec.OutstandingShares, quotePtr)
					hasIndicators = true
				}

				dividendHistory, err := catalogReader.ListDividendHistory(r.Context(), rec.ID)
				if err != nil {
					writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar histórico de proventos")
					return
				}
				equityDetail.DividendHistory = toDividendHistoryResponse(dividendHistory)
				if quotePtr != nil {
					sum := sumDividendsLast12Months(dividendHistory, simcalendar.DateOf(today))
					if v, ok := dividend.Yield(sum, quotePtr.Price); ok {
						indicators.DividendYield = &v
						hasIndicators = true
					}
				}

				if hasIndicators {
					equityDetail.Indicators = &indicators
				}

				resp.Equity = equityDetail
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
				dividendHistory, err := catalogReader.ListDividendHistory(r.Context(), rec.ID)
				if err != nil {
					writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar histórico de proventos")
					return
				}
				resp.ETF = &etfDetailResponse{
					BenchmarkIndex:     details.BenchmarkIndex,
					MethodologySummary: details.MethodologySummary,
					Holdings:           holdings,
					DividendHistory:    toDividendHistoryResponse(dividendHistory),
				}
				nav, navFound, err := catalogReader.FindLatestETFNAV(r.Context(), rec.ID)
				if err != nil {
					writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar NAV do ETF")
					return
				}
				if navFound {
					resp.ETF.NAV, resp.ETF.PremiumPct, resp.ETF.NAVDay, resp.ETF.SharesOutstanding = &nav.NAV, &nav.PremiumPct, &nav.SimulatedDay, &nav.OutstandingShares
					resp.ETF.TrackingErrorPct = nav.TrackingErrorPct
				}
			}
		case catalog.AssetFII:
			details, found, err := catalogReader.FindFIIDetails(r.Context(), rec.ID)
			if err != nil {
				writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar especialização de FII")
				return
			}
			if found {
				dividendHistory, err := catalogReader.ListDividendHistory(r.Context(), rec.ID)
				if err != nil {
					writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar histórico de proventos")
					return
				}

				fiiDetail := &fiiDetailResponse{
					FIIType:         string(details.Type),
					Segment:         details.Segment,
					NetWorth:        details.NetWorth,
					VacancyRate:     details.VacancyRate,
					Indexador:       details.Indexador,
					PortfolioValue:  details.PortfolioValue,
					DividendHistory: toDividendHistoryResponse(dividendHistory),
				}
				if quotePtr != nil {
					sum := sumDividendsLast12Months(dividendHistory, simcalendar.DateOf(today))
					if v, ok := dividend.Yield(sum, quotePtr.Price); ok {
						fiiDetail.DividendYield = &v
					}
				}
				resp.FII = fiiDetail
			}
		default:
			spec, found, err := catalogReader.FindFixedIncomeSpecialization(r.Context(), rec.ID)
			if err != nil {
				writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar especialização de renda fixa")
				return
			}
			if found {
				resp.FixedIncome = &fixedIncomeDetailResponse{
					InterestRate:      spec.InterestRate,
					MaturityDate:      spec.MaturityDate,
					IssuerType:        string(spec.IssuerType),
					TaxExempt:         spec.TaxExempt,
					CreditRiskRating:  spec.CreditRiskRating,
					MinimumInvestment: spec.MinimumInvestment,
				}
			}
		}

		writeJSON(w, http.StatusOK, resp)
	}
}

// defaultQuoteHistoryDays é o "default razoável" pedido pela tarefa 4.6
// pra ?days= — mesmo tratamento de defaultMacroEventListLimit (4.5), sem
// nenhum critério de aceite fixando um valor.
const defaultQuoteHistoryDays = 30

type quoteHistoryEntryResponse struct {
	SimulatedDay int     `json:"simulated_day"`
	Price        float64 `json:"price"`
}

// handleGetAssetQuoteHistory serve GET /assets/:id/quotes — série
// histórica de preço de um ativo de renda variável (base do gráfico da
// tela 4.5, RF04), tarefa 4.6. 404 se o ativo não existe; lista vazia (não
// erro) se o Temporizador nunca gerou cotação pra ele — mesmo tratamento já
// dado a essa condição em GET /admin/macro-events (4.5).
func handleGetAssetQuoteHistory(catalogReader assetCatalogReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if catalogReader == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de catálogo indisponível")
			return
		}

		days, ok := parsePaginationParam(r.URL.Query().Get("days"), defaultQuoteHistoryDays, 1, 0)
		if !ok {
			writeCatalogError(w, http.StatusBadRequest, "days inválido")
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

		history, err := catalogReader.ListQuoteHistory(r.Context(), id, days)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar histórico de cotações")
			return
		}

		entries := make([]quoteHistoryEntryResponse, 0, len(history))
		for _, e := range history {
			entries = append(entries, quoteHistoryEntryResponse{SimulatedDay: e.SimulatedDay, Price: e.Price})
		}
		writeJSON(w, http.StatusOK, entries)
	}
}
