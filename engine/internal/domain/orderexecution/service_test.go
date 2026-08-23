package orderexecution

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

type fakeRepository struct {
	loadCtx          Context
	loadErr          error
	persistErr       error
	persistedReq     Request
	persistedOutcome Outcome
	persistCalled    bool
}

func (f *fakeRepository) LoadContext(_ context.Context, _, _ string) (Context, error) {
	return f.loadCtx, f.loadErr
}

func (f *fakeRepository) Persist(_ context.Context, req Request, outcome Outcome) error {
	f.persistCalled = true
	f.persistedReq = req
	f.persistedOutcome = outcome
	return f.persistErr
}

func TestService_Submit_ExecutaEPersisteOrdemValida(t *testing.T) {
	repo := &fakeRepository{loadCtx: Context{ReferencePrice: 25, IncomingUserBalance: 1000}}
	svc := NewService(repo)

	req := Request{UserID: "u1", AssetID: "a1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}
	outcome, err := svc.Submit(context.Background(), req)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.FilledQuantity != 10 {
		t.Errorf("FilledQuantity = %d, want 10", outcome.FilledQuantity)
	}
	if !repo.persistCalled {
		t.Fatal("Persist não foi chamado pra ordem válida")
	}
	if repo.persistedReq.UserID != "u1" {
		t.Errorf("persistedReq.UserID = %q, want %q", repo.persistedReq.UserID, "u1")
	}
}

func TestService_Submit_OrdemRejeitadaNaoPersisteNada(t *testing.T) {
	repo := &fakeRepository{loadCtx: Context{ReferencePrice: 25, IncomingUserBalance: 1}}
	svc := NewService(repo)

	req := Request{UserID: "u1", AssetID: "a1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}
	_, err := svc.Submit(context.Background(), req)
	if err != ErrInsufficientBalance {
		t.Fatalf("err = %v, want %v", err, ErrInsufficientBalance)
	}
	if repo.persistCalled {
		t.Error("Persist não deveria ser chamado quando Execute rejeita a ordem")
	}
}

func TestService_Submit_ErroAoCarregarContexto(t *testing.T) {
	repo := &fakeRepository{loadErr: errors.New("falha de leitura")}
	svc := NewService(repo)

	_, err := svc.Submit(context.Background(), Request{Type: orderbook.TypeMarket, Quantity: 1})
	if err == nil {
		t.Fatal("err = nil, want erro propagado de LoadContext")
	}
	if repo.persistCalled {
		t.Error("Persist não deveria ser chamado quando LoadContext falha")
	}
}

func TestService_Submit_ErroAoPersistir(t *testing.T) {
	repo := &fakeRepository{
		loadCtx:    Context{ReferencePrice: 25, IncomingUserBalance: 1000},
		persistErr: errors.New("falha de escrita"),
	}
	svc := NewService(repo)

	_, err := svc.Submit(context.Background(), Request{Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 1})
	if err == nil {
		t.Fatal("err = nil, want erro propagado de Persist")
	}
}
