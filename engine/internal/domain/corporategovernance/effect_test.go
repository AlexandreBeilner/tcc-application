package corporategovernance

import (
	"errors"
	"testing"
)

func TestEffect_Validate(t *testing.T) {
	tests := []struct {
		name string
		e    Effect
		want error
	}{
		{"crescimento válido", Effect{MetricBaseGrowthPct, 1, 1}, nil},
		{"qualidade negativa válida", Effect{MetricQualityMultiplier, -1, 0.5}, nil},
		{"payout válido", Effect{MetricPayoutRatioPct, -1, 1}, nil},
		{"métrica desconhecida", Effect{"price", 1, 1}, ErrInvalidMetric},
		{"direção zero", Effect{MetricBaseGrowthPct, 0, 1}, ErrInvalidDirection},
		{"direção 2", Effect{MetricBaseGrowthPct, 2, 1}, ErrInvalidDirection},
		{"intensidade zero", Effect{MetricBaseGrowthPct, 1, 0}, ErrInvalidIntensity},
		{"intensidade acima de 1", Effect{MetricBaseGrowthPct, 1, 1.01}, ErrInvalidIntensity},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.e.Validate(); !errors.Is(got, tt.want) {
				t.Errorf("Validate() = %v, esperado %v", got, tt.want)
			}
		})
	}
}

func TestTotalDelta_NuncaPassaDaFaixa(t *testing.T) {
	limits := Limits{GrowthStep: 50, QualityStep: 5, PayoutStep: 1000}
	tests := []struct {
		name string
		e    Effect
		want int
	}{
		{"faixa cheia de crescimento", Effect{MetricBaseGrowthPct, 1, 1}, 50},
		{"metade da faixa, para baixo", Effect{MetricBaseGrowthPct, -1, 0.5}, -25},
		{"faixa cheia de qualidade", Effect{MetricQualityMultiplier, 1, 1}, 5},
		{"qualidade com arredondamento", Effect{MetricQualityMultiplier, -1, 0.5}, -3},
		{"intensidade mínima ainda mexe", Effect{MetricBaseGrowthPct, 1, 0.02}, 1},
		{"payout, degrau cheio de 10 p.p.", Effect{MetricPayoutRatioPct, 1, 1}, 1000},
		{"payout, para baixo, 30% do degrau", Effect{MetricPayoutRatioPct, -1, 0.3}, -300},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := TotalDelta(tt.e, limits)
			if got != tt.want {
				t.Errorf("TotalDelta = %d, esperado %d", got, tt.want)
			}
			step := limits.GrowthStep
			switch tt.e.Metric {
			case MetricQualityMultiplier:
				step = limits.QualityStep
			case MetricPayoutRatioPct:
				step = limits.PayoutStep
			}
			if got > step || got < -step {
				t.Errorf("TotalDelta %d passou da faixa %d", got, step)
			}
		})
	}
}

func TestCheckValue(t *testing.T) {
	tests := []struct {
		name    string
		metric  Metric
		value   int
		wantErr bool
	}{
		{"crescimento normal", MetricBaseGrowthPct, 300, false},
		{"crescimento negativo ainda válido", MetricBaseGrowthPct, -50, false},
		{"crescimento zera o fator", MetricBaseGrowthPct, -10000, true},
		{"qualidade neutra", MetricQualityMultiplier, 100, false},
		{"qualidade no teto", MetricQualityMultiplier, 200, false},
		{"qualidade acima do teto", MetricQualityMultiplier, 201, true},
		{"qualidade zero", MetricQualityMultiplier, 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := CheckValue(tt.metric, tt.value)
			if (err != nil) != tt.wantErr {
				t.Errorf("CheckValue(%s, %d) = %v, wantErr=%v", tt.metric, tt.value, err, tt.wantErr)
			}
			if tt.wantErr && !errors.Is(err, ErrOutOfRange) {
				t.Errorf("erro %v não é ErrOutOfRange", err)
			}
		})
	}
}

func TestCheckValueWithLimits_Payout(t *testing.T) {
	l := Limits{PayoutMin: 2000, PayoutMax: 9000}
	for value, wantErr := range map[int]bool{1999: true, 2000: false, 5000: false, 9000: false, 9001: true} {
		err := CheckValueWithLimits(MetricPayoutRatioPct, value, l)
		if (err != nil) != wantErr {
			t.Errorf("payout %d: erro = %v, esperado erro=%v", value, err, wantErr)
		}
		if wantErr && !errors.Is(err, ErrOutOfRange) {
			t.Errorf("payout %d: %v não é ErrOutOfRange", value, err)
		}
	}
}

func TestGroupOf(t *testing.T) {
	if GroupOf(MetricPayoutRatioPct) != GroupPayout || GroupOf(MetricBaseGrowthPct) != GroupFundamentals || GroupOf(MetricQualityMultiplier) != GroupFundamentals {
		t.Error("crescimento e qualidade dividem o cooldown de fundamentos; o payout tem o seu")
	}
}

func TestHundredths_IdaEVolta(t *testing.T) {
	for _, v := range []float64{0, 0.01, 1, 3.07, 3.1, 1.15, -0.29, 12.34} {
		if got := FromHundredths(ToHundredths(v)); got != v {
			t.Errorf("ida e volta de %v = %v", v, got)
		}
	}
}
