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

func TestActualGrowthWithMacroEffect_SemEfeitoNaoAlteraOCrescimento(t *testing.T) {
	const baseGrowth = 0.03
	if got := ActualGrowthWithMacroEffect(baseGrowth, 0); got != baseGrowth {
		t.Errorf("ActualGrowthWithMacroEffect(%v, 0) = %v, want %v (sem efeito macro pendente, crescimento inalterado)", baseGrowth, got, baseGrowth)
	}
}

func TestActualGrowthWithMacroEffect_ConverteEscalaPercentualParaFracao(t *testing.T) {
	// combinedMacroEffectPct=10 (10%, escala percentual de
	// macroevent.EffectRange) deve somar 0.10 em fração, não 10.
	got := ActualGrowthWithMacroEffect(0.03, 10)
	want := 0.13
	if diff := got - want; diff > 1e-12 || diff < -1e-12 {
		t.Errorf("ActualGrowthWithMacroEffect(0.03, 10) = %v, want %v", got, want)
	}
}

// TestActualGrowthWithMacroEffect_PreservaSinalDoEfeito confirma que um
// efeito macro negativo/positivo desloca o crescimento realizado na mesma
// direção — a propriedade que faz "resultado vs. expectativa" continuar
// coerente com efeito macro embutido, mesmo sem a fórmula de "surpresa"
// separada (fundamentals.ReportSurprise/ReportDayPriceEffect, removidas na
// tarefa F.1 do backlog-motor-mercado-realista: quem agora observa esse
// desvio é o Fundamentalista reavaliando o preço justo contra o
// net_revenue divulgado, não uma comparação feita aqui). Cobertura de
// ponta a ponta ("efeito macro no dia do relatório muda o net_revenue
// divulgado, que move o preço via negociação real") vive em tick_test.go
// (TestAdvance_EfeitoDeFundamentosMacroNoDiaDoRelatorio) e
// tick/rounds_test.go (TestService_Run_Relatorio*).
func TestActualGrowthWithMacroEffect_PreservaSinalDoEfeito(t *testing.T) {
	const baseGrowth = 0.03

	if got := ActualGrowthWithMacroEffect(baseGrowth, -20); got >= baseGrowth {
		t.Errorf("ActualGrowthWithMacroEffect(%v, -20) = %v, want < %v (efeito negativo reduz o crescimento realizado)", baseGrowth, got, baseGrowth)
	}
	if got := ActualGrowthWithMacroEffect(baseGrowth, 20); got <= baseGrowth {
		t.Errorf("ActualGrowthWithMacroEffect(%v, 20) = %v, want > %v (efeito positivo aumenta o crescimento realizado)", baseGrowth, got, baseGrowth)
	}
}
