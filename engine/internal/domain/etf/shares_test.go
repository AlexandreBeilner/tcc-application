package etf

import (
	"errors"
	"reflect"
	"testing"
)

func validExchange() ShareExchange {
	return ShareExchange{
		ETFAssetID:           "etf",
		FundAccountID:        "fund",
		ParticipantAccountID: "ap",
		Shares:               1000,
		SharePrice:           12.5,
		Basket: []BasketLeg{
			{AssetID: "acao", Quantity: 600, Price: 10},
			{AssetID: "fii", Quantity: 400, Price: 15},
		},
	}
}

func TestShareExchangeValidate(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*ShareExchange)
		wantErr error
	}{
		{name: "válida", mutate: func(*ShareExchange) {}},
		{name: "cotas zero", mutate: func(e *ShareExchange) { e.Shares = 0 }, wantErr: ErrInvalidShareAmount},
		{name: "cotas além de 32 bits", mutate: func(e *ShareExchange) { e.Shares = 1 << 32 }, wantErr: ErrInvalidShareAmount},
		{name: "quantidade além de 32 bits na cesta", mutate: func(e *ShareExchange) { e.Basket[0].Quantity = 1 << 32 }, wantErr: ErrInvalidBasketLeg},
		{name: "cotas negativas", mutate: func(e *ShareExchange) { e.Shares = -1 }, wantErr: ErrInvalidShareAmount},
		{name: "preço da cota zero", mutate: func(e *ShareExchange) { e.SharePrice = 0 }, wantErr: ErrInvalidBasketLeg},
		{name: "cesta vazia", mutate: func(e *ShareExchange) { e.Basket = nil }, wantErr: ErrEmptyBasket},
		{name: "participante é o fundo", mutate: func(e *ShareExchange) { e.ParticipantAccountID = "fund" }, wantErr: ErrSameAccount},
		{name: "quantidade zero na cesta", mutate: func(e *ShareExchange) { e.Basket[0].Quantity = 0 }, wantErr: ErrInvalidBasketLeg},
		{name: "preço zero na cesta", mutate: func(e *ShareExchange) { e.Basket[1].Price = 0 }, wantErr: ErrInvalidBasketLeg},
		{name: "asset vazio na cesta", mutate: func(e *ShareExchange) { e.Basket[0].AssetID = "" }, wantErr: ErrInvalidBasketLeg},
		{name: "ETF na própria cesta", mutate: func(e *ShareExchange) { e.Basket[0].AssetID = "etf" }, wantErr: ErrInvalidBasketLeg},
		{name: "constituinte duplicado", mutate: func(e *ShareExchange) { e.Basket[1].AssetID = "acao" }, wantErr: ErrDuplicateBasketLeg},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exchange := validExchange()
			exchange.Basket = append([]BasketLeg(nil), exchange.Basket...)
			tt.mutate(&exchange)

			err := exchange.Validate()
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestProRataBasket(t *testing.T) {
	holdings := []BasketLeg{
		{AssetID: "acao", Quantity: 1000, Price: 10},
		{AssetID: "fii", Quantity: 333, Price: 15},
		{AssetID: "raro", Quantity: 1, Price: 5},
	}

	tests := []struct {
		name        string
		outstanding int64
		shares      int64
		roundUp     bool
		want        []BasketLeg
	}{
		{
			name: "criação de 10% arredonda pra cima", outstanding: 1000, shares: 100, roundUp: true,
			want: []BasketLeg{{AssetID: "acao", Quantity: 100, Price: 10}, {AssetID: "fii", Quantity: 34, Price: 15}, {AssetID: "raro", Quantity: 1, Price: 5}},
		},
		{
			name: "resgate de 10% arredonda pra baixo e descarta o que zera", outstanding: 1000, shares: 100, roundUp: false,
			want: []BasketLeg{{AssetID: "acao", Quantity: 100, Price: 10}, {AssetID: "fii", Quantity: 33, Price: 15}},
		},
		{
			name: "resgate total devolve a cesta inteira", outstanding: 1000, shares: 1000, roundUp: false,
			want: holdings,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ProRataBasket(holdings, tt.outstanding, tt.shares, tt.roundUp)
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("basket = %+v, want %+v", got, tt.want)
			}
		})
	}
}

func TestProRataBasket_Erros(t *testing.T) {
	holdings := []BasketLeg{{AssetID: "acao", Quantity: 1000, Price: 10}}

	if _, err := ProRataBasket(holdings, 0, 10, true); !errors.Is(err, ErrInvalidShareAmount) {
		t.Errorf("sem cotas emitidas: err = %v, want ErrInvalidShareAmount", err)
	}
	if _, err := ProRataBasket(holdings, 1000, 0, true); !errors.Is(err, ErrInvalidShareAmount) {
		t.Errorf("zero cotas: err = %v, want ErrInvalidShareAmount", err)
	}
	if _, err := ProRataBasket([]BasketLeg{{AssetID: "acao", Quantity: 1, Price: 0}}, 1000, 10, true); !errors.Is(err, ErrInvalidBasketLeg) {
		t.Errorf("preço zero: err = %v, want ErrInvalidBasketLeg", err)
	}
	if _, err := ProRataBasket([]BasketLeg{{AssetID: "acao", Quantity: 1, Price: 10}}, 1000, 1, false); !errors.Is(err, ErrEmptyBasket) {
		t.Errorf("tudo arredonda a zero: err = %v, want ErrEmptyBasket", err)
	}
}

func TestShareTransferValidate(t *testing.T) {
	valid := ShareTransfer{ETFAssetID: "etf", FromAccountID: "ap", ToAccountID: "mm", Quantity: 100, Price: 99.5}
	tests := []struct {
		name    string
		mutate  func(*ShareTransfer)
		wantErr error
	}{
		{name: "válida", mutate: func(*ShareTransfer) {}},
		{name: "quantidade zero", mutate: func(x *ShareTransfer) { x.Quantity = 0 }, wantErr: ErrInvalidShareAmount},
		{name: "quantidade além de 32 bits", mutate: func(x *ShareTransfer) { x.Quantity = 1 << 32 }, wantErr: ErrInvalidShareAmount},
		{name: "preço zero", mutate: func(x *ShareTransfer) { x.Price = 0 }, wantErr: ErrInvalidBasketLeg},
		{name: "origem vazia", mutate: func(x *ShareTransfer) { x.FromAccountID = "" }, wantErr: ErrInvalidBasketLeg},
		{name: "mesma conta", mutate: func(x *ShareTransfer) { x.ToAccountID = "ap" }, wantErr: ErrSameAccount},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transfer := valid
			tt.mutate(&transfer)
			if err := transfer.Validate(); !errors.Is(err, tt.wantErr) {
				t.Errorf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}
