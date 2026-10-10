package fii

import "testing"

func TestNetWorthVariation_JuroAltoReduzJuroBaixoAumenta(t *testing.T) {
	cfg := NetWorthConfig{Sensitivity: 0.03, NoiseStdDev: 0, Seed: 1}

	tests := []struct {
		name         string
		selicRate    float64
		selicNeutral float64
		want         float64
	}{
		{"selic acima da neutra reduz avaliação", 15, 10, -0.03 * 5},
		{"selic abaixo da neutra aumenta avaliação", 5, 10, 0.03 * 5},
		{"selic na neutra sem ruído não varia", 10, 10, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NetWorthVariation(cfg, 0, tt.selicRate, tt.selicNeutral)
			if got != tt.want {
				t.Errorf("NetWorthVariation(%v, %v) = %v, want %v", tt.selicRate, tt.selicNeutral, got, tt.want)
			}
		})
	}
}

func TestNetWorthVariation_DeterministicaPorSeedECycleIndex(t *testing.T) {
	cfg := NetWorthConfig{Sensitivity: 0.03, NoiseStdDev: 0.01, Seed: 7}

	a := NetWorthVariation(cfg, 3, 12, 10)
	b := NetWorthVariation(cfg, 3, 12, 10)
	if a != b {
		t.Fatalf("NetWorthVariation divergiu com mesmos parâmetros: %v != %v", a, b)
	}

	c := NetWorthVariation(cfg, 4, 12, 10)
	if a == c {
		t.Error("NetWorthVariation com cycleIndex diferentes veio idêntica — ruído deveria variar por ciclo")
	}
}

func TestNetWorthVariation_SeedsDiferentesGeramRuidoDiferente(t *testing.T) {
	cfgA := NetWorthConfig{Sensitivity: 0.03, NoiseStdDev: 0.01, Seed: 1}
	cfgB := NetWorthConfig{Sensitivity: 0.03, NoiseStdDev: 0.01, Seed: 2}

	if NetWorthVariation(cfgA, 0, 10, 10) == NetWorthVariation(cfgB, 0, 10, 10) {
		t.Error("seeds diferentes produziram a mesma variação")
	}
}

func TestNextNetWorth_AplicaVariacaoMultiplicativamente(t *testing.T) {
	cfg := NetWorthConfig{Sensitivity: 0.03, NoiseStdDev: 0, Seed: 1}

	got := NextNetWorth(cfg, 0, 500_000_000.0, 15, 10) // 5 p.p. acima da neutra -> -15%
	want := 500_000_000.0 * (1 - 0.03*5)
	if got != want {
		t.Errorf("NextNetWorth = %v, want %v", got, want)
	}
}

func TestNextNetWorth_SemDesvioNemRuidoMantemValor(t *testing.T) {
	cfg := NetWorthConfig{Sensitivity: 0.03, NoiseStdDev: 0, Seed: 1}

	got := NextNetWorth(cfg, 0, 500_000_000.0, 10, 10)
	if got != 500_000_000.0 {
		t.Errorf("NextNetWorth(sem desvio/ruído) = %v, want 500_000_000.0 (inalterado)", got)
	}
}
