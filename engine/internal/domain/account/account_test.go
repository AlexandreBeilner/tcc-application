package account

import (
	"context"
	"errors"
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
	acc := Account{UserID: "bot-1", CurrentBalance: 5000, TotalInvested: 1200, TotalDividendsReceived: 30, IsBot: true, IsActive: true}

	got := Deactivate(acc)

	if got.IsActive {
		t.Error("IsActive = true, want false depois de Deactivate")
	}
	if got.UserID != acc.UserID || got.IsBot != acc.IsBot {
		t.Errorf("identidade da conta mudou: got = %+v, want mesma identidade de %+v", got, acc)
	}
	if got.CurrentBalance != acc.CurrentBalance || got.TotalInvested != acc.TotalInvested || got.TotalDividendsReceived != acc.TotalDividendsReceived {
		t.Errorf("saldo mudou por desativar: got = %+v, want saldo intocado de %+v", got, acc)
	}
	if got.EligibleForTradingRound() {
		t.Error("EligibleForTradingRound() = true, want false depois de Deactivate")
	}
}

func TestActivate(t *testing.T) {
	acc := Account{UserID: "bot-1", CurrentBalance: 5000, TotalInvested: 1200, TotalDividendsReceived: 30, IsBot: true, IsActive: false}

	got := Activate(acc)

	if !got.IsActive {
		t.Error("IsActive = false, want true depois de Activate")
	}
	if got.CurrentBalance != acc.CurrentBalance || got.TotalInvested != acc.TotalInvested || got.TotalDividendsReceived != acc.TotalDividendsReceived {
		t.Errorf("saldo mudou por reativar: got = %+v, want saldo intocado de %+v", got, acc)
	}
	if !got.EligibleForTradingRound() {
		t.Error("EligibleForTradingRound() = false, want true depois de Activate (bot volta a participar da rodada seguinte)")
	}
}

type fakeRepository struct {
	created []Account
	err     error
}

func (f *fakeRepository) Create(_ context.Context, acc Account) error {
	if f.err != nil {
		return f.err
	}
	f.created = append(f.created, acc)
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
