package corporategovernance

import (
	"context"
	"errors"
	"fmt"

	"tcc-investimentos/engine/internal/domain/enginesetting"
)

// Declaração pendente (MO.6.11): no dia do balanço, a empresa elegível NÃO declara o dividendo;
// o motor registra uma declaração retida (lucro do pool e dia do balanço), o backend abre a
// assembleia de destinação do lucro e a decisão libera a declaração com o payout novo. Nada
// fica preso: pendência sem solução em `governance_declaration_safety_days` é declarada com o
// payout vigente, e o backend ou o painel podem liberar antes. A retenção só existe com
// `governance_hold_declarations` ligado (junto da Assembleia), então motor sozinho paga como
// sempre.

// ReleaseReason diz por que uma declaração foi (ou será) liberada.
type ReleaseReason string

const (
	// ReleaseDecision: a decisão da assembleia (com payout) já foi aplicada.
	ReleaseDecision ReleaseReason = "decision"
	// ReleaseNoDecision: a assembleia fechou sem decisão (sem quórum, empate, sem pauta) ou
	// ficou desligada ou pausada; vale o payout vigente.
	ReleaseNoDecision ReleaseReason = "no_decision"
	// ReleaseAdmin: liberação manual pelo painel.
	ReleaseAdmin ReleaseReason = "admin"
	// ReleaseExpired: o prazo de segurança venceu sem nada resolver; vale o payout vigente.
	ReleaseExpired ReleaseReason = "expired"
)

// ErrUnknownDeclaration: a declaração não existe.
var ErrUnknownDeclaration = errors.New("declaração não encontrada")

// Pending é uma declaração de dividendo retida, esperando a destinação do lucro.
type Pending struct {
	ID        string
	CompanyID string
	Name      string
	Sector    string
	Tickers   []string
	// CycleIndex e ReportDay identificam o balanço que gerou a declaração.
	CycleIndex int
	ReportDay  int
	// HeldDay é o dia simulado em que a declaração foi retida (o do balanço) e DaysHeld há quantos
	// dias simulados ela está retida (o backend decide, por isso, quando abrir a assembleia ou
	// desistir).
	HeldDay  int
	DaysHeld int
	// PoolNetIncome é o lucro do pool que vai a pagamento (um ciclo no trimestral, acumulado
	// no semestral e no anual). Informação interna: o backend não a repassa a ninguém.
	PoolNetIncome float64
	// DecisionAssemblyID é a assembleia cuja decisão vai liberar a declaração, se já chegou.
	DecisionAssemblyID *string
	// PayoutEffectPending: a decisão ligada ainda tem efeito de destinação por aplicar.
	PayoutEffectPending bool
	// ReleaseRequested e ReleaseReason: liberação pedida (backend ou painel), que sai no
	// próximo tick.
	ReleaseRequested bool
	ReleaseReason    ReleaseReason
}

// ReleaseOrder é uma declaração a liberar no tick de hoje. O tick a transforma no provento
// (datas contadas a partir de hoje) e marca a declaração como liberada na mesma transação.
type ReleaseOrder struct {
	ID            string
	CompanyID     string
	CycleIndex    int
	PoolNetIncome float64
	Reason        ReleaseReason
}

// HoldPolicy é o que decide, a cada balanço, se a declaração fica retida.
type HoldPolicy struct {
	// Enabled liga a retenção (governance_hold_declarations). Desligado, ninguém retém.
	Enabled bool
	// PayoutCooldownDays é o cooldown do payout: só retém quem pode mudar o payout agora.
	PayoutCooldownDays int
	// SafetyDays é o prazo de segurança, em dias simulados.
	SafetyDays int
}

// HoldPolicyFrom monta a política a partir dos parâmetros vigentes.
func HoldPolicyFrom(v enginesetting.Values) HoldPolicy {
	return HoldPolicy{
		Enabled:            v.GovernanceHoldDeclarations == 1,
		PayoutCooldownDays: v.GovernancePayoutCooldownDays,
		SafetyDays:         v.GovernanceDeclarationSafetyDays,
	}
}

// HoldCompany é o que a regra de retenção precisa saber da empresa no dia do balanço.
type HoldCompany struct {
	// HasUserShareholders: alguma conta de usuário (bot fora) tem ação da empresa. Sem
	// acionista, ninguém vota e a assembleia não abre, então não há por que reter.
	HasUserShareholders bool
	// LastPayoutStartDay é o início da última mudança de destinação do lucro que valeu.
	LastPayoutStartDay *int
	// HasHeld: a empresa já tem uma declaração retida (nunca duas ao mesmo tempo).
	HasHeld bool
	Today   int
}

// ShouldHold diz se a declaração de hoje fica retida: retenção ligada, empresa com acionista
// de usuário, alavanca de payout fora de cooldown e nenhuma declaração retida ainda. Pura.
func ShouldHold(p HoldPolicy, c HoldCompany) bool {
	if !p.Enabled || !c.HasUserShareholders || c.HasHeld {
		return false
	}
	return !InCooldown(c.LastPayoutStartDay, c.Today, p.PayoutCooldownDays)
}

// ReleaseReasonFor decide se uma declaração retida sai hoje e por quê. Pura. Ordem: pedido
// explícito (backend ou painel), decisão já aplicada e, por último, prazo de segurança.
func ReleaseReasonFor(p Pending, today, safetyDays int) (ReleaseReason, bool) {
	switch {
	case p.ReleaseRequested:
		return p.ReleaseReason, true
	case p.DecisionAssemblyID != nil && !p.PayoutEffectPending:
		return ReleaseDecision, true
	case safetyDays > 0 && today-p.HeldDay >= safetyDays:
		return ReleaseExpired, true
	}
	return "", false
}

// SafetyDeadline é o dia simulado em que a declaração sai sozinha.
func SafetyDeadline(heldDay, safetyDays int) int { return heldDay + safetyDays }

// HoldPolicy lê a política vigente (o tick a consulta antes de calcular os balanços do dia).
func (s *Service) HoldPolicy(ctx context.Context) (HoldPolicy, error) {
	values, err := s.settings.Current(ctx)
	if err != nil {
		return HoldPolicy{}, err
	}
	return HoldPolicyFrom(values), nil
}

// ReleaseDue devolve as declarações que saem no tick que leva o mercado ao dia `newDay`.
func (s *Service) ReleaseDue(ctx context.Context, newDay int) ([]ReleaseOrder, error) {
	pendings, err := s.repo.ListPending(ctx)
	if err != nil {
		return nil, err
	}
	if len(pendings) == 0 {
		return nil, nil
	}
	values, err := s.settings.Current(ctx)
	if err != nil {
		return nil, err
	}
	var orders []ReleaseOrder
	for _, p := range pendings {
		if reason, ok := ReleaseReasonFor(p, newDay, values.GovernanceDeclarationSafetyDays); ok {
			orders = append(orders, ReleaseOrder{
				ID: p.ID, CompanyID: p.CompanyID, CycleIndex: p.CycleIndex, PoolNetIncome: p.PoolNetIncome, Reason: reason,
			})
		}
	}
	return orders, nil
}

// PendingView é uma declaração retida como o backend a vê.
type PendingView struct {
	Pending
	// SafetyDeadlineDay é o dia simulado em que a declaração sai sozinha.
	SafetyDeadlineDay int
}

// ListPending devolve as declarações retidas (as que ainda não saíram), para o backend abrir a
// assembleia de destinação do lucro.
func (s *Service) ListPending(ctx context.Context) ([]PendingView, error) {
	pendings, err := s.repo.ListPending(ctx)
	if err != nil {
		return nil, err
	}
	values, err := s.settings.Current(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]PendingView, 0, len(pendings))
	for _, p := range pendings {
		out = append(out, PendingView{Pending: p, SafetyDeadlineDay: SafetyDeadline(p.HeldDay, values.GovernanceDeclarationSafetyDays)})
	}
	return out, nil
}

// RequestRelease pede a liberação de uma declaração retida (a assembleia fechou sem decisão, o
// recurso está desligado ou pausado, ou o painel liberou). O dividendo sai no próximo tick, com
// o payout vigente. Idempotente: repetir mantém o primeiro motivo.
func (s *Service) RequestRelease(ctx context.Context, id string, reason ReleaseReason) error {
	if id == "" {
		return fmt.Errorf("%w: declaração é obrigatória", ErrInvalidInput)
	}
	if reason != ReleaseNoDecision && reason != ReleaseAdmin {
		return fmt.Errorf("%w: motivo da liberação precisa ser no_decision ou admin", ErrInvalidInput)
	}
	return s.repo.RequestRelease(ctx, id, reason)
}
