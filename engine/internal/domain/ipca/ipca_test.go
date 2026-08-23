package ipca

import "testing"

func TestMonthlySeries_DentroDaBanda(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.01, Seed: 1}

	for i, rate := range MonthlySeries(cfg, 1000) {
		if rate < cfg.MonthlyTarget-cfg.MaxDeviation || rate > cfg.MonthlyTarget+cfg.MaxDeviation {
			t.Fatalf("rates[%d] = %v, fora da banda [%v, %v]", i, rate, cfg.MonthlyTarget-cfg.MaxDeviation, cfg.MonthlyTarget+cfg.MaxDeviation)
		}
	}
}

func TestMonthlySeries_DeterministicaPorSeed(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.001, Seed: 42}

	a := MonthlySeries(cfg, 60)
	b := MonthlySeries(cfg, 60)

	if len(a) != len(b) {
		t.Fatalf("len(a) = %d, len(b) = %d", len(a), len(b))
	}
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("série divergiu no índice %d: %v != %v — mesmo seed devia gerar série idêntica", i, a[i], b[i])
		}
	}
}

func TestMonthlySeries_SeedsDiferentesGeramSeriesDiferentes(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.001}
	cfgA := cfg
	cfgA.Seed = 1
	cfgB := cfg
	cfgB.Seed = 2

	a := MonthlySeries(cfgA, 60)
	b := MonthlySeries(cfgB, 60)

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

func TestMonthlySeries_MesesNaoPositivoRetornaNil(t *testing.T) {
	tests := []int{0, -1, -5}
	for _, months := range tests {
		cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.001, Seed: 1}
		if got := MonthlySeries(cfg, months); got != nil {
			t.Errorf("MonthlySeries(months=%d) = %v, want nil", months, got)
		}
	}
}

func TestMonthlySeries_SemRuidoFicaExatamenteNaMeta(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.0045, MaxDeviation: 0.002, Volatility: 0, Seed: 1}

	for i, rate := range MonthlySeries(cfg, 24) {
		if rate != cfg.MonthlyTarget {
			t.Fatalf("rates[%d] = %v, want %v (sem ruído, deveria ficar exatamente na meta)", i, rate, cfg.MonthlyTarget)
		}
	}
}
