package etf

import (
	"errors"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

// ArbitrageMispricingThresholdPct é a faixa morta em torno do NAV dentro da
// qual o bot-AP não vê oportunidade de arbitragem — mesma técnica de faixa
// morta já usada por FundamentalistMispricingThresholdPct (pacote bot); é
// mais estreita (0,5% contra 1%) porque a arbitragem NAV é mecânica/de
// baixo risco (o AP já sabe o valor exato da cesta, diferente do
// Fundamentalista, que estima um preço justo com ruído) — valor
// ilustrativo desta sessão, sujeito à mesma calibração futura já registrada
// pros outros coeficientes do motor.
const ArbitrageMispricingThresholdPct = 0.005

var (
	// ErrInvalidMarketPriceOrNAV é devolvido por DecideAuthorizedParticipantAction
	// quando o preço de mercado do ETF ou o NAV não são positivos.
	ErrInvalidMarketPriceOrNAV = errors.New("preço de mercado e NAV do ETF precisam ser maiores que zero")
	// ErrInvalidArbitrageShares é devolvido quando a quantidade de cotas da
	// arbitragem não é positiva.
	ErrInvalidArbitrageShares = errors.New("quantidade de cotas da arbitragem precisa ser maior que zero")
	// ErrNoArbitrageOpportunity é devolvido quando o preço de mercado do ETF
	// já está dentro de ArbitrageMispricingThresholdPct do NAV — sem ágio
	// nem deságio relevante, o bot-AP fica de fora da rodada (mesmo efeito
	// prático de ErrNoMispricingDetected no arquétipo Fundamentalista,
	// pacote bot, mas semântica própria: aqui não há estimativa nem ruído,
	// é comparação direta contra o NAV real).
	ErrNoArbitrageOpportunity = errors.New("preço de mercado já está dentro da tolerância do NAV, sem oportunidade de arbitragem")
)

// BasketConstituentWeight é a composição-alvo do fundo pra um constituinte
// da cesta — mesmo par (AssetID, Price, WeightPct) de RebalanceConstituent,
// sem CurrentQuantity porque o bot-AP não carrega estoque próprio entre
// arbitragens (proposta 5.3): cada rodada de criação/resgate monta e
// desfaz a cesta inteira na hora, nunca herda posição da rodada anterior.
type BasketConstituentWeight struct {
	AssetID   string
	Price     float64
	WeightPct float64
}

// AuthorizedParticipantAction é a arbitragem decidida por
// DecideAuthorizedParticipantAction: o pedido que o bot-AP faz das próprias
// cotas do ETF no mercado (ETFOrder — o lado que empurra o preço de volta
// pro NAV), as ordens da cesta de ativos subjacente que sustentam a
// criação/resgate (BasketOrders — mesmo tipo RebalanceOrder de H.2, já que
// é a mesma operação "converter peso-alvo em ordem" reaproveitada com um
// papel diferente, proposta 5.3), e SharesOutstandingDelta (positivo numa
// criação, negativo num resgate — é isso que tira o total de cotas em
// circulação do ETF da imutabilidade que tinha desde o seed).
type AuthorizedParticipantAction struct {
	ETFOrder               RebalanceOrder
	BasketOrders           []RebalanceOrder
	SharesOutstandingDelta int64
}

// DecideAuthorizedParticipantAction decide a arbitragem entre o preço de
// mercado corrente do ETF e o NAV (proposta 5.3): ágio (marketPrice > nav
// além da faixa morta) gera criação — o bot-AP "compra" a cesta (BasketOrders,
// todas do lado de compra) pra entregar ao fundo, recebe arbitrageShares
// cotas novas e as vende no mercado (ETFOrder do lado de venda, pressão que
// empurra o preço de volta pro NAV); deságio gera resgate — o bot-AP compra
// as cotas baratas no mercado (ETFOrder do lado de compra, pressão que
// empurra o preço de volta pro NAV também, só que de baixo pra cima),
// resgata pelos ativos subjacentes (destruição de arbitrageShares cotas) e
// vende esses ativos (BasketOrders, todas do lado de venda). arbitrageShares
// é sempre o tamanho do lote desta arbitragem — decisão de quanto arbitrar
// por rodada fica com quem chama (mesmo padrão de "sizing é decisão de quem
// orquestra" já usado por otherBotCount em bot.InitialAllocation, B.1),
// não desta função.
//
// BasketOrders reaproveita a mesma matemática de RebalanceOrders (H.2):
// tanto pra criação quanto pra resgate, o valor da transação
// (arbitrageShares × nav — o NAV, não o preço de mercado, é o valor pelo
// qual o fundo troca cotas por cesta) é reconciliado contra a cesta a
// partir de uma posição zerada (o bot-AP nunca carrega estoque entre
// arbitragens) — a criação usa esse resultado direto (todas as ordens já
// nascem do lado de compra); o resgate usa o mesmo cálculo pra descobrir
// quanto de cada ativo foi recebido do fundo e inverte o lado pra venda,
// evitando duplicar a fórmula peso→quantidade duas vezes.
func DecideAuthorizedParticipantAction(
	etfAssetID string,
	marketPrice, nav float64,
	arbitrageShares int64,
	basket []BasketConstituentWeight,
) (AuthorizedParticipantAction, error) {
	if marketPrice <= 0 || nav <= 0 {
		return AuthorizedParticipantAction{}, ErrInvalidMarketPriceOrNAV
	}
	if arbitrageShares <= 0 {
		return AuthorizedParticipantAction{}, ErrInvalidArbitrageShares
	}

	mispricingPct := (marketPrice - nav) / nav
	transactionValue := float64(arbitrageShares) * nav

	switch {
	case mispricingPct > ArbitrageMispricingThresholdPct:
		basketOrders, err := basketOrdersFromWeights(basket, transactionValue)
		if err != nil {
			return AuthorizedParticipantAction{}, err
		}
		return AuthorizedParticipantAction{
			ETFOrder: RebalanceOrder{
				AssetID: etfAssetID, Side: orderbook.SideSell, Type: orderbook.TypeMarket,
				Price: marketPrice, Quantity: arbitrageShares,
			},
			BasketOrders:           basketOrders,
			SharesOutstandingDelta: arbitrageShares,
		}, nil
	case mispricingPct < -ArbitrageMispricingThresholdPct:
		basketOrders, err := basketOrdersFromWeights(basket, transactionValue)
		if err != nil {
			return AuthorizedParticipantAction{}, err
		}
		for i := range basketOrders {
			basketOrders[i].Side = orderbook.SideSell
		}
		return AuthorizedParticipantAction{
			ETFOrder: RebalanceOrder{
				AssetID: etfAssetID, Side: orderbook.SideBuy, Type: orderbook.TypeMarket,
				Price: marketPrice, Quantity: arbitrageShares,
			},
			BasketOrders:           basketOrders,
			SharesOutstandingDelta: -arbitrageShares,
		}, nil
	default:
		return AuthorizedParticipantAction{}, ErrNoArbitrageOpportunity
	}
}

// basketOrdersFromWeights converte a composição-alvo do fundo numa lista de
// ordens de compra, cada uma no tamanho correspondente à fatia de
// transactionValue que aquele peso representa — reaproveita RebalanceOrders
// (H.2) a partir de uma cesta zerada (CurrentQuantity sempre 0, o bot-AP não
// carrega estoque próprio) com transactionValue como "caixa" disponível:
// como todo constituinte parte de zero, toda ordem resultante nasce do lado
// de compra por construção (diff = alvo − 0 nunca é negativo).
func basketOrdersFromWeights(basket []BasketConstituentWeight, transactionValue float64) ([]RebalanceOrder, error) {
	reconciliation := make([]RebalanceConstituent, len(basket))
	for i, b := range basket {
		reconciliation[i] = RebalanceConstituent{
			AssetID:         b.AssetID,
			CurrentQuantity: 0,
			Price:           b.Price,
			TargetWeightPct: b.WeightPct,
		}
	}
	return RebalanceOrders(reconciliation, transactionValue, 0)
}
