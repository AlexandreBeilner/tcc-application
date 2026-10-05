package db

import (
	"context"
	"database/sql"
	"time"
)

// SchedulerControlRepository persiste a pausa do agendador (tarefa N.6) na linha
// singleton de scheduler_control — o estado sobrevive a um restart do motor.
type SchedulerControlRepository struct {
	db *sql.DB
}

func NewSchedulerControlRepository(db *sql.DB) *SchedulerControlRepository {
	return &SchedulerControlRepository{db: db}
}

// State lê se o agendador está pausado e quando a última pausa acabou (zero se
// nunca houve). Implementa scheduler.Control.
func (r *SchedulerControlRepository) State(ctx context.Context) (bool, time.Time, error) {
	var paused bool
	var resumedAt sql.NullTime
	if err := r.db.QueryRowContext(ctx,
		`SELECT paused, resumed_at FROM scheduler_control WHERE id = 1`,
	).Scan(&paused, &resumedAt); err != nil {
		return false, time.Time{}, err
	}
	return paused, resumedAt.Time, nil
}

// Pause marca o agendador como pausado. Idempotente: pausar de novo não muda nada.
func (r *SchedulerControlRepository) Pause(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE scheduler_control SET paused = true, updated_at = now() WHERE id = 1 AND paused = false`)
	return err
}

// Resume tira a pausa e grava resumed_at = agora, que o agendador usa como
// referência pra contar slots perdidos (o tempo pausado não vira recuperação).
// Idempotente: retomar quem não está pausado não mexe em resumed_at.
func (r *SchedulerControlRepository) Resume(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE scheduler_control SET paused = false, resumed_at = now(), updated_at = now() WHERE id = 1 AND paused = true`)
	return err
}
