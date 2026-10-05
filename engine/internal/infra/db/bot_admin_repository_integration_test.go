package db

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/botadmin"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/coverage"
)

// Cobre o painel de bots (N.1) contra um Postgres real descartável (roda só com
// TEST_DATABASE_URL): criação atômica com o evento de caixa, listagem com
// cobertura e posições, interruptor sem tocar saldo e reatribuição de cobertura.
func TestBotAdminRepository_CriarListarEAlterar(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	repo := NewBotAdminRepository(conn)
	coverageRepo := NewCoverageRepository(conn)

	var acme, other, fixed string
	for _, a := range []struct {
		dest   *string
		ticker string
		kind   string
	}{{&acme, "ACME3", "acao"}, {&other, "OTHR3", "acao"}, {&fixed, "CDB1", "cdb"}} {
		if err := conn.QueryRowContext(ctx, `INSERT INTO assets (ticker, name, type) VALUES ($1, $1, $2) RETURNING id`, a.ticker, a.kind).Scan(a.dest); err != nil {
			t.Fatal(err)
		}
	}

	scope, err := bot.NewSpecializationScope([]catalog.Sector{catalog.SectorBancario}, nil, []catalog.AssetType{catalog.AssetFII}, 0.9)
	if err != nil {
		t.Fatal(err)
	}
	risk, _ := bot.NewRiskProfile(0.3, 0.4, 0.02)
	chartist, _ := bot.NewPersonality(bot.ArchetypeChartista, scope, nil, risk)
	marketMaker, _ := bot.NewPersonality(bot.ArchetypeMarketMaker, scope, nil, risk)

	chartistID, marketMakerID := botadmin.NewAdminBotID(1), coverage.NewMarketMakerID(0)

	t.Run("cria conta e personalidade juntas, com o caixa por evento", func(t *testing.T) {
		if err := repo.CreateBot(ctx, chartistID, 25000, chartist); err != nil {
			t.Fatalf("CreateBot: %v", err)
		}
		if err := repo.CreateBot(ctx, marketMakerID, 80000, marketMaker); err != nil {
			t.Fatalf("CreateBot MM: %v", err)
		}
		var events int
		if err := conn.QueryRowContext(ctx,
			`SELECT COUNT(*) FROM market_events WHERE user_id = $1 AND event_type = 'bot_initial_cash' AND unit_value = 25000`, chartistID,
		).Scan(&events); err != nil || events != 1 {
			t.Errorf("eventos de caixa = %d (err %v), want 1", events, err)
		}
		if n, _ := repo.CountAdminBots(ctx); n != 1 {
			t.Errorf("CountAdminBots = %d, want 1 (o Market Maker usa o esquema de cobertura)", n)
		}
	})

	t.Run("ID repetido é recusado e não deixa personalidade órfã", func(t *testing.T) {
		err := repo.CreateBot(ctx, chartistID, 1000, chartist)
		if !errors.Is(err, account.ErrAlreadyExists) {
			t.Errorf("err = %v, want ErrAlreadyExists", err)
		}
	})

	t.Run("lista com escopo, arquétipo e ativos sem cobertura", func(t *testing.T) {
		listing, err := repo.List(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(listing.Bots) != 2 {
			t.Fatalf("bots = %d, want 2", len(listing.Bots))
		}
		got, found, err := repo.Find(ctx, chartistID)
		if err != nil || !found {
			t.Fatalf("Find = %v, %v", found, err)
		}
		if got.Personality.Archetype != bot.ArchetypeChartista || got.Cash != 25000 || !got.IsActive ||
			len(got.Personality.Scope.Sectors) != 1 || len(got.Personality.Scope.AssetClasses) != 1 || got.Personality.Scope.WithinScopePct != 0.9 {
			t.Errorf("bot = %+v", got)
		}
		if len(listing.UncoveredAssets) != 2 {
			t.Errorf("sem cobertura = %+v, want ACME3 e OTHR3 (renda fixa não conta)", listing.UncoveredAssets)
		}
		if _, found, _ := repo.Find(ctx, botadmin.NewAdminBotID(99)); found {
			t.Error("Find de ID inexistente devolveu bot")
		}
	})

	t.Run("cobertura e posição aparecem na listagem", func(t *testing.T) {
		if err := coverageRepo.ProvisionCoverage(ctx, coverage.Provision{AssetID: acme, MMAccountID: marketMakerID}); err != nil {
			t.Fatal(err)
		}
		if _, err := conn.ExecContext(ctx, `INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $2, 40, 12.5), ($1, $3, 0, 9)`, marketMakerID, acme, other); err != nil {
			t.Fatal(err)
		}
		mm, _, _ := repo.Find(ctx, marketMakerID)
		if len(mm.Covered) != 1 || mm.Covered[0].Ticker != "ACME3" {
			t.Errorf("cobertura = %+v", mm.Covered)
		}
		if len(mm.Holdings) != 1 || mm.Holdings[0].Quantity != 40 {
			t.Errorf("posições = %+v, want só a de quantidade > 0", mm.Holdings)
		}
		if *mm.Personality.MaxCoveredAssets != bot.DefaultMaxCoveredAssets {
			t.Errorf("teto = %d", *mm.Personality.MaxCoveredAssets)
		}
		listing, _ := repo.List(ctx)
		if len(listing.UncoveredAssets) != 1 || listing.UncoveredAssets[0].Ticker != "OTHR3" {
			t.Errorf("sem cobertura = %+v, want só OTHR3", listing.UncoveredAssets)
		}
	})

	t.Run("desativar tira o ativo da cobertura ao vivo e não toca saldo nem posição", func(t *testing.T) {
		if err := repo.SetActive(ctx, marketMakerID, false); err != nil {
			t.Fatal(err)
		}
		mm, _, _ := repo.Find(ctx, marketMakerID)
		if mm.IsActive || mm.Cash != 80000 || len(mm.Holdings) != 1 || len(mm.Covered) != 1 {
			t.Errorf("Market Maker desativado = %+v", mm)
		}
		listing, _ := repo.List(ctx)
		if len(listing.UncoveredAssets) != 2 {
			t.Errorf("sem cobertura = %+v, want os dois (cobertura inativa não vale)", listing.UncoveredAssets)
		}
		if err := repo.SetActive(ctx, marketMakerID, true); err != nil {
			t.Fatal(err)
		}
		if err := repo.SetActive(ctx, botadmin.NewAdminBotID(99), true); !errors.Is(err, botadmin.ErrBotNotFound) {
			t.Errorf("err = %v, want ErrBotNotFound", err)
		}
	})

	t.Run("teto e remoção de cobertura", func(t *testing.T) {
		if err := repo.SetMaxCoveredAssets(ctx, marketMakerID, 3); err != nil {
			t.Fatal(err)
		}
		mm, _, _ := repo.Find(ctx, marketMakerID)
		if *mm.Personality.MaxCoveredAssets != 3 {
			t.Errorf("teto = %d, want 3", *mm.Personality.MaxCoveredAssets)
		}
		if err := repo.SetMaxCoveredAssets(ctx, chartistID, 3); !errors.Is(err, botadmin.ErrNotMarketMaker) {
			t.Errorf("err = %v, want ErrNotMarketMaker", err)
		}
		if err := repo.RemoveCoverage(ctx, marketMakerID, acme); err != nil {
			t.Fatal(err)
		}
		mm, _, _ = repo.Find(ctx, marketMakerID)
		if len(mm.Covered) != 0 || len(mm.Holdings) != 1 {
			t.Errorf("depois de remover = %+v, want sem cobertura mas com a posição", mm)
		}
	})

	t.Run("ativo negociável", func(t *testing.T) {
		if _, ok, err := repo.TradableAsset(ctx, acme); err != nil || !ok {
			t.Errorf("ação = %v, %v", ok, err)
		}
		if _, ok, _ := repo.TradableAsset(ctx, fixed); ok {
			t.Error("renda fixa não é negociável no book")
		}
	})
}
