package db

import (
	"context"
	"database/sql"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/botadmin"
	"tcc-investimentos/engine/internal/domain/position"
	"tcc-investimentos/engine/internal/infra/eventstore"
)

// BotAdminRepository serve o painel de bots (tarefa N.1). Configuração de bot e
// interruptor, não estado financeiro: só o caixa inicial passa por evento
// imutável (o mesmo bot_initial_cash de AccountRepository.Create). Implementa
// botadmin.Reader e botadmin.Writer.
type BotAdminRepository struct {
	db *sql.DB
}

func NewBotAdminRepository(db *sql.DB) *BotAdminRepository {
	return &BotAdminRepository{db: db}
}

// adminBotIDPrefix é o prefixo dos IDs de bot criados pelo painel
// (botadmin.NewAdminBotID), distinto do pool do seed e dos Market Makers.
const adminBotIDPrefix = "00000000-0000-0000-0002-"

// List devolve todos os bots (ativos ou não) e os ativos negociáveis sem Market
// Maker ativo cobrindo. Quatro consultas pra todo o roster, nenhuma por bot.
func (r *BotAdminRepository) List(ctx context.Context) (botadmin.Listing, error) {
	bots, err := r.loadBots(ctx, "")
	if err != nil {
		return botadmin.Listing{}, err
	}
	uncovered, err := r.uncoveredAssets(ctx)
	if err != nil {
		return botadmin.Listing{}, err
	}
	return botadmin.Listing{Bots: bots, UncoveredAssets: uncovered}, nil
}

// Find devolve um bot pelo ID da conta.
func (r *BotAdminRepository) Find(ctx context.Context, accountID string) (botadmin.Bot, bool, error) {
	bots, err := r.loadBots(ctx, accountID)
	if err != nil || len(bots) == 0 {
		return botadmin.Bot{}, false, err
	}
	return bots[0], true, nil
}

// loadBots lê os bots (todos, ou só accountID quando não vazio) com escopo,
// cobertura e posições. A ordem é arquétipo e depois ID, pra tela ser estável.
func (r *BotAdminRepository) loadBots(ctx context.Context, accountID string) ([]botadmin.Bot, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.user_id, a.is_active, a.current_balance,
		        bp.archetype::text, bp.within_scope_pct, bp.knowledge_level,
		        bp.max_position_size_pct, bp.market_order_preference, bp.spread_width_pct, bp.max_covered_assets
		 FROM bot_personalities bp
		 JOIN accounts a ON a.user_id = bp.account_id
		 WHERE a.is_bot AND ($1 = '' OR a.user_id::text = $1)
		 ORDER BY bp.archetype::text, a.user_id`, accountID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	type rawBot struct {
		id                                                                        string
		active                                                                    bool
		cash                                                                      float64
		archetype                                                                 string
		withinScopePct, maxPositionSizePct, marketOrderPreference, spreadWidthPct float64
		knowledgeLevel                                                            sql.NullFloat64
		maxCoveredAssets                                                          sql.NullInt64
	}
	var raws []rawBot
	for rows.Next() {
		var raw rawBot
		if err := rows.Scan(&raw.id, &raw.active, &raw.cash, &raw.archetype, &raw.withinScopePct, &raw.knowledgeLevel,
			&raw.maxPositionSizePct, &raw.marketOrderPreference, &raw.spreadWidthPct, &raw.maxCoveredAssets); err != nil {
			return nil, err
		}
		raws = append(raws, raw)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(raws) == 0 {
		return nil, nil
	}

	scopes, err := r.loadScopes(ctx, accountID)
	if err != nil {
		return nil, err
	}
	covered, err := r.loadCoverage(ctx, accountID)
	if err != nil {
		return nil, err
	}
	holdings, err := r.loadHoldings(ctx, accountID)
	if err != nil {
		return nil, err
	}

	bots := make([]botadmin.Bot, 0, len(raws))
	for _, raw := range raws {
		personality, err := personalityFromRow(raw.archetype, raw.withinScopePct, raw.knowledgeLevel,
			raw.maxPositionSizePct, raw.marketOrderPreference, raw.spreadWidthPct, raw.maxCoveredAssets, scopes[raw.id])
		if err != nil {
			return nil, err
		}
		bots = append(bots, botadmin.Bot{
			AccountID: raw.id, Personality: personality, IsActive: raw.active, Cash: raw.cash,
			Covered: covered[raw.id], Holdings: holdings[raw.id],
		})
	}
	return bots, nil
}

func (r *BotAdminRepository) loadScopes(ctx context.Context, accountID string) (map[string]*scopeAccumulator, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT account_id, sector::text, risk_class::text, asset_class::text FROM bot_personality_scopes
		 WHERE $1 = '' OR account_id::text = $1`, accountID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	scopes := make(map[string]*scopeAccumulator)
	for rows.Next() {
		var id string
		var sector, riskClass, assetClass sql.NullString
		if err := rows.Scan(&id, &sector, &riskClass, &assetClass); err != nil {
			return nil, err
		}
		acc, ok := scopes[id]
		if !ok {
			acc = &scopeAccumulator{}
			scopes[id] = acc
		}
		acc.add(sector, riskClass, assetClass)
	}
	return scopes, rows.Err()
}

func (r *BotAdminRepository) loadCoverage(ctx context.Context, accountID string) (map[string][]botadmin.AssetRef, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT c.mm_account_id, a.id, a.ticker
		 FROM market_maker_coverage c JOIN assets a ON a.id = c.asset_id
		 WHERE $1 = '' OR c.mm_account_id::text = $1
		 ORDER BY c.mm_account_id, a.ticker`, accountID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	covered := make(map[string][]botadmin.AssetRef)
	for rows.Next() {
		var id string
		var ref botadmin.AssetRef
		if err := rows.Scan(&id, &ref.AssetID, &ref.Ticker); err != nil {
			return nil, err
		}
		covered[id] = append(covered[id], ref)
	}
	return covered, rows.Err()
}

// loadHoldings traz só as posições com quantidade (positions mantém a linha de
// quem vendeu tudo, quantidade zero).
func (r *BotAdminRepository) loadHoldings(ctx context.Context, accountID string) (map[string][]botadmin.Holding, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT p.user_id, a.id, a.ticker, p.quantity, p.average_price
		 FROM positions p
		 JOIN assets a ON a.id = p.asset_id
		 JOIN accounts acc ON acc.user_id = p.user_id
		 WHERE acc.is_bot AND p.quantity > 0 AND ($1 = '' OR p.user_id::text = $1)
		 ORDER BY p.user_id, a.ticker`, accountID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	holdings := make(map[string][]botadmin.Holding)
	for rows.Next() {
		var id string
		var h botadmin.Holding
		if err := rows.Scan(&id, &h.AssetID, &h.Ticker, &h.Quantity, &h.AveragePrice); err != nil {
			return nil, err
		}
		holdings[id] = append(holdings[id], h)
	}
	return holdings, rows.Err()
}

// uncoveredAssets são os ativos negociáveis sem Market Maker ativo cobrindo, a
// mesma definição de uncovered_assets em GET /admin/overview.
func (r *BotAdminRepository) uncoveredAssets(ctx context.Context) ([]botadmin.AssetRef, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id, a.ticker FROM assets a
		 WHERE a.is_sandbox = false AND a.type IN ('acao', 'etf', 'fii')
		   AND NOT EXISTS (
		     SELECT 1 FROM market_maker_coverage c
		     JOIN accounts m ON m.user_id = c.mm_account_id
		     WHERE c.asset_id = a.id AND m.is_active
		   )
		 ORDER BY a.ticker`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	uncovered := make([]botadmin.AssetRef, 0)
	for rows.Next() {
		var ref botadmin.AssetRef
		if err := rows.Scan(&ref.AssetID, &ref.Ticker); err != nil {
			return nil, err
		}
		uncovered = append(uncovered, ref)
	}
	return uncovered, rows.Err()
}

// TradableAsset devolve o ativo se for ação, ETF ou FII fora do sandbox.
func (r *BotAdminRepository) TradableAsset(ctx context.Context, assetID string) (botadmin.AssetRef, bool, error) {
	var ref botadmin.AssetRef
	err := r.db.QueryRowContext(ctx,
		`SELECT id, ticker FROM assets WHERE id = $1 AND is_sandbox = false AND type IN ('acao', 'etf', 'fii')`, assetID,
	).Scan(&ref.AssetID, &ref.Ticker)
	if err == sql.ErrNoRows {
		return botadmin.AssetRef{}, false, nil
	}
	if err != nil {
		return botadmin.AssetRef{}, false, err
	}
	return ref, true, nil
}

// CountAdminBots conta os bots já criados pelo painel.
func (r *BotAdminRepository) CountAdminBots(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM accounts WHERE is_bot AND user_id::text LIKE $1`, adminBotIDPrefix+"%",
	).Scan(&count)
	return count, err
}

// CreateBot grava conta e personalidade na mesma transação (o caixa vira o evento
// bot_initial_cash). ID já existente devolve account.ErrAlreadyExists.
func (r *BotAdminRepository) CreateBot(ctx context.Context, accountID string, cash float64, personality bot.Personality) error {
	acc, err := account.NewBot(accountID, cash)
	if err != nil {
		return err
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if err := createAccountTx(ctx, tx, acc); err != nil {
		return err
	}
	if err := createPersonalityTx(ctx, tx, accountID, personality); err != nil {
		return err
	}
	return tx.Commit()
}

// SetActive alterna só accounts.is_active; saldo e posição ficam intocados (A.4).
func (r *BotAdminRepository) SetActive(ctx context.Context, accountID string, active bool) error {
	result, err := r.db.ExecContext(ctx, `UPDATE accounts SET is_active = $2 WHERE user_id = $1 AND is_bot`, accountID, active)
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		return botadmin.ErrBotNotFound
	}
	return nil
}

// SetMaxCoveredAssets ajusta o teto de cobertura de um Market Maker.
func (r *BotAdminRepository) SetMaxCoveredAssets(ctx context.Context, accountID string, max int) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE bot_personalities SET max_covered_assets = $2 WHERE account_id = $1 AND archetype = 'market_maker'`, accountID, max,
	)
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		return botadmin.ErrNotMarketMaker
	}
	return nil
}

// RemoveCoverage tira um ativo da cobertura de um Market Maker. A posição que ele
// já tem no ativo continua com ele; só a cotação automática deixa de existir.
func (r *BotAdminRepository) RemoveCoverage(ctx context.Context, accountID, assetID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM market_maker_coverage WHERE mm_account_id = $1 AND asset_id = $2`, accountID, assetID)
	return err
}

// FundingTarget devolve o ativo negociável com a última cotação e as cotas em
// circulação, pra valorizar e validar um aporte de posição.
func (r *BotAdminRepository) FundingTarget(ctx context.Context, assetID string) (botadmin.FundingTarget, bool, error) {
	var target botadmin.FundingTarget
	var price sql.NullFloat64
	var shares sql.NullInt64
	err := r.db.QueryRowContext(ctx,
		`SELECT a.id, a.ticker, q.price, via.outstanding_shares
		 FROM assets a
		 LEFT JOIN variable_income_assets via ON via.asset_id = a.id
		 LEFT JOIN LATERAL (
		   SELECT price FROM asset_quotes WHERE asset_id = a.id ORDER BY simulated_day DESC LIMIT 1
		 ) q ON true
		 WHERE a.id = $1 AND a.is_sandbox = false AND a.type IN ('acao', 'etf', 'fii')`, assetID,
	).Scan(&target.AssetID, &target.Ticker, &price, &shares)
	if err == sql.ErrNoRows {
		return botadmin.FundingTarget{}, false, nil
	}
	if err != nil {
		return botadmin.FundingTarget{}, false, err
	}
	target.LastPrice = price.Float64
	target.OutstandingShares = shares.Int64
	return target, true, nil
}

// UpdatePersonality troca escopo, posição máxima, spread e conhecimento do bot numa
// transação só: as linhas de escopo são substituídas por inteiro. Arquétipo, preferência
// por ordem a mercado (achado 001) e teto de cobertura não são tocados.
func (r *BotAdminRepository) UpdatePersonality(ctx context.Context, accountID string, personality bot.Personality) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	result, err := tx.ExecContext(ctx,
		`UPDATE bot_personalities
		 SET within_scope_pct = $2, knowledge_level = $3, max_position_size_pct = $4, spread_width_pct = $5
		 WHERE account_id = $1`,
		accountID, personality.Scope.WithinScopePct, personality.KnowledgeLevel,
		personality.RiskProfile.MaxPositionSizePct, personality.RiskProfile.SpreadWidthPct,
	)
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		return botadmin.ErrBotNotFound
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM bot_personality_scopes WHERE account_id = $1`, accountID); err != nil {
		return err
	}
	if err := insertScopeTx(ctx, tx, accountID, personality.Scope); err != nil {
		return err
	}
	return tx.Commit()
}

// FundBot grava o aporte: o caixa vira o evento 'bot_initial_cash' (sem ativo) e cada
// linha de posição vira 'bot_initial_allocation' (quantidade e cotação), os mesmos tipos
// do seed e do provisionamento de cobertura, antes de projetar saldo e posição. A soma
// das posições do ativo é validada contra as cotas em circulação depois de gravar, e a
// transação inteira é desfeita se estourar (nada do aporte fica).
func (r *BotAdminRepository) FundBot(ctx context.Context, accountID string, cash float64, lines []botadmin.FundingLine) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var isBot bool
	if err := tx.QueryRowContext(ctx,
		`SELECT is_bot FROM accounts WHERE user_id = $1 FOR UPDATE`, accountID,
	).Scan(&isBot); err == sql.ErrNoRows || (err == nil && !isBot) {
		return botadmin.ErrBotNotFound
	} else if err != nil {
		return err
	}

	if cash > 0 {
		if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
			UserID: accountID, EventType: domain.EventBotInitialCash, UnitValue: &cash,
		}); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE accounts SET current_balance = current_balance + $1 WHERE user_id = $2`, cash, accountID,
		); err != nil {
			return err
		}
	}

	for _, line := range lines {
		if err := fundHoldingTx(ctx, tx, accountID, line); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// fundHoldingTx soma a posição aportada à existente (preço médio ponderado), valida o
// teto de float do ativo e grava o evento de alocação.
func fundHoldingTx(ctx context.Context, tx *sql.Tx, accountID string, line botadmin.FundingLine) error {
	current := position.Position{}
	err := tx.QueryRowContext(ctx,
		`SELECT quantity, average_price FROM positions WHERE user_id = $1 AND asset_id = $2 FOR UPDATE`, accountID, line.AssetID,
	).Scan(&current.Quantity, &current.AveragePrice)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	quantity := int(line.Quantity)
	next := position.ApplyBuy(current, quantity, line.Price)
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO positions (user_id, asset_id, quantity, average_price) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, asset_id) DO UPDATE SET quantity = EXCLUDED.quantity, average_price = EXCLUDED.average_price`,
		accountID, line.AssetID, next.Quantity, next.AveragePrice,
	); err != nil {
		return err
	}

	var totalHeld sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT SUM(quantity) FROM positions WHERE asset_id = $1`, line.AssetID).Scan(&totalHeld); err != nil {
		return err
	}
	if err := position.ValidateFloatCeiling(totalHeld.Int64, line.OutstandingShares); err != nil {
		return err
	}
	return eventstore.AppendTx(ctx, tx, domain.MarketEvent{
		UserID: accountID, AssetID: &line.AssetID, EventType: domain.EventBotInitialAllocation, Quantity: &quantity, UnitValue: &line.Price,
	})
}

var (
	_ botadmin.Reader = (*BotAdminRepository)(nil)
	_ botadmin.Writer = (*BotAdminRepository)(nil)
)
