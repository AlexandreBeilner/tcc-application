package fixedincomeexecution

import (
	"context"

	"tcc-investimentos/engine/internal/domain/fixedincome"
	"tcc-investimentos/engine/internal/domain/ipca"
	"tcc-investimentos/engine/internal/domain/simcalendar"
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
// ipcaCfg (tarefa L.2) parametriza fixedincome.CurrentVNAWindow — a única
// peça de contexto de Purchase/Redeem que não vem do Repository, porque
// não é dado de usuário/catálogo, é config de composição (mesmo raciocínio
// de tick.Service.selicCfg, injetado em cmd/api/main.go).
type Service struct {
	repo    Repository
	ipcaCfg ipca.Config
}

func NewService(repo Repository, ipcaCfg ipca.Config) *Service {
	return &Service{repo: repo, ipcaCfg: ipcaCfg}
}

// Purchase processa um aporte. Se Purchase (a função pura) rejeitar, nada é
// persistido. vnaBase/monthlyIPCA (tarefa L.2) são resolvidos aqui, antes
// da função pura, mesmo pra compras de produto que não é Tesouro IPCA+
// (fixedincome.CurrentVNAWindow é barata — computa em cima de meses
// decorridos desde uma data-base fixa, não faz I/O — e Purchase decide
// sozinha, via fixedincome.IsIPCAMais, se usa os dois valores ou ignora).
func (s *Service) Purchase(ctx context.Context, req Request) (PurchaseOutcome, error) {
	pctx, err := s.repo.LoadPurchaseContext(ctx, req.UserID, req.AssetID)
	if err != nil {
		return PurchaseOutcome{}, err
	}

	if !pctx.IsSandbox {
		if err := simcalendar.CheckMarketOpen(pctx.SimulatedDay); err != nil {
			return PurchaseOutcome{}, err
		}
	}

	now := simcalendar.DateOf(pctx.SimulatedDay)
	vnaBase, monthlyIPCA := fixedincome.CurrentVNAWindow(s.ipcaCfg, now)
	outcome, err := Purchase(req, pctx, now, vnaBase, monthlyIPCA)
	if err != nil {
		return PurchaseOutcome{}, err
	}

	if err := s.repo.PersistPurchase(ctx, req, outcome); err != nil {
		return PurchaseOutcome{}, err
	}
	return outcome, nil
}

// Redeem processa um resgate antecipado. Se Redeem (a função pura)
// rejeitar, nada é persistido. Ver nota de Purchase sobre vnaBase/
// monthlyIPCA.
func (s *Service) Redeem(ctx context.Context, req RedeemRequest) (RedeemOutcome, error) {
	rctx, err := s.repo.LoadRedeemContext(ctx, req.UserID, req.AssetID)
	if err != nil {
		return RedeemOutcome{}, err
	}

	if !rctx.IsSandbox {
		if err := simcalendar.CheckMarketOpen(rctx.SimulatedDay); err != nil {
			return RedeemOutcome{}, err
		}
	}

	now := simcalendar.DateOf(rctx.SimulatedDay)
	vnaBase, monthlyIPCA := fixedincome.CurrentVNAWindow(s.ipcaCfg, now)
	outcome, err := Redeem(rctx, now, vnaBase, monthlyIPCA)
	if err != nil {
		return RedeemOutcome{}, err
	}

	if err := s.repo.PersistRedeem(ctx, req, outcome); err != nil {
		return RedeemOutcome{}, err
	}
	return outcome, nil
}

// Value avalia hoje uma posição existente, sem resgatar: roda a mesma regra pura de Redeem
// (rendimento pós-fixado, marcação a mercado do Prefixado e do IPCA+, IR regressivo) e devolve
// o resultado, sem verificar se o mercado está aberto e sem persistir nada. TotalValue é o
// valor bruto (o que o patrimônio e o ranking usam) e NetValue o líquido de IR (o que o
// resgate creditaria). Mesma conta do resgate de propósito: o valor mostrado nunca diverge do
// que o resgate pagaria no mesmo dia simulado.
func (s *Service) Value(ctx context.Context, userID, assetID string) (RedeemOutcome, error) {
	rctx, err := s.repo.LoadRedeemContext(ctx, userID, assetID)
	if err != nil {
		return RedeemOutcome{}, err
	}
	now := simcalendar.DateOf(rctx.SimulatedDay)
	vnaBase, monthlyIPCA := fixedincome.CurrentVNAWindow(s.ipcaCfg, now)
	return Redeem(rctx, now, vnaBase, monthlyIPCA)
}

// Simulate projeta o retorno de um aporte hipotético (tarefa 6.0.5,
// achado do teste de ponta a ponta da Fase L — Simulate ganhou acesso ao
// VNA do Tesouro IPCA+ pelo mesmo caminho de Purchase/Redeem). Nunca toca
// s.repo (crítério de aceite original: simulação não persiste nada, ver
// TestSimulate_NaoRecebeRepositoryNemPersisteNada) — só resolve
// vnaBase/monthlyIPCA (na data de hoje) e projectedVNABase/
// projectedMonthlyIPCA (na data projetada, req.DaysHeld à frente — pode
// cair numa janela de VNA diferente, por isso um CurrentVNAWindow
// separado) a partir de s.ipcaCfg, mesma fonte de Purchase/Redeem.
func (s *Service) Simulate(req SimulateRequest, ctx SimulateContext) (SimulateOutcome, error) {
	now := simcalendar.DateOf(ctx.SimulatedDay)
	vnaBase, monthlyIPCA := fixedincome.CurrentVNAWindow(s.ipcaCfg, now)
	projectedVNABase, projectedMonthlyIPCA := fixedincome.CurrentVNAWindow(s.ipcaCfg, now.AddDate(0, 0, req.DaysHeld))
	return Simulate(req, ctx, now, vnaBase, monthlyIPCA, projectedVNABase, projectedMonthlyIPCA)
}
