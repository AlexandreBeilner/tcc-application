package ipca

import (
	"math"
	"testing"
)

func TestMonthlySeries_DentroDaBanda(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.01, Seed: 1}

	for i, rate := range MonthlySeries(cfg, 1000) {
		if rate < cfg.MonthlyTarget-cfg.MaxDeviation || rate > cfg.MonthlyTarget+cfg.MaxDeviation {
			t.Fatalf("rates[%d] = %v, fora da banda [%v, %v]", i, rate, cfg.MonthlyTarget-cfg.MaxDeviation, cfg.MonthlyTarget+cfg.MaxDeviation)
		}
	}
}

func TestMonthlySeries_DeterministicaPorSeed(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.001, Seed: 42}

	a := MonthlySeries(cfg, 60)
	b := MonthlySeries(cfg, 60)

	if len(a) != len(b) {
		t.Fatalf("len(a) = %d, len(b) = %d", len(a), len(b))
	}
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("série divergiu no índice %d: %v != %v — mesmo seed devia gerar série idêntica", i, a[i], b[i])
		}
	}
}

func TestMonthlySeries_SeedsDiferentesGeramSeriesDiferentes(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.001}
	cfgA := cfg
	cfgA.Seed = 1
	cfgB := cfg
	cfgB.Seed = 2

	a := MonthlySeries(cfgA, 60)
	b := MonthlySeries(cfgB, 60)

	identical := true
	for i := range a {
		if a[i] != b[i] {
			identical = false
			break
		}
	}
	if identical {
		t.Error("séries com seeds diferentes vieram idênticas")
	}
}

func TestMonthlySeries_MesesNaoPositivoRetornaNil(t *testing.T) {
	tests := []int{0, -1, -5}
	for _, months := range tests {
		cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.001, Seed: 1}
		if got := MonthlySeries(cfg, months); got != nil {
			t.Errorf("MonthlySeries(months=%d) = %v, want nil", months, got)
		}
	}
}

func TestMonthlySeries_SemRuidoFicaExatamenteNaMeta(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.0045, MaxDeviation: 0.002, Volatility: 0, Seed: 1}

	for i, rate := range MonthlySeries(cfg, 24) {
		if rate != cfg.MonthlyTarget {
			t.Fatalf("rates[%d] = %v, want %v (sem ruído, deveria ficar exatamente na meta)", i, rate, cfg.MonthlyTarget)
		}
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig(99)

	if cfg.MonthlyTarget != DefaultMonthlyTarget {
		t.Errorf("MonthlyTarget = %v, want %v", cfg.MonthlyTarget, DefaultMonthlyTarget)
	}
	if cfg.MaxDeviation != DefaultMaxDeviation {
		t.Errorf("MaxDeviation = %v, want %v", cfg.MaxDeviation, DefaultMaxDeviation)
	}
	if cfg.Volatility != DefaultVolatility {
		t.Errorf("Volatility = %v, want %v", cfg.Volatility, DefaultVolatility)
	}
	if cfg.Seed != 99 {
		t.Errorf("Seed = %v, want 99", cfg.Seed)
	}
}

func TestCurrentMonthIndex_TodoDiaJaPertenceAUmMes(t *testing.T) {
	tests := []struct {
		dayIndex, monthDays, want int
	}{
		{0, 30, 0},
		{29, 30, 0},
		{30, 30, 1},
		{59, 30, 1},
		{60, 30, 2},
	}
	for _, tt := range tests {
		if got := CurrentMonthIndex(tt.dayIndex, tt.monthDays); got != tt.want {
			t.Errorf("CurrentMonthIndex(%d, %d) = %d, want %d", tt.dayIndex, tt.monthDays, got, tt.want)
		}
	}
}

func TestMonthlyRate_DentroDaBanda(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.01, Seed: 1}

	for m := 0; m < 1000; m++ {
		rate := MonthlyRate(cfg, m)
		if rate < cfg.MonthlyTarget-cfg.MaxDeviation || rate > cfg.MonthlyTarget+cfg.MaxDeviation {
			t.Fatalf("MonthlyRate(cfg, %d) = %v, fora da banda [%v, %v]", m, rate, cfg.MonthlyTarget-cfg.MaxDeviation, cfg.MonthlyTarget+cfg.MaxDeviation)
		}
	}
}

func TestMonthlyRate_DeterministicaPorMonthIndex(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.001, Seed: 42}

	if a, b := MonthlyRate(cfg, 7), MonthlyRate(cfg, 7); a != b {
		t.Fatalf("MonthlyRate(cfg, 7) divergiu entre chamadas: %v != %v", a, b)
	}
}

func TestMonthlyRate_MesesDiferentesGeramValoresDiferentes(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.001, Seed: 1}

	if MonthlyRate(cfg, 0) == MonthlyRate(cfg, 1) {
		t.Error("meses diferentes vieram com o mesmo valor")
	}
}

func TestMonthlyRate_NaoPrecisaDosMesesAnterioresPraSerDeterministica(t *testing.T) {
	// MonthlyRate não tem memória entre meses — chamar direto pro mês 11
	// tem que dar o mesmo valor que chamar depois de "visitar" os meses
	// 0..10 antes, provando que não há estado implícito compartilhado
	// entre chamadas (diferente de selic.NextCalendarRate, que replay-less
	// mas ainda depende de currentRate vindo de fora).
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0.001, Seed: 9}

	direct := MonthlyRate(cfg, 11)

	for m := 0; m < 11; m++ {
		MonthlyRate(cfg, m)
	}
	afterVisitingEarlierMonths := MonthlyRate(cfg, 11)

	if direct != afterVisitingEarlierMonths {
		t.Fatalf("MonthlyRate(cfg, 11) = %v chamado direto, %v depois de visitar meses anteriores — deveria ser idêntico", direct, afterVisitingEarlierMonths)
	}
}

func TestAccumulated12m_ComposicaoNaoSomaSimples(t *testing.T) {
	// Volatility = 0 trava todo mês exatamente na meta — o acumulado
	// esperado é (1+meta)^12 - 1 por composição, não 12*meta por soma.
	cfg := Config{MonthlyTarget: 0.01, MaxDeviation: 0.02, Volatility: 0, Seed: 1}

	got := Accumulated12m(cfg, 11) // meses 0..11, 12 meses completos
	wantComposed := math.Pow(1.01, 12) - 1
	wantSummed := 12 * 0.01

	if math.Abs(got-wantComposed) > 1e-9 {
		t.Fatalf("Accumulated12m = %v, want %v (composição)", got, wantComposed)
	}
	if math.Abs(got-wantSummed) < 1e-9 {
		t.Fatalf("Accumulated12m = %v bateu com soma simples (%v) — deveria divergir (juros compostos)", got, wantSummed)
	}
}

func TestAccumulated12m_JanelaParcialAntesDosPrimeiros12Meses(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.01, MaxDeviation: 0.02, Volatility: 0, Seed: 1}

	// monthIndex = 2 → só 3 meses existem (0, 1, 2), janela parcial.
	got := Accumulated12m(cfg, 2)
	want := 1.01*1.01*1.01 - 1

	if math.Abs(got-want) > 1e-9 {
		t.Fatalf("Accumulated12m(cfg, 2) = %v, want %v (janela parcial de 3 meses)", got, want)
	}
}

func TestAccumulated12m_SoUsaOsUltimos12MesesQuandoHaMais(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.02, Volatility: 0.001, Seed: 5}

	// monthIndex = 20 (21 meses existem) deve compor só 9..20 (12 meses),
	// nunca incluir o mês 0 — sensível a Volatility != 0 pra provar que a
	// janela é mesmo deslizante, não "todos os meses desde o início".
	got := Accumulated12m(cfg, 20)

	manual := 1.0
	for m := 9; m <= 20; m++ {
		manual *= 1 + MonthlyRate(cfg, m)
	}
	manual--

	if math.Abs(got-manual) > 1e-12 {
		t.Fatalf("Accumulated12m(cfg, 20) = %v, want %v (composição dos meses 9..20)", got, manual)
	}
}

func TestAccumulated12m_MonthIndexNegativoDevolveZero(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.02, Volatility: 0.001, Seed: 1}

	if got := Accumulated12m(cfg, -1); got != 0 {
		t.Errorf("Accumulated12m(cfg, -1) = %v, want 0", got)
	}
}

func TestAnnualizedTarget_ComposicaoDaMetaMensal(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.00367}

	got := AnnualizedTarget(cfg)
	want := math.Pow(1.00367, 12) - 1

	if math.Abs(got-want) > 1e-12 {
		t.Fatalf("AnnualizedTarget = %v, want %v", got, want)
	}
}

func TestAccumulatedDeviation_SemRuidoEBatendoNaMetaDevolveZero(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.00367, MaxDeviation: 0.01, Volatility: 0, Seed: 1}

	got := AccumulatedDeviation(cfg, 11)
	if math.Abs(got) > 1e-9 {
		t.Errorf("AccumulatedDeviation = %v, want ~0 (IPCA acumulado sem ruído bate exatamente a meta anualizada)", got)
	}
}

func TestAccumulatedDeviation_SemRuidoDevolveZeroMesmoEmJanelaParcial(t *testing.T) {
	// Achado desta tarefa: comparar um acumulado de poucos meses contra a
	// meta ANUALIZADA (12 meses fixos) sempre pareceria "abaixo da meta"
	// antes do primeiro ano simulado, mesmo com o IPCA mensal rodando
	// exatamente em cima dela — AccumulatedDeviation precisa comparar
	// contra a meta da MESMA janela (TargetForWindow), não sempre
	// AnnualizedTarget, pra não injetar um viés artificial na reação da
	// Selic (tarefa I.1) nos primeiros meses de qualquer simulação nova.
	cfg := Config{MonthlyTarget: 0.00367, MaxDeviation: 0.01, Volatility: 0, Seed: 1}

	for _, monthIndex := range []int{0, 2, 5, 10} {
		got := AccumulatedDeviation(cfg, monthIndex)
		if math.Abs(got) > 1e-9 {
			t.Errorf("AccumulatedDeviation(cfg, %d) = %v, want ~0 (janela parcial, IPCA sem ruído bate a própria meta)", monthIndex, got)
		}
	}
}

func TestAccumulatedDeviation_BateraDiferencaEntreAccumulated12mEAnnualizedTarget(t *testing.T) {
	cfg := Config{MonthlyTarget: 0.004, MaxDeviation: 0.02, Volatility: 0.003, Seed: 5}

	got := AccumulatedDeviation(cfg, 11)
	want := Accumulated12m(cfg, 11) - AnnualizedTarget(cfg)

	if math.Abs(got-want) > 1e-12 {
		t.Fatalf("AccumulatedDeviation = %v, want %v (Accumulated12m - AnnualizedTarget)", got, want)
	}
}
