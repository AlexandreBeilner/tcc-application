package httpserver

import (
	"context"
	"net/http"

	"tcc-investimentos/engine/internal/domain/adminview"
)

// Rotas de leitura do painel administrativo (tarefas N.5 e N.8) — mesmo trust
// boundary de POST /admin/tick: sem checagem de role aqui, o backend valida
// role = admin antes de repassar. Só leitura, nada grava.

// adminOverviewReader é o que GET /admin/overview precisa — implementado por
// *db.AdminReadRepository.
type adminOverviewReader interface {
	Overview(ctx context.Context) (adminview.Overview, error)
}

// WithAdminReader liga as rotas de leitura do painel (N.5/N.8); sem ela respondem 503.
func WithAdminReader(reader adminReader) Option {
	return func(o *options) { o.adminReader = reader }
}

type overviewResponse struct {
	SimulatedDay       int      `json:"simulated_day"`
	SelicRate          float64  `json:"selic_rate"`
	IPCAMonthly        *float64 `json:"ipca_monthly"`
	IPCAAccumulated12m *float64 `json:"ipca_accumulated_12m"`
	PendingMacroEvents int      `json:"pending_macro_events"`
	UncoveredAssets    int      `json:"uncovered_assets"`
	TradableAssets     int      `json:"tradable_assets"`
	ActiveBots         int      `json:"active_bots"`
	TotalBots          int      `json:"total_bots"`
	DayTrades          int      `json:"day_trades"`
	DayVolume          float64  `json:"day_volume"`
	RestingOrders      int      `json:"resting_orders"`
}

// handleAdminOverview serve GET /admin/overview: o recorte do mercado que a visão
// geral do painel mostra, numa chamada só.
func handleAdminOverview(reader adminOverviewReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if reader == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "leituras do painel indisponíveis")
			return
		}
		o, err := reader.Overview(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao montar a visão geral do mercado")
			return
		}
		writeJSON(w, http.StatusOK, overviewResponse{
			SimulatedDay: o.SimulatedDay, SelicRate: o.SelicRate,
			IPCAMonthly: o.IPCAMonthly, IPCAAccumulated12m: o.IPCAAccumulated12m,
			PendingMacroEvents: o.PendingMacroEvents, UncoveredAssets: o.UncoveredAssets, TradableAssets: o.TradableAssets,
			ActiveBots: o.ActiveBots, TotalBots: o.TotalBots,
			DayTrades: o.Trades, DayVolume: o.Volume, RestingOrders: o.RestingOrders,
		})
	}
}
