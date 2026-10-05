package adminview

import (
	"errors"
	"time"
)

// Desempenho e atividade dos bots (tarefa N.14). Só leitura: todo número sai de
// order_book, market_events e asset_quotes, nunca de uma tabela paralela.

// Janelas de GET /admin/bots/{id}/activity e /summary, em dias simulados.
const (
	DefaultActivityDays = 30
	MaxActivityDays     = 365
	// DefaultIdleDays é o "há N dias sem ordem" que classifica um bot ativo como parado.
	DefaultIdleDays = 3
	MaxIdleDays     = 90
	// LowCashRatio é a fração do capital aportado abaixo da qual o caixa de um bot ativo
	// conta como esgotado. Valor ilustrativo (sem fonte real): só separa "quase sem
	// caixa" de "caixa normal" pra acender o alerta.
	LowCashRatio = 0.01
)

// ErrBotNotFound é devolvido quando o id não é de uma conta de bot.
var ErrBotNotFound = errors.New("bot não encontrado")

// OrderCounts conta as ordens enviadas pelo bot na janela, por situação.
type OrderCounts struct {
	Sent            int
	Filled          int
	PartiallyFilled int
	Open            int
	Cancelled       int
	// CancelledByReason é o recorte de Cancelled por order_cancel_reason.
	CancelledByReason map[string]int
	// Quantity e FilledQuantity são a soma das quantidades enviadas e executadas, base
	// da taxa de fill.
	Quantity       int64
	FilledQuantity int64
}

// MarketMakerQuote é a cotação atual de um Market Maker num ativo que ele cobre:
// melhor compra e venda dele no book (só as ordens dele), spread e o inventário
// frente ao que foi provisionado.
type MarketMakerQuote struct {
	AssetID string
	Ticker  string
	BestBid *float64
	BestAsk *float64
	// HeldQuantity é a posição atual; TargetQuantity, a soma das alocações iniciais
	// gravadas em market_events (o "alvo" que o provisionamento deu).
	HeldQuantity   int64
	TargetQuantity int64
}

// BotActivity é o desempenho de um bot numa janela de dias simulados.
type BotActivity struct {
	AccountID  string
	Archetype  string
	IsActive   bool
	FromDay    int
	ToDay      int
	PeriodDays int

	Cash          float64
	HoldingsValue float64
	// CapitalContributed é tudo que entrou no bot por evento de alocação (caixa e
	// posição iniciais e aportes), a base do P&L.
	CapitalContributed float64

	Orders       OrderCounts
	Trades       int
	Volume       float64
	LastOrderAt  *time.Time
	LastOrderDay *int

	// Quotes só vem preenchido pro Market Maker.
	Quotes []MarketMakerQuote
}

// NetWorth é o patrimônio do bot: caixa mais posições a mercado.
func (a BotActivity) NetWorth() float64 { return a.Cash + a.HoldingsValue }

// PnL é o patrimônio menos o capital que entrou nele.
func (a BotActivity) PnL() float64 { return a.NetWorth() - a.CapitalContributed }

// PnLPct é o P&L sobre o capital aportado, em %. nil sem capital.
func (a BotActivity) PnLPct() *float64 {
	if a.CapitalContributed <= 0 {
		return nil
	}
	pct := a.PnL() / a.CapitalContributed * 100
	return &pct
}

// FillRatePct é a quantidade executada sobre a enviada, em %. nil sem ordens.
func (o OrderCounts) FillRatePct() *float64 {
	if o.Quantity <= 0 {
		return nil
	}
	pct := float64(o.FilledQuantity) / float64(o.Quantity) * 100
	return &pct
}

// SpreadPct é o spread da cotação do Market Maker; nil sem os dois lados.
func (q MarketMakerQuote) SpreadPct() *float64 { return SpreadPct(q.BestBid, q.BestAsk) }

// InventoryPct é a posição atual sobre o alvo provisionado, em %. nil sem alvo.
func (q MarketMakerQuote) InventoryPct() *float64 {
	if q.TargetQuantity <= 0 {
		return nil
	}
	pct := float64(q.HeldQuantity) / float64(q.TargetQuantity) * 100
	return &pct
}

// IsLowCash diz se o caixa está abaixo de LowCashRatio do capital aportado. Bot sem
// capital registrado nunca conta como esgotado (não há base pra comparar).
func IsLowCash(cash, capital float64) bool {
	return capital > 0 && cash < capital*LowCashRatio
}

// NormalizeDays aplica o padrão e o teto de uma janela em dias.
func NormalizeDays(days, def, max int) int {
	if days <= 0 {
		return def
	}
	if days > max {
		return max
	}
	return days
}

// IdleBot é um bot ativo sem ordem na janela de parados. LastOrderDay é nil se ele
// nunca enviou uma.
type IdleBot struct {
	AccountID    string
	Archetype    string
	LastOrderDay *int
}

// LowCashBot é um bot ativo com o caixa esgotado.
type LowCashBot struct {
	AccountID string
	Archetype string
	Cash      float64
	Capital   float64
}

// EmptyInventory é um Market Maker ativo sem nenhuma ação de um ativo que cobre:
// sem posição, ele não consegue cotar a venda.
type EmptyInventory struct {
	AccountID string
	AssetID   string
	Ticker    string
}

// AssetLiquidity diz quem provê a liquidez em repouso de um ativo: a quantidade
// ainda aberta nas ordens a limite, por arquétipo de bot (e "usuario").
type AssetLiquidity struct {
	AssetID           string
	Ticker            string
	RestingByProvider map[string]int64
}

// FloatConcentration é o quanto do float de um ativo está na mão do maior bot
// detentor e de todos os bots juntos, em % das cotas em circulação.
type FloatConcentration struct {
	AssetID          string
	Ticker           string
	TopBotID         string
	TopBotArchetype  string
	TopBotPct        float64
	AllBotsPct       float64
	OutstandingShare int64
}

// BotsSummary é a visão agregada de GET /admin/bots/summary.
type BotsSummary struct {
	SimulatedDay    int
	IdleDays        int
	IdleBots        []IdleBot
	LowCashBots     []LowCashBot
	EmptyInventory  []EmptyInventory
	Liquidity       []AssetLiquidity
	Concentration   []FloatConcentration
	ActiveBotsCount int
}
