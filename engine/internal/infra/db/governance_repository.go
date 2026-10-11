package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

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

const decisionColumns = `id, assembly_id, company_id, option_key, metric, direction, intensity::float8, status,
	total_delta, ramp_ticks, start_day, applied_ticks, applied_delta, decided_at`

func scanDecision(scan func(dest ...any) error) (corporategovernance.Decision, error) {
	var d corporategovernance.Decision
	var metric, status string
	err := scan(&d.ID, &d.AssemblyID, &d.CompanyID, &d.OptionKey, &metric, &d.Direction, &d.Intensity, &status,
		&d.TotalDelta, &d.RampTicks, &d.StartDay, &d.AppliedTicks, &d.AppliedDelta, &d.DecidedAt)
	d.Metric = corporategovernance.Metric(metric)
	d.Status = corporategovernance.Status(status)
	return d, err
}

func (r *GovernanceRepository) GetDecision(ctx context.Context, assemblyID string) (corporategovernance.Decision, bool, error) {
	d, err := scanDecision(r.db.QueryRowContext(ctx,
		`SELECT `+decisionColumns+` FROM governance_decisions WHERE assembly_id = $1`, assemblyID).Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return corporategovernance.Decision{}, false, nil
	}
	return d, err == nil, err
}

// RecordDecision grava o evento imutável e a decisão na mesma transação, nessa ordem: o
// evento vem ANTES de qualquer efeito (que só acontece nos ticks seguintes, em ApplyStep).
func (r *GovernanceRepository) RecordDecision(ctx context.Context, in corporategovernance.DecisionInput, plan corporategovernance.PlanFunc) (corporategovernance.Decision, bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return corporategovernance.Decision{}, false, err
	}
	defer func() { _ = tx.Rollback() }()
	if err := lockAssembly(ctx, tx, in.AssemblyID); err != nil {
		return corporategovernance.Decision{}, false, err
	}

	existing, err := scanDecision(tx.QueryRowContext(ctx,
		`SELECT `+decisionColumns+` FROM governance_decisions WHERE assembly_id = $1`, in.AssemblyID).Scan)
	if err == nil {
		return existing, false, tx.Commit()
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return corporategovernance.Decision{}, false, err
	}

	// Trava a empresa: duas decisões de assembleias diferentes sobre a mesma empresa se
	// serializam, então o cooldown enxerga a anterior.
	var growth, quality int
	err = tx.QueryRowContext(ctx,
		`SELECT ROUND(base_growth_pct * 100)::int, ROUND(quality_multiplier * 100)::int
		 FROM companies WHERE id = $1 FOR UPDATE`, in.CompanyID).Scan(&growth, &quality)
	if errors.Is(err, sql.ErrNoRows) {
		return corporategovernance.Decision{}, false, corporategovernance.ErrUnknownCompany
	}
	if err != nil {
		return corporategovernance.Decision{}, false, err
	}
	state := corporategovernance.CompanyState{BaseGrowthPct: growth, QualityMultiplier: quality}
	if state.Today, err = loadSimulatedDay(ctx, tx); err != nil {
		return corporategovernance.Decision{}, false, err
	}
	var last sql.NullInt64
	if err := tx.QueryRowContext(ctx,
		`SELECT MAX(start_day) FROM governance_decisions WHERE company_id = $1 AND status IN ('scheduled', 'completed')`,
		in.CompanyID).Scan(&last); err != nil {
		return corporategovernance.Decision{}, false, err
	}
	if last.Valid {
		day := int(last.Int64)
		state.LastEffectStartDay = &day
	}

	p, err := plan(state)
	if err != nil {
		return corporategovernance.Decision{}, false, err
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
	total := p.TotalDelta
	if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
		UserID:      domain.GovernanceAccountID,
		AssetID:     &assetID,
		EventType:   domain.EventAssemblyDecision,
		Quantity:    &total,
		ReferenceID: &in.AssemblyID,
	}); err != nil {
		return corporategovernance.Decision{}, false, err
	}

	decision, err := scanDecision(tx.QueryRowContext(ctx,
		`INSERT INTO governance_decisions
		   (assembly_id, company_id, option_key, metric, direction, intensity, status, total_delta, ramp_ticks, start_day)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 RETURNING `+decisionColumns,
		in.AssemblyID, in.CompanyID, in.OptionKey, string(in.Effect.Metric), in.Effect.Direction, in.Effect.Intensity,
		string(p.Status), p.TotalDelta, p.RampTicks, p.StartDay).Scan)
	if err != nil {
		return corporategovernance.Decision{}, false, err
	}
	return decision, true, tx.Commit()
}

func (r *GovernanceRepository) ListScheduled(ctx context.Context) ([]corporategovernance.Decision, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+decisionColumns+` FROM governance_decisions WHERE status = 'scheduled' ORDER BY start_day, assembly_id`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var out []corporategovernance.Decision
	for rows.Next() {
		d, err := scanDecision(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// ApplyStep aplica um passo da rampa na empresa e avança a decisão na mesma transação. Só
// vale se a decisão ainda está em `previousTicks` (outro processo que chegou antes não é
// aplicado duas vezes). Se o passo levaria o valor para fora da faixa válida (ex.: alguém
// editou a empresa no meio da rampa), a decisão é encerrada como `skipped_out_of_range` e
// nada muda.
func (r *GovernanceRepository) ApplyStep(ctx context.Context, decisionID string, previousTicks int, step corporategovernance.StepApplication) (bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback() }()

	var companyID, metric string
	var applied int
	err = tx.QueryRowContext(ctx,
		`SELECT company_id, metric, applied_ticks FROM governance_decisions
		 WHERE id = $1 AND status = 'scheduled' FOR UPDATE`, decisionID).Scan(&companyID, &metric, &applied)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if applied != previousTicks {
		return false, nil
	}

	column := "base_growth_pct"
	if corporategovernance.Metric(metric) == corporategovernance.MetricQualityMultiplier {
		column = "quality_multiplier"
	}
	var current int
	if err := tx.QueryRowContext(ctx,
		`SELECT ROUND(`+column+` * 100)::int FROM companies WHERE id = $1 FOR UPDATE`, companyID).Scan(&current); err != nil {
		return false, err
	}
	next := current + step.Delta
	if err := corporategovernance.CheckValue(corporategovernance.Metric(metric), next); err != nil {
		if _, err := tx.ExecContext(ctx,
			`UPDATE governance_decisions SET status = 'skipped_out_of_range' WHERE id = $1`, decisionID); err != nil {
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
		`UPDATE governance_decisions
		 SET applied_ticks = $2, applied_delta = applied_delta + $3, status = $4 WHERE id = $1`,
		decisionID, step.AppliedTicks, step.Delta, string(status)); err != nil {
		return false, err
	}
	return true, tx.Commit()
}
