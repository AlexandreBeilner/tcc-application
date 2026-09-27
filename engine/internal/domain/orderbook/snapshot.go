package orderbook

import "sort"

// Level é uma oferta agregada de um lado do book num único preço — sem
// identidade de ordem nem de dono (tarefa S.5, GET /assets/{id}/book):
// nunca expõe ordem individual, só a soma da quantidade disponível
// naquele preço.
type Level struct {
	Price    float64
	Quantity int
}

// Snapshot é a leitura pública e resumida do book de um ativo — melhor
// bid, melhor ask, ponto médio e profundidade agregada nos N primeiros
// níveis de cada lado (tarefa S.5). BestBid/BestAsk/MidPrice ficam nil
// quando o lado correspondente está vazio (sem nenhuma oferta pendente);
// Bids/Asks ficam nil (não um slice vazio) na mesma condição, pro
// contrato JSON devolver `null` em vez de `[]` (critério de aceite:
// "lado vazio devolvido como nulo").
type Snapshot struct {
	BestBid  *float64
	BestAsk  *float64
	MidPrice *float64
	Bids     []Level
	Asks     []Level
}

// BuildSnapshot agrega bids/asks (uma linha por preço ou por ordem em
// repouso — tanto faz, ver aggregateLevels) em níveis por preço, ordena
// por prioridade (bid: maior preço primeiro; ask: menor primeiro) e
// recorta aos `depth` primeiros níveis de cada lado — pura, sem nenhuma
// leitura de infraestrutura (mesma regra do resto do pacote). depth <= 0
// devolve todos os níveis, sem recorte.
func BuildSnapshot(bids, asks []Level, depth int) Snapshot {
	snap := Snapshot{
		Bids: aggregateLevels(bids, depth, bidBetter),
		Asks: aggregateLevels(asks, depth, askBetter),
	}
	if len(snap.Bids) > 0 {
		snap.BestBid = &snap.Bids[0].Price
	}
	if len(snap.Asks) > 0 {
		snap.BestAsk = &snap.Asks[0].Price
	}
	if snap.BestBid != nil && snap.BestAsk != nil {
		mid := (*snap.BestBid + *snap.BestAsk) / 2
		snap.MidPrice = &mid
	}
	return snap
}

func bidBetter(a, b float64) bool { return a > b }
func askBetter(a, b float64) bool { return a < b }

// aggregateLevels soma a quantidade de linhas repetidas no mesmo preço
// (defensivo: funciona tanto com níveis já agregados por SQL quanto com
// uma linha por ordem em repouso), ordena por prioridade e recorta aos
// `depth` primeiros. nil (não slice vazio) se não sobrar nenhum nível —
// ver doc de Snapshot.
func aggregateLevels(levels []Level, depth int, better func(a, b float64) bool) []Level {
	if len(levels) == 0 {
		return nil
	}

	quantityByPrice := make(map[float64]int, len(levels))
	for _, l := range levels {
		quantityByPrice[l.Price] += l.Quantity
	}

	aggregated := make([]Level, 0, len(quantityByPrice))
	for price, quantity := range quantityByPrice {
		aggregated = append(aggregated, Level{Price: price, Quantity: quantity})
	}
	sort.Slice(aggregated, func(i, j int) bool { return better(aggregated[i].Price, aggregated[j].Price) })

	if depth > 0 && len(aggregated) > depth {
		aggregated = aggregated[:depth]
	}
	return aggregated
}
