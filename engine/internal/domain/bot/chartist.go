// Package bot — arquétipo Chartista/Momentum (tarefa C.4): só olha a série
// de preço recente — compra se a tendência for de alta, vende se for de
// baixa, sem nenhuma opinião sobre fundamento, evento macro ou balanço (só
// o Fundamentalista, C.5, lê isso diretamente — proposta 2.3.2). Mesmo
// espírito determinístico de DecideMarketMakerOrders (C.3): dado o mesmo
// histórico de preço e o mesmo estado de caixa/posição, sempre produz a
// mesma decisão — a proposta não pede nenhum sorteio pro Chartista, só
// reação mecânica ao sinal da tendência.
package bot

import (
	"errors"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

// ChartistTrendThresholdPct é a variação mínima (fração do primeiro preço
// da janela) pra considerar a tendência "de alta" ou "de baixa" — abaixo
// disso, em módulo, o Chartista não tem opinião (ErrNoClearTrend). Mesma
// nota de "valor ilustrativo desta sessão, sujeito a calibração futura" já
// registrada pra NoisePriceBandPct (C.2) — a proposta não fixa esse
// número.
const ChartistTrendThresholdPct = 0.01

var (
	// ErrInsufficientPriceHistory é devolvido quando priceHistory não tem
	// pontos suficientes pra calcular uma tendência (precisa de pelo
	// menos 2: o preço no início e no fim da janela).
	ErrInsufficientPriceHistory = errors.New("histórico de preço insuficiente pra avaliar tendência (mínimo 2 pontos)")
	// ErrNoClearTrend é devolvido quando a variação de preço na janela
	// fica dentro de ChartistTrendThresholdPct — nem alta nem baixa clara
	// o suficiente, então o Chartista não gera ordem nessa rodada (não é
	// erro de programação, é o arquétipo "sem opinião" quando o mercado
	// está lateral).
	ErrNoClearTrend = errors.New("variação de preço dentro do limiar — sem tendência clara de alta ou baixa")
)

// DecideChartistOrder deriva a decisão do arquétipo Chartista a partir de
// priceHistory — a série de preço recente, em ordem cronológica (mais
// antigo primeiro, mais recente por último; o tamanho da janela, "últimas
// N rodadas/dias", é escolhido por quem chama, não por esta função).
// Tendência = variação percentual entre o primeiro e o último preço da
// janela: acima de +ChartistTrendThresholdPct compra, abaixo de
// -ChartistTrendThresholdPct vende, dentro da faixa devolve
// ErrNoClearTrend. A ordem gerada é sempre limitada ao último preço da
// janela (o preço mais recente observado) — quantidade restrita ao que
// availableCash/currentPosition permitem via quantityForSide (fração de
// RiskProfile.MaxPositionSizePct, nunca menos que 1 quando o lado é viável;
// mesma função reaproveitada por DecideFundamentalistOrder, C.5, pra evitar
// duplicar a lógica de sizing por lado). Devolve ErrNoViableOrder quando a
// tendência aponta um lado (compra ou venda) mas o bot não tem recurso
// nenhum pra esse lado — diferente de ErrNoClearTrend, que é sobre a
// ausência de sinal, não de recurso.
func DecideChartistOrder(personality Personality, priceHistory []float64, availableCash float64, currentPosition int) (Decision, error) {
	if personality.Archetype != ArchetypeChartista {
		return Decision{}, ErrWrongArchetype
	}
	if len(priceHistory) < 2 {
		return Decision{}, ErrInsufficientPriceHistory
	}

	first := priceHistory[0]
	last := priceHistory[len(priceHistory)-1]
	if first <= 0 || last <= 0 {
		return Decision{}, ErrInvalidReferencePrice
	}

	momentum := (last - first) / first

	var side orderbook.Side
	switch {
	case momentum > ChartistTrendThresholdPct:
		side = orderbook.SideBuy
	case momentum < -ChartistTrendThresholdPct:
		side = orderbook.SideSell
	default:
		return Decision{}, ErrNoClearTrend
	}

	quantity, err := quantityForSide(side, last, availableCash, currentPosition, personality.RiskProfile.MaxPositionSizePct)
	if err != nil {
		return Decision{}, err
	}

	return Decision{Side: side, Type: orderbook.TypeLimit, Price: last, Quantity: quantity}, nil
}
