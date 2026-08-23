package fundamentals

import "testing"

func TestIsReportDay_RespeitaFrequencia(t *testing.T) {
	tests := []struct {
		name                string
		reportFrequencyDays int
		reportDayIndexes    []int // índices (0-based) esperados como dia de relatório, dentro de days
		days                int
	}{
		{name: "quinzenal (default de companies.report_frequency_days)", reportFrequencyDays: DefaultReportFrequencyDays, reportDayIndexes: []int{13, 27, 41}, days: 42},
		{name: "semanal", reportFrequencyDays: 7, reportDayIndexes: []int{6, 13, 20}, days: 21},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			want := make(map[int]bool)
			for _, idx := range tt.reportDayIndexes {
				want[idx] = true
			}

			for i := 0; i < tt.days; i++ {
				if got := IsReportDay(i, tt.reportFrequencyDays); got != want[i] {
					t.Errorf("IsReportDay(%d, %d) = %v, want %v", i, tt.reportFrequencyDays, got, want[i])
				}
			}
		})
	}
}

func TestExpectedGrowth_SelicNaNeutraDevolveCrescimentoBase(t *testing.T) {
	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05}

	if got := ExpectedGrowth(cfg, 10, 10); got != cfg.BaseGrowth {
		t.Errorf("ExpectedGrowth = %v, want %v", got, cfg.BaseGrowth)
	}
}

func TestExpectedGrowth_MesmoComponenteSistemicoDeGrowthSeries(t *testing.T) {
	// GrowthSeries(cfg, selic, neutra) sem ruído deve bater exatamente com
	// ExpectedGrowth pro mesmo ciclo — é o mesmo componente sistêmico, só
	// que GrowthSeries soma o ruído idiossincrático em cima.
	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05, NoiseStdDev: 0, Seed: 1}
	selic := []float64{15.0}

	growthSeries := GrowthSeries(cfg, selic, 10)
	expected := ExpectedGrowth(cfg, selic[0], 10)

	if growthSeries[0] != expected {
		t.Errorf("GrowthSeries sem ruído = %v, want == ExpectedGrowth = %v", growthSeries[0], expected)
	}
}

func TestReportSurprise_SinalReflecteSeVeioMelhorOuPiorQueOEsperado(t *testing.T) {
	if got := ReportSurprise(0.05, 0.03); got <= 0 {
		t.Errorf("ReportSurprise(realizado > esperado) = %v, want positivo (resultado melhor que o esperado)", got)
	}
	if got := ReportSurprise(0.01, 0.03); got >= 0 {
		t.Errorf("ReportSurprise(realizado < esperado) = %v, want negativo (resultado pior que o esperado)", got)
	}
	if got := ReportSurprise(0.03, 0.03); got != 0 {
		t.Errorf("ReportSurprise(realizado == esperado) = %v, want 0", got)
	}
}

func TestReportDayPriceEffect_SurpresaZeroNaoMoveOPreco(t *testing.T) {
	if got := ReportDayPriceEffect(0, 1.5); got != 0 {
		t.Errorf("ReportDayPriceEffect(surpresa=0) = %v, want 0 — bateu com o esperado, preço não deveria reagir", got)
	}
}

func TestReportDayPriceEffect_SurpresaPositivaSobeENegativaDesce(t *testing.T) {
	const priceSensitivity = 1.5

	if got := ReportDayPriceEffect(0.02, priceSensitivity); got <= 0 {
		t.Errorf("ReportDayPriceEffect(surpresa positiva) = %v, want positivo (efeito alívio, resultado melhor que o esperado)", got)
	}
	if got := ReportDayPriceEffect(-0.02, priceSensitivity); got >= 0 {
		t.Errorf("ReportDayPriceEffect(surpresa negativa) = %v, want negativo (resultado pior que o esperado)", got)
	}
}

// TestReportCycle_PrecoSoReageNoDiaDoRelatorio é o critério de aceite
// central da tarefa 3.6: aplicando o efeito de surpresa só nos dias de
// relatório (IsReportDay) ao longo de um ciclo simulado — nos demais dias
// o preço não sofre nenhum efeito de "resultado", só a expectativa
// (drift) já embutida no GBM (equity.Series, fora do escopo desta
// composição de teste).
func TestReportCycle_PrecoSoReageNoDiaDoRelatorio(t *testing.T) {
	const reportFrequencyDays = DefaultReportFrequencyDays
	const priceSensitivity = 1.5
	const selicNeutral = 10.0

	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05, NoiseStdDev: 0.02, Seed: 7}
	selic := make([]float64, reportFrequencyDays*2)
	for i := range selic {
		selic[i] = 12.0 // Selic constante, só o ruído do relatório varia
	}

	actualGrowth := GrowthSeries(cfg, selic, selicNeutral)

	var priceEffects []float64
	for i := 0; i < len(selic); i++ {
		if !IsReportDay(i, reportFrequencyDays) {
			continue // fora do dia de relatório, nenhum efeito de surpresa
		}
		expected := ExpectedGrowth(cfg, selic[i], selicNeutral)
		surprise := ReportSurprise(actualGrowth[i], expected)
		priceEffects = append(priceEffects, ReportDayPriceEffect(surprise, priceSensitivity))
	}

	if len(priceEffects) != 2 {
		t.Fatalf("len(priceEffects) = %d, want 2 (um efeito por ciclo de %d dias, em %d dias simulados)", len(priceEffects), reportFrequencyDays, len(selic))
	}
	// Com ruído (NoiseStdDev > 0), o realizado quase certamente diverge do
	// esperado — o efeito de preço não deveria ficar zerado.
	for i, effect := range priceEffects {
		if effect == 0 {
			t.Errorf("priceEffects[%d] = 0, esperava alguma surpresa não-nula dado o ruído configurado", i)
		}
	}
}
