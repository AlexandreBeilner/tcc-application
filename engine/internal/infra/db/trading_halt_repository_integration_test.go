package db

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderexecution"
	"tcc-investimentos/engine/internal/domain/tradinghalt"
	"tcc-investimentos/engine/internal/infra/cache"
)

// Cobre as pausas de negociação (N.9) contra um Postgres real descartável (roda só com
// TEST_DATABASE_URL): unicidade da pausa vigente, retomada, e o efeito em LoadContext.
func TestTradingHaltRepository_PausaERetomada(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	scan := func(dest *string, query string, args ...any) {
		t.Helper()
		if err := conn.QueryRowContext(ctx, query, args...).Scan(dest); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	var user, acme, other, fixed, admin string
	scan(&user, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	scan(&acme, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme', 'acao') RETURNING id`)
	scan(&other, `INSERT INTO assets (ticker, name, type) VALUES ('OTHR3', 'Other', 'acao') RETURNING id`)
	scan(&fixed, `INSERT INTO assets (ticker, name, type) VALUES ('CDB1', 'CDB', 'cdb') RETURNING id`)
	scan(&admin, `SELECT gen_random_uuid()::text`)
	for _, a := range []string{acme, other} {
		if _, err := conn.ExecContext(ctx, `INSERT INTO variable_income_assets (asset_id, outstanding_shares) VALUES ($1, 1000)`, a); err != nil {
			t.Fatal(err)
		}
		if _, err := conn.ExecContext(ctx, `INSERT INTO asset_quotes (asset_id, simulated_day, price) VALUES ($1, 0, 10)`, a); err != nil {
			t.Fatal(err)
		}
	}
	halts := NewTradingHaltRepository(conn)
	orders := NewOrderExecutionRepository(conn, cache.NoopQuoteCache{})

	halted := func(assetID string) *orderexecution.HaltInfo {
		t.Helper()
		execCtx, err := orders.LoadContext(ctx, assetID, user)
		if err != nil {
			t.Fatalf("LoadContext: %v", err)
		}
		return execCtx.Halt
	}
	if halted(acme) != nil {
		t.Fatal("sem pausa, LoadContext não devia trazer Halt")
	}

	assetHalt, err := halts.Insert(ctx, mustHalt(t, tradinghalt.ScopeAsset, acme, "volatilidade", admin))
	if err != nil {
		t.Fatalf("Insert ativo: %v", err)
	}
	if assetHalt.ID == "" || assetHalt.Ticker == nil || *assetHalt.Ticker != "ACME3" || !assetHalt.Active() {
		t.Errorf("halt = %+v", assetHalt)
	}
	if h := halted(acme); h == nil || h.Global {
		t.Errorf("Halt de ACME3 = %+v, want pausa do ativo", h)
	}
	if halted(other) != nil {
		t.Error("a pausa de ACME3 não devia barrar OTHR3")
	}

	t.Run("pausa duplicada no mesmo escopo é recusada", func(t *testing.T) {
		_, err := halts.Insert(ctx, mustHalt(t, tradinghalt.ScopeAsset, acme, "de novo", admin))
		if !errors.Is(err, tradinghalt.ErrAlreadyHalted) {
			t.Errorf("err = %v, want ErrAlreadyHalted", err)
		}
	})

	t.Run("ativo inexistente e não negociável são recusados", func(t *testing.T) {
		_, err := halts.Insert(ctx, mustHalt(t, tradinghalt.ScopeAsset, "00000000-0000-4000-8000-000000000000", "m", admin))
		if !errors.Is(err, tradinghalt.ErrAssetNotFound) {
			t.Errorf("inexistente = %v, want ErrAssetNotFound", err)
		}
		_, err = halts.Insert(ctx, mustHalt(t, tradinghalt.ScopeAsset, fixed, "m", admin))
		if !errors.Is(err, tradinghalt.ErrAssetNotTradable) {
			t.Errorf("renda fixa = %v, want ErrAssetNotTradable", err)
		}
	})

	global, err := halts.Insert(ctx, mustHalt(t, tradinghalt.ScopeGlobal, "", "manutenção", admin))
	if err != nil {
		t.Fatalf("Insert global: %v", err)
	}
	t.Run("global e de ativo coexistem e a global vence", func(t *testing.T) {
		if h := halted(acme); h == nil || !h.Global {
			t.Errorf("Halt de ACME3 = %+v, want a global (mais restritiva)", h)
		}
		if h := halted(other); h == nil || !h.Global {
			t.Errorf("Halt de OTHR3 = %+v, want a global", h)
		}
		if _, err := halts.Insert(ctx, mustHalt(t, tradinghalt.ScopeGlobal, "", "outra", admin)); !errors.Is(err, tradinghalt.ErrAlreadyHalted) {
			t.Errorf("segunda global = %v, want ErrAlreadyHalted", err)
		}
		active, err := halts.Active(ctx)
		if err != nil || len(active) != 2 || active[0].Scope != tradinghalt.ScopeGlobal {
			t.Errorf("Active = %+v err = %v, want 2 com a global primeiro", active, err)
		}
	})

	t.Run("retomar a global deixa a do ativo vigente", func(t *testing.T) {
		lifted, err := halts.Lift(ctx, global.ID, admin)
		if err != nil || lifted.Active() || lifted.LiftedBy == nil {
			t.Fatalf("Lift = %+v err = %v", lifted, err)
		}
		if h := halted(acme); h == nil || h.Global {
			t.Errorf("Halt de ACME3 = %+v, want a do ativo", h)
		}
		if halted(other) != nil {
			t.Error("OTHR3 devia voltar a negociar")
		}
		if _, err := halts.Lift(ctx, global.ID, admin); !errors.Is(err, tradinghalt.ErrAlreadyLifted) {
			t.Errorf("retomar de novo = %v, want ErrAlreadyLifted", err)
		}
		if _, err := halts.Lift(ctx, "00000000-0000-4000-8000-000000000000", admin); !errors.Is(err, tradinghalt.ErrHaltNotFound) {
			t.Errorf("inexistente = %v, want ErrHaltNotFound", err)
		}
	})

	t.Run("depois de retomada dá pra pausar de novo e o histórico guarda a anterior", func(t *testing.T) {
		if _, err := halts.Lift(ctx, assetHalt.ID, admin); err != nil {
			t.Fatal(err)
		}
		if halted(acme) != nil {
			t.Error("com tudo retomado, ACME3 devia negociar")
		}
		if _, err := halts.Insert(ctx, mustHalt(t, tradinghalt.ScopeAsset, acme, "segunda vez", admin)); err != nil {
			t.Errorf("nova pausa depois de retomar = %v", err)
		}
		recent, err := halts.Recent(ctx, 10)
		if err != nil || len(recent) != 2 {
			t.Errorf("Recent = %d err = %v, want as 2 encerradas", len(recent), err)
		}
	})
}

func mustHalt(t *testing.T, scope tradinghalt.Scope, assetID, reason, by string) tradinghalt.Halt {
	t.Helper()
	h, err := tradinghalt.NewHalt(scope, assetID, reason, by)
	if err != nil {
		t.Fatal(err)
	}
	return h
}
