package httpserver

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"testing"

	"tcc-investimentos/engine/internal/domain/adminview"
)

func TestAdminMarketRoutes_Respondem503SemLeitor(t *testing.T) {
	for _, path := range []string{"/admin/market/assets", "/admin/market/assets/" + validAssetID} {
		if rec := callAdminReader(t, nil, path); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("GET %s sem leitor = %d, want 503", path, rec.Code)
		}
	}
}

func TestAdminMarketRoutes_Respondem500NoErroDoLeitor(t *testing.T) {
	reader := &fakeAdminReader{err: errors.New("banco caiu")}
	for _, path := range []string{"/admin/market/assets", "/admin/market/assets/" + validAssetID} {
		if rec := callAdminReader(t, reader, path); rec.Code != http.StatusInternalServerError {
			t.Errorf("GET %s com erro = %d, want 500", path, rec.Code)
		}
	}
}

func TestAdminMarketAssets_CalculaSpreadVariacaoEIndicador(t *testing.T) {
	last, prev, bid, ask := 11.0, 10.0, 9.9, 10.1
	reader := &fakeAdminReader{assets: []adminview.AssetRow{
		{AssetID: "a", Ticker: "ACME3", Type: "acao", LastPrice: &last, PreviousPrice: &prev, BestBid: &bid, BestAsk: &ask,
			Indicator: &adminview.Indicator{Kind: adminview.IndicatorPriceToEarnings, Value: 8.5}},
		{AssetID: "b", Ticker: "SEMNEG3", Type: "acao"},
	}}
	rec := callAdminReader(t, reader, "/admin/market/assets")
	var got struct {
		Assets []map[string]any `json:"assets"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Assets) != 2 {
		t.Fatalf("len = %d, want 2", len(got.Assets))
	}
	first := got.Assets[0]
	change, _ := first["daily_change_pct"].(float64)
	spread, _ := first["spread_pct"].(float64)
	if math.Abs(change-10) > 1e-9 || math.Abs(spread-2) > 1e-9 {
		t.Errorf("variação/spread = %v/%v, want 10/2", first["daily_change_pct"], first["spread_pct"])
	}
	if ind, _ := first["indicator"].(map[string]any); ind["kind"] != "price_to_earnings" || ind["value"] != 8.5 {
		t.Errorf("indicator = %v", first["indicator"])
	}
	// Ativo sem negócio aparece sem quebrar, com os campos nulos.
	second := got.Assets[1]
	for _, k := range []string{"last_price", "daily_change_pct", "best_bid", "best_ask", "spread_pct", "indicator"} {
		if second[k] != nil {
			t.Errorf("%s = %v, want null", k, second[k])
		}
	}
}

func TestAdminMarketAssetDetail(t *testing.T) {
	t.Run("id inválido é 400", func(t *testing.T) {
		if rec := callAdminReader(t, &fakeAdminReader{}, "/admin/market/assets/nao-uuid"); rec.Code != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", rec.Code)
		}
	})
	t.Run("ativo inexistente é 404", func(t *testing.T) {
		rec := callAdminReader(t, &fakeAdminReader{err: adminview.ErrAssetNotFound}, "/admin/market/assets/"+validAssetID)
		if rec.Code != http.StatusNotFound {
			t.Errorf("status = %d, want 404", rec.Code)
		}
	})
	t.Run("devolve book, negócios e séries", func(t *testing.T) {
		reader := &fakeAdminReader{detail: adminview.AssetDetail{
			Row:        adminview.AssetRow{AssetID: validAssetID, Ticker: "ETFX11", Type: "etf"},
			Bids:       []adminview.BookLevel{{Price: 9.9, Quantity: 100, BotQuantity: 60}},
			Asks:       []adminview.BookLevel{{Price: 10.1, Quantity: 50, BotQuantity: 50}},
			Trades:     []adminview.Trade{{SimulatedDay: 5, Price: 10, Quantity: 10, BuyerIsBot: true}},
			Quotes:     []adminview.QuotePoint{{SimulatedDay: 4, Price: 9.8}},
			NAVHistory: []adminview.NAVPoint{{SimulatedDay: 4, NAV: 9.9, ClosePrice: 9.8, PremiumPct: -1}},
		}}
		rec := callAdminReader(t, reader, "/admin/market/assets/"+validAssetID)
		if rec.Code != http.StatusOK || reader.askedID != validAssetID {
			t.Fatalf("status = %d, askedID = %q", rec.Code, reader.askedID)
		}
		var got map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		for _, k := range []string{"bids", "asks", "trades", "quotes", "nav_history"} {
			if list, _ := got[k].([]any); len(list) != 1 {
				t.Errorf("%s = %v, want 1 item", k, got[k])
			}
		}
		if got["ticker"] != "ETFX11" {
			t.Errorf("ticker = %v", got["ticker"])
		}
	})
}
