package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/corporategovernance"
	"tcc-investimentos/engine/internal/infra/eventstore"
)

// GovernanceRepository persiste o snapshot de posições e as decisões das assembleias
// (MO.6.2) e aplica o efeito aos fundamentos da empresa. Implementa
// corporategovernance.Repository.
type GovernanceRepository struct {
	db *sql.DB
}

var _ corporategovernance.Repository = (*GovernanceRepository)(nil)

func NewGovernanceRepository(db *sql.DB) *GovernanceRepository {
	return &GovernanceRepository{db: db}
}

// lockAssembly serializa as chamadas de uma mesma assembleia (duas chamadas simultâneas do
// job de abertura ou de fechamento não gravam duas vezes), sem travar nada além da transação.
func lockAssembly(ctx context.Context, tx *sql.Tx, assemblyID string) error {
	_, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, "governance:"+assemblyID)
	return err
}

func (r *GovernanceRepository) TakeSnapshot(ctx context.Context, assemblyID, companyID string) (corporategovernance.Snapshot, bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return corporategovernance.Snapshot{}, false, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := lockAssembly(ctx, tx, assemblyID); err != nil {
		return corporategovernance.Snapshot{}, false, err
	}

	if existing, found, err := loadSnapshot(ctx, tx, assemblyID); err != nil || found {
		if err != nil {
			return existing, false, err
		}
		return existing, false, tx.Commit()
	}

	var exists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM companies WHERE id = $1)`, companyID).Scan(&exists); err != nil {
		return corporategovernance.Snapshot{}, false, err
	}
	if !exists {
		return corporategovernance.Snapshot{}, false, corporategovernance.ErrUnknownCompany
	}
	day, err := loadSimulatedDay(ctx, tx)
	if err != nil {
		return corporategovernance.Snapshot{}, false, err
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO governance_snapshot_runs (assembly_id, company_id, simulated_day) VALUES ($1, $2, $3)`,
		assemblyID, companyID, day); err != nil {
		return corporategovernance.Snapshot{}, false, err
	}
	// Só contas de usuário (bots fora), ações da empresa somadas entre as classes (ON e PN).
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO governance_snapshot_holdings (assembly_id, user_id, quantity)
		 SELECT $1, p.user_id, SUM(p.quantity)
		 FROM positions p
		 JOIN accounts ac ON ac.user_id = p.user_id AND NOT ac.is_bot
		 JOIN variable_income_assets v ON v.asset_id = p.asset_id AND v.company_id = $2
		 GROUP BY p.user_id
		 HAVING SUM(p.quantity) > 0`, assemblyID, companyID); err != nil {
		return corporategovernance.Snapshot{}, false, err
	}
	snap, _, err := loadSnapshot(ctx, tx, assemblyID)
	if err != nil {
		return corporategovernance.Snapshot{}, false, err
	}
	return snap, true, tx.Commit()
}

func (r *GovernanceRepository) GetSnapshot(ctx context.Context, assemblyID string) (corporategovernance.Snapshot, bool, error) {
	return loadSnapshot(ctx, r.db, assemblyID)
}

type governanceQuerier interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func loadSnapshot(ctx context.Context, q governanceQuerier, assemblyID string) (corporategovernance.Snapshot, bool, error) {
	snap := corporategovernance.Snapshot{AssemblyID: assemblyID, Holdings: []corporategovernance.Holding{}}
	err := q.QueryRowContext(ctx,
		`SELECT company_id, taken_at, simulated_day FROM governance_snapshot_runs WHERE assembly_id = $1`, assemblyID,
	).Scan(&snap.CompanyID, &snap.TakenAt, &snap.SimulatedDay)
	if errors.Is(err, sql.ErrNoRows) {
		return corporategovernance.Snapshot{}, false, nil
	}
	if err != nil {
		return corporategovernance.Snapshot{}, false, err
	}
	rows, err := q.QueryContext(ctx,
		`SELECT user_id, quantity FROM governance_snapshot_holdings WHERE assembly_id = $1 ORDER BY user_id`, assemblyID)
	if err != nil {
		return corporategovernance.Snapshot{}, false, err
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var h corporategovernance.Holding
		if err := rows.Scan(&h.UserID, &h.Quantity); err != nil {
			return corporategovernance.Snapshot{}, false, err
		}
		snap.Holdings = append(snap.Holdings, h)
	}
	return snap, true, rows.Err()
}

const decisionColumns = `id, assembly_id, company_id, option_key, decided_at`

const effectColumns = `id, position, metric, COALESCE(direction, 0), COALESCE(intensity::float8, 0), COALESCE(target_value, ''), status, total_delta, ramp_ticks, start_day, applied_ticks, applied_delta`

func scanDecisionHeader(scan func(dest ...any) error) (corporategovernance.Decision, error) {
	var d corporategovernance.Decision
	err := scan(&d.ID, &d.AssemblyID, &d.CompanyID, &d.OptionKey, &d.DecidedAt)
	return d, err
}

func scanEffect(scan func(dest ...any) error) (corporategovernance.EffectRecord, error) {
	var e corporategovernance.EffectRecord
	var metric, status string
	err := scan(&e.ID, &e.Position, &metric, &e.Direction, &e.Intensity, &e.TargetValue, &status, &e.TotalDelta, &e.RampTicks, &e.StartDay, &e.AppliedTicks, &e.AppliedDelta)
	e.Metric = corporategovernance.Metric(metric)
	e.Status = corporategovernance.Status(status)
	return e, err
}

// loadDecision lê a decisão da assembleia com os efeitos, na ordem de posição.
func loadDecision(ctx context.Context, q governanceQuerier, assemblyID string) (corporategovernance.Decision, bool, error) {
	d, err := scanDecisionHeader(q.QueryRowContext(ctx,
		`SELECT `+decisionColumns+` FROM governance_decisions WHERE assembly_id = $1`, assemblyID).Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return corporategovernance.Decision{}, false, nil
	}
	if err != nil {
		return corporategovernance.Decision{}, false, err
	}
	rows, err := q.QueryContext(ctx,
		`SELECT `+effectColumns+` FROM governance_decision_effects WHERE decision_id = $1 ORDER BY position`, d.ID)
	if err != nil {
		return corporategovernance.Decision{}, false, err
	}
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		e, err := scanEffect(rows.Scan)
		if err != nil {
			return corporategovernance.Decision{}, false, err
		}
		e.AssemblyID = d.AssemblyID
		d.Effects = append(d.Effects, e)
	}
	return d, true, rows.Err()
}

func (r *GovernanceRepository) GetDecision(ctx context.Context, assemblyID string) (corporategovernance.Decision, bool, error) {
	return loadDecision(ctx, r.db, assemblyID)
}

// lastStartDays lê o início do último efeito aplicado (ou em aplicação) de cada grupo de
// cooldown da empresa.
func lastStartDays(ctx context.Context, q governanceQuerier, companyID string) (map[corporategovernance.Group]int, error) {
	var fundamentals, payout sql.NullInt64
	if err := q.QueryRowContext(ctx,
		`SELECT MAX(start_day) FILTER (WHERE metric NOT IN (`+payoutGroupMetricsSQL+`)),
		        MAX(start_day) FILTER (WHERE metric IN (`+payoutGroupMetricsSQL+`))
		 FROM governance_decision_effects WHERE company_id = $1 AND status IN ('scheduled', 'completed')`,
		companyID).Scan(&fundamentals, &payout); err != nil {
		return nil, err
	}
	out := map[corporategovernance.Group]int{}
	if fundamentals.Valid {
		out[corporategovernance.GroupFundamentals] = int(fundamentals.Int64)
	}
	if payout.Valid {
		out[corporategovernance.GroupPayout] = int(payout.Int64)
	}
	return out, nil
}

// RecordDecision grava os eventos imutáveis (um por efeito) e a decisão na mesma transação,
// nessa ordem: o evento vem ANTES de qualquer efeito (que só acontece nos ticks seguintes, em
// ApplyStep).
func (r *GovernanceRepository) RecordDecision(ctx context.Context, in corporategovernance.DecisionInput, plan corporategovernance.PlanFunc) (corporategovernance.Decision, bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return corporategovernance.Decision{}, false, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := lockAssembly(ctx, tx, in.AssemblyID); err != nil {
		return corporategovernance.Decision{}, false, err
	}

	existing, found, err := loadDecision(ctx, tx, in.AssemblyID)
	if err != nil {
		return corporategovernance.Decision{}, false, err
	}
	if found {
		return existing, false, tx.Commit()
	}

	// Trava a empresa: duas decisões de assembleias diferentes sobre a mesma empresa se
	// serializam, então o cooldown enxerga a anterior.
	var growth, quality, payout, premium int
	var policy string
	err = tx.QueryRowContext(ctx,
		`SELECT ROUND(base_growth_pct * 100)::int, ROUND(quality_multiplier * 100)::int, ROUND(payout_ratio_pct * 100)::int,
		        ROUND(pn_dividend_premium_pct * 100)::int, dividend_policy
		 FROM companies WHERE id = $1 FOR UPDATE`, in.CompanyID).Scan(&growth, &quality, &payout, &premium, &policy)
	if errors.Is(err, sql.ErrNoRows) {
		return corporategovernance.Decision{}, false, corporategovernance.ErrUnknownCompany
	}
	if err != nil {
		return corporategovernance.Decision{}, false, err
	}
	state := corporategovernance.CompanyState{
		BaseGrowthPct: growth, QualityMultiplier: quality, PayoutRatioPct: payout, PnPremiumPct: premium, DividendPolicy: policy,
	}
	if err := tx.QueryRowContext(ctx,
		`SELECT EXISTS (SELECT 1 FROM variable_income_assets WHERE company_id = $1 AND share_class = 'PN')`, in.CompanyID).Scan(&state.HasPN); err != nil {
		return corporategovernance.Decision{}, false, err
	}
	if state.Today, err = loadSimulatedDay(ctx, tx); err != nil {
		return corporategovernance.Decision{}, false, err
	}
	if state.LastStartDay, err = lastStartDays(ctx, tx, in.CompanyID); err != nil {
		return corporategovernance.Decision{}, false, err
	}

	plans, err := plan(state)
	if err != nil {
		return corporategovernance.Decision{}, false, err
	}
	if len(plans) != len(in.Effects) {
		return corporategovernance.Decision{}, false, fmt.Errorf("plano com %d efeitos para %d pedidos", len(plans), len(in.Effects))
	}

	// A conta técnica nasce na primeira decisão (idempotente).
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO accounts (user_id, current_balance, is_bot, is_active) VALUES ($1, 0, true, false)
		 ON CONFLICT (user_id) DO NOTHING`, domain.GovernanceAccountID); err != nil {
		return corporategovernance.Decision{}, false, err
	}

	// O evento é do ativo da empresa (a primeira classe de ação, por ordem estável).
	var assetID string
	if err := tx.QueryRowContext(ctx,
		`SELECT asset_id FROM variable_income_assets WHERE company_id = $1 ORDER BY share_class, asset_id LIMIT 1`,
		in.CompanyID).Scan(&assetID); err != nil {
		return corporategovernance.Decision{}, false, fmt.Errorf("empresa sem ativo de renda variável: %w", err)
	}
	// Uma linha de evento por efeito; governance_decision_effects.event_id liga cada uma à
	// sua métrica (o evento só carrega a mudança total em `quantity`).
	eventIDs := make([]string, 0, len(plans))
	for i, p := range plans {
		total := p.TotalDelta
		if in.Effects[i].Metric == corporategovernance.MetricDividendPolicy && p.Status != corporategovernance.StatusSkippedCooldown {
			// A política não soma degrau: o evento guarda quantos ciclos de lucro cada
			// pagamento passa a ter (1, 2 ou 4), ou 0 se a troca não se aplicou.
			total = corporategovernance.PolicyCycles(in.Effects[i].Value)
			if p.Status == corporategovernance.StatusSkippedNotApplicable {
				total = 0
			}
		}
		eventID, err := eventstore.AppendTxReturningID(ctx, tx, domain.MarketEvent{
			UserID:      domain.GovernanceAccountID,
			AssetID:     &assetID,
			EventType:   domain.EventAssemblyDecision,
			Quantity:    &total,
			ReferenceID: &in.AssemblyID,
		})
		if err != nil {
			return corporategovernance.Decision{}, false, err
		}
		eventIDs = append(eventIDs, eventID)
	}

	var decisionID string
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO governance_decisions (assembly_id, company_id, option_key) VALUES ($1, $2, $3) RETURNING id`,
		in.AssemblyID, in.CompanyID, in.OptionKey).Scan(&decisionID); err != nil {
		return corporategovernance.Decision{}, false, err
	}
	for i, e := range in.Effects {
		p := plans[i]
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO governance_decision_effects
			   (decision_id, company_id, position, event_id, metric, direction, intensity, target_value, status, total_delta, ramp_ticks, start_day)
			 VALUES ($1, $2, $3, $11, $4, NULLIF($5, 0), NULLIF($6::numeric, 0), NULLIF($12, ''), $7, $8, $9, $10)`,
			decisionID, in.CompanyID, i, string(e.Metric), e.Direction, e.Intensity,
			string(p.Status), p.TotalDelta, p.RampTicks, p.StartDay, eventIDs[i], e.Value); err != nil {
			return corporategovernance.Decision{}, false, err
		}
	}
	if in.DeclarationID != "" {
		// Liga a decisão à declaração retida da empresa; se ela já saiu (prazo de segurança ou
		// liberação pedida), a decisão vale só como fundamentos e destinação para o futuro.
		if _, err := tx.ExecContext(ctx,
			`UPDATE governance_pending_declarations SET decision_assembly_id = $2
			 WHERE id = $1 AND company_id = $3 AND status = 'held' AND decision_assembly_id IS NULL AND NOT release_requested`,
			in.DeclarationID, in.AssemblyID, in.CompanyID); err != nil {
			return corporategovernance.Decision{}, false, err
		}
	}
	decision, _, err := loadDecision(ctx, tx, in.AssemblyID)
	if err != nil {
		return corporategovernance.Decision{}, false, err
	}
	return decision, true, tx.Commit()
}

func (r *GovernanceRepository) ListScheduled(ctx context.Context) ([]corporategovernance.EffectRecord, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT e.id, e.position, e.metric, COALESCE(e.direction, 0), COALESCE(e.intensity::float8, 0), e.status, e.total_delta, e.ramp_ticks,
		        e.start_day, e.applied_ticks, e.applied_delta, d.assembly_id
		 FROM governance_decision_effects e JOIN governance_decisions d ON d.id = e.decision_id
		 WHERE e.status = 'scheduled' ORDER BY e.start_day, d.assembly_id, e.position`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var out []corporategovernance.EffectRecord
	for rows.Next() {
		var e corporategovernance.EffectRecord
		var metric, status string
		if err := rows.Scan(&e.ID, &e.Position, &metric, &e.Direction, &e.Intensity, &status, &e.TotalDelta, &e.RampTicks,
			&e.StartDay, &e.AppliedTicks, &e.AppliedDelta, &e.AssemblyID); err != nil {
			return nil, err
		}
		e.Metric, e.Status = corporategovernance.Metric(metric), corporategovernance.Status(status)
		out = append(out, e)
	}
	return out, rows.Err()
}

// metricColumn é a coluna de companies que a métrica mexe, e a escala em centésimos dela.
func metricColumn(m corporategovernance.Metric) string {
	switch m {
	case corporategovernance.MetricQualityMultiplier:
		return "quality_multiplier"
	case corporategovernance.MetricPayoutRatioPct:
		return "payout_ratio_pct"
	case corporategovernance.MetricPnPremiumPct:
		return "pn_dividend_premium_pct"
	}
	return "base_growth_pct"
}

// ApplyStep aplica um passo da rampa na empresa e avança o efeito na mesma transação. Só
// vale se o efeito ainda está em `previousTicks` (outro processo que chegou antes não é
// aplicado duas vezes). Se o passo levaria o valor para fora da faixa válida (ex.: alguém
// editou a empresa no meio da rampa), o efeito é encerrado como `skipped_out_of_range` e
// nada muda.
func (r *GovernanceRepository) ApplyStep(ctx context.Context, effectID string, previousTicks int, step corporategovernance.StepApplication, limits corporategovernance.Limits) (bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback() }()

	var companyID, metric string
	var target sql.NullString
	var applied int
	err = tx.QueryRowContext(ctx,
		`SELECT company_id, metric, applied_ticks, target_value FROM governance_decision_effects
		 WHERE id = $1 AND status = 'scheduled' FOR UPDATE`, effectID).Scan(&companyID, &metric, &applied, &target)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if applied != previousTicks {
		return false, nil
	}

	if corporategovernance.IsDiscrete(corporategovernance.Metric(metric)) {
		// Troca de valor (política de dividendo): sem degrau e sem faixa, vale já.
		if _, err := tx.ExecContext(ctx, `UPDATE companies SET dividend_policy = $2 WHERE id = $1`, companyID, target.String); err != nil {
			return false, err
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE governance_decision_effects SET applied_ticks = $2, status = 'completed' WHERE id = $1`,
			effectID, step.AppliedTicks); err != nil {
			return false, err
		}
		return true, tx.Commit()
	}

	column := metricColumn(corporategovernance.Metric(metric))
	var current int
	if err := tx.QueryRowContext(ctx,
		`SELECT ROUND(`+column+` * 100)::int FROM companies WHERE id = $1 FOR UPDATE`, companyID).Scan(&current); err != nil {
		return false, err
	}
	next := current + step.Delta
	if err := corporategovernance.CheckValueWithLimits(corporategovernance.Metric(metric), next, limits); err != nil {
		if _, err := tx.ExecContext(ctx,
			`UPDATE governance_decision_effects SET status = 'skipped_out_of_range' WHERE id = $1`, effectID); err != nil {
			return false, err
		}
		return false, tx.Commit()
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE companies SET `+column+` = $2::numeric / 100 WHERE id = $1`, companyID, next); err != nil {
		return false, err
	}
	status := corporategovernance.StatusScheduled
	if step.Done {
		status = corporategovernance.StatusCompleted
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE governance_decision_effects
		 SET applied_ticks = $2, applied_delta = applied_delta + $3, status = $4 WHERE id = $1`,
		effectID, step.AppliedTicks, step.Delta, string(status)); err != nil {
		return false, err
	}
	return true, tx.Commit()
}

// payoutGroupMetricsSQL lista, para SQL, as métricas do grupo de destinação do lucro (cooldown
// próprio e efeito aplicado antes de a declaração sair).
const payoutGroupMetricsSQL = `'payout_ratio_pct', 'dividend_policy', 'pn_dividend_premium_pct'`

// ListPending devolve as declarações de dividendo retidas, da mais antiga para a mais nova.
func (r *GovernanceRepository) ListPending(ctx context.Context) ([]corporategovernance.Pending, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT d.id, d.company_id, c.name, c.sector, d.cycle_index, d.report_day, d.held_day,
		        COALESCE((SELECT current_day FROM market_calendar WHERE id = 1), 0) - d.held_day, d.pool_net_income::float8,
		        d.decision_assembly_id, d.release_requested, d.release_reason,
		        EXISTS (SELECT 1 FROM governance_decision_effects e JOIN governance_decisions gd ON gd.id = e.decision_id
		                WHERE gd.assembly_id = d.decision_assembly_id AND e.status = 'scheduled'
		                  AND e.metric IN (`+payoutGroupMetricsSQL+`)),
		        ARRAY(SELECT a.ticker FROM variable_income_assets v JOIN assets a ON a.id = v.asset_id AND NOT a.is_sandbox
		              WHERE v.company_id = d.company_id ORDER BY v.share_class, a.ticker)
		 FROM governance_pending_declarations d JOIN companies c ON c.id = d.company_id
		 WHERE d.status = 'held' ORDER BY d.held_day, d.company_id`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var out []corporategovernance.Pending
	for rows.Next() {
		var p corporategovernance.Pending
		var decision, reason sql.NullString
		if err := rows.Scan(&p.ID, &p.CompanyID, &p.Name, &p.Sector, &p.CycleIndex, &p.ReportDay, &p.HeldDay, &p.DaysHeld, &p.PoolNetIncome,
			&decision, &p.ReleaseRequested, &reason, &p.PayoutEffectPending, pq.Array(&p.Tickers)); err != nil {
			return nil, err
		}
		if decision.Valid {
			p.DecisionAssemblyID = &decision.String
		}
		p.ReleaseReason = corporategovernance.ReleaseReason(reason.String)
		out = append(out, p)
	}
	return out, rows.Err()
}

// RequestRelease marca a declaração retida para sair no próximo tick. Pedir de novo, ou para
// uma já liberada, não muda nada (o primeiro motivo vale).
func (r *GovernanceRepository) RequestRelease(ctx context.Context, id string, reason corporategovernance.ReleaseReason) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE governance_pending_declarations SET release_requested = true, release_reason = $2
		 WHERE id = $1 AND status = 'held' AND NOT release_requested`, id, string(reason))
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n > 0 {
		return nil
	}
	var exists bool
	if err := r.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM governance_pending_declarations WHERE id = $1)`, id).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return corporategovernance.ErrUnknownDeclaration
	}
	return nil
}

var _ corporategovernance.ScheduleReader = (*GovernanceRepository)(nil)

// ListCompanySchedules devolve o dia simulado corrente e a agenda de balanço de cada empresa
// que tem ação negociável no Mercado Ao Vivo (sandbox fora). Serve a GET /governance/reports.
func (r *GovernanceRepository) ListCompanySchedules(ctx context.Context) (int, []corporategovernance.CompanySchedule, error) {
	day, err := loadSimulatedDay(ctx, r.db)
	if err != nil {
		return 0, nil, err
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT c.id, c.name, c.sector, c.report_frequency_days, c.report_offset_days,
		        COALESCE((SELECT schedule_cutover_day FROM market_calendar WHERE id = 1), 0),
		        array_agg(a.ticker ORDER BY v.share_class, a.ticker)
		 FROM companies c
		 JOIN variable_income_assets v ON v.company_id = c.id
		 JOIN assets a ON a.id = v.asset_id AND a.is_sandbox = false
		 GROUP BY c.id, c.name, c.sector, c.report_frequency_days, c.report_offset_days
		 ORDER BY c.name, c.id`)
	if err != nil {
		return 0, nil, err
	}
	defer func() { _ = rows.Close() }()
	var out []corporategovernance.CompanySchedule
	for rows.Next() {
		var s corporategovernance.CompanySchedule
		if err := rows.Scan(&s.CompanyID, &s.Name, &s.Sector, &s.ReportFrequencyDays, &s.ReportOffsetDays, &s.ScheduleCutoverDay, pq.Array(&s.Tickers)); err != nil {
			return 0, nil, err
		}
		out = append(out, s)
	}
	return day, out, rows.Err()
}

// CompanyStanding lê a empresa, se `userID` tem ações dela AGORA (conta de usuário, classes
// somadas) e o início do último efeito que valeu. Serve a GET /governance/companies/{id}/standing.
func (r *GovernanceRepository) CompanyStanding(ctx context.Context, companyID, userID string) (corporategovernance.StandingRecord, bool, error) {
	var rec corporategovernance.StandingRecord
	err := r.db.QueryRowContext(ctx, `SELECT name, sector FROM companies WHERE id = $1`, companyID).Scan(&rec.Name, &rec.Sector)
	if errors.Is(err, sql.ErrNoRows) {
		return corporategovernance.StandingRecord{}, false, nil
	}
	if err != nil {
		return corporategovernance.StandingRecord{}, false, err
	}
	if err := r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(p.quantity), 0) > 0
		 FROM positions p
		 JOIN accounts ac ON ac.user_id = p.user_id AND NOT ac.is_bot
		 JOIN variable_income_assets v ON v.asset_id = p.asset_id AND v.company_id = $1
		 WHERE p.user_id = $2`, companyID, userID).Scan(&rec.HoldsShares); err != nil {
		return corporategovernance.StandingRecord{}, false, err
	}
	if rec.Today, err = loadSimulatedDay(ctx, r.db); err != nil {
		return corporategovernance.StandingRecord{}, false, err
	}
	last, err := lastStartDays(ctx, r.db, companyID)
	if err != nil {
		return corporategovernance.StandingRecord{}, false, err
	}
	if day, ok := last[corporategovernance.GroupFundamentals]; ok {
		rec.LastEffectStartDay = &day
	}
	return rec, true, nil
}
