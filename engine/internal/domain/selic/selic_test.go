package selic

import (
	"math"
	"testing"
)

func TestSeries_ReversaoAMediaSemRuido(t *testing.T) {
	// Volatility = 0 remove o ruído estocástico, deixando só a fórmula de
	// reversão à média — permite conferir os valores exatos, no mesmo
	// espírito do teste numérico da tarefa 2.3 (deságio do TCC).
	cfg := Config{Initial: 20, Neutral: 10, ReversionSpeed: 0.5, Volatility: 0, Seed: 1}

	got := Series(cfg, 4)
	want := []float64{15, 12.5, 11.25, 10.625}

	if len(got) != len(want) {
		t.Fatalf("len(got) = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if math.Abs(got[i]-want[i]) > 1e-9 {
			t.Errorf("got[%d] = %v, want %v", i, got[i], want[i])
		}
	}
}

func TestSeries_DeterministicaPorSeed(t *testing.T) {
	cfg := DefaultConfig(10.75, 42)

	a := Series(cfg, 100)
	b := Series(cfg, 100)

	if len(a) != len(b) {
		t.Fatalf("len(a) = %d, len(b) = %d", len(a), len(b))
	}
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("série divergiu no índice %d: %v != %v — mesmo seed devia gerar série idêntica", i, a[i], b[i])
		}
	}
}

func TestSeries_SeedsDiferentesGeramSeriesDiferentes(t *testing.T) {
	a := Series(DefaultConfig(10.75, 1), 50)
	b := Series(DefaultConfig(10.75, 2), 50)

	identical := true
	for i := range a {
		if a[i] != b[i] {
			identical = false
			break
		}
	}
	if identical {
		t.Error("séries com seeds diferentes vieram idênticas")
	}
}

func TestSeries_NuncaNegativa(t *testing.T) {
	cfg := Config{Initial: 0.5, Neutral: 0, ReversionSpeed: 0.1, Volatility: 5, Seed: 7}

	for i, rate := range Series(cfg, 1000) {
		if rate < 0 {
			t.Fatalf("rates[%d] = %v, Selic simulada não pode ser negativa", i, rate)
		}
	}
}

func TestSeries_StepsNaoPositivo(t *testing.T) {
	tests := []int{0, -1, -10}
	for _, steps := range tests {
		if got := Series(DefaultConfig(10, 1), steps); got != nil {
			t.Errorf("Series(steps=%d) = %v, want nil", steps, got)
		}
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig(10.75, 99)

	if cfg.Initial != 10.75 {
		t.Errorf("Initial = %v, want 10.75", cfg.Initial)
	}
	if cfg.Neutral != DefaultNeutralRate {
		t.Errorf("Neutral = %v, want %v", cfg.Neutral, DefaultNeutralRate)
	}
	if cfg.ReversionSpeed != DefaultReversionSpeed {
		t.Errorf("ReversionSpeed = %v, want %v", cfg.ReversionSpeed, DefaultReversionSpeed)
	}
	if cfg.Volatility != DefaultDailyVolatility {
		t.Errorf("Volatility = %v, want %v", cfg.Volatility, DefaultDailyVolatility)
	}
	if cfg.Seed != 99 {
		t.Errorf("Seed = %v, want 99", cfg.Seed)
	}
}
