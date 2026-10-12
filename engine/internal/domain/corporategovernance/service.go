package corporategovernance

import (
	"context"
	"errors"
	"fmt"
	"time"

	"tcc-investimentos/engine/internal/domain/enginesetting"
)

var (
	ErrInvalidInput   = errors.New("entrada inválida")
	ErrUnknownCompany = errors.New("empresa não encontrada")
)

// Holding é a posição de um usuário (ações da empresa somadas entre classes) na data de corte.
type Holding struct {
	UserID   string
	Quantity int64
}

// Snapshot é a foto das posições de uma empresa na abertura da assembleia: só contas de
// usuário (bots ficam de fora). Tirada uma vez por assembleia.
type Snapshot struct {
	AssemblyID   string
	CompanyID    string
	TakenAt      time.Time
	SimulatedDay int
	Holdings     []Holding
}

// DecisionInput é o que o backend manda quando uma assembleia aprova uma opção: de 1 a
// MaxEffectsPerOption efeitos, em alavancas diferentes.
type DecisionInput struct {
	AssemblyID string
	CompanyID  string
	OptionKey  string
	Effects    []Effect
	// DeclarationID, quando informado, liga a decisão à declaração de dividendo retida da
	// empresa: ela sai quando o efeito de destinação do lucro da decisão for aplicado.
	DeclarationID string
}

// EffectRecord é um efeito de uma decisão já registrado, com o andamento da rampa.
type EffectRecord struct {
	ID         string
	AssemblyID string
	Position   int
	Metric     Metric
	Direction  int
	Intensity  float64
	// TargetValue é o valor-alvo de um efeito discreto (política de dividendo).
	TargetValue  string
	Status       Status
	TotalDelta   int
	RampTicks    int
	StartDay     int
	AppliedTicks int
	AppliedDelta int
}

// Decision é a decisão registrada: a opção vencedora e o andamento de cada efeito.
type Decision struct {
	ID         string
	AssemblyID string
	CompanyID  string
	OptionKey  string
	Effects    []EffectRecord
	DecidedAt  time.Time
}

// PlanFunc é executada pelo repositório DENTRO da transação, depois de travar a empresa e
// ler o estado, para o plano usar o estado que de fato vale. Devolve um plano por efeito, na
// ordem da entrada.
type PlanFunc func(CompanyState) ([]Plan, error)

// StepApplication é um passo da rampa a aplicar num efeito.
type StepApplication struct {
	Delta        int
	AppliedTicks int
	Done         bool
}

// Repository persiste snapshot e decisão. Os métodos que escrevem são transacionais e
// idempotentes pelo id da assembleia.
type Repository interface {
	// TakeSnapshot tira o snapshot da assembleia ou devolve o que já existe.
	TakeSnapshot(ctx context.Context, assemblyID, companyID string) (Snapshot, bool, error)
	GetSnapshot(ctx context.Context, assemblyID string) (Snapshot, bool, error)
	// RecordDecision grava um evento em market_events por efeito e a decisão, na mesma
	// transação, depois de chamar plan. `created` é falso se a assembleia já tinha decisão.
	RecordDecision(ctx context.Context, in DecisionInput, plan PlanFunc) (Decision, bool, error)
	GetDecision(ctx context.Context, assemblyID string) (Decision, bool, error)
	ListScheduled(ctx context.Context) ([]EffectRecord, error)
	// ApplyStep aplica um passo na empresa e avança o efeito na mesma transação; só vale se
	// o efeito ainda estava em `previousTicks`. `false` se outro processo chegou antes. `l`
	// traz a faixa válida do payout.
	ApplyStep(ctx context.Context, effectID string, previousTicks int, step StepApplication, l Limits) (bool, error)
	// ListPending devolve as declarações de dividendo retidas (ainda não liberadas), com o
	// andamento da decisão ligada a cada uma.
	ListPending(ctx context.Context) ([]Pending, error)
	// RequestRelease marca uma declaração retida para sair no próximo tick; `ErrUnknownDeclaration`
	// se não existe. Repetir (ou pedir para uma já liberada) não muda nada.
	RequestRelease(ctx context.Context, id string, reason ReleaseReason) error
	// CompanyStanding lê a empresa e a posição ATUAL de `userID` nela (não a do snapshot).
	CompanyStanding(ctx context.Context, companyID, userID string) (StandingRecord, bool, error)
}

// Settings é o que o serviço lê de enginesetting (*enginesetting.Service).
type Settings interface {
	Current(ctx context.Context) (enginesetting.Values, error)
}

// Service orquestra snapshot, decisão e aplicação do efeito.
type Service struct {
	repo      Repository
	settings  Settings
	schedules ScheduleReader
}

func NewService(repo Repository, settings Settings) *Service {
	return &Service{repo: repo, settings: settings}
}

func (s *Service) TakeSnapshot(ctx context.Context, assemblyID, companyID string) (Snapshot, bool, error) {
	if assemblyID == "" || companyID == "" {
		return Snapshot{}, false, fmt.Errorf("%w: assembleia e empresa são obrigatórias", ErrInvalidInput)
	}
	return s.repo.TakeSnapshot(ctx, assemblyID, companyID)
}

func (s *Service) GetSnapshot(ctx context.Context, assemblyID string) (Snapshot, bool, error) {
	return s.repo.GetSnapshot(ctx, assemblyID)
}

func (s *Service) GetDecision(ctx context.Context, assemblyID string) (Decision, bool, error) {
	return s.repo.GetDecision(ctx, assemblyID)
}

// RecordDecision registra a decisão de uma assembleia. Idempotente pelo id da assembleia:
// repetir devolve a decisão original (`created` falso), sem novo evento nem novo efeito.
func (s *Service) RecordDecision(ctx context.Context, in DecisionInput) (Decision, bool, error) {
	if in.AssemblyID == "" || in.CompanyID == "" || in.OptionKey == "" {
		return Decision{}, false, fmt.Errorf("%w: assembleia, empresa e opção são obrigatórias", ErrInvalidInput)
	}
	if err := ValidateEffects(in.Effects); err != nil {
		return Decision{}, false, fmt.Errorf("%w: %v", ErrInvalidInput, err)
	}
	values, err := s.settings.Current(ctx)
	if err != nil {
		return Decision{}, false, err
	}
	limits, cooldowns := LimitsFrom(values), CooldownsFrom(values)
	return s.repo.RecordDecision(ctx, in, func(c CompanyState) ([]Plan, error) {
		return PlanDecision(c, in.Effects, limits, values.GovernanceRampTicks, cooldowns)
	})
}

// LimitsFrom monta as faixas de efeito a partir dos parâmetros vigentes.
func LimitsFrom(v enginesetting.Values) Limits {
	return Limits{
		GrowthStep: v.GovernanceGrowthStepCentiPP, QualityStep: v.GovernanceQualityStepCenti,
		PayoutStep: v.GovernancePayoutStepCentiPP, PayoutMin: v.GovernancePayoutMinPct * 100, PayoutMax: v.GovernancePayoutMaxPct * 100,
		PremiumStep: v.GovernancePremiumStepCentiPP, PremiumMin: v.GovernancePremiumMinPct * 100, PremiumMax: v.GovernancePremiumMaxPct * 100,
	}
}

// CooldownsFrom monta os cooldowns por grupo a partir dos parâmetros vigentes.
func CooldownsFrom(v enginesetting.Values) Cooldowns {
	return Cooldowns{Fundamentals: v.GovernanceCooldownDays, Payout: v.GovernancePayoutCooldownDays}
}

// ApplyDue aplica, no tick que leva o mercado ao dia `newDay`, o passo da rampa de cada
// decisão em andamento. Devolve quantos passos aplicou. Um passo que falha não impede os
// outros; o primeiro erro é devolvido no fim.
func (s *Service) ApplyDue(ctx context.Context, newDay int) (int, error) {
	scheduled, err := s.repo.ListScheduled(ctx)
	if err != nil {
		return 0, err
	}
	if len(scheduled) == 0 {
		return 0, nil
	}
	values, err := s.settings.Current(ctx)
	if err != nil {
		return 0, err
	}
	limits := LimitsFrom(values)
	applied := 0
	var firstErr error
	for _, d := range scheduled {
		elapsed := ElapsedTicks(d.StartDay, newDay, d.RampTicks)
		if elapsed <= d.AppliedTicks {
			continue
		}
		step := StepApplication{
			Delta:        StepDelta(d.TotalDelta, d.RampTicks, d.AppliedTicks, elapsed),
			AppliedTicks: elapsed,
			Done:         elapsed >= d.RampTicks,
		}
		ok, err := s.repo.ApplyStep(ctx, d.ID, d.AppliedTicks, step, limits)
		if err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("decisão %s: %w", d.AssemblyID, err)
			}
			continue
		}
		if ok {
			applied++
		}
	}
	return applied, firstErr
}
