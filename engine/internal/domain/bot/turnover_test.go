package bot

import (
	"math"
	"testing"
)

func TestTargetTurnoverPct(t *testing.T) {
	if got := TargetTurnoverPct(0, 100); got != MedianTurnoverPct {
		t.Errorf("sem valor: %v, want a mediana %v", got, MedianTurnoverPct)
	}
	if got := TargetTurnoverPct(100, 100); math.Abs(got-MedianTurnoverPct) > 1e-12 {
		t.Errorf("ativo mediano: %v, want %v", got, MedianTurnoverPct)
	}
	if got := TargetTurnoverPct(1e12, 100); got != MaxTurnoverPct {
		t.Errorf("líder gigante: %v, want o teto %v", got, MaxTurnoverPct)
	}
	if got := TargetTurnoverPct(1e-9, 100); got != MinTurnoverPct {
		t.Errorf("ativo minúsculo: %v, want o piso %v", got, MinTurnoverPct)
	}
	// Sublinear e crescente: dobrar o valor sobe o giro, mas menos que dobra.
	small, big := TargetTurnoverPct(100, 100), TargetTurnoverPct(200, 100)
	if !(big > small && big < 2*small) {
		t.Errorf("giro(200)=%v giro(100)=%v: want crescente e sublinear", big, small)
	}
}

func TestMedianMarketValue(t *testing.T) {
	if got := MedianMarketValue(weightedUniverse(5, 1, 3)); got != 3 {
		t.Errorf("ímpar: %v, want 3", got)
	}
	if got := MedianMarketValue(weightedUniverse(4, 1, 3, 2)); got != 2.5 {
		t.Errorf("par: %v, want 2,5", got)
	}
	if got := MedianMarketValue(weightedUniverse(0, 0)); got != 0 {
		t.Errorf("sem valores: %v, want 0", got)
	}
}

// Menos turnos pedem ordens maiores para o mesmo giro; o teto do teto vale.
func TestOrderCeilingPct(t *testing.T) {
	target := 0.003
	many, few := OrderCeilingPct(target, 8), OrderCeilingPct(target, 2)
	if math.Abs(few-4*many) > 1e-12 && few != MaxOrderCeilingPct {
		t.Errorf("2 turnos = %v, 8 turnos = %v: want 4x (ou o teto)", few, many)
	}
	if got := OrderCeilingPct(target, 1); got != math.Min(target/TurnoverPerCeiling, MaxOrderCeilingPct) {
		t.Errorf("1 turno = %v", got)
	}
	if got := OrderCeilingPct(0.006, 1); got != MaxOrderCeilingPct {
		t.Errorf("giro alto com 1 turno = %v, want o teto %v", got, MaxOrderCeilingPct)
	}
	if got := OrderCeilingPct(target, 0); got != MaxOrderCeilingPct {
		t.Errorf("sem turno = %v, want o teto", got)
	}
}
