package fii

import (
	"math"
	"testing"
)

func TestPayoutYieldPerCyclePct(t *testing.T) {
	tests := []struct {
		name    string
		fiiType Type
		segment string
		want    float64
	}{
		{"papel mantém 1,1% (13,2% a.a. sobre P/VP 1,00)", TypePapel, "", 1.1},
		{"lajes", TypeTijolo, SegmentLajesCorporativas, 13.2 * 0.75 / 12},
		{"shopping", TypeTijolo, SegmentShoppingCenters, 13.2 * 0.88 / 12},
		{"logística", TypeTijolo, SegmentGalpoesLogisticos, 13.2 * 0.85 / 12},
		{"segmento desconhecido usa o padrão do tijolo", TypeTijolo, "Hospitais", 13.2 * DefaultTijoloPriceToBook / 12},
		{"segmento vazio usa o padrão do tijolo", TypeTijolo, "", 13.2 * DefaultTijoloPriceToBook / 12},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := PayoutYieldPerCyclePct(tt.fiiType, tt.segment)
			if err != nil || math.Abs(got-tt.want) > 1e-12 {
				t.Fatalf("got %v err=%v, want %v", got, err, tt.want)
			}
		})
	}
	if _, err := PayoutYieldPerCyclePct(Type("outro"), ""); err == nil {
		t.Fatal("tipo desconhecido deveria devolver erro")
	}
}

// O Dividend Yield anual sobre o preço (12 × taxa × VP ÷ preço, com preço = VP × P/VP-base) é o
// mesmo nos segmentos: é o ponto do achado 027.
func TestPayoutYieldPerCyclePct_DYAnualIgualEntreSegmentos(t *testing.T) {
	for _, c := range []struct {
		fiiType Type
		segment string
	}{
		{TypeTijolo, SegmentLajesCorporativas}, {TypeTijolo, SegmentShoppingCenters}, {TypeTijolo, SegmentGalpoesLogisticos}, {TypePapel, ""},
	} {
		rate, _ := PayoutYieldPerCyclePct(c.fiiType, c.segment)
		pb, _ := basePriceToBook(c.fiiType, c.segment)
		if dy := PayoutsPerYear * rate / pb; math.Abs(dy-TargetAnnualDividendYieldPct) > 1e-9 {
			t.Errorf("%v %q: DY anual = %v, want %v", c.fiiType, c.segment, dy, TargetAnnualDividendYieldPct)
		}
	}
}
