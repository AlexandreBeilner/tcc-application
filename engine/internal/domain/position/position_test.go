package position

import "testing"

func TestApplyBuy(t *testing.T) {
	tests := []struct {
		name             string
		current          Position
		quantity         int
		price            float64
		wantQuantity     int
		wantAveragePrice float64
	}{
		{
			name:             "posição vazia vira o preço do primeiro lote",
			current:          Position{},
			quantity:         10,
			price:            20,
			wantQuantity:     10,
			wantAveragePrice: 20,
		},
		{
			name:             "segunda compra recalcula pela média ponderada pelo custo",
			current:          Position{Quantity: 10, AveragePrice: 20},
			quantity:         10,
			price:            30,
			wantQuantity:     20,
			wantAveragePrice: 25,
		},
		{
			name:             "lote maior pesa mais na média",
			current:          Position{Quantity: 10, AveragePrice: 10},
			quantity:         30,
			price:            20,
			wantQuantity:     40,
			wantAveragePrice: 17.5,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ApplyBuy(tt.current, tt.quantity, tt.price)
			if got.Quantity != tt.wantQuantity {
				t.Errorf("Quantity = %d, want %d", got.Quantity, tt.wantQuantity)
			}
			if got.AveragePrice != tt.wantAveragePrice {
				t.Errorf("AveragePrice = %v, want %v", got.AveragePrice, tt.wantAveragePrice)
			}
		})
	}
}

func TestApplySell(t *testing.T) {
	t.Run("venda parcial reduz quantidade sem mudar average_price", func(t *testing.T) {
		got, err := ApplySell(Position{Quantity: 10, AveragePrice: 20}, 4)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if got.Quantity != 6 {
			t.Errorf("Quantity = %d, want 6", got.Quantity)
		}
		if got.AveragePrice != 20 {
			t.Errorf("AveragePrice = %v, want 20 (não muda numa venda)", got.AveragePrice)
		}
	})

	t.Run("venda total zera a quantidade", func(t *testing.T) {
		got, err := ApplySell(Position{Quantity: 10, AveragePrice: 20}, 10)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if got.Quantity != 0 {
			t.Errorf("Quantity = %d, want 0", got.Quantity)
		}
	})

	t.Run("venda maior que a posição é rejeitada", func(t *testing.T) {
		_, err := ApplySell(Position{Quantity: 5, AveragePrice: 20}, 6)
		if err != ErrInsufficientQuantity {
			t.Errorf("err = %v, want %v", err, ErrInsufficientQuantity)
		}
	})
}

func TestValidateFloatCeiling(t *testing.T) {
	tests := []struct {
		name              string
		totalHeld         int64
		outstandingShares int64
		wantErr           error
	}{
		{name: "soma abaixo do teto é válida", totalHeld: 900_000, outstandingShares: 1_000_000, wantErr: nil},
		{name: "soma exatamente no teto é válida", totalHeld: 1_000_000, outstandingShares: 1_000_000, wantErr: nil},
		{name: "soma acima do teto é rejeitada", totalHeld: 1_000_001, outstandingShares: 1_000_000, wantErr: ErrFloatExceeded},
		{name: "float zero (nada distribuído ainda) é válido", totalHeld: 0, outstandingShares: 1_000_000, wantErr: nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateFloatCeiling(tt.totalHeld, tt.outstandingShares)
			if err != tt.wantErr {
				t.Errorf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}
