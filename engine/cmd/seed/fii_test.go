package main

import (
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/dividend"
	"tcc-investimentos/engine/internal/domain/fii"
	"tcc-investimentos/engine/internal/domain/selic"
	"tcc-investimentos/engine/internal/domain/tick"
)

// Tarefa U.5: o valor-base inicial dos 5 FIIs do seed faz o preço justo do dia
// 1 (Selic neutra) bater com o preço inicial, nos 3 segmentos de tijolo e nos
// 2 indexadores de papel, sem degrau no primeiro tick.
func TestFIIInitialBaseValue_PrecoJustoDoDiaUmIgualAoPrecoInicial(t *testing.T) {
	cases := []struct {
		name    string
		fiiType fii.Type
		segment string
	}{
		{"TJLO11 lajes", fii.TypeTijolo, fii.SegmentLajesCorporativas},
		{"SHPP11 shopping", fii.TypeTijolo, fii.SegmentShoppingCenters},
		{"LOGT11 logística", fii.TypeTijolo, "Galpões Logísticos"},
		{"PAPL11 papel CDI", fii.TypePapel, ""},
		{"IPCP11 papel IPCA+", fii.TypePapel, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			base := fiiInitialBaseValue(c.fiiType, c.segment)
			pb, err := fii.TargetPriceToBook(c.fiiType, c.segment, selic.DefaultNeutralRate, selic.DefaultNeutralRate)
			if err != nil {
				t.Fatal(err)
			}
			fair, ok := fii.FairPrice(base, fiiOutstandingShares, pb, 0, 0)
			if !ok || math.Abs(fair-tick.DefaultInitialPrice) > 1e-6 {
				t.Fatalf("preço justo do dia 1 = %v (ok=%v), want %v", fair, ok, tick.DefaultInitialPrice)
			}

			// Dividend Yield anual inicial sobre o preço (12 pagamentos de 1,1% do VP).
			yieldPct, err := fii.PayoutYieldPerCyclePct(c.fiiType, c.segment)
			if err != nil {
				t.Fatal(err)
			}
			perShare, _ := dividend.FIIValuePerShare(base, fiiOutstandingShares, yieldPct)
			dy := perShare * 12 / tick.DefaultInitialPrice * 100
			t.Logf("%s: base=%.2f P/VP-alvo=%.2f DY anual=%.1f%%", c.name, base, pb, dy)
			// Achado 027: o DY anual inicial é o mesmo em todos os segmentos.
			if math.Abs(dy-fii.TargetAnnualDividendYieldPct) > 1e-6 {
				t.Fatalf("DY anual inicial = %.4f%%, want %.1f%%", dy, fii.TargetAnnualDividendYieldPct)
			}
		})
	}
}
