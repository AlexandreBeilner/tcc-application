package fixedincome

import (
	"math"
	"testing"
)

func TestOfferedRate_SomaSpreadEBenchmark(t *testing.T) {
	tests := []struct {
		name      string
		spread    float64
		benchmark float64
		want      float64
	}{
		{"spread positivo sobre Selic em alta", 0.0175, 0.12, 0.1375},
		{"spread negativo (prêmio abaixo do benchmark)", -0.005, 0.10, 0.095},
		{"benchmark zero devolve só o spread", 0.02, 0, 0.02},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := OfferedRate(tt.spread, tt.benchmark)
			if math.Abs(got-tt.want) > 1e-12 {
				t.Errorf("OfferedRate(%v, %v) = %v, want %v", tt.spread, tt.benchmark, got, tt.want)
			}
		})
	}
}

func TestOfferedRate_AcompanhaBenchmarkQuandoBenchmarkMuda(t *testing.T) {
	// A própria razão de existir desta função (achado da L.4): o mesmo
	// spread contratual ofertado em dois momentos diferentes, com o
	// benchmark tendo se movido, tem que travar taxas diferentes — nunca a
	// mesma taxa pra sempre.
	spread := 0.0175
	rateBefore := OfferedRate(spread, 0.10)
	rateAfter := OfferedRate(spread, 0.15)

	if rateBefore == rateAfter {
		t.Fatal("OfferedRate não deveria ficar igual quando o benchmark muda")
	}
	if rateAfter <= rateBefore {
		t.Errorf("benchmark subiu, OfferedRate deveria subir junto: antes=%v depois=%v", rateBefore, rateAfter)
	}
}

func TestFisherRealRate_ConversaoExata(t *testing.T) {
	tests := []struct {
		name          string
		nominalRate   float64
		inflationRate float64
		want          float64
	}{
		{"nominal 10%, inflação 3%", 0.10, 0.03, (1.10/1.03 - 1)},
		{"nominal igual à inflação => taxa real zero", 0.05, 0.05, 0},
		{"inflação zero => taxa real igual à nominal", 0.08, 0, 0.08},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FisherRealRate(tt.nominalRate, tt.inflationRate)
			if math.Abs(got-tt.want) > 1e-12 {
				t.Errorf("FisherRealRate(%v, %v) = %v, want %v", tt.nominalRate, tt.inflationRate, got, tt.want)
			}
		})
	}
}

func TestFisherRealRate_DivergeDaAproximacaoSimplesNominalMenosInflacao(t *testing.T) {
	// Prova de que a correção de Fisher (equação exata) não é a mesma
	// coisa que a simplificação antiga (Selic nominal usada direto como
	// proxy de taxa real, sem descontar a inflação) — achado da L.4.
	nominal, inflation := 0.10, 0.03
	fisher := FisherRealRate(nominal, inflation)
	naiveApproximation := nominal - inflation

	if math.Abs(fisher-naiveApproximation) < 1e-6 {
		t.Errorf("FisherRealRate (%v) ficou igual demais da aproximação simples nominal-inflação (%v) — teste não está provando a correção exata", fisher, naiveApproximation)
	}
}
