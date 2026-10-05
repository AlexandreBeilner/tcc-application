package httpserver

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"tcc-investimentos/engine/internal/domain/adminview"
)

// Desempenho dos bots do painel (tarefa N.14). Mesmo trust boundary de POST
// /admin/tick: o backend valida role = admin antes de repassar. Só leitura.

// adminBotActivityReader é o que as duas rotas precisam — *db.AdminReadRepository.
type adminBotActivityReader interface {
	BotActivity(ctx context.Context, accountID string, days int) (adminview.BotActivity, error)
	BotsSummary(ctx context.Context, idleDays int) (adminview.BotsSummary, error)
}

type orderCountsResponse struct {
	Sent              int            `json:"sent"`
	Filled            int            `json:"filled"`
	PartiallyFilled   int            `json:"partially_filled"`
	Open              int            `json:"open"`
	Cancelled         int            `json:"cancelled"`
	CancelledByReason map[string]int `json:"cancelled_by_reason"`
	FillRatePct       *float64       `json:"fill_rate_pct"`
}

type marketMakerQuoteResponse struct {
	AssetID        string   `json:"asset_id"`
	Ticker         string   `json:"ticker"`
	BestBid        *float64 `json:"best_bid"`
	BestAsk        *float64 `json:"best_ask"`
	SpreadPct      *float64 `json:"spread_pct"`
	HeldQuantity   int64    `json:"held_quantity"`
	TargetQuantity int64    `json:"target_quantity"`
	InventoryPct   *float64 `json:"inventory_pct"`
}

type botActivityResponse struct {
	AccountID          string                     `json:"account_id"`
	Archetype          string                     `json:"archetype"`
	IsActive           bool                       `json:"is_active"`
	FromDay            int                        `json:"from_day"`
	ToDay              int                        `json:"to_day"`
	PeriodDays         int                        `json:"period_days"`
	Cash               float64                    `json:"cash"`
	HoldingsValue      float64                    `json:"holdings_value"`
	NetWorth           float64                    `json:"net_worth"`
	CapitalContributed float64                    `json:"capital_contributed"`
	PnL                float64                    `json:"pnl"`
	PnLPct             *float64                   `json:"pnl_pct"`
	Orders             orderCountsResponse        `json:"orders"`
	Trades             int                        `json:"trades"`
	Volume             float64                    `json:"volume"`
	LastOrderAt        *time.Time                 `json:"last_order_at"`
	LastOrderDay       *int                       `json:"last_order_day"`
	Quotes             []marketMakerQuoteResponse `json:"quotes"`
}

func toBotActivityResponse(a adminview.BotActivity) botActivityResponse {
	quotes := make([]marketMakerQuoteResponse, 0, len(a.Quotes))
	for _, q := range a.Quotes {
		quotes = append(quotes, marketMakerQuoteResponse{
			AssetID: q.AssetID, Ticker: q.Ticker, BestBid: q.BestBid, BestAsk: q.BestAsk, SpreadPct: q.SpreadPct(),
			HeldQuantity: q.HeldQuantity, TargetQuantity: q.TargetQuantity, InventoryPct: q.InventoryPct(),
		})
	}
	reasons := a.Orders.CancelledByReason
	if reasons == nil {
		reasons = map[string]int{}
	}
	return botActivityResponse{
		AccountID: a.AccountID, Archetype: a.Archetype, IsActive: a.IsActive,
		FromDay: a.FromDay, ToDay: a.ToDay, PeriodDays: a.PeriodDays,
		Cash: a.Cash, HoldingsValue: a.HoldingsValue, NetWorth: a.NetWorth(),
		CapitalContributed: a.CapitalContributed, PnL: a.PnL(), PnLPct: a.PnLPct(),
		Orders: orderCountsResponse{
			Sent: a.Orders.Sent, Filled: a.Orders.Filled, PartiallyFilled: a.Orders.PartiallyFilled, Open: a.Orders.Open,
			Cancelled: a.Orders.Cancelled, CancelledByReason: reasons, FillRatePct: a.Orders.FillRatePct(),
		},
		Trades: a.Trades, Volume: a.Volume, LastOrderAt: a.LastOrderAt, LastOrderDay: a.LastOrderDay, Quotes: quotes,
	}
}

// parsePositiveIntQuery lê um inteiro positivo opcional da query (0 = ausente, o
// domínio aplica o padrão). Devolve a mensagem de erro (vazia quando válido).
func parsePositiveIntQuery(r *http.Request, name string) (int, string) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return 0, ""
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 0, name + " deve ser um inteiro positivo"
	}
	return n, ""
}

// handleAdminBotActivity serve GET /admin/bots/{id}/activity?days=N.
func handleAdminBotActivity(reader adminBotActivityReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if reader == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "leituras do painel indisponíveis")
			return
		}
		id := r.PathValue("id")
		if !uuidPattern.MatchString(id) {
			writeCatalogError(w, http.StatusBadRequest, "id deve ser um UUID válido")
			return
		}
		days, message := parsePositiveIntQuery(r, "days")
		if message != "" {
			writeCatalogError(w, http.StatusBadRequest, message)
			return
		}
		activity, err := reader.BotActivity(r.Context(), id, days)
		if errors.Is(err, adminview.ErrBotNotFound) {
			writeCatalogError(w, http.StatusNotFound, err.Error())
			return
		}
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao ler o desempenho do bot")
			return
		}
		writeJSON(w, http.StatusOK, toBotActivityResponse(activity))
	}
}

type idleBotResponse struct {
	AccountID    string `json:"account_id"`
	Archetype    string `json:"archetype"`
	LastOrderDay *int   `json:"last_order_day"`
}

type lowCashBotResponse struct {
	AccountID string  `json:"account_id"`
	Archetype string  `json:"archetype"`
	Cash      float64 `json:"cash"`
	Capital   float64 `json:"capital"`
}

type emptyInventoryResponse struct {
	AccountID string `json:"account_id"`
	AssetID   string `json:"asset_id"`
	Ticker    string `json:"ticker"`
}

type assetLiquidityResponse struct {
	AssetID           string           `json:"asset_id"`
	Ticker            string           `json:"ticker"`
	RestingByProvider map[string]int64 `json:"resting_by_provider"`
}

type floatConcentrationResponse struct {
	AssetID           string  `json:"asset_id"`
	Ticker            string  `json:"ticker"`
	TopBotID          string  `json:"top_bot_id"`
	TopBotArchetype   string  `json:"top_bot_archetype"`
	TopBotPct         float64 `json:"top_bot_pct"`
	AllBotsPct        float64 `json:"all_bots_pct"`
	OutstandingShares int64   `json:"outstanding_shares"`
}

// handleAdminBotsSummary serve GET /admin/bots/summary?idle_days=N.
func handleAdminBotsSummary(reader adminBotActivityReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if reader == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "leituras do painel indisponíveis")
			return
		}
		idleDays, message := parsePositiveIntQuery(r, "idle_days")
		if message != "" {
			writeCatalogError(w, http.StatusBadRequest, message)
			return
		}
		s, err := reader.BotsSummary(r.Context(), idleDays)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao ler o resumo dos bots")
			return
		}
		idle := make([]idleBotResponse, 0, len(s.IdleBots))
		for _, b := range s.IdleBots {
			idle = append(idle, idleBotResponse{AccountID: b.AccountID, Archetype: b.Archetype, LastOrderDay: b.LastOrderDay})
		}
		low := make([]lowCashBotResponse, 0, len(s.LowCashBots))
		for _, b := range s.LowCashBots {
			low = append(low, lowCashBotResponse{AccountID: b.AccountID, Archetype: b.Archetype, Cash: b.Cash, Capital: b.Capital})
		}
		empty := make([]emptyInventoryResponse, 0, len(s.EmptyInventory))
		for _, e := range s.EmptyInventory {
			empty = append(empty, emptyInventoryResponse{AccountID: e.AccountID, AssetID: e.AssetID, Ticker: e.Ticker})
		}
		liquidity := make([]assetLiquidityResponse, 0, len(s.Liquidity))
		for _, l := range s.Liquidity {
			liquidity = append(liquidity, assetLiquidityResponse{AssetID: l.AssetID, Ticker: l.Ticker, RestingByProvider: l.RestingByProvider})
		}
		concentration := make([]floatConcentrationResponse, 0, len(s.Concentration))
		for _, c := range s.Concentration {
			concentration = append(concentration, floatConcentrationResponse{
				AssetID: c.AssetID, Ticker: c.Ticker, TopBotID: c.TopBotID, TopBotArchetype: c.TopBotArchetype,
				TopBotPct: c.TopBotPct, AllBotsPct: c.AllBotsPct, OutstandingShares: c.OutstandingShare,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"simulated_day": s.SimulatedDay, "idle_days": s.IdleDays, "active_bots": s.ActiveBotsCount,
			"idle_bots": idle, "low_cash_bots": low, "empty_inventory": empty,
			"liquidity": liquidity, "float_concentration": concentration,
		})
	}
}
