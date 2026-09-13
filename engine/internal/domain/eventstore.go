package domain

import (
	"context"
	"time"
)

// MarketEventType espelha o enum Postgres market_event_type (migration
// 000001) — mantido aqui como constantes tipadas pra evitar strings soltas
// espalhadas pelo domínio e detectar divergência em tempo de compilação.
type MarketEventType string

const (
	EventInitialDeposit        MarketEventType = "initial_deposit"
	EventBuyOrderExecuted      MarketEventType = "buy_order_executed"
	EventSellOrderExecuted     MarketEventType = "sell_order_executed"
	EventFixedIncomePurchase   MarketEventType = "fixed_income_purchase"
	EventFixedIncomeRedemption MarketEventType = "fixed_income_redemption"
	EventDividendPayment       MarketEventType = "dividend_payment"
	// EventBotInitialAllocation é o float finito de um ativo nascendo
	// distribuído entre bots no seed (tarefa B.2, migration 000013) — não é
	// uma ordem executada (sem contraparte real), por isso não reaproveita
	// EventBuyOrderExecuted.
	EventBotInitialAllocation MarketEventType = "bot_initial_allocation"
)

// MarketEvent é um registro imutável de uma operação financeira — a fonte
// da verdade de Event Sourcing (RNF01, spec 3.4, CLAUDE.md). AssetID,
// Quantity e UnitValue são opcionais porque nem todo evento tem os três
// (ex: initial_deposit não tem asset nem quantidade).
type MarketEvent struct {
	UserID    string
	AssetID   *string
	EventType MarketEventType
	Quantity  *int
	UnitValue *float64
}

// MarketEventRecord é um MarketEvent já persistido — ID e Timestamp só
// existem depois da escrita (mesmo raciocínio de catalog.AssetRecord),
// usado pelo extrato de leitura (GET /accounts/:user_id/events, tarefa 4.7,
// RF05). EventStore.Append nunca precisa desses dois campos, por isso não
// fazem parte de MarketEvent.
type MarketEventRecord struct {
	ID string
	MarketEvent
	Timestamp time.Time
}

// EventStore grava eventos imutáveis em market_events. Toda escrita de
// saldo/posição no motor deve gravar o evento correspondente antes de
// projetar o estado — nunca escrever direto em accounts/positions sem
// passar por aqui (CLAUDE.md).
type EventStore interface {
	Append(ctx context.Context, event MarketEvent) error
}
