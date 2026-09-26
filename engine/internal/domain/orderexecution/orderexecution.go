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
	"time"

	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/position"
)

var (
	ErrInvalidQuantity     = errors.New("quantidade deve ser maior que zero")
	ErrInvalidPrice        = errors.New("preço deve ser maior que zero para ordem limitada")
	ErrInsufficientBalance = errors.New("saldo insuficiente para executar a ordem")
	// ErrInsufficientPosition é o mesmo erro de position.ErrInsufficientQuantity
	// (achado de review, ao vivo: validateFunds usava um errors.New próprio com
	// o mesmo texto em vez de reaproveitar o valor de position, então
	// db.OrderExecutionRepository.Persist — que chama position.ApplySell de
	// novo pra projetar o Fill, contra a posição real lida com FOR UPDATE
	// dentro da própria transação, não o snapshot que Execute validou — podia
	// devolver um erro com texto idêntico mas identidade diferente, escapando
	// de todo errors.Is(err, ErrInsufficientPosition) — inclusive o de
	// tick.businessRejection, rounds.go, que existe exatamente pra não abortar
	// o tick inteiro nesse caso). Redeclarado aqui, mesmo padrão de
	// ErrFloatExceeded logo abaixo, pra manter o padrão de que quem chama
	// Execute/Persist (e o handler HTTP) só precisa importar orderexecution
	// pra checar qualquer erro devolvido.
	ErrInsufficientPosition = position.ErrInsufficientQuantity
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
	// ErrOrderNotFound é devolvido por Repository.CancelOrder (tarefa O.1)
	// tanto pra ordem inexistente quanto pra ordem que existe mas pertence a
	// outro usuário — as duas causas colapsam no mesmo erro (404) de
	// propósito, pra não vazar pro chamador que um ID de ordem alheio
	// existe.
	ErrOrderNotFound = errors.New("ordem não encontrada")
	// ErrOrderNotCancellable é devolvido por Repository.CancelOrder (tarefa
	// O.1) quando a ordem já está filled/cancelled — só pending/
	// partially_filled podem ser canceladas.
	ErrOrderNotCancellable = errors.New("ordem não pode ser cancelada neste status")
	// ErrRestingOrderNoLongerAvailable é devolvido por Repository.Persist
	// (achado ao vivo, sessão da tarefa O.1: Execute decide o match contra
	// Context.Resting, lido por LoadContext fora de transação; se a ordem
	// pendurada escolhida for cancelada — CancelOrder — no intervalo até
	// Persist gravar o fill, um UPDATE sem checar status em order_book
	// "ressuscitava" a ordem cancelada de volta pra partially_filled/filled
	// e ainda movia saldo/posição dos dois lados de uma ordem que o dono já
	// tinha cancelado com sucesso, reproduzido manualmente contra Postgres
	// real via duas transações concorrentes). Mesmo tratamento de
	// ErrInsufficientPosition contra a mesma ordem "furada" (achado 005):
	// nada é persistido, a transação inteira do submissor aborta.
	ErrRestingOrderNoLongerAvailable = errors.New("ordem pendurada não está mais disponível para execução")
)

// MarketCounterparty é o UserID sentinela usado num Fill contra liquidez
// sintética (só pra ativo sandbox, Context.Sandbox — ver doc do pacote) —
// nunca colide com um UserID real porque contas são identificadas por UUID
// (nunca string vazia).
const MarketCounterparty = ""

// CancelReason identifica por que uma ordem chegou a status = cancelled
// (tarefa O.3, espelha o enum Postgres order_cancel_reason, migration
// 000022) — antes desta tarefa as 4 causas eram indistinguíveis pra quem lia
// order_book depois. Nunca preenchido pra nenhum outro status.
type CancelReason string

const (
	// CancelReasonUserCancelled é gravado por Repository.CancelOrder (O.1,
	// cancelamento manual pelo próprio dono).
	CancelReasonUserCancelled CancelReason = "user_cancelled"
	// CancelReasonExpired é gravado por Repository.ExpireStaleOrders (O.2,
	// fechamento do dia simulado — modalidade Day).
	CancelReasonExpired CancelReason = "expired"
	// CancelReasonNoLiquidity é gravado por insertIncomingOrder quando uma
	// ordem a mercado não acha nenhuma contraparte real (RF04, tarefa A.2) —
	// nunca fica pendurada, nasce já cancelada.
	CancelReasonNoLiquidity CancelReason = "no_liquidity"
	// CancelReasonRequoted é gravado por Repository.CancelUserRestingOrders
	// (achado 005 parte A.4) — só o bot market_maker recotando a própria
	// oferta anterior, nunca aparece pra um usuário real.
	CancelReasonRequoted CancelReason = "requoted"
	// CancelReasonInsufficientFunds é gravado quando o match encontra uma ordem em
	// repouso cujo dono já não tem saldo (compra) ou posição (venda) para
	// honrá-la (achado 015): a ordem é pulada e cancelada em vez de travar o book
	// ou levar o dono a saldo negativo.
	CancelReasonInsufficientFunds CancelReason = "insufficient_funds"
)

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
	// Owner é o saldo e a posição (neste ativo) do dono, lidos junto do book.
	// nil = não conhecido, e Execute não revalida esta ordem.
	Owner *OwnerHoldings
}

// OwnerHoldings é o que o dono de uma ordem em repouso pode honrar agora. Como
// nada é reservado na submissão (achado 015), Execute confere isso no match.
type OwnerHoldings struct {
	Balance  float64
	Position int
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
	// SimulatedDay é o dia simulado corrente (market_calendar.current_day,
	// achado 005 parte A, pontos-em-aberto-decisao-produto.md) no momento em
	// que o contexto foi carregado — repassado por Service.SubmitWithContext
	// pra Request.SimulatedDay antes de persistir, pra toda ordem nova
	// carregar o dia em que nasceu (ExpireStaleOrders, tick.Service.Run, usa
	// isso pra cancelar ordens de dias anteriores antes de cada novo dia
	// simulado, em vez de acumular indefinidamente em order_book). Repository.
	// LoadContext lê market_calendar direto (0 quando o Temporizador nunca
	// rodou) — mesmo valor, por construção, que dayIndex assume dentro do
	// próprio tick que está gerando o dia novo (tick.Service.Run: dayIndex =
	// result.State.Day - 1 = current.Day, o mesmo current_day que
	// market_calendar ainda não teve tempo de atualizar até SaveTick
	// commitar), então ordem de bot (dentro do tick) e ordem humana (entre
	// ticks) sempre carimbam o mesmo dia lógico sem precisar de dois
	// caminhos de leitura diferentes.
	SimulatedDay int
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
	// OrderID é preenchido por Service.SubmitWithContext a partir do id que
	// Repository.Persist devolve (tarefa O.3, achado 012 — antes desta
	// tarefa POST /orders nunca ecoava o id da linha recém-criada em
	// order_book, então POST /orders/{id}/cancel não tinha nenhum caminho
	// real pelo qual um cliente descobrisse qual id passar). Vazio se
	// Execute rejeitou a ordem (nada foi persistido).
	OrderID           string
	Fills             []Fill
	FilledQuantity    int
	RemainingQuantity int
	// InvalidRestingOrderIDs são as ordens em repouso puladas no match porque o
	// dono não tem saldo/posição para honrá-las (achado 015); Persist as cancela
	// com CancelReasonInsufficientFunds.
	InvalidRestingOrderIDs []string
}

// OrderRecord é uma linha de order_book do usuário, devolvida por
// Repository.ListOrders (tarefa O.3, GET /orders) — mais recente primeiro,
// sem paginação (escopo de protótipo). CancelReason é nil pra qualquer
// status diferente de cancelled.
type OrderRecord struct {
	ID             string
	AssetID        string
	Side           orderbook.Side
	Type           orderbook.Type
	Quantity       int
	FilledQuantity int
	Price          float64
	Status         string
	CancelReason   *CancelReason
	CreatedAt      time.Time
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

	trades, invalidIDs, restingUserByOrderID := matchAgainstResting(incoming, ctx.Resting)

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

	return Outcome{Fills: fills, FilledQuantity: filled, RemainingQuantity: remaining, InvalidRestingOrderIDs: invalidIDs}, nil
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
		var totalSold int
		for _, f := range fills {
			totalSold += f.Quantity
		}
		if totalSold > ctx.IncomingUserPosition {
			return ErrInsufficientPosition
		}
	}
	return nil
}

// fundsEpsilon absorve o erro de ponto flutuante ao comparar custo acumulado com saldo.
const fundsEpsilon = 1e-6

// matchAgainstResting reconstrói o book (replay) e submete a ordem recebida. Como
// ordem em repouso não reserva saldo nem posição, revalida o dono de cada
// contraparte pelo que ele já teria de pagar/entregar nesta mesma execução: se não
// pode honrar, a ordem é excluída do book e o match roda de novo (achado 015).
// Devolve os trades, os IDs excluídos e o dono de cada ordem em repouso.
func matchAgainstResting(incoming orderbook.Order, resting []RestingOrder) ([]orderbook.Trade, []string, map[string]string) {
	ownerByOrderID := make(map[string]string, len(resting))
	holdingsByOrderID := make(map[string]*OwnerHoldings, len(resting))
	for _, r := range resting {
		ownerByOrderID[r.ID] = r.UserID
		holdingsByOrderID[r.ID] = r.Owner
	}

	excluded := map[string]bool{}
	var invalid []string
	for {
		var book orderbook.Book
		for _, r := range resting {
			if excluded[r.ID] {
				continue
			}
			book.Submit(orderbook.Order{ID: r.ID, UserID: r.UserID, Side: r.Side, Type: r.Type, Price: r.Price, Quantity: r.RemainingQuantity})
		}
		trades := book.Submit(incoming)

		bad := firstUnaffordableTrade(incoming.Side, trades, ownerByOrderID, holdingsByOrderID)
		if bad == "" {
			return trades, invalid, ownerByOrderID
		}
		excluded[bad] = true
		invalid = append(invalid, bad)
	}
}

// firstUnaffordableTrade devolve a ordem em repouso do primeiro trade que o dono
// não consegue honrar, somando o que ele já deve nos trades anteriores (um dono
// pode ter várias ordens em repouso no mesmo book). "" se todos podem.
func firstUnaffordableTrade(incomingSide orderbook.Side, trades []orderbook.Trade, ownerByOrderID map[string]string, holdings map[string]*OwnerHoldings) string {
	spent := map[string]float64{}
	delivered := map[string]int{}
	for _, trade := range trades {
		orderID := trade.SellOrderID
		if incomingSide == orderbook.SideSell {
			orderID = trade.BuyOrderID
		}
		h := holdings[orderID]
		if h == nil {
			continue
		}
		owner := ownerByOrderID[orderID]
		if incomingSide == orderbook.SideSell {
			// A contraparte compra: paga com o saldo.
			spent[owner] += trade.Price * float64(trade.Quantity)
			if spent[owner] > h.Balance+fundsEpsilon {
				return orderID
			}
		} else {
			// A contraparte vende: entrega da posição.
			delivered[owner] += trade.Quantity
			if delivered[owner] > h.Position {
				return orderID
			}
		}
	}
	return ""
}
