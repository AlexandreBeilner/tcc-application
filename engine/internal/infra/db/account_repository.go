package db

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/domain/position"
	"tcc-investimentos/engine/internal/infra/eventstore"
)

const pqUniqueViolation = "23505"

// AccountRepository implementa account.Repository (escrita) contra o banco
// "market" — desde a tarefa 4.7, também lê estado de usuário
// (accounts/positions/fixed_income_positions/market_events) pras rotas de
// leitura injetadas em New como userMarketDataReader, mesma convenção de
// CatalogRepository servir mais de uma interface pequena de leitura.
type AccountRepository struct {
	db *sql.DB
}

func NewAccountRepository(db *sql.DB) *AccountRepository {
	return &AccountRepository{db: db}
}

// Create grava o evento imutável ('initial_deposit' pra conta humana,
// 'bot_initial_cash' pra conta de bot — migration 000014, achado do review
// do PR #24: reaproveitar 'initial_deposit' pro caixa de bot confundiria
// qualquer leitura futura do extrato que assumisse esse tipo como sempre
// os R$ 10.000,00 fixos de RNF06) via eventstore.AppendTx e só depois
// projeta a linha em accounts, na mesma transação — ver regra de Event
// Sourcing no CLAUDE.md e tarefa 2.1. A FK de market_events.user_id pra
// accounts(user_id) é DEFERRABLE INITIALLY DEFERRED (migration 000002)
// justamente pra permitir essa ordem: o evento é gravado primeiro, e só é
// checado contra a linha de accounts no commit.
func (r *AccountRepository) Create(ctx context.Context, acc account.Account) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	eventType := domain.EventInitialDeposit
	if acc.IsBot {
		eventType = domain.EventBotInitialCash
	}
	event := domain.MarketEvent{
		UserID:    acc.UserID,
		EventType: eventType,
		UnitValue: &acc.CurrentBalance,
	}
	if err := eventstore.AppendTx(ctx, tx, event); err != nil {
		return mapAccountError(err)
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO accounts (user_id, current_balance, total_invested, total_disinvested, total_dividends_received, is_bot, is_active)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		acc.UserID, acc.CurrentBalance, acc.TotalInvested, acc.TotalDisinvested, acc.TotalDividendsReceived, acc.IsBot, acc.IsActive,
	); err != nil {
		return mapAccountError(err)
	}

	return tx.Commit()
}

// FindByUserID devolve a conta de userID, se existir — usado por GET
// /accounts/:user_id (tarefa 4.7).
func (r *AccountRepository) FindByUserID(ctx context.Context, userID string) (account.Account, bool, error) {
	var acc account.Account
	err := r.db.QueryRowContext(ctx,
		`SELECT user_id, current_balance, total_invested, total_disinvested, total_dividends_received, is_bot, is_active
		 FROM accounts WHERE user_id = $1`, userID,
	).Scan(&acc.UserID, &acc.CurrentBalance, &acc.TotalInvested, &acc.TotalDisinvested, &acc.TotalDividendsReceived, &acc.IsBot, &acc.IsActive)
	if errors.Is(err, sql.ErrNoRows) {
		return account.Account{}, false, nil
	}
	if err != nil {
		return account.Account{}, false, err
	}
	return acc, true, nil
}

// ListPositionsByUser devolve as posições de renda variável de userID, já
// enriquecidas com ticker/nome/tipo do ativo via join com assets — usado
// por GET /positions (tarefa 4.7). Lista vazia (não erro) se o usuário não
// tem posição nenhuma. dividends_received (tarefa S.15) vem de um LEFT JOIN
// contra a soma de quantity*unit_value dos eventos dividend_payment desse
// usuário por ativo — COALESCE pra 0 em vez de NULL num ativo sem provento
// nenhum, mesma convenção de campo numérico sempre presente de
// quantity/average_price.
func (r *AccountRepository) ListPositionsByUser(ctx context.Context, userID string) ([]position.Record, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT p.asset_id, a.ticker, a.name, a.type, a.is_sandbox, p.quantity, p.average_price,
		        COALESCE(d.dividends_received, 0)
		 FROM positions p
		 JOIN assets a ON a.id = p.asset_id
		 LEFT JOIN (
		     SELECT asset_id, SUM(quantity * unit_value) AS dividends_received
		     FROM market_events
		     WHERE user_id = $1 AND event_type = 'dividend_payment'
		     GROUP BY asset_id
		 ) d ON d.asset_id = p.asset_id
		 WHERE p.user_id = $1
		 ORDER BY a.ticker`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	records := make([]position.Record, 0)
	for rows.Next() {
		var rec position.Record
		if err := rows.Scan(
			&rec.AssetID, &rec.AssetTicker, &rec.AssetName, &rec.AssetType, &rec.IsSandbox,
			&rec.Quantity, &rec.AveragePrice, &rec.DividendsReceived,
		); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

// ListFixedIncomePositionsByUser devolve as posições de renda fixa de
// userID, mesmo padrão de ListPositionsByUser — usado por GET
// /fixed-income/positions (tarefa 4.7), incluindo average_rate.
func (r *AccountRepository) ListFixedIncomePositionsByUser(ctx context.Context, userID string) ([]fixedincomeposition.Record, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT p.asset_id, a.ticker, a.name, a.type, a.is_sandbox, p.quantity, p.average_price, p.average_rate
		 FROM fixed_income_positions p
		 JOIN assets a ON a.id = p.asset_id
		 WHERE p.user_id = $1
		 ORDER BY a.ticker`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	records := make([]fixedincomeposition.Record, 0)
	for rows.Next() {
		var rec fixedincomeposition.Record
		if err := rows.Scan(&rec.AssetID, &rec.AssetTicker, &rec.AssetName, &rec.AssetType, &rec.IsSandbox, &rec.Quantity, &rec.AveragePrice, &rec.AverageRate); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}

// ListMarketEventsByUser devolve o extrato de userID (market_events),
// cronológico reverso e paginado — usado por GET /accounts/:user_id/events
// (tarefa 4.7, RF05). Lista vazia (não erro) se o usuário não tem evento
// nenhum.
func (r *AccountRepository) ListMarketEventsByUser(ctx context.Context, userID string, limit, offset int) ([]domain.MarketEventRecord, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, asset_id, event_type, quantity, unit_value, "timestamp"
		 FROM market_events
		 WHERE user_id = $1
		 ORDER BY "timestamp" DESC, id DESC
		 LIMIT $2 OFFSET $3`, userID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	records := make([]domain.MarketEventRecord, 0)
	for rows.Next() {
		var rec domain.MarketEventRecord
		var eventType string
		if err := rows.Scan(&rec.ID, &rec.AssetID, &eventType, &rec.Quantity, &rec.UnitValue, &rec.Timestamp); err != nil {
			return nil, err
		}
		rec.UserID = userID
		rec.EventType = domain.MarketEventType(eventType)
		records = append(records, rec)
	}
	return records, rows.Err()
}

// SumHumanHoldings soma quantity de positions cujo dono não é bot
// (accounts.is_bot = false) num ativo — tarefa B.2 usa isso pra saber
// quanto do float (outstanding_shares) ainda está livre pra distribuir
// entre bots no seed: parte pode já pertencer a um usuário real de antes do
// redesenho de bots (ordem executada pela antiga liquidez sintética,
// revertida na tarefa A.2, num banco de desenvolvimento que já vinha sendo
// usado) — devolver 100% do float pros bots nesse caso estouraria o teto
// (position.ValidateFloatCeiling, tarefa A.3). Devolve 0 (não erro) se
// ninguém detém o ativo ainda.
func (r *AccountRepository) SumHumanHoldings(ctx context.Context, assetID string) (int64, error) {
	var sum sql.NullInt64
	err := r.db.QueryRowContext(ctx,
		`SELECT SUM(p.quantity) FROM positions p
		 JOIN accounts a ON a.user_id = p.user_id
		 WHERE p.asset_id = $1 AND NOT a.is_bot`,
		assetID,
	).Scan(&sum)
	if err != nil {
		return 0, err
	}
	return sum.Int64, nil
}

// SeedInitialHolding grava a posição inicial de um bot de liquidez num
// ativo (tarefa B.2, bot.InitialAllocation/bot.InitialCash — B.1). O INSERT
// usa ON CONFLICT (user_id, asset_id) DO NOTHING (mesma unique constraint de
// applyPositionFill, order_execution_repository.go) em vez de um SELECT
// EXISTS separado seguido de INSERT: o EXISTS + INSERT em duas instruções
// deixava uma janela de corrida onde duas execuções concorrentes do seed
// podiam ambas ver "não existe" e uma delas estourar violação de
// constraint; o INSERT atômico decide via RowsAffected, sem essa janela.
// Evento (EventBotInitialAllocation) e validação de teto só acontecem
// quando o INSERT realmente cria a linha (RowsAffected = 1) — a mesma
// transação garante atomicidade entre projeção e evento imutável (Event
// Sourcing, CLAUDE.md) mesmo com o INSERT vindo primeiro. outstandingShares
// é o teto do ativo (tarefa A.3): depois do INSERT, valida que a soma de
// todas as posições (todos os detentores) ainda respeita
// position.ValidateFloatCeiling, e desfaz a transação inteira (incluindo o
// INSERT) se não respeitar — defesa equivalente à que orderexecution.Execute
// já faz antes de cada negociação, aqui depois porque o "antes" desta
// função é o próprio INSERT que decide se há algo nulo a validar.
// Idempotente: se o bot já tem posição nesse ativo (reexecução do seed),
// não grava evento nem valida teto de novo, devolve created = false.
func (r *AccountRepository) SeedInitialHolding(ctx context.Context, userID, assetID string, quantity int, price float64, outstandingShares int64) (created bool, err error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback() }()

	initial := position.ApplyBuy(position.Position{}, quantity, price)
	result, err := tx.ExecContext(ctx,
		`INSERT INTO positions (user_id, asset_id, quantity, average_price)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, asset_id) DO NOTHING`,
		userID, assetID, initial.Quantity, initial.AveragePrice,
	)
	if err != nil {
		return false, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	if rowsAffected == 0 {
		return false, nil
	}

	var totalHeld sql.NullInt64
	if err := tx.QueryRowContext(ctx,
		`SELECT SUM(quantity) FROM positions WHERE asset_id = $1`, assetID,
	).Scan(&totalHeld); err != nil {
		return false, err
	}
	if err := position.ValidateFloatCeiling(totalHeld.Int64, outstandingShares); err != nil {
		return false, err
	}

	if err := eventstore.AppendTx(ctx, tx, domain.MarketEvent{
		UserID:    userID,
		AssetID:   &assetID,
		EventType: domain.EventBotInitialAllocation,
		Quantity:  &quantity,
		UnitValue: &price,
	}); err != nil {
		return false, err
	}

	if err := tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}

func mapAccountError(err error) error {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) && pqErr.Code == pqUniqueViolation {
		return account.ErrAlreadyExists
	}
	return err
}
