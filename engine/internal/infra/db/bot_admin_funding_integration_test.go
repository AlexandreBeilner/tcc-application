package db

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/botadmin"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/coverage"
	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/orderexecution"
	"tcc-investimentos/engine/internal/domain/position"
)

// Cobre a edição de personalidade e o aporte do painel de bots (N.15) contra um Postgres
// real descartável (roda só com TEST_DATABASE_URL): o aporte entra por evento imutável e
// projeta saldo e posição, o teto de float desfaz o aporte inteiro, e a edição troca o
// escopo por inteiro sem tocar arquétipo, preferência por ordem a mercado nem caixa.
func TestBotAdminRepository_EditarPersonalidadeEAportar(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	repo := NewBotAdminRepository(conn)
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := conn.ExecContext(ctx, query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}

	var acme, full string
	if err := conn.QueryRowContext(ctx, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme', 'acao') RETURNING id`).Scan(&acme); err != nil {
		t.Fatal(err)
	}
	if err := conn.QueryRowContext(ctx, `INSERT INTO assets (ticker, name, type) VALUES ('FULL3', 'Full', 'acao') RETURNING id`).Scan(&full); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO variable_income_assets (asset_id, outstanding_shares) VALUES ($1, 1000), ($2, 100)`, acme, full)
	exec(`INSERT INTO asset_quotes (asset_id, simulated_day, price) VALUES ($1, 1, 9.00), ($1, 2, 10.00), ($2, 2, 5.00)`, acme, full)

	scope, _ := bot.NewSpecializationScope([]catalog.Sector{catalog.SectorBancario}, nil, []catalog.AssetType{catalog.AssetFII}, 0.9)
	risk, _ := bot.NewRiskProfile(0.3, 0.4, 0.02)
	level := 0.5
	fundamentalist, _ := bot.NewPersonality(bot.ArchetypeFundamentalista, scope, &level, risk)
	botID := botadmin.NewAdminBotID(1)
	if err := repo.CreateBot(ctx, botID, 1000, fundamentalist); err != nil {
		t.Fatal(err)
	}
	// O ativo FULL3 já está com o float inteiro distribuído a outro detentor.
	var holder string
	if err := conn.QueryRowContext(ctx, `INSERT INTO accounts (user_id, is_bot) VALUES (gen_random_uuid(), true) RETURNING user_id`).Scan(&holder); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $2, 100, 5)`, holder, full)

	t.Run("FundingTarget traz cotação mais recente e cotas em circulação", func(t *testing.T) {
		target, ok, err := repo.FundingTarget(ctx, acme)
		if err != nil || !ok {
			t.Fatalf("FundingTarget = %v, %v", ok, err)
		}
		if target.LastPrice != 10 || target.OutstandingShares != 1000 || target.Ticker != "ACME3" {
			t.Errorf("target = %+v", target)
		}
		if _, ok, _ := repo.FundingTarget(ctx, botID); ok {
			t.Error("conta que não é ativo devolveu alvo")
		}
	})

	t.Run("aporte de caixa e posição grava eventos, saldo e posição com preço médio", func(t *testing.T) {
		exec(`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $2, 100, 8)`, botID, acme)
		lines := []botadmin.FundingLine{{AssetID: acme, Quantity: 100, Price: 10, OutstandingShares: 1000}}
		if err := repo.FundBot(ctx, botID, 2500, lines); err != nil {
			t.Fatalf("FundBot: %v", err)
		}
		got, _, _ := repo.Find(ctx, botID)
		if got.Cash != 3500 {
			t.Errorf("caixa = %v, want 3500", got.Cash)
		}
		if len(got.Holdings) != 1 || got.Holdings[0].Quantity != 200 || got.Holdings[0].AveragePrice != 9 {
			t.Errorf("posição = %+v, want 200 a R$ 9 (média de 100 a 8 e 100 a 10)", got.Holdings)
		}
		var cashEvents, allocEvents int
		if err := conn.QueryRowContext(ctx,
			`SELECT COUNT(*) FILTER (WHERE event_type = 'bot_initial_cash' AND unit_value = 2500 AND asset_id IS NULL),
			        COUNT(*) FILTER (WHERE event_type = 'bot_initial_allocation' AND quantity = 100 AND unit_value = 10 AND asset_id = $2)
			 FROM market_events WHERE user_id = $1`, botID, acme,
		).Scan(&cashEvents, &allocEvents); err != nil || cashEvents != 1 || allocEvents != 1 {
			t.Errorf("eventos de caixa/alocação = %d/%d (err %v), want 1/1", cashEvents, allocEvents, err)
		}
	})

	t.Run("só caixa não grava alocação", func(t *testing.T) {
		if err := repo.FundBot(ctx, botID, 500, nil); err != nil {
			t.Fatal(err)
		}
		got, _, _ := repo.Find(ctx, botID)
		if got.Cash != 4000 {
			t.Errorf("caixa = %v, want 4000", got.Cash)
		}
	})

	t.Run("teto de float desfaz o aporte inteiro, inclusive o caixa", func(t *testing.T) {
		lines := []botadmin.FundingLine{
			{AssetID: acme, Quantity: 10, Price: 10, OutstandingShares: 1000},
			{AssetID: full, Quantity: 1, Price: 5, OutstandingShares: 100},
		}
		before, _, _ := repo.Find(ctx, botID)
		err := repo.FundBot(ctx, botID, 9999, lines)
		if err == nil || !errors.Is(err, position.ErrFloatExceeded) {
			t.Fatalf("err = %v, want estouro de float", err)
		}
		after, _, _ := repo.Find(ctx, botID)
		if after.Cash != before.Cash || len(after.Holdings) != len(before.Holdings) || after.Holdings[0].Quantity != before.Holdings[0].Quantity {
			t.Errorf("aporte recusado deixou rastro: antes %+v, depois %+v", before, after)
		}
		var events int
		if err := conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM market_events WHERE user_id = $1 AND unit_value = 9999`, botID).Scan(&events); err != nil || events != 0 {
			t.Errorf("eventos do aporte recusado = %d (err %v), want 0", events, err)
		}
	})

	t.Run("bot inexistente e conta humana são recusados", func(t *testing.T) {
		if err := repo.FundBot(ctx, botadmin.NewAdminBotID(99), 100, nil); !errors.Is(err, botadmin.ErrBotNotFound) {
			t.Errorf("err = %v, want ErrBotNotFound", err)
		}
		var human string
		if err := conn.QueryRowContext(ctx, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`).Scan(&human); err != nil {
			t.Fatal(err)
		}
		if err := repo.FundBot(ctx, human, 100, nil); !errors.Is(err, botadmin.ErrBotNotFound) {
			t.Errorf("conta humana: err = %v, want ErrBotNotFound", err)
		}
	})

	t.Run("editar personalidade troca o escopo por inteiro e preserva o resto", func(t *testing.T) {
		newScope, _ := bot.NewSpecializationScope([]catalog.Sector{catalog.SectorVarejo, catalog.SectorEnergia}, []equity.RiskClass{equity.RiskClassConservador}, nil, 0.87)
		newRisk, _ := bot.NewRiskProfile(0.15, 0.9, 0.05)
		newLevel := 0.8
		edited, err := bot.NewPersonality(bot.ArchetypeFundamentalista, newScope, &newLevel, newRisk)
		if err != nil {
			t.Fatal(err)
		}
		if err := repo.UpdatePersonality(ctx, botID, edited); err != nil {
			t.Fatalf("UpdatePersonality: %v", err)
		}
		got, _, _ := repo.Find(ctx, botID)
		p := got.Personality
		if len(p.Scope.Sectors) != 2 || len(p.Scope.RiskClasses) != 1 || len(p.Scope.AssetClasses) != 0 || p.Scope.WithinScopePct != 0.87 {
			t.Errorf("escopo = %+v", p.Scope)
		}
		if p.RiskProfile.MaxPositionSizePct != 0.15 || p.RiskProfile.SpreadWidthPct != 0.05 || *p.KnowledgeLevel != 0.8 {
			t.Errorf("perfil = %+v", p.RiskProfile)
		}
		// A preferência por ordem a mercado é gravada pelo UpdatePersonality? Não: continua 0,4.
		if p.RiskProfile.MarketOrderPreference != 0.4 {
			t.Errorf("preferência por ordem a mercado = %v, want 0,4 (intocada)", p.RiskProfile.MarketOrderPreference)
		}
		if got.Cash != 4000 {
			t.Errorf("caixa = %v, edição não mexe em saldo", got.Cash)
		}
		if err := repo.UpdatePersonality(ctx, botadmin.NewAdminBotID(99), edited); !errors.Is(err, botadmin.ErrBotNotFound) {
			t.Errorf("err = %v, want ErrBotNotFound", err)
		}
	})

	t.Run("fluxo completo pelo serviço: edita o Market Maker sem perder a cobertura", func(t *testing.T) {
		coverageRepo := NewCoverageRepository(conn)
		mmScope, _ := bot.NewSpecializationScope([]catalog.Sector{catalog.SectorBancario}, nil, nil, 0.9)
		mmPersonality, _ := bot.NewPersonality(bot.ArchetypeMarketMaker, mmScope, nil, risk)
		mmID := coverage.NewMarketMakerID(0)
		if err := repo.CreateBot(ctx, mmID, 10000, mmPersonality); err != nil {
			t.Fatal(err)
		}
		if err := coverageRepo.ProvisionCoverage(ctx, coverage.Provision{AssetID: acme, MMAccountID: mmID}); err != nil {
			t.Fatal(err)
		}
		svc := botadmin.NewService(repo, repo, coverageRepo, coverageRepo, orderexecution.NewAdminService(NewOrderExecutionRepository(conn, nil)))
		spread := 0.03
		updated, err := svc.Update(ctx, mmID, botadmin.UpdateInput{SpreadWidthPct: &spread})
		if err != nil {
			t.Fatalf("Update: %v", err)
		}
		if updated.Personality.RiskProfile.SpreadWidthPct != 0.03 || len(updated.Covered) != 1 || *updated.Personality.MaxCoveredAssets != bot.DefaultMaxCoveredAssets {
			t.Errorf("Market Maker = %+v", updated)
		}
	})
}
