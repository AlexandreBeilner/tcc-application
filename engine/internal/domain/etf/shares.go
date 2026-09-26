package etf

import (
	"context"
	"errors"
	"math"
)

var (
	// ErrInvalidShareAmount é devolvido quando a quantidade de cotas criadas
	// ou resgatadas não é positiva.
	ErrInvalidShareAmount = errors.New("quantidade de cotas precisa ser maior que zero")
	// ErrEmptyBasket é devolvido quando a cesta entregue ou recebida pelo
	// participante não tem nenhum constituinte.
	ErrEmptyBasket = errors.New("cesta de criação ou resgate não pode ser vazia")
	// ErrInvalidBasketLeg é devolvido quando um constituinte da cesta tem
	// asset_id vazio, quantidade não positiva ou preço não positivo.
	ErrInvalidBasketLeg = errors.New("constituinte da cesta precisa de asset_id, quantidade e preço positivos")
	// ErrDuplicateBasketLeg é devolvido quando o mesmo asset_id aparece em mais
	// de uma linha da cesta.
	ErrDuplicateBasketLeg = errors.New("mesmo asset_id em mais de uma linha da cesta")
	// ErrSameAccount é devolvido quando o participante é a própria conta do
	// fundo: criar e resgatar contra si mesmo não tem significado.
	ErrSameAccount = errors.New("participante autorizado não pode ser a conta do próprio fundo")
	// ErrShareConservation é devolvido quando, depois de criar ou resgatar, o
	// total de cotas em posições deixa de ser igual a outstanding_shares.
	ErrShareConservation = errors.New("total de cotas em posições difere de outstanding_shares do ETF")
	// ErrWrongFundAccount é devolvido quando a conta de fundo informada não é a
	// conta ligada ao ETF em etf_details.
	ErrWrongFundAccount = errors.New("conta de fundo informada não pertence a este ETF")
	// ErrETFNotFound é devolvido quando o ativo não é um ETF com fundo ligado.
	ErrETFNotFound = errors.New("ETF não encontrado ou sem conta de fundo")
)

// BasketLeg é uma linha da cesta trocada numa criação ou resgate de cotas:
// quantidade de um constituinte e o preço de referência usado pra formar o
// preço médio da posição de quem recebe (nada é pago em caixa nessa troca).
type BasketLeg struct {
	AssetID  string
	Quantity int64
	Price    float64
}

// ShareExchange descreve uma criação ou um resgate de cotas em espécie
// (proposta motor-mercado-realista 5.3, tarefa R.2): na criação, o participante
// entrega a cesta ao fundo e recebe cotas novas; no resgate, devolve cotas e
// recebe a cesta. SharePrice é o valor da cota (NAV) usado como preço médio das
// cotas que o participante passa a deter na criação; no resgate serve só de
// referência do evento.
type ShareExchange struct {
	ETFAssetID           string
	FundAccountID        string
	ParticipantAccountID string
	Shares               int64
	SharePrice           float64
	Basket               []BasketLeg
}

// Validate confere as regras de forma da troca, sem tocar em saldo nem posição
// (essas são checadas pelo repositório dentro da transação, com lock).
func (e ShareExchange) Validate() error {
	// market_events.quantity é int (32 bits): uma troca maior que isso não cabe
	// no evento imutável.
	if e.Shares <= 0 || e.Shares > math.MaxInt32 {
		return ErrInvalidShareAmount
	}
	if e.SharePrice <= 0 {
		return ErrInvalidBasketLeg
	}
	if e.FundAccountID == "" || e.ParticipantAccountID == "" || e.ETFAssetID == "" {
		return ErrInvalidBasketLeg
	}
	if e.FundAccountID == e.ParticipantAccountID {
		return ErrSameAccount
	}
	if len(e.Basket) == 0 {
		return ErrEmptyBasket
	}
	seen := make(map[string]bool, len(e.Basket))
	for _, leg := range e.Basket {
		if leg.AssetID == "" || leg.Quantity <= 0 || leg.Quantity > math.MaxInt32 || leg.Price <= 0 {
			return ErrInvalidBasketLeg
		}
		if leg.AssetID == e.ETFAssetID {
			return ErrInvalidBasketLeg
		}
		if seen[leg.AssetID] {
			return ErrDuplicateBasketLeg
		}
		seen[leg.AssetID] = true
	}
	return nil
}

// ProRataBasket calcula a cesta que corresponde a `shares` cotas quando o
// fundo já tem cotas emitidas: cada constituinte na proporção shares /
// sharesOutstanding da posição atual do fundo. `fundHoldings` traz a
// quantidade que o fundo detém de cada constituinte (Quantity) e o preço
// corrente (Price). Na criação (roundUp = true) a quantidade arredonda pra cima,
// então quem cria nunca dilui os cotistas atuais; no resgate (roundUp = false)
// arredonda pra baixo, então o fundo nunca entrega mais do que a fração devida.
// Constituinte cuja quantidade dá zero fica fora da cesta.
func ProRataBasket(fundHoldings []BasketLeg, sharesOutstanding, shares int64, roundUp bool) ([]BasketLeg, error) {
	if shares <= 0 || sharesOutstanding <= 0 {
		return nil, ErrInvalidShareAmount
	}
	basket := make([]BasketLeg, 0, len(fundHoldings))
	for _, h := range fundHoldings {
		if h.Quantity < 0 || h.Price <= 0 || h.AssetID == "" {
			return nil, ErrInvalidBasketLeg
		}
		quantity := h.Quantity * shares / sharesOutstanding
		if roundUp && h.Quantity*shares%sharesOutstanding != 0 {
			quantity++
		}
		if quantity > 0 {
			basket = append(basket, BasketLeg{AssetID: h.AssetID, Quantity: quantity, Price: h.Price})
		}
	}
	if len(basket) == 0 {
		return nil, ErrEmptyBasket
	}
	return basket, nil
}

// ShareExchanger é o colaborador que o participante autorizado e a emissão
// inicial usam pra criar e resgatar cotas de forma atômica; a implementação
// concreta fica em internal/infra/db.
type ShareExchanger interface {
	Create(ctx context.Context, exchange ShareExchange) error
	Redeem(ctx context.Context, exchange ShareExchange) error
}
