package sandbox

import (
	"testing"
)

func TestPriceOnDay(t *testing.T) {
	script := PriceScript{PricesByDay: []float64{100, 101, 102, 103}}

	tests := []struct {
		name      string
		dayIndex  int
		wantPrice float64
	}{
		{"dia 0", 0, 100},
		{"dia intermediário", 2, 102},
		{"último dia da série", 3, 103},
		{"além do fim da série clampa no último valor", 10, 103},
		{"índice negativo clampa no dia 0", -1, 100},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := PriceOnDay(script, tt.dayIndex); got != tt.wantPrice {
				t.Errorf("PriceOnDay(%d) = %v, want %v", tt.dayIndex, got, tt.wantPrice)
			}
		})
	}
}

func TestRateOnDay(t *testing.T) {
	script := RateScript{AnnualRateByDay: []float64{10, 15, 15, 15, 6}}

	tests := []struct {
		name     string
		dayIndex int
		want     float64
	}{
		{"dia da compra, taxa contratada", 0, 10},
		{"taxa sobe (cenário de perda)", 2, 15},
		{"taxa cai (cenário de ganho)", 4, 6},
		{"além do fim da série clampa no último valor", 100, 6},
		{"índice negativo clampa no dia 0", -5, 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := RateOnDay(script, tt.dayIndex); got != tt.want {
				t.Errorf("RateOnDay(%d) = %v, want %v", tt.dayIndex, got, tt.want)
			}
		})
	}
}

func TestIPCAOnDay(t *testing.T) {
	script := IPCAScript{MonthlyIPCAByDay: []float64{0.40, 0.45, 0.50, 0.35}}

	tests := []struct {
		name     string
		dayIndex int
		want     float64
	}{
		{"dia 0", 0, 0.40},
		{"último dia da série", 3, 0.35},
		{"além do fim da série clampa no último valor", 30, 0.35},
		{"índice negativo clampa no dia 0", -1, 0.40},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IPCAOnDay(script, tt.dayIndex); got != tt.want {
				t.Errorf("IPCAOnDay(%d) = %v, want %v", tt.dayIndex, got, tt.want)
			}
		})
	}
}

func TestDaysSince(t *testing.T) {
	tests := []struct {
		name              string
		firstOperationDay int
		currentDay        int
		want              int
	}{
		{"mesmo dia da primeira operação", 10, 10, 0},
		{"1 dia simulado depois", 10, 11, 1},
		{"3 dias simulados depois", 10, 13, 3},
		{"dia corrente anterior nunca fica negativo", 10, 8, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := DaysSince(tt.firstOperationDay, tt.currentDay); got != tt.want {
				t.Errorf("DaysSince() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestDeterminismo(t *testing.T) {
	script := PriceScript{PricesByDay: []float64{100, 101, 102}}
	first := PriceOnDay(script, 1)
	second := PriceOnDay(script, 1)
	if first != second {
		t.Errorf("PriceOnDay não é determinístico: %v != %v", first, second)
	}
}

func TestPriceScriptForTicker(t *testing.T) {
	if _, ok := PriceScriptForTicker("SAND3"); !ok {
		t.Error("SAND3 deveria ter roteiro de preço cadastrado")
	}
	if _, ok := PriceScriptForTicker("TICKER-INEXISTENTE"); ok {
		t.Error("ticker sem roteiro deveria devolver ok = false")
	}
}

func TestRateScriptForTicker(t *testing.T) {
	if _, ok := RateScriptForTicker("SANDPRE"); !ok {
		t.Error("SANDPRE deveria ter roteiro de taxa cadastrado")
	}
	if _, ok := RateScriptForTicker("TICKER-INEXISTENTE"); ok {
		t.Error("ticker sem roteiro deveria devolver ok = false")
	}
}

func TestIPCAScriptForTicker(t *testing.T) {
	if _, ok := IPCAScriptForTicker("SANDIPCA"); !ok {
		t.Error("SANDIPCA deveria ter roteiro de IPCA cadastrado")
	}
	if _, ok := IPCAScriptForTicker("TICKER-INEXISTENTE"); ok {
		t.Error("ticker sem roteiro deveria devolver ok = false")
	}
}
