package db

import (
	"context"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/adminexport"
	"tcc-investimentos/engine/internal/domain/integrity"
)

// Cobre a verificação de integridade (N.21) contra um Postgres real descartável (roda só
// com TEST_DATABASE_URL): uma base coerente dá zero divergências e cada divergência plantada
// é encontrada e classificada.
func TestIntegrityRepository_BaseConsistenteEDivergenciasPlantadas(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	scan := func(dest *string, query string, args ...any) {
		t.Helper()
		if err := conn.QueryRowContext(ctx, query, args...).Scan(dest); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := conn.ExecContext(ctx, query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	var user, bot, acme string
	scan(&user, `INSERT INTO accounts (user_id, current_balance) VALUES (gen_random_uuid(), 9900.00) RETURNING user_id`)
	scan(&bot, `INSERT INTO accounts (user_id, current_balance, is_bot) VALUES (gen_random_uuid(), 50100.00, true) RETURNING user_id`)
	scan(&acme, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme', 'acao') RETURNING id`)
	exec(`INSERT INTO variable_income_assets (asset_id, outstanding_shares) VALUES ($1, 100)`, acme)
	// Histórico coerente: R$ 10.000 de capital, bot com R$ 50.000 e float de 100 cotas;
	// o usuário compra 10 cotas a R$ 10,00 do bot.
	exec(`INSERT INTO market_events (user_id, event_type, unit_value) VALUES ($1, 'initial_deposit', 10000.00)`, user)
	exec(`INSERT INTO market_events (user_id, event_type, unit_value) VALUES ($1, 'bot_initial_cash', 50000.00)`, bot)
	exec(`INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value) VALUES ($1, $2, 'bot_initial_allocation', 100, 10.00)`, bot, acme)
	exec(`INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value) VALUES ($1, $2, 'buy_order_executed', 10, 10.00)`, user, acme)
	exec(`INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value) VALUES ($1, $2, 'sell_order_executed', 10, 10.00)`, bot, acme)
	exec(`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $2, 10, 10.00)`, user, acme)
	exec(`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $2, 90, 10.00)`, bot, acme)

	check := func() integrity.Report {
		t.Helper()
		svc := integrity.NewService(NewIntegrityRepository(conn))
		if _, err := svc.Start(); err != nil {
			t.Fatal(err)
		}
		svc.Wait()
		run, _ := svc.Latest()
		if run.Status != integrity.StatusDone || run.Report == nil {
			t.Fatalf("verificação falhou: %+v", run)
		}
		return *run.Report
	}

	report := check()
	if report.Total != 0 {
		t.Fatalf("base coerente deveria ter zero divergências: %+v", report.Divergences)
	}
	if report.Checked.Events != 5 || report.Checked.Accounts != 2 || report.Checked.Positions != 2 || report.Checked.Assets != 1 {
		t.Fatalf("contagem conferida errada: %+v", report.Checked)
	}

	// Plantando: saldo adulterado, posição adulterada, float adulterado, ordem sem fundos.
	exec(`UPDATE accounts SET current_balance = 9950.00 WHERE user_id = $1`, user)
	exec(`UPDATE positions SET quantity = 12 WHERE user_id = $1`, user)
	exec(`UPDATE variable_income_assets SET outstanding_shares = 110 WHERE asset_id = $1`, acme)
	exec(`INSERT INTO order_book (asset_id, user_id, type, side, quantity, price) VALUES ($1, $2, 'limit', 'buy', 5000, 10.00)`, acme, user)

	report = check()
	want := map[integrity.Kind]int{
		integrity.KindBalanceMismatch:      1,
		integrity.KindPositionMismatch:     1,
		integrity.KindFloatMismatch:        1,
		integrity.KindRestingOrderUnfunded: 1,
	}
	for kind, n := range want {
		if report.Counts[kind] != n {
			t.Errorf("categoria %s: %d; quer %d (lista %+v)", kind, report.Counts[kind], n, report.Divergences)
		}
	}
	if report.Total != 4 {
		t.Fatalf("total = %d; quer 4: %+v", report.Total, report.Divergences)
	}
	for _, d := range report.Divergences {
		if d.Kind == integrity.KindBalanceMismatch && (d.UserID != user || d.Expected != "9900.00" || d.Found != "9950.00") {
			t.Errorf("divergência de saldo errada: %+v", d)
		}
	}
}

func TestAdminExportRepository_PeriodoETeto(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	var user, acme string
	if err := conn.QueryRowContext(ctx, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`).Scan(&user); err != nil {
		t.Fatal(err)
	}
	if err := conn.QueryRowContext(ctx, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme', 'acao') RETURNING id`).Scan(&acme); err != nil {
		t.Fatal(err)
	}
	base := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 5; i++ {
		at := base.Add(time.Duration(i) * 24 * time.Hour)
		if _, err := conn.ExecContext(ctx, `INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value, "timestamp") VALUES ($1, $2, 'buy_order_executed', 1, 10.00, $3)`, user, acme, at); err != nil {
			t.Fatal(err)
		}
		if _, err := conn.ExecContext(ctx, `INSERT INTO order_book (asset_id, user_id, type, side, quantity, price, created_at) VALUES ($1, $2, 'limit', 'buy', 1, 10.00, $3)`, acme, user, at); err != nil {
			t.Fatal(err)
		}
	}
	repo := NewAdminExportRepository(conn)

	from := base.Add(24 * time.Hour)
	to := base.Add(3 * 24 * time.Hour)
	events, truncated, err := repo.ExportEvents(ctx, adminexport.Range{From: &from, To: &to}, 100)
	if err != nil || truncated || len(events) != 3 {
		t.Fatalf("período inclusivo deveria trazer 3 eventos: %d, truncado=%v, err=%v", len(events), truncated, err)
	}
	if events[0].Ticker != "ACME3" || events[0].EventType != "buy_order_executed" || events[0].UnitValue == nil || *events[0].UnitValue != "10.00" {
		t.Fatalf("linha de evento inesperada: %+v", events[0])
	}

	events, truncated, err = repo.ExportEvents(ctx, adminexport.Range{}, 2)
	if err != nil || !truncated || len(events) != 2 {
		t.Fatalf("teto de 2 deveria cortar e marcar truncado: %d, %v, %v", len(events), truncated, err)
	}

	orders, truncated, err := repo.ExportOrders(ctx, adminexport.Range{From: &from}, 100)
	if err != nil || truncated || len(orders) != 4 {
		t.Fatalf("ordens desde o dia 2 deveriam ser 4: %d, %v, %v", len(orders), truncated, err)
	}
	if orders[0].Price != "10.00" || orders[0].Status != "pending" || orders[0].IsBot {
		t.Fatalf("linha de ordem inesperada: %+v", orders[0])
	}
}
