// Package eventstore implementa domain.EventStore contra o banco "market".
package eventstore

import (
	"context"
	"database/sql"

	"tcc-investimentos/engine/internal/domain"
)

const insertEventSQL = `INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value)
	VALUES ($1, $2, $3, $4, $5)`

// execer é satisfeito tanto por *sql.DB quanto por *sql.Tx — permite gravar
// o evento isolado (Append) ou dentro de uma transação já aberta por outro
// repositório (AppendTx), sem duplicar a query.
type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func appendEvent(ctx context.Context, ex execer, event domain.MarketEvent) error {
	_, err := ex.ExecContext(ctx, insertEventSQL,
		event.UserID, event.AssetID, event.EventType, event.Quantity, event.UnitValue)
	return err
}

// PostgresEventStore implementa domain.EventStore.
type PostgresEventStore struct {
	db *sql.DB
}

func NewPostgresEventStore(db *sql.DB) *PostgresEventStore {
	return &PostgresEventStore{db: db}
}

func (s *PostgresEventStore) Append(ctx context.Context, event domain.MarketEvent) error {
	return appendEvent(ctx, s.db, event)
}

// AppendTx grava o evento dentro de uma transação já aberta por outro
// repositório — necessário quando o evento precisa ser atômico com a
// projeção de estado que o segue (ex: account_repository.go grava o
// evento e a linha de accounts na mesma transação). domain.EventStore.Append
// não expõe *sql.Tx porque domain não pode importar database/sql (ver
// .claude/arquitetura-engine-go.md), então essa variante fica só na infra.
func AppendTx(ctx context.Context, tx *sql.Tx, event domain.MarketEvent) error {
	return appendEvent(ctx, tx, event)
}
