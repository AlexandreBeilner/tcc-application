package db

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fii"
	"tcc-investimentos/engine/internal/domain/macroevent"
	"tcc-investimentos/engine/internal/domain/macroeventadmin"
	"tcc-investimentos/engine/internal/domain/tick"
)

// TestAssetsWithCompany_DistingueAcaoFIIEInexistente cobre o achado 028 na
// camada de banco: ação (com empresa) vira true, FII e ETF (sem empresa)
// viram false, id inexistente ou malformado fica fora do mapa (nunca erro de
// sintaxe de uuid). Usa o banco descartável (roda só com TEST_DATABASE_URL).
func TestAssetsWithCompany_DistingueAcaoFIIEInexistente(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	catalogRepo := NewCatalogRepository(conn, nil)

	company, err := catalog.NewCompany("Acao S.A.", "55555555000101", catalog.SectorMineracao, catalog.DefaultBaseGrowthPct, catalog.DefaultQualityMultiplier)
	if err != nil {
		t.Fatal(err)
	}
	companyID, err := catalogRepo.CreateCompany(ctx, company)
	if err != nil {
		t.Fatal(err)
	}

	shares := int64(1_000_000)
	newAsset := func(ticker string, typ catalog.AssetType, companyID *string) string {
		t.Helper()
		id, err := catalogRepo.CreateAsset(ctx, catalog.Asset{Ticker: ticker, Name: ticker, Type: typ})
		if err != nil {
			t.Fatalf("CreateAsset %s: %v", ticker, err)
		}
		if err := catalogRepo.CreateVariableIncomeAsset(ctx, catalog.VariableIncomeAsset{AssetID: id, CompanyID: companyID, OutstandingShares: &shares}); err != nil {
			t.Fatalf("CreateVariableIncomeAsset %s: %v", ticker, err)
		}
		return id
	}
	acao := newAsset("ACAO3", catalog.AssetAcao, &companyID)
	fiiID := newAsset("FIIX11", catalog.AssetFII, nil)
	segment := fii.SegmentShoppingCenters
	netWorth, vacancy := 100_000_000.0, 5.0
	details, err := fii.NewDetails(fii.TypeTijolo, &segment, &netWorth, &vacancy, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := catalogRepo.CreateFIIDetails(ctx, fiiID, details); err != nil {
		t.Fatal(err)
	}
	etfID := newAsset("ETFX11", catalog.AssetETF, nil)

	got, err := NewMacroEventRepository(conn).AssetsWithCompany(ctx, []string{acao, fiiID, etfID, "00000000-0000-0000-0000-000000000000", "'; DROP TABLE assets;--"})
	if err != nil {
		t.Fatalf("AssetsWithCompany: %v", err)
	}
	if !got[acao] {
		t.Errorf("ação deveria ter empresa: %v", got)
	}
	for name, id := range map[string]string{"FII": fiiID, "ETF": etfID} {
		if has, exists := got[id]; !exists || has {
			t.Errorf("%s: exists=%v hasCompany=%v, want exists e sem empresa", name, exists, has)
		}
	}
	if len(got) != 3 {
		t.Errorf("ids inexistentes/malformados deveriam ficar fora do mapa, len = %d (%v)", len(got), got)
	}
}

// Ciclo de vida do evento macro (N.11) contra um Postgres real descartável: visão pública
// do feed e do calendário, filtros do painel, cancelamento atômico sob a trava do tick e
// o impacto realizado.
func TestMacroEventRepository_CicloDeVidaEVisoes(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	repo := NewMacroEventRepository(conn)
	catalogRepo := NewCatalogRepository(conn, nil)

	company, err := catalog.NewCompany("Acao S.A.", "66666666000101", catalog.SectorMineracao, catalog.DefaultBaseGrowthPct, catalog.DefaultQualityMultiplier)
	if err != nil {
		t.Fatal(err)
	}
	companyID, err := catalogRepo.CreateCompany(ctx, company)
	if err != nil {
		t.Fatal(err)
	}
	shares := int64(1_000_000)
	assetID, err := catalogRepo.CreateAsset(ctx, catalog.Asset{Ticker: "ACAO3", Name: "Acao", Type: catalog.AssetAcao})
	if err != nil {
		t.Fatal(err)
	}
	if err := catalogRepo.CreateVariableIncomeAsset(ctx, catalog.VariableIncomeAsset{AssetID: assetID, CompanyID: &companyID, OutstandingShares: &shares}); err != nil {
		t.Fatal(err)
	}
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := conn.ExecContext(ctx, query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	exec(`INSERT INTO market_calendar (id, current_day, selic_rate) VALUES (1, 100, 10.5)
	      ON CONFLICT (id) DO UPDATE SET current_day = 100`)
	exec(`INSERT INTO asset_quotes (asset_id, simulated_day, price) VALUES ($1, 100, 10.00), ($1, 105, 12.00)`, assetID)

	sector := catalog.SectorMineracao
	persist := func(title string, triggeredOnDay int) string {
		t.Helper()
		target, err := macroevent.NewTarget(&sector, nil, nil, macroevent.MetricPrice, nil)
		if err != nil {
			t.Fatal(err)
		}
		event, err := macroevent.NewEvent(nil, title, "narrativa", macroevent.DirectionPositivo, macroevent.BandLeve, true, false, []macroevent.Target{target}, nil)
		if err != nil {
			t.Fatal(err)
		}
		event.TriggeredOnDay, event.DurationDays = triggeredOnDay, 1
		id, err := repo.Persist(ctx, event)
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	tomorrow := persist("começa amanhã", 101)
	scheduled := persist("agendado", 130)
	running := persist("em curso", 99)

	titles := func(filter macroevent.ListFilter) map[string]bool {
		t.Helper()
		filter.Limit = 50
		records, err := repo.List(ctx, filter)
		if err != nil {
			t.Fatal(err)
		}
		count, err := repo.Count(ctx, filter)
		if err != nil || count != len(records) {
			t.Fatalf("Count = %d, %v; List devolveu %d", count, err, len(records))
		}
		out := map[string]bool{}
		for _, r := range records {
			out[r.Title] = true
		}
		return out
	}

	// Feed do usuário: o agendado só aparece na véspera do primeiro dia de efeito.
	if got := titles(macroevent.ListFilter{View: macroevent.ViewPublic}); !got["começa amanhã"] || !got["em curso"] || got["agendado"] {
		t.Errorf("visão pública = %v, want começa amanhã e em curso, sem o agendado", got)
	}
	if got := titles(macroevent.ListFilter{View: macroevent.ViewAdmin}); len(got) != 3 {
		t.Errorf("visão do painel = %v, want os 3", got)
	}

	// Cancelar: o agendado e o que começa amanhã passam; o que já está em curso não.
	if err := repo.CancelPending(ctx, scheduled, macroevent.CanCancel); err != nil {
		t.Fatalf("cancelar agendado: %v", err)
	}
	if err := repo.CancelPending(ctx, scheduled, macroevent.CanCancel); !errors.Is(err, macroevent.ErrNotPending) {
		t.Errorf("cancelar de novo = %v, want ErrNotPending", err)
	}
	if err := repo.CancelPending(ctx, running, macroevent.CanCancel); !errors.Is(err, macroevent.ErrEffectStarted) {
		t.Errorf("cancelar em curso = %v, want ErrEffectStarted", err)
	}
	for _, id := range []string{"00000000-0000-0000-0000-000000000000", "nao-uuid"} {
		if err := repo.CancelPending(ctx, id, macroevent.CanCancel); !errors.Is(err, macroeventadmin.ErrNotFound) {
			t.Errorf("cancelar %q = %v, want ErrNotFound", id, err)
		}
	}

	// Com um tick em andamento (a trava consultiva ocupada) o cancelamento é recusado.
	release, ok, err := NewTickRepository(conn, nil).TryLockTick(ctx)
	if err != nil || !ok {
		t.Fatalf("TryLockTick = %v, %v", ok, err)
	}
	if err := repo.CancelPending(ctx, tomorrow, macroevent.CanCancel); !errors.Is(err, tick.ErrTickInProgress) {
		t.Errorf("cancelar durante um tick = %v, want ErrTickInProgress", err)
	}
	release()
	if err := repo.CancelPending(ctx, tomorrow, macroevent.CanCancel); err != nil {
		t.Fatalf("cancelar sem tick: %v", err)
	}

	// Cancelado some do feed e do calendário do usuário, mas continua no painel.
	if got := titles(macroevent.ListFilter{View: macroevent.ViewPublic}); got["começa amanhã"] || got["agendado"] {
		t.Errorf("cancelados na visão pública: %v", got)
	}
	cancelled := macroevent.StatusCancelado
	if got := titles(macroevent.ListFilter{View: macroevent.ViewAdmin, Status: &cancelled}); len(got) != 2 {
		t.Errorf("filtro por status cancelado = %v, want 2", got)
	}
	from, to := 120, 140
	if got := titles(macroevent.ListFilter{View: macroevent.ViewAdmin, FromDay: &from, ToDay: &to}); len(got) != 1 || !got["agendado"] {
		t.Errorf("filtro por período = %v, want só o agendado", got)
	}
	other := "Tecnologia"
	if got := titles(macroevent.ListFilter{View: macroevent.ViewAdmin, Sector: &other}); len(got) != 0 {
		t.Errorf("filtro por outro setor = %v, want vazio", got)
	}
	mining := string(sector)
	if got := titles(macroevent.ListFilter{View: macroevent.ViewAdmin, Sector: &mining}); len(got) != 3 {
		t.Errorf("filtro pelo setor do evento = %v, want 3", got)
	}
	facts, err := NewCalendarRepository(conn).MacroEventsBetween(ctx, 0, 500)
	if err != nil || len(facts) != 1 || facts[0].Title != "em curso" {
		t.Errorf("calendário do usuário = %+v, %v, want só o evento em curso", facts, err)
	}

	// Find devolve o estado gravado com os alvos; o impacto lê os preços dos dois dias.
	rec, err := repo.Find(ctx, scheduled)
	if err != nil || rec.Status != macroevent.StatusCancelado || len(rec.Targets) != 1 {
		t.Errorf("Find = %+v, %v", rec, err)
	}
	if _, err := repo.Find(ctx, "nao-uuid"); !errors.Is(err, macroeventadmin.ErrNotFound) {
		t.Errorf("Find inexistente = %v", err)
	}
	prices, err := repo.StockPrices(ctx, rec.Targets, 100, 105)
	if err != nil || len(prices) != 1 || *prices[0].PriceBefore != 10 || *prices[0].PriceAfter != 12 {
		t.Errorf("StockPrices = %+v, %v", prices, err)
	}
}
