package etf

import (
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

func intPtr(i int) *int { return &i }

func TestRebalanceDue(t *testing.T) {
	tests := []struct {
		name  string
		day   int
		last  *int
		every int
		want  bool
	}{
		{"nunca rebalanceou", 10, nil, 14, true},
		{"antes do prazo", 20, intPtr(10), 14, false},
		{"no prazo", 24, intPtr(10), 14, true},
		{"calendário desligado", 100, nil, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := RebalanceDue(tt.day, tt.last, tt.every); got != tt.want {
				t.Errorf("RebalanceDue = %v, want %v", got, tt.want)
			}
		})
	}
}

func fundAt(cash float64, a, b int64) FundSnapshot {
	return FundSnapshot{Shares: 1000, Cash: cash, Holdings: []FundHolding{{AssetID: "a", Quantity: a}, {AssetID: "b", Quantity: b}}}
}

var halfHalf = []TargetWeight{{AssetID: "a", WeightPct: 50}, {AssetID: "b", WeightPct: 50}}

func TestPlanRebalance(t *testing.T) {
	tests := []struct {
		name   string
		fund   FundSnapshot
		prices map[string]float64
		want   []RebalanceOrder
	}{
		{
			name: "a valorizou, vende a e compra b",
			fund: fundAt(0, 500, 500), prices: map[string]float64{"a": 30, "b": 10},
			// patrimônio 20.000, alvo 10.000 cada: a 333 (vende 167), b 1000 (compra 500)
			want: []RebalanceOrder{
				{AssetID: "a", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Price: 30, Quantity: 167},
				{AssetID: "b", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Price: 10, Quantity: 500},
			},
		},
		{
			name: "já no peso, nenhuma ordem",
			fund: fundAt(0, 500, 500), prices: map[string]float64{"a": 10, "b": 10},
			want: nil,
		},
		{
			name: "diferença abaixo do mínimo é ruído",
			fund: fundAt(0, 501, 499), prices: map[string]float64{"a": 10, "b": 10},
			want: nil,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := PlanRebalance(tt.fund, halfHalf, tt.prices)
			if err != nil {
				t.Fatal(err)
			}
			if len(got) != len(tt.want) {
				t.Fatalf("ordens = %+v, want %+v", got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("ordem %d = %+v, want %+v", i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestPlanRebalance_VendasAntesDeCompras(t *testing.T) {
	// "a" vem antes de "b" por AssetID, mas a compra de a só é financiável pela venda de b
	fund := fundAt(0, 100, 900)
	got, err := PlanRebalance(fund, halfHalf, map[string]float64{"a": 10, "b": 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Side != orderbook.SideSell || got[1].Side != orderbook.SideBuy {
		t.Errorf("ordens = %+v, want venda primeiro e compra depois", got)
	}
}

func TestPlanRebalance_NormalizaPesosComCosmetico(t *testing.T) {
	// alvos somam 80 (20 é constituinte cosmético fora da cesta real): reescala pra 100
	targets := []TargetWeight{{AssetID: "a", WeightPct: 40}, {AssetID: "b", WeightPct: 40}}
	got, err := PlanRebalance(fundAt(0, 900, 100), targets, map[string]float64{"a": 10, "b": 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Quantity != 400 || got[1].Quantity != 400 {
		t.Errorf("ordens = %+v, want vender 400 de a e comprar 400 de b", got)
	}
}

func TestPlanRebalance_ErroSemPrecoOuAlvo(t *testing.T) {
	if _, err := PlanRebalance(fundAt(0, 1, 1), halfHalf, map[string]float64{"a": 10}); err == nil {
		t.Error("err = nil, want erro de preço ausente")
	}
	if _, err := PlanRebalance(fundAt(0, 1, 1), nil, map[string]float64{"a": 10, "b": 10}); err == nil {
		t.Error("err = nil, want erro de fundo sem alvo")
	}
}

func TestWeightDriftPct(t *testing.T) {
	got, err := WeightDriftPct(fundAt(0, 500, 500), halfHalf, map[string]float64{"a": 30, "b": 10})
	if err != nil {
		t.Fatal(err)
	}
	// pesos reais 75/25 contra 50/50: deriva 25 pontos
	if math.Abs(got-25) > 1e-9 {
		t.Errorf("deriva = %v, want 25", got)
	}
}

func TestAffordableBuyQuantity(t *testing.T) {
	tests := []struct {
		name        string
		wanted      int64
		price, cash float64
		want        int64
	}{
		{"cabe", 10, 10, 1000, 10},
		{"limita ao caixa com folga", 100, 10, 500, 49},
		{"sem caixa", 10, 10, 0, 0},
		{"caixa negativo", 10, 10, -5, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := AffordableBuyQuantity(tt.wanted, tt.price, tt.cash); got != tt.want {
				t.Errorf("AffordableBuyQuantity = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestTheoreticalIndexETrackingError(t *testing.T) {
	prev := map[string]float64{"a": 10, "b": 10}
	now := map[string]float64{"a": 11, "b": 9} // +10% e -10%, pesos iguais: retorno 0
	if got := TheoreticalIndex(100, 100, halfHalf, prev, now); math.Abs(got-100) > 1e-9 {
		t.Errorf("índice = %v, want 100", got)
	}
	up := map[string]float64{"a": 12, "b": 10} // +20% e 0%: retorno 10%
	if got := TheoreticalIndex(100, 50, halfHalf, prev, up); math.Abs(got-110) > 1e-9 {
		t.Errorf("índice = %v, want 110", got)
	}
	if got := TheoreticalIndex(0, 50, halfHalf, prev, up); got != 50 {
		t.Errorf("primeiro dia = %v, want a base 50", got)
	}
	if got := TrackingErrorPct(99, 100); math.Abs(got+1) > 1e-9 {
		t.Errorf("tracking = %v, want -1", got)
	}
	if got := TrackingErrorPct(99, 0); got != 0 {
		t.Errorf("tracking sem índice = %v, want 0", got)
	}
}
