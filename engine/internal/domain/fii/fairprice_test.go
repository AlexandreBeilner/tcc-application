package fii

import (
	"errors"
	"math"
	"testing"
)

const floatTol = 1e-9

func TestTargetPriceToBook_SelicNaNeutraDevolveBaseDoSegmento(t *testing.T) {
	tests := []struct {
		name    string
		fiiType Type
		segment string
		want    float64
	}{
		{"lajes", TypeTijolo, SegmentLajesCorporativas, LajesCorporativasPriceToBook},
		{"shopping", TypeTijolo, SegmentShoppingCenters, ShoppingCentersPriceToBook},
		{"logística", TypeTijolo, SegmentGalpoesLogisticos, GalpoesLogisticosPriceToBook},
		{"segmento desconhecido cai no padrão", TypeTijolo, "Hospitais", DefaultTijoloPriceToBook},
		{"segmento vazio cai no padrão", TypeTijolo, "", DefaultTijoloPriceToBook},
		{"papel ignora segmento", TypePapel, SegmentLajesCorporativas, PapelPriceToBook},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := TargetPriceToBook(tt.fiiType, tt.segment, 10, 10)
			if err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}
			if math.Abs(got-tt.want) > floatTol {
				t.Errorf("TargetPriceToBook = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestTargetPriceToBook_SelicDesviaDaNeutra(t *testing.T) {
	// Tijolo: spread 3, β 0,5, neutra 10 → yield neutro 13.
	// Selic 15: yield exigido 18, desvio 5/13, fator 1 − 0,5×5/13.
	up := LajesCorporativasPriceToBook * (1 - TijoloPriceToBookBeta*5.0/13.0)
	down := LajesCorporativasPriceToBook * (1 - TijoloPriceToBookBeta*(-3.0)/13.0)

	tests := []struct {
		name  string
		selic float64
		want  float64
	}{
		{"selic acima da neutra reduz o P/VP-alvo", 15, up},
		{"selic abaixo da neutra aumenta o P/VP-alvo", 7, down},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := TargetPriceToBook(TypeTijolo, SegmentLajesCorporativas, tt.selic, 10)
			if err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}
			if math.Abs(got-tt.want) > floatTol {
				t.Errorf("TargetPriceToBook(selic=%v) = %v, want %v", tt.selic, got, tt.want)
			}
		})
	}

	hi, _ := TargetPriceToBook(TypeTijolo, SegmentLajesCorporativas, 15, 10)
	lo, _ := TargetPriceToBook(TypeTijolo, SegmentLajesCorporativas, 7, 10)
	if !(hi < LajesCorporativasPriceToBook && LajesCorporativasPriceToBook < lo) {
		t.Errorf("monotonia violada: alta=%v base=%v baixa=%v", hi, LajesCorporativasPriceToBook, lo)
	}
}

func TestTargetPriceToBook_PapelReageMenosQueTijolo(t *testing.T) {
	// Mesma Selic, mesma base (forçamos comparando a variação relativa ao base de cada um).
	tijolo, _ := TargetPriceToBook(TypeTijolo, SegmentShoppingCenters, 16, 10)
	papel, _ := TargetPriceToBook(TypePapel, "", 16, 10)

	tijoloDrop := 1 - tijolo/ShoppingCentersPriceToBook
	papelDrop := 1 - papel/PapelPriceToBook
	if !(papelDrop > 0 && papelDrop < tijoloDrop) {
		t.Errorf("queda relativa: papel=%v deveria ser positiva e menor que tijolo=%v", papelDrop, tijoloDrop)
	}
}

func TestTargetPriceToBook_ClampNasDuasPontas(t *testing.T) {
	high, _ := TargetPriceToBook(TypeTijolo, SegmentShoppingCenters, 1000, 10)
	if high != MinTargetPriceToBook {
		t.Errorf("Selic extrema alta = %v, want piso %v", high, MinTargetPriceToBook)
	}
	low, _ := TargetPriceToBook(TypePapel, "", -1000, 10)
	if low != MaxTargetPriceToBook {
		t.Errorf("Selic extrema baixa = %v, want teto %v", low, MaxTargetPriceToBook)
	}
}

func TestTargetPriceToBook_YieldNeutroNaoPositivoUsaBase(t *testing.T) {
	got, err := TargetPriceToBook(TypeTijolo, SegmentShoppingCenters, 20, -3)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if got != ShoppingCentersPriceToBook {
		t.Errorf("got %v, want base %v sem ajuste", got, ShoppingCentersPriceToBook)
	}
}

func TestTargetPriceToBook_TipoDesconhecido(t *testing.T) {
	if _, err := TargetPriceToBook(Type("fiagro"), "", 10, 10); !errors.Is(err, ErrUnknownFairPriceType) {
		t.Errorf("err = %v, want ErrUnknownFairPriceType", err)
	}
}

func TestFairPrice(t *testing.T) {
	tests := []struct {
		name     string
		base     float64
		shares   int64
		targetPB float64
		macro    float64
		dividend float64
		want     float64
		wantOK   bool
	}{
		{"sem efeitos", 100_000_000, 1_000_000, 0.75, 0, 0, 75, true},
		{"efeito macro negativo", 100_000_000, 1_000_000, 1, -10, 0, 90, true},
		{"efeito de provento negativo", 100_000_000, 1_000_000, 1, 0, -1.1, 98.9, true},
		{"efeitos compõem", 100_000_000, 1_000_000, 0.8, -10, -10, 100 * 0.8 * 0.9 * 0.9, true},
		{"efeito abaixo de -100 é limitado e zera sem negativar", 100_000_000, 1_000_000, 1, -250, 0, 0, true},
		{"cotas zero", 100_000_000, 0, 1, 0, 0, 0, false},
		{"cotas negativas", 100_000_000, -5, 1, 0, 0, 0, false},
		{"valor-base zero", 0, 1_000_000, 1, 0, 0, 0, false},
		{"P/VP-alvo não positivo", 100_000_000, 1_000_000, 0, 0, 0, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := FairPrice(tt.base, tt.shares, tt.targetPB, tt.macro, tt.dividend)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && math.Abs(got-tt.want) > 1e-6 {
				t.Errorf("FairPrice = %v, want %v", got, tt.want)
			}
		})
	}
}

// Round-trip (mesma técnica do achado 003): o valor-base que o seed calcula,
// jogado de volta em FairPrice, reproduz o preço-alvo pra qualquer combinação
// de cotas, preço, tipo e segmento, não só o caso de hoje.
func TestBootstrapBaseValueForTargetPrice_RoundTrip(t *testing.T) {
	segments := []struct {
		fiiType Type
		segment string
	}{
		{TypeTijolo, SegmentLajesCorporativas},
		{TypeTijolo, SegmentShoppingCenters},
		{TypeTijolo, SegmentGalpoesLogisticos},
		{TypeTijolo, "Desconhecido"},
		{TypePapel, ""},
	}
	prices := []float64{1, 10, 100, 250.5}
	shareCounts := []int64{1, 1_000, 1_000_000, 500_000_000}
	selics := []float64{5, 10, 14.75}

	for _, s := range segments {
		for _, price := range prices {
			for _, shares := range shareCounts {
				for _, selic := range selics {
					pb, err := TargetPriceToBook(s.fiiType, s.segment, selic, 10)
					if err != nil {
						t.Fatalf("TargetPriceToBook: %v", err)
					}
					base, ok := BootstrapBaseValueForTargetPrice(price, shares, pb)
					if !ok {
						t.Fatalf("Bootstrap ok=false para price=%v shares=%v pb=%v", price, shares, pb)
					}
					got, ok := FairPrice(base, shares, pb, 0, 0)
					if !ok || math.Abs(got-price) > 1e-6*price {
						t.Errorf("round-trip %v/%q price=%v shares=%v selic=%v: got %v", s.fiiType, s.segment, price, shares, selic, got)
					}
				}
			}
		}
	}

	// O caso de hoje: lajes com preço 100 e 1M de cotas nasce com patrimônio > cotas × preço.
	base, _ := BootstrapBaseValueForTargetPrice(100, 1_000_000, LajesCorporativasPriceToBook)
	if base <= 100*1_000_000 {
		t.Errorf("P/VP-alvo < 1 exige patrimônio maior que cotas × preço, got %v", base)
	}
}

func TestBootstrapBaseValueForTargetPrice_EntradasInvalidas(t *testing.T) {
	cases := []struct {
		name   string
		price  float64
		shares int64
		pb     float64
	}{
		{"preço zero", 0, 10, 1},
		{"cotas zero", 10, 0, 1},
		{"P/VP-alvo zero", 10, 10, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, ok := BootstrapBaseValueForTargetPrice(c.price, c.shares, c.pb); ok {
				t.Error("ok = true, want false")
			}
		})
	}
}
