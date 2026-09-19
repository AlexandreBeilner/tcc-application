package etf

import (
	"errors"
	"math"
	"testing"
)

func TestNAV_CestaMistaComPrecoCorretoPorConstituinte(t *testing.T) {
	tests := []struct {
		name              string
		acao              Constituent // preço de mercado × quantidade
		fii               Constituent // preço de mercado × quantidade
		rendaFixa         Constituent // PU marcado a mercado × quantidade de títulos
		cash              float64
		liabilities       float64
		sharesOutstanding int64
		want              float64
	}{
		{
			name:              "cesta equilibrada, sem passivo",
			acao:              Constituent{Quantity: 1000, Price: 25.50},
			fii:               Constituent{Quantity: 500, Price: 110.00},
			rendaFixa:         Constituent{Quantity: 200, Price: 1050.75},
			cash:              10_000,
			liabilities:       0,
			sharesOutstanding: 10_000,
			// (1000*25.50 + 500*110 + 200*1050.75 + 10000 - 0) / 10000
			want: (1000*25.50 + 500*110.00 + 200*1050.75 + 10_000 - 0) / 10_000,
		},
		{
			name:              "com passivo reduzindo o patrimônio líquido",
			acao:              Constituent{Quantity: 2000, Price: 40.00},
			fii:               Constituent{Quantity: 1000, Price: 95.30},
			rendaFixa:         Constituent{Quantity: 500, Price: 998.20},
			cash:              5_000,
			liabilities:       12_345.67,
			sharesOutstanding: 25_000,
			want:              (2000*40.00 + 1000*95.30 + 500*998.20 + 5_000 - 12_345.67) / 25_000,
		},
		{
			name:              "preço de renda fixa marcado abaixo do par (deságio)",
			acao:              Constituent{Quantity: 300, Price: 88.00},
			fii:               Constituent{Quantity: 200, Price: 102.10},
			rendaFixa:         Constituent{Quantity: 100, Price: 940.00},
			cash:              1_000,
			liabilities:       500,
			sharesOutstanding: 5_000,
			want:              (300*88.00 + 200*102.10 + 100*940.00 + 1_000 - 500) / 5_000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			constituents := []Constituent{tt.acao, tt.fii, tt.rendaFixa}

			got, err := NAV(constituents, tt.cash, tt.liabilities, tt.sharesOutstanding)
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if math.Abs(got-tt.want) > 1e-9 {
				t.Errorf("NAV = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNAV_UsaMesmaFormulaComoINAV(t *testing.T) {
	// iNAV é a mesma fórmula recalculada com preços mais recentes — este
	// teste só confirma que atualizar Price entre duas chamadas muda o
	// resultado proporcionalmente, sem nenhum estado guardado entre elas.
	constituents := []Constituent{{Quantity: 1000, Price: 10.00}}

	navAbertura, err := NAV(constituents, 0, 0, 1000)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	constituents[0].Price = 11.00
	iNAV, err := NAV(constituents, 0, 0, 1000)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	if iNAV <= navAbertura {
		t.Errorf("iNAV = %v, want > NAV de abertura (%v) após alta de preço do constituinte", iNAV, navAbertura)
	}
}

func TestNAV_CestaVazia(t *testing.T) {
	_, err := NAV(nil, 1_000, 0, 100)
	if !errors.Is(err, ErrNoConstituents) {
		t.Errorf("err = %v, want ErrNoConstituents", err)
	}
}

func TestNAV_CotasEmitidasInvalidas(t *testing.T) {
	tests := []struct {
		name              string
		sharesOutstanding int64
	}{
		{name: "zero", sharesOutstanding: 0},
		{name: "negativo", sharesOutstanding: -1},
	}

	constituents := []Constituent{{Quantity: 100, Price: 10}}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NAV(constituents, 0, 0, tt.sharesOutstanding)
			if !errors.Is(err, ErrInvalidSharesOutstanding) {
				t.Errorf("err = %v, want ErrInvalidSharesOutstanding", err)
			}
		})
	}
}

func TestNAV_CaixaOuPassivoNegativo(t *testing.T) {
	constituents := []Constituent{{Quantity: 100, Price: 10}}

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
			_, err := NAV(constituents, tt.cash, tt.liabilities, 100)
			if !errors.Is(err, ErrNegativeCashOrLiabilities) {
				t.Errorf("err = %v, want ErrNegativeCashOrLiabilities", err)
			}
		})
	}
}

func TestNAV_ConstituinteComQuantidadeOuPrecoNegativo(t *testing.T) {
	tests := []struct {
		name        string
		constituent Constituent
	}{
		{name: "quantidade negativa", constituent: Constituent{Quantity: -1, Price: 10}},
		{name: "preço negativo", constituent: Constituent{Quantity: 10, Price: -1}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NAV([]Constituent{tt.constituent}, 0, 0, 100)
			if !errors.Is(err, ErrNegativeConstituent) {
				t.Errorf("err = %v, want ErrNegativeConstituent", err)
			}
		})
	}
}

func TestNAV_SoCaixaSemPassivo(t *testing.T) {
	// Constituinte de valor zero (quantidade zero) é um caso degenerado
	// válido — fundo cuja cesta ainda não tem posição real, só caixa.
	got, err := NAV([]Constituent{{Quantity: 0, Price: 0}}, 10_000, 0, 100)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if want := 100.0; got != want {
		t.Errorf("NAV = %v, want %v", got, want)
	}
}
