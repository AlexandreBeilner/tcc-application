// Package orderbook implementa o motor de pareamento de ordens (matching
// engine) do Mercado Ao Vivo — book de ofertas por ativo, pareando ordens de
// compra e venda por prioridade de preço e tempo (TCC cap. 2.3.1).
package orderbook

// Side é o lado da ordem — compra ou venda — espelhando o enum Postgres
// `order_side`.
type Side string

const (
	SideBuy  Side = "buy"
	SideSell Side = "sell"
)

// Type é o tipo da ordem — espelhando o enum Postgres `order_type`. Ordens
// limitadas (limit) só executam num preço igual ou melhor que Price;
// ordens a mercado (market) executam contra a melhor oferta disponível no
// book, seja qual for o preço.
type Type string

const (
	TypeMarket Type = "market"
	TypeLimit  Type = "limit"
)

// Order é a ordem submetida ao book. Price é ignorado (não é lido) pra
// ordens a mercado — quem determina o preço de execução é sempre a ordem
// que já está pendurada no book do lado oposto. UserID é opcional (string
// vazia = dono desconhecido/não rastreado, ex: testes deste pacote que não
// envolvem prevenção de self-trade) — quando preenchido dos dois lados de
// um cruzamento em potencial, match() pula esse par em vez de executar (ver
// match), sem removê-lo do book.
type Order struct {
	ID       string
	UserID   string
	Side     Side
	Type     Type
	Price    float64
	Quantity int
}

// Trade é uma execução resultante do pareamento de uma ordem de compra
// contra uma de venda. Price é sempre o preço da ordem que já estava
// pendurada no book (a ordem "passiva" da negociação) — a ordem recém
// chegada ("agressora") aceita esse preço, nunca o contrário.
type Trade struct {
	BuyOrderID  string
	SellOrderID string
	Price       float64
	Quantity    int
}

// restingOrder é uma Order pendurada no book, com o número de sequência de
// chegada anexado — é isso que resolve o desempate de preço por ordem de
// chegada (FIFO), sem depender de timestamp de parede (dois pedidos no
// mesmo instante de relógio ainda precisam de uma ordem determinística).
type restingOrder struct {
	Order
	sequence int64
}

// Book é o book de ofertas de um único ativo. O zero value já é um book
// vazio, pronto pra uso.
type Book struct {
	bids         []*restingOrder // ordens de compra pendentes, melhor = maior preço
	asks         []*restingOrder // ordens de venda pendentes, melhor = menor preço
	nextSequence int64
}

// Submit processa uma nova ordem contra o book: pareia o quanto for
// possível por prioridade de preço e tempo contra o lado oposto e devolve
// os trades executados. A quantidade residual de uma ordem limitada que
// não foi totalmente executada passa a integrar o book, no seu devido
// lugar por preço/tempo; a quantidade residual de uma ordem a mercado é
// descartada — uma ordem a mercado nunca fica pendurada sem preço (RF04,
// TCC cap. 2.3.1).
func (b *Book) Submit(order Order) []Trade {
	incoming := &restingOrder{Order: order, sequence: b.nextSequence}
	b.nextSequence++

	var trades []Trade
	switch incoming.Side {
	case SideBuy:
		trades = b.match(incoming, &b.asks, func(askPrice float64) bool {
			return incoming.Type == TypeMarket || incoming.Price >= askPrice
		})
		if incoming.Quantity > 0 && incoming.Type == TypeLimit {
			insert(&b.bids, incoming, bidHasPriority)
		}
	case SideSell:
		trades = b.match(incoming, &b.bids, func(bidPrice float64) bool {
			return incoming.Type == TypeMarket || incoming.Price <= bidPrice
		})
		if incoming.Quantity > 0 && incoming.Type == TypeLimit {
			insert(&b.asks, incoming, askHasPriority)
		}
	}
	return trades
}

// match pareia `incoming` contra o lado oposto do book (já mantido em
// ordem de prioridade por `insert`), enquanto houver quantidade e o topo do
// lado oposto "cruzar" (crosses) o preço de `incoming`. O preço do trade é
// sempre o da ordem passiva (a que já estava no book) — convenção padrão
// de mercado, e a que dá sentido a "ordens a mercado casam contra a melhor
// oferta": a melhor oferta é quem dita o preço, não quem chega agora.
//
// Prevenção de self-trade: quando o dono de `incoming` é conhecido
// (UserID != "") e coincide com o dono da ordem no topo do lado oposto,
// esse par nunca executa — ninguém deveria ser a própria contraparte
// (corromperia average_price, já que ApplyBuy/ApplySell tratam o preço
// médio de forma assimétrica, e criaria um trade em market_events sem
// contraparte real de fato). A ordem própria some da fila de matching
// desta chamada mas continua pendurada no book (`i++` em vez de dequeue),
// pra ainda poder casar contra a ordem de outro dono, de pior prioridade,
// que esteja atrás dela.
func (b *Book) match(incoming *restingOrder, opposite *[]*restingOrder, crosses func(restingPrice float64) bool) []Trade {
	var trades []Trade
	i := 0
	for incoming.Quantity > 0 && i < len(*opposite) {
		resting := (*opposite)[i]
		if !crosses(resting.Price) {
			break
		}
		if incoming.UserID != "" && resting.UserID == incoming.UserID {
			i++
			continue
		}

		quantity := incoming.Quantity
		if resting.Quantity < quantity {
			quantity = resting.Quantity
		}

		trade := Trade{Price: resting.Price, Quantity: quantity}
		if incoming.Side == SideBuy {
			trade.BuyOrderID, trade.SellOrderID = incoming.ID, resting.ID
		} else {
			trade.BuyOrderID, trade.SellOrderID = resting.ID, incoming.ID
		}
		trades = append(trades, trade)

		incoming.Quantity -= quantity
		resting.Quantity -= quantity
		if resting.Quantity == 0 {
			*opposite = append((*opposite)[:i], (*opposite)[i+1:]...)
		} else {
			i++
		}
	}
	return trades
}

// bidHasPriority ordena o lado de compra por melhor preço (maior primeiro)
// e, em empate de preço, por ordem de chegada (FIFO) — "ordens de mesmo
// preço executam na ordem de chegada", o segundo critério de aceite da
// tarefa 3.2.
func bidHasPriority(a, b *restingOrder) bool {
	if a.Price != b.Price {
		return a.Price > b.Price
	}
	return a.sequence < b.sequence
}

// askHasPriority ordena o lado de venda por melhor preço (menor primeiro)
// e, em empate, por ordem de chegada — mesmo critério de bidHasPriority,
// espelhado porque a melhor oferta de venda é a mais barata.
func askHasPriority(a, b *restingOrder) bool {
	if a.Price != b.Price {
		return a.Price < b.Price
	}
	return a.sequence < b.sequence
}

// insert acrescenta `order` a `side` na posição correta de prioridade,
// mantendo o slice sempre ordenado — evita reordenar o book inteiro a cada
// Submit, já que match só precisa olhar o topo (índice 0).
func insert(side *[]*restingOrder, order *restingOrder, hasPriority func(a, b *restingOrder) bool) {
	i := 0
	for i < len(*side) && hasPriority((*side)[i], order) {
		i++
	}
	*side = append(*side, nil)
	copy((*side)[i+1:], (*side)[i:])
	(*side)[i] = order
}
