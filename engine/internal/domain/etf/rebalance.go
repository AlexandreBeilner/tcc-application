package etf

import (
	"errors"
	"math"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

var (
	// ErrNoRebalanceConstituents é devolvido por RebalanceOrders quando a
	// reconciliação não tem nenhuma linha — nada pra rebalancear.
	ErrNoRebalanceConstituents = errors.New("reconciliação de rebalanceamento não pode estar vazia")
	// ErrNegativeRebalanceConstituent é devolvido quando alguma linha da
	// reconciliação tem quantidade atual ou peso-alvo negativo — nenhum dos
	// dois tem significado físico (mesmo raciocínio de nav.go).
	ErrNegativeRebalanceConstituent = errors.New("quantidade atual e peso-alvo de um constituinte não podem ser negativos")
	// ErrInvalidConstituentPrice é devolvido quando alguma linha da
	// reconciliação tem preço zero ou negativo — sem preço válido não dá
	// pra converter peso-alvo em quantidade-alvo (divisão por zero/negativo
	// não tem resultado físico).
	ErrInvalidConstituentPrice = errors.New("preço de um constituinte precisa ser maior que zero para calcular o rebalanceamento")
)

// RebalanceConstituent é uma linha da reconciliação entre a cesta atual do
// fundo e a composição-alvo pra um único ativo (proposta 5.4). Zero value
// de CurrentQuantity significa "o fundo ainda não detém este ativo" (ativo
// novo entrando na cesta, ex: revisão periódica do índice incluindo um
// constituinte novo); zero value de TargetWeightPct significa "sai da
// cesta" (ativo removido da composição-alvo, ex: evento corporativo que o
// tira do índice) — os dois lados da mesma reconciliação, sem precisar de
// duas listas separadas pra AssetIDs que só existem de um lado. Price é
// sempre o preço de mercado corrente do ativo, já resolvido por quem monta
// a cesta — mesma regra de "esta função não decide como precificar" já
// documentada em Constituent (nav.go).
type RebalanceConstituent struct {
	AssetID         string
	CurrentQuantity int64
	Price           float64
	TargetWeightPct float64
}

// RebalanceOrder é a ordem que o bot mecânico rebalanceador (proposta 5.4)
// precisa emitir pra convergir um constituinte da cesta atual pra
// composição-alvo — mesma conta/pipeline de execução dos bots
// comportamentais (is_bot = true, orderexecution real), só que decidida por
// esta função determinística, não por personalidade. Side/Type reaproveitam
// orderbook (mesmo padrão de bot.Decision) — não embrulha bot.Decision
// porque cada linha da reconciliação já carrega o próprio AssetID (o
// rebalanceador emite ordens pra vários ativos da cesta na mesma chamada,
// diferente de um arquétipo comportamental, que decide um único ativo por
// rodada, C.2-C.5). Type é sempre orderbook.TypeMarket — o gestor mecânico
// não tem preço-limite (não "acha" um preço aceitável, só converge pro
// peso-alvo, proposta 5.4: "100% determinístico dado o índice-alvo"); Price
// aqui é só o preço usado pra calcular a quantidade-alvo (o motor de
// execução real ignora Price em ordem a mercado, mesma regra de
// orderbook.Order).
type RebalanceOrder struct {
	AssetID  string
	Side     orderbook.Side
	Type     orderbook.Type
	Price    float64
	Quantity int64
}

// RebalanceOrders calcula a diferença entre a cesta atual do fundo e a
// composição-alvo (proposta 5.4) e devolve exatamente as ordens necessárias
// pra convergir — uma por constituinte cuja quantidade-alvo diverge da
// quantidade atual, omitindo os que já batem (nenhuma ordem pra quem já
// está no peso certo). Cobre os dois gatilhos da proposta com a mesma
// função, sem distinção de caminho de código: revisão periódica
// (TargetWeightPct muda entre chamadas) e evento corporativo (o preço de um
// constituinte muda o suficiente pra desviar o peso real do peso-alvo,
// mesmo com TargetWeightPct idêntico à chamada anterior — o cash drag
// resultante do arredondamento pro inteiro de ações mais próximo é
// esperado, não um bug: proposta 5.4 cita isso como gancho pedagógico).
//
// netAssets (a base sobre a qual os pesos-alvo são aplicados) é sempre
// calculado a partir da cesta ATUAL (Σ CurrentQuantity×Price) mais caixa
// menos passivos — nunca de um valor hipotético pós-rebalanceamento, mesmo
// raciocínio de "o teto é uma propriedade do snapshot" já usado em
// position.ValidateFloatCeiling (tarefa A.3).
func RebalanceOrders(constituents []RebalanceConstituent, cash, liabilities float64) ([]RebalanceOrder, error) {
	if len(constituents) == 0 {
		return nil, ErrNoRebalanceConstituents
	}
	if cash < 0 || liabilities < 0 {
		return nil, ErrNegativeCashOrLiabilities
	}

	netAssets := cash - liabilities
	totalWeight := 0.0
	for _, c := range constituents {
		if c.CurrentQuantity < 0 || c.TargetWeightPct < 0 {
			return nil, ErrNegativeRebalanceConstituent
		}
		if c.Price <= 0 {
			return nil, ErrInvalidConstituentPrice
		}
		netAssets += float64(c.CurrentQuantity) * c.Price
		totalWeight += c.TargetWeightPct
	}
	if math.Abs(totalWeight-100) > WeightTolerance {
		return nil, ErrWeightsDoNotSumTo100
	}

	var orders []RebalanceOrder
	for _, c := range constituents {
		targetValue := c.TargetWeightPct / 100 * netAssets
		targetQuantity := int64(math.Round(targetValue / c.Price))

		diff := targetQuantity - c.CurrentQuantity
		if diff == 0 {
			continue
		}

		side := orderbook.SideBuy
		quantity := diff
		if diff < 0 {
			side = orderbook.SideSell
			quantity = -diff
		}

		orders = append(orders, RebalanceOrder{
			AssetID:  c.AssetID,
			Side:     side,
			Type:     orderbook.TypeMarket,
			Price:    c.Price,
			Quantity: quantity,
		})
	}

	return orders, nil
}
