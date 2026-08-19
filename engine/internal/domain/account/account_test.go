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
