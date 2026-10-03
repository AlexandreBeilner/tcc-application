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

// scopeAccumulator classifica e acumula linhas de bot_personality_scopes —
// exatamente uma das três colunas (sector/risk_class/asset_class) é
// preenchida por linha (CreatePersonality nunca grava mais de uma por
// INSERT). Reaproveitado por FindPersonalityByAccountID (uma conta, uma
// instância) e ListEligibleForTradingRound (N contas, uma instância por
// account_id) pra não duplicar essa classificação em dois lugares.
type scopeAccumulator struct {
	sectors      []catalog.Sector
	riskClasses  []equity.RiskClass
	assetClasses []catalog.AssetType
}

func (a *scopeAccumulator) add(sector, riskClass, assetClass sql.NullString) {
	switch {
	case sector.Valid:
		a.sectors = append(a.sectors, catalog.Sector(sector.String))
	case riskClass.Valid:
		a.riskClasses = append(a.riskClasses, equity.RiskClass(riskClass.String))
	case assetClass.Valid:
		a.assetClasses = append(a.assetClasses, catalog.AssetType(assetClass.String))
	}
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

	if err := createPersonalityTx(ctx, tx, accountID, personality); err != nil {
		return err
	}
	return tx.Commit()
}

// createPersonalityTx grava a personalidade dentro de uma transação já aberta —
// reaproveitado por CreatePersonality e por BotAdminRepository.CreateBot (N.1),
// que cria conta e personalidade na mesma transação.
func createPersonalityTx(ctx context.Context, tx *sql.Tx, accountID string, personality bot.Personality) error {
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO bot_personalities
			(account_id, archetype, within_scope_pct, knowledge_level, max_position_size_pct, market_order_preference, spread_width_pct, max_covered_assets)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		accountID, string(personality.Archetype), personality.Scope.WithinScopePct, personality.KnowledgeLevel,
		personality.RiskProfile.MaxPositionSizePct, personality.RiskProfile.MarketOrderPreference, personality.RiskProfile.SpreadWidthPct,
		personality.MaxCoveredAssets,
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
	return nil
}

// withStoredMaxCoveredAssets aplica o teto persistido (P.1) sobre a
// personalidade reconstruída; coluna nula significa "sem teto próprio" e
// mantém o que NewPersonality definiu.
func withStoredMaxCoveredAssets(personality bot.Personality, stored sql.NullInt64) (bot.Personality, error) {
	if !stored.Valid {
		return personality, nil
	}
	return personality.WithMaxCoveredAssets(int(stored.Int64))
}

// personalityFromRow reconstrói a Personality de uma linha de bot_personalities
// (mais o escopo acumulado) pelos construtores de domínio, nunca por struct
// literal: uma linha corrompida não produz uma Personality que viole os
// invariantes (C.1). Compartilhado por Find, ListEligibleForTradingRound e pela
// listagem do painel (N.1).
func personalityFromRow(archetype string, withinScopePct float64, knowledgeLevel sql.NullFloat64, maxPositionSizePct, marketOrderPreference, spreadWidthPct float64, maxCoveredAssets sql.NullInt64, acc *scopeAccumulator) (bot.Personality, error) {
	if acc == nil {
		acc = &scopeAccumulator{}
	}
	scope, err := bot.NewSpecializationScope(acc.sectors, acc.riskClasses, acc.assetClasses, withinScopePct)
	if err != nil {
		return bot.Personality{}, err
	}
	riskProfile, err := bot.NewRiskProfile(maxPositionSizePct, marketOrderPreference, spreadWidthPct)
	if err != nil {
		return bot.Personality{}, err
	}
	var knowledgeLevelPtr *float64
	if knowledgeLevel.Valid {
		knowledgeLevelPtr = &knowledgeLevel.Float64
	}
	personality, err := bot.NewPersonality(bot.Archetype(archetype), scope, knowledgeLevelPtr, riskProfile)
	if err != nil {
		return bot.Personality{}, err
	}
	return withStoredMaxCoveredAssets(personality, maxCoveredAssets)
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
	var maxCoveredAssets sql.NullInt64

	err := r.db.QueryRowContext(ctx,
		`SELECT archetype, within_scope_pct, knowledge_level, max_position_size_pct, market_order_preference, spread_width_pct, max_covered_assets
		 FROM bot_personalities WHERE account_id = $1`, accountID,
	).Scan(&archetype, &withinScopePct, &knowledgeLevel, &maxPositionSizePct, &marketOrderPreference, &spreadWidthPct, &maxCoveredAssets)
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

	var acc scopeAccumulator
	for rows.Next() {
		var sector, riskClass, assetClass sql.NullString
		if err := rows.Scan(&sector, &riskClass, &assetClass); err != nil {
			return bot.Personality{}, false, err
		}
		acc.add(sector, riskClass, assetClass)
	}
	if err := rows.Err(); err != nil {
		return bot.Personality{}, false, err
	}

	personality, err := personalityFromRow(archetype, withinScopePct, knowledgeLevel, maxPositionSizePct, marketOrderPreference, spreadWidthPct, maxCoveredAssets, &acc)
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
		        bp.max_position_size_pct, bp.market_order_preference, bp.spread_width_pct, bp.max_covered_assets
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
		maxCoveredAssets                                                          sql.NullInt64
	}

	var eligible []rawBot
	for rows.Next() {
		var raw rawBot
		var isBot, isActive bool
		if err := rows.Scan(
			&raw.userID, &isBot, &isActive,
			&raw.archetype, &raw.withinScopePct, &raw.knowledgeLevel,
			&raw.maxPositionSizePct, &raw.marketOrderPreference, &raw.spreadWidthPct, &raw.maxCoveredAssets,
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

	scopesByAccount := make(map[string]*scopeAccumulator)
	for scopeRows.Next() {
		var accountID string
		var sector, riskClass, assetClass sql.NullString
		if err := scopeRows.Scan(&accountID, &sector, &riskClass, &assetClass); err != nil {
			return nil, err
		}
		acc, ok := scopesByAccount[accountID]
		if !ok {
			acc = &scopeAccumulator{}
			scopesByAccount[accountID] = acc
		}
		acc.add(sector, riskClass, assetClass)
	}
	if err := scopeRows.Err(); err != nil {
		return nil, err
	}

	coveredByAccount, err := r.listCoveredAssetIDs(ctx, userIDs)
	if err != nil {
		return nil, err
	}

	roster := make([]tick.BotForRound, 0, len(eligible))
	for _, raw := range eligible {
		personality, err := personalityFromRow(raw.archetype, raw.withinScopePct, raw.knowledgeLevel, raw.maxPositionSizePct, raw.marketOrderPreference, raw.spreadWidthPct, raw.maxCoveredAssets, scopesByAccount[raw.userID])
		if err != nil {
			return nil, err
		}
		roster = append(roster, tick.BotForRound{UserID: raw.userID, Personality: personality, CoveredAssetIDs: coveredByAccount[raw.userID]})
	}
	return roster, nil
}

// listCoveredAssetIDs devolve, por conta de Market Maker, os ativos que ela
// cobre (market_maker_coverage, P.1), ordenados por ID, numa consulta só
// pra todo o roster. Conta sem cobertura (ou que não é Market Maker) não
// aparece no mapa.
func (r *BotRepository) listCoveredAssetIDs(ctx context.Context, accountIDs []string) (map[string][]string, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT mm_account_id, asset_id FROM market_maker_coverage WHERE mm_account_id = ANY($1) ORDER BY mm_account_id, asset_id`,
		pq.Array(accountIDs),
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	covered := make(map[string][]string)
	for rows.Next() {
		var accountID, assetID string
		if err := rows.Scan(&accountID, &assetID); err != nil {
			return nil, err
		}
		covered[accountID] = append(covered[accountID], assetID)
	}
	return covered, rows.Err()
}
