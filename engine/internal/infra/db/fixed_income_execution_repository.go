package db

import (
	"context"
	"database/sql"
	"errors"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/fixedincome"
	"tcc-investimentos/engine/internal/domain/fixedincomeexecution"
	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/domain/sandbox"
	"tcc-investimentos/engine/internal/domain/simcalendar"
	"tcc-investimentos/engine/internal/infra/eventstore"
)

// ErrMarketCalendarNotInitialized é devolvido pelos repositórios do pacote
// `db` (mesmo raciocínio de precondição em mais de um lugar: sem uma linha
// em market_calendar não há taxa Selic simulada, e diferente de asset_quotes
// — que tem um fallback documentado, tick.DefaultInitialPrice — não existe
// valor default decidido pra Selic) quando o Temporizador (tarefa 3.11)
// ainda não rodou nenhum tick. Usado hoje só por MacroEventRepository.
// LoadCurrentDay — LoadPurchaseContext/LoadRedeemContext deste arquivo
// devolvem o sentinel de domínio fixedincomeexecution.ErrMarketNotInitialized
// (achado da S.9: o motor de erro cru desta variável, sem tradução pro
// domínio, caía no default de writeFixedIncomePurchaseError/
// writeFixedIncomeRedemptionError e virava um 500 opaco em vez do 503 que a
// mesma precondição já ganhava em handleSimulateFixedIncome).
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
// nesse título (zero value se ainda não existe — primeira compra). Ativo
// sandbox (RF12, tarefa 4.11) tem AnnualRatePct sobrescrito pela taxa
// contratada do dia (sandbox.RateScript, indexado pelo ticker — não dá pra
// indexar por assetID em tempo de compilação, gerado pelo Postgres — e pelo
// dia decorrido desde a primeira operação do usuário nesse título, dia 0 se
// ele ainda não tinha posição nenhuma); maturity_date/minimum_investment
// continuam vindo do catálogo mesmo pra sandbox — só a grandeza simulada
// (taxa) é que troca de fonte, mesmo raciocínio de
// OrderExecutionRepository.referencePrice.
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
	today, err := loadSimulatedDay(ctx, r.db)
	if err != nil {
		return fixedincomeexecution.PurchaseContext{}, err
	}
	pctx.SimulatedDay = today

	var ticker string
	var isSandbox bool
	var productType string
	if err := r.db.QueryRowContext(ctx,
		`SELECT fia.interest_rate, fia.maturity_date, fia.minimum_investment, a.ticker, a.is_sandbox, a.type
		 FROM fixed_income_assets fia JOIN assets a ON a.id = fia.asset_id
		 WHERE fia.asset_id = $1`, assetID,
	).Scan(&pctx.AnnualRatePct, &pctx.MaturityDate, &pctx.MinimumInvestment, &ticker, &isSandbox, &productType); err != nil {
		return fixedincomeexecution.PurchaseContext{}, err
	}
	pctx.ProductType = fixedincome.ProductType(productType)

	var pos fixedincomeposition.Position
	var positionCreatedDay sql.NullInt64
	err = r.db.QueryRowContext(ctx,
		`SELECT quantity, average_price, average_rate, created_day FROM fixed_income_positions WHERE user_id = $1 AND asset_id = $2`,
		userID, assetID,
	).Scan(&pos.Quantity, &pos.AveragePrice, &pos.AverageRate, &positionCreatedDay)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return fixedincomeexecution.PurchaseContext{}, err
	}
	pctx.CurrentPosition = pos
	pctx.IsSandbox = isSandbox

	if isSandbox {
		script, ok := sandbox.RateScriptForTicker(ticker)
		if !ok {
			return fixedincomeexecution.PurchaseContext{}, ErrSandboxScriptNotFound
		}
		pctx.AnnualRatePct = sandbox.RateOnDay(script, sandboxDayIndex(positionCreatedDay, pos.Quantity, today))
		return pctx, nil
	}

	// Selic/IPCA (tarefa L.4) só são lidas pra Prefixado/IPCA+ — pós-fixado
	// não soma nenhum benchmark (AnnualRatePct já é "% do CDI", L.1) e não
	// paga o custo/dependência de market_calendar/market_indicator_history
	// à toa (mesmo raciocínio de OrderExecutionRepository.floatCeiling só
	// rodar a segunda query quando a primeira não é nula).
	if fixedincome.IsPrefixado(pctx.ProductType) || fixedincome.IsIPCAMais(pctx.ProductType) {
		selic, ok, err := currentSelicRatePct(ctx, r.db)
		if err != nil {
			return fixedincomeexecution.PurchaseContext{}, err
		}
		if !ok {
			return fixedincomeexecution.PurchaseContext{}, fixedincomeexecution.ErrMarketNotInitialized
		}
		pctx.CurrentMarketRatePct = selic

		if fixedincome.IsIPCAMais(pctx.ProductType) {
			accumulated, ok, err := currentIPCAAccumulated12m(ctx, r.db)
			if err != nil {
				return fixedincomeexecution.PurchaseContext{}, err
			}
			if !ok {
				return fixedincomeexecution.PurchaseContext{}, fixedincomeexecution.ErrMarketNotInitialized
			}
			pctx.IPCAAccumulated12m = accumulated
		}
	}

	return pctx, nil
}

// LoadRedeemContext lê a posição do usuário no título (ErrPositionNotFound
// se não existir), o vencimento do título e a taxa de mercado corrente pra
// marcação a mercado (ver nota 3 do doc de fixedincomeexecution). Ativo
// sandbox (RF12, tarefa 4.11) usa sandbox.RateScript (mesmo roteiro lido na
// compra — RateScript serve tanto de taxa contratada quanto de taxa de
// mercado, ver doc do pacote sandbox) no dia decorrido desde a primeira
// operação do usuário (fixed_income_positions.created_day — sempre existe
// aqui, a posição já foi encontrada acima), nunca market_calendar.selic_rate
// — o Temporizador nunca avança nada de sandbox. AnnualRatePct/IsSandbox
// (achado 011, teste de ponta a ponta da Fase L) alimentam a correção do
// spread em Redeem — ver nota do campo em RedeemContext.
func (r *FixedIncomeExecutionRepository) LoadRedeemContext(ctx context.Context, userID, assetID string) (fixedincomeexecution.RedeemContext, error) {
	var rctx fixedincomeexecution.RedeemContext
	var positionCreatedDay int
	err := r.db.QueryRowContext(ctx,
		`SELECT quantity, average_price, average_rate, created_day FROM fixed_income_positions WHERE user_id = $1 AND asset_id = $2`,
		userID, assetID,
	).Scan(&rctx.Position.Quantity, &rctx.Position.AveragePrice, &rctx.Position.AverageRate, &positionCreatedDay)
	if errors.Is(err, sql.ErrNoRows) {
		return fixedincomeexecution.RedeemContext{}, fixedincomeexecution.ErrPositionNotFound
	}
	if err != nil {
		return fixedincomeexecution.RedeemContext{}, err
	}

	rctx.PurchasedAt = simcalendar.DateOf(positionCreatedDay)
	today, err := loadSimulatedDay(ctx, r.db)
	if err != nil {
		return fixedincomeexecution.RedeemContext{}, err
	}
	rctx.SimulatedDay = today

	var ticker string
	var isSandbox bool
	var productType string
	if err := r.db.QueryRowContext(ctx,
		`SELECT fia.interest_rate, fia.maturity_date, fia.tax_exempt, a.ticker, a.is_sandbox, a.type
		 FROM fixed_income_assets fia JOIN assets a ON a.id = fia.asset_id
		 WHERE fia.asset_id = $1`, assetID,
	).Scan(&rctx.AnnualRatePct, &rctx.MaturityDate, &rctx.TaxExempt, &ticker, &isSandbox, &productType); err != nil {
		return fixedincomeexecution.RedeemContext{}, err
	}
	rctx.ProductType = fixedincome.ProductType(productType)
	rctx.IsSandbox = isSandbox

	if isSandbox {
		script, ok := sandbox.RateScriptForTicker(ticker)
		if !ok {
			return fixedincomeexecution.RedeemContext{}, ErrSandboxScriptNotFound
		}
		dayIndex := sandbox.DaysSince(positionCreatedDay, today)
		rctx.CurrentMarketRatePct = sandbox.RateOnDay(script, dayIndex)
		return rctx, nil
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT selic_rate FROM market_calendar WHERE id = 1`,
	).Scan(&rctx.CurrentMarketRatePct); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fixedincomeexecution.RedeemContext{}, fixedincomeexecution.ErrMarketNotInitialized
		}
		return fixedincomeexecution.RedeemContext{}, err
	}

	// SelicRatesSincePurchase (gap remanescente fechado no teste de ponta a
	// ponta da Fase L, nota 3.1 do doc do pacote fixedincomeexecution) só é
	// lida pro pós-fixado — a série real de Selic desde a compra é o que
	// fixedincome.PostFixedValue usa pra valorizar de verdade, em vez de
	// repetir só a Selic corrente.
	if fixedincome.IsPostFixado(rctx.ProductType) {
		rates, err := selicRatesSince(ctx, r.db, positionCreatedDay)
		if err != nil {
			return fixedincomeexecution.RedeemContext{}, err
		}
		rctx.SelicRatesSincePurchase = rates
	}

	// IPCAAccumulated12m (tarefa L.4) só é lida pro Tesouro IPCA+ — é o
	// único tipo cuja marcação a mercado precisa converter
	// CurrentMarketRatePct (Selic nominal) numa taxa real via
	// fixedincome.FisherRealRate antes de comparar com a taxa contratada.
	if fixedincome.IsIPCAMais(rctx.ProductType) {
		accumulated, ok, err := currentIPCAAccumulated12m(ctx, r.db)
		if err != nil {
			return fixedincomeexecution.RedeemContext{}, err
		}
		if !ok {
			return fixedincomeexecution.RedeemContext{}, fixedincomeexecution.ErrMarketNotInitialized
		}
		rctx.IPCAAccumulated12m = accumulated
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
		`INSERT INTO fixed_income_positions (user_id, asset_id, quantity, average_price, average_rate, created_day)
		 VALUES ($1, $2, $3, $4, $5, COALESCE((SELECT current_day FROM market_calendar WHERE id = 1), 0))
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
// precedente do lado de venda em order_execution_repository.go — e
// incrementando total_disinvested, tarefa T.1, simétrico ao que
// applyFillSide já faz na venda de renda variável) e remove a
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
		`UPDATE accounts SET current_balance = current_balance + $1, total_disinvested = total_disinvested + $1, updated_at = now() WHERE user_id = $2`,
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
