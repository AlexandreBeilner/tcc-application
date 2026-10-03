package db

import (
	"context"
	"database/sql"
	"errors"
	"sort"

	"tcc-investimentos/engine/internal/domain/adminview"
)

// Leituras de desempenho de bots do painel (tarefa N.14). Mesma fonte de verdade
// do resto do painel: order_book, market_events, positions e asset_quotes, sem
// tabela de métricas paralela. Só leitura.

// currentDay lê o dia simulado corrente (0 se o calendário ainda não existe).
func (r *AdminReadRepository) currentDay(ctx context.Context) (int, error) {
	var day int
	err := r.db.QueryRowContext(ctx, `SELECT current_day FROM market_calendar WHERE id = 1`).Scan(&day)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return 0, err
	}
	return day, nil
}

// BotActivity devolve o desempenho de um bot nos últimos `days` dias simulados
// (incluindo o corrente). Patrimônio, capital e P&L são acumulados desde a criação
// (o patrimônio de dias passados exigiria reconstruir posições dia a dia); ordens,
// volume e negócios respeitam a janela.
func (r *AdminReadRepository) BotActivity(ctx context.Context, accountID string, days int) (adminview.BotActivity, error) {
	days = adminview.NormalizeDays(days, adminview.DefaultActivityDays, adminview.MaxActivityDays)
	today, err := r.currentDay(ctx)
	if err != nil {
		return adminview.BotActivity{}, err
	}
	a := adminview.BotActivity{AccountID: accountID, ToDay: today, FromDay: max(0, today-days+1), PeriodDays: days}

	err = r.db.QueryRowContext(ctx,
		`SELECT bp.archetype::text, acc.is_active, acc.current_balance
		 FROM accounts acc JOIN bot_personalities bp ON bp.account_id = acc.user_id
		 WHERE acc.user_id = $1 AND acc.is_bot`, accountID,
	).Scan(&a.Archetype, &a.IsActive, &a.Cash)
	if errors.Is(err, sql.ErrNoRows) {
		return a, adminview.ErrBotNotFound
	}
	if err != nil {
		return a, err
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(p.quantity * COALESCE(q.price, p.average_price)), 0)
		 FROM positions p
		 LEFT JOIN LATERAL (
		   SELECT price FROM asset_quotes WHERE asset_id = p.asset_id ORDER BY simulated_day DESC LIMIT 1
		 ) q ON true
		 WHERE p.user_id = $1 AND p.quantity > 0`, accountID,
	).Scan(&a.HoldingsValue); err != nil {
		return a, err
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(CASE event_type
		          WHEN 'bot_initial_cash' THEN unit_value
		          WHEN 'bot_initial_allocation' THEN quantity * unit_value END), 0)
		 FROM market_events
		 WHERE user_id = $1 AND event_type IN ('bot_initial_cash', 'bot_initial_allocation')`, accountID,
	).Scan(&a.CapitalContributed); err != nil {
		return a, err
	}

	if err := r.loadBotOrders(ctx, &a); err != nil {
		return a, err
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*), COALESCE(SUM(quantity * unit_value), 0)
		 FROM market_events
		 WHERE user_id = $1 AND event_type IN ('buy_order_executed', 'sell_order_executed')
		   AND simulated_day BETWEEN $2 AND $3`, accountID, a.FromDay, a.ToDay,
	).Scan(&a.Trades, &a.Volume); err != nil {
		return a, err
	}

	if a.Archetype == "market_maker" {
		if a.Quotes, err = r.marketMakerQuotes(ctx, accountID); err != nil {
			return a, err
		}
	}
	return a, nil
}

func (r *AdminReadRepository) loadBotOrders(ctx context.Context, a *adminview.BotActivity) error {
	rows, err := r.db.QueryContext(ctx,
		`SELECT status::text, cancel_reason::text, COUNT(*), SUM(quantity), SUM(filled_quantity)
		 FROM order_book
		 WHERE user_id = $1 AND simulated_day BETWEEN $2 AND $3
		 GROUP BY status, cancel_reason`, a.AccountID, a.FromDay, a.ToDay,
	)
	if err != nil {
		return err
	}
	defer func() { _ = rows.Close() }()

	a.Orders.CancelledByReason = map[string]int{}
	for rows.Next() {
		var status string
		var reason sql.NullString
		var count int
		var quantity, filled int64
		if err := rows.Scan(&status, &reason, &count, &quantity, &filled); err != nil {
			return err
		}
		a.Orders.Sent += count
		a.Orders.Quantity += quantity
		a.Orders.FilledQuantity += filled
		switch status {
		case "filled":
			a.Orders.Filled += count
		case "partially_filled":
			a.Orders.PartiallyFilled += count
			a.Orders.Open += count
		case "pending":
			a.Orders.Open += count
		case "cancelled":
			a.Orders.Cancelled += count
			if reason.Valid {
				a.Orders.CancelledByReason[reason.String] += count
			}
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// A última atividade é a última ordem de sempre, não a última da janela.
	var at sql.NullTime
	var day sql.NullInt64
	if err := r.db.QueryRowContext(ctx,
		`SELECT MAX(created_at), MAX(simulated_day) FROM order_book WHERE user_id = $1`, a.AccountID,
	).Scan(&at, &day); err != nil {
		return err
	}
	if at.Valid {
		a.LastOrderAt = &at.Time
	}
	if day.Valid {
		d := int(day.Int64)
		a.LastOrderDay = &d
	}
	return nil
}

// marketMakerQuotes devolve, por ativo coberto, a melhor compra e venda do próprio
// Market Maker no book e o inventário contra o alvo provisionado.
func (r *AdminReadRepository) marketMakerQuotes(ctx context.Context, accountID string) ([]adminview.MarketMakerQuote, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id, a.ticker, o.bid, o.ask, COALESCE(pos.quantity, 0), COALESCE(tgt.quantity, 0)
		 FROM market_maker_coverage c
		 JOIN assets a ON a.id = c.asset_id
		 LEFT JOIN LATERAL (
		   SELECT MAX(price) FILTER (WHERE side = 'buy') AS bid, MIN(price) FILTER (WHERE side = 'sell') AS ask
		   FROM order_book
		   WHERE user_id = c.mm_account_id AND asset_id = a.id AND type = 'limit' AND status IN ('pending', 'partially_filled')
		 ) o ON true
		 LEFT JOIN positions pos ON pos.user_id = c.mm_account_id AND pos.asset_id = a.id
		 LEFT JOIN LATERAL (
		   SELECT SUM(quantity) AS quantity FROM market_events
		   WHERE user_id = c.mm_account_id AND asset_id = a.id AND event_type = 'bot_initial_allocation'
		 ) tgt ON true
		 WHERE c.mm_account_id = $1
		 ORDER BY a.ticker`, accountID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	quotes := make([]adminview.MarketMakerQuote, 0)
	for rows.Next() {
		var q adminview.MarketMakerQuote
		var bid, ask sql.NullFloat64
		if err := rows.Scan(&q.AssetID, &q.Ticker, &bid, &ask, &q.HeldQuantity, &q.TargetQuantity); err != nil {
			return nil, err
		}
		q.BestBid, q.BestAsk = nullFloat(bid), nullFloat(ask)
		quotes = append(quotes, q)
	}
	return quotes, rows.Err()
}

// BotsSummary é a visão agregada: bots parados, caixa esgotado, Market Maker sem
// inventário, liquidez por ativo e concentração de float. Uma consulta por visão,
// nenhuma por bot ou por ativo.
func (r *AdminReadRepository) BotsSummary(ctx context.Context, idleDays int) (adminview.BotsSummary, error) {
	idleDays = adminview.NormalizeDays(idleDays, adminview.DefaultIdleDays, adminview.MaxIdleDays)
	today, err := r.currentDay(ctx)
	if err != nil {
		return adminview.BotsSummary{}, err
	}
	s := adminview.BotsSummary{SimulatedDay: today, IdleDays: idleDays}

	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM accounts WHERE is_bot AND is_active`).Scan(&s.ActiveBotsCount); err != nil {
		return s, err
	}
	if s.IdleBots, err = r.idleBots(ctx, today-idleDays); err != nil {
		return s, err
	}
	if s.LowCashBots, err = r.lowCashBots(ctx); err != nil {
		return s, err
	}
	if s.EmptyInventory, err = r.emptyInventory(ctx); err != nil {
		return s, err
	}
	if s.Liquidity, err = r.assetLiquidity(ctx); err != nil {
		return s, err
	}
	if s.Concentration, err = r.floatConcentration(ctx); err != nil {
		return s, err
	}
	return s, nil
}

// idleBots são os bots ativos cuja última ordem é do dia `cutoff` ou anterior.
func (r *AdminReadRepository) idleBots(ctx context.Context, cutoff int) ([]adminview.IdleBot, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT acc.user_id, bp.archetype::text, o.last_day
		 FROM accounts acc
		 JOIN bot_personalities bp ON bp.account_id = acc.user_id
		 LEFT JOIN LATERAL (SELECT MAX(simulated_day) AS last_day FROM order_book WHERE user_id = acc.user_id) o ON true
		 WHERE acc.is_bot AND acc.is_active AND COALESCE(o.last_day, -1) <= $1
		 ORDER BY o.last_day NULLS FIRST, acc.user_id`, cutoff,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	idle := make([]adminview.IdleBot, 0)
	for rows.Next() {
		var b adminview.IdleBot
		var last sql.NullInt64
		if err := rows.Scan(&b.AccountID, &b.Archetype, &last); err != nil {
			return nil, err
		}
		if last.Valid {
			d := int(last.Int64)
			b.LastOrderDay = &d
		}
		idle = append(idle, b)
	}
	return idle, rows.Err()
}

// lowCashBots são os bots ativos com o caixa abaixo de LowCashRatio do capital
// aportado (a mesma conta de adminview.IsLowCash, feita no banco pra não ler o
// roster inteiro).
func (r *AdminReadRepository) lowCashBots(ctx context.Context) ([]adminview.LowCashBot, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT acc.user_id, bp.archetype::text, acc.current_balance, cap.capital
		 FROM accounts acc
		 JOIN bot_personalities bp ON bp.account_id = acc.user_id
		 JOIN LATERAL (
		   SELECT COALESCE(SUM(CASE event_type
		            WHEN 'bot_initial_cash' THEN unit_value
		            WHEN 'bot_initial_allocation' THEN quantity * unit_value END), 0) AS capital
		   FROM market_events WHERE user_id = acc.user_id AND event_type IN ('bot_initial_cash', 'bot_initial_allocation')
		 ) cap ON true
		 WHERE acc.is_bot AND acc.is_active AND cap.capital > 0 AND acc.current_balance < cap.capital * $1
		 ORDER BY acc.current_balance / cap.capital, acc.user_id`, adminview.LowCashRatio,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	low := make([]adminview.LowCashBot, 0)
	for rows.Next() {
		var b adminview.LowCashBot
		if err := rows.Scan(&b.AccountID, &b.Archetype, &b.Cash, &b.Capital); err != nil {
			return nil, err
		}
		low = append(low, b)
	}
	return low, rows.Err()
}

// emptyInventory são os pares Market Maker ativo e ativo coberto em que ele não
// tem nenhuma ação.
func (r *AdminReadRepository) emptyInventory(ctx context.Context) ([]adminview.EmptyInventory, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT c.mm_account_id, a.id, a.ticker
		 FROM market_maker_coverage c
		 JOIN accounts m ON m.user_id = c.mm_account_id AND m.is_active
		 JOIN assets a ON a.id = c.asset_id
		 LEFT JOIN positions p ON p.user_id = c.mm_account_id AND p.asset_id = c.asset_id
		 WHERE COALESCE(p.quantity, 0) = 0
		 ORDER BY a.ticker, c.mm_account_id`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	empty := make([]adminview.EmptyInventory, 0)
	for rows.Next() {
		var e adminview.EmptyInventory
		if err := rows.Scan(&e.AccountID, &e.AssetID, &e.Ticker); err != nil {
			return nil, err
		}
		empty = append(empty, e)
	}
	return empty, rows.Err()
}

// assetLiquidity soma a quantidade ainda aberta nas ordens a limite de cada ativo,
// por arquétipo de bot e pelos usuários (provider "usuario").
func (r *AdminReadRepository) assetLiquidity(ctx context.Context) ([]adminview.AssetLiquidity, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id, a.ticker, COALESCE(bp.archetype::text, 'usuario'), SUM(o.quantity - o.filled_quantity)
		 FROM order_book o
		 JOIN assets a ON a.id = o.asset_id
		 LEFT JOIN bot_personalities bp ON bp.account_id = o.user_id
		 WHERE o.type = 'limit' AND o.status IN ('pending', 'partially_filled')
		 GROUP BY a.id, a.ticker, bp.archetype
		 ORDER BY a.ticker`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	byAsset := map[string]*adminview.AssetLiquidity{}
	var order []string
	for rows.Next() {
		var id, ticker, provider string
		var quantity int64
		if err := rows.Scan(&id, &ticker, &provider, &quantity); err != nil {
			return nil, err
		}
		l, ok := byAsset[id]
		if !ok {
			l = &adminview.AssetLiquidity{AssetID: id, Ticker: ticker, RestingByProvider: map[string]int64{}}
			byAsset[id] = l
			order = append(order, id)
		}
		l.RestingByProvider[provider] += quantity
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]adminview.AssetLiquidity, 0, len(order))
	for _, id := range order {
		out = append(out, *byAsset[id])
	}
	return out, nil
}

// floatConcentration traz, por ativo, o maior bot detentor e a fatia de todos os
// bots, em % das cotas em circulação. Ativo sem cotas em circulação conhecidas fica
// de fora (não há base pra o percentual). Ordenado pela maior concentração.
func (r *AdminReadRepository) floatConcentration(ctx context.Context) ([]adminview.FloatConcentration, error) {
	rows, err := r.db.QueryContext(ctx,
		`WITH bot_held AS (
		   SELECT p.asset_id, p.user_id, p.quantity, bp.archetype::text AS archetype,
		          SUM(p.quantity) OVER (PARTITION BY p.asset_id) AS all_bots,
		          ROW_NUMBER() OVER (PARTITION BY p.asset_id ORDER BY p.quantity DESC, p.user_id) AS rank
		   FROM positions p
		   JOIN bot_personalities bp ON bp.account_id = p.user_id
		   WHERE p.quantity > 0
		 )
		 SELECT a.id, a.ticker, h.user_id, h.archetype, via.outstanding_shares,
		        h.quantity::float8 / via.outstanding_shares * 100,
		        h.all_bots::float8 / via.outstanding_shares * 100
		 FROM bot_held h
		 JOIN assets a ON a.id = h.asset_id
		 JOIN variable_income_assets via ON via.asset_id = a.id
		 WHERE h.rank = 1 AND via.outstanding_shares > 0 AND a.is_sandbox = false`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	out := make([]adminview.FloatConcentration, 0)
	for rows.Next() {
		var c adminview.FloatConcentration
		if err := rows.Scan(&c.AssetID, &c.Ticker, &c.TopBotID, &c.TopBotArchetype, &c.OutstandingShare, &c.TopBotPct, &c.AllBotsPct); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].TopBotPct > out[j].TopBotPct })
	return out, nil
}
