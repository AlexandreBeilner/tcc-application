package db

import (
	"context"
	"database/sql"
	"fmt"

	"tcc-investimentos/engine/internal/domain/adminexport"
)

// AdminExportRepository lê as linhas de ordens e de eventos que o painel exporta (N.21).
// Pede `limit + 1` linhas pra o chamador saber se o teto cortou algo.
type AdminExportRepository struct {
	db *sql.DB
}

func NewAdminExportRepository(db *sql.DB) *AdminExportRepository {
	return &AdminExportRepository{db: db}
}

// ExportOrders devolve as ordens criadas no período, da mais antiga pra mais recente, e se
// havia mais linhas do que `limit`.
func (r *AdminExportRepository) ExportOrders(ctx context.Context, rng adminexport.Range, limit int) ([]adminexport.OrderRow, bool, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT o.id, o.user_id, ac.is_bot, a.ticker, o.side::text, o.type::text,
			o.quantity, o.filled_quantity, o.price::text, o.status::text, COALESCE(o.cancel_reason::text, ''),
			o.simulated_day, o.created_at
		FROM order_book o
		JOIN assets a ON a.id = o.asset_id
		JOIN accounts ac ON ac.user_id = o.user_id
		WHERE ($1::timestamptz IS NULL OR o.created_at >= $1)
		  AND ($2::timestamptz IS NULL OR o.created_at <= $2)
		ORDER BY o.created_at, o.id
		LIMIT $3`, rng.From, rng.To, limit+1)
	if err != nil {
		return nil, false, fmt.Errorf("exportar ordens: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var out []adminexport.OrderRow
	for rows.Next() {
		var o adminexport.OrderRow
		if err := rows.Scan(&o.ID, &o.UserID, &o.IsBot, &o.Ticker, &o.Side, &o.Type, &o.Quantity, &o.FilledQuantity,
			&o.Price, &o.Status, &o.CancelReason, &o.SimulatedDay, &o.CreatedAt); err != nil {
			return nil, false, err
		}
		out = append(out, o)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	truncated := len(out) > limit
	if truncated {
		out = out[:limit]
	}
	return out, truncated, nil
}

// ExportEvents devolve os eventos de mercado do período, do mais antigo pro mais recente.
func (r *AdminExportRepository) ExportEvents(ctx context.Context, rng adminexport.Range, limit int) ([]adminexport.EventRow, bool, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT e.id, e.user_id, ac.is_bot, COALESCE(a.ticker, ''), e.event_type::text,
			e.quantity, e.unit_value::text, e.simulated_day, e."timestamp"
		FROM market_events e
		JOIN accounts ac ON ac.user_id = e.user_id
		LEFT JOIN assets a ON a.id = e.asset_id
		WHERE ($1::timestamptz IS NULL OR e."timestamp" >= $1)
		  AND ($2::timestamptz IS NULL OR e."timestamp" <= $2)
		ORDER BY e."timestamp", e.id
		LIMIT $3`, rng.From, rng.To, limit+1)
	if err != nil {
		return nil, false, fmt.Errorf("exportar eventos: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var out []adminexport.EventRow
	for rows.Next() {
		var (
			e         adminexport.EventRow
			quantity  sql.NullInt64
			unitValue sql.NullString
		)
		if err := rows.Scan(&e.ID, &e.UserID, &e.IsBot, &e.Ticker, &e.EventType, &quantity, &unitValue, &e.SimulatedDay, &e.Timestamp); err != nil {
			return nil, false, err
		}
		if quantity.Valid {
			q := int(quantity.Int64)
			e.Quantity = &q
		}
		if unitValue.Valid {
			u := unitValue.String
			e.UnitValue = &u
		}
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	truncated := len(out) > limit
	if truncated {
		out = out[:limit]
	}
	return out, truncated, nil
}
