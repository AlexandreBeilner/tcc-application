package db

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/fixedincomeexecution"
	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/domain/integrity"
)

// Resgate de ativo real com lucro: o caixa recebe o LÍQUIDO de IR, e o evento imutável grava o
// mesmo valor, então a verificação de integridade (replay dos eventos) continua sem divergência.
// Antes o crédito e o evento usavam o bruto e o IR mostrado ao usuário nunca saía da conta.
// Roda só com TEST_DATABASE_URL (banco descartável).
func TestPersistRedeem_CreditaOLiquidoDeIR(t *testing.T) {
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

	var user, bond string
	scan(&user, `INSERT INTO accounts (user_id, current_balance) VALUES (gen_random_uuid(), 10000.00) RETURNING user_id`)
	scan(&bond, `INSERT INTO assets (ticker, name, type) VALUES ('CDBX', 'CDB Teste', 'cdb') RETURNING id`)
	exec(`INSERT INTO fixed_income_assets (asset_id, issuer_type, minimum_investment) VALUES ($1, 'banco', 30)`, bond)
	exec(`INSERT INTO market_events (user_id, event_type, unit_value) VALUES ($1, 'initial_deposit', 10000.00)`, user)

	bonds := NewFixedIncomeExecutionRepository(conn)
	purchase := fixedincomeexecution.PurchaseOutcome{
		UnitPrice: 1000, QuantityPurchased: 5,
		NewPosition: fixedincomeposition.Position{Quantity: 5, AveragePrice: 1000, AverageRate: 0.1},
	}
	if err := bonds.PersistPurchase(ctx, fixedincomeexecution.Request{UserID: user, AssetID: bond, Amount: 5000}, purchase); err != nil {
		t.Fatalf("PersistPurchase: %v", err)
	}

	// Lucro de R$ 400 com alíquota de 22,5%: IR de R$ 90, líquido de R$ 5.310.
	outcome := fixedincomeexecution.RedeemOutcome{TotalValue: 5400, NetValue: 5310, TaxRate: 0.225}
	if err := bonds.PersistRedeem(ctx, fixedincomeexecution.RedeemRequest{UserID: user, AssetID: bond}, outcome); err != nil {
		t.Fatalf("PersistRedeem: %v", err)
	}

	var balance, disinvested float64
	if err := conn.QueryRowContext(ctx,
		`SELECT current_balance, total_disinvested FROM accounts WHERE user_id = $1`, user,
	).Scan(&balance, &disinvested); err != nil {
		t.Fatal(err)
	}
	if balance != 10310 || disinvested != 5310 {
		t.Fatalf("saldo %v e desinvestido %v, want 10310 e 5310 (líquido de IR)", balance, disinvested)
	}

	var eventValue float64
	if err := conn.QueryRowContext(ctx,
		`SELECT unit_value FROM market_events WHERE user_id = $1 AND event_type = 'fixed_income_redemption'`, user,
	).Scan(&eventValue); err != nil {
		t.Fatal(err)
	}
	if eventValue != 5310 {
		t.Fatalf("evento de resgate com unit_value %v, want 5310 (o mesmo valor creditado)", eventValue)
	}

	svc := integrity.NewService(NewIntegrityRepository(conn))
	if _, err := svc.Start(); err != nil {
		t.Fatal(err)
	}
	svc.Wait()
	run, _ := svc.Latest()
	if run.Status != integrity.StatusDone || run.Report == nil {
		t.Fatalf("verificação falhou: %+v", run)
	}
	if run.Report.Total != 0 {
		t.Fatalf("resgate deveria manter a base coerente: %+v", run.Report.Divergences)
	}
}
