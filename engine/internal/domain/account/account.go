// Package account contém a regra de capital inicial padronizado (RNF06):
// toda conta nova nasce com o mesmo saldo simulado, no mercado ao vivo.
package account

import (
	"context"
	"errors"
)

// InitialBalance é o capital inicial de toda conta nova, no mercado ao vivo
// — fixado como premissa (spec 3.5), não configurável (CLAUDE.md).
const InitialBalance = 10000.00

// ErrAlreadyExists é retornado quando já existe uma conta pra esse usuário.
var ErrAlreadyExists = errors.New("conta já existe para este usuário")

type Account struct {
	UserID                 string
	CurrentBalance         float64
	TotalInvested          float64
	TotalDividendsReceived float64
}

// New monta uma conta nova com o capital inicial padronizado — é o único
// lugar que decide esse valor; Repository só persiste o que New produziu.
func New(userID string) Account {
	return Account{UserID: userID, CurrentBalance: InitialBalance}
}

// Repository persiste a criação de uma conta nova. A implementação
// concreta (internal/infra/db) grava o evento imutável correspondente em
// market_events na mesma transação que projeta a linha em accounts — ver
// regra de Event Sourcing no CLAUDE.md.
type Repository interface {
	Create(ctx context.Context, acc Account) error
}

// Service abre contas novas sempre com o capital inicial padronizado.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Open(ctx context.Context, userID string) (Account, error) {
	acc := New(userID)
	if err := s.repo.Create(ctx, acc); err != nil {
		return Account{}, err
	}
	return acc, nil
}
