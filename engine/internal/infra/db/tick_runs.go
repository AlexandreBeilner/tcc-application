package db

import (
	"context"
	"database/sql"
	"time"

	"tcc-investimentos/engine/internal/domain/tick"
)

// RecordRun grava uma linha do histórico de ticks (tarefa N.6, tick.RunRecorder).
// Day = 0 (tick que falhou antes de saber o dia) vira NULL. Não passa por Event
// Sourcing: é observabilidade operacional, não escrita de saldo/posição.
func (r *TickRepository) RecordRun(ctx context.Context, rec tick.RunRecord) error {
	var day sql.NullInt32
	if rec.Day > 0 {
		day = sql.NullInt32{Int32: int32(rec.Day), Valid: true}
	}
	var errMsg sql.NullString
	if rec.ErrorMessage != "" {
		errMsg = sql.NullString{String: rec.ErrorMessage, Valid: true}
	}
	// Selic só tem sentido num tick que concluiu.
	var selic sql.NullFloat64
	if rec.Status == tick.RunSuccess {
		selic = sql.NullFloat64{Float64: rec.Counters.SelicRate, Valid: true}
	}
	c := rec.Counters

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO tick_runs (
		   simulated_day, trigger, status, error_message, started_at, duration_ms, catch_up_discarded,
		   selic_rate, is_copom_day, is_report_day, quotes_count, fundamentals_count,
		   dividends_generated_count, dividends_paid_count, bot_fills_count, expired_orders_count,
		   uncovered_assets_count, intraday_rounds_count
		 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
		day, string(rec.Trigger), string(rec.Status), errMsg, rec.StartedAt, rec.Duration.Milliseconds(), rec.CatchUpDiscarded,
		selic, c.IsCopomDay, c.IsReportDay, c.QuotesCount, c.FundamentalsCount,
		c.DividendsGeneratedCount, c.DividendsPaidCount, c.BotFillsCount, c.ExpiredOrdersCount,
		c.UncoveredAssetsCount, c.IntradayRoundsCount,
	)
	return err
}

// ListRuns devolve o histórico paginado, mais recente primeiro, com o total sem
// paginação (GET /admin/ticks).
func (r *TickRepository) ListRuns(ctx context.Context, limit, offset int) ([]tick.RunRecord, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM tick_runs`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT simulated_day, trigger, status, error_message, started_at, duration_ms, catch_up_discarded,
		        selic_rate, is_copom_day, is_report_day, quotes_count, fundamentals_count,
		        dividends_generated_count, dividends_paid_count, bot_fills_count, expired_orders_count,
		        uncovered_assets_count, intraday_rounds_count
		 FROM tick_runs
		 ORDER BY started_at DESC, id DESC
		 LIMIT $1 OFFSET $2`,
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = rows.Close() }()

	records := []tick.RunRecord{}
	for rows.Next() {
		var (
			rec       tick.RunRecord
			day       sql.NullInt32
			trigger   string
			status    string
			errMsg    sql.NullString
			durMillis int64
			selic     sql.NullFloat64
			started   time.Time
		)
		c := &rec.Counters
		if err := rows.Scan(&day, &trigger, &status, &errMsg, &started, &durMillis, &rec.CatchUpDiscarded,
			&selic, &c.IsCopomDay, &c.IsReportDay, &c.QuotesCount, &c.FundamentalsCount,
			&c.DividendsGeneratedCount, &c.DividendsPaidCount, &c.BotFillsCount, &c.ExpiredOrdersCount,
			&c.UncoveredAssetsCount, &c.IntradayRoundsCount); err != nil {
			return nil, 0, err
		}
		rec.Day = int(day.Int32)
		rec.Trigger = tick.Trigger(trigger)
		rec.Status = tick.RunStatus(status)
		rec.ErrorMessage = errMsg.String
		rec.StartedAt = started
		rec.Duration = time.Duration(durMillis) * time.Millisecond
		c.SelicRate = selic.Float64
		records = append(records, rec)
	}
	return records, total, rows.Err()
}
