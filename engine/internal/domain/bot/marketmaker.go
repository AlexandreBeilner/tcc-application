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
// cobrem, por construção — capado por capToFloat no lado de compra (achado
// 005, pontos-em-aberto-decisao-produto.md), pra nunca gerar uma ordem
// maior que o teto de tamanho de ordem do ativo.
//
// Devolve os dois lados (nessa ordem: compra, venda) quando ambos são
// viáveis; só o lado viável quando falta caixa suficiente pra 1 unidade de
// compra ou posição nenhuma pra vender; ErrNoViableOrder quando nenhum dos
// dois é viável (mesmo caso de saída do arquétipo Ruído, mesmo pacote).
// orderSizeCeiling é o teto de tamanho de ordem (bot.DecisionInput.
// OrderSizeCeiling — o menor entre o float finito do ativo e o volume médio
// negociado recente, achado 005 partes A/B) — nil quando nenhum teto se
// aplica (ex: sandbox).
func DecideMarketMakerOrders(personality Personality, referencePrice, availableCash float64, currentPosition int, orderSizeCeiling *int64, minQuantity int) ([]Decision, error) {
	if personality.Archetype != ArchetypeMarketMaker {
		return nil, ErrWrongArchetype
	}
	bidPrice, askPrice, err := MarketMakerQuotePrices(personality, referencePrice)
	if err != nil {
		return nil, err
	}

	pct := personality.RiskProfile.MaxPositionSizePct

	var decisions []Decision
	maxBid := capToFloat(int(availableCash/bidPrice), orderSizeCeiling)
	if qty := quoteQuantity(maxBid, pct, minQuantity); qty >= 1 {
		decisions = append(decisions, Decision{Side: orderbook.SideBuy, Type: orderbook.TypeLimit, Price: bidPrice, Quantity: qty})
	}
	if qty := quoteQuantity(currentPosition, pct, minQuantity); qty >= 1 {
		decisions = append(decisions, Decision{Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: askPrice, Quantity: qty})
	}

	if len(decisions) == 0 {
		return nil, ErrNoViableOrder
	}
	return decisions, nil
}

// quoteQuantity é o tamanho da cotação de um lado (tarefa P.6, proposta seção
// 3.8): a fração pct do que o caixa/posição (max) permite, nunca abaixo de
// minQuantity, o piso de uma cotação que conta como cobertura (proporcional ao
// float do ativo, tick.MinOrderPctOfFloat). Devolve 0 (lado sem cotação) quando
// o lado não consegue chegar ao piso, em vez de uma cotação simbólica que só
// pareceria cobrir o ativo. minQuantity 0 desliga o piso.
func quoteQuantity(max int, pct float64, minQuantity int) int {
	if max < 1 {
		return 0
	}
	qty := quantityFraction(max, pct)
	if qty < minQuantity {
		qty = minQuantity
	}
	if qty > max {
		return 0
	}
	return qty
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

// capToFloat garante que uma quantidade de compra nunca ultrapasse o teto
// de tamanho de ordem recebido (achado 005, pontos-em-aberto-decisao-
// produto.md, auditoria de ponta a ponta da Fase G, 2026-09-19): sem
// nenhum teto, o caixa acumulado de um bot ao longo de muitos ciclos
// simulados podia gerar uma ordem de compra maior que 100% das ações/cotas
// em circulação — uma ordem assim nunca é preenchível (orderexecution.
// validateFloat só protege a soma pós-negociação, nunca o tamanho da ordem
// recebida), então ela fica pendente no book indefinidamente e trava o
// preço de fechamento no mesmo valor por dias/semanas simulados seguidos,
// todo fill seguinte casando contra ela no mesmo preço. O nome do parâmetro
// é histórico (só existia o teto de float até a correção de 2026-09-19) —
// hoje quem chama pode passar o float sozinho ou o teto já composto com o
// volume médio negociado recente (bot.DecisionInput.OrderSizeCeiling,
// achado 005 parte B), capToFloat não distingue os dois: "capar contra um
// teto" é o mesmo mecanismo, seja qual for a origem do valor. nil (nenhum
// teto se aplica, ex: sandbox) devolve quantity sem alteração. Só o lado de
// compra precisa deste teto — o lado de venda já é limitado por
// currentPosition, que nunca ultrapassa o float por construção (invariante
// mantido por validateFloat).
func capToFloat(quantity int, floatCeiling *int64) int {
	if floatCeiling == nil {
		return quantity
	}
	if ceiling := int(*floatCeiling); quantity > ceiling {
		return ceiling
	}
	return quantity
}

// quantityForSide deriva a quantidade de um lado único a partir de price
// (compra: teto de availableCash/price, capado por capToFloat; venda: teto
// de currentPosition), aplicando quantityFraction sobre pct — sizing
// compartilhado entre Chartista (C.4) e Fundamentalista (C.5), os dois
// arquétipos que negociam um único lado a um único preço de referência
// (Market Maker, C.3, já deriva os dois lados de uma vez com sua própria
// lógica, não reaproveita esta função). Devolve ErrNoViableOrder quando o
// lado indicado não tem recurso nenhum (sem caixa pra 1 unidade de compra,
// sem posição pra vender). orderSizeCeiling é o teto de tamanho de ordem
// (bot.DecisionInput.OrderSizeCeiling, achado 005 partes A/B) — nil quando
// nenhum teto se aplica.
func quantityForSide(side orderbook.Side, price, availableCash float64, currentPosition int, pct float64, orderSizeCeiling *int64) (int, error) {
	if side == orderbook.SideBuy {
		maxQuantity := capToFloat(int(availableCash/price), orderSizeCeiling)
		if maxQuantity < 1 {
			return 0, ErrNoViableOrder
		}
		return quantityFraction(maxQuantity, pct), nil
	}
	if currentPosition < 1 {
		return 0, ErrNoViableOrder
	}
	return quantityFraction(currentPosition, pct), nil
}
