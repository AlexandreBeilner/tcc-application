// Package orderexecution orquestra orderbook.Book (tarefa 3.2) contra o
// estado real persistido do Mercado Ao Vivo — reconstrói o book de um
// ativo a partir das ordens pendentes já gravadas (replay determinístico,
// mesmo raciocínio de path-dependence já usado pelo Temporizador, tarefa
// 3.11) e decide o que executa e o que fica pendurado.
//
// Reversão de modelagem (tarefa A.2, backlog-motor-mercado-realista,
// proposta 2.1) da decisão de 2026-08-22 (backlog 3.12): pro Mercado Ao
// Vivo, ordem a mercado sem profundidade suficiente do lado oposto do book
// real deixava de ser completada por liquidez sintética — o "mercado"
// agindo como contraparte implícita e ilimitada ao preço de referência.
// Isso foi revertido de propósito: bots de liquidez real (Fase B/C deste
// backlog) são quem deve prover profundidade ao book, não uma contraparte
// sintética. Agora, pro Mercado Ao Vivo, ordem a mercado cruza só contra
// liquidez real (ordens de outros usuários, reconstruídas via replay) e,
// se sobrar quantidade sem contraparte, essa sobra simplesmente não
// executa — sem erro, sem preenchimento sintético. Diferente de ordem
// limitada residual, essa sobra também não fica pendurada no book (RF04,
// TCC cap. 2.3.1: ordem a mercado nunca fica sem preço) — é só quantidade
// que não foi possível executar agora. A tela de Confirmação de Ordem
// (4.7) comunica isso ao usuário via Outcome.RemainingQuantity.
//
// Ativo sandbox (RF12/RNF08, tarefa 4.11) é a exceção deliberada — proposta
// motor-mercado-realista 2.7 confirma que o sandbox fica **fora do escopo**
// deste redesenho (100% roteirizado, sem bot nenhum, pra preservar a
// garantia pedagógica de execução idêntica pra todo usuário). Por isso
// Context.Sandbox mantém viva a liquidez sintética (MarketCounterparty)
// só pra esse caso — ver Execute.
package orderexecution

import (
	"errors"

	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/position"
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
	// ErrFloatExceeded é o mesmo erro de position.ValidateFloatCeiling
	// (float finito, tarefa A.3), redeclarado aqui pra manter o padrão de
	// que quem chama Execute (e o handler HTTP) só precisa importar
	// orderexecution pra checar qualquer erro devolvido.
	ErrFloatExceeded = position.ErrFloatExceeded
)

// MarketCounterparty é o UserID sentinela usado num Fill contra liquidez
// sintética (só pra ativo sandbox, Context.Sandbox — ver doc do pacote) —
// nunca colide com um UserID real porque contas são identificadas por UUID
// (nunca string vazia).
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
	// Sandbox indica que o ativo é `is_sandbox = true` (RF12/RNF08, tarefa
	// 4.11) — único caso em que ordem a mercado ainda recebe preenchimento
	// sintético ao preço de referência (ver doc do pacote, tarefa A.2).
	// Mercado Ao Vivo nunca marca isso.
	Sandbox bool
	// OutstandingShares é o float finito do ativo (tarefa A.3,
	// variable_income_assets.outstanding_shares) — nil quando o ativo não
	// tem esse teto configurado (ex: sandbox, que nasce sempre com esse
	// campo nulo — ver seedSandboxEquity). Quando presente, Execute valida
	// que a soma de todas as posições nunca o ultrapassa; quando nil, a
	// validação de float é pulada por completo.
	OutstandingShares *int64
	// TotalHeldExcludingIncoming é a soma das posições de todos os outros
	// detentores reais do ativo (usuários + bots), sem contar a posição do
	// usuário da ordem recebida (essa já vem em IncomingUserPosition) — só
	// precisa vir preenchido quando OutstandingShares não é nil.
	TotalHeldExcludingIncoming int64
}

// Fill é uma execução (real ou sintética, só possível pro caso sandbox)
// resultante do processamento da ordem recebida — granularidade suficiente
// pra gravar um evento e atualizar accounts/positions dos dois lados.
// CounterpartyOrderID fica vazio pra liquidez sintética (não existe uma
// ordem real do outro lado).
type Fill struct {
	CounterpartyOrderID string
	CounterpartyUserID  string
	Price               float64
	Quantity            int
}

// IsSynthetic indica se o Fill veio de liquidez sintética (o "mercado" como
// contraparte, só possível pra ativo sandbox — Context.Sandbox), não de uma
// ordem real de outro usuário.
func (f Fill) IsSynthetic() bool {
	return f.CounterpartyUserID == MarketCounterparty
}

// Outcome é o resultado de processar a ordem recebida contra o book real
// reconstruído (mais liquidez sintética, só pro caso sandbox) —
// RemainingQuantity é a parte que não achou contraparte real e não é
// sandbox (só possível pra ordem a mercado do Mercado Ao Vivo; ordem
// limitada residual sempre fica pendurada no book em vez de aparecer
// aqui).
type Outcome struct {
	Fills             []Fill
	FilledQuantity    int
	RemainingQuantity int
}

// Execute reconstrói o book do ativo a partir de Context.Resting (replay,
// em ordem de chegada) e submete a ordem recebida contra ele. Pra ordem a
// mercado de ativo sandbox (Context.Sandbox) que ainda sobra quantidade
// sem contraparte real, completa com liquidez sintética ao preço de
// referência (ver doc do pacote) — Mercado Ao Vivo nunca recebe esse
// preenchimento, a sobra só não executa. Valida saldo (compra) ou posição
// (venda) do usuário da ordem recebida contra o resultado já calculado —
// só depois disso o chamador deve persistir qualquer coisa.
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
	if incoming.Type == orderbook.TypeMarket && remaining > 0 && ctx.Sandbox {
		fills = append(fills, Fill{CounterpartyUserID: MarketCounterparty, Price: ctx.ReferencePrice, Quantity: remaining})
		filled += remaining
		remaining = 0
	}

	if err := validateFunds(incoming, fills, ctx); err != nil {
		return Outcome{}, err
	}
	if err := validateFloat(ctx); err != nil {
		return Outcome{}, err
	}

	return Outcome{Fills: fills, FilledQuantity: filled, RemainingQuantity: remaining}, nil
}

// validateFloat garante o float finito do ativo (tarefa A.3): a soma das
// posições de todos os detentores (TotalHeldExcludingIncoming +
// IncomingUserPosition, o snapshot que Repository.LoadContext leu antes de
// chamar Execute) nunca pode ultrapassar OutstandingShares. Pulada por
// completo quando ctx.OutstandingShares é nil (ativo sem esse teto, ex:
// sandbox). Basta validar o total pré-negociação, não o pós: Execute só
// transfere quantidade já existente entre o usuário da ordem recebida e
// uma contraparte real já contabilizada em TotalHeldExcludingIncoming
// (nunca cria posição do nada — a liquidez sintética de sandbox é a única
// exceção, e sandbox nunca marca OutstandingShares), então a soma total
// nunca muda numa ordem normal; essa checagem só existe como proteção
// contra uma distribuição inicial malformada (Fase B), não como regra que
// trava negociação legítima.
func validateFloat(ctx Context) error {
	if ctx.OutstandingShares == nil {
		return nil
	}
	totalHeld := ctx.TotalHeldExcludingIncoming + int64(ctx.IncomingUserPosition)
	return position.ValidateFloatCeiling(totalHeld, *ctx.OutstandingShares)
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
