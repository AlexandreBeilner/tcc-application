package account

import (
	"context"
	"errors"
	"math"
	"testing"
)

func TestNew(t *testing.T) {
	acc := New("user-1")

	if acc.UserID != "user-1" {
		t.Errorf("UserID = %q, want %q", acc.UserID, "user-1")
	}
	if acc.CurrentBalance != InitialBalance {
		t.Errorf("CurrentBalance = %v, want %v", acc.CurrentBalance, InitialBalance)
	}
	if acc.TotalInvested != 0 {
		t.Errorf("TotalInvested = %v, want 0", acc.TotalInvested)
	}
	if acc.TotalDisinvested != 0 {
		t.Errorf("TotalDisinvested = %v, want 0", acc.TotalDisinvested)
	}
	if acc.TotalDividendsReceived != 0 {
		t.Errorf("TotalDividendsReceived = %v, want 0", acc.TotalDividendsReceived)
	}
	if acc.IsBot {
		t.Error("IsBot = true, want false — New() é o caminho de conta humana")
	}
	if !acc.IsActive {
		t.Error("IsActive = false, want true — toda conta nova nasce ativa")
	}
}

func TestNewBot(t *testing.T) {
	tests := []struct {
		name           string
		userID         string
		initialBalance float64
		wantErr        bool
	}{
		{name: "market maker com caixa alto", userID: "11111111-1111-4111-8111-111111111111", initialBalance: 500000, wantErr: false},
		{name: "bot direcional com caixa modesto", userID: "22222222-2222-4222-8222-222222222222", initialBalance: 1200.50, wantErr: false},
		{name: "saldo zero é válido (bot sem caixa alocado ainda)", userID: "33333333-3333-4333-8333-333333333333", initialBalance: 0, wantErr: false},
		{name: "userID vazio é inválido", userID: "", initialBalance: 1000, wantErr: true},
		{name: "userID que não tem formato de uuid é inválido (accounts.user_id é uuid)", userID: "bot-market-maker-1", initialBalance: 1000, wantErr: true},
		{name: "saldo negativo é inválido", userID: "44444444-4444-4444-8444-444444444444", initialBalance: -0.01, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			acc, err := NewBot(tt.userID, tt.initialBalance)
			if tt.wantErr {
				if !errors.Is(err, ErrInvalidBotAccount) {
					t.Fatalf("err = %v, want ErrInvalidBotAccount", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("NewBot() erro inesperado: %v", err)
			}
			if !acc.IsBot {
				t.Error("IsBot = false, want true")
			}
			if acc.UserID != tt.userID {
				t.Errorf("UserID = %q, want %q", acc.UserID, tt.userID)
			}
			if acc.CurrentBalance != tt.initialBalance {
				t.Errorf("CurrentBalance = %v, want %v", acc.CurrentBalance, tt.initialBalance)
			}
			if !acc.IsActive {
				t.Error("IsActive = false, want true — todo bot nasce ativo")
			}
		})
	}
}

func TestAccount_EligibleForTradingRound(t *testing.T) {
	tests := []struct {
		name string
		acc  Account
		want bool
	}{
		{name: "bot ativo é elegível", acc: Account{IsBot: true, IsActive: true}, want: true},
		{name: "bot inativo não é elegível", acc: Account{IsBot: true, IsActive: false}, want: false},
		{name: "conta humana nunca é elegível, mesmo ativa", acc: Account{IsBot: false, IsActive: true}, want: false},
		{name: "conta humana inativa (não deveria existir, mas também não é elegível)", acc: Account{IsBot: false, IsActive: false}, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.acc.EligibleForTradingRound(); got != tt.want {
				t.Errorf("EligibleForTradingRound() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDeactivate(t *testing.T) {
	acc := Account{UserID: "bot-1", CurrentBalance: 5000, TotalInvested: 1200, TotalDisinvested: 300, TotalDividendsReceived: 30, IsBot: true, IsActive: true}

	got := Deactivate(acc)

	if got.IsActive {
		t.Error("IsActive = true, want false depois de Deactivate")
	}
	if got.UserID != acc.UserID || got.IsBot != acc.IsBot {
		t.Errorf("identidade da conta mudou: got = %+v, want mesma identidade de %+v", got, acc)
	}
	if got.CurrentBalance != acc.CurrentBalance || got.TotalInvested != acc.TotalInvested || got.TotalDisinvested != acc.TotalDisinvested || got.TotalDividendsReceived != acc.TotalDividendsReceived {
		t.Errorf("saldo mudou por desativar: got = %+v, want saldo intocado de %+v", got, acc)
	}
	if got.EligibleForTradingRound() {
		t.Error("EligibleForTradingRound() = true, want false depois de Deactivate")
	}
}

func TestActivate(t *testing.T) {
	acc := Account{UserID: "bot-1", CurrentBalance: 5000, TotalInvested: 1200, TotalDisinvested: 300, TotalDividendsReceived: 30, IsBot: true, IsActive: false}

	got := Activate(acc)

	if !got.IsActive {
		t.Error("IsActive = false, want true depois de Activate")
	}
	if got.CurrentBalance != acc.CurrentBalance || got.TotalInvested != acc.TotalInvested || got.TotalDisinvested != acc.TotalDisinvested || got.TotalDividendsReceived != acc.TotalDividendsReceived {
		t.Errorf("saldo mudou por reativar: got = %+v, want saldo intocado de %+v", got, acc)
	}
	if !got.EligibleForTradingRound() {
		t.Error("EligibleForTradingRound() = false, want true depois de Activate (bot volta a participar da rodada seguinte)")
	}
}

type fakeRepository struct {
	created []Account
	err     error

	creditedUserID string
	creditedAmount float64
	creditedMonth  string
	creditErr      error

	adminCreditedUserID string
	adminCreditedAmount float64
	adminCreditErr      error
}

func (f *fakeRepository) Create(_ context.Context, acc Account) error {
	if f.err != nil {
		return f.err
	}
	f.created = append(f.created, acc)
	return nil
}

func (f *fakeRepository) CreditSalary(_ context.Context, userID string, amount float64, referenceMonth string) error {
	if f.creditErr != nil {
		return f.creditErr
	}
	f.creditedUserID, f.creditedAmount, f.creditedMonth = userID, amount, referenceMonth
	return nil
}

func (f *fakeRepository) AdminCredit(_ context.Context, userID string, amount float64) error {
	if f.adminCreditErr != nil {
		return f.adminCreditErr
	}
	f.adminCreditedUserID, f.adminCreditedAmount = userID, amount
	return nil
}

func TestService_Open(t *testing.T) {
	repo := &fakeRepository{}
	svc := NewService(repo)

	acc, err := svc.Open(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("Open() erro inesperado: %v", err)
	}
	if acc.CurrentBalance != InitialBalance {
		t.Errorf("CurrentBalance = %v, want %v", acc.CurrentBalance, InitialBalance)
	}
	if len(repo.created) != 1 || repo.created[0].UserID != "user-1" {
		t.Errorf("repo.created = %+v, want conta única de user-1", repo.created)
	}
}

func TestService_Open_PropagaErroDoRepositorio(t *testing.T) {
	repo := &fakeRepository{err: ErrAlreadyExists}
	svc := NewService(repo)

	_, err := svc.Open(context.Background(), "user-1")
	if !errors.Is(err, ErrAlreadyExists) {
		t.Errorf("err = %v, want ErrAlreadyExists", err)
	}
}

func TestService_CreditSalary(t *testing.T) {
	repo := &fakeRepository{}
	svc := NewService(repo)

	if err := svc.CreditSalary(context.Background(), "user-1", 1000, "2026-01"); err != nil {
		t.Fatalf("CreditSalary() erro inesperado: %v", err)
	}
	if repo.creditedUserID != "user-1" || repo.creditedAmount != 1000 || repo.creditedMonth != "2026-01" {
		t.Errorf("repo creditado = (%q, %v, %q), want (\"user-1\", 1000, \"2026-01\")", repo.creditedUserID, repo.creditedAmount, repo.creditedMonth)
	}
}

func TestService_CreditSalary_RejeitaAmountNaoPositivo(t *testing.T) {
	tests := []float64{0, -1, -0.01}

	for _, amount := range tests {
		repo := &fakeRepository{}
		svc := NewService(repo)

		err := svc.CreditSalary(context.Background(), "user-1", amount, "2026-01")
		if !errors.Is(err, ErrInvalidSalaryAmount) {
			t.Errorf("amount = %v: err = %v, want ErrInvalidSalaryAmount", amount, err)
		}
		if repo.creditedUserID != "" {
			t.Errorf("amount = %v: repo.CreditSalary não deveria ser chamado", amount)
		}
	}
}

// TestService_CreditSalary_RejeitaReferenceMonthInvalido cobre o achado 025:
// reference_month precisa ter formato AAAA-MM, senão o catch-up de vários
// meses atrasados (T.5) grava eventos sem como distinguir a que mês cada um
// se refere.
func TestService_CreditSalary_RejeitaReferenceMonthInvalido(t *testing.T) {
	tests := []string{"", "2026", "2026-1", "janeiro-2026", "2026/01"}

	for _, month := range tests {
		repo := &fakeRepository{}
		svc := NewService(repo)

		err := svc.CreditSalary(context.Background(), "user-1", 1000, month)
		if !errors.Is(err, ErrInvalidReferenceMonth) {
			t.Errorf("referenceMonth = %q: err = %v, want ErrInvalidReferenceMonth", month, err)
		}
		if repo.creditedUserID != "" {
			t.Errorf("referenceMonth = %q: repo.CreditSalary não deveria ser chamado", month)
		}
	}
}

func TestService_CreditSalary_PropagaErroDoRepositorio(t *testing.T) {
	repo := &fakeRepository{creditErr: ErrNotFound}
	svc := NewService(repo)

	err := svc.CreditSalary(context.Background(), "user-1", 1000, "2026-01")
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestService_AdminCredit(t *testing.T) {
	tests := []struct {
		name       string
		amount     float64
		wantAmount float64
	}{
		{"valor inteiro", 5000, 5000},
		{"arredonda pra centavos", 10.005, 10.01},
		{"um centavo", 0.01, 0.01},
		{"no limite físico", MaxAdminCredit, MaxAdminCredit},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{}
			got, err := NewService(repo).AdminCredit(context.Background(), "user-1", tt.amount)
			if err != nil {
				t.Fatalf("AdminCredit() erro inesperado: %v", err)
			}
			if got != tt.wantAmount || repo.adminCreditedAmount != tt.wantAmount || repo.adminCreditedUserID != "user-1" {
				t.Errorf("creditado = (%v, repo %q/%v), want %v pra user-1", got, repo.adminCreditedUserID, repo.adminCreditedAmount, tt.wantAmount)
			}
		})
	}
}

func TestService_AdminCredit_RejeitaValorInvalido(t *testing.T) {
	tests := []struct {
		name   string
		amount float64
	}{
		{"zero", 0},
		{"negativo", -5},
		{"NaN", math.NaN()},
		{"+Inf", math.Inf(1)},
		{"-Inf", math.Inf(-1)},
		{"abaixo de meio centavo", 0.004},
		{"acima do limite físico", MaxAdminCredit + 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{}
			_, err := NewService(repo).AdminCredit(context.Background(), "user-1", tt.amount)
			if !errors.Is(err, ErrInvalidCreditAmount) {
				t.Errorf("err = %v, want ErrInvalidCreditAmount", err)
			}
			if repo.adminCreditedUserID != "" {
				t.Error("repo.AdminCredit não deveria ser chamado")
			}
		})
	}
}

func TestService_AdminCredit_PropagaErroDoRepositorio(t *testing.T) {
	for _, repoErr := range []error{ErrNotFound, ErrBalanceOverflow} {
		repo := &fakeRepository{adminCreditErr: repoErr}
		_, err := NewService(repo).AdminCredit(context.Background(), "user-1", 100)
		if !errors.Is(err, repoErr) {
			t.Errorf("err = %v, want %v", err, repoErr)
		}
	}
}
