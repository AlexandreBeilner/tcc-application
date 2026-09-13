// Package bot — arquétipo Market Maker (tarefa C.3): mantém oferta
// simétrica dos dois lados do book ao redor do preço corrente (proposta
// 2.3.2), sem viés direcional — prioridade em nunca deixar o book vazio,
// coerente com ter recebido a maior fatia do float/caixa inicial (B.1/B.2).
// Diferente do arquétipo Ruído (C.2), que sorteia lado/preço/quantidade,
// este arquétipo é 100% determinístico — sem seed, sem aleatoriedade: dado
// o mesmo preço de referência e o mesmo estado de caixa/posição, sempre
// devolve a mesma cotação dos dois lados. "Reabastecer a cada rodada" não é
// um estado guardado por esta função — é o efeito de chamá-la de novo a
// cada rodada (Fase D) com o caixa/posição atualizados depois dos fills da
// rodada anterior.
package bot

import (
	"errors"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

var (
	// ErrWrongArchetype é devolvido quando a função de decisão de um
	// arquétipo específico recebe uma Personality de outro arquétipo —
	// only DecideMarketMakerOrders precisa disso (é a primeira função que
	// consome Personality inteira, não só os parâmetros soltos que
	// DecideNoiseOrder usa).
	ErrWrongArchetype = errors.New("personalidade não é do arquétipo esperado por esta função de decisão")
	// ErrInvalidSpreadForQuote é devolvido quando RiskProfile.SpreadWidthPct
	// é grande demais pra gerar um preço de compra positivo (>= 2, ou seja
	// >= 200% do preço de referência) — NewRiskProfile (tarefa C.1) só
	// valida SpreadWidthPct >= 0 de forma genérica (outros arquétipos não
	// têm essa restrição), então esse teto extra é específico de como o
	// Market Maker deriva preço a partir do spread.
	ErrInvalidSpreadForQuote = errors.New("largura de spread precisa ser menor que 2 (preço de compra ficaria zero ou negativo)")
)

// DecideMarketMakerOrders deriva a cotação simétrica de dois lados do
// Market Maker ao redor de referencePrice: preço de compra a
// referencePrice*(1 - spread/2), preço de venda a
// referencePrice*(1 + spread/2), onde spread é
// personality.RiskProfile.SpreadWidthPct (a largura total, não a meia
// largura). A quantidade de cada lado é uma fração
// (personality.RiskProfile.MaxPositionSizePct) do que o caixa/posição
// permite — nunca menos que 1 unidade quando esse lado é viável (garante o
// "nunca deixar o book vazio" da proposta 2.3.2, mesmo quando a fração
// arredondaria pra zero), e nunca mais do que availableCash/currentPosition
// cobrem, por construção.
//
// Devolve os dois lados (nessa ordem: compra, venda) quando ambos são
// viáveis; só o lado viável quando falta caixa suficiente pra 1 unidade de
// compra ou posição nenhuma pra vender; ErrNoViableOrder quando nenhum dos
// dois é viável (mesmo caso de saída do arquétipo Ruído, mesmo pacote).
func DecideMarketMakerOrders(personality Personality, referencePrice, availableCash float64, currentPosition int) ([]Decision, error) {
	if personality.Archetype != ArchetypeMarketMaker {
		return nil, ErrWrongArchetype
	}
	if referencePrice <= 0 {
		return nil, ErrInvalidReferencePrice
	}

	spread := personality.RiskProfile.SpreadWidthPct
	if spread >= 2 {
		return nil, ErrInvalidSpreadForQuote
	}
	half := spread / 2
	bidPrice := referencePrice * (1 - half)
	askPrice := referencePrice * (1 + half)

	pct := personality.RiskProfile.MaxPositionSizePct

	var decisions []Decision
	if maxBid := int(availableCash / bidPrice); maxBid >= 1 {
		decisions = append(decisions, Decision{
			Side:     orderbook.SideBuy,
			Type:     orderbook.TypeLimit,
			Price:    bidPrice,
			Quantity: quantityFraction(maxBid, pct),
		})
	}
	if currentPosition >= 1 {
		decisions = append(decisions, Decision{
			Side:     orderbook.SideSell,
			Type:     orderbook.TypeLimit,
			Price:    askPrice,
			Quantity: quantityFraction(currentPosition, pct),
		})
	}

	if len(decisions) == 0 {
		return nil, ErrNoViableOrder
	}
	return decisions, nil
}

// quantityFraction aplica pct (0,1] sobre max (sempre >= 1 no ponto em que
// é chamada) sem nunca devolver menos de 1 nem mais que max — o piso de 1
// garante que um lado viável nunca fica de fora da cotação só porque a
// fração arredondou pra zero (max pequeno, pct pequeno).
func quantityFraction(max int, pct float64) int {
	if qty := int(float64(max) * pct); qty >= 1 {
		return qty
	}
	return 1
}
