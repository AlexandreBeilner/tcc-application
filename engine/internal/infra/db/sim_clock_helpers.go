package db

import (
	"context"
	"database/sql"
	"errors"
)

// rowQuerier é o que loadSimulatedDay precisa de *sql.DB e *sql.Tx.
type rowQuerier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// loadSimulatedDay lê market_calendar.current_day, a única fonte de tempo das
// regras de negócio (tarefa S.1, simcalendar) — 0 quando o Temporizador nunca
// rodou (motor recém-subido), mesmo fallback de tick.Service.Run.
func loadSimulatedDay(ctx context.Context, q rowQuerier) (int, error) {
	var day int
	err := q.QueryRowContext(ctx, `SELECT current_day FROM market_calendar WHERE id = 1`).Scan(&day)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return day, err
}
