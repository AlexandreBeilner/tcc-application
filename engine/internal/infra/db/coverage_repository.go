package db

import (
	"context"
	"database/sql"
	"errors"

	"tcc-investimentos/engine/internal/domain/coverage"
)

// CoverageRepository persiste market_maker_coverage (tarefa P.1): quem cota
// qual ativo. Configuração de bot, não estado financeiro, então o Event
// Sourcing não se aplica (mesmo raciocínio de BotRepository).
// Implementa coverage.MarketMakerLister e coverage.Writer.
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

// ErrNotMarketMaker é devolvido por AddCoverage quando a conta não é um bot
// de arquétipo Market Maker (ou não existe): só formador de mercado cobre ativo.
var ErrNotMarketMaker = errors.New("conta não é um Market Maker")

// AddCoverage grava a cobertura de assetID por mmAccountID. Repetir um par já
// gravado não é erro. Conta que não é Market Maker devolve ErrNotMarketMaker.
func (r *CoverageRepository) AddCoverage(ctx context.Context, assetID, mmAccountID string) error {
	var isMarketMaker bool
	if err := r.db.QueryRowContext(ctx,
		`SELECT EXISTS (SELECT 1 FROM bot_personalities WHERE account_id = $1 AND archetype = 'market_maker')`,
		mmAccountID,
	).Scan(&isMarketMaker); err != nil {
		return err
	}
	if !isMarketMaker {
		return ErrNotMarketMaker
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO market_maker_coverage (asset_id, mm_account_id) VALUES ($1, $2)
		 ON CONFLICT (asset_id, mm_account_id) DO NOTHING`,
		assetID, mmAccountID,
	)
	return err
}

var (
	_ coverage.MarketMakerLister = (*CoverageRepository)(nil)
	_ coverage.Writer            = (*CoverageRepository)(nil)
)
