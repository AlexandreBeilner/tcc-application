package fixedincomeposition

import (
	"math"
	"testing"
)

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) < 1e-9
}

func TestApplyBuy_PrimeiraCompra(t *testing.T) {
	got := ApplyBuy(Position{}, 20, 100, 0.07)

	if !almostEqual(got.Quantity, 20) {
		t.Errorf("Quantity = %v, want 20", got.Quantity)
	}
	if !almostEqual(got.AveragePrice, 100) {
		t.Errorf("AveragePrice = %v, want 100", got.AveragePrice)
	}
	if !almostEqual(got.AverageRate, 0.07) {
		t.Errorf("AverageRate = %v, want 0.07", got.AverageRate)
	}
}

// Reproduz o exemplo do usuário: título comprado uma vez a 7% (R$2000, a
// R$100 a unidade = 20 unidades) e de novo depois a 8,4% (R$1000, a R$100
// a unidade = 10 unidades) — a carteira deve mostrar uma posição só, com a
// taxa ajustada pela média ponderada pelo valor de cada aporte
// (2000@7% + 1000@8,4% sobre 3000 total).
func TestApplyBuy_SegundaCompraBlendaTaxaPonderadaPeloValor(t *testing.T) {
	first := ApplyBuy(Position{}, 20, 100, 0.07)
	got := ApplyBuy(first, 10, 100, 0.084)

	if !almostEqual(got.Quantity, 30) {
		t.Errorf("Quantity = %v, want 30", got.Quantity)
	}
	if !almostEqual(got.AveragePrice, 100) {
		t.Errorf("AveragePrice = %v, want 100", got.AveragePrice)
	}
	wantRate := (0.07*2000 + 0.084*1000) / 3000
	if !almostEqual(got.AverageRate, wantRate) {
		t.Errorf("AverageRate = %v, want %v", got.AverageRate, wantRate)
	}
}

func TestApplyBuy_ComprasNaMesmaTaxaMantemATaxa(t *testing.T) {
	first := ApplyBuy(Position{}, 20, 100, 0.05)
	got := ApplyBuy(first, 15, 90, 0.05)

	if !almostEqual(got.AverageRate, 0.05) {
		t.Errorf("AverageRate = %v, want 0.05 (compras na mesma taxa não deveriam mudar o blend)", got.AverageRate)
	}
}

func TestApplyBuy_PrecoMedioPonderadoPelaQuantidade(t *testing.T) {
	first := ApplyBuy(Position{}, 10, 100, 0.07)
	got := ApplyBuy(first, 10, 200, 0.07)

	wantPrice := (10*100.0 + 10*200.0) / 20
	if !almostEqual(got.AveragePrice, wantPrice) {
		t.Errorf("AveragePrice = %v, want %v", got.AveragePrice, wantPrice)
	}
}

func TestApplyBuy_TerceiraCompraContinuaBlendandoSobreOEstadoJaAgregado(t *testing.T) {
	pos := ApplyBuy(Position{}, 20, 100, 0.07)
	pos = ApplyBuy(pos, 10, 100, 0.084)
	pos = ApplyBuy(pos, 30, 100, 0.09)

	if !almostEqual(pos.Quantity, 60) {
		t.Errorf("Quantity = %v, want 60", pos.Quantity)
	}
	wantRate := (0.07*2000 + 0.084*1000 + 0.09*3000) / 6000
	if !almostEqual(pos.AverageRate, wantRate) {
		t.Errorf("AverageRate = %v, want %v", pos.AverageRate, wantRate)
	}
}
