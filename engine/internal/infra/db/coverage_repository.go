package db

import (
	"context"
	"database/sql"
	"errors"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/coverage"
	"tcc-investimentos/engine/internal/domain/position"
	"tcc-investimentos/engine/internal/infra/eventstore"
)

// CoverageRepository persiste market_maker_coverage (tarefa P.1): quem cota
// qual ativo. Configuração de bot, não estado financeiro, então o Event
// Sourcing não se aplica (mesmo raciocínio de BotRepository).
// Implementa coverage.MarketMakerLister e coverage.Provisioner.
type CoverageRepository struct {
	db *sql.DB
}

func NewCoverageRepository(db *sql.DB) *CoverageRepository {
	return &CoverageRepository{db: db}
}

// ListMarketMakers devolve todo Market Maker persistido (ativo ou não) com o
// teto e os ativos cobertos, em ordem de conta e de ativo para determinismo.
// Uma consulta só, sem N+1 por Market Maker.
func (r *CoverageRepository) ListMarketMakers(ctx context.Context) ([]coverage.MarketMaker, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.user_id, a.is_active, bp.max_covered_assets, mmc.asset_id
		 FROM bot_personalities bp
		 JOIN accounts a ON a.user_id = bp.account_id
		 LEFT JOIN market_maker_coverage mmc ON mmc.mm_account_id = bp.account_id
		 WHERE bp.archetype = 'market_maker'
		 ORDER BY a.user_id, mmc.asset_id`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var result []coverage.MarketMaker
	for rows.Next() {
		var accountID string
		var active bool
		var maxAssets int
		var assetID sql.NullString
		if err := rows.Scan(&accountID, &active, &maxAssets, &assetID); err != nil {
			return nil, err
		}
		if len(result) == 0 || result[len(result)-1].AccountID != accountID {
			result = append(result, coverage.MarketMaker{AccountID: accountID, Active: active, MaxAssets: maxAssets})
		}
		if assetID.Valid {
			last := &result[len(result)-1]
			last.CoveredAssetIDs = append(last.CoveredAssetIDs, assetID.String)
		}
	}
	return result, rows.Err()
}

// ErrNotMarketMaker é devolvido por ProvisionCoverage quando a conta não é um
// bot de arquétipo Market Maker (ou não existe): só formador de mercado cobre
// ativo.
var ErrNotMarketMaker = errors.New("conta não é um Market Maker")

// CreateMarketMaker cria a conta (saldo zero, Event Sourcing via
// AccountRepository.Create) e a personalidade de um Market Maker novo. Cada
// passo só roda se ainda não existe, então retomar depois de uma falha entre
// os dois completa só o que falta (mesma convenção idempotente do seed).
func (r *CoverageRepository) CreateMarketMaker(ctx context.Context, accountID string, personality bot.Personality) error {
	accounts := NewAccountRepository(r.db)
	if _, found, err := accounts.FindByUserID(ctx, accountID); err != nil {
		return err
	} else if !found {
		acc, err := account.NewBot(accountID, 0)
		if err != nil {
			return err
		}
		if err := accounts.Create(ctx, acc); err != nil {
			return err
		}
	}

	bots := NewBotRepository(r.db)
	if _, found, err := bots.FindPersonalityByAccountID(ctx, accountID); err != nil {
		return err
	} else if found {
		return nil
	}
	return bots.CreatePersonality(ctx, accountID, personality)
}

// ProvisionCoverage grava, numa transação só, a cobertura de um ativo por um
// Market Maker, a posição inicial dele e o caixa somado ao saldo. Posição e
// caixa entram por evento imutável antes da projeção (Event Sourcing,
// CLAUDE.md): 'bot_initial_allocation' (mesmo evento de SeedInitialHolding) e
// 'bot_initial_cash' com asset_id preenchido, que aqui significa "caixa somado
// para cobrir este ativo".
//
// Idempotente: par já coberto não grava nada. Se o Market Maker já tem posição
// nesse ativo (banco anterior à cobertura), só a cobertura é gravada, sem
// evento nem saldo. O teto de float do ativo é validado depois de gravar a
// posição, e a transação inteira é desfeita se estourar.
func (r *CoverageRepository) ProvisionCoverage(ctx context.Context, p coverage.Provision) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	var isMarketMaker bool
	if err := tx.QueryRowContext(ctx,
		`SELECT EXISTS (SELECT 1 FROM bot_personalities WHERE account_id = $1 AND archetype = 'market_maker')`,
		p.MMAccountID,
	).Scan(&isMarketMaker); err != nil {
		return err
	}
	if !isMarketMaker {
		return ErrNotMarketMaker
	}

	inserted, err := tx.ExecContext(ctx,
		`INSERT INTO market_maker_coverage (asset_id, mm_account_id) VALUES ($1, $2)
		 ON CONFLICT (asset_id, mm_account_id) DO NOTHING`,
		p.AssetID, p.MMAccountID,
	)
	if err != nil {
		return err
	}
	if n, err := inserted.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		return nil
	}

	if p.Shares > 0 {
		if err := provisionHolding(ctx, tx, p); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// provisionHolding grava posição, eventos e caixa de ProvisionCoverage. Não
// faz nada se o Market Maker já tem posição no ativo.
func provisionHolding(ctx context.Context, tx *sql.Tx, p coverage.Provision) error {
	quantity := int(p.Shares)
	initial := position.ApplyBuy(position.Position{}, quantity, p.Price)
	result, err := tx.ExecContext(ctx,
		`INSERT INTO positions (user_id, asset_id, quantity, average_price)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, asset_id) DO NOTHING`,
		p.MMAccountID, p.AssetID, initial.Quantity, initial.AveragePrice,
	)
	if err != nil {
		return err
	}
	if n, err := result.RowsAffected(); err != nil {
		return err
	} else if n == 0 {
		return nil
	}

	var totalHeld sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT SUM(quantity) FROM positions WHERE asset_id = $1`, p.AssetID).Scan(&totalHeld); err != nil {
		return err
	}
	if err := position.ValidateFloatCeiling(totalHeld.Int64, p.OutstandingShares); err != nil {
		return err
	}

	if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
		UserID:    p.MMAccountID,
		AssetID:   &p.AssetID,
		EventType: domain.EventBotInitialAllocation,
		Quantity:  &quantity,
		UnitValue: &p.Price,
	}); err != nil {
		return err
	}

	if p.Cash > 0 {
		if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
			UserID:    p.MMAccountID,
			AssetID:   &p.AssetID,
			EventType: domain.EventBotInitialCash,
			UnitValue: &p.Cash,
		}); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE accounts SET current_balance = current_balance + $1 WHERE user_id = $2`, p.Cash, p.MMAccountID,
		); err != nil {
			return err
		}
	}
	return nil
}

var (
	_ coverage.MarketMakerLister = (*CoverageRepository)(nil)
	_ coverage.Provisioner       = (*CoverageRepository)(nil)
)
