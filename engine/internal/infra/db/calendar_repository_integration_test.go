package db

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/marketcalendar"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// Cobre a leitura de relevância do calendário (RC.6.1) contra um Postgres real
// (banco descartável; roda só com TEST_DATABASE_URL): posições abertas do próprio
// usuário e o snapshot de quem tem direito ao provento. O ponto principal é a
// privacidade (RNF09): nada de outro usuário sai, nem posição zerada, nem sandbox.
func TestCalendarRepository_PosicoesEDestinatariosDeProventos(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := conn.ExecContext(ctx, query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	insertID := func(query string, args ...any) string {
		t.Helper()
		var id string
		if err := conn.QueryRowContext(ctx, query, args...).Scan(&id); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
		return id
	}
	me := insertID(`INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	other := insertID(`INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	held := insertID(`INSERT INTO assets (ticker, name, type) VALUES ('HELD3', 'Held ON', 'acao') RETURNING id`)
	sold := insertID(`INSERT INTO assets (ticker, name, type) VALUES ('SOLD3', 'Sold ON', 'acao') RETURNING id`)
	fund := insertID(`INSERT INTO assets (ticker, name, type) VALUES ('FUND11', 'Fundo', 'fii') RETURNING id`)
	sandbox := insertID(`INSERT INTO assets (ticker, name, type, is_sandbox) VALUES ('SAND3', 'Sandbox', 'acao', true) RETURNING id`)
	for _, id := range []string{held, sold, fund, sandbox} {
		exec(`INSERT INTO variable_income_assets (asset_id, outstanding_shares) VALUES ($1, 1000)`, id)
	}
	exec(`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES
	      ($1, $3, 30, 10), ($1, $4, 0, 10), ($1, $5, 7, 10), ($1, $6, 5, 10), ($2, $3, 999, 10)`, me, other, held, sold, fund, sandbox)

	holdings, err := NewCalendarRepository(conn).HoldingsOf(ctx, me)
	if err != nil {
		t.Fatalf("HoldingsOf: %v", err)
	}
	got := map[string]marketcalendar.Holding{}
	for _, h := range holdings {
		got[h.Ticker] = h
	}
	if len(got) != 2 || got["HELD3"].Quantity != 30 || got["HELD3"].Class != "acao" || got["FUND11"].Class != "fii" {
		t.Errorf("posições = %+v, want só HELD3 (30) e FUND11, sem posição zerada, sandbox nem a de outro usuário", holdings)
	}

	// Provento de SOLD3: ex no dia 8, pagamento no 13. Eu e o outro usuário somos destinatários;
	// o de FUND11 só tem o outro. Fora da janela, nada.
	exDay, payDay := 8, 13
	event := insertID(`INSERT INTO dividend_events (asset_id, value_per_share, ex_date, payment_date, payment_day, declared_day, ex_day) VALUES ($1, 0.5, $2, $3, $4, $5, $5) RETURNING id`,
		sold, simcalendar.DateOf(exDay), simcalendar.DateOf(payDay), payDay, exDay)
	otherEvent := insertID(`INSERT INTO dividend_events (asset_id, value_per_share, ex_date, payment_date, payment_day, declared_day, ex_day) VALUES ($1, 1, $2, $3, $4, $5, $5) RETURNING id`,
		fund, simcalendar.DateOf(exDay), simcalendar.DateOf(payDay), payDay, exDay)
	exec(`INSERT INTO dividend_event_recipients (dividend_event_id, user_id, quantity) VALUES ($1, $2, 40), ($1, $3, 99), ($4, $3, 5)`, event, me, other, otherEvent)

	facts, err := NewCalendarRepository(conn).DividendRecipientsBetween(ctx, me, 8, 14)
	if err != nil {
		t.Fatalf("DividendRecipientsBetween: %v", err)
	}
	if len(facts) != 1 || facts[0].Ticker != "SOLD3" || facts[0].Quantity != 40 || facts[0].ExDay != exDay || facts[0].PaymentDay != payDay {
		t.Errorf("destinatários = %+v, want só o snapshot dele (SOLD3, 40)", facts)
	}
	outside, err := NewCalendarRepository(conn).DividendRecipientsBetween(ctx, me, 20, 30)
	if err != nil || len(outside) != 0 {
		t.Errorf("fora da janela = %+v, %v", outside, err)
	}
}
