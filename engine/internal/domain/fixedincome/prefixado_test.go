package fixedincome

import (
	"math"
	"testing"
)

// TestPrefixedPrice_ExemploDeReferencia reproduz um exemplo didático padrão
// de mercado pra equação 5 do TCC (cap. 2.2.1) — o TCC documenta só a
// fórmula abstrata, sem um exemplo numérico calculado no texto, então este
// caso foi construído a partir da própria equação com valores redondos
// (VN=R$1.000, taxa de 10% a.a., DU=252 = 1 ano útil inteiro), não é um
// número literal do texto do TCC.
func TestPrefixedPrice_ExemploDeReferencia(t *testing.T) {
	got := PrefixedPrice(0.10, 252)
	want := 909.09

	if math.Abs(got-want) >= 0.01 {
		t.Errorf("PrefixedPrice(0.10, 252) = %v, want %v (margem < 0.01)", got, want)
	}
}

func TestPrefixedPrice(t *testing.T) {
	tests := []struct {
		name                   string
		annualRate             float64
		businessDaysToMaturity int
		want                   float64
	}{
		{"taxa zero — sem deságio, preço = VN", 0, 252, 1000.0},
		{"vencimento hoje — sem tempo, preço = VN", 0.10, 0, 1000.0},
		{"um ano útil inteiro", 0.10, 252, 909.09},
		{"meio ano útil", 0.10, 126, 953.46},
		{"dois anos úteis", 0.08, 504, 857.34},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := PrefixedPrice(tt.annualRate, tt.businessDaysToMaturity)
			if math.Abs(got-tt.want) >= 0.01 {
				t.Errorf("PrefixedPrice(%v, %v) = %v, want %v (margem < 0.01)",
					tt.annualRate, tt.businessDaysToMaturity, got, tt.want)
			}
		})
	}
}

func TestPrefixedPrice_NuncaExcedeValorNominal(t *testing.T) {
	// Com taxa positiva, o preço de compra é sempre um deságio — nunca
	// igual ou maior que o Valor Nominal de R$1.000 pago no vencimento.
	for _, du := range []int{1, 30, 63, 126, 189, 252, 504} {
		if got := PrefixedPrice(0.05, du); got >= FaceValue {
			t.Errorf("PrefixedPrice(0.05, %d) = %v, want < %v", du, got, FaceValue)
		}
	}
}
