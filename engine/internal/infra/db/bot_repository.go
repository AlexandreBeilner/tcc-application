package db

import (
	"context"
	"database/sql"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/tick"
)

// BotRepository persiste bot.Personality (tarefa C.6) — catálogo/config de
// bot, não estado financeiro (Event Sourcing/CLAUDE.md não se aplica aqui,
// mesmo raciocínio de CatalogRepository pra assets/companies).
type BotRepository struct {
	db *sql.DB
}

func NewBotRepository(db *sql.DB) *BotRepository {
	return &BotRepository{db: db}
}

// CreatePersonality persiste personality pra accountID: uma linha em
// bot_personalities mais uma linha em bot_personality_scopes por item de
// personality.Scope (Sectors/RiskClasses/AssetClasses), tudo na mesma
// transação — mesmo padrão de CatalogRepository.CreateETFDetails
// (details + holdings).
func (r *BotRepository) CreatePersonality(ctx context.Context, accountID string, personality bot.Personality) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO bot_personalities
			(account_id, archetype, within_scope_pct, knowledge_level, max_position_size_pct, market_order_preference, spread_width_pct)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		accountID, string(personality.Archetype), personality.Scope.WithinScopePct, personality.KnowledgeLevel,
		personality.RiskProfile.MaxPositionSizePct, personality.RiskProfile.MarketOrderPreference, personality.RiskProfile.SpreadWidthPct,
	); err != nil {
		return err
	}

	for _, sector := range personality.Scope.Sectors {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO bot_personality_scopes (account_id, sector) VALUES ($1, $2)`, accountID, string(sector),
		); err != nil {
			return err
		}
	}
	for _, riskClass := range personality.Scope.RiskClasses {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO bot_personality_scopes (account_id, risk_class) VALUES ($1, $2)`, accountID, string(riskClass),
		); err != nil {
			return err
		}
	}
	for _, assetClass := range personality.Scope.AssetClasses {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO bot_personality_scopes (account_id, asset_class) VALUES ($1, $2)`, accountID, string(assetClass),
		); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// FindPersonalityByAccountID devolve a personalidade de accountID, se já
// persistida — reconstruída via bot.NewSpecializationScope/NewRiskProfile/
// NewPersonality (não um struct literal direto) pra nunca devolver uma
// Personality que viole os próprios invariantes do domínio (C.1) mesmo se
// o dado em banco estiver corrompido de alguma forma.
func (r *BotRepository) FindPersonalityByAccountID(ctx context.Context, accountID string) (bot.Personality, bool, error) {
	var archetype string
	var withinScopePct float64
	var knowledgeLevel sql.NullFloat64
	var maxPositionSizePct, marketOrderPreference, spreadWidthPct float64

	err := r.db.QueryRowContext(ctx,
		`SELECT archetype, within_scope_pct, knowledge_level, max_position_size_pct, market_order_preference, spread_width_pct
		 FROM bot_personalities WHERE account_id = $1`, accountID,
	).Scan(&archetype, &withinScopePct, &knowledgeLevel, &maxPositionSizePct, &marketOrderPreference, &spreadWidthPct)
	if err == sql.ErrNoRows {
		return bot.Personality{}, false, nil
	}
	if err != nil {
		return bot.Personality{}, false, err
	}

	rows, err := r.db.QueryContext(ctx,
		`SELECT sector, risk_class, asset_class FROM bot_personality_scopes WHERE account_id = $1`, accountID,
	)
	if err != nil {
		return bot.Personality{}, false, err
	}
	defer func() { _ = rows.Close() }()

	var sectors []catalog.Sector
	var riskClasses []equity.RiskClass
	var assetClasses []catalog.AssetType
	for rows.Next() {
		var sector, riskClass, assetClass sql.NullString
		if err := rows.Scan(&sector, &riskClass, &assetClass); err != nil {
			return bot.Personality{}, false, err
		}
		switch {
		case sector.Valid:
			sectors = append(sectors, catalog.Sector(sector.String))
		case riskClass.Valid:
			riskClasses = append(riskClasses, equity.RiskClass(riskClass.String))
		case assetClass.Valid:
			assetClasses = append(assetClasses, catalog.AssetType(assetClass.String))
		}
	}
	if err := rows.Err(); err != nil {
		return bot.Personality{}, false, err
	}

	scope, err := bot.NewSpecializationScope(sectors, riskClasses, assetClasses, withinScopePct)
	if err != nil {
		return bot.Personality{}, false, err
	}
	riskProfile, err := bot.NewRiskProfile(maxPositionSizePct, marketOrderPreference, spreadWidthPct)
	if err != nil {
		return bot.Personality{}, false, err
	}
	var knowledgeLevelPtr *float64
	if knowledgeLevel.Valid {
		knowledgeLevelPtr = &knowledgeLevel.Float64
	}

	personality, err := bot.NewPersonality(bot.Archetype(archetype), scope, knowledgeLevelPtr, riskProfile)
	if err != nil {
		return bot.Personality{}, false, err
	}
	return personality, true, nil
}

// ListEligibleForTradingRound implementa tick.BotRoster (Fase D.2) — todo
// bot com personalidade persistida (o JOIN com bot_personalities já restringe
// a is_bot = true, já que só CreatePersonality grava essa tabela, sempre pra
// uma conta de bot), filtrado por account.EligibleForTradingRound (IsBot &&
// IsActive, tarefa A.4) em vez de repetir "is_bot AND is_active" cru em SQL —
// reaproveita o mesmo predicado de domínio que A.4 construiu pra este uso
// exato, em vez de duas fontes de verdade pra "quem é elegível". Ordem não
// importa aqui (runIntradayRounds, tick/rounds.go, ordena por UserID antes de
// usar, pro determinismo da rodada).
func (r *BotRepository) ListEligibleForTradingRound(ctx context.Context) ([]tick.BotForRound, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.user_id, a.is_bot, a.is_active,
		        bp.archetype, bp.within_scope_pct, bp.knowledge_level,
		        bp.max_position_size_pct, bp.market_order_preference, bp.spread_width_pct
		 FROM accounts a
		 JOIN bot_personalities bp ON bp.account_id = a.user_id`,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	type rawBot struct {
		userID                                                                    string
		archetype                                                                 string
		withinScopePct, maxPositionSizePct, marketOrderPreference, spreadWidthPct float64
		knowledgeLevel                                                            sql.NullFloat64
	}

	var eligible []rawBot
	for rows.Next() {
		var raw rawBot
		var isBot, isActive bool
		if err := rows.Scan(
			&raw.userID, &isBot, &isActive,
			&raw.archetype, &raw.withinScopePct, &raw.knowledgeLevel,
			&raw.maxPositionSizePct, &raw.marketOrderPreference, &raw.spreadWidthPct,
		); err != nil {
			return nil, err
		}
		if !(account.Account{IsBot: isBot, IsActive: isActive}).EligibleForTradingRound() {
			continue
		}
		eligible = append(eligible, raw)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(eligible) == 0 {
		return nil, nil
	}

	userIDs := make([]string, len(eligible))
	for i, raw := range eligible {
		userIDs[i] = raw.userID
	}
	scopeRows, err := r.db.QueryContext(ctx,
		`SELECT account_id, sector, risk_class, asset_class FROM bot_personality_scopes WHERE account_id = ANY($1)`,
		pq.Array(userIDs),
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = scopeRows.Close() }()

	sectorsByAccount := make(map[string][]catalog.Sector)
	riskClassesByAccount := make(map[string][]equity.RiskClass)
	assetClassesByAccount := make(map[string][]catalog.AssetType)
	for scopeRows.Next() {
		var accountID string
		var sector, riskClass, assetClass sql.NullString
		if err := scopeRows.Scan(&accountID, &sector, &riskClass, &assetClass); err != nil {
			return nil, err
		}
		switch {
		case sector.Valid:
			sectorsByAccount[accountID] = append(sectorsByAccount[accountID], catalog.Sector(sector.String))
		case riskClass.Valid:
			riskClassesByAccount[accountID] = append(riskClassesByAccount[accountID], equity.RiskClass(riskClass.String))
		case assetClass.Valid:
			assetClassesByAccount[accountID] = append(assetClassesByAccount[accountID], catalog.AssetType(assetClass.String))
		}
	}
	if err := scopeRows.Err(); err != nil {
		return nil, err
	}

	roster := make([]tick.BotForRound, 0, len(eligible))
	for _, raw := range eligible {
		scope, err := bot.NewSpecializationScope(sectorsByAccount[raw.userID], riskClassesByAccount[raw.userID], assetClassesByAccount[raw.userID], raw.withinScopePct)
		if err != nil {
			return nil, err
		}
		riskProfile, err := bot.NewRiskProfile(raw.maxPositionSizePct, raw.marketOrderPreference, raw.spreadWidthPct)
		if err != nil {
			return nil, err
		}
		var knowledgeLevelPtr *float64
		if raw.knowledgeLevel.Valid {
			knowledgeLevelPtr = &raw.knowledgeLevel.Float64
		}
		personality, err := bot.NewPersonality(bot.Archetype(raw.archetype), scope, knowledgeLevelPtr, riskProfile)
		if err != nil {
			return nil, err
		}
		roster = append(roster, tick.BotForRound{UserID: raw.userID, Personality: personality})
	}
	return roster, nil
}
