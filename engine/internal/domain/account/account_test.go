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
}

func TestNewBot(t *testing.T) {
	tests := []struct {
		name           string
		userID         string
		initialBalance float64
		wantErr        bool
	}{
		{name: "market maker com caixa alto", userID: "bot-market-maker-1", initialBalance: 500000, wantErr: false},
		{name: "bot direcional com caixa modesto", userID: "bot-chartista-3", initialBalance: 1200.50, wantErr: false},
		{name: "saldo zero é válido (bot sem caixa alocado ainda)", userID: "bot-ruido-2", initialBalance: 0, wantErr: false},
		{name: "userID vazio é inválido", userID: "", initialBalance: 1000, wantErr: true},
		{name: "saldo negativo é inválido", userID: "bot-1", initialBalance: -0.01, wantErr: true},
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
		})
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
