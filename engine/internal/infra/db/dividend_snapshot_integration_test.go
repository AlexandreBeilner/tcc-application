package db

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/simcalendar"
	"tcc-investimentos/engine/internal/domain/tick"
)

// Cobre a RC.6.11 contra Postgres real (banco descartável): provento declarado antes da
// data-ex fica sem snapshot, só entra na fila na data-ex, o snapshot é gravado com a
// posição do momento e só então o provento fica elegível ao pagamento.
func TestDividendSnapshot_DeclaracaoSnapshotNaDataExEPagamento(t *testing.T) {
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
	holder := insertID(`INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	flat := insertID(`INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	asset := insertID(`INSERT INTO assets (ticker, name, type) VALUES ('DECL3', 'Declara ON', 'acao') RETURNING id`)
	quiet := insertID(`INSERT INTO assets (ticker, name, type) VALUES ('QUIE3', 'Quieta ON', 'acao') RETURNING id`)
	for _, id := range []string{asset, quiet} {
		exec(`INSERT INTO variable_income_assets (asset_id, outstanding_shares) VALUES ($1, 1000)`, id)
	}
	exec(`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $3, 12, 10), ($2, $3, 0, 10), ($1, $4, 99, 10)`, holder, flat, asset, quiet)

	// Declarado no dia 91, data-ex no 95, pagamento no 105, ainda sem snapshot.
	declared, exDay, payDay := 91, 95, 105
	event := insertID(`INSERT INTO dividend_events (asset_id, value_per_share, ex_date, payment_date, payment_day, declared_day, ex_day, recipients_snapshotted)
	                   VALUES ($1, 0.5, $2, $3, $4, $5, $6, false) RETURNING id`,
		asset, simcalendar.DateOf(exDay), simcalendar.DateOf(payDay), payDay, declared, exDay)
	repo := NewTickRepository(conn, nil)

	if got, err := repo.ListDividendsAwaitingSnapshot(ctx, exDay-1); err != nil || len(got) != 0 {
		t.Fatalf("antes da data-ex: %+v, %v", got, err)
	}
	awaiting, err := repo.ListDividendsAwaitingSnapshot(ctx, exDay)
	if err != nil || len(awaiting) != 1 || awaiting[0].EventID != event || awaiting[0].AssetID != asset {
		t.Fatalf("na data-ex: %+v, %v", awaiting, err)
	}
	if pending, err := repo.ListPendingDividendPayments(ctx, payDay); err != nil || len(pending) != 0 {
		t.Fatalf("sem snapshot o provento não pode ser pago: %+v, %v", pending, err)
	}

	holders, err := repo.ListDividendHolders(ctx, []string{asset})
	if err != nil || len(holders) != 1 || len(holders[asset]) != 1 || holders[asset][0].UserID != holder || holders[asset][0].Quantity != 12 {
		t.Fatalf("holders só do ativo pedido, sem posição zerada: %+v, %v", holders, err)
	}

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := saveDividendSnapshots(ctx, tx, []tick.DividendSnapshot{{EventID: event, Recipients: holders[asset]}}); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	if got, _ := repo.ListDividendsAwaitingSnapshot(ctx, exDay); len(got) != 0 {
		t.Errorf("depois do snapshot não deveria sobrar fila: %+v", got)
	}
	if got, err := repo.ListPendingDividendPayments(ctx, payDay-1); err != nil || len(got) != 0 {
		t.Errorf("antes do pagamento não deveria listar: %+v, %v", got, err)
	}
	pending, err := repo.ListPendingDividendPayments(ctx, payDay)
	if err != nil || len(pending) != 1 || len(pending[0].Recipients) != 1 || pending[0].Recipients[0].Quantity != 12 {
		t.Errorf("pagamento com o snapshot: %+v, %v", pending, err)
	}
}
