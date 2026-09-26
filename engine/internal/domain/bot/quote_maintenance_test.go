package bot

import (
	"errors"
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

func TestNeedsRequote(t *testing.T) {
	const bid, ask, tol, min = 99.0, 101.0, 0.005, 100
	buy := func(price float64, remaining int) RestingQuote {
		return RestingQuote{Side: orderbook.SideBuy, Price: price, RemainingQuantity: remaining}
	}
	sell := func(price float64, remaining int) RestingQuote {
		return RestingQuote{Side: orderbook.SideSell, Price: price, RemainingQuantity: remaining}
	}

	tests := []struct {
		name     string
		resting  []RestingQuote
		wantBuy  bool
		wantSell bool
	}{
		{"cotação boa nos dois lados", []RestingQuote{buy(99, 500), sell(101, 500)}, false, false},
		{"dentro da tolerância", []RestingQuote{buy(99.4, 500), sell(100.6, 500)}, false, false},
		{"sem nenhuma ordem", nil, true, true},
		{"lado de compra consumido", []RestingQuote{sell(101, 500)}, true, false},
		{"lado de venda consumido", []RestingQuote{buy(99, 500)}, false, true},
		{"compra fora da tolerância", []RestingQuote{buy(98, 500), sell(101, 500)}, true, false},
		{"venda fora da tolerância", []RestingQuote{buy(99, 500), sell(103, 500)}, false, true},
		{"quantidade restante abaixo do mínimo", []RestingQuote{buy(99, 50), sell(101, 500)}, true, false},
		{"quantidade no mínimo exato é boa", []RestingQuote{buy(99, 100), sell(101, 100)}, false, false},
		{"duas ordens do lado somam a quantidade", []RestingQuote{buy(99, 60), buy(99, 60), sell(101, 500)}, false, false},
		{"uma ordem fora da tolerância invalida o lado", []RestingQuote{buy(99, 500), buy(90, 500), sell(101, 500)}, true, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotBuy, gotSell := NeedsRequote(tt.resting, bid, ask, tol, min)
			if gotBuy != tt.wantBuy || gotSell != tt.wantSell {
				t.Errorf("NeedsRequote() = (%v, %v), want (%v, %v)", gotBuy, gotSell, tt.wantBuy, tt.wantSell)
			}
		})
	}
}

func TestMarketMakerQuotePrices(t *testing.T) {
	mm := mustMarketMakerPersonality(t, 0.02, 0.5)
	bid, ask, err := MarketMakerQuotePrices(mm, 100)
	if err != nil || math.Abs(bid-99) > 1e-9 || math.Abs(ask-101) > 1e-9 {
		t.Errorf("MarketMakerQuotePrices = (%v, %v, %v), want (99, 101, nil)", bid, ask, err)
	}
	if _, _, err := MarketMakerQuotePrices(mm, 0); !errors.Is(err, ErrInvalidReferencePrice) {
		t.Errorf("preço 0: err = %v", err)
	}
	wide := mustMarketMakerPersonality(t, 0.02, 0.5)
	wide.RiskProfile.SpreadWidthPct = 2
	if _, _, err := MarketMakerQuotePrices(wide, 100); !errors.Is(err, ErrInvalidSpreadForQuote) {
		t.Errorf("spread 2: err = %v", err)
	}
}

// Os preços de MarketMakerQuotePrices são os mesmos de DecideMarketMakerOrders.
func TestMarketMakerQuotePrices_CoincideComDecide(t *testing.T) {
	mm := mustMarketMakerPersonality(t, 0.04, 0.5)
	bid, ask, _ := MarketMakerQuotePrices(mm, 50)
	decisions, err := DecideMarketMakerOrders(mm, 50, 100_000, 1_000, nil, 0)
	if err != nil || len(decisions) != 2 {
		t.Fatalf("decisions = %v, %v", decisions, err)
	}
	if decisions[0].Price != bid || decisions[1].Price != ask {
		t.Errorf("preços divergem: decide (%v, %v) vs ideal (%v, %v)", decisions[0].Price, decisions[1].Price, bid, ask)
	}
}

func TestEffectiveQuoteTolerance(t *testing.T) {
	if got := EffectiveQuoteTolerance(0.02); got != QuoteTolerancePct {
		t.Errorf("spread 2%%: tolerância = %v, want %v (teto)", got, QuoteTolerancePct)
	}
	if got := EffectiveQuoteTolerance(0.004); math.Abs(got-0.001) > 1e-12 {
		t.Errorf("spread 0,4%%: tolerância = %v, want 0.001 (spread/4)", got)
	}
}

// Com a tolerância efetiva, o lado mantido nunca cruza o preço ideal do outro
// lado: o Market Maker não negocia contra a própria cotação.
func TestEffectiveQuoteTolerance_LadoMantidoNaoCruzaOOutro(t *testing.T) {
	for _, spread := range []float64{0.002, 0.01, 0.02, 0.1, 1.5} {
		tol := EffectiveQuoteTolerance(spread)
		ref := 100.0
		bid, ask := ref*(1-spread/2), ref*(1+spread/2)
		worstKeptAsk := ask * (1 - tol)
		worstKeptBid := bid * (1 + tol)
		if worstKeptAsk <= bid || worstKeptBid >= ask {
			t.Errorf("spread %v: lado mantido cruza o outro (ask mantido %v vs bid %v; bid mantido %v vs ask %v)", spread, worstKeptAsk, bid, worstKeptBid, ask)
		}
	}
}

// Uma cotação recém-criada com o piso de quantidade nunca é considerada vencida:
// a manutenção não a refaz na rodada seguinte (regressão do erro achado na
// medição da P.4, em que o mínimo era maior que o tamanho da própria cotação).
func TestNeedsRequote_CotacaoRecemCriadaComPisoNaoVenceImediatamente(t *testing.T) {
	mm := mustMarketMakerPersonality(t, 0.02, 0.5)
	const floor = 400_000
	ceiling := int64(floor) // teto de ordem no piso: o pior caso
	decisions, err := DecideMarketMakerOrders(mm, 100, 1e12, 10_000_000, &ceiling, floor)
	if err != nil || len(decisions) != 2 {
		t.Fatalf("decisions = %v, %v", decisions, err)
	}
	var resting []RestingQuote
	for _, d := range decisions {
		if d.Quantity < floor {
			t.Errorf("cotação de %d abaixo do piso %d", d.Quantity, floor)
		}
		resting = append(resting, RestingQuote{Side: d.Side, Price: d.Price, RemainingQuantity: d.Quantity})
	}
	bid, ask, _ := MarketMakerQuotePrices(mm, 100)
	if buy, sell := NeedsRequote(resting, bid, ask, EffectiveQuoteTolerance(0.02), floor); buy || sell {
		t.Errorf("cotação recém-criada julgada vencida: requoteBuy=%v requoteSell=%v", buy, sell)
	}
}
