package db

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/adminview"
)

// Cobre o desempenho dos bots do painel (N.14) contra um Postgres real descartável
// (roda só com TEST_DATABASE_URL). Mercado pequeno: um Market Maker que cobre ACME3
// (com caixa e posição provisionados, uma cotação e duas ordens canceladas), um
// chartista parado e outro sem caixa.
func TestAdminReadRepository_DesempenhoDeBots(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := conn.ExecContext(ctx, query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	newBot := func(archetype string, cash float64) string {
		t.Helper()
		var id string
		if err := conn.QueryRowContext(ctx,
			`INSERT INTO accounts (user_id, is_bot, current_balance) VALUES (gen_random_uuid(), true, $1) RETURNING user_id`, cash,
		).Scan(&id); err != nil {
			t.Fatal(err)
		}
		exec(`INSERT INTO bot_personalities (account_id, archetype, within_scope_pct, max_position_size_pct, market_order_preference, spread_width_pct, max_covered_assets)
		      VALUES ($1, $2::bot_archetype, 1, 0.1, 0, 0.02, CASE WHEN $2::text = 'market_maker' THEN 10 END)`, id, archetype)
		return id
	}
	mm := newBot("market_maker", 5000)
	idle := newBot("chartista", 800)
	broke := newBot("ruido", 1)

	var acme string
	if err := conn.QueryRowContext(ctx, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme ON', 'acao') RETURNING id`).Scan(&acme); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO variable_income_assets (asset_id, outstanding_shares) VALUES ($1, 1000)`, acme)
	exec(`INSERT INTO market_calendar (id, current_day, selic_rate) VALUES (1, 20, 10.75) ON CONFLICT (id) DO UPDATE SET current_day = 20`)
	exec(`INSERT INTO asset_quotes (asset_id, simulated_day, price) VALUES ($1, 19, 9.00), ($1, 20, 10.00)`, acme)
	exec(`INSERT INTO market_maker_coverage (asset_id, mm_account_id) VALUES ($1, $2)`, acme, mm)
	exec(`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $2, 100, 9)`, mm, acme)
	// Capital: R$ 4.000 de caixa inicial + 200 ações a R$ 9 = R$ 5.800.
	exec(`INSERT INTO market_events (user_id, event_type, unit_value) VALUES ($1, 'bot_initial_cash', 4000), ($2, 'bot_initial_cash', 1000), ($3, 'bot_initial_cash', 500)`, mm, idle, broke)
	exec(`INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value) VALUES ($1, $2, 'bot_initial_allocation', 200, 9)`, mm, acme)
	// Negócios: um dentro da janela de 5 dias (dia 18) e um fora (dia 3).
	exec(`INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value, simulated_day) VALUES
	      ($1, $2, 'sell_order_executed', 50, 10, 18), ($1, $2, 'sell_order_executed', 70, 10, 3)`, mm, acme)
	// Ordens do Market Maker: uma venda aberta a 10,20, uma compra aberta a 9,80, uma
	// executada e duas canceladas por motivos diferentes.
	exec(`INSERT INTO order_book (asset_id, user_id, type, side, quantity, filled_quantity, price, status, cancel_reason, simulated_day) VALUES
	      ($1, $2, 'limit', 'sell', 100, 0, 10.20, 'pending', NULL, 20),
	      ($1, $2, 'limit', 'buy', 100, 0, 9.80, 'pending', NULL, 20),
	      ($1, $2, 'limit', 'sell', 50, 50, 10.00, 'filled', NULL, 18),
	      ($1, $2, 'limit', 'buy', 50, 0, 9.50, 'cancelled', 'requoted', 19),
	      ($1, $2, 'limit', 'buy', 50, 0, 9.40, 'cancelled', 'admin', 19),
	      ($1, $2, 'limit', 'buy', 999, 0, 9.00, 'cancelled', 'expired', 1)`, acme, mm)
	// O chartista parado só tem ordem antiga (dia 5).
	exec(`INSERT INTO order_book (asset_id, user_id, type, side, quantity, price, status, simulated_day) VALUES ($1, $2, 'limit', 'buy', 10, 9, 'pending', 5)`, acme, idle)

	repo := NewAdminReadRepository(conn)

	t.Run("atividade do Market Maker", func(t *testing.T) {
		a, err := repo.BotActivity(ctx, mm, 5)
		if err != nil {
			t.Fatalf("BotActivity: %v", err)
		}
		if a.FromDay != 16 || a.ToDay != 20 {
			t.Errorf("janela = %d..%d, want 16..20", a.FromDay, a.ToDay)
		}
		// Patrimônio: caixa 5.000 + 100 ações x R$ 10 (última cotação) = 6.000; capital 5.800.
		if a.NetWorth() != 6000 || a.CapitalContributed != 5800 || a.PnL() != 200 {
			t.Errorf("patrimônio %v capital %v P&L %v, want 6000/5800/200", a.NetWorth(), a.CapitalContributed, a.PnL())
		}
		o := a.Orders
		if o.Sent != 5 || o.Filled != 1 || o.Open != 2 || o.Cancelled != 2 {
			t.Errorf("ordens = %+v (a expirada do dia 1 fica fora da janela)", o)
		}
		if o.CancelledByReason["requoted"] != 1 || o.CancelledByReason["admin"] != 1 {
			t.Errorf("cancelamentos por motivo = %v", o.CancelledByReason)
		}
		if a.Trades != 1 || a.Volume != 500 {
			t.Errorf("negócios %d volume %v, want 1 e 500 (o do dia 3 fica fora)", a.Trades, a.Volume)
		}
		if a.LastOrderDay == nil || *a.LastOrderDay != 20 || a.LastOrderAt == nil {
			t.Errorf("última ordem = %v / %v", a.LastOrderDay, a.LastOrderAt)
		}
		if len(a.Quotes) != 1 {
			t.Fatalf("cotações = %d, want 1", len(a.Quotes))
		}
		q := a.Quotes[0]
		if q.Ticker != "ACME3" || q.BestBid == nil || *q.BestBid != 9.80 || q.BestAsk == nil || *q.BestAsk != 10.20 {
			t.Errorf("cotação = %+v", q)
		}
		if q.HeldQuantity != 100 || q.TargetQuantity != 200 {
			t.Errorf("inventário %d/%d, want 100/200", q.HeldQuantity, q.TargetQuantity)
		}
	})

	t.Run("bot que nunca existiu ou conta humana é recusado", func(t *testing.T) {
		var human string
		if err := conn.QueryRowContext(ctx, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`).Scan(&human); err != nil {
			t.Fatal(err)
		}
		if _, err := repo.BotActivity(ctx, human, 30); !errors.Is(err, adminview.ErrBotNotFound) {
			t.Errorf("err = %v, want ErrBotNotFound", err)
		}
	})

	t.Run("resumo: parados, sem caixa, liquidez e concentração", func(t *testing.T) {
		s, err := repo.BotsSummary(ctx, 3)
		if err != nil {
			t.Fatalf("BotsSummary: %v", err)
		}
		if s.SimulatedDay != 20 || s.ActiveBotsCount != 3 {
			t.Errorf("dia %d ativos %d", s.SimulatedDay, s.ActiveBotsCount)
		}
		idleIDs := map[string]bool{}
		for _, b := range s.IdleBots {
			idleIDs[b.AccountID] = true
		}
		if len(s.IdleBots) != 2 || !idleIDs[idle] || !idleIDs[broke] || idleIDs[mm] {
			t.Errorf("parados = %+v, want o chartista (ordem no dia 5) e o ruído (nunca ordenou)", s.IdleBots)
		}
		if len(s.LowCashBots) != 1 || s.LowCashBots[0].AccountID != broke {
			t.Errorf("sem caixa = %+v, want só o ruído (R$ 1 de R$ 500)", s.LowCashBots)
		}
		if len(s.EmptyInventory) != 0 {
			t.Errorf("inventário vazio = %+v, want nenhum", s.EmptyInventory)
		}
		if len(s.Liquidity) != 1 || s.Liquidity[0].RestingByProvider["market_maker"] != 200 || s.Liquidity[0].RestingByProvider["chartista"] != 10 {
			t.Errorf("liquidez = %+v", s.Liquidity)
		}
		if len(s.Concentration) != 1 || s.Concentration[0].TopBotID != mm || s.Concentration[0].TopBotPct != 10 || s.Concentration[0].AllBotsPct != 10 {
			t.Errorf("concentração = %+v, want o Market Maker com 10%% (100 de 1000)", s.Concentration)
		}
	})

	t.Run("Market Maker sem ação no ativo coberto aparece em inventário vazio", func(t *testing.T) {
		exec(`UPDATE positions SET quantity = 0 WHERE user_id = $1`, mm)
		s, err := repo.BotsSummary(ctx, 3)
		if err != nil {
			t.Fatal(err)
		}
		if len(s.EmptyInventory) != 1 || s.EmptyInventory[0].AccountID != mm || s.EmptyInventory[0].Ticker != "ACME3" {
			t.Errorf("inventário vazio = %+v", s.EmptyInventory)
		}
	})
}
