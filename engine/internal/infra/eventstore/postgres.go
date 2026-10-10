// Package eventstore implementa domain.EventStore contra o banco "market".
package eventstore

import (
	"context"
	"database/sql"
	"errors"
	"strconv"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain"
)

// simulated_day vem de market_calendar no próprio INSERT (tarefa S.10): o dia
// simulado em que o evento aconteceu, lido do calendário que o Temporizador
// avança (0 antes do primeiro tick).
const insertEventSQL = `INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value, reference_month, simulated_day)
	VALUES ($1, $2, $3, $4, $5, $6, COALESCE((SELECT current_day FROM market_calendar WHERE id = 1), 0))`

// execer é satisfeito tanto por *sql.DB quanto por *sql.Tx — permite gravar
// o evento isolado (Append) ou dentro de uma transação já aberta por outro
// repositório (AppendTx), sem duplicar a query.
type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func appendEvent(ctx context.Context, ex execer, event domain.MarketEvent) error {
	_, err := ex.ExecContext(ctx, insertEventSQL,
		event.UserID, event.AssetID, event.EventType, event.Quantity, event.UnitValue, event.ReferenceMonth)
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

// ErrInvalidBatch é devolvido por AppendBatchTx quando os eventos não podem ir
// num único INSERT em lote.
var ErrInvalidBatch = errors.New("eventos do lote precisam ter o mesmo tipo e todos os campos preenchidos")

const insertEventsBatchSQL = `INSERT INTO market_events (user_id, asset_id, event_type, quantity, unit_value, simulated_day)
	SELECT t.u::uuid, t.a::uuid, $1::market_event_type, t.q, t.uv::numeric,
	       COALESCE((SELECT current_day FROM market_calendar WHERE id = 1), 0)
	FROM unnest($2::text[], $3::text[], $4::int[], $5::text[]) AS t(u, a, q, uv)`

// AppendBatchTx grava vários eventos do mesmo tipo com um único comando SQL
// (tarefa Q.6: pagar dividendo a cada detentor de cada ativo custava 1 comando
// por par, o que cresce com bots x ativos). O efeito é o mesmo de AppendTx em
// laço: uma linha imutável por evento, na ordem recebida, dentro da mesma
// transação da projeção que vem depois (Event Sourcing, CLAUDE.md). Todos os
// eventos precisam ter o mesmo EventType e AssetID, Quantity e UnitValue
// preenchidos; senão devolve ErrInvalidBatch sem gravar nada. Lote vazio é
// no-op.
func AppendBatchTx(ctx context.Context, tx *sql.Tx, events []domain.MarketEvent) error {
	if len(events) == 0 {
		return nil
	}
	users := make([]string, len(events))
	assets := make([]string, len(events))
	quantities := make([]int64, len(events))
	unitValues := make([]string, len(events))
	for i, e := range events {
		if e.EventType != events[0].EventType || e.AssetID == nil || e.Quantity == nil || e.UnitValue == nil {
			return ErrInvalidBatch
		}
		users[i], assets[i], quantities[i] = e.UserID, *e.AssetID, int64(*e.Quantity)
		// Mesma representação que o driver usa para um float64 avulso, então o
		// numeric gravado é idêntico ao de AppendTx.
		unitValues[i] = strconv.FormatFloat(*e.UnitValue, 'f', -1, 64)
	}
	_, err := tx.ExecContext(ctx, insertEventsBatchSQL,
		string(events[0].EventType), pq.Array(users), pq.Array(assets), pq.Array(quantities), pq.Array(unitValues))
	return err
}
