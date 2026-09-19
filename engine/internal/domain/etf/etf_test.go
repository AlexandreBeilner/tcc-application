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

func assetID(id string) *string { return &id }

func TestNewDetails_CestaMistaComEHoldingsSemAssetID(t *testing.T) {
	holdings := []Holding{
		{ConstituentName: "VALR3", AssetID: assetID("ativo-acao"), WeightPct: 40},
		{ConstituentName: "TJLO11", AssetID: assetID("ativo-fii"), WeightPct: 35},
		// Constituinte cosmético (H.4): sem asset_id, continua válido —
		// entra na tela de detalhe, nunca no NAV/rebalanceamento real.
		{ConstituentName: "Outros", WeightPct: 25},
	}

	got, err := NewDetails("Índice Misto", "", holdings)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(got.Holdings) != 3 {
		t.Errorf("len(Holdings) = %d, want 3", len(got.Holdings))
	}
}

func TestNewDetails_AssetIDVazioRejeitado(t *testing.T) {
	empty := ""
	holdings := []Holding{
		{ConstituentName: "X", AssetID: &empty, WeightPct: 100},
	}

	_, err := NewDetails("IBOVESPA", "", holdings)
	if !errors.Is(err, ErrEmptyHoldingAssetID) {
		t.Errorf("err = %v, want ErrEmptyHoldingAssetID", err)
	}
}

func TestNewDetails_AssetIDDuplicadoRejeitado(t *testing.T) {
	holdings := []Holding{
		{ConstituentName: "VALR3 (linha 1)", AssetID: assetID("ativo-acao"), WeightPct: 50},
		{ConstituentName: "VALR3 (linha 2)", AssetID: assetID("ativo-acao"), WeightPct: 50},
	}

	_, err := NewDetails("IBOVESPA", "", holdings)
	if !errors.Is(err, ErrDuplicateHoldingAssetID) {
		t.Errorf("err = %v, want ErrDuplicateHoldingAssetID", err)
	}
}

func TestNewDetails_VariosHoldingsSemAssetIDNaoContamComoDuplicata(t *testing.T) {
	holdings := []Holding{
		{ConstituentName: "Outros 1", WeightPct: 50},
		{ConstituentName: "Outros 2", WeightPct: 50},
	}

	if _, err := NewDetails("IBOVESPA", "", holdings); err != nil {
		t.Errorf("err = %v, want nil (dois holdings sem asset_id não são duplicata entre si)", err)
	}
}
