package httpserver

import (
	"context"
	"errors"
	"net/http"

	"tcc-investimentos/engine/internal/domain/adminview"
)

// adminMarketReader é o que as rotas /admin/market/assets precisam (N.8) — implementado
// por *db.AdminReadRepository.
type adminMarketReader interface {
	MarketAssets(ctx context.Context) ([]adminview.AssetRow, error)
	AssetDetail(ctx context.Context, assetID string) (adminview.AssetDetail, error)
}

// adminReader é o conjunto das leituras do painel que o repositório entrega.
type adminReader interface {
	adminOverviewReader
	adminMarketReader
	adminOrderReader
}

type indicatorResponse struct {
	Kind  string  `json:"kind"`
	Value float64 `json:"value"`
}

type marketAssetResponse struct {
	AssetID           string             `json:"asset_id"`
	Ticker            string             `json:"ticker"`
	Name              string             `json:"name"`
	Type              string             `json:"type"`
	Sector            *string            `json:"sector"`
	LastPrice         *float64           `json:"last_price"`
	DailyChangePct    *float64           `json:"daily_change_pct"`
	BestBid           *float64           `json:"best_bid"`
	BestAsk           *float64           `json:"best_ask"`
	SpreadPct         *float64           `json:"spread_pct"`
	RestingOrders     int                `json:"resting_orders"`
	BotRestingOrders  int                `json:"bot_resting_orders"`
	DayTrades         int                `json:"day_trades"`
	DayVolume         int                `json:"day_volume"`
	OutstandingShares *int64             `json:"outstanding_shares"`
	HeldByBots        int64              `json:"held_by_bots"`
	HeldByUsers       int64              `json:"held_by_users"`
	Covered           bool               `json:"covered"`
	Indicator         *indicatorResponse `json:"indicator"`
}

func toMarketAssetResponse(row adminview.AssetRow) marketAssetResponse {
	resp := marketAssetResponse{
		AssetID: row.AssetID, Ticker: row.Ticker, Name: row.Name, Type: row.Type, Sector: row.Sector,
		LastPrice: row.LastPrice, DailyChangePct: adminview.DailyChangePct(row.LastPrice, row.PreviousPrice),
		BestBid: row.BestBid, BestAsk: row.BestAsk, SpreadPct: adminview.SpreadPct(row.BestBid, row.BestAsk),
		RestingOrders: row.RestingOrders, BotRestingOrders: row.BotRestingOrders,
		DayTrades: row.DayTrades, DayVolume: row.DayVolume, OutstandingShares: row.OutstandingShares,
		HeldByBots: row.HeldByBots, HeldByUsers: row.HeldByUsers, Covered: row.Covered,
	}
	if row.Indicator != nil {
		resp.Indicator = &indicatorResponse{Kind: string(row.Indicator.Kind), Value: row.Indicator.Value}
	}
	return resp
}

// handleAdminMarketAssets serve GET /admin/market/assets: uma linha por ativo
// negociável (ação, ETF, FII), ordenada por ticker. Filtro e ordenação ficam na tela.
func handleAdminMarketAssets(reader adminMarketReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if reader == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "leituras do painel indisponíveis")
			return
		}
		rows, err := reader.MarketAssets(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao listar o mercado")
			return
		}
		assets := make([]marketAssetResponse, 0, len(rows))
		for _, row := range rows {
			assets = append(assets, toMarketAssetResponse(row))
		}
		writeJSON(w, http.StatusOK, map[string]any{"assets": assets})
	}
}

type bookLevelResponse struct {
	Price       float64 `json:"price"`
	Quantity    int     `json:"quantity"`
	BotQuantity int     `json:"bot_quantity"`
}

type tradeResponse struct {
	SimulatedDay int     `json:"simulated_day"`
	Price        float64 `json:"price"`
	Quantity     int     `json:"quantity"`
	BuyerIsBot   bool    `json:"buyer_is_bot"`
}

type quotePointResponse struct {
	SimulatedDay int     `json:"simulated_day"`
	Price        float64 `json:"price"`
}

type navPointResponse struct {
	SimulatedDay int     `json:"simulated_day"`
	NAV          float64 `json:"nav"`
	ClosePrice   float64 `json:"close_price"`
	PremiumPct   float64 `json:"premium_pct"`
}

type marketAssetDetailResponse struct {
	marketAssetResponse
	Bids       []bookLevelResponse  `json:"bids"`
	Asks       []bookLevelResponse  `json:"asks"`
	Trades     []tradeResponse      `json:"trades"`
	Quotes     []quotePointResponse `json:"quotes"`
	NAVHistory []navPointResponse   `json:"nav_history"`
}

func toBookLevels(levels []adminview.BookLevel) []bookLevelResponse {
	out := make([]bookLevelResponse, 0, len(levels))
	for _, l := range levels {
		out = append(out, bookLevelResponse{Price: l.Price, Quantity: l.Quantity, BotQuantity: l.BotQuantity})
	}
	return out
}

// handleAdminMarketAssetDetail serve GET /admin/market/assets/{id}: book completo
// (com a parcela de bots), últimos negócios, série de cotações e, pra ETF, de NAV.
// Nunca expõe o dono de uma ordem individual: só a quantidade agregada por preço.
func handleAdminMarketAssetDetail(reader adminMarketReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if reader == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "leituras do painel indisponíveis")
			return
		}
		id := r.PathValue("id")
		if !uuidPattern.MatchString(id) {
			writeCatalogError(w, http.StatusBadRequest, "id do ativo deve ser um UUID válido")
			return
		}
		d, err := reader.AssetDetail(r.Context(), id)
		if errors.Is(err, adminview.ErrAssetNotFound) {
			writeCatalogError(w, http.StatusNotFound, "ativo não encontrado")
			return
		}
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar o detalhe do ativo")
			return
		}
		resp := marketAssetDetailResponse{
			marketAssetResponse: toMarketAssetResponse(d.Row),
			Bids:                toBookLevels(d.Bids),
			Asks:                toBookLevels(d.Asks),
			Trades:              make([]tradeResponse, 0, len(d.Trades)),
			Quotes:              make([]quotePointResponse, 0, len(d.Quotes)),
			NAVHistory:          make([]navPointResponse, 0, len(d.NAVHistory)),
		}
		for _, t := range d.Trades {
			resp.Trades = append(resp.Trades, tradeResponse{SimulatedDay: t.SimulatedDay, Price: t.Price, Quantity: t.Quantity, BuyerIsBot: t.BuyerIsBot})
		}
		for _, q := range d.Quotes {
			resp.Quotes = append(resp.Quotes, quotePointResponse{SimulatedDay: q.SimulatedDay, Price: q.Price})
		}
		for _, n := range d.NAVHistory {
			resp.NAVHistory = append(resp.NAVHistory, navPointResponse{SimulatedDay: n.SimulatedDay, NAV: n.NAV, ClosePrice: n.ClosePrice, PremiumPct: n.PremiumPct})
		}
		writeJSON(w, http.StatusOK, resp)
	}
}
