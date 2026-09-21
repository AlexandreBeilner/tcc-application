package fixedincomeexecution

import (
	"context"
	"errors"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/domain/ipca"
)

// testIPCAConfig é usada em todo teste de Service que não exercita Tesouro
// IPCA+ — os valores não importam pra esses casos (fixedincome.IsIPCAMais
// dá false, Purchase/Redeem nunca usam vnaBase/monthlyIPCA), só precisa
// ser um ipca.Config válido pra NewService.
var testIPCAConfig = ipca.DefaultConfig(1)

type fakeRepository struct {
	purchaseCtx    PurchaseContext
	purchaseCtxErr error
	redeemCtx      RedeemContext
	redeemCtxErr   error

	persistPurchaseErr    error
	persistPurchaseCalled bool
	persistedPurchaseReq  Request

	persistRedeemErr    error
	persistRedeemCalled bool
	persistedRedeemReq  RedeemRequest
}

func (f *fakeRepository) LoadPurchaseContext(_ context.Context, _, _ string) (PurchaseContext, error) {
	return f.purchaseCtx, f.purchaseCtxErr
}

func (f *fakeRepository) LoadRedeemContext(_ context.Context, _, _ string) (RedeemContext, error) {
	return f.redeemCtx, f.redeemCtxErr
}

func (f *fakeRepository) PersistPurchase(_ context.Context, req Request, _ PurchaseOutcome) error {
	f.persistPurchaseCalled = true
	f.persistedPurchaseReq = req
	return f.persistPurchaseErr
}

func (f *fakeRepository) PersistRedeem(_ context.Context, req RedeemRequest, _ RedeemOutcome) error {
	f.persistRedeemCalled = true
	f.persistedRedeemReq = req
	return f.persistRedeemErr
}

func validPurchaseContext() PurchaseContext {
	return PurchaseContext{AccountBalance: 5000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: time.Now().AddDate(1, 0, 0)}
}

func TestService_Purchase_ExecutaEPersisteCompraValida(t *testing.T) {
	repo := &fakeRepository{purchaseCtx: validPurchaseContext()}
	svc := NewService(repo, testIPCAConfig)

	req := Request{UserID: "u1", AssetID: "a1", Amount: 2000}
	outcome, err := svc.Purchase(context.Background(), req)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.QuantityPurchased <= 0 {
		t.Errorf("QuantityPurchased = %v, want > 0", outcome.QuantityPurchased)
	}
	if !repo.persistPurchaseCalled {
		t.Fatal("PersistPurchase não foi chamado pra compra válida")
	}
	if repo.persistedPurchaseReq.UserID != "u1" {
		t.Errorf("persistedPurchaseReq.UserID = %q, want %q", repo.persistedPurchaseReq.UserID, "u1")
	}
}

func TestService_Purchase_CompraRejeitadaNaoPersisteNada(t *testing.T) {
	repo := &fakeRepository{purchaseCtx: validPurchaseContext()}
	svc := NewService(repo, testIPCAConfig)

	_, err := svc.Purchase(context.Background(), Request{UserID: "u1", AssetID: "a1", Amount: 10})
	if err != ErrBelowMinimumInvestment {
		t.Fatalf("err = %v, want %v", err, ErrBelowMinimumInvestment)
	}
	if repo.persistPurchaseCalled {
		t.Error("PersistPurchase não deveria ser chamado quando Purchase rejeita")
	}
}

func TestService_Purchase_ErroAoCarregarContexto(t *testing.T) {
	repo := &fakeRepository{purchaseCtxErr: ErrAccountNotFound}
	svc := NewService(repo, testIPCAConfig)

	_, err := svc.Purchase(context.Background(), Request{Amount: 100})
	if err != ErrAccountNotFound {
		t.Fatalf("err = %v, want %v", err, ErrAccountNotFound)
	}
	if repo.persistPurchaseCalled {
		t.Error("PersistPurchase não deveria ser chamado quando LoadPurchaseContext falha")
	}
}

func TestService_Purchase_ErroAoPersistir(t *testing.T) {
	repo := &fakeRepository{purchaseCtx: validPurchaseContext(), persistPurchaseErr: errors.New("falha de escrita")}
	svc := NewService(repo, testIPCAConfig)

	_, err := svc.Purchase(context.Background(), Request{Amount: 2000})
	if err == nil {
		t.Fatal("err = nil, want erro propagado de PersistPurchase")
	}
}

func TestService_Redeem_ExecutaEPersisteResgateValido(t *testing.T) {
	repo := &fakeRepository{redeemCtx: RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: 900, AverageRate: 0.10},
		MaturityDate:         time.Now().AddDate(0, 6, 0),
		CurrentMarketRatePct: 8,
	}}
	svc := NewService(repo, testIPCAConfig)

	req := RedeemRequest{UserID: "u1", AssetID: "a1"}
	outcome, err := svc.Redeem(context.Background(), req)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.TotalValue <= 0 {
		t.Errorf("TotalValue = %v, want > 0", outcome.TotalValue)
	}
	if !repo.persistRedeemCalled {
		t.Fatal("PersistRedeem não foi chamado pra resgate válido")
	}
	if repo.persistedRedeemReq.UserID != "u1" {
		t.Errorf("persistedRedeemReq.UserID = %q, want %q", repo.persistedRedeemReq.UserID, "u1")
	}
}

func TestService_Redeem_ErroAoCarregarContextoNaoPersisteNada(t *testing.T) {
	repo := &fakeRepository{redeemCtxErr: ErrPositionNotFound}
	svc := NewService(repo, testIPCAConfig)

	_, err := svc.Redeem(context.Background(), RedeemRequest{})
	if err != ErrPositionNotFound {
		t.Fatalf("err = %v, want %v", err, ErrPositionNotFound)
	}
	if repo.persistRedeemCalled {
		t.Error("PersistRedeem não deveria ser chamado quando LoadRedeemContext falha")
	}
}

func TestService_Redeem_ErroAoPersistir(t *testing.T) {
	repo := &fakeRepository{
		redeemCtx: RedeemContext{
			Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: 900, AverageRate: 0.10},
			MaturityDate:         time.Now().AddDate(0, 6, 0),
			CurrentMarketRatePct: 8,
		},
		persistRedeemErr: errors.New("falha de escrita"),
	}
	svc := NewService(repo, testIPCAConfig)

	_, err := svc.Redeem(context.Background(), RedeemRequest{})
	if err == nil {
		t.Fatal("err = nil, want erro propagado de PersistRedeem")
	}
}
