// Package bot — arquétipo Ruído (tarefa C.2), a primeira função de decisão
// de ordem do motor de bots (proposta 2.3.1/2.3.2, Gode & Sunder 1993:
// "Zero-Intelligence" com restrição de orçamento — ZI-C). Decision é o
// resultado de qualquer arquétipo (não só Ruído) — C.3-C.5 devolvem o
// mesmo tipo, cada um com sua própria função `Decide*`; só o "como decidir"
// muda entre arquétipos, não o formato da decisão em si.
package bot

import (
	"errors"
	"math/rand"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

// NoisePriceBandPct é a faixa (fração do preço de referência, pra cada
// lado) de onde o arquétipo Ruído sorteia seu preço-limite — a proposta
// 2.3.1/2.3.2 pede "preço-limite aleatório" sem fixar uma faixa numérica;
// 5% é um valor ilustrativo desta sessão, sujeito à mesma calibração futura
// já prevista pra outros coeficientes do motor (spec 3.3.2/proposta seção
// 7) — não uma decisão fechada como MarketMakerShareMin/Max ou
// SpecializationWithinScopeMin/Max.
const NoisePriceBandPct = 0.05

var (
	ErrInvalidReferencePrice = errors.New("preço de referência precisa ser positivo")
	// ErrNoViableOrder é devolvido quando o bot não tem caixa suficiente
	// pra comprar 1 unidade ao preço sorteado nem posição suficiente pra
	// vender 1 unidade — nesse caso ele simplesmente não participa da
	// rodada (Fase D consome isso pulando o bot, não é um erro de
	// programação).
	ErrNoViableOrder = errors.New("bot sem caixa nem posição suficiente pra gerar uma ordem")
)

// Decision é a ordem que a função de decisão de um arquétipo produz —
// ainda sem ID/UserID (atribuídos por quem orquestra a rodada, Fase D, ao
// submeter contra orderbook.Book/orderexecution.Execute). Side/Type
// reaproveitam os enums de orderbook em vez de redeclará-los — são a
// mesma "ordem de compra/venda, a mercado/limitada" em qualquer ponto do
// motor, não um conceito próprio do domínio bot.
type Decision struct {
	Side     orderbook.Side
	Type     orderbook.Type
	Price    float64
	Quantity int
}

// DecideNoiseOrder implementa o arquétipo Ruído (Zero-Intelligence com
// restrição de orçamento, proposta 2.3.1/2.3.2): sorteia lado, preço-limite
// (dentro de NoisePriceBandPct ao redor de referencePrice) e quantidade,
// sem nenhuma opinião sobre o valor do ativo — a única restrição é nunca
// comprar acima do que availableCash cobre ao preço sorteado, nem vender
// mais do que currentPosition tem. Determinística por seed, mesmo padrão
// de InitialAllocation/InitialCash.
//
// Quando nem compra nem venda são viáveis (sem caixa suficiente pra 1
// unidade e sem posição nenhuma), devolve ErrNoViableOrder — o bot não gera
// ordem nenhuma nessa rodada, em vez de uma ordem inválida ou de tamanho
// zero.
func DecideNoiseOrder(referencePrice, availableCash float64, currentPosition int, seed int64) (Decision, error) {
	if referencePrice <= 0 {
		return Decision{}, ErrInvalidReferencePrice
	}

	rng := rand.New(rand.NewSource(seed))
	price := referencePrice * (1 + (rng.Float64()*2-1)*NoisePriceBandPct)

	canBuy := availableCash >= price
	canSell := currentPosition >= 1
	if !canBuy && !canSell {
		return Decision{}, ErrNoViableOrder
	}

	side := orderbook.SideBuy
	switch {
	case canBuy && canSell:
		if rng.Intn(2) == 1 {
			side = orderbook.SideSell
		}
	case canSell:
		side = orderbook.SideSell
	}

	maxQuantity := int(availableCash / price)
	if side == orderbook.SideSell {
		maxQuantity = currentPosition
	}

	return Decision{
		Side:     side,
		Type:     orderbook.TypeLimit,
		Price:    price,
		Quantity: 1 + rng.Intn(maxQuantity),
	}, nil
}
