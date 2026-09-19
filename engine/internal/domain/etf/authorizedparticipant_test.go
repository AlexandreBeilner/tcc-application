package etf

import (
	"errors"
	"reflect"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

func testBasket() []BasketConstituentWeight {
	return []BasketConstituentWeight{
		{AssetID: "A", Price: 50, WeightPct: 60},
		{AssetID: "B", Price: 25, WeightPct: 40},
	}
}

func TestDecideAuthorizedParticipantAction_AgioGeraCriacaoQueEmpurraPrecoParaBaixoRumoAoNAV(t *testing.T) {
	got, err := DecideAuthorizedParticipantAction("ETF1", 110, 100, 1000, testBasket())
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	want := AuthorizedParticipantAction{
		// ETFOrder do lado de venda: aumenta a oferta de cotas no mercado,
		// pressão que empurra o preço pra baixo, em direção ao NAV (menor
		// que o preço de mercado no ágio).
		ETFOrder: RebalanceOrder{AssetID: "ETF1", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Price: 110, Quantity: 1000},
		BasketOrders: []RebalanceOrder{
			{AssetID: "A", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Price: 50, Quantity: 1200},
			{AssetID: "B", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Price: 25, Quantity: 1600},
		},
		SharesOutstandingDelta: 1000,
	}

	if !reflect.DeepEqual(got, want) {
		t.Errorf("action = %+v, want %+v", got, want)
	}
	if got.SharesOutstandingDelta <= 0 {
		t.Errorf("SharesOutstandingDelta = %d, want positivo (cotas em circulação crescem na criação)", got.SharesOutstandingDelta)
	}
}

func TestDecideAuthorizedParticipantAction_DesagioGeraResgateQueEmpurraPrecoParaCimaRumoAoNAV(t *testing.T) {
	got, err := DecideAuthorizedParticipantAction("ETF1", 90, 100, 500, testBasket())
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	want := AuthorizedParticipantAction{
		// ETFOrder do lado de compra: aumenta a demanda por cotas no
		// mercado, pressão que empurra o preço pra cima, em direção ao NAV
		// (maior que o preço de mercado no deságio).
		ETFOrder: RebalanceOrder{AssetID: "ETF1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Price: 90, Quantity: 500},
		BasketOrders: []RebalanceOrder{
			{AssetID: "A", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Price: 50, Quantity: 600},
			{AssetID: "B", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Price: 25, Quantity: 800},
		},
		SharesOutstandingDelta: -500,
	}

	if !reflect.DeepEqual(got, want) {
		t.Errorf("action = %+v, want %+v", got, want)
	}
	if got.SharesOutstandingDelta >= 0 {
		t.Errorf("SharesOutstandingDelta = %d, want negativo (cotas em circulação encolhem no resgate)", got.SharesOutstandingDelta)
	}
}

func TestDecideAuthorizedParticipantAction_DentroDaToleranciaSemOportunidade(t *testing.T) {
	tests := []struct {
		name        string
		marketPrice float64
		nav         float64
	}{
		{name: "levemente acima do NAV, dentro da faixa morta", marketPrice: 100.3, nav: 100},
		{name: "levemente abaixo do NAV, dentro da faixa morta", marketPrice: 99.7, nav: 100},
		{name: "exatamente no limite superior da faixa morta", marketPrice: 100.5, nav: 100},
		{name: "exatamente no limite inferior da faixa morta", marketPrice: 99.5, nav: 100},
		{name: "preço de mercado igual ao NAV", marketPrice: 100, nav: 100},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := DecideAuthorizedParticipantAction("ETF1", tt.marketPrice, tt.nav, 100, testBasket())
			if !errors.Is(err, ErrNoArbitrageOpportunity) {
				t.Errorf("err = %v, want ErrNoArbitrageOpportunity", err)
			}
		})
	}
}

func TestDecideAuthorizedParticipantAction_PrecoDeMercadoOuNAVInvalido(t *testing.T) {
	tests := []struct {
		name        string
		marketPrice float64
		nav         float64
	}{
		{name: "preço de mercado zero", marketPrice: 0, nav: 100},
		{name: "preço de mercado negativo", marketPrice: -10, nav: 100},
		{name: "NAV zero", marketPrice: 110, nav: 0},
		{name: "NAV negativo", marketPrice: 110, nav: -10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := DecideAuthorizedParticipantAction("ETF1", tt.marketPrice, tt.nav, 100, testBasket())
			if !errors.Is(err, ErrInvalidMarketPriceOrNAV) {
				t.Errorf("err = %v, want ErrInvalidMarketPriceOrNAV", err)
			}
		})
	}
}

func TestDecideAuthorizedParticipantAction_QuantidadeDeArbitragemInvalida(t *testing.T) {
	tests := []struct {
		name            string
		arbitrageShares int64
	}{
		{name: "zero", arbitrageShares: 0},
		{name: "negativa", arbitrageShares: -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := DecideAuthorizedParticipantAction("ETF1", 110, 100, tt.arbitrageShares, testBasket())
			if !errors.Is(err, ErrInvalidArbitrageShares) {
				t.Errorf("err = %v, want ErrInvalidArbitrageShares", err)
			}
		})
	}
}

func TestDecideAuthorizedParticipantAction_CestaInvalidaPropagaErroDeRebalanceOrders(t *testing.T) {
	tests := []struct {
		name    string
		basket  []BasketConstituentWeight
		wantErr error
	}{
		{name: "cesta vazia", basket: nil, wantErr: ErrNoRebalanceConstituents},
		{
			name: "pesos não somam 100",
			basket: []BasketConstituentWeight{
				{AssetID: "A", Price: 50, WeightPct: 30},
				{AssetID: "B", Price: 25, WeightPct: 30},
			},
			wantErr: ErrWeightsDoNotSumTo100,
		},
		{
			name: "preço de constituinte inválido",
			basket: []BasketConstituentWeight{
				{AssetID: "A", Price: 0, WeightPct: 100},
			},
			wantErr: ErrInvalidConstituentPrice,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// ágio e deságio devem propagar o mesmo erro de cesta — testa
			// os dois lados do switch.
			_, errAgio := DecideAuthorizedParticipantAction("ETF1", 110, 100, 1000, tt.basket)
			if !errors.Is(errAgio, tt.wantErr) {
				t.Errorf("ágio: err = %v, want %v", errAgio, tt.wantErr)
			}

			_, errDesagio := DecideAuthorizedParticipantAction("ETF1", 90, 100, 500, tt.basket)
			if !errors.Is(errDesagio, tt.wantErr) {
				t.Errorf("deságio: err = %v, want %v", errDesagio, tt.wantErr)
			}
		})
	}
}
