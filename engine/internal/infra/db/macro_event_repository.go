package db

import (
	"context"
	"database/sql"

	"tcc-investimentos/engine/internal/domain/macroevent"
)

// MacroEventRepository implementa macroeventtrigger.Repository contra o
// banco "market" — macro_events/macro_event_targets (schema ajustado pela
// tarefa 4.1) e a leitura do dia simulado corrente em market_calendar
// (tarefa 3.11).
type MacroEventRepository struct {
	db *sql.DB
}

func NewMacroEventRepository(db *sql.DB) *MacroEventRepository {
	return &MacroEventRepository{db: db}
}

// LoadCurrentDay lê market_calendar.current_day — ErrMarketCalendarNotInitialized
// (mesmo erro sentinela de fixed_income_execution_repository.go, mesma
// condição: o Temporizador nunca rodou) se a tabela ainda está vazia.
func (r *MacroEventRepository) LoadCurrentDay(ctx context.Context) (int, error) {
	var day int
	err := r.db.QueryRowContext(ctx, `SELECT current_day FROM market_calendar WHERE id = 1`).Scan(&day)
	if err == sql.ErrNoRows {
		return 0, ErrMarketCalendarNotInitialized
	}
	if err != nil {
		return 0, err
	}
	return day, nil
}

// Persist grava o evento e seus alvos numa única transação: macro_events
// primeiro (RETURNING id), depois um INSERT por Target em
// macro_event_targets — status inicial sempre 'pendente' (macroevent.
// NewEvent já garante isso em memória).
func (r *MacroEventRepository) Persist(ctx context.Context, event macroevent.Event) (string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback() }()

	var id string
	err = tx.QueryRowContext(ctx,
		`INSERT INTO macro_events (
			template_key, title, narrative, direction, magnitude_band,
			affects_price, affects_fundamentals, status, created_by,
			triggered_on_day, duration_days, price_effect_pct,
			fundamentals_effect_pct, fundamentals_report_day
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id`,
		event.TemplateKey, event.Title, event.Narrative, string(event.Direction), string(event.MagnitudeBand),
		event.AffectsPrice, event.AffectsFundamentals, string(event.Status), event.CreatedBy,
		event.TriggeredOnDay, event.DurationDays, event.PriceEffectPct,
		event.FundamentalsEffectPct, event.FundamentalsReportDay,
	).Scan(&id)
	if err != nil {
		return "", err
	}

	for _, target := range event.Targets {
		var sector *string
		if target.Sector != nil {
			s := string(*target.Sector)
			sector = &s
		}

		if _, err := tx.ExecContext(ctx,
			`INSERT INTO macro_event_targets (macro_event_id, sector, risk_class, asset_id, affected_metric)
			 VALUES ($1, $2, $3, $4, $5)`,
			id, sector, target.RiskClass, target.AssetID, string(target.AffectedMetric),
		); err != nil {
			return "", err
		}
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}
	return id, nil
}

// List devolve o histórico de eventos macro (mais recentes primeiro, por
// created_at), paginado — usado por GET /macro-events (tarefa 4.5,
// consumido por GET /admin/macro-events no backend). status já reflete a
// aplicação contínua do efeito (tick.Service.Run/SaveTick atualizam a
// coluna a cada tick), não um valor congelado da criação — não é preciso
// recalcular nada aqui, só ler a linha.
func (r *MacroEventRepository) List(ctx context.Context, limit, offset int) ([]macroevent.Record, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, template_key, title, narrative, direction, magnitude_band,
		        affects_price, affects_fundamentals, status, created_by,
		        triggered_on_day, duration_days, price_effect_pct,
		        fundamentals_effect_pct, fundamentals_report_day
		 FROM macro_events
		 ORDER BY created_at DESC, id
		 LIMIT $1 OFFSET $2`,
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var records []macroevent.Record
	for rows.Next() {
		var rec macroevent.Record
		var direction, band, status string
		if err := rows.Scan(
			&rec.ID, &rec.TemplateKey, &rec.Title, &rec.Narrative, &direction, &band,
			&rec.AffectsPrice, &rec.AffectsFundamentals, &status, &rec.CreatedBy,
			&rec.TriggeredOnDay, &rec.DurationDays, &rec.PriceEffectPct,
			&rec.FundamentalsEffectPct, &rec.FundamentalsReportDay,
		); err != nil {
			return nil, err
		}
		rec.Direction = macroevent.Direction(direction)
		rec.MagnitudeBand = macroevent.Band(band)
		rec.Status = macroevent.Status(status)
		records = append(records, rec)
	}
	return records, rows.Err()
}
