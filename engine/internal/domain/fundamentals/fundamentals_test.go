package fundamentals

import (
	"errors"
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
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

func TestNextGrowth_PrimeiroCicloBateComGrowthSeries(t *testing.T) {
	// cycleIndex=0 deriva a rng de cfg.Seed+0 = cfg.Seed, o mesmo ponto de
	// partida que GrowthSeries usa pro primeiro elemento — mesmo invariante
	// já coberto por equity.TestNextPrice/selic.TestNextCalendarRate pro
	// dayIndex=0 batendo com Series/CalendarSeries.
	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05, NoiseStdDev: 0.02, Seed: 42}

	got := NextGrowth(cfg, 0, 15, 10)
	want := GrowthSeries(cfg, []float64{15}, 10)[0]

	if got != want {
		t.Errorf("NextGrowth(cycleIndex=0) = %v, want %v (== GrowthSeries[0])", got, want)
	}
}

func TestNextGrowth_DeterministicaPorSeedECycleIndex(t *testing.T) {
	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05, NoiseStdDev: 0.02, Seed: 7}

	a := NextGrowth(cfg, 3, 12, 10)
	b := NextGrowth(cfg, 3, 12, 10)

	if a != b {
		t.Fatalf("NextGrowth divergiu com mesmos parâmetros: %v != %v", a, b)
	}
}

func TestNextGrowth_CycleIndexDiferenteGeraCrescimentoDiferente(t *testing.T) {
	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05, NoiseStdDev: 0.02, Seed: 7}

	a := NextGrowth(cfg, 0, 12, 10)
	b := NextGrowth(cfg, 1, 12, 10)

	if a == b {
		t.Error("NextGrowth com cycleIndex diferentes veio idêntico — ruído deveria variar por ciclo")
	}
}

func TestNextGrowth_SemRuidoBateComExpectedGrowth(t *testing.T) {
	cfg := Config{BaseGrowth: 0.03, Sensitivity: 0.05, NoiseStdDev: 0, Seed: 1}

	got := NextGrowth(cfg, 5, 15, 10)
	want := ExpectedGrowth(cfg, 15, 10)

	if got != want {
		t.Errorf("NextGrowth(sem ruído) = %v, want %v (== ExpectedGrowth)", got, want)
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

// TestDeriveFinancials_SetorDesconhecidoUsaFallbackGenerico é o teste de
// regressão da tarefa K.2: um setor fora dos 6 fixos da spec 3.3.2 (não
// deveria acontecer com o catálogo validado, mas CoefficientsForSector não
// trava por isso) continua derivando os 5 campos exatamente pelos mesmos
// números conhecidos que a tarefa 4.8 já travava (DefaultNetMarginPct
// etc.) — o "resto da fórmula" (netEquity = receita×ratio, netIncome =
// receita×margem, dívida = patrimônio×ratio, caixa = receita×ratio)
// continua funcionando igual, só a fonte do coeficiente mudou.
func TestDeriveFinancials_SetorDesconhecidoUsaFallbackGenerico(t *testing.T) {
	got := DeriveFinancials(catalog.Sector("Inexistente"), NeutralQualityMultiplier, 1_000_000)

	want := Financials{
		NetRevenue:      1_000_000,
		NetIncome:       100_000,   // 1.000.000 × 0.10 (DefaultNetMarginPct)
		EBIT:            180_000,   // 1.000.000 × 0.18 (DefaultEBITMarginPct)
		NetEquity:       1_200_000, // 1.000.000 × 1.2 (DefaultEquityToRevenueRatio)
		GrossDebt:       480_000,   // 1.200.000 × 0.4 (DefaultDebtToEquityRatio)
		CashEquivalents: 150_000,   // 1.000.000 × 0.15 (DefaultCashToRevenueRatio)
	}

	if got != want {
		t.Errorf("DeriveFinancials(setor desconhecido, 1_000_000) = %+v, want %+v", got, want)
	}
}

// TestDeriveFinancials_CoeficientesVariamPorSetor é o critério de aceite
// central da tarefa K.2: setores diferentes (todos os 6 fixos da spec
// 3.3.2, calibrados pela pesquisa da K.1 — .claude/calibracao-fundamentos-
// setor.md) devolvem coeficientes visivelmente distintos pro mesmo
// net_revenue, não mais um único conjunto genérico.
func TestDeriveFinancials_CoeficientesVariamPorSetor(t *testing.T) {
	const netRevenue = 1_000_000.0

	tests := []struct {
		sector catalog.Sector
		want   Financials
	}{
		{catalog.SectorMineracao, Financials{
			NetRevenue: 1_000_000, NetIncome: 150_000, EBIT: 240_000,
			NetEquity: 1_300_000, GrossDebt: 585_000, CashEquivalents: 150_000,
		}},
		{catalog.SectorAgronegocio, Financials{
			NetRevenue: 1_000_000, NetIncome: 70_000, EBIT: 120_000,
			NetEquity: 1_000_000, GrossDebt: 1_000_000, CashEquivalents: 80_000,
		}},
		{catalog.SectorBancario, Financials{
			NetRevenue: 1_000_000, NetIncome: 220_000, EBIT: 300_000,
			NetEquity: 2_200_000, GrossDebt: 3_300_000, CashEquivalents: 300_000,
		}},
		{catalog.SectorVarejo, Financials{
			NetRevenue: 1_000_000, NetIncome: 50_000, EBIT: 90_000,
			NetEquity: 600_000, GrossDebt: 540_000, CashEquivalents: 80_000,
		}},
		{catalog.SectorEnergia, Financials{
			NetRevenue: 1_000_000, NetIncome: 120_000, EBIT: 220_000,
			NetEquity: 1_400_000, GrossDebt: 1_680_000, CashEquivalents: 150_000,
		}},
		{catalog.SectorTecnologia, Financials{
			NetRevenue: 1_000_000, NetIncome: 150_000, EBIT: 220_000,
			NetEquity: 900_000, GrossDebt: 315_000, CashEquivalents: 250_000,
		}},
	}

	seen := make(map[Financials]bool, len(tests))
	for _, tt := range tests {
		t.Run(string(tt.sector), func(t *testing.T) {
			got := DeriveFinancials(tt.sector, NeutralQualityMultiplier, netRevenue)
			if got != tt.want {
				t.Errorf("DeriveFinancials(%s, %v) = %+v, want %+v", tt.sector, netRevenue, got, tt.want)
			}
			if seen[got] {
				t.Errorf("setor %s produziu os mesmos fundamentos de outro setor já testado — coeficientes deveriam ser visivelmente distintos", tt.sector)
			}
			seen[got] = true
		})
	}
}

func TestDeriveFinancials_EBITMarginMaiorQueNetMargin(t *testing.T) {
	// Invariante contábil que qualquer calibração futura precisa continuar
	// respeitando, em todo setor: EBIT vem antes de juros/impostos, por
	// isso é sempre >= net_income pra receita positiva.
	for sector := range CoefficientsBySector {
		got := DeriveFinancials(sector, NeutralQualityMultiplier, 500_000)

		if got.EBIT <= got.NetIncome {
			t.Errorf("setor %s: EBIT (%v) deveria ser maior que NetIncome (%v)", sector, got.EBIT, got.NetIncome)
		}
	}
}

// fairPriceFromFinancials recalcula o preço justo pela mesma fórmula de
// Justified Price-to-Book que bot.FundamentalistFairPrice usa
// (fairPrice = VPA × (ROE/requiredReturn) × (1+growth)), sem importar o
// pacote bot — importar bot em fundamentals criaria um ciclo (bot já
// importa fundamentals). Existe só pra verificar, no teste, o round-trip
// de BootstrapFinancialsForTargetPrice contra a fórmula real que ela
// inverte, sem duplicar essa verificação com um cálculo diferente.
func fairPriceFromFinancials(f Financials, outstandingShares int64, growthRate, requiredReturn float64) float64 {
	vpa := f.NetEquity / float64(outstandingShares)
	roe := f.NetIncome / f.NetEquity
	return vpa * (roe / requiredReturn) * (1 + growthRate)
}

// TestBootstrapFinancialsForTargetPrice_RoundTripReproduzPrecoAlvo é o
// critério de aceite central: pra qualquer combinação de sector/
// targetPrice/outstandingShares/growthRate/selicNeutral, o preço justo
// recalculado a partir dos fundamentos devolvidos precisa bater com
// targetPrice — é essa propriedade que substitui a antiga constante
// initialFundamentalsRevenuePerShare "achada por tentativa" (achado 003 de
// .claude/pontos-em-aberto-decisao-produto.md). Varia o sector entre os
// casos (tarefa K.2) pra provar que o round-trip continua exato
// independente de qual conjunto de coeficientes (CoefficientsBySector) é
// usado — "o resto da fórmula continua igual, só os coeficientes mudam".
func TestBootstrapFinancialsForTargetPrice_RoundTripReproduzPrecoAlvo(t *testing.T) {
	tests := []struct {
		name              string
		sector            catalog.Sector
		targetPrice       float64
		outstandingShares int64
		growthRate        float64
		selicNeutral      float64
	}{
		{"VALR3-like (Mineração)", catalog.SectorMineracao, 100, 500_000_000, 0.03, 0.10},
		{"BNDD4-like (Bancário)", catalog.SectorBancario, 100, 300_000_000, 0.03, 0.10},
		{"Agronegócio, empresa pequena, preço alto", catalog.SectorAgronegocio, 250, 10_000_000, 0.03, 0.10},
		{"Varejo, empresa grande, preço baixo", catalog.SectorVarejo, 12.50, 2_000_000_000, 0.03, 0.10},
		{"Tecnologia, crescimento maior", catalog.SectorTecnologia, 100, 500_000_000, 0.08, 0.10},
		{"Energia, Selic neutra diferente", catalog.SectorEnergia, 100, 500_000_000, 0.03, 0.12},
		{"setor desconhecido (fallback genérico)", catalog.Sector("Inexistente"), 100, 500_000_000, 0.03, 0.10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := BootstrapFinancialsForTargetPrice(tt.sector, NeutralQualityMultiplier, tt.targetPrice, tt.outstandingShares, tt.growthRate, tt.selicNeutral)
			if err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}

			fairPrice := fairPriceFromFinancials(got, tt.outstandingShares, tt.growthRate, tt.selicNeutral)
			if math.Abs(fairPrice-tt.targetPrice) > 1e-6 {
				t.Errorf("preço justo recalculado = %v, want %v (dentro de 1e-6)", fairPrice, tt.targetPrice)
			}
		})
	}
}

// TestBootstrapFinancialsForTargetPrice_RevenuePorAcaoReflecteCoeficientesDoSetor
// substitui, depois da tarefa K.2, a antiga âncora "~97.0" (calibrada só
// contra o conjunto genérico de coeficientes, sessão D.2) — agora que
// VALR3 é uma empresa real de Mineração (cmd/seed/main.go), a receita por
// ação de partida reflete o ROE calibrado desse setor (NetMarginPct/
// EquityToRevenueRatio = 0.15/1.3), não mais o genérico 0.10/1.2. O valor
// abaixo foi derivado uma única vez à mão pela mesma fórmula que
// BootstrapFinancialsForTargetPrice inverte (documentada no comentário da
// função) e travado aqui como regressão — value ≈64.72, não mais ≈97.0.
func TestBootstrapFinancialsForTargetPrice_RevenuePorAcaoReflecteCoeficientesDoSetor(t *testing.T) {
	const outstandingShares = 500_000_000

	got, err := BootstrapFinancialsForTargetPrice(catalog.SectorMineracao, NeutralQualityMultiplier, 100, outstandingShares, 0.03, 0.10)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	revenuePerShare := got.NetRevenue / outstandingShares
	if math.Abs(revenuePerShare-64.72) > 0.5 {
		t.Errorf("net_revenue por ação = %v, want ≈64.72 (recalibrado pra Mineração na tarefa K.2, antes era ≈97.0 com o coeficiente genérico)", revenuePerShare)
	}
}

func TestBootstrapFinancialsForTargetPrice_ErrosDeEntrada(t *testing.T) {
	tests := []struct {
		name              string
		targetPrice       float64
		outstandingShares int64
		growthRate        float64
		selicNeutral      float64
		wantErr           error
	}{
		{"preço-alvo zero", 0, 500_000_000, 0.03, 0.10, ErrInvalidTargetPrice},
		{"preço-alvo negativo", -10, 500_000_000, 0.03, 0.10, ErrInvalidTargetPrice},
		{"ações em circulação zero", 100, 0, 0.03, 0.10, ErrInvalidOutstandingShares},
		{"ações em circulação negativas", 100, -1, 0.03, 0.10, ErrInvalidOutstandingShares},
		{"Selic neutra zero", 100, 500_000_000, 0.03, 0, ErrInvalidNeutralRate},
		{"Selic neutra negativa", 100, 500_000_000, 0.03, -0.05, ErrInvalidNeutralRate},
		{"crescimento anula o fator (1+growth)", 100, 500_000_000, -1, 0.10, ErrInvalidGrowthRate},
		{"crescimento inverte o fator (1+growth)", 100, 500_000_000, -1.5, 0.10, ErrInvalidGrowthRate},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := BootstrapFinancialsForTargetPrice(catalog.SectorMineracao, NeutralQualityMultiplier, tt.targetPrice, tt.outstandingShares, tt.growthRate, tt.selicNeutral)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

// TestDeriveFinancials_QualidadeDiferenciaEmpresasDoMesmoSetor é o critério
// de aceite do achado 025: duas empresas do mesmo setor com multiplicadores
// diferentes têm ROE, margem e alavancagem diferentes (antes eram idênticos),
// e o multiplicador neutro reproduz exatamente o coeficiente do setor.
func TestDeriveFinancials_QualidadeDiferenciaEmpresasDoMesmoSetor(t *testing.T) {
	const netRevenue = 1_000_000.0
	for sector, base := range CoefficientsBySector {
		boa := DeriveFinancials(sector, 1.25, netRevenue)
		media := DeriveFinancials(sector, NeutralQualityMultiplier, netRevenue)
		ruim := DeriveFinancials(sector, 0.75, netRevenue)

		roe := func(f Financials) float64 { return f.NetIncome / f.NetEquity }
		if !(roe(boa) > roe(media) && roe(media) > roe(ruim)) {
			t.Errorf("%s: ROE boa/média/ruim = %v/%v/%v, want estritamente decrescente", sector, roe(boa), roe(media), roe(ruim))
		}
		debtRatio := func(f Financials) float64 { return f.GrossDebt / f.NetEquity }
		if !(debtRatio(boa) < debtRatio(media) && debtRatio(media) < debtRatio(ruim)) {
			t.Errorf("%s: dívida/patrimônio boa/média/ruim = %v/%v/%v, want estritamente crescente", sector, debtRatio(boa), debtRatio(media), debtRatio(ruim))
		}
		if boa.NetEquity != media.NetEquity || boa.CashEquivalents != media.CashEquivalents {
			t.Errorf("%s: patrimônio/caixa não deveriam variar com a qualidade", sector)
		}
		if got, want := roe(media), base.NetMarginPct/base.EquityToRevenueRatio; math.Abs(got-want) > 1e-12 {
			t.Errorf("%s: ROE neutro = %v, want %v (coeficiente do setor)", sector, got, want)
		}
		if boa.EBIT < boa.NetIncome || ruim.EBIT < ruim.NetIncome {
			t.Errorf("%s: EBIT abaixo do lucro líquido com multiplicador de qualidade", sector)
		}
	}
}

// TestCoefficientsForCompany_MultiplicadorNaoPositivoVaiNeutro cobre o
// tratamento defensivo do valor zero (struct sem o campo preenchido).
func TestCoefficientsForCompany_MultiplicadorNaoPositivoVaiNeutro(t *testing.T) {
	want := CoefficientsForSector(catalog.SectorVarejo)
	for _, q := range []float64{0, -1} {
		if got := CoefficientsForCompany(catalog.SectorVarejo, q); got != want {
			t.Errorf("CoefficientsForCompany(Varejo, %v) = %+v, want %+v", q, got, want)
		}
	}
}

// TestBootstrapFinancialsForTargetPrice_QualidadeMantemPrecoJusto: o preço
// justo de partida bate com o alvo independente do multiplicador (empresa
// melhor precisa de menos patrimônio pro mesmo preço).
func TestBootstrapFinancialsForTargetPrice_QualidadeMantemPrecoJusto(t *testing.T) {
	const shares, growth, neutral = int64(1_000_000), 0.03, 0.10
	for _, q := range []float64{0.75, 1.0, 1.25} {
		f, err := BootstrapFinancialsForTargetPrice(catalog.SectorTecnologia, q, 100, shares, growth, neutral)
		if err != nil {
			t.Fatalf("q=%v: %v", q, err)
		}
		vpa := f.NetEquity / float64(shares)
		fair := vpa * (f.NetIncome / f.NetEquity / neutral) * (1 + growth)
		if math.Abs(fair-100) > 1e-6 {
			t.Errorf("q=%v: preço justo = %v, want 100", q, fair)
		}
	}
}
