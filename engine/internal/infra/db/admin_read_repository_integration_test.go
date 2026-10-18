package db

import (
	"context"
	"testing"
)

// Cobre a visão geral do painel (N.5) contra um Postgres real (banco descartável;
// roda só com TEST_DATABASE_URL). Monta um mercado pequeno: uma ação com um Market
// Maker cobrindo e um usuário, e outra ação sem cobertura nem negócio.
func TestAdminReadRepository_VisaoGeral(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := conn.ExecContext(ctx, query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	var bot, user, covered, bare string
	if err := conn.QueryRowContext(ctx, `INSERT INTO accounts (user_id, is_bot) VALUES (gen_random_uuid(), true) RETURNING user_id`).Scan(&bot); err != nil {
		t.Fatal(err)
	}
	if err := conn.QueryRowContext(ctx, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`).Scan(&user); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO companies (name, cnpj, sector) VALUES ('Acme', '12345678000199', 'Energia')`)
	if err := conn.QueryRowContext(ctx, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme ON', 'acao') RETURNING id`).Scan(&covered); err != nil {
		t.Fatal(err)
	}
	if err := conn.QueryRowContext(ctx, `INSERT INTO assets (ticker, name, type) VALUES ('BARE3', 'Bare ON', 'acao') RETURNING id`).Scan(&bare); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO variable_income_assets (asset_id, company_id, outstanding_shares) SELECT $1, id, 1000 FROM companies LIMIT 1`, covered)
	exec(`INSERT INTO variable_income_assets (asset_id, outstanding_shares) VALUES ($1, 500)`, bare)
	exec(`INSERT INTO company_fundamentals (company_id, period_date, net_income) SELECT id, now(), 2000 FROM companies LIMIT 1`)
	exec(`INSERT INTO market_calendar (id, current_day, selic_rate) VALUES (1, 7, 10.75) ON CONFLICT (id) DO UPDATE SET current_day = 7, selic_rate = 10.75`)
	exec(`INSERT INTO asset_quotes (asset_id, simulated_day, price) VALUES ($1, 6, 20.00), ($1, 7, 22.00)`, covered)
	exec(`INSERT INTO bot_personalities (account_id, archetype, within_scope_pct, max_position_size_pct, market_order_preference, spread_width_pct, max_covered_assets)
	      VALUES ($1, 'market_maker', 1, 0.1, 0, 0.02, 10)`, bot)
	exec(`INSERT INTO market_maker_coverage (asset_id, mm_account_id) VALUES ($1, $2)`, covered, bot)
	exec(`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $3, 300, 20), ($2, $3, 40, 21)`, bot, user, covered)
	// Book: o bot vende 100 a 22,20 e compra 80 a 21,80; o usuário compra 20 a 21,80.
	exec(`INSERT INTO order_book (asset_id, user_id, type, side, quantity, price) VALUES
	      ($1, $2, 'limit', 'sell', 100, 22.20), ($1, $2, 'limit', 'buy', 80, 21.80), ($1, $3, 'limit', 'buy', 20, 21.80)`, covered, bot, user)
	exec(`INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value, simulated_day) VALUES ($1, $2, 'buy_order_executed', 10, 22.00, 7)`, user, covered)

	// Compra de ativo sandbox (Modo Aprendizado) nunca entra nos negócios do mercado do dia.
	exec(`INSERT INTO assets (ticker, name, type, is_sandbox) VALUES ('SAND3', 'Treino', 'acao', true)`)
	exec(`INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value, simulated_day)
	      SELECT $1, id, 'buy_order_executed', 5, 100.00, 7 FROM assets WHERE ticker = 'SAND3'`, user)

	repo := NewAdminReadRepository(conn)

	overview, err := repo.Overview(ctx)
	if err != nil {
		t.Fatalf("Overview: %v", err)
	}
	if overview.SimulatedDay != 7 || overview.SelicRate != 10.75 {
		t.Errorf("dia/selic = %d/%v, want 7/10,75", overview.SimulatedDay, overview.SelicRate)
	}
	if overview.TradableAssets != 2 || overview.UncoveredAssets != 1 {
		t.Errorf("ativos = %d (sem cobertura %d), want 2 (1)", overview.TradableAssets, overview.UncoveredAssets)
	}
	if overview.ActiveBots != 1 || overview.TotalBots != 1 || overview.RestingOrders != 3 {
		t.Errorf("bots/ordens = %d/%d/%d, want 1/1/3", overview.ActiveBots, overview.TotalBots, overview.RestingOrders)
	}
	if overview.Trades != 1 || overview.Volume != 220 {
		t.Errorf("negócios = %d, volume = %v, want 1 e 220", overview.Trades, overview.Volume)
	}
}
