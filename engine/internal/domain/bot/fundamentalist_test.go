package bot

import (
	"errors"
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/orderbook"
)

func mustFundamentalistPersonality(t *testing.T, knowledgeLevel, maxPositionSizePct float64) Personality {
	t.Helper()
	riskProfile, err := NewRiskProfile(maxPositionSizePct, 0.5, 0)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	scope := validScope(t)
	personality, err := NewPersonality(ArchetypeFundamentalista, scope, &knowledgeLevel, riskProfile)
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}
	return personality
}

// financialsFixture é um cenário fixo (ROE = 10%, VPA = 10) reusado por
// vários testes desta suíte.
func financialsFixture() (fundamentals.Financials, int64) {
	return fundamentals.Financials{NetIncome: 100_000, NetEquity: 1_000_000}, 100_000
}

func TestFundamentalistFairPrice_SensibilidadeASelicProporcionalAoRiskClass(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	const growthRate = 0.03
	const selicNeutral = 0.10
	const shockedSelic = 0.14 // +4 p.p. acima da neutra

	basePrice, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 0, selicNeutral, selicNeutral, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("basePrice: err = %v, want nil", err)
	}

	conservadorPrice, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 0, shockedSelic, selicNeutral, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("conservadorPrice: err = %v, want nil", err)
	}
	sofisticadoPrice, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 0, shockedSelic, selicNeutral, equity.RiskClassSofisticado)
	if err != nil {
		t.Fatalf("sofisticadoPrice: err = %v, want nil", err)
	}

	if conservadorPrice >= basePrice {
		t.Fatalf("conservadorPrice (%.6f) deveria cair frente à basePrice (%.6f) com Selic acima da neutra", conservadorPrice, basePrice)
	}
	if sofisticadoPrice >= basePrice {
		t.Fatalf("sofisticadoPrice (%.6f) deveria cair frente à basePrice (%.6f) com Selic acima da neutra", sofisticadoPrice, basePrice)
	}

	conservadorDrop := (basePrice - conservadorPrice) / basePrice
	sofisticadoDrop := (basePrice - sofisticadoPrice) / basePrice
	if sofisticadoDrop <= conservadorDrop {
		t.Fatalf("queda do Sofisticado (%.4f%%) deveria ser maior que a do Conservador (%.4f%%) com o mesmo choque de Selic", sofisticadoDrop*100, conservadorDrop*100)
	}
}

func TestFundamentalistFairPrice_SemChoqueDeSelicRiskClassNaoImporta(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	const growthRate = 0.03
	const selicNeutral = 0.10

	conservadorPrice, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 0, selicNeutral, selicNeutral, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	sofisticadoPrice, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 0, selicNeutral, selicNeutral, equity.RiskClassSofisticado)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if conservadorPrice != sofisticadoPrice {
		t.Fatalf("sem desvio da Selic neutra, o risk_class não deveria importar: conservador=%.6f, sofisticado=%.6f", conservadorPrice, sofisticadoPrice)
	}
}

func TestDecideFundamentalistOrder_ConhecimentoAltoConvergeMaisDoQueBaixo(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	const growthRate = 0.03
	const selicNeutral = 0.10

	fairPrice, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 0, selicNeutral, selicNeutral, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("fairPrice: err = %v, want nil", err)
	}
	// Preço de mercado bem abaixo do preço justo — garante que o lado
	// sorteado (compra) nunca inverte por causa do ruído, mesmo no bot de
	// conhecimento mais baixo, então todas as amostras entram na média.
	currentMarketPrice := fairPrice * 0.3

	averageDeviation := func(knowledgeLevel float64) float64 {
		personality := mustFundamentalistPersonality(t, knowledgeLevel, 0.5)
		var sum float64
		const samples = 300
		for seed := int64(0); seed < samples; seed++ {
			decision, err := DecideFundamentalistOrder(personality, financials, outstandingShares, growthRate, 0, currentMarketPrice, selicNeutral, selicNeutral, equity.RiskClassConservador, 1_000_000, 0, seed)
			if err != nil {
				t.Fatalf("knowledgeLevel %.2f, seed %d: err = %v, want nil", knowledgeLevel, seed, err)
			}
			sum += math.Abs(decision.Price-fairPrice) / fairPrice
		}
		return sum / samples
	}

	avgHigh := averageDeviation(0.95)
	avgLow := averageDeviation(0.05)

	if avgHigh >= avgLow {
		t.Fatalf("desvio médio do bot de conhecimento alto (%.6f) deveria ser bem menor que o do bot de conhecimento baixo (%.6f)", avgHigh, avgLow)
	}
	// Margem folgada (metade) — a proporção teórica é ~19x, então
	// qualquer coisa acima de 2x já confirma a convergência sem risco de
	// flakiness por variação amostral.
	if avgHigh >= avgLow/2 {
		t.Fatalf("desvio médio do bot de conhecimento alto (%.6f) deveria ser bem menor (< metade) que o do bot de conhecimento baixo (%.6f)", avgHigh, avgLow)
	}
}

func TestDecideFundamentalistOrder_DirecaoConformeAoDesvio(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	const growthRate = 0.03
	const selicNeutral = 0.10

	fairPrice, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 0, selicNeutral, selicNeutral, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("fairPrice: err = %v, want nil", err)
	}

	// knowledgeLevel = 1 elimina o ruído (desvio-padrão zero), tornando o
	// teste de direção determinístico.
	personality := mustFundamentalistPersonality(t, 1.0, 0.5)

	t.Run("mercado abaixo do preço justo, compra", func(t *testing.T) {
		got, err := DecideFundamentalistOrder(personality, financials, outstandingShares, growthRate, 0, fairPrice*0.5, selicNeutral, selicNeutral, equity.RiskClassConservador, 1_000_000, 0, 1)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if got.Side != orderbook.SideBuy {
			t.Fatalf("Side = %v, want buy", got.Side)
		}
	})
	t.Run("mercado acima do preço justo, venda", func(t *testing.T) {
		got, err := DecideFundamentalistOrder(personality, financials, outstandingShares, growthRate, 0, fairPrice*2, selicNeutral, selicNeutral, equity.RiskClassConservador, 0, 1_000, 1)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if got.Side != orderbook.SideSell {
			t.Fatalf("Side = %v, want sell", got.Side)
		}
	})
}

func TestDecideFundamentalistOrder_ErroSemMispricingClaro(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	const growthRate = 0.03
	const selicNeutral = 0.10

	fairPrice, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 0, selicNeutral, selicNeutral, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("fairPrice: err = %v, want nil", err)
	}

	personality := mustFundamentalistPersonality(t, 1.0, 0.5)
	_, err = DecideFundamentalistOrder(personality, financials, outstandingShares, growthRate, 0, fairPrice, selicNeutral, selicNeutral, equity.RiskClassConservador, 1_000_000, 1_000, 1)
	if !errors.Is(err, ErrNoMispricingDetected) {
		t.Fatalf("err = %v, want %v", err, ErrNoMispricingDetected)
	}
}

func TestDecideFundamentalistOrder_NuncaExcedeCaixaOuPosicao(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	const growthRate = 0.03
	const selicNeutral = 0.10

	fairPrice, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 0, selicNeutral, selicNeutral, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("fairPrice: err = %v, want nil", err)
	}

	tests := []struct {
		name               string
		currentMarketPrice float64
		availableCash      float64
		currentPosition    int
	}{
		{name: "compra, caixa apertado", currentMarketPrice: fairPrice * 0.5, availableCash: 50, currentPosition: 0},
		{name: "compra, caixa generoso", currentMarketPrice: fairPrice * 0.5, availableCash: 1_000_000, currentPosition: 0},
		{name: "venda, posição pequena", currentMarketPrice: fairPrice * 2, availableCash: 0, currentPosition: 3},
		{name: "venda, posição grande", currentMarketPrice: fairPrice * 2, availableCash: 0, currentPosition: 10_000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, knowledgeLevel := range []float64{0.1, 0.5, 0.9} {
				for _, pct := range []float64{0.1, 0.5, 1.0} {
					personality := mustFundamentalistPersonality(t, knowledgeLevel, pct)
					for seed := int64(0); seed < 20; seed++ {
						got, err := DecideFundamentalistOrder(personality, financials, outstandingShares, growthRate, 0, tt.currentMarketPrice, selicNeutral, selicNeutral, equity.RiskClassConservador, tt.availableCash, tt.currentPosition, seed)
						if err != nil {
							t.Fatalf("knowledge %.1f pct %.1f seed %d: err = %v, want nil", knowledgeLevel, pct, seed, err)
						}
						if got.Quantity < 1 {
							t.Fatalf("Quantity = %d, want >= 1", got.Quantity)
						}
						switch got.Side {
						case orderbook.SideBuy:
							if cost := got.Price * float64(got.Quantity); cost > tt.availableCash+1e-9 {
								t.Fatalf("custo %.4f excede caixa disponível %.4f", cost, tt.availableCash)
							}
						case orderbook.SideSell:
							if got.Quantity > tt.currentPosition {
								t.Fatalf("quantidade %d excede posição atual %d", got.Quantity, tt.currentPosition)
							}
						}
					}
				}
			}
		})
	}
}

func TestDecideFundamentalistOrder_Deterministico(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	personality := mustFundamentalistPersonality(t, 0.4, 0.5)

	first, err := DecideFundamentalistOrder(personality, financials, outstandingShares, 0.03, 0, 5, 0.10, 0.10, equity.RiskClassConservador, 10_000, 0, 42)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	second, err := DecideFundamentalistOrder(personality, financials, outstandingShares, 0.03, 0, 5, 0.10, 0.10, equity.RiskClassConservador, 10_000, 0, 42)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if first != second {
		t.Fatalf("mesma seed produziu decisões diferentes: %+v != %+v", first, second)
	}
}

func TestDecideFundamentalistOrder_ErroSemRecursoParaOLadoIndicado(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	personality := mustFundamentalistPersonality(t, 1.0, 0.5)

	t.Run("compra, sem caixa suficiente", func(t *testing.T) {
		_, err := DecideFundamentalistOrder(personality, financials, outstandingShares, 0.03, 0, 1, 0.10, 0.10, equity.RiskClassConservador, 0, 0, 1)
		if !errors.Is(err, ErrNoViableOrder) {
			t.Fatalf("err = %v, want %v", err, ErrNoViableOrder)
		}
	})
	t.Run("venda, sem posição", func(t *testing.T) {
		_, err := DecideFundamentalistOrder(personality, financials, outstandingShares, 0.03, 0, 1_000, 0.10, 0.10, equity.RiskClassConservador, 0, 0, 1)
		if !errors.Is(err, ErrNoViableOrder) {
			t.Fatalf("err = %v, want %v", err, ErrNoViableOrder)
		}
	})
}

func TestDecideFundamentalistOrder_ErroArquetipoErrado(t *testing.T) {
	riskProfile, err := NewRiskProfile(0.5, 0.5, 0)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	scope := validScope(t)
	personality, err := NewPersonality(ArchetypeChartista, scope, nil, riskProfile)
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}

	financials, outstandingShares := financialsFixture()
	_, err = DecideFundamentalistOrder(personality, financials, outstandingShares, 0.03, 0, 10, 0.10, 0.10, equity.RiskClassConservador, 1_000, 10, 1)
	if !errors.Is(err, ErrWrongArchetype) {
		t.Fatalf("err = %v, want %v", err, ErrWrongArchetype)
	}
}

func TestDecideFundamentalistOrder_ErroSemKnowledgeLevel(t *testing.T) {
	riskProfile, err := NewRiskProfile(0.5, 0.5, 0)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	// Construído direto (não via NewPersonality) pra simular um estado
	// inválido defensivamente — NewPersonality nunca deixaria
	// KnowledgeLevel nil pro arquétipo Fundamentalista.
	personality := Personality{Archetype: ArchetypeFundamentalista, RiskProfile: riskProfile}

	financials, outstandingShares := financialsFixture()
	_, err = DecideFundamentalistOrder(personality, financials, outstandingShares, 0.03, 0, 10, 0.10, 0.10, equity.RiskClassConservador, 1_000, 10, 1)
	if !errors.Is(err, ErrMissingKnowledgeLevel) {
		t.Fatalf("err = %v, want %v", err, ErrMissingKnowledgeLevel)
	}
}

func TestDecideFundamentalistOrder_ErroPrecoDeMercadoInvalido(t *testing.T) {
	personality := mustFundamentalistPersonality(t, 0.5, 0.5)
	financials, outstandingShares := financialsFixture()
	for _, price := range []float64{0, -1} {
		_, err := DecideFundamentalistOrder(personality, financials, outstandingShares, 0.03, 0, price, 0.10, 0.10, equity.RiskClassConservador, 1_000, 10, 1)
		if !errors.Is(err, ErrInvalidReferencePrice) {
			t.Fatalf("price %v: err = %v, want %v", price, err, ErrInvalidReferencePrice)
		}
	}
}

func TestFundamentalistFairPrice_ErroRiskClassDesconhecida(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	_, err := FundamentalistFairPrice(financials, outstandingShares, 0.03, 0, 0.10, 0.10, "inexistente")
	if !errors.Is(err, ErrUnknownRiskClass) {
		t.Fatalf("err = %v, want %v", err, ErrUnknownRiskClass)
	}
}

func TestFundamentalistFairPrice_ErroFinanceirosInvalidos(t *testing.T) {
	tests := []struct {
		name              string
		financials        fundamentals.Financials
		outstandingShares int64
	}{
		{name: "patrimônio líquido zero (ROE indefinido)", financials: fundamentals.Financials{NetIncome: 100, NetEquity: 0}, outstandingShares: 100},
		{name: "ações em circulação zero (VPA indefinido)", financials: fundamentals.Financials{NetIncome: 100, NetEquity: 1_000}, outstandingShares: 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := FundamentalistFairPrice(tt.financials, tt.outstandingShares, 0.03, 0, 0.10, 0.10, equity.RiskClassConservador)
			if !errors.Is(err, ErrInvalidFinancials) {
				t.Fatalf("err = %v, want %v", err, ErrInvalidFinancials)
			}
		})
	}
}

func TestFundamentalistFairPrice_ErroRetornoExigidoInvalido(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	// selicNeutral pequeno + choque bem negativo faz o retorno exigido
	// (selicNeutral + sensibilidade×desvio) cair a zero ou abaixo.
	_, err := FundamentalistFairPrice(financials, outstandingShares, 0.03, 0, -10, 0.01, equity.RiskClassSofisticado)
	if !errors.Is(err, ErrInvalidRequiredReturn) {
		t.Fatalf("err = %v, want %v", err, ErrInvalidRequiredReturn)
	}
}

// TestFundamentalistFairPrice_MacroEffectPctDeslocaOPrecoJusto cobre a
// tarefa E.2: macroEffectPct desloca o preço justo multiplicativamente,
// na direção do sinal (positivo aumenta, negativo reduz), sem tocar
// growthRate/Selic — mesma independência que macroPriceMultiplier tinha
// antes de ser removida (não mais um multiplicador sobre o GBM, agora um
// insumo direto da estimativa).
func TestFundamentalistFairPrice_MacroEffectPctDeslocaOPrecoJusto(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	const growthRate = 0.03
	const selicNeutral = 0.10

	base, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 0, selicNeutral, selicNeutral, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("base: err = %v, want nil", err)
	}
	positivo, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 15, selicNeutral, selicNeutral, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("positivo: err = %v, want nil", err)
	}
	negativo, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, -15, selicNeutral, selicNeutral, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("negativo: err = %v, want nil", err)
	}

	if positivo <= base {
		t.Errorf("positivo (%.6f) deveria ser maior que base (%.6f) com macroEffectPct positivo", positivo, base)
	}
	if negativo >= base {
		t.Errorf("negativo (%.6f) deveria ser menor que base (%.6f) com macroEffectPct negativo", negativo, base)
	}
	if want := base * 1.15; math.Abs(positivo-want) > 1e-9 {
		t.Errorf("positivo = %.6f, want %.6f (base × 1.15)", positivo, want)
	}
}

// TestDecideFundamentalistOrder_MacroEffectPctProporcionalAoConhecimento
// cobre o critério central da E.2: o deslocamento do preço justo por
// evento macro é ponderado por personality.KnowledgeLevel — um bot de
// conhecimento alto (perto de 1.0) desloca o preço quase o valor bruto de
// macroEffectPct, um de conhecimento baixo (perto de 0.0) quase não se
// move. knowledgeLevel = 1.0 elimina o ruído de leitura (desvio-padrão
// zero), tornando a comparação determinística.
func TestDecideFundamentalistOrder_MacroEffectPctProporcionalAoConhecimento(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	const growthRate = 0.03
	const selicNeutral = 0.10
	const macroEffectPct = 20.0

	base, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, 0, selicNeutral, selicNeutral, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("base: err = %v, want nil", err)
	}
	// Mercado bem abaixo do preço-base "sem evento" — mesma técnica de
	// TestDecideFundamentalistOrder_ConhecimentoAltoConvergeMaisDoQueBaixo:
	// garante lado de compra estável em toda amostra (nunca
	// ErrNoMispricingDetected), mesmo com o ruído de conhecimento baixo
	// somado ao deslocamento pequeno percebido nesse caso.
	currentMarketPrice := base * 0.3

	// impliedEffectPct estima, pela média de várias seeds (cancela o ruído
	// de leitura de NormFloat64, que tem média 0 — mesma técnica de
	// averageDeviation em ConhecimentoAltoConvergeMaisDoQueBaixo), o
	// quanto do macroEffectPct bruto este knowledgeLevel efetivamente
	// incorporou no preço da ordem.
	impliedEffectPct := func(knowledgeLevel float64) float64 {
		personality := mustFundamentalistPersonality(t, knowledgeLevel, 0.5)
		var sum float64
		const samples = 400
		for seed := int64(0); seed < samples; seed++ {
			got, err := DecideFundamentalistOrder(personality, financials, outstandingShares, growthRate, macroEffectPct, currentMarketPrice, selicNeutral, selicNeutral, equity.RiskClassConservador, 1_000_000, 0, seed)
			if err != nil {
				t.Fatalf("knowledgeLevel %.2f, seed %d: err = %v, want nil", knowledgeLevel, seed, err)
			}
			sum += got.Price
		}
		avg := sum / samples
		return (avg/base - 1) * 100
	}

	effectHigh := impliedEffectPct(0.95)
	effectLow := impliedEffectPct(0.05)

	wantHigh := macroEffectPct * 0.95
	wantLow := macroEffectPct * 0.05

	// Tolerância generosa (3 p.p.) — o erro-padrão da média cai com
	// sqrt(samples), mas o ruído de conhecimento baixo tem desvio-padrão
	// bem maior (perto de FundamentalistMaxNoiseStdDevPct), então a margem
	// evita flakiness sem deixar de provar a proporcionalidade.
	if diff := effectHigh - wantHigh; diff > 3 || diff < -3 {
		t.Errorf("efeito percebido médio com conhecimento alto = %.2f%%, want ~%.2f%%", effectHigh, wantHigh)
	}
	if diff := effectLow - wantLow; diff > 3 || diff < -3 {
		t.Errorf("efeito percebido médio com conhecimento baixo = %.2f%%, want ~%.2f%%", effectLow, wantLow)
	}
	if effectHigh <= effectLow {
		t.Fatalf("efeito percebido com conhecimento alto (%.2f%%) deveria ser bem maior que com conhecimento baixo (%.2f%%)", effectHigh, effectLow)
	}
}

// TestFundamentalistFairPrice_MacroEffectPctZeroMantemFormulaOriginal é o
// teste de regressão: macroEffectPct = 0 (nenhum evento afeta a empresa)
// devolve exatamente o mesmo valor que a fórmula original (pré-E.2) já
// produzia — VPA × (ROE/requiredReturn) × (1+growthRate), sem nenhum fator
// a mais.
func TestFundamentalistFairPrice_MacroEffectPctZeroMantemFormulaOriginal(t *testing.T) {
	financials, outstandingShares := financialsFixture()
	got, err := FundamentalistFairPrice(financials, outstandingShares, 0.03, 0, 0.10, 0.10, equity.RiskClassConservador)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	// VPA = 1_000_000/100_000 = 10; ROE = 100_000/1_000_000 = 0.1;
	// requiredReturn = selicNeutral (sem desvio) = 0.10; fairPrice =
	// 10 × (0.1/0.10) × 1.03 = 10.3.
	const want = 10.3
	if math.Abs(got-want) > 1e-9 {
		t.Errorf("FairPrice = %.6f, want %.6f — macroEffectPct=0 deveria manter exatamente a fórmula original (regressão)", got, want)
	}
}
