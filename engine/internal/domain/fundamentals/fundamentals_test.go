package fundamentals

import (
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/equity"
)

func constantSelic(rate float64, cycles int) []float64 {
	rates := make([]float64, cycles)
	for i := range rates {
		rates[i] = rate
	}
	return rates
}

func TestGrowthSeries_SelicNaNeutraDevolveCrescimentoBase(t *testing.T) {
	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05, NoiseStdDev: 0, Seed: 1}

	got := GrowthSeries(cfg, constantSelic(10, 12), 10)

	for i, g := range got {
		if math.Abs(g-cfg.BaseGrowth) > 1e-9 {
			t.Fatalf("growth[%d] = %v, want %v (Selic na neutra, sem ruído, deveria ficar no crescimento_base)", i, g, cfg.BaseGrowth)
		}
	}
}

func TestGrowthSeries_SelicAcimaDaNeutraReduzCrescimento(t *testing.T) {
	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05, NoiseStdDev: 0, Seed: 1}

	got := GrowthSeries(cfg, constantSelic(15, 4), 10) // Selic 5 p.p. acima da neutra

	want := 0.03 - 0.05*5.0
	for i, g := range got {
		if math.Abs(g-want) > 1e-9 {
			t.Fatalf("growth[%d] = %v, want %v (Selic acima da neutra deveria reduzir o crescimento)", i, g, want)
		}
	}
}

func TestGrowthSeries_SelicAbaixoDaNeutraAumentaCrescimento(t *testing.T) {
	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05, NoiseStdDev: 0, Seed: 1}

	got := GrowthSeries(cfg, constantSelic(5, 4), 10) // Selic 5 p.p. abaixo da neutra

	want := 0.03 + 0.05*5.0
	for i, g := range got {
		if math.Abs(g-want) > 1e-9 {
			t.Fatalf("growth[%d] = %v, want %v (Selic abaixo da neutra deveria aumentar o crescimento)", i, g, want)
		}
	}
}

func TestGrowthSeries_SofisticadoMaisSensivelQueConservador(t *testing.T) {
	const baseGrowth = 0.03
	const selicNeutral = 10.0
	selicChoque := constantSelic(18, 4) // choque de juros: 8 p.p. acima da neutra

	conservador := GrowthSeries(Config{
		BaseGrowth: baseGrowth, Sensitivity: SensitivityByRiskClass[equity.RiskClassConservador], NoiseStdDev: 0, Seed: 1,
	}, selicChoque, selicNeutral)
	sofisticado := GrowthSeries(Config{
		BaseGrowth: baseGrowth, Sensitivity: SensitivityByRiskClass[equity.RiskClassSofisticado], NoiseStdDev: 0, Seed: 1,
	}, selicChoque, selicNeutral)

	quedaConservador := baseGrowth - conservador[0]
	quedaSofisticado := baseGrowth - sofisticado[0]

	if quedaSofisticado <= quedaConservador {
		t.Fatalf("queda de crescimento do Sofisticado (%v) deveria ser maior que a do Conservador (%v) sob o mesmo choque de Selic", quedaSofisticado, quedaConservador)
	}
}

func TestGrowthSeries_DeterministicaPorSeed(t *testing.T) {
	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05, NoiseStdDev: 0.01, Seed: 42}
	selic := constantSelic(11, 20)

	a := GrowthSeries(cfg, selic, 10)
	b := GrowthSeries(cfg, selic, 10)

	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("série divergiu no índice %d: %v != %v — mesmo seed devia gerar série idêntica", i, a[i], b[i])
		}
	}
}

func TestGrowthSeries_SeedsDiferentesGeramSeriesDiferentes(t *testing.T) {
	base := Config{BaseGrowth: 0.03, Sensitivity: 0.05, NoiseStdDev: 0.01}
	selic := constantSelic(11, 20)

	cfgA := base
	cfgA.Seed = 1
	cfgB := base
	cfgB.Seed = 2

	a := GrowthSeries(cfgA, selic, 10)
	b := GrowthSeries(cfgB, selic, 10)

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

func TestGrowthSeries_SemSelicRatesRetornaNil(t *testing.T) {
	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05, Seed: 1}

	if got := GrowthSeries(cfg, nil, 10); got != nil {
		t.Errorf("GrowthSeries(sem Selic) = %v, want nil", got)
	}
}

func TestRevenueSeries_Composicao(t *testing.T) {
	got := RevenueSeries(1000, []float64{0.03, -0.01})
	want := []float64{1030, 1019.7}

	if len(got) != len(want) {
		t.Fatalf("len(got) = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if math.Abs(got[i]-want[i]) > 1e-9 {
			t.Errorf("got[%d] = %v, want %v", i, got[i], want[i])
		}
	}
}

// TestRevenueSeries_ReageDeFormaPlausivelAMudancasDeSelic é o critério de
// aceite central da tarefa 3.5, na ponta em que ele mais importa — o
// valor em R$ de net_revenue, não só a taxa de crescimento abstrata: uma
// empresa Sofisticada projetada sob um choque de juros alto termina com
// receita menor do que a mesma empresa sob Selic na neutra, e essa queda é
// maior que a de uma empresa Conservadora sob o mesmo choque.
func TestRevenueSeries_ReageDeFormaPlausivelAMudancasDeSelic(t *testing.T) {
	const baseRevenue = 1_000_000.0
	const baseGrowth = 0.03
	const selicNeutral = 10.0
	const cycles = 8

	revenueUnder := func(riskClass equity.RiskClass, selicPath []float64) float64 {
		cfg := Config{BaseGrowth: baseGrowth, Sensitivity: SensitivityByRiskClass[riskClass], NoiseStdDev: 0, Seed: 1}
		growth := GrowthSeries(cfg, selicPath, selicNeutral)
		revenue := RevenueSeries(baseRevenue, growth)
		return revenue[len(revenue)-1]
	}

	selicNaNeutra := constantSelic(selicNeutral, cycles)
	choqueDeJuros := constantSelic(20, cycles) // 10 p.p. acima da neutra

	conservadorNeutro := revenueUnder(equity.RiskClassConservador, selicNaNeutra)
	conservadorChoque := revenueUnder(equity.RiskClassConservador, choqueDeJuros)
	sofisticadoNeutro := revenueUnder(equity.RiskClassSofisticado, selicNaNeutra)
	sofisticadoChoque := revenueUnder(equity.RiskClassSofisticado, choqueDeJuros)

	if conservadorChoque >= conservadorNeutro {
		t.Errorf("receita do Conservador sob choque de juros (%v) deveria ser menor que na Selic neutra (%v)", conservadorChoque, conservadorNeutro)
	}
	if sofisticadoChoque >= sofisticadoNeutro {
		t.Errorf("receita do Sofisticado sob choque de juros (%v) deveria ser menor que na Selic neutra (%v)", sofisticadoChoque, sofisticadoNeutro)
	}

	quedaConservador := conservadorNeutro - conservadorChoque
	quedaSofisticado := sofisticadoNeutro - sofisticadoChoque
	if quedaSofisticado <= quedaConservador {
		t.Errorf("queda de receita do Sofisticado (%v) deveria ser maior que a do Conservador (%v) sob o mesmo choque de juros", quedaSofisticado, quedaConservador)
	}
}
