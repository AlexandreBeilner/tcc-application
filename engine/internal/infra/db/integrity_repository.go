package db

import (
	"context"
	"database/sql"
	"fmt"

	"tcc-investimentos/engine/internal/domain/integrity"
)

// IntegrityRepository lê a fotografia que a verificação de integridade compara (N.21).
type IntegrityRepository struct {
	db *sql.DB
}

func NewIntegrityRepository(db *sql.DB) *IntegrityRepository {
	return &IntegrityRepository{db: db}
}

// Load lê contas, posições, float, ordens em repouso e TODOS os eventos numa única transação
// de leitura (REPEATABLE READ): um tick rodando no meio não gera divergência falsa entre os
// eventos e a projeção. Os eventos são lidos em fluxo, sem carregar a tabela na memória, e
// vão direto pro `replay`. Dinheiro sai em centavos inteiros (`ROUND(x*100)::bigint`), então
// nenhuma comparação passa por ponto flutuante.
func (r *IntegrityRepository) Load(ctx context.Context, replay *integrity.Replay) (integrity.Snapshot, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return integrity.Snapshot{}, fmt.Errorf("abrir transação de leitura: %w", err)
	}
	// Só leitura: o rollback ao final apenas encerra a fotografia.
	defer func() { _ = tx.Rollback() }()

	var s integrity.Snapshot

	rows, err := tx.QueryContext(ctx, `SELECT user_id, is_bot, ROUND(current_balance * 100)::bigint FROM accounts`)
	if err != nil {
		return s, fmt.Errorf("ler contas: %w", err)
	}
	for rows.Next() {
		var a integrity.Account
		if err := rows.Scan(&a.UserID, &a.IsBot, &a.BalanceCents); err != nil {
			_ = rows.Close()
			return s, err
		}
		s.Accounts = append(s.Accounts, a)
	}
	if err := closeRows(rows); err != nil {
		return s, fmt.Errorf("ler contas: %w", err)
	}

	rows, err = tx.QueryContext(ctx, `SELECT p.user_id, p.asset_id, a.ticker, p.quantity FROM positions p JOIN assets a ON a.id = p.asset_id`)
	if err != nil {
		return s, fmt.Errorf("ler posições: %w", err)
	}
	for rows.Next() {
		var p integrity.Position
		if err := rows.Scan(&p.UserID, &p.AssetID, &p.Ticker, &p.Quantity); err != nil {
			_ = rows.Close()
			return s, err
		}
		s.Positions = append(s.Positions, p)
	}
	if err := closeRows(rows); err != nil {
		return s, fmt.Errorf("ler posições: %w", err)
	}

	// Ativo sem float definido (sandbox) não entra: não há o que conferir.
	rows, err = tx.QueryContext(ctx, `SELECT a.id, a.ticker, v.outstanding_shares
		FROM variable_income_assets v JOIN assets a ON a.id = v.asset_id
		WHERE v.outstanding_shares IS NOT NULL`)
	if err != nil {
		return s, fmt.Errorf("ler float: %w", err)
	}
	for rows.Next() {
		var f integrity.Float
		if err := rows.Scan(&f.AssetID, &f.Ticker, &f.Outstanding); err != nil {
			_ = rows.Close()
			return s, err
		}
		s.Floats = append(s.Floats, f)
	}
	if err := closeRows(rows); err != nil {
		return s, fmt.Errorf("ler float: %w", err)
	}

	rows, err = tx.QueryContext(ctx, `SELECT o.id, o.user_id, o.asset_id, a.ticker, o.side::text,
			o.quantity - o.filled_quantity, ROUND(o.price * 100)::bigint, o.type = 'market'
		FROM order_book o JOIN assets a ON a.id = o.asset_id
		WHERE o.status IN ('pending', 'partially_filled')`)
	if err != nil {
		return s, fmt.Errorf("ler ordens em repouso: %w", err)
	}
	for rows.Next() {
		var o integrity.RestingOrder
		if err := rows.Scan(&o.ID, &o.UserID, &o.AssetID, &o.Ticker, &o.Side, &o.RemainingQty, &o.PriceCents, &o.IsMarketOrder); err != nil {
			_ = rows.Close()
			return s, err
		}
		s.RestingOrders = append(s.RestingOrders, o)
	}
	if err := closeRows(rows); err != nil {
		return s, fmt.Errorf("ler ordens em repouso: %w", err)
	}

	rows, err = tx.QueryContext(ctx, `SELECT user_id, asset_id, event_type::text, quantity, ROUND(unit_value * 100)::bigint FROM market_events`)
	if err != nil {
		return s, fmt.Errorf("ler eventos: %w", err)
	}
	for rows.Next() {
		var (
			e         integrity.Event
			assetID   sql.NullString
			quantity  sql.NullInt64
			unitCents sql.NullInt64
		)
		if err := rows.Scan(&e.UserID, &assetID, &e.EventType, &quantity, &unitCents); err != nil {
			_ = rows.Close()
			return s, err
		}
		e.AssetID = assetID.String
		if quantity.Valid {
			q := int(quantity.Int64)
			e.Quantity = &q
		}
		if unitCents.Valid {
			u := unitCents.Int64
			e.UnitCents = &u
		}
		replay.Apply(e)
	}
	if err := closeRows(rows); err != nil {
		return s, fmt.Errorf("ler eventos: %w", err)
	}

	return s, nil
}

func closeRows(rows *sql.Rows) error {
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return err
	}
	return rows.Close()
}
