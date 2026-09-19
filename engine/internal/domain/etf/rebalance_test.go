package etf

import (
	"errors"
	"reflect"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

func TestRebalanceOrders_ComposicaoAntigaParaComposicaoNova(t *testing.T) {
	tests := []struct {
		name         string
		constituents []RebalanceConstituent
		cash         float64
		liabilities  float64
		want         []RebalanceOrder
	}{
		{
			name: "revisão periódica: índice reduz peso de A e aumenta peso de B, sem variação de preço",
			constituents: []RebalanceConstituent{
				{AssetID: "A", CurrentQuantity: 600, Price: 10, TargetWeightPct: 50},
				{AssetID: "B", CurrentQuantity: 400, Price: 10, TargetWeightPct: 50},
			},
			// netAssets = 600*10 + 400*10 = 10000
			want: []RebalanceOrder{
				{AssetID: "A", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Price: 10, Quantity: 100},
				{AssetID: "B", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Price: 10, Quantity: 100},
			},
		},
		{
			name: "evento corporativo: A dispara de preço e passa do peso-alvo sem o índice ter mudado",
			constituents: []RebalanceConstituent{
				{AssetID: "A", CurrentQuantity: 500, Price: 20, TargetWeightPct: 50},
				{AssetID: "B", CurrentQuantity: 500, Price: 10, TargetWeightPct: 50},
			},
			// netAssets = 500*20 + 500*10 = 15000
			want: []RebalanceOrder{
				{AssetID: "A", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Price: 20, Quantity: 125},
				{AssetID: "B", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Price: 10, Quantity: 250},
			},
		},
		{
			name: "revisão periódica: constituinte novo entra, constituinte existente perde peso",
			constituents: []RebalanceConstituent{
				{AssetID: "A", CurrentQuantity: 1000, Price: 10, TargetWeightPct: 60},
				{AssetID: "C", CurrentQuantity: 0, Price: 50, TargetWeightPct: 40},
			},
			// netAssets = 1000*10 + 0*50 = 10000
			want: []RebalanceOrder{
				{AssetID: "A", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Price: 10, Quantity: 400},
				{AssetID: "C", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Price: 50, Quantity: 80},
			},
		},
		{
			name: "revisão periódica: constituinte sai inteiramente da cesta (peso-alvo zero)",
			constituents: []RebalanceConstituent{
				{AssetID: "A", CurrentQuantity: 1000, Price: 10, TargetWeightPct: 0},
				{AssetID: "B", CurrentQuantity: 0, Price: 20, TargetWeightPct: 100},
			},
			// netAssets = 1000*10 + 0*20 = 10000
			want: []RebalanceOrder{
				{AssetID: "A", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Price: 10, Quantity: 1000},
				{AssetID: "B", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Price: 20, Quantity: 500},
			},
		},
		{
			name: "cesta já convergida: nenhuma ordem necessária",
			constituents: []RebalanceConstituent{
				{AssetID: "A", CurrentQuantity: 1000, Price: 10, TargetWeightPct: 100},
			},
			want: nil,
		},
		{
			name: "caixa do fundo entra no cálculo do peso-alvo",
			constituents: []RebalanceConstituent{
				{AssetID: "A", CurrentQuantity: 500, Price: 10, TargetWeightPct: 100},
			},
			cash: 5000,
			// netAssets = 500*10 + 5000 = 10000; targetValueA = 10000; targetQtyA = 1000
			want: []RebalanceOrder{
				{AssetID: "A", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Price: 10, Quantity: 500},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := RebalanceOrders(tt.constituents, tt.cash, tt.liabilities)
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("orders = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestRebalanceOrders_CestaVazia(t *testing.T) {
	_, err := RebalanceOrders(nil, 0, 0)
	if !errors.Is(err, ErrNoRebalanceConstituents) {
		t.Errorf("err = %v, want ErrNoRebalanceConstituents", err)
	}
}

func TestRebalanceOrders_CaixaOuPassivoNegativo(t *testing.T) {
	constituents := []RebalanceConstituent{{AssetID: "A", CurrentQuantity: 100, Price: 10, TargetWeightPct: 100}}

	tests := []struct {
		name        string
		cash        float64
		liabilities float64
	}{
		{name: "caixa negativo", cash: -1, liabilities: 0},
		{name: "passivo negativo", cash: 0, liabilities: -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := RebalanceOrders(constituents, tt.cash, tt.liabilities)
			if !errors.Is(err, ErrNegativeCashOrLiabilities) {
				t.Errorf("err = %v, want ErrNegativeCashOrLiabilities", err)
			}
		})
	}
}

func TestRebalanceOrders_ConstituinteComQuantidadeOuPesoNegativo(t *testing.T) {
	tests := []struct {
		name        string
		constituent RebalanceConstituent
	}{
		{name: "quantidade atual negativa", constituent: RebalanceConstituent{AssetID: "A", CurrentQuantity: -1, Price: 10, TargetWeightPct: 100}},
		{name: "peso-alvo negativo", constituent: RebalanceConstituent{AssetID: "A", CurrentQuantity: 0, Price: 10, TargetWeightPct: -1}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := RebalanceOrders([]RebalanceConstituent{tt.constituent}, 0, 0)
			if !errors.Is(err, ErrNegativeRebalanceConstituent) {
				t.Errorf("err = %v, want ErrNegativeRebalanceConstituent", err)
			}
		})
	}
}

func TestRebalanceOrders_PrecoInvalido(t *testing.T) {
	tests := []struct {
		name  string
		price float64
	}{
		{name: "zero", price: 0},
		{name: "negativo", price: -10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			constituents := []RebalanceConstituent{{AssetID: "A", CurrentQuantity: 100, Price: tt.price, TargetWeightPct: 100}}
			_, err := RebalanceOrders(constituents, 0, 0)
			if !errors.Is(err, ErrInvalidConstituentPrice) {
				t.Errorf("err = %v, want ErrInvalidConstituentPrice", err)
			}
		})
	}
}

func TestRebalanceOrders_PesosAlvoNaoSomam100(t *testing.T) {
	tests := []struct {
		name    string
		weightA float64
		weightB float64
	}{
		{name: "soma muito abaixo de 100", weightA: 30, weightB: 30},
		{name: "soma muito acima de 100", weightA: 70, weightB: 70},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			constituents := []RebalanceConstituent{
				{AssetID: "A", CurrentQuantity: 100, Price: 10, TargetWeightPct: tt.weightA},
				{AssetID: "B", CurrentQuantity: 100, Price: 10, TargetWeightPct: tt.weightB},
			}
			_, err := RebalanceOrders(constituents, 0, 0)
			if !errors.Is(err, ErrWeightsDoNotSumTo100) {
				t.Errorf("err = %v, want ErrWeightsDoNotSumTo100", err)
			}
		})
	}
}

func TestRebalanceOrders_PesosDentroDaToleranciaSaoAceitos(t *testing.T) {
	constituents := []RebalanceConstituent{
		{AssetID: "A", CurrentQuantity: 100, Price: 10, TargetWeightPct: 50.2},
		{AssetID: "B", CurrentQuantity: 100, Price: 10, TargetWeightPct: 49.9},
	}

	if _, err := RebalanceOrders(constituents, 0, 0); err != nil {
		t.Errorf("err = %v, want nil (soma 100.1, dentro de WeightTolerance)", err)
	}
}
