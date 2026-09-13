// Package account contém a regra de capital inicial padronizado (RNF06):
// toda conta nova nasce com o mesmo saldo simulado, no mercado ao vivo.
package account

import (
	"context"
	"errors"
	"fmt"
)

// InitialBalance é o capital inicial de toda conta nova, no mercado ao vivo
// — fixado como premissa (spec 3.5), não configurável (CLAUDE.md).
const InitialBalance = 10000.00

// ErrAlreadyExists é retornado quando já existe uma conta pra esse usuário.
var ErrAlreadyExists = errors.New("conta já existe para este usuário")

// ErrInvalidBotAccount é retornado por NewBot quando userID/saldo inicial
// não formam uma conta de bot válida.
var ErrInvalidBotAccount = errors.New("conta de bot inválida")

type Account struct {
	UserID                 string
	CurrentBalance         float64
	TotalInvested          float64
	TotalDividendsReceived float64
	// IsBot identifica contas de liquidez do motor (proposta
	// motor-mercado-realista 2.3) — mesma tabela/mesmo Event Sourcing de
	// uma conta humana, nunca um caminho de dados paralelo. Deliberadamente
	// sem contrapartida em `users` (banco gamification): é essa ausência
	// que garante, por construção, a exclusão de ranking/social (RF/RNF
	// não mudam, ver migration 000010).
	IsBot bool
}

// New monta uma conta nova com o capital inicial padronizado — é o único
// lugar que decide esse valor; Repository só persiste o que New produziu.
func New(userID string) Account {
	return Account{UserID: userID, CurrentBalance: InitialBalance}
}

// NewBot monta uma conta de bot de liquidez — ao contrário de New, o saldo
// inicial não é o InitialBalance fixo de RNF06 (essa regra é sobre conta de
// usuário real no mercado ao vivo): cada bot recebe caixa correlacionado ao
// papel que exerce (Market Maker vs. direcional — proposta 2.2), calculado
// por quem chama (bot.InitialAllocation, tarefa B.1/B.2), não por esta
// função. userID aqui não precisa corresponder a um usuário real cadastrado
// — só precisa ser único dentro de `accounts` (mesma unicidade de sempre).
func NewBot(userID string, initialBalance float64) (Account, error) {
	if userID == "" {
		return Account{}, fmt.Errorf("%w: userID vazio", ErrInvalidBotAccount)
	}
	if initialBalance < 0 {
		return Account{}, fmt.Errorf("%w: saldo inicial negativo (%.2f)", ErrInvalidBotAccount, initialBalance)
	}
	return Account{UserID: userID, CurrentBalance: initialBalance, IsBot: true}, nil
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
