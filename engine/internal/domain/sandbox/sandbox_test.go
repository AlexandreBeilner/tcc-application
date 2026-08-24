package sandbox

import (
	"testing"
	"time"
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
	base := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name             string
		firstOperationAt time.Time
		now              time.Time
		want             int
	}{
		{"mesmo instante da primeira operação", base, base, 0},
		{"algumas horas depois, ainda dia 0", base, base.Add(20 * time.Hour), 0},
		{"exatamente 1 dia depois", base, base.Add(24 * time.Hour), 1},
		{"3 dias e meio depois", base, base.Add(84 * time.Hour), 3},
		{"relógio andou pra trás nunca fica negativo", base, base.Add(-1 * time.Hour), 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := DaysSince(tt.firstOperationAt, tt.now); got != tt.want {
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
