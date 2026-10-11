package db

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/corporategovernance"
	"tcc-investimentos/engine/internal/domain/enginesetting"
)

type govSettings struct{ values enginesetting.Values }

func (g govSettings) Current(context.Context) (enginesetting.Values, error) { return g.values, nil }

// Cobre a governança corporativa (MO.6.2) contra um Postgres real descartável (roda só com
// TEST_DATABASE_URL): snapshot só de contas de usuário e idempotente, decisão gravada como
// evento ANTES do efeito e idempotente, cooldown por empresa e rampa aplicada aos poucos
// pelo serviço. market_events é append-only: por isso cada teste usa o próprio banco.
func TestGovernanceRepository_SnapshotDecisaoERampa(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := conn.ExecContext(ctx, query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	scan := func(dest any, query string, args ...any) {
		t.Helper()
		if err := conn.QueryRowContext(ctx, query, args...).Scan(dest); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}

	var company, otherCompany, on, pn, other, ana, bia, caio, bot string
	scan(&company, `INSERT INTO companies (name, cnpj, sector, base_growth_pct, quality_multiplier)
		VALUES ('Acme', '11111111000111', 'Tecnologia', 3.00, 1.00) RETURNING id`)
	scan(&otherCompany, `INSERT INTO companies (name, cnpj, sector) VALUES ('Outra', '22222222000122', 'Varejo') RETURNING id`)
	scan(&on, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme ON', 'acao') RETURNING id`)
	scan(&pn, `INSERT INTO assets (ticker, name, type) VALUES ('ACME4', 'Acme PN', 'acao') RETURNING id`)
	scan(&other, `INSERT INTO assets (ticker, name, type) VALUES ('OUTR3', 'Outra ON', 'acao') RETURNING id`)
	exec(`INSERT INTO variable_income_assets (asset_id, company_id, share_class, outstanding_shares)
		VALUES ($1, $3, 'ON', 1000), ($2, $3, 'PN', 1000), ($4, $5, 'ON', 1000)`, on, pn, company, other, otherCompany)
	scan(&ana, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	scan(&bia, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	scan(&caio, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	scan(&bot, `INSERT INTO accounts (user_id, is_bot) VALUES (gen_random_uuid(), true) RETURNING user_id`)
	exec(`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES
		($1, $5, 10, 5), ($1, $6, 20, 5),
		($2, $5, 7, 5),
		($3, $7, 99, 5),
		($4, $5, 500, 5)`, ana, bia, caio, bot, on, pn, other)

	repo := NewGovernanceRepository(conn)
	const assembly1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
	const assembly2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"

	// Snapshot: soma ON+PN por usuário, sem bot, sem quem só tem ações de outra empresa.
	snap, created, err := repo.TakeSnapshot(ctx, assembly1, company)
	if err != nil || !created {
		t.Fatalf("TakeSnapshot: created=%v err=%v", created, err)
	}
	got := map[string]int64{}
	for _, h := range snap.Holdings {
		got[h.UserID] = h.Quantity
	}
	if len(got) != 2 || got[ana] != 30 || got[bia] != 7 {
		t.Errorf("holdings = %+v, esperado ana=30 e bia=7 (sem bot nem caio)", got)
	}
	// Vender depois do corte não muda o snapshot, e repetir devolve a mesma foto.
	exec(`UPDATE positions SET quantity = 0 WHERE user_id = $1`, ana)
	again, created, err := repo.TakeSnapshot(ctx, assembly1, company)
	if err != nil || created || len(again.Holdings) != 2 {
		t.Errorf("repetido: created=%v err=%v holdings=%d", created, err, len(again.Holdings))
	}
	if _, _, err := repo.TakeSnapshot(ctx, assembly2, "99999999-9999-4999-8999-999999999999"); err != corporategovernance.ErrUnknownCompany {
		t.Errorf("empresa inexistente: err = %v", err)
	}
	// Empresa sem acionista de usuário: snapshot vazio, mas existe (repetir devolve o mesmo).
	empty, created, err := repo.TakeSnapshot(ctx, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", otherCompany)
	if err != nil || !created || len(empty.Holdings) != 1 || empty.Holdings[0].UserID != caio {
		t.Errorf("snapshot da outra empresa = %+v err=%v", empty, err)
	}

	// Decisão: evento antes do efeito, na conta de governança, idempotente.
	svc := corporategovernance.NewService(repo, govSettings{enginesetting.Values{
		GovernanceGrowthStepCentiPP: 50, GovernanceQualityStepCenti: 5, GovernanceRampTicks: 4, GovernanceCooldownDays: 90,
	}})
	exec(`INSERT INTO market_calendar (id, current_day, selic_rate) VALUES (1, 10, 10.75) ON CONFLICT (id) DO UPDATE SET current_day = 10`)
	in := corporategovernance.DecisionInput{
		AssemblyID: assembly1, CompanyID: company, OptionKey: "reinvestir",
		Effect: corporategovernance.Effect{Metric: corporategovernance.MetricBaseGrowthPct, Direction: 1, Intensity: 1},
	}
	d, created, err := svc.RecordDecision(ctx, in)
	if err != nil || !created || d.Status != corporategovernance.StatusScheduled || d.TotalDelta != 50 || d.StartDay != 11 {
		t.Fatalf("RecordDecision: %+v created=%v err=%v", d, created, err)
	}
	if _, created, err := svc.RecordDecision(ctx, in); err != nil || created {
		t.Fatalf("repetida: created=%v err=%v", created, err)
	}
	var events int
	var user, ref string
	var qty int
	scan(&events, `SELECT COUNT(*) FROM market_events WHERE event_type = 'assembly_decision'`)
	if events != 1 {
		t.Fatalf("eventos de decisão = %d, esperado 1 (idempotente)", events)
	}
	scan(&user, `SELECT user_id::text FROM market_events WHERE event_type = 'assembly_decision'`)
	scan(&ref, `SELECT reference_id::text FROM market_events WHERE event_type = 'assembly_decision'`)
	scan(&qty, `SELECT quantity FROM market_events WHERE event_type = 'assembly_decision'`)
	if user != domain.GovernanceAccountID || ref != assembly1 || qty != 50 {
		t.Errorf("evento: user=%s ref=%s quantity=%d", user, ref, qty)
	}
	// A conta técnica nasce com a primeira decisão, é bot inativo e não conta como bot de liquidez.
	var isBot, isActive bool
	scan(&isBot, `SELECT is_bot FROM accounts WHERE user_id = $1`, domain.GovernanceAccountID)
	scan(&isActive, `SELECT is_active FROM accounts WHERE user_id = $1`, domain.GovernanceAccountID)
	if !isBot || isActive {
		t.Errorf("conta de governança: is_bot=%v is_active=%v, esperado true/false", isBot, isActive)
	}
	var totalBots int
	scan(&totalBots, `SELECT COUNT(*) FROM accounts WHERE is_bot AND user_id::text <> $1`, domain.GovernanceAccountID)
	var growth float64
	scan(&growth, `SELECT base_growth_pct::float8 FROM companies WHERE id = $1`, company)
	if growth != 3.00 {
		t.Fatalf("registrar a decisão não pode mexer na empresa: %v", growth)
	}

	// Cooldown: outra assembleia da mesma empresa fica registrada e nada muda.
	in2 := in
	in2.AssemblyID = assembly2
	skipped, created, err := svc.RecordDecision(ctx, in2)
	if err != nil || !created || skipped.Status != corporategovernance.StatusSkippedCooldown || skipped.TotalDelta != 0 {
		t.Fatalf("cooldown: %+v created=%v err=%v", skipped, created, err)
	}
	scan(&events, `SELECT COUNT(*) FROM market_events WHERE event_type = 'assembly_decision'`)
	if events != 2 {
		t.Errorf("a decisão em cooldown também é evento: %d", events)
	}

	// Rampa de 4 ticks: dias 11, 12, 13, 14 somam +0,50 exatos; o dia 15 não faz nada.
	want := map[int]float64{10: 3.00, 11: 3.13, 12: 3.25, 13: 3.38, 14: 3.50, 15: 3.50}
	for _, day := range []int{10, 11, 12, 11, 13, 14, 15} { // 11 repetido: idempotente
		if _, err := svc.ApplyDue(ctx, day); err != nil {
			t.Fatalf("ApplyDue(%d): %v", day, err)
		}
		scan(&growth, `SELECT base_growth_pct::float8 FROM companies WHERE id = $1`, company)
		if growth != want[day] && day != 11 {
			t.Errorf("dia %d: crescimento = %v, esperado %v", day, growth, want[day])
		}
	}
	scan(&growth, `SELECT base_growth_pct::float8 FROM companies WHERE id = $1`, company)
	if growth != 3.50 {
		t.Errorf("crescimento final = %v, esperado 3.50", growth)
	}
	var status string
	var applied int
	scan(&status, `SELECT status FROM governance_decisions WHERE assembly_id = $1`, assembly1)
	scan(&applied, `SELECT applied_delta FROM governance_decisions WHERE assembly_id = $1`, assembly1)
	if status != "completed" || applied != 50 {
		t.Errorf("decisão concluída: status=%s applied_delta=%d", status, applied)
	}
	// O preço nunca é tocado: nenhuma cotação foi criada ou alterada por governança.
	scan(&events, `SELECT COUNT(*) FROM asset_quotes`)
	if events != 0 {
		t.Errorf("governança não pode escrever cotação: %d", events)
	}
}

// ListCompanySchedules (MO.6.3) devolve a agenda de cada empresa com ação negociável, com os
// tickers (ON antes de PN) e o dia corrente; empresa só com ativo sandbox fica de fora.
func TestGovernanceRepository_ListCompanySchedules(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	var acme, sand, on, pn, sandAsset string
	for _, q := range []struct {
		dest  *string
		query string
	}{
		{&acme, `INSERT INTO companies (name, cnpj, sector, report_offset_days) VALUES ('Acme', '11111111000111', 'Tecnologia', 3) RETURNING id`},
		{&sand, `INSERT INTO companies (name, cnpj, sector) VALUES ('Sandbox SA', '22222222000122', 'Varejo') RETURNING id`},
		{&on, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme ON', 'acao') RETURNING id`},
		{&pn, `INSERT INTO assets (ticker, name, type) VALUES ('ACME4', 'Acme PN', 'acao') RETURNING id`},
		{&sandAsset, `INSERT INTO assets (ticker, name, type, is_sandbox) VALUES ('SAND3', 'Sand ON', 'acao', true) RETURNING id`},
	} {
		if err := conn.QueryRowContext(ctx, q.query).Scan(q.dest); err != nil {
			t.Fatalf("%s: %v", q.query, err)
		}
	}
	if _, err := conn.ExecContext(ctx, `INSERT INTO variable_income_assets (asset_id, company_id, share_class, outstanding_shares)
		VALUES ($1, $3, 'PN', 1000), ($2, $3, 'ON', 1000), ($4, $5, 'ON', 1000)`, pn, on, acme, sandAsset, sand); err != nil {
		t.Fatal(err)
	}

	day, schedules, err := NewGovernanceRepository(conn).ListCompanySchedules(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(schedules) != 1 || schedules[0].CompanyID != acme {
		t.Fatalf("schedules = %+v, esperado só a Acme", schedules)
	}
	s := schedules[0]
	if s.Sector != "Tecnologia" || s.ReportOffsetDays != 3 || s.ReportFrequencyDays <= 0 || len(s.Tickers) != 2 || s.Tickers[0] != "ACME3" || s.Tickers[1] != "ACME4" {
		t.Errorf("agenda = %+v", s)
	}
	if day < 0 {
		t.Errorf("dia = %d", day)
	}
}
