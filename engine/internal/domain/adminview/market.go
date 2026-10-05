package adminview

import (
	"errors"

	"tcc-investimentos/engine/internal/domain/fundamentals"
)

// ErrAssetNotFound é devolvido quando o id não é um ativo negociável (ação, ETF ou
// FII que não seja sandbox).
var ErrAssetNotFound = errors.New("ativo não encontrado")

// IndicatorKind identifica o indicador que importa pra classe do ativo (RF21).
type IndicatorKind string

const (
	IndicatorPriceToEarnings IndicatorKind = "price_to_earnings" // ação
	IndicatorNAVPremium      IndicatorKind = "nav_premium_pct"   // ETF: ágio/deságio sobre o NAV, em %
	IndicatorPriceToBook     IndicatorKind = "price_to_book"     // FII: cotação sobre valor patrimonial por cota
)

// Indicator é o número de destaque de uma linha do monitor.
type Indicator struct {
	Kind  IndicatorKind
	Value float64
}

// AssetRow é uma linha do monitor de mercado.
type AssetRow struct {
	AssetID           string
	Ticker            string
	Name              string
	Type              string
	Sector            *string
	LastPrice         *float64
	PreviousPrice     *float64
	BestBid           *float64
	BestAsk           *float64
	RestingOrders     int
	BotRestingOrders  int
	DayTrades         int
	DayVolume         int
	OutstandingShares *int64
	HeldByBots        int64
	HeldByUsers       int64
	Covered           bool
	Indicator         *Indicator
}

// IndicatorInputs são os insumos crus que cada classe usa pro seu indicador.
type IndicatorInputs struct {
	Type              string
	Price             *float64
	OutstandingShares *int64
	NetIncome         *float64 // ação: lucro líquido do último relatório
	NAVPremiumPct     *float64 // ETF: ágio do último NAV gravado
	BookValue         *float64 // FII: valor patrimonial (tijolo) ou da carteira (papel)
}

// ClassIndicator escolhe e calcula o indicador da classe; nil quando falta insumo
// (ativo sem cotação, sem cotas, sem relatório ou sem NAV).
func ClassIndicator(in IndicatorInputs) *Indicator {
	switch in.Type {
	case "acao":
		if in.Price == nil || in.NetIncome == nil || in.OutstandingShares == nil {
			return nil
		}
		lpa, ok := fundamentals.LPA(*in.NetIncome, *in.OutstandingShares)
		if !ok {
			return nil
		}
		pl, ok := fundamentals.PriceToEarnings(*in.Price, lpa)
		if !ok {
			return nil
		}
		return &Indicator{Kind: IndicatorPriceToEarnings, Value: pl}
	case "etf":
		if in.NAVPremiumPct == nil {
			return nil
		}
		return &Indicator{Kind: IndicatorNAVPremium, Value: *in.NAVPremiumPct}
	case "fii":
		if in.Price == nil || in.BookValue == nil || in.OutstandingShares == nil || *in.OutstandingShares <= 0 {
			return nil
		}
		pvp, ok := fundamentals.PriceToBookValue(*in.Price, *in.BookValue/float64(*in.OutstandingShares))
		if !ok {
			return nil
		}
		return &Indicator{Kind: IndicatorPriceToBook, Value: pvp}
	}
	return nil
}

// SpreadPct é o spread relativo ao ponto médio do book, em %. nil sem os dois
// lados ou com book cruzado/zerado (que não deveria existir em repouso).
func SpreadPct(bid, ask *float64) *float64 {
	if bid == nil || ask == nil || *bid <= 0 || *ask < *bid {
		return nil
	}
	mid := (*bid + *ask) / 2
	spread := (*ask - *bid) / mid * 100
	return &spread
}

// DailyChangePct é a variação percentual do último preço contra o anterior.
func DailyChangePct(last, previous *float64) *float64 {
	if last == nil || previous == nil || *previous <= 0 {
		return nil
	}
	change := (*last - *previous) / *previous * 100
	return &change
}

// BookLevel é um nível de preço do book completo, com a parcela da quantidade
// que pertence a bots (o painel distingue liquidez de bot da de usuário).
type BookLevel struct {
	Price       float64
	Quantity    int
	BotQuantity int
}

// Trade é um negócio recente do ativo. BuyerIsBot diz de que lado veio o comprador.
type Trade struct {
	SimulatedDay int
	Price        float64
	Quantity     int
	BuyerIsBot   bool
}

// QuotePoint é um fechamento diário.
type QuotePoint struct {
	SimulatedDay int
	Price        float64
}

// NAVPoint é um ponto da série de NAV de um ETF.
type NAVPoint struct {
	SimulatedDay int
	NAV          float64
	ClosePrice   float64
	PremiumPct   float64
}

// AssetDetail é o detalhe de um ativo no monitor: o book inteiro (bids do maior
// pro menor preço, asks do menor pro maior), negócios recentes e séries.
type AssetDetail struct {
	Row        AssetRow
	Bids       []BookLevel
	Asks       []BookLevel
	Trades     []Trade
	Quotes     []QuotePoint
	NAVHistory []NAVPoint
}
