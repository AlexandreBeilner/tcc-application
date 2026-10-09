package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"testing"

	"tcc-investimentos/engine/internal/domain/assetprovision"
	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/coverage"
)

func positionsSnapshot(t *testing.T, conn *sql.DB) string {
	t.Helper()
	rows, err := conn.Query(`SELECT user_id::text, asset_id::text, quantity, average_price FROM positions ORDER BY user_id, asset_id`)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = rows.Close() }()
	var b strings.Builder
	for rows.Next() {
		var u, a string
		var q int64
		var p float64
		if err := rows.Scan(&u, &a, &q, &p); err != nil {
			t.Fatal(err)
		}
		fmt.Fprintf(&b, "%s|%s|%d|%.4f\n", u, a, q, p)
	}
	return b.String()
}

// Cobre o cadastro de ativo novo (N.13) contra um Postgres real descartável: o catálogo nasce
// inteiro, o pool de bots cresce com bot.PoolSize e criar mais um ativo não altera nenhuma posição
// existente (critério de crescimento).
func TestAssetProvision_CresceSemAlterarOsAntigos(t *testing.T) {
	accountRepo, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	covRepo := NewCoverageRepository(conn)
	repo := NewAssetProvisionRepository(conn, accountRepo)
	svc := assetprovision.NewService(repo, repo, covRepo, coverage.NewEnsurer(covRepo, covRepo))

	equity := func(i int) assetprovision.Spec {
		return assetprovision.Spec{
			Kind: assetprovision.KindAcao, Ticker: fmt.Sprintf("TST%c3", 'A'+i), Name: fmt.Sprintf("Teste %d ON", i),
			CompanyName: fmt.Sprintf("Teste %d S.A.", i), CNPJ: fmt.Sprintf("5550000000%04d", i), Sector: catalog.SectorTecnologia,
			OutstandingShares: 100_000_000, BaseGrowthPct: 3, QualityMultiplier: 1,
		}
	}

	for i := 0; i < 9; i++ {
		if _, err := svc.Create(ctx, equity(i)); err != nil {
			t.Fatalf("criar ativo %d: %v", i, err)
		}
	}
	state, err := repo.PoolState(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if state.DirectionalBots != bot.MinPoolSize || len(state.Floats) != 9 {
		t.Fatalf("depois de 9 ativos: pool = %d, floats = %d", state.DirectionalBots, len(state.Floats))
	}
	before := positionsSnapshot(t, conn)

	// O 10º ativo faz PoolSize(10) = 20: um bot novo, e nada do que já existe muda.
	res, err := svc.Create(ctx, equity(9))
	if err != nil {
		t.Fatal(err)
	}
	if res.Preview.Pool.NewBots != 1 || res.Preview.Pool.PoolAfter != 20 {
		t.Fatalf("pool = %+v", res.Preview.Pool)
	}
	after := positionsSnapshot(t, conn)
	if !containsAll(after, before) {
		t.Fatal("alguma posição existente mudou ao criar o 10º ativo")
	}

	var nBots, nPersonalities, nCovered int
	scanInt := func(dest *int, query string, args ...any) {
		t.Helper()
		if err := conn.QueryRowContext(ctx, query, args...).Scan(dest); err != nil {
			t.Fatal(err)
		}
	}
	scanInt(&nBots, `SELECT COUNT(*) FROM accounts WHERE is_bot AND user_id::text LIKE '00000000-0000-0000-0000-%'`)
	scanInt(&nPersonalities, `SELECT COUNT(*) FROM bot_personalities WHERE account_id::text LIKE '00000000-0000-0000-0000-%'`)
	scanInt(&nCovered, `SELECT COUNT(*) FROM market_maker_coverage WHERE asset_id = $1`, res.AssetID)
	// 20 bots direcionais mais o primeiro Market Maker (id ...0001), que o seed também reserva neste prefixo.
	if nBots != 21 || nPersonalities != 21 || nCovered != 1 {
		t.Errorf("bots = %d, personalidades = %d, cobertura do ativo novo = %d", nBots, nPersonalities, nCovered)
	}

	// O float do ativo novo fecha: bots (todos) + Market Maker = outstanding_shares.
	var held int64
	if err := conn.QueryRowContext(ctx, `SELECT COALESCE(SUM(quantity), 0) FROM positions WHERE asset_id = $1`, res.AssetID).Scan(&held); err != nil {
		t.Fatal(err)
	}
	if held != 100_000_000 {
		t.Errorf("posições do ativo novo somam %d, queria 100.000.000", held)
	}

	t.Run("fundamentos e empresa criados junto", func(t *testing.T) {
		var n int
		scanInt(&n, `SELECT COUNT(*) FROM company_fundamentals cf JOIN variable_income_assets v ON v.company_id = cf.company_id WHERE v.asset_id = $1`, res.AssetID)
		if n != 1 {
			t.Errorf("fundamentos iniciais = %d", n)
		}
	})

	t.Run("ticker repetido é recusado sem gravar nada", func(t *testing.T) {
		snapshot := positionsSnapshot(t, conn)
		if _, err := svc.Create(ctx, equity(9)); err == nil {
			t.Fatal("ticker repetido devia ser recusado")
		}
		if positionsSnapshot(t, conn) != snapshot {
			t.Error("recusa alterou posições")
		}
	})

	t.Run("FII de tijolo e de papel entram no mesmo pool", func(t *testing.T) {
		for _, spec := range []assetprovision.Spec{
			{Kind: assetprovision.KindFIITijolo, Ticker: "TSTT11", Name: "FII Teste Tijolo", Segment: "Lajes Corporativas", VacancyRate: 4},
			{Kind: assetprovision.KindFIIPapel, Ticker: "TSTP11", Name: "FII Teste Papel", Indexador: "CDI"},
		} {
			r, err := svc.Create(ctx, spec)
			if err != nil {
				t.Fatalf("%s: %v", spec.Ticker, err)
			}
			var shares int64
			var covered int
			scanInt(&covered, `SELECT COUNT(*) FROM market_maker_coverage WHERE asset_id = $1`, r.AssetID)
			if err := conn.QueryRowContext(ctx, `SELECT outstanding_shares FROM variable_income_assets WHERE asset_id = $1`, r.AssetID).Scan(&shares); err != nil {
				t.Fatal(err)
			}
			if shares != assetprovision.FIIOutstandingShares || covered != 1 {
				t.Errorf("%s: cotas = %d, cobertura = %d", spec.Ticker, shares, covered)
			}
		}
	})

	t.Run("ETF nasce com cesta, conta de fundo e sem float de bots", func(t *testing.T) {
		r, err := svc.Create(ctx, assetprovision.Spec{
			Kind: assetprovision.KindETF, Ticker: "TSTE11", Name: "ETF Teste", BenchmarkIndex: "Índice Teste", Methodology: "Réplica.",
			Holdings: []assetprovision.HoldingSpec{{Ticker: "TSTA3", WeightPct: 60}, {Ticker: "TSTT11", WeightPct: 40}},
		})
		if err != nil {
			t.Fatal(err)
		}
		var holdings, covered int
		var fund sql.NullString
		var shares int64
		scanInt(&holdings, `SELECT COUNT(*) FROM etf_holdings WHERE etf_asset_id = $1`, r.AssetID)
		scanInt(&covered, `SELECT COUNT(*) FROM market_maker_coverage WHERE asset_id = $1`, r.AssetID)
		if err := conn.QueryRowContext(ctx, `SELECT fund_account_id::text FROM etf_details WHERE asset_id = $1`, r.AssetID).Scan(&fund); err != nil {
			t.Fatal(err)
		}
		if err := conn.QueryRowContext(ctx, `SELECT outstanding_shares FROM variable_income_assets WHERE asset_id = $1`, r.AssetID).Scan(&shares); err != nil {
			t.Fatal(err)
		}
		if holdings != 2 || covered != 0 || !fund.Valid || shares != 0 {
			t.Errorf("cesta = %d, cobertura = %d, fundo = %v, cotas = %d", holdings, covered, fund, shares)
		}
	})
}

func sortedLines(s string) []string { return strings.Split(strings.TrimSpace(s), "\n") }

// containsAll confirma que toda linha de before continua igual em after (after só ganha linhas).
func containsAll(after, before string) bool {
	have := map[string]bool{}
	for _, l := range sortedLines(after) {
		have[l] = true
	}
	for _, l := range sortedLines(before) {
		if l != "" && !have[l] {
			return false
		}
	}
	return true
}
