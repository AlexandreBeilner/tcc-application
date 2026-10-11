package corporategovernance

import (
	"errors"
	"fmt"
)

// Status é o estado de uma decisão no motor.
type Status string

const (
	// StatusScheduled: efeito aplicando aos poucos (ou prestes a começar).
	StatusScheduled Status = "scheduled"
	// StatusCompleted: rampa inteira aplicada.
	StatusCompleted Status = "completed"
	// StatusSkippedCooldown: a empresa mudou há pouco; a decisão fica registrada e nada muda.
	StatusSkippedCooldown Status = "skipped_cooldown"
	// StatusSkippedOutOfRange: o efeito levaria o fundamento para fora da faixa válida.
	StatusSkippedOutOfRange Status = "skipped_out_of_range"
)

// CompanyState é o que o planejamento precisa saber da empresa no momento da decisão.
type CompanyState struct {
	// BaseGrowthPct e QualityMultiplier em centésimos.
	BaseGrowthPct     int
	QualityMultiplier int
	// LastEffectStartDay é o dia em que começou o último efeito aplicado (ou em aplicação)
	// da empresa; nil se nunca houve.
	LastEffectStartDay *int
	// Today é o dia simulado corrente (o efeito começa no tick seguinte).
	Today int
}

// Plan é o que o motor vai fazer com uma decisão.
type Plan struct {
	Status     Status
	TotalDelta int
	RampTicks  int
	StartDay   int
}

// InCooldown diz se a empresa mudou há menos de `cooldownDays` dias simulados. Cooldown 0
// desliga a trava.
func InCooldown(lastStartDay *int, today, cooldownDays int) bool {
	return lastStartDay != nil && cooldownDays > 0 && today-*lastStartDay < cooldownDays
}

// PlanDecision decide o que fazer com uma decisão aprovada: respeita o cooldown por empresa,
// calcula a mudança total dentro da faixa máxima e confere que o resultado final é um valor
// válido. Função pura: mesmo estado e mesmos parâmetros, mesmo plano.
func PlanDecision(c CompanyState, e Effect, l Limits, rampTicks, cooldownDays int) (Plan, error) {
	if err := e.Validate(); err != nil {
		return Plan{}, err
	}
	if rampTicks < 1 {
		return Plan{}, errors.New("a rampa precisa de pelo menos 1 tick")
	}
	plan := Plan{Status: StatusScheduled, RampTicks: rampTicks, StartDay: c.Today + 1}
	if InCooldown(c.LastEffectStartDay, c.Today, cooldownDays) {
		plan.Status = StatusSkippedCooldown
		return plan, nil
	}
	plan.TotalDelta = TotalDelta(e, l)
	current := c.BaseGrowthPct
	if e.Metric == MetricQualityMultiplier {
		current = c.QualityMultiplier
	}
	if err := CheckValue(e.Metric, current+plan.TotalDelta); err != nil {
		plan.Status = StatusSkippedOutOfRange
		plan.TotalDelta = 0
		return plan, nil
	}
	if plan.TotalDelta == 0 {
		return Plan{}, fmt.Errorf("a faixa máxima da métrica %q é zero", e.Metric)
	}
	return plan, nil
}
