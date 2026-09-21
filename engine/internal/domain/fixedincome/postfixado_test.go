package fixedincome

import (
	"math"
	"testing"
)

func almostEqualPostFixado(a, b, tolerance float64) bool {
	return math.Abs(a-b) < tolerance
}

func TestPostFixedFactor_SerieVaziaNaoRende(t *testing.T) {
	got := PostFixedFactor(100, nil)
	if got != 1.0 {
		t.Errorf("PostFixedFactor(série vazia) = %v, want 1.0", got)
	}
}

func TestPostFixedFactor_TaxaConstante_BateComPrefixedPriceEquivalente(t *testing.T) {
	// 252 dias úteis a uma Selic constante de 10% a.a., 100% do índice —
	// deve bater com o crescimento de um Valor Nominal por um ano inteiro
	// à mesma taxa efetiva (1+taxa)^1, mesma base de composição de
	// PrefixedPrice (252 DU/ano).
	rates := make([]float64, BusinessDaysPerYear)
	for i := range rates {
		rates[i] = 10.0
	}

	got := PostFixedFactor(100, rates)
	want := math.Pow(1.10, 1.0)
	if !almostEqualPostFixado(got, want, 1e-6) {
		t.Errorf("PostFixedFactor(taxa constante, 252 dias) = %v, want %v", got, want)
	}
}

func TestPostFixedFactor_AcompanhaASerieDiaADia_NaoUmaMediaOuTaxaTravada(t *testing.T) {
	// A prova de que cada dia da série é genuinamente consultado (não só
	// uma taxa travada na compra, nem uma média do período): composição
	// diária é logaritmicamente côncava, então uma série que VARIA (Selic
	// sobe num dia de reunião do Copom, desce depois) sempre rende
	// diferente — estritamente menos, por desigualdade de Jensen — do que
	// aplicar a MÉDIA simples dessa mesma série em todo dia. Se
	// PostFixedFactor colapsasse a série numa média (ou travasse só o
	// primeiro valor), os dois fatores abaixo seriam idênticos.
	variando := []float64{5, 15}
	media := (variando[0] + variando[1]) / 2
	constante := []float64{media, media}

	fatorVariando := PostFixedFactor(100, variando)
	fatorConstante := PostFixedFactor(100, constante)

	if fatorVariando >= fatorConstante {
		t.Errorf("PostFixedFactor(série variando) = %v, want estritamente menor que PostFixedFactor(média constante) = %v", fatorVariando, fatorConstante)
	}
}

func TestPostFixedFactor_TaxaMaiorRendeMais(t *testing.T) {
	baixa := PostFixedFactor(100, []float64{5, 5, 5, 5, 5})
	alta := PostFixedFactor(100, []float64{15, 15, 15, 15, 15})

	if !(alta > baixa) {
		t.Errorf("PostFixedFactor com Selic mais alta (%v) não rendeu mais que com Selic mais baixa (%v)", alta, baixa)
	}
}

func TestPostFixedFactor_PctOfIndexEscalaERendimento(t *testing.T) {
	rates := []float64{10, 10, 10}

	cem := PostFixedFactor(100, rates)      // 100% do CDI
	cento110 := PostFixedFactor(110, rates) // 110% do CDI — mesmo cenário da lição 3.3 (CDB 110% CDI)
	noventa := PostFixedFactor(90, rates)   // 90% do CDI — mesmo cenário da lição 3.3 (LCI 90% CDI)

	if !(cento110 > cem) {
		t.Errorf("110%% do CDI (%v) não rendeu mais que 100%% do CDI (%v)", cento110, cem)
	}
	if !(noventa < cem) {
		t.Errorf("90%% do CDI (%v) não rendeu menos que 100%% do CDI (%v)", noventa, cem)
	}
}

func TestPostFixedValue_AplicaOFatorSobreOPrincipal(t *testing.T) {
	rates := []float64{10, 10, 10}
	principal := 1000.0

	want := principal * PostFixedFactor(100, rates)
	got := PostFixedValue(principal, 100, rates)
	if !almostEqualPostFixado(got, want, 1e-9) {
		t.Errorf("PostFixedValue = %v, want %v", got, want)
	}
}

func TestPostFixedValue_SemDiasDecorridosDevolveOPrincipal(t *testing.T) {
	got := PostFixedValue(1000, 100, nil)
	if got != 1000 {
		t.Errorf("PostFixedValue(sem dias decorridos) = %v, want 1000 (sem rendimento nenhum ainda)", got)
	}
}
