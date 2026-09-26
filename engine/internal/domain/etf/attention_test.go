package etf

import (
	"math"
	"testing"
)

func TestDerivedAttention(t *testing.T) {
	targets := []TargetWeight{{AssetID: "a", WeightPct: 60}, {AssetID: "b", WeightPct: 40}}
	tests := []struct {
		name      string
		attention map[string]float64
		want      float64
	}{
		{"nenhum constituinte em evento", map[string]float64{"a": 0, "b": 1}, 1},
		{"só o de 60% em evento", map[string]float64{"a": 3, "b": 0}, 0.6*3 + 0.4*1},
		{"os dois em evento", map[string]float64{"a": 3, "b": 2}, 0.6*3 + 0.4*2},
		{"constituinte fora do universo fica fora da média", map[string]float64{"a": 3}, 3},
		{"nenhum no universo", map[string]float64{}, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := DerivedAttention(targets, tt.attention); math.Abs(got-tt.want) > 1e-9 {
				t.Errorf("DerivedAttention = %v, want %v", got, tt.want)
			}
		})
	}
}
