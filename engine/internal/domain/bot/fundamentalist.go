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
	"tcc-investimentos/engine/internal/domain/fii"
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
// recalculado aqui), da Selic simulada ajustada pela sensibilidade de
// riskClass (fundamentals.SensitivityByRiskClass) e de macroEffectPct
// (tarefa E.2, escala percentual — 10 significa 10%, mesma convenção de
// macroevent.EffectRange): o sinal/magnitude por alvo de um evento macro
// ativo (macroevent.Target.ResolvedDirection/PriceEffectPct, tarefa E.1)
// que atinge esta empresa, já resolvido por quem chama (tick.
// companyRoundContexts) — 0 quando nenhum evento afeta a empresa agora.
// Desloca a estimativa multiplicativamente, mesmo efeito qualitativo que
// growthRate já tem: um evento negativo severo (-25%) reduz o preço justo
// na mesma proporção que reduziria se fosse um crescimento esperado pior.
// Clampada em FundamentalistMinFairPrice — nunca devolve um preço
// não-positivo.
//
// pnPremiumPct (tarefa J.3) é a vantagem de dividendo esperado por ação da
// classe PN sobre a ON da mesma empresa (companies.pn_dividend_premium_pct,
// J.2, dividend.EquityValuePerShare) — 0 pra uma ação ON ou pra empresa
// só-ON/só-PN (reduz à fórmula original, mesma nota de compatibilidade já
// dada a macroEffectPct=0). Desloca o preço justo multiplicativamente, mesmo
// tratamento de growthRate/macroEffectPct: o Fundamentalista projeta o mesmo
// fundamento (ROE, VPA) pras duas classes da mesma empresa — o único motivo
// do preço justo divergir entre elas é o provento por ação diferente que a
// prioridade legal da PN garante, e essa fórmula soma esse mesmo percentual
// de vantagem sobre o resultado. Diferente de macroEffectPct, não passa pelo
// filtro de personality.KnowledgeLevel em DecideFundamentalistOrder — é um
// fato estrutural conhecido da empresa (mesma categoria de growthRate/
// Selic), não uma leitura ruidosa de um evento ao vivo.
//
// dividendEffectPct (tarefa S.13, achado 018-023) é o efeito de preço do
// provento de ação recém-pago (dividend.EquityPriceEffectPct — conservação
// de valor, nunca um degrau direto de preço), 0 fora da banda curta de
// dias em que o efeito fica ativo (resolvido por tick.
// companyRoundContexts, mesmo caminho de macroEffectPct). Diferente de
// macroEffectPct, não passa pelo filtro de personality.KnowledgeLevel em
// DecideFundamentalistOrder — mesmo tratamento de "fato estrutural
// conhecido" já dado a pnPremiumPct acima: o provento pago por uma empresa
// é informação pública (data-ex e valor por ação são divulgados), não uma
// leitura ruidosa de magnitude incerta como um evento macro em andamento.
func FundamentalistFairPrice(financials fundamentals.Financials, outstandingShares int64, growthRate, macroEffectPct, pnPremiumPct, dividendEffectPct, selicAnnualRate, selicNeutral float64, riskClass equity.RiskClass) (float64, error) {
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

	fairPrice := vpa * (roe / requiredReturn) * (1 + growthRate) * (1 + macroEffectPct/100) * (1 + pnPremiumPct/100) * (1 + dividendEffectPct/100)
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
// não além. Quantidade reaproveita quantityForSide (marketmaker.go, mesma
// função de sizing por lado usada por DecideChartistOrder, C.4) sobre
// RiskProfile.MaxPositionSizePct, capada pelo teto de tamanho de ordem
// (orderSizeCeiling — capToFloat, achado 005, pontos-em-aberto-decisao-
// produto.md; nil quando nenhum teto se aplica). Diferente do
// outstandingShares acima (obrigatório, usado na fórmula de VPA),
// orderSizeCeiling é opcional e só limita o tamanho da ordem.
//
// macroEffectPct (tarefa E.2) é o sinal/magnitude bruto (escala
// percentual) de qualquer evento macro ativo que atinge esta empresa —
// "bruto" porque ainda não passou pela lente do bot: é ponderado por
// personality.KnowledgeLevel antes de chegar em FundamentalistFairPrice
// ("proporcional ao nível de conhecimento do bot", proposta 2.5/seção 3) —
// um Fundamentalista de conhecimento 1.0 incorpora o efeito inteiro, um de
// conhecimento 0.0 o ignora por completo, igual ao mesmo raciocínio já
// usado no ruído de leitura logo abaixo (FundamentalistMaxNoiseStdDevPct).
// Chartista/Ruído nunca recebem este parâmetro — só reagem ao preço que já
// mudou pela negociação do Fundamentalista, nunca ao evento em si.
//
// pnPremiumPct (tarefa J.3) é repassado direto a FundamentalistFairPrice,
// sem passar pelo filtro de personality.KnowledgeLevel — ver nota no doc
// daquela função sobre por que este insumo não recebe o mesmo tratamento de
// "leitura ruidosa" que macroEffectPct recebe aqui.
//
// dividendEffectPct (tarefa S.13) é repassado direto a
// FundamentalistFairPrice, mesmo tratamento de pnPremiumPct acima — ver
// nota no doc daquela função.
func DecideFundamentalistOrder(
	personality Personality,
	financials fundamentals.Financials,
	outstandingShares int64,
	growthRate float64,
	macroEffectPct float64,
	pnPremiumPct float64,
	dividendEffectPct float64,
	currentMarketPrice float64,
	selicAnnualRate float64,
	selicNeutral float64,
	riskClass equity.RiskClass,
	availableCash float64,
	currentPosition int,
	seed int64,
	orderSizeCeiling *int64,
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

	perceivedMacroEffectPct := macroEffectPct * *personality.KnowledgeLevel
	fairPrice, err := FundamentalistFairPrice(financials, outstandingShares, growthRate, perceivedMacroEffectPct, pnPremiumPct, dividendEffectPct, selicAnnualRate, selicNeutral, riskClass)
	if err != nil {
		return Decision{}, err
	}

	return fundamentalistOrderForFairPrice(personality, fairPrice, currentMarketPrice, availableCash, currentPosition, seed, orderSizeCeiling)
}

// DecideFundamentalistFIIOrder (tarefa U.3, achado 024) é o equivalente de
// DecideFundamentalistOrder pra FII, que não tem empresa emissora nem
// fundamentos de empresa: o preço justo vem de fii.FairPrice (VP por cota ×
// P/VP-alvo já resolvido pra Selic do dia, com o efeito do provento), e o
// resto da decisão (ruído de conhecimento, limiar de mispricing, limite da
// ordem no preço justo, dimensionamento) é o mesmo trecho comum das ações
// (fundamentalistOrderForFairPrice). Sem macroEffectPct: evento macro por
// FII está fora de escopo da Fase U. dividendEffectPct não passa pelo filtro
// de KnowledgeLevel, mesmo tratamento de fato público (data-ex e valor do
// provento) dado a ele em FundamentalistFairPrice.
func DecideFundamentalistFIIOrder(
	personality Personality,
	input FIIFairPriceInput,
	outstandingShares int64,
	currentMarketPrice float64,
	availableCash float64,
	currentPosition int,
	seed int64,
	orderSizeCeiling *int64,
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

	fairPrice, ok := fii.FairPrice(input.BaseValue, outstandingShares, input.TargetPriceToBook, 0, input.DividendEffectPct)
	if !ok {
		return Decision{}, ErrInvalidFinancials
	}
	if fairPrice < FundamentalistMinFairPrice {
		fairPrice = FundamentalistMinFairPrice
	}

	return fundamentalistOrderForFairPrice(personality, fairPrice, currentMarketPrice, availableCash, currentPosition, seed, orderSizeCeiling)
}

// fundamentalistOrderForFairPrice é o trecho comum de ação e FII: aplica o
// ruído de conhecimento ao preço justo "verdadeiro", compara com o preço de
// mercado e devolve a ordem limitada à própria estimativa (ou
// ErrNoMispricingDetected dentro do limiar).
func fundamentalistOrderForFairPrice(personality Personality, fairPrice, currentMarketPrice, availableCash float64, currentPosition int, seed int64, orderSizeCeiling *int64) (Decision, error) {
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

	quantity, err := quantityForSide(side, estimatedFairPrice, availableCash, currentPosition, personality.RiskProfile.MaxPositionSizePct, orderSizeCeiling)
	if err != nil {
		return Decision{}, err
	}

	return Decision{Side: side, Type: orderbook.TypeLimit, Price: estimatedFairPrice, Quantity: quantity}, nil
}
