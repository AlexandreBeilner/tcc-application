// Package bot — arquétipo Fundamentalista (tarefa C.5), o mais complexo:
// estima um "preço justo" a partir de company_fundamentals e da Selic
// simulada (proposta 2.3.1/2.3.2, spec 3.2.2) e negocia na direção de
// convergir o preço de mercado a essa estimativa. Único arquétipo que lê
// fundamento/Selic diretamente — Chartista (C.4) só reage ao preço que já
// mudou por causa da negociação do Fundamentalista, nunca ao dado bruto.
//
// Modelo de "preço justo" (decisão de design desta sessão, sem fórmula
// fechada na proposta — mesmo tratamento "ilustrativo, sujeito a
// calibração futura" já dado a SensitivityByRiskClass/DefaultNetMarginPct
// em fundamentals.go): Justified Price-to-Book — fairPrice = VPA ×
// (ROE / retorno_exigido) × (1 + crescimento). "P/L" da descrição da
// tarefa não entra como uma razão preço/lucro literal (isso exigiria o
// preço como insumo — circular, não dá pra estimar preço a partir de uma
// razão que já contém preço); entra indiretamente via ROE/VPA, o par
// canônico de valuation por patrimônio (P/VP justificado) equivalente ao
// papel que P/L cumpriria numa razão preço/lucro. `retorno_exigido` é
// selicNeutral ajustada pelo desvio da Selic simulada, ponderado por
// SensitivityByRiskClass (fundamentals.go, já existente — reaproveitado
// aqui, não duplicado) — é isso que faz Selic alta reduzir mais o preço
// justo de empresas Sofisticadas que Conservadoras (spec 3.2.2).
package bot

import (
	"errors"
	"math/rand"

	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/orderbook"
)

// FundamentalistMinFairPrice é o piso do preço justo estimado — uma
// empresa com ROE muito negativo pode produzir um valor não-positivo pela
// fórmula (VPA × ROE/retorno negativo × crescimento), o que não faz
// sentido como preço-limite de uma ordem (orderexecution.ErrInvalidPrice
// exige preço > 0). O piso sinaliza "quase sem valor", não "sem preço" —
// arbitrário e pequeno de propósito, não uma calibração fina.
const FundamentalistMinFairPrice = 0.01

// FundamentalistMaxNoiseStdDevPct é o desvio-padrão (fração do preço
// justo "verdadeiro") do ruído aplicado à leitura de um bot de
// conhecimento zero — decai linearmente até 0 num bot de conhecimento 1
// (leitura perfeita, proposta 2.3.2: "conhecimento alto = leitura
// completa com pouco ruído"). Valor ilustrativo desta sessão, mesma nota
// de calibração futura de NoisePriceBandPct/ChartistTrendThresholdPct.
const FundamentalistMaxNoiseStdDevPct = 0.10

// FundamentalistMispricingThresholdPct é o desvio mínimo (fração do preço
// de mercado) entre a estimativa de preço justo e o preço corrente pra o
// Fundamentalista considerar que há sub/sobrevalorização — abaixo disso,
// ErrNoMispricingDetected (mesmo espírito de ChartistTrendThresholdPct,
// mas escopo semântico diferente: aqui é "preço já convergiu", lá é
// "mercado lateral").
const FundamentalistMispricingThresholdPct = 0.01

var (
	// ErrUnknownRiskClass é devolvido quando riskClass não é um dos
	// valores conhecidos (mesmo conjunto de validRiskClasses já usado por
	// NewSpecializationScope, personality.go) — aqui valida o risk_class
	// da empresa avaliada, não o escopo do bot.
	ErrUnknownRiskClass = errors.New("risk_class desconhecida")
	// ErrInvalidFinancials é devolvido quando os fundamentos não permitem
	// calcular ROE (patrimônio líquido zero) ou VPA (ações em circulação
	// inválidas) — fundamentals.ROE/VPA já devolvem ok=false nesses
	// casos, este erro só nomeia a falha pro chamador de
	// FundamentalistFairPrice.
	ErrInvalidFinancials = errors.New("fundamentos inválidos para estimar preço justo (patrimônio líquido ou ações em circulação inválidos)")
	// ErrInvalidRequiredReturn é devolvido quando o retorno exigido
	// (Selic ajustada pela sensibilidade do risk_class) não é positivo —
	// a fórmula de Justified P/B não tem leitura útil com denominador
	// zero ou negativo.
	ErrInvalidRequiredReturn = errors.New("retorno exigido (Selic ajustada) precisa ser positivo pra estimar preço justo")
	// ErrNoMispricingDetected é devolvido quando o preço de mercado já
	// está dentro de FundamentalistMispricingThresholdPct da estimativa
	// de preço justo — o Fundamentalista não tem posição a tomar, não é
	// um erro de programação.
	ErrNoMispricingDetected = errors.New("preço de mercado dentro do limiar da estimativa de preço justo — sem sub/sobrevalorização clara")
)

// FundamentalistFairPrice estima o preço justo "verdadeiro" (sem o ruído
// de conhecimento do bot, aplicado só em DecideFundamentalistOrder) de uma
// empresa a partir de financials/outstandingShares (ROE, VPA), growthRate
// (crescimento do ciclo corrente — o mesmo valor que
// fundamentals.ExpectedGrowth/NextGrowth já calculou pra essa empresa, não
// recalculado aqui) e da Selic simulada ajustada pela sensibilidade de
// riskClass (fundamentals.SensitivityByRiskClass). Clampada em
// FundamentalistMinFairPrice — nunca devolve um preço não-positivo.
func FundamentalistFairPrice(financials fundamentals.Financials, outstandingShares int64, growthRate, selicAnnualRate, selicNeutral float64, riskClass equity.RiskClass) (float64, error) {
	if !validRiskClasses[riskClass] {
		return 0, ErrUnknownRiskClass
	}

	roe, roeOk := fundamentals.ROE(financials.NetIncome, financials.NetEquity)
	vpa, vpaOk := fundamentals.VPA(financials.NetEquity, outstandingShares)
	if !roeOk || !vpaOk {
		return 0, ErrInvalidFinancials
	}

	sensitivity := fundamentals.SensitivityByRiskClass[riskClass]
	requiredReturn := selicNeutral + sensitivity*(selicAnnualRate-selicNeutral)
	if requiredReturn <= 0 {
		return 0, ErrInvalidRequiredReturn
	}

	fairPrice := vpa * (roe / requiredReturn) * (1 + growthRate)
	if fairPrice < FundamentalistMinFairPrice {
		fairPrice = FundamentalistMinFairPrice
	}
	return fairPrice, nil
}

// DecideFundamentalistOrder deriva a decisão do arquétipo Fundamentalista:
// estima o preço justo (FundamentalistFairPrice), aplica o ruído de
// conhecimento do bot (personality.KnowledgeLevel — obrigatoriamente
// não-nil, garantido por NewPersonality pra este arquétipo) e negocia na
// direção de convergir currentMarketPrice a essa estimativa — compra
// quando a estimativa está acima do mercado além de
// FundamentalistMispricingThresholdPct, vende quando está abaixo, devolve
// ErrNoMispricingDetected quando a diferença é desprezível. A ordem
// gerada é sempre limitada à própria estimativa de preço justo (já com
// ruído) — o bot está disposto a negociar até o preço em que acredita,
// não além. Quantidade reaproveita quantityFraction (mesma função de
// C.3/C.4) sobre RiskProfile.MaxPositionSizePct.
func DecideFundamentalistOrder(
	personality Personality,
	financials fundamentals.Financials,
	outstandingShares int64,
	growthRate float64,
	currentMarketPrice float64,
	selicAnnualRate float64,
	selicNeutral float64,
	riskClass equity.RiskClass,
	availableCash float64,
	currentPosition int,
	seed int64,
) (Decision, error) {
	if personality.Archetype != ArchetypeFundamentalista {
		return Decision{}, ErrWrongArchetype
	}
	if personality.KnowledgeLevel == nil {
		return Decision{}, ErrMissingKnowledgeLevel
	}
	if currentMarketPrice <= 0 {
		return Decision{}, ErrInvalidReferencePrice
	}

	fairPrice, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, selicAnnualRate, selicNeutral, riskClass)
	if err != nil {
		return Decision{}, err
	}

	rng := rand.New(rand.NewSource(seed))
	noiseStdDev := FundamentalistMaxNoiseStdDevPct * (1 - *personality.KnowledgeLevel)
	estimatedFairPrice := fairPrice * (1 + rng.NormFloat64()*noiseStdDev)
	if estimatedFairPrice < FundamentalistMinFairPrice {
		estimatedFairPrice = FundamentalistMinFairPrice
	}

	deviation := (estimatedFairPrice - currentMarketPrice) / currentMarketPrice

	var side orderbook.Side
	switch {
	case deviation > FundamentalistMispricingThresholdPct:
		side = orderbook.SideBuy
	case deviation < -FundamentalistMispricingThresholdPct:
		side = orderbook.SideSell
	default:
		return Decision{}, ErrNoMispricingDetected
	}

	pct := personality.RiskProfile.MaxPositionSizePct
	var quantity int
	if side == orderbook.SideBuy {
		maxQuantity := int(availableCash / estimatedFairPrice)
		if maxQuantity < 1 {
			return Decision{}, ErrNoViableOrder
		}
		quantity = quantityFraction(maxQuantity, pct)
	} else {
		if currentPosition < 1 {
			return Decision{}, ErrNoViableOrder
		}
		quantity = quantityFraction(currentPosition, pct)
	}

	return Decision{Side: side, Type: orderbook.TypeLimit, Price: estimatedFairPrice, Quantity: quantity}, nil
}
