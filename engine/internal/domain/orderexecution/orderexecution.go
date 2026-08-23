// Package orderexecution orquestra orderbook.Book (tarefa 3.2) contra o
// estado real persistido do Mercado Ao Vivo — reconstrói o book de um
// ativo a partir das ordens pendentes já gravadas (replay determinístico,
// mesmo raciocínio de path-dependence já usado pelo Temporizador, tarefa
// 3.11) e decide o que executa, o que fica pendurado e, pra ordem a
// mercado, o que precisa de liquidez sintética.
//
// Decisão de modelagem confirmada com o usuário em 2026-08-22 (backlog
// 3.12, não estava em nenhum dos três documentos de referência): o restante
// do app (tela 4.7 "Confirmação de Ordem", ausência de qualquer tela de
// profundidade de book ou de gerenciamento de ordem pendente no inventário)
// já assume execução imediata e garantida. Por isso ordem a mercado sempre
// executa por completo — se o book real (ordens de outros usuários,
// reconstruídas via replay) não tiver profundidade suficiente do lado
// oposto, o "mercado" em si age como contraparte implícita e ilimitada, ao
// preço corrente da tabela de cotações (3.11). Ordem limitada nunca recebe
// esse preenchimento sintético — cruza só contra liquidez real (a de
// outros usuários) e, se sobrar quantidade, fica pendurada no book,
// exatamente como orderbook.Book já testa desde a 3.2. Essa escolha não
// tranca a evolução futura pra um book mais profundo: a liquidez sintética
// é só um passo a mais depois do matching real, não uma substituição dele —
// quando o produto quiser depender só de contrapartes reais, basta parar de
// injetar esse Fill sintético.
package orderexecution

import (
	"errors"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

var (
	ErrInvalidQuantity      = errors.New("quantidade deve ser maior que zero")
	ErrInvalidPrice         = errors.New("preço deve ser maior que zero para ordem limitada")
	ErrInsufficientBalance  = errors.New("saldo insuficiente para executar a ordem")
	ErrInsufficientPosition = errors.New("quantidade em posição insuficiente para a venda")
	// ErrAccountNotFound é devolvido por Repository.LoadContext quando o
	// usuário da ordem não tem conta aberta em accounts — nunca deveria
	// acontecer num fluxo normal (POST /accounts é sempre o primeiro
	// passo), mas uma ordem não tem como ser processada sem saldo pra
	// validar.
	ErrAccountNotFound = errors.New("conta não encontrada para o usuário da ordem")
)

// MarketCounterparty é o UserID sentinela usado num Fill contra liquidez
// sintética — nunca colide com um UserID real porque contas são
// identificadas por UUID (nunca string vazia).
const MarketCounterparty = ""

// RestingOrder é uma ordem já persistida em order_book aguardando
// pareamento — carrega o que orderbook.Order não tem (dono e quanto já foi
// executado) pra permitir reconstruir o book fielmente via replay.
// RemainingQuantity é sempre a quantidade original menos o que já foi
// preenchido em execuções anteriores, nunca a quantidade original da ordem.
type RestingOrder struct {
	ID                string
	UserID            string
	Side              orderbook.Side
	Type              orderbook.Type
	Price             float64
	RemainingQuantity int
}

// Context é o insumo que Execute precisa pra processar uma ordem recebida
// contra um ativo específico. Resting deve vir ordenado por chegada
// original (created_at ascendente) — é essa ordem que preserva a
// prioridade de tempo correta ao ser repassada pra Book.Submit durante o
// replay. IncomingUserBalance/IncomingUserPosition são sempre do usuário da
// ordem recebida, nunca de uma contraparte pendurada no book — o saldo de
// quem já tem ordem pendurada foi validado quando ela foi originalmente
// submetida (decisão de escopo desta tarefa: sem reserva de saldo/posição
// pra ordem limitada pendurada, mesma simplificação que o restante do
// schema já assume ao não ter uma coluna de valor reservado).
type Context struct {
	ReferencePrice       float64
	Resting              []RestingOrder
	IncomingUserBalance  float64
	IncomingUserPosition int
}

// Fill é uma execução (real ou sintética) resultante do processamento da
// ordem recebida — granularidade suficiente pra gravar um evento e
// atualizar accounts/positions dos dois lados. CounterpartyOrderID fica
// vazio pra liquidez sintética (não existe uma ordem real do outro lado).
type Fill struct {
	CounterpartyOrderID string
	CounterpartyUserID  string
	Price               float64
	Quantity            int
}

// IsSynthetic indica se o Fill veio de liquidez sintética (o "mercado" como
// contraparte), não de uma ordem real de outro usuário.
func (f Fill) IsSynthetic() bool {
	return f.CounterpartyUserID == MarketCounterparty
}

// Outcome é o resultado de processar a ordem recebida contra o book
// reconstruído + liquidez sintética de referência (pra ordem a mercado).
type Outcome struct {
	Fills             []Fill
	FilledQuantity    int
	RemainingQuantity int
}

// Execute reconstrói o book do ativo a partir de Context.Resting (replay,
// em ordem de chegada), submete a ordem recebida contra ele e, se for
// ordem a mercado e ainda sobrar quantidade sem contraparte real,
// completa com liquidez sintética ao preço de referência (ver doc do
// pacote). Valida saldo (compra) ou posição (venda) do usuário da ordem
// recebida contra o resultado já calculado — só depois disso o chamador
// deve persistir qualquer coisa.
func Execute(incoming orderbook.Order, ctx Context) (Outcome, error) {
	if incoming.Quantity <= 0 {
		return Outcome{}, ErrInvalidQuantity
	}
	if incoming.Type == orderbook.TypeLimit && incoming.Price <= 0 {
		return Outcome{}, ErrInvalidPrice
	}

	var book orderbook.Book
	restingUserByOrderID := make(map[string]string, len(ctx.Resting))
	for _, r := range ctx.Resting {
		restingUserByOrderID[r.ID] = r.UserID
		book.Submit(orderbook.Order{ID: r.ID, Side: r.Side, Type: r.Type, Price: r.Price, Quantity: r.RemainingQuantity})
	}

	trades := book.Submit(incoming)

	fills := make([]Fill, 0, len(trades)+1)
	filled := 0
	for _, trade := range trades {
		counterpartyOrderID := trade.SellOrderID
		if incoming.Side == orderbook.SideSell {
			counterpartyOrderID = trade.BuyOrderID
		}
		fills = append(fills, Fill{
			CounterpartyOrderID: counterpartyOrderID,
			CounterpartyUserID:  restingUserByOrderID[counterpartyOrderID],
			Price:               trade.Price,
			Quantity:            trade.Quantity,
		})
		filled += trade.Quantity
	}

	remaining := incoming.Quantity - filled
	if incoming.Type == orderbook.TypeMarket && remaining > 0 {
		fills = append(fills, Fill{CounterpartyUserID: MarketCounterparty, Price: ctx.ReferencePrice, Quantity: remaining})
		filled += remaining
		remaining = 0
	}

	if err := validateFunds(incoming, fills, ctx); err != nil {
		return Outcome{}, err
	}

	return Outcome{Fills: fills, FilledQuantity: filled, RemainingQuantity: remaining}, nil
}

func validateFunds(incoming orderbook.Order, fills []Fill, ctx Context) error {
	switch incoming.Side {
	case orderbook.SideBuy:
		var totalCost float64
		for _, f := range fills {
			totalCost += f.Price * float64(f.Quantity)
		}
		if totalCost > ctx.IncomingUserBalance {
			return ErrInsufficientBalance
		}
	case orderbook.SideSell:
		if incoming.Quantity > ctx.IncomingUserPosition {
			return ErrInsufficientPosition
		}
	}
	return nil
}
