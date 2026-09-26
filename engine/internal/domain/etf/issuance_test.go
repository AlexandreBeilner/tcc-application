package etf

import (
	"errors"
	"math"
	"reflect"
	"testing"
)

func twoAssets() []WeightedConstituent {
	return []WeightedConstituent{
		{AssetID: "b", WeightPct: 40, Price: 20},
		{AssetID: "a", WeightPct: 60, Price: 50},
	}
}

func TestInitialTargetBasket(t *testing.T) {
	got, err := InitialTargetBasket(twoAssets(), 1_000_000)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	want := []BasketLeg{{AssetID: "a", Quantity: 12000, Price: 50}, {AssetID: "b", Quantity: 20000, Price: 20}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("basket = %+v, want %+v", got, want)
	}

	if _, err := InitialTargetBasket([]WeightedConstituent{{AssetID: "a", WeightPct: 0, Price: 1}}, 100); !errors.Is(err, ErrInvalidWeightedConstituent) {
		t.Errorf("peso zero: err = %v, want ErrInvalidWeightedConstituent", err)
	}
	if _, err := InitialTargetBasket(nil, 100); !errors.Is(err, ErrNoConstituents) {
		t.Errorf("sem constituintes: err = %v, want ErrNoConstituents", err)
	}
}

func TestInitialIssuance(t *testing.T) {
	tests := []struct {
		name       string
		held       map[string]int64
		wantShares int64
		wantBasket []BasketLeg
		wantErr    error
	}{
		{
			// 1 cota = 100 de valor: 60 em "a" (1,2 un.) e 40 em "b" (2 un.).
			name: "compra completa emite todas as cotas do alvo", held: map[string]int64{"a": 12000, "b": 20000},
			wantShares: 10000, wantBasket: []BasketLeg{{AssetID: "a", Quantity: 12000, Price: 50}, {AssetID: "b", Quantity: 20000, Price: 20}},
		},
		{
			name: "book absorveu só metade de um constituinte limita as cotas", held: map[string]int64{"a": 12000, "b": 10000},
			wantShares: 5000, wantBasket: []BasketLeg{{AssetID: "a", Quantity: 6000, Price: 50}, {AssetID: "b", Quantity: 10000, Price: 20}},
		},
		{name: "constituinte não comprado não emite nada", held: map[string]int64{"a": 12000}, wantErr: ErrNothingToIssue},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			shares, basket, err := InitialIssuance(twoAssets(), tt.held)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if err != nil {
				return
			}
			if shares != tt.wantShares {
				t.Errorf("shares = %d, want %d", shares, tt.wantShares)
			}
			if !reflect.DeepEqual(basket, tt.wantBasket) {
				t.Errorf("basket = %+v, want %+v", basket, tt.wantBasket)
			}
			// NAV da cesta entregue fica em ~InitialSharePrice por cota.
			value := 0.0
			for _, leg := range basket {
				value += float64(leg.Quantity) * leg.Price
			}
			if nav := value / float64(shares); math.Abs(nav-InitialSharePrice) > 0.5 {
				t.Errorf("NAV inicial = %.4f, want ~%.2f", nav, InitialSharePrice)
			}
		})
	}
}

func TestNAVFromSnapshot(t *testing.T) {
	f := FundSnapshot{ETFAssetID: "etf", Shares: 1000, Cash: 500, Liabilities: 100, Holdings: []FundHolding{{AssetID: "a", Quantity: 600}, {AssetID: "b", Quantity: 400}}}

	got, err := NAVFromSnapshot(f, map[string]float64{"a": 10, "b": 15})
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	// (6000 + 6000 + 500 - 100) / 1000
	if got != 12.4 {
		t.Errorf("NAV = %v, want 12.4", got)
	}

	if _, err := NAVFromSnapshot(f, map[string]float64{"a": 10}); !errors.Is(err, ErrMissingConstituentPrice) {
		t.Errorf("sem preço: err = %v, want ErrMissingConstituentPrice", err)
	}
}

func TestPremiumPct(t *testing.T) {
	if got := PremiumPct(105, 100); math.Abs(got-5) > 1e-9 {
		t.Errorf("ágio = %v, want 5", got)
	}
	if got := PremiumPct(95, 100); math.Abs(got+5) > 1e-9 {
		t.Errorf("deságio = %v, want -5", got)
	}
	if got := PremiumPct(100, 0); got != 0 {
		t.Errorf("NAV zero = %v, want 0", got)
	}
}
