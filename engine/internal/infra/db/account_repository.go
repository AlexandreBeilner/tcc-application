package db

import (
	"context"
	"database/sql"
	"errors"

	"github.com/lib/pq"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/infra/eventstore"
)

const pqUniqueViolation = "23505"

// AccountRepository implementa account.Repository contra o banco "market".
type AccountRepository struct {
	db *sql.DB
}

func NewAccountRepository(db *sql.DB) *AccountRepository {
	return &AccountRepository{db: db}
}

// Create grava o evento imutável ('initial_deposit') via eventstore.AppendTx
// e só depois projeta a linha em accounts, na mesma transação — ver regra
// de Event Sourcing no CLAUDE.md e tarefa 2.1. A FK de market_events.user_id
// pra accounts(user_id) é DEFERRABLE INITIALLY DEFERRED (migration 000002)
// justamente pra permitir essa ordem: o evento é gravado primeiro, e só é
// checado contra a linha de accounts no commit.
func (r *AccountRepository) Create(ctx context.Context, acc account.Account) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	event := domain.MarketEvent{
		UserID:    acc.UserID,
		EventType: domain.EventInitialDeposit,
		UnitValue: &acc.CurrentBalance,
	}
	if err := eventstore.AppendTx(ctx, tx, event); err != nil {
		return mapAccountError(err)
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO accounts (user_id, current_balance, total_invested, total_dividends_received)
		 VALUES ($1, $2, $3, $4)`,
		acc.UserID, acc.CurrentBalance, acc.TotalInvested, acc.TotalDividendsReceived,
	); err != nil {
		return mapAccountError(err)
	}

	return tx.Commit()
}

func mapAccountError(err error) error {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) && pqErr.Code == pqUniqueViolation {
		return account.ErrAlreadyExists
	}
	return err
}
