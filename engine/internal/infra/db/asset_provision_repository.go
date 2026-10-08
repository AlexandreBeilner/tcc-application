package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/assetprovision"
	"tcc-investimentos/engine/internal/domain/botpool"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// AssetProvisionRepository grava o cadastro de ativo novo do painel (tarefa N.13): o catálogo
// numa transação só e, do lado dos bots, as contas novas e as posições do ativo novo. Implementa
// assetprovision.Store e assetprovision.Liquidity.
type AssetProvisionRepository struct {
	db      *sql.DB
	account *AccountRepository
}

func NewAssetProvisionRepository(db *sql.DB, accounts *AccountRepository) *AssetProvisionRepository {
	return &AssetProvisionRepository{db: db, account: accounts}
}

func (r *AssetProvisionRepository) TickerExists(ctx context.Context, ticker string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM assets WHERE ticker = $1)`, ticker).Scan(&exists)
	return exists, err
}

func (r *AssetProvisionRepository) CNPJExists(ctx context.Context, cnpj string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM companies WHERE cnpj = $1)`, cnpj).Scan(&exists)
	return exists, err
}

// ResolveTickers devolve os ativos negociáveis (fora do sandbox) pelos tickers pedidos; ticker
// que não existe simplesmente não aparece no mapa.
func (r *AssetProvisionRepository) ResolveTickers(ctx context.Context, tickers []string) (map[string]assetprovision.ResolvedAsset, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT ticker, id, name, type::text FROM assets WHERE ticker = ANY($1) AND is_sandbox = false`, pq.Array(tickers))
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := map[string]assetprovision.ResolvedAsset{}
	for rows.Next() {
		var ticker, assetType string
		var a assetprovision.ResolvedAsset
		if err := rows.Scan(&ticker, &a.ID, &a.Name, &assetType); err != nil {
			return nil, err
		}
		a.Type = catalog.AssetType(assetType)
		out[ticker] = a
	}
	return out, rows.Err()
}

// Create grava empresa, ativo, especialização e fundamentos iniciais numa transação: ou o
// ativo nasce inteiro ou não nasce. ETF ganha a conta de fundo na mesma transação.
func (r *AssetProvisionRepository) Create(ctx context.Context, plan assetprovision.Plan) (string, error) {
	id, err := r.create(ctx, plan)
	var pgErr *pq.Error
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		// Dois cadastros simultâneos do mesmo ticker ou CNPJ: o índice único decide quem fica.
		return "", &assetprovision.ConflictError{Message: "o ticker ou o CNPJ já foi cadastrado por outro pedido"}
	}
	return id, err
}

func (r *AssetProvisionRepository) create(ctx context.Context, plan assetprovision.Plan) (string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback() }()

	var companyID *string
	if plan.Company != nil {
		var id string
		c := plan.Company
		if err := tx.QueryRowContext(ctx,
			`INSERT INTO companies (name, cnpj, sector, report_frequency_days, base_growth_pct, quality_multiplier)
			 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
			c.Name, c.CNPJ, string(c.Sector), c.ReportFrequencyDays, c.BaseGrowthPct, c.QualityMultiplier,
		).Scan(&id); err != nil {
			return "", fmt.Errorf("criar empresa: %w", err)
		}
		companyID = &id
	}

	var assetID string
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO assets (ticker, name, type, risk_class, is_sandbox) VALUES ($1, $2, $3, $4, false) RETURNING id`,
		plan.Asset.Ticker, plan.Asset.Name, string(plan.Asset.Type), plan.Asset.RiskClass,
	).Scan(&assetID); err != nil {
		return "", fmt.Errorf("criar ativo: %w", err)
	}
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO variable_income_assets (asset_id, company_id, share_class, outstanding_shares) VALUES ($1, $2, $3, $4)`,
		assetID, companyID, plan.ShareClass, plan.OutstandingShares,
	); err != nil {
		return "", fmt.Errorf("criar especialização de renda variável: %w", err)
	}

	if plan.Fundamentals != nil && companyID != nil {
		day, err := loadSimulatedDay(ctx, tx)
		if err != nil {
			return "", err
		}
		if err := insertCompanyFundamentals(ctx, tx, *companyID, simcalendar.DateOf(day), *plan.Fundamentals); err != nil {
			return "", fmt.Errorf("criar fundamentos iniciais: %w", err)
		}
	}
	if d := plan.FII; d != nil {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO fii_details (asset_id, fii_type, segment, net_worth, vacancy_rate, indexador, portfolio_value)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			assetID, string(d.Type), d.Segment, d.NetWorth, d.VacancyRate, d.Indexador, d.PortfolioValue,
		); err != nil {
			return "", fmt.Errorf("criar detalhes do FII: %w", err)
		}
	}
	if d := plan.ETF; d != nil {
		if err := r.insertETF(ctx, tx, assetID, *d); err != nil {
			return "", err
		}
	}

	if err := tx.Commit(); err != nil {
		return "", err
	}
	return assetID, nil
}

// insertETF grava os detalhes, a cesta e a conta de fundo (bot sem personalidade, saldo zero,
// então nunca entra numa rodada) do ETF novo, igual ao que o seed faz em ensureETFFund.
func (r *AssetProvisionRepository) insertETF(ctx context.Context, tx *sql.Tx, assetID string, d etf.Details) error {
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO etf_details (asset_id, benchmark_index, methodology_summary) VALUES ($1, $2, $3)`,
		assetID, d.BenchmarkIndex, d.MethodologySummary,
	); err != nil {
		return fmt.Errorf("criar detalhes do ETF: %w", err)
	}
	for _, h := range d.Holdings {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO etf_holdings (etf_asset_id, constituent_name, asset_id, weight_pct) VALUES ($1, $2, $3, $4)`,
			assetID, h.ConstituentName, h.AssetID, h.WeightPct,
		); err != nil {
			return fmt.Errorf("criar a cesta do ETF: %w", err)
		}
	}
	fundID := etf.FundAccountID(assetID)
	fund, err := account.NewBot(fundID, 0)
	if err != nil {
		return fmt.Errorf("conta de fundo do ETF: %w", err)
	}
	if err := createAccountTx(ctx, tx, fund); err != nil {
		return fmt.Errorf("criar a conta de fundo do ETF: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `UPDATE etf_details SET fund_account_id = $2 WHERE asset_id = $1`, assetID, fundID); err != nil {
		return fmt.Errorf("ligar o fundo ao ETF: %w", err)
	}
	// Sem posição nenhuma ainda: o total de cotas em circulação nasce em zero (R.2).
	_, err = tx.ExecContext(ctx,
		`UPDATE variable_income_assets SET outstanding_shares = 0 WHERE asset_id = $1 AND outstanding_shares IS NULL`, assetID)
	return err
}

// PoolState lê o tamanho atual do pool de bots direcionais (maior índice de botpool.UserID
// existente mais um) e o float de cada ativo negociável (ação e FII fora do sandbox).
func (r *AssetProvisionRepository) PoolState(ctx context.Context) (assetprovision.PoolState, error) {
	var state assetprovision.PoolState
	rows, err := r.db.QueryContext(ctx,
		`SELECT user_id::text FROM accounts WHERE is_bot AND user_id::text LIKE '00000000-0000-0000-0000-%'`)
	if err != nil {
		return state, err
	}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			_ = rows.Close()
			return state, err
		}
		if i, ok := botpool.IndexOf(id); ok && i+1 > state.DirectionalBots {
			state.DirectionalBots = i + 1
		}
	}
	if err := rows.Close(); err != nil {
		return state, err
	}

	floats, err := r.db.QueryContext(ctx,
		`SELECT via.outstanding_shares,
		        COALESCE((SELECT SUM(p.quantity) FROM positions p JOIN accounts a ON a.user_id = p.user_id
		                  WHERE p.asset_id = x.id AND NOT a.is_bot), 0)
		 FROM assets x JOIN variable_income_assets via ON via.asset_id = x.id
		 WHERE x.type IN ('acao', 'fii') AND NOT x.is_sandbox AND via.outstanding_shares IS NOT NULL`)
	if err != nil {
		return state, err
	}
	defer func() { _ = floats.Close() }()
	for floats.Next() {
		var f assetprovision.AssetFloat
		if err := floats.Scan(&f.Outstanding, &f.HumanHeld); err != nil {
			return state, err
		}
		state.Floats = append(state.Floats, f)
	}
	return state, floats.Err()
}

// Distribute cria os bots novos (conta com caixa e personalidade na mesma transação) e grava a
// posição inicial de cada bot direcional no ativo novo, por Event Sourcing. Só mexe em ativo novo
// e em bot novo: nenhuma posição existente muda. Idempotente.
func (r *AssetProvisionRepository) Distribute(ctx context.Context, d assetprovision.Distribution) error {
	for _, nb := range d.NewBots {
		if err := r.createBot(ctx, nb); err != nil {
			return err
		}
	}
	for i, quantity := range d.Positions {
		if quantity <= 0 {
			continue
		}
		if _, err := r.account.SeedInitialHolding(ctx, botpool.UserID(i), d.AssetID, int(quantity), d.Price, d.OutstandingShares); err != nil {
			return fmt.Errorf("posição inicial do bot %d: %w", i, err)
		}
	}
	return nil
}

func (r *AssetProvisionRepository) createBot(ctx context.Context, nb assetprovision.NewBot) error {
	userID := botpool.UserID(nb.Index)
	if _, found, err := r.account.FindByUserID(ctx, userID); err != nil {
		return err
	} else if found {
		return nil
	}
	acc, err := account.NewBot(userID, nb.Cash)
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
	if err := createPersonalityTx(ctx, tx, userID, nb.Personality); err != nil {
		return errors.Join(fmt.Errorf("personalidade do bot %d", nb.Index), err)
	}
	return tx.Commit()
}
