package etf

import (
	"errors"
	"math"
	"sort"
)

// Parâmetros da emissão inicial (tarefa R.3): valores ilustrativos, mesma
// calibração fina da tarefa 8.1. InitialSharePrice é o valor de cota em que um
// ETF novo nasce (o mesmo preço inicial de qualquer ativo de renda variável do
// motor, tick.DefaultInitialPrice, repetido aqui porque tick importa este
// pacote e não o contrário). InitialFundValue é o patrimônio-alvo da cesta
// comprada pelo Participante Autorizado; ParticipantCashMargin é a folga de
// caixa provisionada sobre esse valor pra cobrir o deslize de preço ao varrer
// os books dos constituintes.
const (
	InitialSharePrice     = 100.0
	InitialFundValue      = 1_000_000.0
	ParticipantCashMargin = 1.5
)

// AuthorizedParticipantAccountID é a conta única do Participante Autorizado
// (proposta 5.3): ator mecânico (is_bot, sem personalidade, nunca entra numa
// rodada de bots) que faz a emissão inicial e, na R.6, a arbitragem
// NAV x preço de todos os ETFs. Uma conta só, não uma por ETF, pra o custo não
// crescer com o catálogo. Uuid fixo e bem formado, fora da faixa dos bots
// direcionais (`00000000-0000-0000-0000-0000000000NN`).
const AuthorizedParticipantAccountID = "00000000-0000-0000-fffe-000000000001"

var (
	// ErrNothingToIssue é devolvido por InitialIssuance quando o que o
	// participante conseguiu comprar não sustenta nem uma cota.
	ErrNothingToIssue = errors.New("cesta comprada não sustenta nenhuma cota")
	// ErrInvalidWeightedConstituent é devolvido quando um constituinte tem
	// peso ou preço não positivo.
	ErrInvalidWeightedConstituent = errors.New("constituinte precisa de asset_id, peso e preço positivos")
)

// WeightedConstituent é um constituinte real da cesta com o peso-alvo e o
// preço corrente (já resolvido por quem chama, mesma regra de Constituent).
type WeightedConstituent struct {
	AssetID   string
	WeightPct float64
	Price     float64
}

func validateWeighted(cs []WeightedConstituent) error {
	if len(cs) == 0 {
		return ErrNoConstituents
	}
	for _, c := range cs {
		if c.AssetID == "" || c.WeightPct <= 0 || c.Price <= 0 {
			return ErrInvalidWeightedConstituent
		}
	}
	return nil
}

// InitialTargetBasket devolve a quantidade de cada constituinte que o
// participante deve tentar comprar pra montar um fundo de fundValue, respeitando
// os pesos (arredonda pra baixo). Ordenada por AssetID (determinismo).
func InitialTargetBasket(cs []WeightedConstituent, fundValue float64) ([]BasketLeg, error) {
	if err := validateWeighted(cs); err != nil {
		return nil, err
	}
	basket := make([]BasketLeg, 0, len(cs))
	for _, c := range cs {
		quantity := int64(math.Floor(fundValue * c.WeightPct / 100 / c.Price))
		if quantity > 0 {
			basket = append(basket, BasketLeg{AssetID: c.AssetID, Quantity: quantity, Price: c.Price})
		}
	}
	sort.Slice(basket, func(i, j int) bool { return basket[i].AssetID < basket[j].AssetID })
	return basket, nil
}

// InitialIssuance calcula, a partir do que o participante de fato detém de cada
// constituinte (`held`, depois de comprar nos books, que podem ter absorvido só
// parte do alvo), quantas cotas ele pode criar e a cesta exata a entregar: o
// maior número de cotas, ao InitialSharePrice, que os pesos-alvo permitem sem
// faltar nenhum constituinte. O que sobrar de um constituinte fica com o
// participante. Nunca cria cota "pela metade": ou todo peso está coberto ou a
// cota não existe.
func InitialIssuance(cs []WeightedConstituent, held map[string]int64) (int64, []BasketLeg, error) {
	if err := validateWeighted(cs); err != nil {
		return 0, nil, err
	}
	shares := int64(math.MaxInt64)
	for _, c := range cs {
		perShare := InitialSharePrice * c.WeightPct / 100 / c.Price // unidades por cota
		if fit := int64(math.Floor(float64(held[c.AssetID]) / perShare)); fit < shares {
			shares = fit
		}
	}
	if shares <= 0 {
		return 0, nil, ErrNothingToIssue
	}

	basket := make([]BasketLeg, 0, len(cs))
	for _, c := range cs {
		perShare := InitialSharePrice * c.WeightPct / 100 / c.Price
		quantity := int64(math.Ceil(float64(shares) * perShare))
		if quantity > held[c.AssetID] {
			quantity = held[c.AssetID]
		}
		if quantity > 0 {
			basket = append(basket, BasketLeg{AssetID: c.AssetID, Quantity: quantity, Price: c.Price})
		}
	}
	sort.Slice(basket, func(i, j int) bool { return basket[i].AssetID < basket[j].AssetID })
	return shares, basket, nil
}

// FundSnapshot é o estado de um fundo lido do banco: cotas emitidas, caixa,
// passivo de dividendo a pagar e o que ele detém de cada constituinte.
type FundSnapshot struct {
	ETFAssetID string
	// FundAccountID é a conta do fundo (troca de cotas por cesta da R.6).
	FundAccountID string
	Shares        int64
	Cash          float64
	Liabilities   float64
	// FeesPayable (R.9) é a taxa de administração acumulada e ainda não paga; já
	// está somada em Liabilities. ExpenseRatioPct é a taxa anual (% do patrimônio).
	FeesPayable     float64
	ExpenseRatioPct float64
	Holdings        []FundHolding
	// Rebalanceamento (R.7): periodicidade em dias, último dia rebalanceado (nil
	// = nunca) e a composição-alvo real da cesta.
	RebalanceEveryDays int
	LastRebalanceDay   *int
	Targets            []TargetWeight
}

// FundHolding é a quantidade que o fundo detém de um constituinte.
type FundHolding struct {
	AssetID  string
	Quantity int64
}

// NAVFromSnapshot calcula o NAV (ou o iNAV, com preços intradiários) de um
// fundo a partir das posições dele e dos preços correntes dos constituintes.
// Constituinte sem preço informado devolve ErrMissingConstituentPrice.
func NAVFromSnapshot(f FundSnapshot, prices map[string]float64) (float64, error) {
	constituents := make([]Constituent, 0, len(f.Holdings))
	for _, h := range f.Holdings {
		price, ok := prices[h.AssetID]
		if !ok {
			return 0, ErrMissingConstituentPrice
		}
		constituents = append(constituents, Constituent{Quantity: h.Quantity, Price: price})
	}
	return NAV(constituents, f.Cash, f.Liabilities, f.Shares)
}

// PremiumPct é o ágio (positivo) ou deságio (negativo) do preço de mercado
// sobre o NAV, em pontos percentuais. NAV não positivo devolve 0.
func PremiumPct(price, nav float64) float64 {
	if nav <= 0 {
		return 0
	}
	return (price/nav - 1) * 100
}

// PendingIssuance é um ETF com fundo ligado, sem nenhuma cota emitida, e a
// composição real (só constituintes com asset_id) que a emissão inicial compra.
type PendingIssuance struct {
	ETFAssetID    string
	FundAccountID string
	Holdings      []Holding
}
