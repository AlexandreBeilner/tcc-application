package fixedincomeexecution

import (
	"context"
	"time"
)

// Repository é o colaborador que Service precisa pra ler o contexto de
// compra/resgate e persistir o resultado atomicamente — implementado por
// *db.FixedIncomeExecutionRepository, injetado em NewService.
type Repository interface {
	// LoadPurchaseContext lê saldo do usuário, dado de catálogo do título
	// (taxa, vencimento, aplicação mínima) e a posição já existente do
	// usuário nesse título (zero value se ainda não existe). Devolve
	// ErrAccountNotFound se o usuário não tem conta.
	LoadPurchaseContext(ctx context.Context, userID, assetID string) (PurchaseContext, error)
	// LoadRedeemContext lê a posição do usuário no título (devolve
	// ErrPositionNotFound se não existir), o vencimento do título e a taxa
	// de mercado corrente (Selic simulada do dia, tarefa 3.11).
	LoadRedeemContext(ctx context.Context, userID, assetID string) (RedeemContext, error)
	// PersistPurchase grava o evento imutável em market_events **antes** de
	// projetar em accounts/fixed_income_positions — Event Sourcing é a
	// fonte da verdade financeira (CLAUDE.md). Nunca chamado se Purchase
	// devolveu erro.
	PersistPurchase(ctx context.Context, req Request, outcome PurchaseOutcome) error
	// PersistRedeem grava o evento imutável, credita accounts e remove a
	// posição (resgate sempre integral). Nunca chamado se Redeem devolveu
	// erro.
	PersistRedeem(ctx context.Context, req RedeemRequest, outcome RedeemOutcome) error
}

// Service orquestra compra e resgate de renda fixa ponta a ponta: carrega o
// contexto real (Repository), roda a regra pura (Purchase/Redeem) e
// persiste o resultado — mesmo padrão de orderexecution.Service.Submit.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Purchase processa um aporte. Se Purchase (a função pura) rejeitar, nada é
// persistido.
func (s *Service) Purchase(ctx context.Context, req Request) (PurchaseOutcome, error) {
	pctx, err := s.repo.LoadPurchaseContext(ctx, req.UserID, req.AssetID)
	if err != nil {
		return PurchaseOutcome{}, err
	}

	outcome, err := Purchase(req, pctx, time.Now())
	if err != nil {
		return PurchaseOutcome{}, err
	}

	if err := s.repo.PersistPurchase(ctx, req, outcome); err != nil {
		return PurchaseOutcome{}, err
	}
	return outcome, nil
}

// Redeem processa um resgate antecipado. Se Redeem (a função pura)
// rejeitar, nada é persistido.
func (s *Service) Redeem(ctx context.Context, req RedeemRequest) (RedeemOutcome, error) {
	rctx, err := s.repo.LoadRedeemContext(ctx, req.UserID, req.AssetID)
	if err != nil {
		return RedeemOutcome{}, err
	}

	outcome, err := Redeem(rctx, time.Now())
	if err != nil {
		return RedeemOutcome{}, err
	}

	if err := s.repo.PersistRedeem(ctx, req, outcome); err != nil {
		return RedeemOutcome{}, err
	}
	return outcome, nil
}
