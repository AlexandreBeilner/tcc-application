package etf

import (
	"errors"
	"testing"
)

func validHoldings() []Holding {
	return []Holding{
		{ConstituentName: "PETR4", WeightPct: 40},
		{ConstituentName: "VALE3", WeightPct: 35},
		{ConstituentName: "ITUB4", WeightPct: 25},
	}
}

func TestNewDetails_ValidoComPesosSomando100(t *testing.T) {
	got, err := NewDetails("IBOVESPA", "Replicação física, ponderação por valor de mercado", validHoldings())
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if got.BenchmarkIndex != "IBOVESPA" {
		t.Errorf("BenchmarkIndex = %q, want %q", got.BenchmarkIndex, "IBOVESPA")
	}
	if len(got.Holdings) != 3 {
		t.Errorf("len(Holdings) = %d, want 3", len(got.Holdings))
	}
}

func TestNewDetails_MethodologySummaryOpcional(t *testing.T) {
	got, err := NewDetails("IBOVESPA", "", validHoldings())
	if err != nil {
		t.Fatalf("err = %v, want nil (methodology_summary é opcional no schema)", err)
	}
	if got.MethodologySummary != "" {
		t.Errorf("MethodologySummary = %q, want vazio", got.MethodologySummary)
	}
}

func TestNewDetails_PesosDentroDaToleranciaSaoAceitos(t *testing.T) {
	tests := []struct {
		name    string
		weights []float64
	}{
		{name: "exatamente 100", weights: []float64{100}},
		{name: "levemente abaixo, dentro da tolerância", weights: []float64{99.7}},
		{name: "levemente acima, dentro da tolerância", weights: []float64{100.3}},
		{name: "no limite exato da tolerância", weights: []float64{100 + WeightTolerance}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			holdings := make([]Holding, len(tt.weights))
			for i, w := range tt.weights {
				holdings[i] = Holding{ConstituentName: "X", WeightPct: w}
			}

			if _, err := NewDetails("IBOVESPA", "", holdings); err != nil {
				t.Errorf("err = %v, want nil", err)
			}
		})
	}
}

func TestNewDetails_PesosForaDaToleranciaSaoRejeitados(t *testing.T) {
	tests := []struct {
		name    string
		weights []float64
	}{
		{name: "muito abaixo de 100", weights: []float64{90}},
		{name: "muito acima de 100", weights: []float64{110}},
		{name: "logo além da tolerância", weights: []float64{100 + WeightTolerance + 0.01}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			holdings := make([]Holding, len(tt.weights))
			for i, w := range tt.weights {
				holdings[i] = Holding{ConstituentName: "X", WeightPct: w}
			}

			_, err := NewDetails("IBOVESPA", "", holdings)
			if !errors.Is(err, ErrWeightsDoNotSumTo100) {
				t.Errorf("err = %v, want ErrWeightsDoNotSumTo100", err)
			}
		})
	}
}

func TestNewDetails_SemIndiceDeReferencia(t *testing.T) {
	_, err := NewDetails("", "metodologia qualquer", validHoldings())
	if !errors.Is(err, ErrMissingBenchmarkIndex) {
		t.Errorf("err = %v, want ErrMissingBenchmarkIndex", err)
	}
}

func TestNewDetails_SemHoldings(t *testing.T) {
	_, err := NewDetails("IBOVESPA", "metodologia qualquer", nil)
	if !errors.Is(err, ErrNoHoldings) {
		t.Errorf("err = %v, want ErrNoHoldings", err)
	}
}
