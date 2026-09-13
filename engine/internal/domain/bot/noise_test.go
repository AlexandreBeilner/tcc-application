package bot

import (
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

func TestDecideNoiseOrder_NuncaViolaOrcamentoOuPosicao(t *testing.T) {
	tests := []struct {
		name            string
		referencePrice  float64
		availableCash   float64
		currentPosition int
	}{
		{name: "caixa e posição generosos", referencePrice: 25.50, availableCash: 10_000, currentPosition: 500},
		{name: "caixa apertado, posição grande", referencePrice: 100, availableCash: 150, currentPosition: 1_000_000},
		{name: "caixa generoso, posição pequena", referencePrice: 10, availableCash: 1_000_000, currentPosition: 3},
		{name: "caixa cobre só 1 unidade no pior preço da faixa, sem posição", referencePrice: 50, availableCash: 60, currentPosition: 0},
		{name: "só posição de 1 unidade, sem caixa", referencePrice: 30, availableCash: 0, currentPosition: 1},
		{name: "preço fracionário", referencePrice: 7.77, availableCash: 999.99, currentPosition: 42},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for seed := int64(0); seed < 200; seed++ {
				got, err := DecideNoiseOrder(tt.referencePrice, tt.availableCash, tt.currentPosition, seed)
				if err != nil {
					t.Fatalf("seed %d: err = %v, want nil", seed, err)
				}
				if got.Quantity < 1 {
					t.Fatalf("seed %d: Quantity = %d, want >= 1", seed, got.Quantity)
				}
				if got.Type != orderbook.TypeLimit {
					t.Fatalf("seed %d: Type = %v, want %v", seed, got.Type, orderbook.TypeLimit)
				}
				if got.Price <= 0 {
					t.Fatalf("seed %d: Price = %v, want > 0", seed, got.Price)
				}

				switch got.Side {
				case orderbook.SideBuy:
					cost := got.Price * float64(got.Quantity)
					if cost > tt.availableCash+1e-9 {
						t.Fatalf("seed %d: compra de %d @ %.4f custa %.4f, excede caixa disponível %.4f", seed, got.Quantity, got.Price, cost, tt.availableCash)
					}
				case orderbook.SideSell:
					if got.Quantity > tt.currentPosition {
						t.Fatalf("seed %d: venda de %d excede posição atual %d", seed, got.Quantity, tt.currentPosition)
					}
				default:
					t.Fatalf("seed %d: Side = %v, want buy ou sell", seed, got.Side)
				}
			}
		})
	}
}

func TestDecideNoiseOrder_PrecoDentroDaFaixaAoRedorDoPrecoDeReferencia(t *testing.T) {
	referencePrice := 40.0
	min := referencePrice * (1 - NoisePriceBandPct)
	max := referencePrice * (1 + NoisePriceBandPct)

	for seed := int64(0); seed < 200; seed++ {
		got, err := DecideNoiseOrder(referencePrice, 1_000_000, 1_000_000, seed)
		if err != nil {
			t.Fatalf("seed %d: err = %v, want nil", seed, err)
		}
		if got.Price < min || got.Price > max {
			t.Fatalf("seed %d: Price = %.4f, want entre %.4f e %.4f", seed, got.Price, min, max)
		}
	}
}

func TestDecideNoiseOrder_Determinismo(t *testing.T) {
	first, err := DecideNoiseOrder(20, 5_000, 100, 42)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	second, err := DecideNoiseOrder(20, 5_000, 100, 42)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if first != second {
		t.Fatalf("mesma seed produziu decisões diferentes: %+v != %+v", first, second)
	}
}

func TestDecideNoiseOrder_ForcaLadoQuandoSoUmEViavel(t *testing.T) {
	for seed := int64(0); seed < 50; seed++ {
		t.Run("sem posição, só compra é viável", func(t *testing.T) {
			got, err := DecideNoiseOrder(10, 1_000_000, 0, seed)
			if err != nil {
				t.Fatalf("seed %d: err = %v, want nil", seed, err)
			}
			if got.Side != orderbook.SideBuy {
				t.Fatalf("seed %d: Side = %v, want buy", seed, got.Side)
			}
		})
		t.Run("sem caixa, só venda é viável", func(t *testing.T) {
			got, err := DecideNoiseOrder(10, 0, 100, seed)
			if err != nil {
				t.Fatalf("seed %d: err = %v, want nil", seed, err)
			}
			if got.Side != orderbook.SideSell {
				t.Fatalf("seed %d: Side = %v, want sell", seed, got.Side)
			}
		})
	}
}

func TestDecideNoiseOrder_ErroSemCaixaNemPosicao(t *testing.T) {
	_, err := DecideNoiseOrder(10, 0, 0, 1)
	if !errors.Is(err, ErrNoViableOrder) {
		t.Fatalf("err = %v, want %v", err, ErrNoViableOrder)
	}
}

func TestDecideNoiseOrder_ErroCaixaInsuficienteParaUmaUnidadeESemPosicao(t *testing.T) {
	_, err := DecideNoiseOrder(100, 5, 0, 1)
	if !errors.Is(err, ErrNoViableOrder) {
		t.Fatalf("err = %v, want %v", err, ErrNoViableOrder)
	}
}

func TestDecideNoiseOrder_ErroPrecoDeReferenciaInvalido(t *testing.T) {
	tests := []float64{0, -10}
	for _, price := range tests {
		_, err := DecideNoiseOrder(price, 1000, 10, 1)
		if !errors.Is(err, ErrInvalidReferencePrice) {
			t.Fatalf("referencePrice %v: err = %v, want %v", price, err, ErrInvalidReferencePrice)
		}
	}
}
