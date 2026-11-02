package fixedincome

import (
	"math"
	"testing"
	"time"
)

// Exemplos numéricos do Capítulo 2 do TCC, conferidos com tolerância de 0,01
// (R$) — ou 1e-6 para a cotação, que é adimensional.

func TestPrefixedPrice_ExemploSecao221(t *testing.T) {
	// VN R$1.000, 14,50% a.a., 504 DU: 1000 / 1,145^(504/252) = 762,76.
	got := PrefixedPrice(0.145, 504)
	if math.Abs(got-762.76) > 0.01 {
		t.Errorf("PrefixedPrice(0.145, 504) = %.4f, want 762,76", got)
	}
}

func TestIPCAQuote_ExemploSecao222(t *testing.T) {
	// 7,5% a.a. real, 1260 DU: 1 / 1,075^5 = 0,696559 (cotação 69,6559 na
	// escala da equação do Tesouro, Cotação/100).
	got := IPCAQuote(0.075, 1260)
	if math.Abs(got-0.696559) > 1e-6 {
		t.Errorf("IPCAQuote(0.075, 1260) = %.6f, want 0,696559", got)
	}
}

func TestIPCAPrice_ExemploSecao222(t *testing.T) {
	// VNA projetado 4.455,33 × cotação 0,696559 = 3.103,40.
	got := IPCAPrice(4455.33, IPCAQuote(0.075, 1260))
	if math.Abs(got-3103.40) > 0.01 {
		t.Errorf("IPCAPrice(4455,33; cotação) = %.4f, want 3.103,40", got)
	}
}

func TestVNAProjected_ExemploSecao222(t *testing.T) {
	// VNA 4.450,00 no dia 15, IPCA do mês 0,40%, 9 dias corridos numa janela
	// de 30 (15/04 a 15/05) → expoente 9/30 → 4.455,33.
	settlement := time.Date(2026, time.April, 24, 0, 0, 0, 0, time.UTC)
	got := VNAProjected(4450.00, 0.004, settlement)
	if math.Abs(got-4455.33) > 0.01 {
		t.Errorf("VNAProjected(4450; 0,40%%; 9/30) = %.4f, want 4.455,33", got)
	}
}
