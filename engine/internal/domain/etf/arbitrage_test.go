package etf

import "testing"

func TestArbitrageSignal(t *testing.T) {
	tests := []struct {
		name       string
		price, nav float64
		want       ArbitrageDirection
	}{
		{"ágio além da faixa cria", 102, 100, ArbitrageCreate},
		{"deságio além da faixa resgata", 98, 100, ArbitrageRedeem},
		{"dentro da faixa não age", 101, 100, ArbitrageNone},
		{"exatamente na borda não age", 101.5, 100, ArbitrageNone},
		{"preço zero não age", 0, 100, ArbitrageNone},
		{"nav zero não age", 100, 0, ArbitrageNone},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got, _ := ArbitrageSignal(tt.price, tt.nav); got != tt.want {
				t.Errorf("ArbitrageSignal(%v, %v) = %v, want %v", tt.price, tt.nav, got, tt.want)
			}
		})
	}
}

func TestArbitrageShares(t *testing.T) {
	tests := []struct {
		name        string
		outstanding int64
		deviation   float64
		want        int64
	}{
		{"sem cotas", 0, 0.05, 0},
		{"dentro da faixa", 10000, 0.01, 0},
		{"desvio grande bate no teto", 10000, 0.10, 200},
		{"desvio pequeno proporcional", 10000, 0.025, 101},
		{"fundo pequeno vale ao menos 1 cota", 10, 0.016, 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ArbitrageShares(tt.outstanding, tt.deviation); got != tt.want {
				t.Errorf("ArbitrageShares(%d, %v) = %d, want %d", tt.outstanding, tt.deviation, got, tt.want)
			}
		})
	}
}

func TestSupportedShares(t *testing.T) {
	fund := []BasketLeg{{AssetID: "a", Quantity: 600, Price: 10}, {AssetID: "b", Quantity: 400, Price: 10}}
	tests := []struct {
		name string
		held map[string]int64
		want int64
	}{
		{"cesta completa", map[string]int64{"a": 60, "b": 40}, 100},
		{"a limita", map[string]int64{"a": 30, "b": 40}, 50},
		{"nenhum constituinte", map[string]int64{}, 0},
		{"sobra não aumenta o lote", map[string]int64{"a": 900, "b": 900}, 100},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SupportedShares(fund, 1000, 100, tt.held)
			if got != tt.want {
				t.Fatalf("SupportedShares = %d, want %d", got, tt.want)
			}
			// a cesta de criação desse lote precisa caber no que o participante detém
			if got > 0 {
				basket, err := ProRataBasket(fund, 1000, got, true)
				if err != nil {
					t.Fatal(err)
				}
				for _, leg := range basket {
					if leg.Quantity > tt.held[leg.AssetID] {
						t.Errorf("perna %s pede %d, participante tem %d", leg.AssetID, leg.Quantity, tt.held[leg.AssetID])
					}
				}
			}
		})
	}
}
