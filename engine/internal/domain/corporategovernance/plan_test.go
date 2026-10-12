package corporategovernance

import (
	"errors"
	"testing"
)

func intPtr(v int) *int { return &v }

func TestInCooldown(t *testing.T) {
	tests := []struct {
		name     string
		last     *int
		today    int
		cooldown int
		want     bool
	}{
		{"nunca mudou", nil, 100, 90, false},
		{"mudou ontem", intPtr(99), 100, 90, true},
		{"um dia antes de liberar", intPtr(11), 100, 90, true},
		{"liberou exatamente", intPtr(10), 100, 90, false},
		{"muito tempo atrás", intPtr(1), 500, 90, false},
		{"cooldown zero desliga a trava", intPtr(99), 100, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := InCooldown(tt.last, tt.today, tt.cooldown); got != tt.want {
				t.Errorf("InCooldown = %v, esperado %v", got, tt.want)
			}
		})
	}
}

var testCooldowns = Cooldowns{Fundamentals: 90, Payout: 90}

func lastAt(g Group, day int) map[Group]int { return map[Group]int{g: day} }

func TestPlanDecision(t *testing.T) {
	limits := Limits{GrowthStep: 50, QualityStep: 5, PayoutStep: 1000, PayoutMin: 2000, PayoutMax: 9000}
	growthUp := Effect{MetricBaseGrowthPct, 1, 1, ""}
	base := CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, PayoutRatioPct: 5000, Today: 40}
	one := func(t *testing.T, c CompanyState, e Effect, l Limits, ramp int, cd Cooldowns) (Plan, error) {
		t.Helper()
		plans, err := PlanDecision(c, []Effect{e}, l, ramp, cd)
		if err != nil {
			return Plan{}, err
		}
		return plans[0], nil
	}

	t.Run("agenda a rampa a partir do tick seguinte", func(t *testing.T) {
		plan, err := one(t, base, growthUp, limits, 30, testCooldowns)
		if err != nil {
			t.Fatal(err)
		}
		want := Plan{Status: StatusScheduled, TotalDelta: 50, RampTicks: 30, StartDay: 41}
		if plan != want {
			t.Errorf("plano = %+v, esperado %+v", plan, want)
		}
	})

	t.Run("cooldown registra e não muda nada", func(t *testing.T) {
		c := base
		c.LastStartDay = lastAt(GroupFundamentals, 10)
		plan, err := one(t, c, growthUp, limits, 30, testCooldowns)
		if err != nil {
			t.Fatal(err)
		}
		if plan.Status != StatusSkippedCooldown || plan.TotalDelta != 0 {
			t.Errorf("plano = %+v", plan)
		}
	})

	t.Run("passou do cooldown volta a valer", func(t *testing.T) {
		c := base
		c.Today = 100
		c.LastStartDay = lastAt(GroupFundamentals, 10)
		plan, _ := one(t, c, growthUp, limits, 30, testCooldowns)
		if plan.Status != StatusScheduled {
			t.Errorf("status = %s", plan.Status)
		}
	})

	t.Run("fora da faixa válida é registrado e ignorado", func(t *testing.T) {
		c := base
		c.QualityMultiplier = 200
		plan, err := one(t, c, Effect{MetricQualityMultiplier, 1, 1, ""}, limits, 30, testCooldowns)
		if err != nil {
			t.Fatal(err)
		}
		if plan.Status != StatusSkippedOutOfRange || plan.TotalDelta != 0 {
			t.Errorf("plano = %+v", plan)
		}
	})

	t.Run("efeito inválido é erro", func(t *testing.T) {
		if _, err := one(t, base, Effect{"price", 1, 1, ""}, limits, 30, testCooldowns); err == nil {
			t.Error("esperava erro")
		}
	})

	t.Run("rampa zero é erro", func(t *testing.T) {
		if _, err := one(t, base, growthUp, limits, 0, testCooldowns); err == nil {
			t.Error("esperava erro")
		}
	})

	t.Run("faixa zero é erro (configuração quebrada)", func(t *testing.T) {
		if _, err := one(t, base, growthUp, Limits{}, 30, testCooldowns); err == nil {
			t.Error("esperava erro")
		}
	})

	t.Run("determinístico", func(t *testing.T) {
		a, _ := one(t, base, growthUp, limits, 30, testCooldowns)
		b, _ := one(t, base, growthUp, limits, 30, testCooldowns)
		if a != b {
			t.Errorf("planos diferentes: %+v e %+v", a, b)
		}
	})
}

func TestPlanDecision_Payout(t *testing.T) {
	limits := Limits{GrowthStep: 50, QualityStep: 5, PayoutStep: 1000, PayoutMin: 2000, PayoutMax: 9000}
	base := CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, PayoutRatioPct: 5000, Today: 40}
	for name, tt := range map[string]struct {
		state CompanyState
		e     Effect
		want  Plan
	}{
		"sobe um degrau cheio, sem rampa (1 tick)": {base, Effect{MetricPayoutRatioPct, 1, 1, ""}, Plan{StatusScheduled, 1000, 1, 41}},
		"desce meio degrau":                        {base, Effect{MetricPayoutRatioPct, -1, 0.5, ""}, Plan{StatusScheduled, -500, 1, 41}},
		"passaria do teto de 90%": {
			CompanyState{PayoutRatioPct: 8500, Today: 40}, Effect{MetricPayoutRatioPct, 1, 1, ""}, Plan{Status: StatusSkippedOutOfRange, RampTicks: 1, StartDay: 41},
		},
		"passaria do piso de 20%": {
			CompanyState{PayoutRatioPct: 2500, Today: 40}, Effect{MetricPayoutRatioPct, -1, 1, ""}, Plan{Status: StatusSkippedOutOfRange, RampTicks: 1, StartDay: 41},
		},
		"chega exatamente no teto": {
			CompanyState{PayoutRatioPct: 8000, Today: 40}, Effect{MetricPayoutRatioPct, 1, 1, ""}, Plan{StatusScheduled, 1000, 1, 41},
		},
	} {
		t.Run(name, func(t *testing.T) {
			plans, err := PlanDecision(tt.state, []Effect{tt.e}, limits, 30, testCooldowns)
			if err != nil {
				t.Fatal(err)
			}
			if plans[0] != tt.want {
				t.Errorf("plano = %+v, esperado %+v", plans[0], tt.want)
			}
		})
	}
}

// O payout tem cooldown próprio: uma mudança de fundamentos recente não o trava, e vice-versa.
func TestPlanDecision_CooldownPorGrupo(t *testing.T) {
	limits := Limits{GrowthStep: 50, QualityStep: 5, PayoutStep: 1000, PayoutMin: 2000, PayoutMax: 9000}
	effects := []Effect{{MetricBaseGrowthPct, 1, 1, ""}, {MetricPayoutRatioPct, -1, 1, ""}}
	base := CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, PayoutRatioPct: 5000, Today: 40}

	for name, tt := range map[string]struct {
		last       map[Group]int
		wantGrowth Status
		wantPayout Status
	}{
		"sem histórico":        {nil, StatusScheduled, StatusScheduled},
		"só fundamentos mudou": {lastAt(GroupFundamentals, 30), StatusSkippedCooldown, StatusScheduled},
		"só payout mudou":      {lastAt(GroupPayout, 30), StatusScheduled, StatusSkippedCooldown},
		"os dois mudaram":      {map[Group]int{GroupFundamentals: 30, GroupPayout: 30}, StatusSkippedCooldown, StatusSkippedCooldown},
	} {
		t.Run(name, func(t *testing.T) {
			c := base
			c.LastStartDay = tt.last
			plans, err := PlanDecision(c, effects, limits, 30, testCooldowns)
			if err != nil {
				t.Fatal(err)
			}
			if plans[0].Status != tt.wantGrowth || plans[1].Status != tt.wantPayout {
				t.Errorf("status = %s e %s, esperado %s e %s", plans[0].Status, plans[1].Status, tt.wantGrowth, tt.wantPayout)
			}
		})
	}

	t.Run("cooldowns com durações diferentes", func(t *testing.T) {
		c := base
		c.LastStartDay = map[Group]int{GroupFundamentals: 30, GroupPayout: 30}
		plans, _ := PlanDecision(c, effects, limits, 30, Cooldowns{Fundamentals: 90, Payout: 5})
		if plans[0].Status != StatusSkippedCooldown || plans[1].Status != StatusScheduled {
			t.Errorf("status = %s e %s", plans[0].Status, plans[1].Status)
		}
	})
}

func TestPlanDecision_EfeitoComposto(t *testing.T) {
	limits := Limits{GrowthStep: 50, QualityStep: 5, PayoutStep: 1000, PayoutMin: 2000, PayoutMax: 9000}
	base := CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, PayoutRatioPct: 5000, Today: 40}

	t.Run("dois efeitos em alavancas diferentes, cada um com o seu plano", func(t *testing.T) {
		plans, err := PlanDecision(base, []Effect{{MetricPayoutRatioPct, -1, 1, ""}, {MetricBaseGrowthPct, 1, 0.5, ""}}, limits, 30, testCooldowns)
		if err != nil {
			t.Fatal(err)
		}
		if plans[0].TotalDelta != -1000 || plans[0].RampTicks != 1 || plans[1].TotalDelta != 25 || plans[1].RampTicks != 30 {
			t.Errorf("planos = %+v", plans)
		}
	})

	t.Run("um efeito fora da faixa não impede o outro", func(t *testing.T) {
		c := base
		c.PayoutRatioPct = 9000
		plans, _ := PlanDecision(c, []Effect{{MetricPayoutRatioPct, 1, 1, ""}, {MetricBaseGrowthPct, 1, 1, ""}}, limits, 30, testCooldowns)
		if plans[0].Status != StatusSkippedOutOfRange || plans[1].Status != StatusScheduled {
			t.Errorf("status = %s e %s", plans[0].Status, plans[1].Status)
		}
	})

	for name, effects := range map[string][]Effect{
		"mesma alavanca duas vezes": {{MetricBaseGrowthPct, 1, 1, ""}, {MetricBaseGrowthPct, -1, 1, ""}},
		"três efeitos":              {{MetricBaseGrowthPct, 1, 1, ""}, {MetricQualityMultiplier, 1, 1, ""}, {MetricPayoutRatioPct, 1, 1, ""}},
		"nenhum efeito":             nil,
	} {
		t.Run(name+" é erro", func(t *testing.T) {
			if _, err := PlanDecision(base, effects, limits, 30, testCooldowns); !errors.Is(err, ErrInvalidEffects) {
				t.Errorf("erro = %v, esperado ErrInvalidEffects", err)
			}
		})
	}
}

func TestPlanDecision_PoliticaEPremioDaPN(t *testing.T) {
	limits := Limits{GrowthStep: 50, QualityStep: 5, PayoutStep: 1000, PayoutMin: 2000, PayoutMax: 9000, PremiumStep: 500, PremiumMin: 1000, PremiumMax: 3000}
	base := CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, PayoutRatioPct: 5000, PnPremiumPct: 1000, DividendPolicy: "quarterly", HasPN: true, Today: 40}
	semiannual := Effect{Metric: MetricDividendPolicy, Value: "semiannual"}
	premiumUp := Effect{Metric: MetricPnPremiumPct, Direction: 1, Intensity: 1}

	for name, tt := range map[string]struct {
		state CompanyState
		e     Effect
		want  Plan
	}{
		"política nova vale no tick seguinte, sem rampa":    {base, semiannual, Plan{Status: StatusScheduled, RampTicks: 1, StartDay: 41}},
		"política que já é a da empresa não muda nada":      {func() CompanyState { c := base; c.DividendPolicy = "semiannual"; return c }(), semiannual, Plan{Status: StatusSkippedNotApplicable, RampTicks: 1, StartDay: 41}},
		"prêmio sobe um degrau de 5 p.p.":                   {base, premiumUp, Plan{Status: StatusScheduled, TotalDelta: 500, RampTicks: 1, StartDay: 41}},
		"prêmio nunca fica abaixo do piso legal de 10%":     {base, Effect{Metric: MetricPnPremiumPct, Direction: -1, Intensity: 1}, Plan{Status: StatusSkippedOutOfRange, RampTicks: 1, StartDay: 41}},
		"prêmio chega exatamente ao teto de 30%":            {func() CompanyState { c := base; c.PnPremiumPct = 2500; return c }(), premiumUp, Plan{Status: StatusScheduled, TotalDelta: 500, RampTicks: 1, StartDay: 41}},
		"prêmio passaria do teto":                           {func() CompanyState { c := base; c.PnPremiumPct = 2800; return c }(), premiumUp, Plan{Status: StatusSkippedOutOfRange, RampTicks: 1, StartDay: 41}},
		"empresa só com ON não tem prêmio da PN para mudar": {func() CompanyState { c := base; c.HasPN = false; return c }(), premiumUp, Plan{Status: StatusSkippedNotApplicable, RampTicks: 1, StartDay: 41}},
	} {
		t.Run(name, func(t *testing.T) {
			plans, err := PlanDecision(tt.state, []Effect{tt.e}, limits, 30, testCooldowns)
			if err != nil {
				t.Fatal(err)
			}
			if plans[0] != tt.want {
				t.Errorf("plano = %+v, esperado %+v", plans[0], tt.want)
			}
		})
	}

	t.Run("os três compartilham o cooldown de destinação do lucro", func(t *testing.T) {
		c := base
		c.LastStartDay = lastAt(GroupPayout, 30)
		for _, e := range []Effect{semiannual, premiumUp, {Metric: MetricPayoutRatioPct, Direction: 1, Intensity: 1}} {
			plans, _ := PlanDecision(c, []Effect{e}, limits, 30, testCooldowns)
			if plans[0].Status != StatusSkippedCooldown {
				t.Errorf("%s: status = %s, esperado skipped_cooldown", e.Metric, plans[0].Status)
			}
		}
		// Crescimento tem o seu.
		plans, _ := PlanDecision(c, []Effect{{Metric: MetricBaseGrowthPct, Direction: 1, Intensity: 1}}, limits, 30, testCooldowns)
		if plans[0].Status != StatusScheduled {
			t.Errorf("crescimento não deveria travar: %s", plans[0].Status)
		}
	})

	t.Run("composto: payout e política juntos, mesma alavanca duas vezes não", func(t *testing.T) {
		plans, err := PlanDecision(base, []Effect{{Metric: MetricPayoutRatioPct, Direction: 1, Intensity: 1}, semiannual}, limits, 30, testCooldowns)
		if err != nil || plans[0].TotalDelta != 1000 || plans[1].Status != StatusScheduled {
			t.Errorf("planos = %+v err=%v", plans, err)
		}
		if _, err := PlanDecision(base, []Effect{semiannual, {Metric: MetricDividendPolicy, Value: "annual"}}, limits, 30, testCooldowns); !errors.Is(err, ErrInvalidEffects) {
			t.Errorf("política duas vezes: %v", err)
		}
	})
}

func TestEffect_Validate_PoliticaDeDividendo(t *testing.T) {
	for value, wantErr := range map[string]bool{"quarterly": false, "semiannual": false, "annual": false, "": true, "mensal": true} {
		err := Effect{Metric: MetricDividendPolicy, Value: value}.Validate()
		if (err != nil) != wantErr {
			t.Errorf("política %q: erro = %v, esperado erro=%v", value, err, wantErr)
		}
		if wantErr && !errors.Is(err, ErrInvalidValue) {
			t.Errorf("política %q: %v não é ErrInvalidValue", value, err)
		}
	}
	// Sentido e intensidade não se aplicam ao efeito discreto.
	if err := (Effect{Metric: MetricDividendPolicy, Value: "annual", Direction: 7, Intensity: 99}).Validate(); err != nil {
		t.Errorf("efeito discreto ignora sentido e intensidade: %v", err)
	}
	if got := TotalDelta(Effect{Metric: MetricDividendPolicy, Value: "annual"}, Limits{GrowthStep: 50}); got != 0 {
		t.Errorf("TotalDelta da política = %d, esperado 0", got)
	}
	for policy, cycles := range map[string]int{"quarterly": 1, "semiannual": 2, "annual": 4, "x": 0} {
		if PolicyCycles(policy) != cycles {
			t.Errorf("PolicyCycles(%q) = %d, esperado %d", policy, PolicyCycles(policy), cycles)
		}
	}
}
