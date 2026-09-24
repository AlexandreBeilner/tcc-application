package bot

import (
	"math"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

// QuoteTolerancePct é quanto o preço de uma cotação em repouso pode se afastar
// do preço ideal do lado (fração do preço ideal) antes de valer recotar
// (tarefa P.4, proposta-cobertura-market-maker.md seção 3.6). Valor
// ilustrativo, sem fonte real, sujeito à mesma calibração dos demais
// coeficientes do motor.
const QuoteTolerancePct = 0.005

// RestingQuote é uma ordem do Market Maker em repouso no book (pendente ou
// parcial), com a quantidade que ainda falta executar.
type RestingQuote struct {
	ID                string
	Side              orderbook.Side
	Price             float64
	RemainingQuantity int
}

// MarketMakerQuotePrices devolve os preços ideais de compra e de venda do
// Market Maker ao redor de referencePrice (os mesmos que
// DecideMarketMakerOrders usa).
func MarketMakerQuotePrices(personality Personality, referencePrice float64) (bid, ask float64, err error) {
	if personality.Archetype != ArchetypeMarketMaker {
		return 0, 0, ErrWrongArchetype
	}
	if referencePrice <= 0 {
		return 0, 0, ErrInvalidReferencePrice
	}
	spread := personality.RiskProfile.SpreadWidthPct
	if spread >= 2 {
		return 0, 0, ErrInvalidSpreadForQuote
	}
	half := spread / 2
	return referencePrice * (1 - half), referencePrice * (1 + half), nil
}

// EffectiveQuoteTolerance limita a tolerância a um quarto do spread: com uma
// tolerância maior, o lado mantido poderia cruzar o preço ideal do outro lado
// e o Market Maker negociaria contra a própria cotação.
func EffectiveQuoteTolerance(spreadWidthPct float64) float64 {
	return math.Min(QuoteTolerancePct, spreadWidthPct/4)
}

// MinQuoteQuantity é a quantidade restante abaixo da qual uma cotação em
// repouso deixa de valer: o menor tamanho que a própria regra de cotação do
// Market Maker produz quando o teto de ordem está no piso (ceilingFloor). O
// mínimo não pode ser maior que isso, senão uma cotação recém-criada já nasceria
// "vencida" e seria refeita a cada rodada. Sempre pelo menos 1.
func MinQuoteQuantity(personality Personality, ceilingFloor int64) int {
	return quantityFraction(int(ceilingFloor), personality.RiskProfile.MaxPositionSizePct)
}

// NeedsRequote diz, lado a lado, se a cotação em repouso precisa ser refeita.
// Um lado precisa de recotação quando não tem nenhuma ordem em repouso, quando
// alguma ordem dele está a mais de tolerancePct do preço ideal (idealBid para
// a compra, idealAsk para a venda) ou quando a quantidade restante somada do
// lado está abaixo de minRemaining. Função pura.
func NeedsRequote(resting []RestingQuote, idealBid, idealAsk, tolerancePct float64, minRemaining int) (requoteBuy, requoteSell bool) {
	return sideNeedsRequote(resting, orderbook.SideBuy, idealBid, tolerancePct, minRemaining),
		sideNeedsRequote(resting, orderbook.SideSell, idealAsk, tolerancePct, minRemaining)
}

func sideNeedsRequote(resting []RestingQuote, side orderbook.Side, idealPrice, tolerancePct float64, minRemaining int) bool {
	var remaining int
	var found bool
	for _, q := range resting {
		if q.Side != side {
			continue
		}
		found = true
		if math.Abs(q.Price-idealPrice) > idealPrice*tolerancePct {
			return true
		}
		remaining += q.RemainingQuantity
	}
	return !found || remaining < minRemaining
}
