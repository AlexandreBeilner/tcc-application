package db

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/corporategovernance"
	"tcc-investimentos/engine/internal/domain/enginesetting"
	"tcc-investimentos/engine/internal/domain/tick"
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
		GovernancePayoutStepCentiPP: 1000, GovernancePayoutMinPct: 20, GovernancePayoutMaxPct: 90, GovernancePayoutCooldownDays: 90,
	}})
	exec(`INSERT INTO market_calendar (id, current_day, selic_rate) VALUES (1, 10, 10.75) ON CONFLICT (id) DO UPDATE SET current_day = 10`)
	in := corporategovernance.DecisionInput{
		AssemblyID: assembly1, CompanyID: company, OptionKey: "reinvestir",
		Effects: []corporategovernance.Effect{{Metric: corporategovernance.MetricBaseGrowthPct, Direction: 1, Intensity: 1}},
	}
	d, created, err := svc.RecordDecision(ctx, in)
	if err != nil || !created || len(d.Effects) != 1 || d.Effects[0].Status != corporategovernance.StatusScheduled || d.Effects[0].TotalDelta != 50 || d.Effects[0].StartDay != 11 {
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
	if err != nil || !created || skipped.Effects[0].Status != corporategovernance.StatusSkippedCooldown || skipped.Effects[0].TotalDelta != 0 {
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
	scan(&status, `SELECT e.status FROM governance_decision_effects e JOIN governance_decisions d ON d.id = e.decision_id WHERE d.assembly_id = $1`, assembly1)
	scan(&applied, `SELECT e.applied_delta FROM governance_decision_effects e JOIN governance_decisions d ON d.id = e.decision_id WHERE d.assembly_id = $1`, assembly1)
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

// Situação da empresa para uma pessoa (proposta e apoio de pauta, MO.6.5): posição atual somada
// entre ON e PN, bot e conta sem ação ficam de fora, e o cooldown vem do último efeito que valeu.
func TestGovernanceRepository_CompanyStanding(t *testing.T) {
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
	var company, on, pn, ana, bia, bot string
	scan(&company, `INSERT INTO companies (name, cnpj, sector) VALUES ('Acme', '11111111000111', 'Varejo') RETURNING id`)
	scan(&on, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme ON', 'acao') RETURNING id`)
	scan(&pn, `INSERT INTO assets (ticker, name, type) VALUES ('ACME4', 'Acme PN', 'acao') RETURNING id`)
	exec(`INSERT INTO variable_income_assets (asset_id, company_id, share_class, outstanding_shares)
		VALUES ($1, $3, 'ON', 1000), ($2, $3, 'PN', 1000)`, on, pn, company)
	scan(&ana, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	scan(&bia, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	scan(&bot, `INSERT INTO accounts (user_id, is_bot) VALUES (gen_random_uuid(), true) RETURNING user_id`)
	exec(`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES
		($1, $4, 10, 5), ($1, $5, 0, 5), ($2, $5, 0, 5), ($3, $4, 500, 5)`, ana, bia, bot, on, pn)
	exec(`INSERT INTO market_calendar (id, current_day, selic_rate) VALUES (1, 130, 10.75) ON CONFLICT (id) DO UPDATE SET current_day = 130`)

	repo := NewGovernanceRepository(conn)
	rec, found, err := repo.CompanyStanding(ctx, company, ana)
	if err != nil || !found || !rec.HoldsShares || rec.Name != "Acme" || rec.Sector != "Varejo" || rec.Today != 130 || rec.LastEffectStartDay != nil {
		t.Fatalf("ana: %+v found=%v err=%v", rec, found, err)
	}
	if rec, _, _ = repo.CompanyStanding(ctx, company, bia); rec.HoldsShares {
		t.Errorf("bia só tem linha zerada: não é acionista")
	}
	if rec, _, _ = repo.CompanyStanding(ctx, company, bot); rec.HoldsShares {
		t.Errorf("bot nunca conta como acionista")
	}
	if _, found, err := repo.CompanyStanding(ctx, "99999999-9999-4999-8999-999999999999", ana); err != nil || found {
		t.Errorf("empresa inexistente: found=%v err=%v", found, err)
	}

	// Último efeito que valeu: skipped_cooldown não conta.
	exec(`WITH d AS (
		  INSERT INTO governance_decisions (assembly_id, company_id, option_key)
		  VALUES (gen_random_uuid(), $1, 'a'), (gen_random_uuid(), $1, 'b') RETURNING id, option_key)
		INSERT INTO governance_decision_effects (decision_id, company_id, position, metric, direction, intensity, status, total_delta, ramp_ticks, start_day)
		SELECT id, $1, 0, 'base_growth_pct', 1, 1,
		       CASE option_key WHEN 'a' THEN 'completed' ELSE 'skipped_cooldown' END,
		       CASE option_key WHEN 'a' THEN 50 ELSE 0 END, 30,
		       CASE option_key WHEN 'a' THEN 100 ELSE 125 END
		FROM d`, company)
	rec, _, err = repo.CompanyStanding(ctx, company, ana)
	if err != nil || rec.LastEffectStartDay == nil || *rec.LastEffectStartDay != 100 {
		t.Fatalf("último efeito: %+v err=%v", rec, err)
	}
	svc := corporategovernance.NewService(repo, govSettings{enginesetting.Values{GovernanceCooldownDays: 90}})
	st, err := svc.Standing(ctx, company, ana)
	if err != nil || st.CooldownDaysLeft != 60 || !st.HoldsShares {
		t.Errorf("standing: %+v err=%v", st, err)
	}
}

// Decisão composta (MO.6.10): um evento por efeito, payout aplicado de uma vez e crescimento
// em rampa, cada um com o seu cooldown (o payout recente não trava os fundamentos), e o
// payout nunca sai da faixa válida.
func TestGovernanceRepository_DecisaoCompostaComPayout(t *testing.T) {
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
	var company, asset string
	scan(&company, `INSERT INTO companies (name, cnpj, sector, base_growth_pct, quality_multiplier)
		VALUES ('Acme', '11111111000111', 'Tecnologia', 3.00, 1.00) RETURNING id`)
	scan(&asset, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme ON', 'acao') RETURNING id`)
	exec(`INSERT INTO variable_income_assets (asset_id, company_id, share_class, outstanding_shares) VALUES ($1, $2, 'ON', 1000)`, asset, company)
	exec(`INSERT INTO market_calendar (id, current_day, selic_rate) VALUES (1, 10, 10.75) ON CONFLICT (id) DO UPDATE SET current_day = 10`)

	var payout float64
	scan(&payout, `SELECT payout_ratio_pct::float8 FROM companies WHERE id = $1`, company)
	if payout != 50 {
		t.Fatalf("payout inicial = %v, esperado 50 (o padrão histórico)", payout)
	}

	repo := NewGovernanceRepository(conn)
	svc := corporategovernance.NewService(repo, govSettings{enginesetting.Values{
		GovernanceGrowthStepCentiPP: 50, GovernanceQualityStepCenti: 5, GovernanceRampTicks: 4, GovernanceCooldownDays: 90,
		GovernancePayoutStepCentiPP: 1000, GovernancePayoutMinPct: 20, GovernancePayoutMaxPct: 90, GovernancePayoutCooldownDays: 90,
	}})
	const a1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"
	const a2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"
	in := corporategovernance.DecisionInput{AssemblyID: a1, CompanyID: company, OptionKey: "reinvestir", Effects: []corporategovernance.Effect{
		{Metric: corporategovernance.MetricPayoutRatioPct, Direction: -1, Intensity: 1},
		{Metric: corporategovernance.MetricBaseGrowthPct, Direction: 1, Intensity: 1},
	}}
	d, created, err := svc.RecordDecision(ctx, in)
	if err != nil || !created || len(d.Effects) != 2 {
		t.Fatalf("RecordDecision: %+v created=%v err=%v", d, created, err)
	}
	if d.Effects[0].Metric != corporategovernance.MetricPayoutRatioPct || d.Effects[0].TotalDelta != -1000 || d.Effects[0].RampTicks != 1 ||
		d.Effects[1].Metric != corporategovernance.MetricBaseGrowthPct || d.Effects[1].TotalDelta != 50 || d.Effects[1].RampTicks != 4 {
		t.Errorf("efeitos = %+v", d.Effects)
	}
	if _, created, err := svc.RecordDecision(ctx, in); err != nil || created {
		t.Fatalf("repetida: created=%v err=%v", created, err)
	}

	// Um evento por efeito, antes de qualquer mudança, com a mudança total em centésimos.
	rows, err := conn.QueryContext(ctx, `SELECT ev.quantity, ev.reference_id::text FROM governance_decision_effects e
		JOIN market_events ev ON ev.id = e.event_id ORDER BY e.position`)
	if err != nil {
		t.Fatal(err)
	}
	var quantities []int
	for rows.Next() {
		var q int
		var ref string
		if err := rows.Scan(&q, &ref); err != nil {
			t.Fatal(err)
		}
		if ref != a1 {
			t.Errorf("reference_id = %s", ref)
		}
		quantities = append(quantities, q)
	}
	_ = rows.Close()
	if len(quantities) != 2 || quantities[0] != -1000 || quantities[1] != 50 {
		t.Errorf("eventos = %v, esperado [-1000 50]", quantities)
	}
	scan(&payout, `SELECT payout_ratio_pct::float8 FROM companies WHERE id = $1`, company)
	if payout != 50 {
		t.Fatalf("registrar a decisão não pode mexer na empresa: payout = %v", payout)
	}

	// Primeiro tick: o payout vale inteiro, o crescimento anda 1/4 da rampa.
	if n, err := svc.ApplyDue(ctx, 11); err != nil || n != 2 {
		t.Fatalf("ApplyDue(11): n=%d err=%v", n, err)
	}
	var growth float64
	scan(&payout, `SELECT payout_ratio_pct::float8 FROM companies WHERE id = $1`, company)
	scan(&growth, `SELECT base_growth_pct::float8 FROM companies WHERE id = $1`, company)
	if payout != 40 || growth != 3.13 {
		t.Errorf("depois do tick 11: payout=%v crescimento=%v, esperado 40 e 3.13", payout, growth)
	}
	for day := 12; day <= 15; day++ {
		if _, err := svc.ApplyDue(ctx, day); err != nil {
			t.Fatal(err)
		}
	}
	scan(&payout, `SELECT payout_ratio_pct::float8 FROM companies WHERE id = $1`, company)
	scan(&growth, `SELECT base_growth_pct::float8 FROM companies WHERE id = $1`, company)
	if payout != 40 || growth != 3.5 {
		t.Errorf("final: payout=%v crescimento=%v, esperado 40 e 3.50", payout, growth)
	}

	// Cooldown por grupo: os dois grupos mudaram no dia 11, então uma segunda decisão (dia 20)
	// só registra. Com o calendário em 130, os dois liberam de novo.
	exec(`UPDATE market_calendar SET current_day = 20 WHERE id = 1`)
	in2 := in
	in2.AssemblyID = a2
	skipped, _, err := svc.RecordDecision(ctx, in2)
	if err != nil || skipped.Effects[0].Status != corporategovernance.StatusSkippedCooldown || skipped.Effects[1].Status != corporategovernance.StatusSkippedCooldown {
		t.Fatalf("cooldown dos dois grupos: %+v err=%v", skipped, err)
	}

	// O payout nunca sai da faixa: de 40 desce a 20 em dois degraus e o terceiro é ignorado.
	exec(`UPDATE market_calendar SET current_day = 200 WHERE id = 1`)
	for i, assembly := range []string{"cccccccc-cccc-4ccc-8ccc-ccccccccccc1", "cccccccc-cccc-4ccc-8ccc-ccccccccccc2", "cccccccc-cccc-4ccc-8ccc-ccccccccccc3"} {
		exec(`UPDATE market_calendar SET current_day = $1 WHERE id = 1`, 200+i*100)
		dec, _, err := svc.RecordDecision(ctx, corporategovernance.DecisionInput{AssemblyID: assembly, CompanyID: company, OptionKey: "o",
			Effects: []corporategovernance.Effect{{Metric: corporategovernance.MetricPayoutRatioPct, Direction: -1, Intensity: 1}}})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := svc.ApplyDue(ctx, dec.Effects[0].StartDay); err != nil {
			t.Fatal(err)
		}
		scan(&payout, `SELECT payout_ratio_pct::float8 FROM companies WHERE id = $1`, company)
		want := []float64{30, 20, 20}[i]
		if payout != want {
			t.Errorf("degrau %d: payout = %v, esperado %v", i+1, payout, want)
		}
		if i == 2 && dec.Effects[0].Status != corporategovernance.StatusSkippedOutOfRange {
			t.Errorf("abaixo do piso deveria ser ignorado: %s", dec.Effects[0].Status)
		}
	}
}

// Declaração pendente (MO.6.11) contra Postgres real: retém no tick, aparece para o backend,
// a decisão ligada só libera depois do payout aplicado, a liberação grava a data-ex real que o
// efeito de preço usa, e liberação pedida sem decisão sai no próximo tick.
func TestGovernanceRepository_DeclaracaoPendente(t *testing.T) {
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
	var company, asset, ana string
	scan(&company, `INSERT INTO companies (name, cnpj, sector) VALUES ('Acme', '11111111000111', 'Tecnologia') RETURNING id`)
	scan(&asset, `INSERT INTO assets (ticker, name, type) VALUES ('ACME3', 'Acme ON', 'acao') RETURNING id`)
	exec(`INSERT INTO variable_income_assets (asset_id, company_id, share_class, outstanding_shares) VALUES ($1, $2, 'ON', 1000)`, asset, company)
	scan(&ana, `INSERT INTO accounts (user_id) VALUES (gen_random_uuid()) RETURNING user_id`)
	exec(`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $2, 10, 5)`, ana, asset)
	exec(`INSERT INTO market_calendar (id, current_day, selic_rate) VALUES (1, 91, 10.75) ON CONFLICT (id) DO UPDATE SET current_day = 91`)

	repo := NewGovernanceRepository(conn)
	tickRepo := NewTickRepository(conn, nil)
	svc := corporategovernance.NewService(repo, govSettings{enginesetting.Values{
		GovernanceGrowthStepCentiPP: 50, GovernanceQualityStepCenti: 5, GovernanceRampTicks: 4, GovernanceCooldownDays: 90,
		GovernancePayoutStepCentiPP: 1000, GovernancePayoutMinPct: 20, GovernancePayoutMaxPct: 90, GovernancePayoutCooldownDays: 90,
		GovernanceHoldDeclarations: 1, GovernanceDeclarationSafetyDays: 60,
	}})
	saveTx := func(res tick.Result) {
		t.Helper()
		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			t.Fatal(err)
		}
		if err := saveDeclarations(ctx, tx, res); err != nil {
			_ = tx.Rollback()
			t.Fatal(err)
		}
		if err := tx.Commit(); err != nil {
			t.Fatal(err)
		}
	}
	companyRow := func() tick.CompanyForFundamentals {
		t.Helper()
		cs, err := tickRepo.ListCompaniesForFundamentals(ctx)
		if err != nil || len(cs) != 1 {
			t.Fatalf("ListCompaniesForFundamentals: %v (%d)", err, len(cs))
		}
		return cs[0]
	}

	// Antes de qualquer retenção: acionista de usuário, nada retido.
	if c := companyRow(); !c.UserShareholders || c.HasHeldDeclaration || c.LastPayoutStartDay != nil || c.PayoutRatioPct != 50 {
		t.Fatalf("empresa antes: %+v", c)
	}

	// O tick retém a declaração do ciclo 0 (idempotente: repetir não duplica).
	held := tick.HeldDeclaration{CompanyID: company, CycleIndex: 0, ReportDay: 91, PoolNetIncome: 123456.78}
	saveTx(tick.Result{State: tick.State{Day: 91}, HeldDeclarations: []tick.HeldDeclaration{held}})
	saveTx(tick.Result{State: tick.State{Day: 91}, HeldDeclarations: []tick.HeldDeclaration{held}})
	pendings, err := repo.ListPending(ctx)
	if err != nil || len(pendings) != 1 {
		t.Fatalf("ListPending: %v (%d)", err, len(pendings))
	}
	p := pendings[0]
	if p.CompanyID != company || p.Name != "Acme" || p.CycleIndex != 0 || p.ReportDay != 91 || p.HeldDay != 91 ||
		p.PoolNetIncome != 123456.78 || len(p.Tickers) != 1 || p.Tickers[0] != "ACME3" || p.DecisionAssemblyID != nil {
		t.Errorf("pendente = %+v", p)
	}
	if c := companyRow(); !c.HasHeldDeclaration || len(c.HeldCycles) != 1 || c.HeldCycles[0] != 0 {
		t.Errorf("empresa com retida: %+v", c)
	}
	if orders, err := svc.ReleaseDue(ctx, 92); err != nil || len(orders) != 0 {
		t.Fatalf("nada a liberar ainda: %v %v", orders, err)
	}

	// A decisão ligada à declaração: payout cai 10 p.p., mas só libera depois de aplicado.
	exec(`UPDATE market_calendar SET current_day = 97 WHERE id = 1`)
	const assembly = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1"
	d, _, err := svc.RecordDecision(ctx, corporategovernance.DecisionInput{
		AssemblyID: assembly, CompanyID: company, OptionKey: "reinvestir", DeclarationID: p.ID,
		Effects: []corporategovernance.Effect{{Metric: corporategovernance.MetricPayoutRatioPct, Direction: -1, Intensity: 1}},
	})
	if err != nil || d.Effects[0].Status != corporategovernance.StatusScheduled {
		t.Fatalf("RecordDecision: %+v %v", d, err)
	}
	pendings, _ = repo.ListPending(ctx)
	if pendings[0].DecisionAssemblyID == nil || *pendings[0].DecisionAssemblyID != assembly || !pendings[0].PayoutEffectPending {
		t.Fatalf("decisão ligada e payout por aplicar: %+v", pendings[0])
	}
	if orders, _ := svc.ReleaseDue(ctx, 98); len(orders) != 0 {
		t.Fatalf("payout ainda não aplicado: %v", orders)
	}
	if _, err := svc.ApplyDue(ctx, 98); err != nil {
		t.Fatal(err)
	}
	orders, err := svc.ReleaseDue(ctx, 98)
	if err != nil || len(orders) != 1 || orders[0].Reason != corporategovernance.ReleaseDecision || orders[0].PoolNetIncome != 123456.78 {
		t.Fatalf("depois do payout aplicado a declaração sai: %v %v", orders, err)
	}
	var payout float64
	scan(&payout, `SELECT payout_ratio_pct::float8 FROM companies WHERE id = $1`, company)
	if payout != 40 {
		t.Errorf("payout = %v, esperado 40", payout)
	}
	if c := companyRow(); c.LastPayoutStartDay == nil || *c.LastPayoutStartDay != 98 {
		t.Errorf("cooldown do payout começa na decisão: %+v", c.LastPayoutStartDay)
	}

	// O tick libera: provento com a data-ex real, declaração sai da lista de retidas.
	saveTx(tick.Result{State: tick.State{Day: 98}, ReleasedDeclarations: []tick.ReleasedDeclaration{{ID: orders[0].ID, ExDay: 101, Reason: "decision"}}})
	saveTx(tick.Result{State: tick.State{Day: 99}, ReleasedDeclarations: []tick.ReleasedDeclaration{{ID: orders[0].ID, ExDay: 777, Reason: "expired"}}}) // repetir não muda
	if pendings, _ := repo.ListPending(ctx); len(pendings) != 0 {
		t.Fatalf("liberada não aparece mais: %+v", pendings)
	}
	var status, reason string
	var releasedDay, exDay int
	scan(&status, `SELECT status FROM governance_pending_declarations WHERE id = $1`, orders[0].ID)
	scan(&reason, `SELECT release_reason FROM governance_pending_declarations WHERE id = $1`, orders[0].ID)
	scan(&releasedDay, `SELECT released_day FROM governance_pending_declarations WHERE id = $1`, orders[0].ID)
	scan(&exDay, `SELECT release_ex_day FROM governance_pending_declarations WHERE id = $1`, orders[0].ID)
	if status != "released" || reason != "decision" || releasedDay != 98 || exDay != 101 {
		t.Errorf("liberada: status=%s motivo=%s dia=%d ex=%d", status, reason, releasedDay, exDay)
	}
	if c := companyRow(); c.HasHeldDeclaration || c.DeclaredExByCycle[0] != 101 {
		t.Errorf("empresa depois da liberação: %+v", c)
	}

	// Próximo balanço (ciclo 1): liberação pedida sem decisão sai no próximo tick, com o primeiro motivo.
	saveTx(tick.Result{State: tick.State{Day: 182}, HeldDeclarations: []tick.HeldDeclaration{{CompanyID: company, CycleIndex: 1, ReportDay: 182, PoolNetIncome: 5}}})
	next, _ := repo.ListPending(ctx)
	if len(next) != 1 {
		t.Fatalf("segunda retida: %+v", next)
	}
	if err := svc.RequestRelease(ctx, next[0].ID, corporategovernance.ReleaseNoDecision); err != nil {
		t.Fatal(err)
	}
	if err := svc.RequestRelease(ctx, next[0].ID, corporategovernance.ReleaseAdmin); err != nil {
		t.Fatal(err)
	}
	orders, _ = svc.ReleaseDue(ctx, 183)
	if len(orders) != 1 || orders[0].Reason != corporategovernance.ReleaseNoDecision {
		t.Errorf("liberação pedida: %+v", orders)
	}
	if err := svc.RequestRelease(ctx, "99999999-9999-4999-8999-999999999999", corporategovernance.ReleaseAdmin); err != corporategovernance.ErrUnknownDeclaration {
		t.Errorf("inexistente: %v", err)
	}

	// Prazo de segurança: uma retida sem nada resolvido sai sozinha depois de 60 dias.
	saveTx(tick.Result{State: tick.State{Day: 200}, ReleasedDeclarations: []tick.ReleasedDeclaration{{ID: orders[0].ID, ExDay: 190, Reason: "no_decision"}}})
	saveTx(tick.Result{State: tick.State{Day: 273}, HeldDeclarations: []tick.HeldDeclaration{{CompanyID: company, CycleIndex: 2, ReportDay: 273, PoolNetIncome: 9}}})
	if orders, _ := svc.ReleaseDue(ctx, 332); len(orders) != 0 {
		t.Errorf("dia 332 ainda dentro do prazo: %v", orders)
	}
	if orders, _ := svc.ReleaseDue(ctx, 333); len(orders) != 1 || orders[0].Reason != corporategovernance.ReleaseExpired {
		t.Errorf("dia 333 vence o prazo: %v", orders)
	}
}

// Política de dividendo e prêmio da PN como efeito da assembleia (MO.6.12): a política troca o
// valor (sem degrau), o prêmio anda em passos dentro da faixa legal, ambos valem já no tick
// seguinte, compartilham o cooldown de destinação do lucro e a empresa só com ON ignora o prêmio.
func TestGovernanceRepository_PoliticaEPremioDaPN(t *testing.T) {
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
	var withPN, onlyON, on, pn, onOnly string
	scan(&withPN, `INSERT INTO companies (name, cnpj, sector) VALUES ('ComPN', '11111111000111', 'Tecnologia') RETURNING id`)
	scan(&onlyON, `INSERT INTO companies (name, cnpj, sector) VALUES ('SoON', '22222222000122', 'Varejo') RETURNING id`)
	scan(&on, `INSERT INTO assets (ticker, name, type) VALUES ('CPN3', 'ON', 'acao') RETURNING id`)
	scan(&pn, `INSERT INTO assets (ticker, name, type) VALUES ('CPN4', 'PN', 'acao') RETURNING id`)
	scan(&onOnly, `INSERT INTO assets (ticker, name, type) VALUES ('SON3', 'ON', 'acao') RETURNING id`)
	exec(`INSERT INTO variable_income_assets (asset_id, company_id, share_class, outstanding_shares)
		VALUES ($1, $4, 'ON', 1000), ($2, $4, 'PN', 1000), ($3, $5, 'ON', 1000)`, on, pn, onOnly, withPN, onlyON)
	exec(`INSERT INTO market_calendar (id, current_day, selic_rate) VALUES (1, 10, 10.75) ON CONFLICT (id) DO UPDATE SET current_day = 10`)

	repo := NewGovernanceRepository(conn)
	svc := corporategovernance.NewService(repo, govSettings{enginesetting.Values{
		GovernanceGrowthStepCentiPP: 50, GovernanceQualityStepCenti: 5, GovernanceRampTicks: 4, GovernanceCooldownDays: 90,
		GovernancePayoutStepCentiPP: 1000, GovernancePayoutMinPct: 20, GovernancePayoutMaxPct: 90, GovernancePayoutCooldownDays: 90,
		GovernancePremiumStepCentiPP: 500, GovernancePremiumMinPct: 10, GovernancePremiumMaxPct: 30,
	}})
	record := func(assembly, company string, effects ...corporategovernance.Effect) corporategovernance.Decision {
		t.Helper()
		d, _, err := svc.RecordDecision(ctx, corporategovernance.DecisionInput{AssemblyID: assembly, CompanyID: company, OptionKey: "o", Effects: effects})
		if err != nil {
			t.Fatal(err)
		}
		return d
	}
	const a1 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
	const a2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"
	const a3 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3"
	const a4 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4"

	// Política + prêmio numa decisão composta (duas alavancas diferentes do mesmo grupo).
	d := record(a1, withPN,
		corporategovernance.Effect{Metric: corporategovernance.MetricDividendPolicy, Value: "semiannual"},
		corporategovernance.Effect{Metric: corporategovernance.MetricPnPremiumPct, Direction: 1, Intensity: 1})
	if d.Effects[0].Status != corporategovernance.StatusScheduled || d.Effects[0].TargetValue != "semiannual" || d.Effects[0].Direction != 0 ||
		d.Effects[1].Status != corporategovernance.StatusScheduled || d.Effects[1].TotalDelta != 500 {
		t.Fatalf("efeitos = %+v", d.Effects)
	}
	var policy string
	var premium float64
	scan(&policy, `SELECT dividend_policy FROM companies WHERE id = $1`, withPN)
	if policy != "quarterly" {
		t.Fatalf("registrar não muda a política: %s", policy)
	}
	// Eventos: política grava os ciclos por pagamento (2), prêmio a mudança em centésimos (500).
	rows, err := conn.QueryContext(ctx, `SELECT ev.quantity FROM governance_decision_effects e JOIN market_events ev ON ev.id = e.event_id ORDER BY e.position`)
	if err != nil {
		t.Fatal(err)
	}
	var quantities []int
	for rows.Next() {
		var q int
		if err := rows.Scan(&q); err != nil {
			t.Fatal(err)
		}
		quantities = append(quantities, q)
	}
	_ = rows.Close()
	if len(quantities) != 2 || quantities[0] != 2 || quantities[1] != 500 {
		t.Errorf("eventos = %v, esperado [2 500]", quantities)
	}

	if n, err := svc.ApplyDue(ctx, 11); err != nil || n != 2 {
		t.Fatalf("ApplyDue: n=%d err=%v", n, err)
	}
	scan(&policy, `SELECT dividend_policy FROM companies WHERE id = $1`, withPN)
	scan(&premium, `SELECT pn_dividend_premium_pct::float8 FROM companies WHERE id = $1`, withPN)
	if policy != "semiannual" || premium != 15 {
		t.Errorf("depois do tick: política=%s prêmio=%v, esperado semiannual e 15", policy, premium)
	}
	var status string
	scan(&status, `SELECT e.status FROM governance_decision_effects e JOIN governance_decisions g ON g.id = e.decision_id WHERE g.assembly_id = $1 AND e.position = 0`, a1)
	if status != "completed" {
		t.Errorf("status da política = %s", status)
	}

	// Cooldown de destinação do lucro: nova decisão logo depois só registra.
	exec(`UPDATE market_calendar SET current_day = 20 WHERE id = 1`)
	d = record(a2, withPN, corporategovernance.Effect{Metric: corporategovernance.MetricPnPremiumPct, Direction: 1, Intensity: 1})
	if d.Effects[0].Status != corporategovernance.StatusSkippedCooldown {
		t.Errorf("em cooldown: %s", d.Effects[0].Status)
	}

	// Fora do cooldown: o prêmio sobe até o teto e para; o piso legal nunca é rompido.
	for i, step := range []struct {
		assembly string
		day      int
		dir      int
		wantPct  float64
		want     corporategovernance.Status
	}{
		{a3, 150, 1, 20, corporategovernance.StatusScheduled},
		{a4, 300, -1, 15, corporategovernance.StatusScheduled},
	} {
		exec(`UPDATE market_calendar SET current_day = $1 WHERE id = 1`, step.day)
		dec := record(step.assembly, withPN, corporategovernance.Effect{Metric: corporategovernance.MetricPnPremiumPct, Direction: step.dir, Intensity: 1})
		if dec.Effects[0].Status != step.want {
			t.Fatalf("passo %d: status = %s", i, dec.Effects[0].Status)
		}
		if _, err := svc.ApplyDue(ctx, dec.Effects[0].StartDay); err != nil {
			t.Fatal(err)
		}
		scan(&premium, `SELECT pn_dividend_premium_pct::float8 FROM companies WHERE id = $1`, withPN)
		if premium != step.wantPct {
			t.Errorf("passo %d: prêmio = %v, esperado %v", i, premium, step.wantPct)
		}
	}
	exec(`UPDATE companies SET pn_dividend_premium_pct = 10 WHERE id = $1`, withPN)
	exec(`UPDATE market_calendar SET current_day = 500 WHERE id = 1`)
	if dec := record("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5", withPN, corporategovernance.Effect{Metric: corporategovernance.MetricPnPremiumPct, Direction: -1, Intensity: 1}); dec.Effects[0].Status != corporategovernance.StatusSkippedOutOfRange {
		t.Errorf("abaixo do piso legal: %s", dec.Effects[0].Status)
	}

	// Empresa só com ON: o prêmio não se aplica; política igual à atual também não.
	dec := record("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6", onlyON,
		corporategovernance.Effect{Metric: corporategovernance.MetricPnPremiumPct, Direction: 1, Intensity: 1},
		corporategovernance.Effect{Metric: corporategovernance.MetricDividendPolicy, Value: "quarterly"})
	if dec.Effects[0].Status != corporategovernance.StatusSkippedNotApplicable || dec.Effects[1].Status != corporategovernance.StatusSkippedNotApplicable {
		t.Errorf("sem PN e política igual: %+v", dec.Effects)
	}
	var q int
	scan(&q, `SELECT ev.quantity FROM governance_decision_effects e JOIN market_events ev ON ev.id = e.event_id
		JOIN governance_decisions g ON g.id = e.decision_id WHERE g.assembly_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6' AND e.position = 1`)
	if q != 0 {
		t.Errorf("a política que não mudou grava evento de quantidade 0: %d", q)
	}
	scan(&premium, `SELECT pn_dividend_premium_pct::float8 FROM companies WHERE id = $1`, onlyON)
	if premium != 10 {
		t.Errorf("prêmio da empresa só-ON mudou: %v", premium)
	}
}
