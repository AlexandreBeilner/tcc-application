package db

import (
	"context"
	"database/sql"
	"errors"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/fixedincomeexecution"
	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/infra/eventstore"
)

// ErrMarketCalendarNotInitialized é devolvido por LoadRedeemContext quando
// o Temporizador (tarefa 3.11) ainda não rodou nenhum tick — sem uma linha
// em market_calendar não há taxa Selic simulada pra marcar a mercado o
// resgate, e diferente de asset_quotes (que tem um fallback documentado,
// tick.DefaultInitialPrice) não existe um valor default decidido pra Selic
// nesse repositório; um resgate nessas condições é um erro de precondição,
// não um caso a mascarar com um número inventado aqui.
var ErrMarketCalendarNotInitialized = errors.New("temporizador ainda não rodou nenhum tick — sem taxa Selic simulada pra marcar a mercado o resgate")

// FixedIncomeExecutionRepository implementa fixedincomeexecution.Repository
// contra o banco "market" — self-contained (lê fixed_income_assets/
// accounts/fixed_income_positions/market_calendar direto, sem depender de
// CatalogRepository), mesmo padrão de OrderExecutionRepository (3.12).
type FixedIncomeExecutionRepository struct {
	db *sql.DB
}

func NewFixedIncomeExecutionRepository(db *sql.DB) *FixedIncomeExecutionRepository {
	return &FixedIncomeExecutionRepository{db: db}
}

// LoadPurchaseContext lê saldo do usuário, dado de catálogo do título
// (taxa, vencimento, aplicação mínima) e a posição já existente do usuário
// nesse título (zero value se ainda não existe — primeira compra).
func (r *FixedIncomeExecutionRepository) LoadPurchaseContext(ctx context.Context, userID, assetID string) (fixedincomeexecution.PurchaseContext, error) {
	var balance float64
	if err := r.db.QueryRowContext(ctx,
		`SELECT current_balance FROM accounts WHERE user_id = $1`, userID,
	).Scan(&balance); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fixedincomeexecution.PurchaseContext{}, fixedincomeexecution.ErrAccountNotFound
		}
		return fixedincomeexecution.PurchaseContext{}, err
	}

	var pctx fixedincomeexecution.PurchaseContext
	pctx.AccountBalance = balance
	if err := r.db.QueryRowContext(ctx,
		`SELECT interest_rate, maturity_date, minimum_investment FROM fixed_income_assets WHERE asset_id = $1`, assetID,
	).Scan(&pctx.AnnualRatePct, &pctx.MaturityDate, &pctx.MinimumInvestment); err != nil {
		return fixedincomeexecution.PurchaseContext{}, err
	}

	var pos fixedincomeposition.Position
	err := r.db.QueryRowContext(ctx,
		`SELECT quantity, average_price, average_rate FROM fixed_income_positions WHERE user_id = $1 AND asset_id = $2`,
		userID, assetID,
	).Scan(&pos.Quantity, &pos.AveragePrice, &pos.AverageRate)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fixedincomeexecution.PurchaseContext{}, err
	}
	pctx.CurrentPosition = pos

	return pctx, nil
}

// LoadRedeemContext lê a posição do usuário no título (ErrPositionNotFound
// se não existir), o vencimento do título e a taxa Selic simulada corrente
// (market_calendar, tarefa 3.11) — usada como taxa de mercado pra marcação
// a mercado (ver nota 3 do doc de fixedincomeexecution).
func (r *FixedIncomeExecutionRepository) LoadRedeemContext(ctx context.Context, userID, assetID string) (fixedincomeexecution.RedeemContext, error) {
	var rctx fixedincomeexecution.RedeemContext
	err := r.db.QueryRowContext(ctx,
		`SELECT quantity, average_price, average_rate FROM fixed_income_positions WHERE user_id = $1 AND asset_id = $2`,
		userID, assetID,
	).Scan(&rctx.Position.Quantity, &rctx.Position.AveragePrice, &rctx.Position.AverageRate)
	if errors.Is(err, sql.ErrNoRows) {
		return fixedincomeexecution.RedeemContext{}, fixedincomeexecution.ErrPositionNotFound
	}
	if err != nil {
		return fixedincomeexecution.RedeemContext{}, err
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT maturity_date FROM fixed_income_assets WHERE asset_id = $1`, assetID,
	).Scan(&rctx.MaturityDate); err != nil {
		return fixedincomeexecution.RedeemContext{}, err
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT selic_rate FROM market_calendar WHERE id = 1`,
	).Scan(&rctx.CurrentMarketRatePct); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fixedincomeexecution.RedeemContext{}, ErrMarketCalendarNotInitialized
		}
		return fixedincomeexecution.RedeemContext{}, err
	}

	return rctx, nil
}

// PersistPurchase grava o evento imutável em market_events **antes** de
// projetar em accounts/fixed_income_positions — Event Sourcing é a fonte
// da verdade financeira (CLAUDE.md).
func (r *FixedIncomeExecutionRepository) PersistPurchase(ctx context.Context, req fixedincomeexecution.Request, outcome fixedincomeexecution.PurchaseOutcome) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
		UserID:    req.UserID,
		AssetID:   &req.AssetID,
		EventType: domain.EventFixedIncomePurchase,
		UnitValue: &req.Amount,
	}); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE accounts SET current_balance = current_balance - $1, total_invested = total_invested + $1, updated_at = now() WHERE user_id = $2`,
		req.Amount, req.UserID,
	); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO fixed_income_positions (user_id, asset_id, quantity, average_price, average_rate)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (user_id, asset_id) DO UPDATE SET
		   quantity = EXCLUDED.quantity, average_price = EXCLUDED.average_price, average_rate = EXCLUDED.average_rate, updated_at = now()`,
		req.UserID, req.AssetID, outcome.NewPosition.Quantity, outcome.NewPosition.AveragePrice, outcome.NewPosition.AverageRate,
	); err != nil {
		return err
	}

	return tx.Commit()
}

// PersistRedeem grava o evento imutável, credita accounts (sem decrementar
// total_invested — métrica cumulativa de capital já implantado, mesmo
// precedente do lado de venda em order_execution_repository.go) e remove a
// posição inteira (resgate sempre integral, nota 5 do doc de
// fixedincomeexecution).
func (r *FixedIncomeExecutionRepository) PersistRedeem(ctx context.Context, req fixedincomeexecution.RedeemRequest, outcome fixedincomeexecution.RedeemOutcome) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
		UserID:    req.UserID,
		AssetID:   &req.AssetID,
		EventType: domain.EventFixedIncomeRedemption,
		UnitValue: &outcome.TotalValue,
	}); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx,
		`UPDATE accounts SET current_balance = current_balance + $1, updated_at = now() WHERE user_id = $2`,
		outcome.TotalValue, req.UserID,
	); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx,
		`DELETE FROM fixed_income_positions WHERE user_id = $1 AND asset_id = $2`,
		req.UserID, req.AssetID,
	); err != nil {
		return err
	}

	return tx.Commit()
}
