package httpserver

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"tcc-investimentos/engine/internal/domain/adminview"
)

const botActivityID = "00000000-0000-0000-0001-000000000001"

func TestAdminBotActivity_DevolveDesempenhoComCamposDerivados(t *testing.T) {
	bid, ask := 9.9, 10.1
	reader := &fakeAdminReader{activity: adminview.BotActivity{
		AccountID: botActivityID, Archetype: "market_maker", IsActive: true, FromDay: 1, ToDay: 30, PeriodDays: 30,
		Cash: 600, HoldingsValue: 500, CapitalContributed: 1000,
		Orders: adminview.OrderCounts{Sent: 4, Filled: 1, Open: 2, Cancelled: 1, Quantity: 200, FilledQuantity: 50,
			CancelledByReason: map[string]int{"requoted": 1}},
		Quotes: []adminview.MarketMakerQuote{{AssetID: "a", Ticker: "ACME3", BestBid: &bid, BestAsk: &ask, HeldQuantity: 30, TargetQuantity: 120}},
	}}
	rec := callAdminReader(t, reader, "/admin/bots/"+botActivityID+"/activity?days=7")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body.String())
	}
	if reader.askedID != botActivityID || reader.days != 7 {
		t.Errorf("repassou id %q days %d", reader.askedID, reader.days)
	}
	var got botActivityResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.NetWorth != 1100 || got.PnL != 100 || got.PnLPct == nil || *got.PnLPct != 10 {
		t.Errorf("patrimônio %v P&L %v (%v%%)", got.NetWorth, got.PnL, got.PnLPct)
	}
	if got.Orders.FillRatePct == nil || *got.Orders.FillRatePct != 25 || got.Orders.CancelledByReason["requoted"] != 1 {
		t.Errorf("ordens = %+v", got.Orders)
	}
	if len(got.Quotes) != 1 || got.Quotes[0].SpreadPct == nil || got.Quotes[0].InventoryPct == nil || *got.Quotes[0].InventoryPct != 25 {
		t.Errorf("cotações = %+v", got.Quotes)
	}
}

func TestAdminBotActivity_Recusas(t *testing.T) {
	tests := []struct {
		name   string
		reader adminReader
		path   string
		want   int
	}{
		{"sem leitor", nil, "/admin/bots/" + botActivityID + "/activity", http.StatusServiceUnavailable},
		{"id inválido", &fakeAdminReader{}, "/admin/bots/nao-uuid/activity", http.StatusBadRequest},
		{"dias inválidos", &fakeAdminReader{}, "/admin/bots/" + botActivityID + "/activity?days=0", http.StatusBadRequest},
		{"bot inexistente", &fakeAdminReader{err: adminview.ErrBotNotFound}, "/admin/bots/" + botActivityID + "/activity", http.StatusNotFound},
		{"falha de leitura", &fakeAdminReader{err: errors.New("boom")}, "/admin/bots/" + botActivityID + "/activity", http.StatusInternalServerError},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if rec := callAdminReader(t, tt.reader, tt.path); rec.Code != tt.want {
				t.Errorf("status = %d, want %d", rec.Code, tt.want)
			}
		})
	}
}

func TestAdminBotsSummary_DevolveAsListasSemNull(t *testing.T) {
	reader := &fakeAdminReader{summary: adminview.BotsSummary{
		SimulatedDay: 12, IdleDays: 3, ActiveBotsCount: 5,
		IdleBots: []adminview.IdleBot{{AccountID: "x", Archetype: "ruido"}},
	}}
	rec := callAdminReader(t, reader, "/admin/bots/summary?idle_days=3")
	if rec.Code != http.StatusOK || reader.days != 3 {
		t.Fatalf("status = %d days = %d", rec.Code, reader.days)
	}
	var got map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"idle_bots", "low_cash_bots", "empty_inventory", "liquidity", "float_concentration"} {
		if string(got[key]) == "null" || got[key] == nil {
			t.Errorf("%s deveria ser lista, veio %s", key, got[key])
		}
	}
	if rec := callAdminReader(t, &fakeAdminReader{}, "/admin/bots/summary?idle_days=abc"); rec.Code != http.StatusBadRequest {
		t.Errorf("idle_days inválido: status = %d", rec.Code)
	}
	if rec := callAdminReader(t, nil, "/admin/bots/summary"); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("sem leitor: status = %d", rec.Code)
	}
}
