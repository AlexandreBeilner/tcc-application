package db

import (
	"context"
	"os"
	"testing"

	"tcc-investimentos/engine/internal/domain/fixedincomeexecution"
	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// Ponto 063: ordem e renda fixa de ativo sandbox gravam o evento e a posição, mas nunca mexem
// no caixa da conta (`current_balance`, `total_invested`, `total_disinvested`); o ativo real
// segue debitando e creditando como antes. Roda só com TEST_DATABASE_URL (banco descartável).
func TestSandboxNaoMexeNoCaixa(t *testing.T) {
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
	account := func(user string) (balance, invested, disinvested float64) {
		t.Helper()
		err := conn.QueryRowContext(ctx,
			`SELECT current_balance, total_invested, total_disinvested FROM accounts WHERE user_id = $1`, user,
		).Scan(&balance, &invested, &disinvested)
		if err != nil {
			t.Fatal(err)
		}
		return balance, invested, disinvested
	}

	var user, sandboxEquity, liveEquity, sandboxBond string
	scan(&user, `INSERT INTO accounts (user_id, current_balance) VALUES (gen_random_uuid(), 10000.00) RETURNING user_id`)
	scan(&sandboxEquity, `INSERT INTO assets (ticker, name, type, is_sandbox) VALUES ('SAND3', 'Treino', 'acao', true) RETURNING id`)
	scan(&liveEquity, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme', 'acao') RETURNING id`)
	scan(&sandboxBond, `INSERT INTO assets (ticker, name, type, is_sandbox) VALUES ('SANDPRE', 'Treino RF', 'tesouro_prefixado', true) RETURNING id`)

	exec(`INSERT INTO fixed_income_assets (asset_id, issuer_type, minimum_investment) VALUES ($1, 'banco', 30)`, sandboxBond)

	orders := NewOrderExecutionRepository(conn, nil)
	buy := func(asset string, qty int) {
		t.Helper()
		req := orderexecution.Request{UserID: user, AssetID: asset, Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: qty}
		outcome := orderexecution.Outcome{Fills: []orderexecution.Fill{{Price: 100, Quantity: qty}}, FilledQuantity: qty}
		if _, err := orders.Persist(ctx, req, outcome); err != nil {
			t.Fatalf("Persist compra: %v", err)
		}
	}

	buy(sandboxEquity, 5)
	if balance, invested, _ := account(user); balance != 10000 || invested != 0 {
		t.Fatalf("compra sandbox mexeu no caixa: saldo %v, investido %v", balance, invested)
	}
	var qty int
	if err := conn.QueryRowContext(ctx, `SELECT quantity FROM positions WHERE user_id = $1 AND asset_id = $2`, user, sandboxEquity).Scan(&qty); err != nil || qty != 5 {
		t.Fatalf("posição sandbox = %d (err %v), want 5", qty, err)
	}
	var events int
	if err := conn.QueryRowContext(ctx, `SELECT count(*) FROM market_events WHERE user_id = $1 AND asset_id = $2`, user, sandboxEquity).Scan(&events); err != nil || events != 1 {
		t.Fatalf("eventos sandbox = %d (err %v), want 1 (event sourcing continua)", events, err)
	}

	sell := orderexecution.Request{UserID: user, AssetID: sandboxEquity, Side: orderbook.SideSell, Type: orderbook.TypeMarket, Quantity: 5}
	if _, err := orders.Persist(ctx, sell, orderexecution.Outcome{Fills: []orderexecution.Fill{{Price: 103, Quantity: 5}}, FilledQuantity: 5}); err != nil {
		t.Fatalf("Persist venda: %v", err)
	}
	if balance, invested, disinvested := account(user); balance != 10000 || invested != 0 || disinvested != 0 {
		t.Fatalf("venda sandbox mexeu no caixa: saldo %v, investido %v, desinvestido %v", balance, invested, disinvested)
	}

	buy(liveEquity, 10)
	if balance, invested, _ := account(user); balance != 9000 || invested != 1000 {
		t.Fatalf("compra real deveria debitar: saldo %v, investido %v", balance, invested)
	}

	bonds := NewFixedIncomeExecutionRepository(conn)
	purchase := fixedincomeexecution.PurchaseOutcome{
		UnitPrice: 1, QuantityPurchased: 500,
		NewPosition: fixedincomeposition.Position{Quantity: 500, AveragePrice: 1, AverageRate: 0.1},
	}
	if err := bonds.PersistPurchase(ctx, fixedincomeexecution.Request{UserID: user, AssetID: sandboxBond, Amount: 500}, purchase); err != nil {
		t.Fatalf("PersistPurchase: %v", err)
	}
	if balance, invested, _ := account(user); balance != 9000 || invested != 1000 {
		t.Fatalf("compra de renda fixa sandbox mexeu no caixa: saldo %v, investido %v", balance, invested)
	}
	if err := bonds.PersistRedeem(ctx, fixedincomeexecution.RedeemRequest{UserID: user, AssetID: sandboxBond}, fixedincomeexecution.RedeemOutcome{TotalValue: 520, NetValue: 515.5}); err != nil {
		t.Fatalf("PersistRedeem: %v", err)
	}
	if balance, _, disinvested := account(user); balance != 9000 || disinvested != 0 {
		t.Fatalf("resgate de renda fixa sandbox mexeu no caixa: saldo %v, desinvestido %v", balance, disinvested)
	}
}

// A migration 000055 devolve às contas existentes o que o Sandbox já debitou antes do ponto 063.
// O banco descartável já está migrado (a 55 rodou sobre tabelas vazias); aqui planta-se o estado
// antigo e roda-se o SQL da migration de novo.
func TestMigration55_DevolveOCaixaGastoEmSandbox(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := conn.ExecContext(ctx, query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	var user, sandbox, live string
	if err := conn.QueryRowContext(ctx, `INSERT INTO accounts (user_id, current_balance, total_invested, total_disinvested)
		VALUES (gen_random_uuid(), 8700.00, 1300.00, 0) RETURNING user_id`).Scan(&user); err != nil {
		t.Fatal(err)
	}
	if err := conn.QueryRowContext(ctx, `INSERT INTO assets (ticker, name, type, is_sandbox) VALUES ('SAND3', 'Treino', 'acao', true) RETURNING id`).Scan(&sandbox); err != nil {
		t.Fatal(err)
	}
	if err := conn.QueryRowContext(ctx, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme', 'acao') RETURNING id`).Scan(&live); err != nil {
		t.Fatal(err)
	}
	// Antes: comprou 5 de Sandbox (R$ 500) e 8 de ação real (R$ 800); saldo 10000 - 500 - 800 = 8700.
	exec(`INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value) VALUES ($1, $2, 'buy_order_executed', 5, 100.00)`, user, sandbox)
	exec(`INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value) VALUES ($1, $2, 'buy_order_executed', 8, 100.00)`, user, live)

	sqlBytes, err := os.ReadFile("migrations/000055_sandbox_cash_neutral.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	exec(string(sqlBytes))

	var balance, invested float64
	if err := conn.QueryRowContext(ctx, `SELECT current_balance, total_invested FROM accounts WHERE user_id = $1`, user).Scan(&balance, &invested); err != nil {
		t.Fatal(err)
	}
	if balance != 9200 || invested != 800 {
		t.Fatalf("saldo %v e investido %v, want 9200 e 800 (só a compra real fica)", balance, invested)
	}
}
