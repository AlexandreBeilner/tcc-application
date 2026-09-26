package db

import (
	"context"
	"database/sql"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/tick"
	"tcc-investimentos/engine/internal/infra/eventstore"
)

// ETFFundRepository lê o estado dos fundos de ETF e provisiona o caixa do
// Participante Autorizado (tarefa R.3). Implementa tick.ETFFunds e
// tick.ETFParticipant.
type ETFFundRepository struct {
	db *sql.DB
}

func NewETFFundRepository(db *sql.DB) *ETFFundRepository {
	return &ETFFundRepository{db: db}
}

var (
	_ tick.ETFFunds       = (*ETFFundRepository)(nil)
	_ tick.ETFParticipant = (*ETFFundRepository)(nil)
)

// ListPendingIssuances devolve os ETFs com fundo ligado, sem cota emitida e sem
// posição no fundo, com os constituintes reais (asset_id preenchido) da cesta.
// Uma consulta pelos ETFs e outra, em lote, pelas cestas.
func (r *ETFFundRepository) ListPendingIssuances(ctx context.Context) ([]etf.PendingIssuance, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT ed.asset_id, ed.fund_account_id
		 FROM etf_details ed
		 JOIN variable_income_assets via ON via.asset_id = ed.asset_id
		 WHERE ed.fund_account_id IS NOT NULL AND via.outstanding_shares = 0
		   AND NOT EXISTS (SELECT 1 FROM positions p WHERE p.user_id = ed.fund_account_id AND p.quantity > 0)
		 ORDER BY ed.asset_id`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var pending []etf.PendingIssuance
	var ids []string
	byID := map[string]int{}
	for rows.Next() {
		var p etf.PendingIssuance
		if err := rows.Scan(&p.ETFAssetID, &p.FundAccountID); err != nil {
			return nil, err
		}
		byID[p.ETFAssetID] = len(pending)
		ids = append(ids, p.ETFAssetID)
		pending = append(pending, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(pending) == 0 {
		return nil, nil
	}

	holdRows, err := r.db.QueryContext(ctx,
		`SELECT etf_asset_id, constituent_name, asset_id, weight_pct
		 FROM etf_holdings WHERE etf_asset_id = ANY($1) AND asset_id IS NOT NULL
		 ORDER BY etf_asset_id, asset_id`, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer func() { _ = holdRows.Close() }()
	for holdRows.Next() {
		var etfID string
		var h etf.Holding
		var assetID string
		if err := holdRows.Scan(&etfID, &h.ConstituentName, &assetID, &h.WeightPct); err != nil {
			return nil, err
		}
		h.AssetID = &assetID
		i := byID[etfID]
		pending[i].Holdings = append(pending[i].Holdings, h)
	}
	return pending, holdRows.Err()
}

// ListFunds devolve o estado de todo fundo com cotas emitidas: uma consulta
// pelos fundos e uma, em lote, pelas posições de todos eles.
func (r *ETFFundRepository) ListFunds(ctx context.Context) ([]etf.FundSnapshot, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT ed.asset_id, ed.fund_account_id, via.outstanding_shares, a.current_balance, ed.dividends_payable + ed.fees_payable, ed.fees_payable, ed.expense_ratio_pct,
		        ed.rebalance_frequency_days, ed.last_rebalance_day
		 FROM etf_details ed
		 JOIN variable_income_assets via ON via.asset_id = ed.asset_id
		 JOIN accounts a ON a.user_id = ed.fund_account_id
		 WHERE via.outstanding_shares > 0
		 ORDER BY ed.asset_id`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var funds []etf.FundSnapshot
	var accountIDs []string
	indexByAccount := map[string]int{}
	for rows.Next() {
		var f etf.FundSnapshot
		var accountID string
		var lastRebalance sql.NullInt64
		if err := rows.Scan(&f.ETFAssetID, &accountID, &f.Shares, &f.Cash, &f.Liabilities, &f.FeesPayable, &f.ExpenseRatioPct, &f.RebalanceEveryDays, &lastRebalance); err != nil {
			return nil, err
		}
		if lastRebalance.Valid {
			day := int(lastRebalance.Int64)
			f.LastRebalanceDay = &day
		}
		f.FundAccountID = accountID
		indexByAccount[accountID] = len(funds)
		accountIDs = append(accountIDs, accountID)
		funds = append(funds, f)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(funds) == 0 {
		return nil, nil
	}

	posRows, err := r.db.QueryContext(ctx,
		`SELECT user_id, asset_id, quantity FROM positions
		 WHERE user_id = ANY($1) AND quantity > 0 ORDER BY user_id, asset_id`, pq.Array(accountIDs))
	if err != nil {
		return nil, err
	}
	defer func() { _ = posRows.Close() }()
	for posRows.Next() {
		var accountID string
		var h etf.FundHolding
		if err := posRows.Scan(&accountID, &h.AssetID, &h.Quantity); err != nil {
			return nil, err
		}
		i := indexByAccount[accountID]
		funds[i].Holdings = append(funds[i].Holdings, h)
	}
	if err := posRows.Err(); err != nil {
		return nil, err
	}

	// Composição-alvo real (R.7), numa consulta em lote pelos ETFs.
	etfIDs := make([]string, len(funds))
	indexByETF := make(map[string]int, len(funds))
	for i, f := range funds {
		etfIDs[i] = f.ETFAssetID
		indexByETF[f.ETFAssetID] = i
	}
	targetRows, err := r.db.QueryContext(ctx,
		`SELECT etf_asset_id, asset_id, weight_pct FROM etf_holdings
		 WHERE etf_asset_id = ANY($1) AND asset_id IS NOT NULL ORDER BY etf_asset_id, asset_id`, pq.Array(etfIDs))
	if err != nil {
		return nil, err
	}
	defer func() { _ = targetRows.Close() }()
	for targetRows.Next() {
		var etfID string
		var t etf.TargetWeight
		if err := targetRows.Scan(&etfID, &t.AssetID, &t.WeightPct); err != nil {
			return nil, err
		}
		i := indexByETF[etfID]
		funds[i].Targets = append(funds[i].Targets, t)
	}
	return funds, targetRows.Err()
}

// MarkRebalanced grava o dia do último rebalanceamento do fundo (R.7).
func (r *ETFFundRepository) MarkRebalanced(ctx context.Context, etfAssetID string, day int) error {
	_, err := r.db.ExecContext(ctx, `UPDATE etf_details SET last_rebalance_day = $1 WHERE asset_id = $2`, day, etfAssetID)
	return err
}

// LatestIndexValues devolve o último índice teórico gravado de cada ETF
// (etf_nav_history.index_value); ETF sem histórico com índice fica de fora.
func (r *ETFFundRepository) LatestIndexValues(ctx context.Context) (map[string]float64, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT DISTINCT ON (etf_asset_id) etf_asset_id, index_value FROM etf_nav_history
		 WHERE index_value IS NOT NULL ORDER BY etf_asset_id, simulated_day DESC`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	values := map[string]float64{}
	for rows.Next() {
		var id string
		var v float64
		if err := rows.Scan(&id, &v); err != nil {
			return nil, err
		}
		values[id] = v
	}
	return values, rows.Err()
}

// ParticipantHoldings devolve o que o Participante Autorizado detém de cada um
// dos assetIDs (ausente = 0).
func (r *ETFFundRepository) ParticipantHoldings(ctx context.Context, assetIDs []string) (map[string]int64, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT asset_id, quantity FROM positions WHERE user_id = $1 AND asset_id = ANY($2)`,
		etf.AuthorizedParticipantAccountID, pq.Array(assetIDs))
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	held := make(map[string]int64, len(assetIDs))
	for rows.Next() {
		var assetID string
		var quantity int64
		if err := rows.Scan(&assetID, &quantity); err != nil {
			return nil, err
		}
		held[assetID] = quantity
	}
	return held, rows.Err()
}

// ParticipantCash devolve o caixa corrente do Participante Autorizado.
func (r *ETFFundRepository) ParticipantCash(ctx context.Context) (float64, error) {
	var balance float64
	err := r.db.QueryRowContext(ctx,
		`SELECT current_balance FROM accounts WHERE user_id = $1`, etf.AuthorizedParticipantAccountID).Scan(&balance)
	return balance, err
}

// ListMarketMakingCandidates devolve os ETFs com cotas emitidas que ainda
// precisam de liquidez: sem Market Maker cobrindo (market_maker_coverage) ou com
// cotas em posse do Participante Autorizado, em ordem por ID.
func (r *ETFFundRepository) ListMarketMakingCandidates(ctx context.Context) ([]etf.MarketMakingCandidate, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT ed.asset_id, via.outstanding_shares
		 FROM etf_details ed
		 JOIN variable_income_assets via ON via.asset_id = ed.asset_id
		 WHERE ed.fund_account_id IS NOT NULL AND via.outstanding_shares > 0
		   AND (NOT EXISTS (SELECT 1 FROM market_maker_coverage c WHERE c.asset_id = ed.asset_id)
		        OR EXISTS (SELECT 1 FROM positions p WHERE p.user_id = $1 AND p.asset_id = ed.asset_id AND p.quantity > 0))
		 ORDER BY ed.asset_id`, etf.AuthorizedParticipantAccountID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var uncovered []etf.MarketMakingCandidate
	for rows.Next() {
		var u etf.MarketMakingCandidate
		if err := rows.Scan(&u.ETFAssetID, &u.Shares); err != nil {
			return nil, err
		}
		uncovered = append(uncovered, u)
	}
	return uncovered, rows.Err()
}

// ProvisionCash credita amount ao caixa de uma conta de bot (o Participante
// Autorizado ou um Market Maker) gravando antes o evento imutável
// bot_initial_cash (Event Sourcing, mesmo mecanismo do caixa de qualquer bot de
// liquidez).
func (r *ETFFundRepository) ProvisionCash(ctx context.Context, accountID string, amount float64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
		UserID:    accountID,
		EventType: domain.EventBotInitialCash,
		UnitValue: &amount,
	}); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx,
		`UPDATE accounts SET current_balance = current_balance + $1, updated_at = now() WHERE user_id = $2`,
		amount, accountID,
	); err != nil {
		return err
	}
	return tx.Commit()
}

// ListShareHolders devolve, por ETF, as cotas de cada conta (positions), numa
// consulta em lote: o snapshot de elegibilidade de um provento na data-ex (R.8).
func (r *ETFFundRepository) ListShareHolders(ctx context.Context, etfAssetIDs []string) (map[string][]tick.PositionHolder, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT asset_id, user_id, quantity FROM positions
		 WHERE asset_id = ANY($1) AND quantity > 0 ORDER BY asset_id, user_id`, pq.Array(etfAssetIDs))
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	holders := map[string][]tick.PositionHolder{}
	for rows.Next() {
		var assetID string
		var h tick.PositionHolder
		if err := rows.Scan(&assetID, &h.UserID, &h.Quantity); err != nil {
			return nil, err
		}
		holders[assetID] = append(holders[assetID], h)
	}
	return holders, rows.Err()
}
