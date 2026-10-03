package db

import (
	"context"
	"database/sql"
	"errors"

	"tcc-investimentos/engine/internal/domain/adminview"
)

// AdminReadRepository serve as leituras do painel administrativo (tarefas N.5 e
// N.8; o monitor de mercado está em admin_market_repository.go). É só leitura:
// nunca grava saldo, posição ou evento.
type AdminReadRepository struct {
	db *sql.DB
}

func NewAdminReadRepository(db *sql.DB) *AdminReadRepository {
	return &AdminReadRepository{db: db}
}

// Overview agrega o estado do mercado em poucas consultas (nenhuma por ativo).
// Selic e IPCA vêm da última linha de market_indicator_history; sem histórico
// ainda (motor recém-subido), a Selic cai pra market_calendar e o IPCA fica nil.
func (r *AdminReadRepository) Overview(ctx context.Context) (adminview.Overview, error) {
	var o adminview.Overview
	err := r.db.QueryRowContext(ctx,
		`SELECT c.current_day, c.selic_rate FROM market_calendar c WHERE c.id = 1`,
	).Scan(&o.SimulatedDay, &o.SelicRate)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return o, err
	}

	var selic, monthly, acc sql.NullFloat64
	err = r.db.QueryRowContext(ctx,
		`SELECT selic_rate, ipca_monthly, ipca_accumulated_12m FROM market_indicator_history ORDER BY simulated_day DESC LIMIT 1`,
	).Scan(&selic, &monthly, &acc)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return o, err
	}
	if selic.Valid {
		o.SelicRate = selic.Float64
	}
	if monthly.Valid {
		o.IPCAMonthly = &monthly.Float64
	}
	if acc.Valid {
		o.IPCAAccumulated12m = &acc.Float64
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM macro_events WHERE status = 'pendente'`,
	).Scan(&o.PendingMacroEvents); err != nil {
		return o, err
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT
		   COUNT(*) FILTER (WHERE is_active),
		   COUNT(*)
		 FROM accounts WHERE is_bot`,
	).Scan(&o.ActiveBots, &o.TotalBots); err != nil {
		return o, err
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT
		   COUNT(*),
		   COUNT(*) FILTER (WHERE NOT EXISTS (
		     SELECT 1 FROM market_maker_coverage c
		     JOIN accounts m ON m.user_id = c.mm_account_id
		     WHERE c.asset_id = a.id AND m.is_active
		   ))
		 FROM assets a
		 WHERE a.is_sandbox = false AND a.type IN ('acao', 'etf', 'fii')`,
	).Scan(&o.TradableAssets, &o.UncoveredAssets); err != nil {
		return o, err
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*), COALESCE(SUM(quantity * unit_value), 0)
		 FROM market_events
		 WHERE event_type = 'buy_order_executed' AND simulated_day = $1`,
		o.SimulatedDay,
	).Scan(&o.Trades, &o.Volume); err != nil {
		return o, err
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM order_book WHERE type = 'limit' AND status IN ('pending', 'partially_filled')`,
	).Scan(&o.RestingOrders); err != nil {
		return o, err
	}
	return o, nil
}
