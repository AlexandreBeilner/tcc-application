// Package account contém a regra de capital inicial padronizado (RNF06):
// toda conta nova nasce com o mesmo saldo simulado, no mercado ao vivo.
package account

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
)

// uuidPattern valida só a forma (8-4-4-4-12 hex), não a versão/variante —
// accounts.user_id é `uuid PRIMARY KEY` (migration 000001), então qualquer
// userID de bot precisa ser aceito por esse tipo de coluna no Postgres.
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// monthKeyPattern valida o formato 'YYYY-MM' de referenceMonth (achado 025) —
// só a forma, não se o mês é 01-12: quem decide qual mês está devido é o
// backend (payroll, T.5), o motor só garante que o formato chega íntegro.
var monthKeyPattern = regexp.MustCompile(`^\d{4}-\d{2}$`)

// InitialBalance é o capital inicial de toda conta nova, no mercado ao vivo
// — fixado como premissa (spec 3.5), não configurável (CLAUDE.md).
const InitialBalance = 10000.00

// ErrAlreadyExists é retornado quando já existe uma conta pra esse usuário.
var ErrAlreadyExists = errors.New("conta já existe para este usuário")

// ErrInvalidBotAccount é retornado por NewBot quando userID/saldo inicial
// não formam uma conta de bot válida.
var ErrInvalidBotAccount = errors.New("conta de bot inválida")

type Account struct {
	UserID         string
	CurrentBalance float64
	TotalInvested  float64
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

// ErrNotFound é devolvido por CreditSalary quando não existe conta pra
// userID — diferente de Open, que sempre cria: crédito de salário (Fase T)
// pressupõe uma conta já aberta antes.
var ErrNotFound = errors.New("conta não encontrada")

// ErrInvalidSalaryAmount é devolvido por CreditSalary quando amount não é
// positivo (tarefa T.2, critério de aceite "rejeita amount <= 0").
var ErrInvalidSalaryAmount = errors.New("valor de salário inválido")

// ErrInvalidReferenceMonth é devolvido por CreditSalary quando referenceMonth
// não está no formato 'YYYY-MM' (achado 025 — distingue o mês a que o
// salário se refere do dia em que o crédito de fato foi processado).
var ErrInvalidReferenceMonth = errors.New("mês de referência inválido")

// MaxAdminCredit é o limite físico de um crédito administrativo (N.17): não é teto
// de negócio (o autor decidiu "sem teto", achado 029 item 5), é a folga que mantém
// saldo + crédito dentro de accounts.current_balance numeric(15,2), cujo máximo é
// R$ 9,99 trilhões. Mesmo valor de botadmin.MaxInitialCash.
const MaxAdminCredit = 1_000_000_000_000.00

// ErrInvalidCreditAmount é devolvido por AdminCredit quando o valor não é finito,
// não é positivo (depois de arredondar pra centavos) ou passa de MaxAdminCredit.
var ErrInvalidCreditAmount = errors.New("valor de crédito inválido")

// ErrBalanceOverflow é devolvido por AdminCredit quando saldo + crédito não cabe na
// coluna de saldo (numeric(15,2)).
var ErrBalanceOverflow = errors.New("o crédito faria o saldo passar do limite suportado")

// Repository persiste a criação de uma conta nova e o crédito de salário
// mensal numa conta já existente. A implementação concreta
// (internal/infra/db) grava o evento imutável correspondente em
// market_events na mesma transação que projeta o efeito em accounts — ver
// regra de Event Sourcing no CLAUDE.md.
type Repository interface {
	Create(ctx context.Context, acc Account) error
	// CreditSalary credita amount em CurrentBalance da conta de userID,
	// gravando o evento imutável EventSalaryPayment (com o mês de referência,
	// achado 025) antes de projetar o saldo (tarefa T.2) — nunca toca
	// TotalInvested/TotalDisinvested/TotalDividendsReceived: salário é caixa
	// livre, nunca capital de risco (T.1). Devolve ErrNotFound se a conta não
	// existe.
	CreditSalary(ctx context.Context, userID string, amount float64, referenceMonth string) error
	// AdminCredit credita amount em CurrentBalance gravando o evento imutável
	// EventAdminCredit antes (N.17) — mesmo contrato de CreditSalary: nunca toca
	// TotalInvested/TotalDisinvested/TotalDividendsReceived. Devolve ErrNotFound se
	// a conta não existe e ErrBalanceOverflow se o saldo não comporta o valor.
	AdminCredit(ctx context.Context, userID string, amount float64) error
}

// Service abre contas novas sempre com o capital inicial padronizado e
// credita o salário mensal (Fase T) numa conta já existente.
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

// CreditSalary credita o salário mensal (tarefa T.2) na conta de userID —
// quem decide quando/quanto pagar e a que mês-calendário real (referenceMonth,
// achado 025) o crédito se refere é externo ao motor (T.5, backend); aqui só
// se valida o formato de entrada e delega o crédito atômico ao Repository.
func (s *Service) CreditSalary(ctx context.Context, userID string, amount float64, referenceMonth string) error {
	if amount <= 0 {
		return fmt.Errorf("%w: precisa ser positivo (%.2f)", ErrInvalidSalaryAmount, amount)
	}
	if !monthKeyPattern.MatchString(referenceMonth) {
		return fmt.Errorf("%w: precisa ter formato AAAA-MM (%q)", ErrInvalidReferenceMonth, referenceMonth)
	}
	return s.repo.CreditSalary(ctx, userID, amount, referenceMonth)
}

// AdminCredit credita caixa na conta de userID por decisão do administrador (N.17).
// O valor é arredondado pra centavos (a coluna é numeric(15,2)); precisa ser finito,
// positivo depois do arredondamento e de no máximo MaxAdminCredit. Quem pode pedir,
// o motivo e a auditoria são do backend. Devolve o valor de fato creditado.
func (s *Service) AdminCredit(ctx context.Context, userID string, amount float64) (float64, error) {
	if math.IsNaN(amount) || math.IsInf(amount, 0) {
		return 0, fmt.Errorf("%w: precisa ser um número finito", ErrInvalidCreditAmount)
	}
	cents := math.Round(amount*100) / 100
	if cents <= 0 {
		return 0, fmt.Errorf("%w: precisa ser positivo (%.4f)", ErrInvalidCreditAmount, amount)
	}
	if cents > MaxAdminCredit {
		return 0, fmt.Errorf("%w: passa do máximo de R$ %.2f", ErrInvalidCreditAmount, MaxAdminCredit)
	}
	if err := s.repo.AdminCredit(ctx, userID, cents); err != nil {
		return 0, err
	}
	return cents, nil
}
