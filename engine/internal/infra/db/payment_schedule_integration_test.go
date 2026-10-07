package db

import (
	"context"
	"database/sql"
	"net/url"
	"os"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fii"
	"tcc-investimentos/engine/internal/domain/paymentschedule"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// Cobre a base de dados do escalonamento (RC.6.7, migration 000048) contra um Postgres real
// (banco descartável; roda só com TEST_DATABASE_URL): colunas novas, atribuição idempotente da
// agenda, CHECKs e a migration subindo e descendo sem perder o que já existia.

func scratchDSNOf(t *testing.T, conn *sql.DB) string {
	t.Helper()
	var name string
	if err := conn.QueryRow(`SELECT current_database()`).Scan(&name); err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	parsed.Path = "/" + name
	return parsed.String()
}

func newMigrator(t *testing.T, dsn string) *migrate.Migrate {
	t.Helper()
	source, err := iofs.New(migrationsFS, "migrations")
	if err != nil {
		t.Fatal(err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", source, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = m.Close() })
	return m
}

func TestPaymentSchedule_CompanyEFIIAtribuicaoIdempotente(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	repo := NewCatalogRepository(conn, nil)
	ctx := context.Background()

	// Empresa sem agenda: o legado, ainda não atribuída.
	legacy, _ := catalog.NewCompany("Legada S.A.", "10000000000101", catalog.SectorEnergia, catalog.DefaultBaseGrowthPct, catalog.DefaultQualityMultiplier)
	legacyID, err := repo.CreateCompany(ctx, legacy)
	if err != nil {
		t.Fatal(err)
	}
	read := func(id string) (offset int, policy string, comLag, payLag int, assigned bool) {
		t.Helper()
		if err := conn.QueryRow(`SELECT report_offset_days, dividend_policy, com_lag_days, payment_lag_days, schedule_assigned FROM companies WHERE id = $1`, id).
			Scan(&offset, &policy, &comLag, &payLag, &assigned); err != nil {
			t.Fatal(err)
		}
		return
	}
	if o, p, c, l, a := read(legacyID); o != 0 || p != "quarterly" || c != 0 || l != 5 || a {
		t.Fatalf("legado = %d %s %d %d %v", o, p, c, l, a)
	}

	// O seed atribui a agenda derivada do CNPJ, uma vez só, sem sobrescrever depois.
	schedule := paymentschedule.DefaultsFor(legacy.CNPJ, legacy.Sector)
	withSchedule, err := legacy.WithPaymentSchedule(schedule.ReportOffsetBusinessDays, schedule.Policy, schedule.ComLagBusinessDays, schedule.PaymentLagBusinessDays)
	if err != nil {
		t.Fatal(err)
	}
	if changed, err := repo.AssignCompanyScheduleIfUnassigned(ctx, legacyID, withSchedule); err != nil || !changed {
		t.Fatalf("primeira atribuição: changed=%v err=%v", changed, err)
	}
	edited, _ := legacy.WithPaymentSchedule(1, catalog.DividendAnnual, 1, 9)
	if changed, err := repo.AssignCompanyScheduleIfUnassigned(ctx, legacyID, edited); err != nil || changed {
		t.Fatalf("segunda atribuição devia ser no-op: changed=%v err=%v", changed, err)
	}
	if o, p, _, _, a := read(legacyID); o != schedule.ReportOffsetBusinessDays || p != string(schedule.Policy) || !a {
		t.Errorf("agenda atribuída = %d %s %v", o, p, a)
	}

	// Empresa nova já criada com agenda.
	fresh, _ := catalog.NewCompany("Nova S.A.", "10000000000102", catalog.SectorBancario, catalog.DefaultBaseGrowthPct, catalog.DefaultQualityMultiplier)
	fresh, _ = fresh.WithPaymentSchedule(27, catalog.DividendSemiannual, 2, 14)
	freshID, err := repo.CreateCompany(ctx, fresh)
	if err != nil {
		t.Fatal(err)
	}
	if o, p, c, l, a := read(freshID); o != 27 || p != "semiannual" || c != 2 || l != 14 || !a {
		t.Errorf("empresa nova = %d %s %d %d %v", o, p, c, l, a)
	}

	// FII: sem dia explícito vale o padrão (não atribuído); com dia, já atribuído.
	fiiAsset := func(ticker string) string {
		var id string
		if err := conn.QueryRow(`INSERT INTO assets (ticker, name, type) VALUES ($1, $1, 'fii') RETURNING id`, ticker).Scan(&id); err != nil {
			t.Fatal(err)
		}
		if _, err := conn.Exec(`INSERT INTO variable_income_assets (asset_id, outstanding_shares) VALUES ($1, 1000)`, id); err != nil {
			t.Fatal(err)
		}
		return id
	}
	segment, worth, vacancy := "Lajes", 1000.0, 5.0
	details, err := fii.NewDetails(fii.TypeTijolo, &segment, &worth, &vacancy, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	oldFII := fiiAsset("OLD11")
	if err := repo.CreateFIIDetails(ctx, oldFII, details); err != nil {
		t.Fatal(err)
	}
	readFII := func(id string) (day int, assigned bool) {
		t.Helper()
		if err := conn.QueryRow(`SELECT payout_business_day, schedule_assigned FROM fii_details WHERE asset_id = $1`, id).Scan(&day, &assigned); err != nil {
			t.Fatal(err)
		}
		return
	}
	if d, a := readFII(oldFII); d != fii.DefaultPayoutBusinessDay || a {
		t.Fatalf("FII sem agenda = %d %v", d, a)
	}
	if changed, err := repo.AssignFIIScheduleIfUnassigned(ctx, oldFII, 7); err != nil || !changed {
		t.Fatalf("atribuição do FII: %v %v", changed, err)
	}
	if changed, _ := repo.AssignFIIScheduleIfUnassigned(ctx, oldFII, 12); changed {
		t.Error("segunda atribuição do FII devia ser no-op")
	}
	if d, a := readFII(oldFII); d != 7 || !a {
		t.Errorf("FII atribuído = %d %v", d, a)
	}
	newFII := fiiAsset("NEW11")
	details.PayoutBusinessDay = 9
	if err := repo.CreateFIIDetails(ctx, newFII, details); err != nil {
		t.Fatal(err)
	}
	if d, a := readFII(newFII); d != 9 || !a {
		t.Errorf("FII novo = %d %v", d, a)
	}

	// Os CHECKs do banco recusam o que o domínio também recusa.
	for _, q := range []string{
		`UPDATE companies SET report_offset_days = 32`,
		`UPDATE companies SET dividend_policy = 'mensal'`,
		`UPDATE fii_details SET payout_business_day = 0`,
	} {
		if _, err := conn.Exec(q); err == nil {
			t.Errorf("%s devia violar um CHECK", q)
		}
	}
}

// A migration desce e sobe sem perder dado: proventos antigos ganham declared_day/ex_day da ex_date,
// ficam com snapshot tirado, e o dia de corte nasce no dia simulado corrente.
func TestPaymentSchedule_MigrationSobeEDesceComBackfill(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	m := newMigrator(t, scratchDSNOf(t, conn))

	if err := m.Steps(-1); err != nil {
		t.Fatalf("descer a 000048: %v", err)
	}
	if _, err := conn.Exec(`SELECT declared_day FROM dividend_events LIMIT 1`); err == nil {
		t.Fatal("declared_day devia ter saído com a descida")
	}

	var assetID string
	if err := conn.QueryRow(`INSERT INTO assets (ticker, name, type) VALUES ('OLD3', 'Old ON', 'acao') RETURNING id`).Scan(&assetID); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(`INSERT INTO variable_income_assets (asset_id, outstanding_shares) VALUES ($1, 1000)`, assetID); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(`INSERT INTO dividend_events (asset_id, value_per_share, ex_date, payment_date, payment_day) VALUES ($1, 0.5, $2, $3, 83)`,
		assetID, simcalendar.DateOf(78), simcalendar.DateOf(83)); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(`INSERT INTO companies (name, cnpj, sector) VALUES ('Antiga', '20000000000101', 'Energia')`); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(`INSERT INTO market_calendar (id, current_day, selic_rate) VALUES (1, 77, 10)`); err != nil {
		t.Fatal(err)
	}

	if err := m.Up(); err != nil {
		t.Fatalf("subir a 000048 com dados: %v", err)
	}
	var declared, ex int
	var snapshotted bool
	if err := conn.QueryRow(`SELECT declared_day, ex_day, recipients_snapshotted FROM dividend_events`).Scan(&declared, &ex, &snapshotted); err != nil {
		t.Fatal(err)
	}
	if declared != 78 || ex != 78 || !snapshotted {
		t.Errorf("provento antigo = declared %d, ex %d, snapshot %v; quer 78, 78, true", declared, ex, snapshotted)
	}
	var cutover int
	if err := conn.QueryRow(`SELECT schedule_cutover_day FROM market_calendar WHERE id = 1`).Scan(&cutover); err != nil {
		t.Fatal(err)
	}
	if cutover != 77 {
		t.Errorf("dia de corte = %d, quer o dia corrente 77", cutover)
	}
	var offset int
	var policy string
	var assigned bool
	if err := conn.QueryRow(`SELECT report_offset_days, dividend_policy, schedule_assigned FROM companies WHERE cnpj = '20000000000101'`).Scan(&offset, &policy, &assigned); err != nil {
		t.Fatal(err)
	}
	if offset != 0 || policy != "quarterly" || assigned {
		t.Errorf("empresa antiga = %d %s %v, quer o legado sem atribuição", offset, policy, assigned)
	}
}
