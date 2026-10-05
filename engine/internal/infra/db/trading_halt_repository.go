package db

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain/tradinghalt"
)

// TradingHaltRepository grava e lê as pausas de negociação (tarefa N.9). A leitura
// que barra a ordem (LoadContext) está em order_execution_repository.go, junto da
// consulta de saldo, pra não custar uma ida extra ao banco por ordem.
type TradingHaltRepository struct {
	db *sql.DB
}

func NewTradingHaltRepository(db *sql.DB) *TradingHaltRepository {
	return &TradingHaltRepository{db: db}
}

const haltColumns = `h.id, h.scope, h.asset_id, a.ticker, h.reason, h.created_by, h.created_at, h.lifted_at, h.lifted_by`

const haltSelect = `SELECT ` + haltColumns + `
	FROM trading_halts h LEFT JOIN assets a ON a.id = h.asset_id`

func scanHalt(scan func(dest ...any) error) (tradinghalt.Halt, error) {
	var (
		h        tradinghalt.Halt
		scope    string
		assetID  sql.NullString
		ticker   sql.NullString
		liftedAt sql.NullTime
		liftedBy sql.NullString
	)
	if err := scan(&h.ID, &scope, &assetID, &ticker, &h.Reason, &h.CreatedBy, &h.CreatedAt, &liftedAt, &liftedBy); err != nil {
		return h, err
	}
	h.Scope = tradinghalt.Scope(scope)
	if assetID.Valid {
		h.AssetID = &assetID.String
	}
	if ticker.Valid {
		h.Ticker = &ticker.String
	}
	if liftedAt.Valid {
		h.LiftedAt = &liftedAt.Time
	}
	if liftedBy.Valid {
		h.LiftedBy = &liftedBy.String
	}
	return h, nil
}

// Insert grava a pausa nova. Ativo de pausa precisa existir e ser negociável no book
// (ação, ETF ou FII que não seja sandbox). A unicidade da pausa vigente por escopo é
// do índice parcial, então duas chamadas concorrentes não criam duas.
func (r *TradingHaltRepository) Insert(ctx context.Context, halt tradinghalt.Halt) (tradinghalt.Halt, error) {
	if halt.AssetID != nil {
		var tradable bool
		err := r.db.QueryRowContext(ctx,
			`SELECT type IN ('acao', 'etf', 'fii') AND NOT is_sandbox FROM assets WHERE id = $1`, *halt.AssetID,
		).Scan(&tradable)
		if errors.Is(err, sql.ErrNoRows) {
			return tradinghalt.Halt{}, tradinghalt.ErrAssetNotFound
		}
		if err != nil {
			return tradinghalt.Halt{}, err
		}
		if !tradable {
			return tradinghalt.Halt{}, tradinghalt.ErrAssetNotTradable
		}
	}

	var id string
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO trading_halts (scope, asset_id, reason, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
		string(halt.Scope), halt.AssetID, halt.Reason, halt.CreatedBy,
	).Scan(&id)
	var pqErr *pq.Error
	if errors.As(err, &pqErr) && pqErr.Code == pqUniqueViolation {
		return tradinghalt.Halt{}, tradinghalt.ErrAlreadyHalted
	}
	if err != nil {
		return tradinghalt.Halt{}, err
	}
	return r.get(ctx, id)
}

func (r *TradingHaltRepository) get(ctx context.Context, id string) (tradinghalt.Halt, error) {
	h, err := scanHalt(r.db.QueryRowContext(ctx, haltSelect+` WHERE h.id = $1`, id).Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return tradinghalt.Halt{}, tradinghalt.ErrHaltNotFound
	}
	return h, err
}

// Lift encerra a pausa id. O UPDATE condicionado a lifted_at IS NULL é atômico: duas
// retomadas concorrentes não encerram duas vezes, a segunda cai em ErrAlreadyLifted.
func (r *TradingHaltRepository) Lift(ctx context.Context, id, liftedBy string) (tradinghalt.Halt, error) {
	result, err := r.db.ExecContext(ctx,
		`UPDATE trading_halts SET lifted_at = now(), lifted_by = $2 WHERE id = $1 AND lifted_at IS NULL`, id, liftedBy,
	)
	if err != nil {
		return tradinghalt.Halt{}, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return tradinghalt.Halt{}, err
	}
	halt, err := r.get(ctx, id)
	if err != nil {
		return tradinghalt.Halt{}, err
	}
	if affected == 0 {
		return halt, tradinghalt.ErrAlreadyLifted
	}
	return halt, nil
}

// Active devolve as pausas vigentes, a global primeiro.
func (r *TradingHaltRepository) Active(ctx context.Context) ([]tradinghalt.Halt, error) {
	return r.query(ctx, haltSelect+` WHERE h.lifted_at IS NULL ORDER BY (h.scope = 'global') DESC, h.created_at`)
}

// Recent devolve as últimas pausas encerradas, mais recentes primeiro.
func (r *TradingHaltRepository) Recent(ctx context.Context, limit int) ([]tradinghalt.Halt, error) {
	return r.query(ctx, haltSelect+` WHERE h.lifted_at IS NOT NULL ORDER BY h.lifted_at DESC LIMIT $1`, limit)
}

func (r *TradingHaltRepository) query(ctx context.Context, query string, args ...any) ([]tradinghalt.Halt, error) {
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	halts := make([]tradinghalt.Halt, 0)
	for rows.Next() {
		h, err := scanHalt(rows.Scan)
		if err != nil {
			return nil, err
		}
		halts = append(halts, h)
	}
	return halts, rows.Err()
}
