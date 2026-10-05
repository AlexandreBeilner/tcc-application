package db

import (
	"context"
	"database/sql"
	"errors"

	"tcc-investimentos/engine/internal/domain/adminview"
)

// marketAssetsQuery traz uma linha por ativo negociável com tudo que o monitor
// mostra, sem consulta por ativo. Os agregados de book, negócios do dia e posse
// são feitos uma vez e juntados por asset_id.
const marketAssetsQuery = `
WITH today AS (
  SELECT COALESCE((SELECT current_day FROM market_calendar WHERE id = 1), 0) AS day
),
book AS (
  SELECT o.asset_id,
         MAX(o.price) FILTER (WHERE o.side = 'buy') AS best_bid,
         MIN(o.price) FILTER (WHERE o.side = 'sell') AS best_ask,
         COUNT(*) AS resting,
         COUNT(*) FILTER (WHERE acc.is_bot) AS bot_resting
  FROM order_book o
  JOIN accounts acc ON acc.user_id = o.user_id
  WHERE o.type = 'limit' AND o.status IN ('pending', 'partially_filled')
  GROUP BY o.asset_id
),
trades AS (
  SELECT e.asset_id, COUNT(*) AS trades, COALESCE(SUM(e.quantity), 0) AS volume
  FROM market_events e, today
  WHERE e.event_type = 'buy_order_executed' AND e.simulated_day = today.day
  GROUP BY e.asset_id
),
held AS (
  SELECT p.asset_id,
         COALESCE(SUM(p.quantity) FILTER (WHERE acc.is_bot), 0) AS by_bots,
         COALESCE(SUM(p.quantity) FILTER (WHERE NOT acc.is_bot), 0) AS by_users
  FROM positions p
  JOIN accounts acc ON acc.user_id = p.user_id
  GROUP BY p.asset_id
)
SELECT a.id, a.ticker, a.name, a.type::text, co.sector::text,
       q.price, q.previous_price,
       b.best_bid, b.best_ask, COALESCE(b.resting, 0), COALESCE(b.bot_resting, 0),
       COALESCE(t.trades, 0), COALESCE(t.volume, 0),
       via.outstanding_shares,
       COALESCE(h.by_bots, 0), COALESCE(h.by_users, 0),
       EXISTS (
         SELECT 1 FROM market_maker_coverage c
         JOIN accounts m ON m.user_id = c.mm_account_id
         WHERE c.asset_id = a.id AND m.is_active
       ),
       f.net_income, nav.premium_pct,
       CASE WHEN fd.fii_type = 'papel' THEN fd.portfolio_value ELSE fd.net_worth END
FROM assets a
LEFT JOIN variable_income_assets via ON via.asset_id = a.id
LEFT JOIN companies co ON co.id = via.company_id
LEFT JOIN fii_details fd ON fd.asset_id = a.id
LEFT JOIN LATERAL (
  SELECT (array_agg(price ORDER BY simulated_day DESC))[1] AS price,
         (array_agg(price ORDER BY simulated_day DESC))[2] AS previous_price
  FROM (SELECT price, simulated_day FROM asset_quotes WHERE asset_id = a.id ORDER BY simulated_day DESC LIMIT 2) s
) q ON true
LEFT JOIN LATERAL (
  SELECT net_income FROM company_fundamentals WHERE company_id = co.id ORDER BY period_date DESC LIMIT 1
) f ON true
LEFT JOIN LATERAL (
  SELECT premium_pct FROM etf_nav_history WHERE etf_asset_id = a.id ORDER BY simulated_day DESC LIMIT 1
) nav ON true
LEFT JOIN book b ON b.asset_id = a.id
LEFT JOIN trades t ON t.asset_id = a.id
LEFT JOIN held h ON h.asset_id = a.id
WHERE a.is_sandbox = false AND a.type IN ('acao', 'etf', 'fii')`

func scanMarketAsset(scan func(dest ...any) error) (adminview.AssetRow, error) {
	var (
		row                           adminview.AssetRow
		sector                        sql.NullString
		price, prev, bid, ask         sql.NullFloat64
		shares                        sql.NullInt64
		netIncome, premium, bookValue sql.NullFloat64
	)
	if err := scan(
		&row.AssetID, &row.Ticker, &row.Name, &row.Type, &sector,
		&price, &prev, &bid, &ask, &row.RestingOrders, &row.BotRestingOrders,
		&row.DayTrades, &row.DayVolume, &shares, &row.HeldByBots, &row.HeldByUsers,
		&row.Covered, &netIncome, &premium, &bookValue,
	); err != nil {
		return row, err
	}
	if sector.Valid {
		row.Sector = &sector.String
	}
	row.LastPrice = nullFloat(price)
	row.PreviousPrice = nullFloat(prev)
	row.BestBid = nullFloat(bid)
	row.BestAsk = nullFloat(ask)
	if shares.Valid {
		row.OutstandingShares = &shares.Int64
	}
	row.Indicator = adminview.ClassIndicator(adminview.IndicatorInputs{
		Type:              row.Type,
		Price:             row.LastPrice,
		OutstandingShares: row.OutstandingShares,
		NetIncome:         nullFloat(netIncome),
		NAVPremiumPct:     nullFloat(premium),
		BookValue:         nullFloat(bookValue),
	})
	return row, nil
}

func nullFloat(n sql.NullFloat64) *float64 {
	if !n.Valid {
		return nil
	}
	v := n.Float64
	return &v
}

// MarketAssets devolve todos os ativos negociáveis, ordenados por ticker.
func (r *AdminReadRepository) MarketAssets(ctx context.Context) ([]adminview.AssetRow, error) {
	rows, err := r.db.QueryContext(ctx, marketAssetsQuery+` ORDER BY a.ticker`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var out []adminview.AssetRow
	for rows.Next() {
		row, err := scanMarketAsset(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

const (
	detailTradeLimit   = 30
	detailQuoteDays    = 60
	detailNAVHistoryDs = 30
)

// AssetDetail devolve o detalhe de um ativo: book completo (agregado por preço, com
// a parcela de bots), últimos negócios, série de cotações e, pra ETF, série de NAV.
func (r *AdminReadRepository) AssetDetail(ctx context.Context, assetID string) (adminview.AssetDetail, error) {
	var d adminview.AssetDetail
	row := r.db.QueryRowContext(ctx, marketAssetsQuery+` AND a.id = $1`, assetID)
	assetRow, err := scanMarketAsset(row.Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return d, adminview.ErrAssetNotFound
	}
	if err != nil {
		return d, err
	}
	d.Row = assetRow

	levels, err := r.db.QueryContext(ctx,
		`SELECT o.side::text, o.price, SUM(o.quantity - o.filled_quantity),
		        COALESCE(SUM(o.quantity - o.filled_quantity) FILTER (WHERE acc.is_bot), 0)
		 FROM order_book o JOIN accounts acc ON acc.user_id = o.user_id
		 WHERE o.asset_id = $1 AND o.type = 'limit' AND o.status IN ('pending', 'partially_filled')
		 GROUP BY o.side, o.price
		 ORDER BY o.price DESC`, assetID)
	if err != nil {
		return d, err
	}
	defer func() { _ = levels.Close() }()
	for levels.Next() {
		var side string
		var l adminview.BookLevel
		if err := levels.Scan(&side, &l.Price, &l.Quantity, &l.BotQuantity); err != nil {
			return d, err
		}
		if side == "buy" {
			d.Bids = append(d.Bids, l)
		} else {
			d.Asks = append(d.Asks, l)
		}
	}
	if err := levels.Err(); err != nil {
		return d, err
	}
	// Asks saem do maior pro menor na consulta; o painel quer o menor primeiro.
	for i, j := 0, len(d.Asks)-1; i < j; i, j = i+1, j-1 {
		d.Asks[i], d.Asks[j] = d.Asks[j], d.Asks[i]
	}

	trades, err := r.db.QueryContext(ctx,
		`SELECT e.simulated_day, e.unit_value, e.quantity, acc.is_bot
		 FROM market_events e JOIN accounts acc ON acc.user_id = e.user_id
		 WHERE e.asset_id = $1 AND e.event_type = 'buy_order_executed'
		 ORDER BY e."timestamp" DESC, e.id DESC LIMIT $2`, assetID, detailTradeLimit)
	if err != nil {
		return d, err
	}
	defer func() { _ = trades.Close() }()
	for trades.Next() {
		var t adminview.Trade
		if err := trades.Scan(&t.SimulatedDay, &t.Price, &t.Quantity, &t.BuyerIsBot); err != nil {
			return d, err
		}
		d.Trades = append(d.Trades, t)
	}
	if err := trades.Err(); err != nil {
		return d, err
	}

	quotes, err := r.db.QueryContext(ctx,
		`SELECT simulated_day, price FROM (
		   SELECT simulated_day, price FROM asset_quotes WHERE asset_id = $1 ORDER BY simulated_day DESC LIMIT $2
		 ) recent ORDER BY simulated_day`, assetID, detailQuoteDays)
	if err != nil {
		return d, err
	}
	defer func() { _ = quotes.Close() }()
	for quotes.Next() {
		var q adminview.QuotePoint
		if err := quotes.Scan(&q.SimulatedDay, &q.Price); err != nil {
			return d, err
		}
		d.Quotes = append(d.Quotes, q)
	}
	if err := quotes.Err(); err != nil {
		return d, err
	}

	if d.Row.Type != "etf" {
		return d, nil
	}
	navs, err := r.db.QueryContext(ctx,
		`SELECT simulated_day, nav, close_price, premium_pct FROM (
		   SELECT simulated_day, nav, close_price, premium_pct FROM etf_nav_history
		   WHERE etf_asset_id = $1 ORDER BY simulated_day DESC LIMIT $2
		 ) recent ORDER BY simulated_day`, assetID, detailNAVHistoryDs)
	if err != nil {
		return d, err
	}
	defer func() { _ = navs.Close() }()
	for navs.Next() {
		var n adminview.NAVPoint
		if err := navs.Scan(&n.SimulatedDay, &n.NAV, &n.ClosePrice, &n.PremiumPct); err != nil {
			return d, err
		}
		d.NAVHistory = append(d.NAVHistory, n)
	}
	return d, navs.Err()
}
