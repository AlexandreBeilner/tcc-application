// Package account contém a regra de capital inicial padronizado (RNF06):
// toda conta nova nasce com o mesmo saldo simulado, no mercado ao vivo.
package account

import (
	"context"
	"errors"
	"fmt"
	"regexp"
)

// uuidPattern valida só a forma (8-4-4-4-12 hex), não a versão/variante —
// accounts.user_id é `uuid PRIMARY KEY` (migration 000001), então qualquer
// userID de bot precisa ser aceito por esse tipo de coluna no Postgres.
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

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
	// TotalDisinvested (tarefa T.1) é o simétrico de TotalInvested: soma bruta
	// de vendas de renda variável + resgates de renda fixa, nunca líquida de
	// compra — junto com TotalInvested/TotalDividendsReceived, alimenta a
	// rentabilidade sobre capital de risco no backend (nunca sobre caixa
	// nunca investido, ex. salário — Fase T).
	TotalDisinvested       float64
	TotalDividendsReceived float64
	// IsBot identifica contas de liquidez do motor (proposta
	// motor-mercado-realista 2.3) — mesma tabela/mesmo Event Sourcing de
	// uma conta humana, nunca um caminho de dados paralelo. Deliberadamente
	// sem contrapartida em `users` (banco gamification): é essa ausência
	// que garante, por construção, a exclusão de ranking/social (RF/RNF
	// não mudam, ver migration 000010).
	IsBot bool
	// IsActive é o interruptor operacional do bot (tarefa A.4, migration
	// 000011) — independente de IsBot: IsBot é identidade (nunca muda),
	// IsActive decide se esse bot específico participa da coleta de
	// decisões da próxima rodada de negociação (D.2, ainda não
	// implementada) ou fica de fora, sem gerar ordem nem contar como
	// profundidade de book. Desativar/reativar (Deactivate/Activate) nunca
	// altera saldo/posição acumulados — só esse campo. Toda conta nova
	// (humana ou bot) nasce ativa; ficar inativa é sempre uma transição
	// posterior, nunca o estado inicial.
	IsActive bool
}

// New monta uma conta nova com o capital inicial padronizado — é o único
// lugar que decide esse valor; Repository só persiste o que New produziu.
func New(userID string) Account {
	return Account{UserID: userID, CurrentBalance: InitialBalance, IsActive: true}
}

// NewBot monta uma conta de bot de liquidez — ao contrário de New, o saldo
// inicial não é o InitialBalance fixo de RNF06 (essa regra é sobre conta de
// usuário real no mercado ao vivo): cada bot recebe caixa correlacionado ao
// papel que exerce (Market Maker vs. direcional — proposta 2.2), calculado
// por quem chama (bot.InitialAllocation, tarefa B.1/B.2), não por esta
// função. userID aqui não precisa corresponder a um usuário real cadastrado
// em `users` (banco gamification) — só precisa ser único dentro de
// `accounts` — mas precisa ter formato de uuid (não um slug tipo
// "bot-market-maker-1"): accounts.user_id é `uuid PRIMARY KEY` (migration
// 000001), então quem chama (seed/provisionamento de bot, Fase B/C) deve
// gerar um uuid próprio pra cada bot.
func NewBot(userID string, initialBalance float64) (Account, error) {
	if !uuidPattern.MatchString(userID) {
		return Account{}, fmt.Errorf("%w: userID precisa ter formato de uuid (%q)", ErrInvalidBotAccount, userID)
	}
	if initialBalance < 0 {
		return Account{}, fmt.Errorf("%w: saldo inicial negativo (%.2f)", ErrInvalidBotAccount, initialBalance)
	}
	return Account{UserID: userID, CurrentBalance: initialBalance, IsBot: true, IsActive: true}, nil
}

// EligibleForTradingRound diz se esta conta deveria entrar na coleta de
// decisões de uma rodada de negociação (D.2, ainda não implementada) — só
// bot ativo é elegível: conta humana nunca é coletada dessa forma (ela
// envia ordem via HTTP, não participa da rodada de bots), e bot com
// IsActive = false (tarefa A.4) é pulado inteiro, mesmo com
// escopo/caixa/posição que o qualificariam.
func (a Account) EligibleForTradingRound() bool {
	return a.IsBot && a.IsActive
}

// Deactivate/Activate são transformações puras que só alternam IsActive
// (tarefa A.4) — nunca tocam saldo (CurrentBalance/TotalInvested/
// TotalDisinvested/TotalDividendsReceived) nem identidade (IsBot/UserID): desativar um bot
// "fora da curva" não deveria zerar nem redistribuir o que ele já carrega,
// só impedi-lo de participar da rodada seguinte; reativar volta a incluí-lo
// normalmente, sem perder nada do que aconteceu enquanto esteve inativo.
func Deactivate(acc Account) Account {
	acc.IsActive = false
	return acc
}

func Activate(acc Account) Account {
	acc.IsActive = true
	return acc
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
