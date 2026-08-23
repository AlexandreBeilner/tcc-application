package db

import (
	"context"
	"database/sql"
	"time"

	"tcc-investimentos/engine/internal/domain/tick"
)

// TickRepository implementa tick.Repository contra o banco "market" —
// market_calendar (linha singleton) e asset_quotes (tarefa 3.11).
type TickRepository struct {
	db *sql.DB
}

func NewTickRepository(db *sql.DB) *TickRepository {
	return &TickRepository{db: db}
}

// LoadState lê a linha singleton de market_calendar — found = false se o
// Temporizador nunca rodou (motor recém-subido, tabela ainda vazia).
func (r *TickRepository) LoadState(ctx context.Context) (tick.State, bool, error) {
	var state tick.State
	err := r.db.QueryRowContext(ctx,
		`SELECT current_day, selic_rate FROM market_calendar WHERE id = 1`,
	).Scan(&state.Day, &state.SelicRate)
	if err == sql.ErrNoRows {
		return tick.State{}, false, nil
	}
	if err != nil {
		return tick.State{}, false, err
	}
	return state, true, nil
}

// ListPricingAssets devolve todo ativo de renda variável ativo (is_sandbox
// = false, type em acao/etf/fii) com sua última cotação conhecida, via
// LEFT JOIN LATERAL — price fica nil quando o ativo nunca teve tick gerado
// (Advance aplica tick.DefaultInitialPrice nesse caso).
func (r *TickRepository) ListPricingAssets(ctx context.Context) ([]tick.AssetForPricing, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id, a.risk_class, q.price, via.company_id
		 FROM assets a
		 LEFT JOIN LATERAL (
		   SELECT price FROM asset_quotes
		   WHERE asset_id = a.id
		   ORDER BY simulated_day DESC
		   LIMIT 1
		 ) q ON true
		 LEFT JOIN variable_income_assets via ON via.asset_id = a.id
		 WHERE a.is_sandbox = false AND a.type IN ('acao', 'etf', 'fii')
		 ORDER BY a.ticker`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var assets []tick.AssetForPricing
	for rows.Next() {
		var a tick.AssetForPricing
		if err := rows.Scan(&a.AssetID, &a.RiskClass, &a.LastPrice, &a.CompanyID); err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}
	return assets, rows.Err()
}

// ListCompaniesForFundamentals devolve toda empresa cadastrada com sua
// última net_revenue conhecida (company_fundamentals, via LEFT JOIN LATERAL
// ordenado por period_date), usado por Advance (tarefa 3.14) pra decidir o
// dia de relatório de cada empresa e encadear a receita a partir do último
// ciclo persistido — LastRevenue fica nil se a empresa nunca teve um ciclo
// de relatório gerado (Advance aplica fundamentals.DefaultBaseRevenue nesse
// caso).
func (r *TickRepository) ListCompaniesForFundamentals(ctx context.Context) ([]tick.CompanyForFundamentals, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT c.id, c.report_frequency_days, f.net_revenue
		 FROM companies c
		 LEFT JOIN LATERAL (
		   SELECT net_revenue FROM company_fundamentals
		   WHERE company_id = c.id
		   ORDER BY period_date DESC, created_at DESC
		   LIMIT 1
		 ) f ON true
		 ORDER BY c.name`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var companies []tick.CompanyForFundamentals
	for rows.Next() {
		var c tick.CompanyForFundamentals
		if err := rows.Scan(&c.CompanyID, &c.ReportFrequencyDays, &c.LastRevenue); err != nil {
			return nil, err
		}
		companies = append(companies, c)
	}
	return companies, rows.Err()
}

// SaveTick grava o novo estado do calendário (upsert na linha singleton),
// as cotações geradas e as novas linhas de company_fundamentals (tarefa
// 3.14), na mesma transação — nem calendário, cotações nem fundamentos são
// escrita de saldo/posição de usuário, por isso não passa por Event
// Sourcing (mesma distinção de catalog_repository.go pra dado cadastral).
// period_date usa o relógio real (time.Now()), não o dia simulado — mesma
// decisão já tomada pra DU restante de renda fixa na tarefa 3.13 (coerente
// com "1 tick = 1 dia real"). Só net_revenue é gravado; net_income/ebit/
// net_equity/gross_debt/cash_equivalents ficam NULL (schema permite,
// mesma nota de escopo de FundamentalsRecord).
func (r *TickRepository) SaveTick(ctx context.Context, result tick.Result) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO market_calendar (id, current_day, selic_rate, updated_at)
		 VALUES (1, $1, $2, now())
		 ON CONFLICT (id) DO UPDATE SET
		   current_day = EXCLUDED.current_day,
		   selic_rate = EXCLUDED.selic_rate,
		   updated_at = now()`,
		result.State.Day, result.State.SelicRate,
	); err != nil {
		return err
	}

	for _, q := range result.Quotes {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO asset_quotes (asset_id, simulated_day, price) VALUES ($1, $2, $3)`,
			q.AssetID, result.State.Day, q.Price,
		); err != nil {
			return err
		}
	}

	if len(result.Fundamentals) > 0 {
		periodDate := time.Now()
		for _, f := range result.Fundamentals {
			if _, err := tx.ExecContext(ctx,
				`INSERT INTO company_fundamentals (company_id, period_date, net_revenue) VALUES ($1, $2, $3)`,
				f.CompanyID, periodDate, f.NetRevenue,
			); err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}
