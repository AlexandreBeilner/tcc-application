package bot

import (
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

func mustChartistPersonality(t *testing.T, maxPositionSizePct float64) Personality {
	t.Helper()
	riskProfile, err := NewRiskProfile(maxPositionSizePct, 0.5, 0)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	scope := validScope(t)
	personality, err := NewPersonality(ArchetypeChartista, scope, nil, riskProfile)
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}
	return personality
}

func TestDecideChartistOrder_DirecaoConformeATendencia(t *testing.T) {
	tests := []struct {
		name         string
		priceHistory []float64
		wantSide     orderbook.Side
		wantErr      error
	}{
		{
			name:         "tendência de alta clara",
			priceHistory: []float64{10, 10.5, 11, 11.5, 12},
			wantSide:     orderbook.SideBuy,
		},
		{
			name:         "tendência de baixa clara",
			priceHistory: []float64{12, 11.5, 11, 10.5, 10},
			wantSide:     orderbook.SideSell,
		},
		{
			name:         "lateral, variação dentro do limiar",
			priceHistory: []float64{10, 10.05, 9.98, 10.02, 10.01},
			wantErr:      ErrNoClearTrend,
		},
		{
			name:         "lateral, preço final igual ao inicial",
			priceHistory: []float64{20, 21, 19, 20},
			wantErr:      ErrNoClearTrend,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			personality := mustChartistPersonality(t, 0.5)
			got, err := DecideChartistOrder(personality, tt.priceHistory, 1_000_000, 1_000_000, nil)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr == nil && got.Side != tt.wantSide {
				t.Fatalf("Side = %v, want %v", got.Side, tt.wantSide)
			}
		})
	}
}

func TestDecideChartistOrder_NuncaExcedeCaixaOuPosicao(t *testing.T) {
	uptrend := []float64{5, 6, 7, 8, 9}
	downtrend := []float64{9, 8, 7, 6, 5}

	tests := []struct {
		name            string
		priceHistory    []float64
		availableCash   float64
		currentPosition int
	}{
		{name: "alta, caixa apertado", priceHistory: uptrend, availableCash: 20, currentPosition: 0},
		{name: "alta, caixa generoso", priceHistory: uptrend, availableCash: 100_000, currentPosition: 0},
		{name: "baixa, posição pequena", priceHistory: downtrend, availableCash: 0, currentPosition: 3},
		{name: "baixa, posição grande", priceHistory: downtrend, availableCash: 0, currentPosition: 10_000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, pct := range []float64{0.05, 0.3, 1.0} {
				personality := mustChartistPersonality(t, pct)
				got, err := DecideChartistOrder(personality, tt.priceHistory, tt.availableCash, tt.currentPosition, nil)
				if err != nil {
					t.Fatalf("pct %.2f: err = %v, want nil", pct, err)
				}
				if got.Quantity < 1 {
					t.Fatalf("pct %.2f: Quantity = %d, want >= 1", pct, got.Quantity)
				}
				switch got.Side {
				case orderbook.SideBuy:
					if cost := got.Price * float64(got.Quantity); cost > tt.availableCash+1e-9 {
						t.Fatalf("pct %.2f: custo %.4f excede caixa disponível %.4f", pct, cost, tt.availableCash)
					}
				case orderbook.SideSell:
					if got.Quantity > tt.currentPosition {
						t.Fatalf("pct %.2f: quantidade %d excede posição atual %d", pct, got.Quantity, tt.currentPosition)
					}
				}
			}
		})
	}
}

func TestDecideChartistOrder_PrecoDaOrdemEUltimoDaJanela(t *testing.T) {
	personality := mustChartistPersonality(t, 0.5)
	priceHistory := []float64{10, 11, 12, 13.37}
	got, err := DecideChartistOrder(personality, priceHistory, 1_000_000, 0, nil)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if got.Price != 13.37 {
		t.Fatalf("Price = %v, want %v (último preço da janela)", got.Price, 13.37)
	}
	if got.Type != orderbook.TypeLimit {
		t.Fatalf("Type = %v, want %v", got.Type, orderbook.TypeLimit)
	}
}

func TestDecideChartistOrder_Deterministico(t *testing.T) {
	personality := mustChartistPersonality(t, 0.4)
	priceHistory := []float64{50, 52, 55, 58}
	first, err := DecideChartistOrder(personality, priceHistory, 10_000, 200, nil)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	second, err := DecideChartistOrder(personality, priceHistory, 10_000, 200, nil)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if first != second {
		t.Fatalf("mesmo estado produziu decisões diferentes: %+v != %+v", first, second)
	}
}

func TestDecideChartistOrder_ErroSemRecursoParaOLadoDaTendencia(t *testing.T) {
	personality := mustChartistPersonality(t, 0.5)

	t.Run("alta, sem caixa suficiente pra 1 unidade", func(t *testing.T) {
		_, err := DecideChartistOrder(personality, []float64{100, 101, 102, 103}, 5, 0, nil)
		if !errors.Is(err, ErrNoViableOrder) {
			t.Fatalf("err = %v, want %v", err, ErrNoViableOrder)
		}
	})
	t.Run("baixa, sem posição", func(t *testing.T) {
		_, err := DecideChartistOrder(personality, []float64{103, 102, 101, 100}, 0, 0, nil)
		if !errors.Is(err, ErrNoViableOrder) {
			t.Fatalf("err = %v, want %v", err, ErrNoViableOrder)
		}
	})
}

func TestDecideChartistOrder_ErroHistoricoInsuficiente(t *testing.T) {
	personality := mustChartistPersonality(t, 0.5)
	tests := [][]float64{nil, {}, {10}}
	for _, history := range tests {
		_, err := DecideChartistOrder(personality, history, 1_000, 10, nil)
		if !errors.Is(err, ErrInsufficientPriceHistory) {
			t.Fatalf("history %v: err = %v, want %v", history, err, ErrInsufficientPriceHistory)
		}
	}
}

func TestDecideChartistOrder_ErroPrecoInvalidoNaJanela(t *testing.T) {
	personality := mustChartistPersonality(t, 0.5)
	tests := [][]float64{{0, 10}, {-5, 10}, {10, 0}, {10, -5}}
	for _, history := range tests {
		_, err := DecideChartistOrder(personality, history, 1_000, 10, nil)
		if !errors.Is(err, ErrInvalidReferencePrice) {
			t.Fatalf("history %v: err = %v, want %v", history, err, ErrInvalidReferencePrice)
		}
	}
}

func TestDecideChartistOrder_ErroArquetipoErrado(t *testing.T) {
	riskProfile, err := NewRiskProfile(0.5, 0.5, 0)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	scope := validScope(t)
	personality, err := NewPersonality(ArchetypeRuido, scope, nil, riskProfile)
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}

	_, err = DecideChartistOrder(personality, []float64{10, 11, 12}, 1_000, 10, nil)
	if !errors.Is(err, ErrWrongArchetype) {
		t.Fatalf("err = %v, want %v", err, ErrWrongArchetype)
	}
}

// TestDecideChartistOrder_QuantidadeDeCompraNuncaExcedeOFloat cobre o
// achado 005 (pontos-em-aberto-decisao-produto.md), via quantityForSide
// (marketmaker.go, compartilhada com Fundamentalista) — caixa muito maior
// que o teto de tamanho de ordem não pode gerar uma ordem de compra maior
// que orderSizeCeiling.
func TestDecideChartistOrder_QuantidadeDeCompraNuncaExcedeOFloat(t *testing.T) {
	personality := mustChartistPersonality(t, 0.9) // fração alta, pra não mascarar o teto
	orderSizeCeiling := int64(1_000_000)

	got, err := DecideChartistOrder(personality, []float64{10, 10.5, 11, 11.5, 12}, 104_866_356_108.88, 0, &orderSizeCeiling)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if got.Side != orderbook.SideBuy {
		t.Fatalf("Side = %v, want buy (tendência de alta)", got.Side)
	}
	if got.Quantity > int(orderSizeCeiling) {
		t.Fatalf("Quantity = %d, want <= orderSizeCeiling (%d)", got.Quantity, orderSizeCeiling)
	}
}
