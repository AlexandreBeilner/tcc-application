package db

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/adminview"
)

// Cobre o monitor de mercado (N.8) contra um Postgres real (banco descartável;
// roda só com TEST_DATABASE_URL). Monta um mercado pequeno: uma ação com um Market
// Maker cobrindo e um usuário, e outra ação sem cobertura nem negócio.
func TestAdminMarketRepository_MonitorEDetalheDoAtivo(t *testing.T) {
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

	repo := NewAdminReadRepository(conn)

	assets, err := repo.MarketAssets(ctx)
	if err != nil {
		t.Fatalf("MarketAssets: %v", err)
	}
	if len(assets) != 2 || assets[0].Ticker != "ACME3" || assets[1].Ticker != "BARE3" {
		t.Fatalf("assets = %+v, want ACME3 e BARE3 por ticker", assets)
	}
	acme, bare3 := assets[0], assets[1]
	if acme.LastPrice == nil || *acme.LastPrice != 22 || acme.PreviousPrice == nil || *acme.PreviousPrice != 20 {
		t.Errorf("preços = %v/%v, want 22/20", acme.LastPrice, acme.PreviousPrice)
	}
	if acme.BestBid == nil || *acme.BestBid != 21.8 || acme.BestAsk == nil || *acme.BestAsk != 22.2 {
		t.Errorf("bid/ask = %v/%v, want 21,8/22,2", acme.BestBid, acme.BestAsk)
	}
	if acme.RestingOrders != 3 || acme.BotRestingOrders != 2 {
		t.Errorf("ordens em repouso = %d (bot %d), want 3 (2)", acme.RestingOrders, acme.BotRestingOrders)
	}
	if acme.DayTrades != 1 || acme.DayVolume != 10 {
		t.Errorf("negócios do dia = %d/%d, want 1/10", acme.DayTrades, acme.DayVolume)
	}
	if acme.HeldByBots != 300 || acme.HeldByUsers != 40 || !acme.Covered {
		t.Errorf("posse = %d/%d coberto=%v, want 300/40 coberto", acme.HeldByBots, acme.HeldByUsers, acme.Covered)
	}
	// P/L = 22 / (2000/1000) = 11.
	if acme.Indicator == nil || acme.Indicator.Kind != adminview.IndicatorPriceToEarnings || acme.Indicator.Value != 11 {
		t.Errorf("indicador = %+v, want P/L 11", acme.Indicator)
	}
	// Ativo sem cotação, book, negócio nem cobertura aparece vazio, sem quebrar.
	if bare3.LastPrice != nil || bare3.BestBid != nil || bare3.RestingOrders != 0 || bare3.Covered || bare3.Indicator != nil {
		t.Errorf("BARE3 = %+v, want vazio e sem cobertura", bare3)
	}

	detail, err := repo.AssetDetail(ctx, covered)
	if err != nil {
		t.Fatalf("AssetDetail: %v", err)
	}
	if len(detail.Bids) != 1 || detail.Bids[0].Quantity != 100 || detail.Bids[0].BotQuantity != 80 {
		t.Errorf("bids = %+v, want um nível de 100 (80 de bot)", detail.Bids)
	}
	if len(detail.Asks) != 1 || detail.Asks[0].Price != 22.2 || detail.Asks[0].BotQuantity != 100 {
		t.Errorf("asks = %+v, want um nível a 22,2 todo de bot", detail.Asks)
	}
	if len(detail.Trades) != 1 || detail.Trades[0].BuyerIsBot || len(detail.Quotes) != 2 || detail.Quotes[0].SimulatedDay != 6 {
		t.Errorf("trades/quotes = %+v / %+v", detail.Trades, detail.Quotes)
	}

	if _, err := repo.AssetDetail(ctx, "00000000-0000-4000-8000-000000000000"); !errors.Is(err, adminview.ErrAssetNotFound) {
		t.Errorf("AssetDetail inexistente = %v, want ErrAssetNotFound", err)
	}
}
