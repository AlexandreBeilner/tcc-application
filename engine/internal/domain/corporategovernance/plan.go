package corporategovernance

import (
	"errors"
	"fmt"
)

// Status é o estado de um efeito de decisão no motor.
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
	// StatusSkippedNotApplicable: a decisão não muda nada naquela empresa (a política já é a
	// escolhida, ou a empresa não tem ação PN para ter prêmio).
	StatusSkippedNotApplicable Status = "skipped_not_applicable"
)

// CompanyState é o que o planejamento precisa saber da empresa no momento da decisão.
type CompanyState struct {
	// BaseGrowthPct, QualityMultiplier e PayoutRatioPct em centésimos.
	BaseGrowthPct     int
	QualityMultiplier int
	PayoutRatioPct    int
	// PnPremiumPct em centésimos; DividendPolicy e HasPN descrevem o dividendo da empresa
	// (MO.6.12).
	PnPremiumPct   int
	DividendPolicy string
	HasPN          bool
	// LastStartDay é o dia em que começou o último efeito aplicado (ou em aplicação) de cada
	// grupo de cooldown; grupo ausente = nunca houve.
	LastStartDay map[Group]int
	// Today é o dia simulado corrente (o efeito começa no tick seguinte).
	Today int
}

// Value devolve o valor atual (em centésimos) da métrica.
func (c CompanyState) Value(m Metric) int {
	switch m {
	case MetricQualityMultiplier:
		return c.QualityMultiplier
	case MetricPayoutRatioPct:
		return c.PayoutRatioPct
	case MetricPnPremiumPct:
		return c.PnPremiumPct
	}
	return c.BaseGrowthPct
}

// LastStart devolve o início do último efeito do grupo, ou nil se nunca houve.
func (c CompanyState) LastStart(g Group) *int {
	day, ok := c.LastStartDay[g]
	if !ok {
		return nil
	}
	return &day
}

// Plan é o que o motor vai fazer com um efeito de uma decisão.
type Plan struct {
	Status     Status
	TotalDelta int
	RampTicks  int
	StartDay   int
}

// Cooldowns são os intervalos mínimos, em dias simulados, por grupo.
type Cooldowns struct {
	Fundamentals int
	Payout       int
}

// For devolve o cooldown do grupo da métrica.
func (c Cooldowns) For(m Metric) int {
	if GroupOf(m) == GroupPayout {
		return c.Payout
	}
	return c.Fundamentals
}

// InCooldown diz se a empresa mudou há menos de `cooldownDays` dias simulados. Cooldown 0
// desliga a trava.
func InCooldown(lastStartDay *int, today, cooldownDays int) bool {
	return lastStartDay != nil && cooldownDays > 0 && today-*lastStartDay < cooldownDays
}

// PlanEffect decide o que fazer com um efeito de uma decisão aprovada: respeita o cooldown do
// grupo da métrica, calcula a mudança total dentro da faixa máxima e confere que o resultado
// final é um valor válido. Função pura: mesmo estado e mesmos parâmetros, mesmo plano.
//
// A destinação do lucro (payout, política, prêmio da PN) não tem rampa (vale na próxima
// declaração): vale integralmente no tick seguinte,
// o que no motor é uma rampa de 1 tick, então passa pelo mesmo mecanismo de aplicação.
func PlanEffect(c CompanyState, e Effect, l Limits, rampTicks int, cd Cooldowns) (Plan, error) {
	if err := e.Validate(); err != nil {
		return Plan{}, err
	}
	if rampTicks < 1 {
		return Plan{}, errors.New("a rampa precisa de pelo menos 1 tick")
	}
	if GroupOf(e.Metric) == GroupPayout {
		rampTicks = 1
	}
	plan := Plan{Status: StatusScheduled, RampTicks: rampTicks, StartDay: c.Today + 1}
	if InCooldown(c.LastStart(GroupOf(e.Metric)), c.Today, cd.For(e.Metric)) {
		plan.Status = StatusSkippedCooldown
		return plan, nil
	}
	switch {
	case e.Metric == MetricDividendPolicy:
		// Discreto: troca para o valor-alvo; nada a trocar se já é esse.
		if c.DividendPolicy == e.Value {
			plan.Status = StatusSkippedNotApplicable
		}
		return plan, nil
	case e.Metric == MetricPnPremiumPct && !c.HasPN:
		plan.Status = StatusSkippedNotApplicable
		return plan, nil
	}
	plan.TotalDelta = TotalDelta(e, l)
	if err := CheckValueWithLimits(e.Metric, c.Value(e.Metric)+plan.TotalDelta, l); err != nil {
		plan.Status = StatusSkippedOutOfRange
		plan.TotalDelta = 0
		return plan, nil
	}
	if plan.TotalDelta == 0 {
		return Plan{}, fmt.Errorf("a faixa máxima da métrica %q é zero", e.Metric)
	}
	return plan, nil
}

// PlanDecision planeja todos os efeitos de uma opção, cada um por conta própria: um efeito em
// cooldown ou fora da faixa não impede o outro. Os efeitos são independentes porque mexem em
// alavancas diferentes (ValidateEffects).
func PlanDecision(c CompanyState, effects []Effect, l Limits, rampTicks int, cd Cooldowns) ([]Plan, error) {
	if err := ValidateEffects(effects); err != nil {
		return nil, err
	}
	plans := make([]Plan, 0, len(effects))
	for _, e := range effects {
		p, err := PlanEffect(c, e, l, rampTicks, cd)
		if err != nil {
			return nil, err
		}
		plans = append(plans, p)
	}
	return plans, nil
}
