package adminview

import "testing"

func TestBotActivity_PatrimonioEPnL(t *testing.T) {
	tests := []struct {
		name                           string
		cash, holdings, capital        float64
		wantNetWorth, wantPnL, wantPct float64
		wantPctNil                     bool
	}{
		{"lucro", 600, 500, 1000, 1100, 100, 10, false},
		{"prejuizo", 300, 500, 1000, 800, -200, -20, false},
		{"sem capital", 100, 0, 0, 100, 100, 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := BotActivity{Cash: tt.cash, HoldingsValue: tt.holdings, CapitalContributed: tt.capital}
			if !approx(a.NetWorth(), tt.wantNetWorth) || !approx(a.PnL(), tt.wantPnL) {
				t.Fatalf("patrimônio = %v, P&L = %v", a.NetWorth(), a.PnL())
			}
			pct := a.PnLPct()
			if tt.wantPctNil != (pct == nil) || (pct != nil && !approx(*pct, tt.wantPct)) {
				t.Fatalf("P&L %% = %v", pct)
			}
		})
	}
}

func TestOrderCounts_FillRatePct(t *testing.T) {
	if (OrderCounts{}).FillRatePct() != nil {
		t.Fatal("sem ordens deveria ser nil")
	}
	pct := OrderCounts{Quantity: 200, FilledQuantity: 50}.FillRatePct()
	if pct == nil || !approx(*pct, 25) {
		t.Fatalf("taxa = %v", pct)
	}
}

func TestMarketMakerQuote_SpreadEInventario(t *testing.T) {
	bid, ask := 9.9, 10.1
	q := MarketMakerQuote{BestBid: &bid, BestAsk: &ask, HeldQuantity: 30, TargetQuantity: 120}
	if s := q.SpreadPct(); s == nil || !approx(*s, 2) {
		t.Fatalf("spread = %v", s)
	}
	if inv := q.InventoryPct(); inv == nil || !approx(*inv, 25) {
		t.Fatalf("inventário = %v", inv)
	}
	if (MarketMakerQuote{HeldQuantity: 5}).InventoryPct() != nil {
		t.Fatal("sem alvo deveria ser nil")
	}
	if (MarketMakerQuote{BestBid: &bid}).SpreadPct() != nil {
		t.Fatal("sem um dos lados deveria ser nil")
	}
}

func TestIsLowCash(t *testing.T) {
	tests := []struct {
		cash, capital float64
		want          bool
	}{
		{5, 1000, true},
		{10, 1000, false},
		{0, 1000, true},
		{0, 0, false},
	}
	for _, tt := range tests {
		if got := IsLowCash(tt.cash, tt.capital); got != tt.want {
			t.Errorf("IsLowCash(%v, %v) = %v", tt.cash, tt.capital, got)
		}
	}
}

func TestNormalizeDays(t *testing.T) {
	tests := []struct{ in, want int }{{0, 30}, {-4, 30}, {7, 7}, {999, 365}}
	for _, tt := range tests {
		if got := NormalizeDays(tt.in, DefaultActivityDays, MaxActivityDays); got != tt.want {
			t.Errorf("NormalizeDays(%d) = %d", tt.in, got)
		}
	}
}
