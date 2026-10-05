package db

import (
	"context"
	"database/sql"

	"tcc-investimentos/engine/internal/domain/adminview"
)

// AdminOrders lista as ordens do book pra tela "Ordens" (tarefa N.10), mais
// recentes primeiro, com o total que casa com o filtro pra paginar. Uma consulta
// de página e uma de contagem, nenhuma por ordem. Os filtros são todos opcionais
// e viram `$n = ” OR coluna = $n` pra manter um único texto de SQL.
func (r *AdminReadRepository) AdminOrders(ctx context.Context, f adminview.OrderFilter) ([]adminview.OrderRow, int, error) {
	f = f.NormalizePage()
	const where = `
	  WHERE ($1 = '' OR o.user_id::text = $1)
	    AND ($2 = '' OR o.asset_id::text = $2)
	    AND ($3 = '' OR o.side::text = $3)
	    AND ($4 = '' OR ($4 = 'open' AND o.status IN ('pending', 'partially_filled')) OR o.status::text = $4)
	    AND ($5::timestamptz IS NULL OR o.created_at >= $5)
	    AND ($6::timestamptz IS NULL OR o.created_at <= $6)`
	args := []any{f.UserID, f.AssetID, f.Side, f.Status, f.From, f.To}

	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM order_book o`+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT o.id, o.asset_id, a.ticker, o.user_id, acc.is_bot, bp.archetype::text,
		        o.side::text, o.type::text, o.quantity, o.filled_quantity, o.price,
		        o.status::text, o.cancel_reason::text, o.simulated_day, o.created_at
		 FROM order_book o
		 JOIN assets a ON a.id = o.asset_id
		 JOIN accounts acc ON acc.user_id = o.user_id
		 LEFT JOIN bot_personalities bp ON bp.account_id = o.user_id`+where+`
		 ORDER BY o.created_at DESC, o.id
		 LIMIT $7 OFFSET $8`,
		append(args, f.Limit, f.Offset)...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = rows.Close() }()

	out := make([]adminview.OrderRow, 0)
	for rows.Next() {
		var row adminview.OrderRow
		var archetype, cancelReason sql.NullString
		if err := rows.Scan(
			&row.OrderID, &row.AssetID, &row.Ticker, &row.UserID, &row.IsBot, &archetype,
			&row.Side, &row.Type, &row.Quantity, &row.FilledQuantity, &row.Price,
			&row.Status, &cancelReason, &row.SimulatedDay, &row.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		if archetype.Valid {
			row.Archetype = &archetype.String
		}
		if cancelReason.Valid {
			row.CancelReason = &cancelReason.String
		}
		out = append(out, row)
	}
	return out, total, rows.Err()
}
