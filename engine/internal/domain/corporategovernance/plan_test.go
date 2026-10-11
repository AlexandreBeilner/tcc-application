package corporategovernance

import "testing"

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

func TestPlanDecision(t *testing.T) {
	limits := Limits{GrowthStep: 50, QualityStep: 5}
	growthUp := Effect{MetricBaseGrowthPct, 1, 1}
	base := CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, Today: 40}

	t.Run("agenda a rampa a partir do tick seguinte", func(t *testing.T) {
		plan, err := PlanDecision(base, growthUp, limits, 30, 90)
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
		c.LastEffectStartDay = intPtr(10)
		plan, err := PlanDecision(c, growthUp, limits, 30, 90)
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
		c.LastEffectStartDay = intPtr(10)
		plan, _ := PlanDecision(c, growthUp, limits, 30, 90)
		if plan.Status != StatusScheduled {
			t.Errorf("status = %s", plan.Status)
		}
	})

	t.Run("fora da faixa válida é registrado e ignorado", func(t *testing.T) {
		c := base
		c.QualityMultiplier = 200
		plan, err := PlanDecision(c, Effect{MetricQualityMultiplier, 1, 1}, limits, 30, 90)
		if err != nil {
			t.Fatal(err)
		}
		if plan.Status != StatusSkippedOutOfRange || plan.TotalDelta != 0 {
			t.Errorf("plano = %+v", plan)
		}
	})

	t.Run("efeito inválido é erro", func(t *testing.T) {
		if _, err := PlanDecision(base, Effect{"price", 1, 1}, limits, 30, 90); err == nil {
			t.Error("esperava erro")
		}
	})

	t.Run("rampa zero é erro", func(t *testing.T) {
		if _, err := PlanDecision(base, growthUp, limits, 0, 90); err == nil {
			t.Error("esperava erro")
		}
	})

	t.Run("faixa zero é erro (configuração quebrada)", func(t *testing.T) {
		if _, err := PlanDecision(base, growthUp, Limits{}, 30, 90); err == nil {
			t.Error("esperava erro")
		}
	})

	t.Run("determinístico", func(t *testing.T) {
		a, _ := PlanDecision(base, growthUp, limits, 30, 90)
		b, _ := PlanDecision(base, growthUp, limits, 30, 90)
		if a != b {
			t.Errorf("planos diferentes: %+v e %+v", a, b)
		}
	})
}
