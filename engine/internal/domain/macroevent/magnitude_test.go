package macroevent

import (
	"errors"
	"math/rand"
	"testing"
)

// TestPriceEffectRange_BateComATabelaDaSpec cobre o critério de aceite
// "tabela de bandas bate exatamente com a spec 3.3.2 (3 bandas × 2 faixas
// cada)" — metade da tabela (efeito de preço).
func TestPriceEffectRange_BateComATabelaDaSpec(t *testing.T) {
	tests := []struct {
		band       Band
		wantMinPct float64
		wantMaxPct float64
	}{
		{BandLeve, 3, 5},
		{BandModerado, 8, 12},
		{BandSevero, 15, 25},
	}

	for _, tt := range tests {
		t.Run(string(tt.band), func(t *testing.T) {
			got, err := PriceEffectRange(tt.band)
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if got.MinPct != tt.wantMinPct || got.MaxPct != tt.wantMaxPct {
				t.Errorf("got = %+v, want [%v, %v]", got, tt.wantMinPct, tt.wantMaxPct)
			}
		})
	}
}

// TestFundamentalsEffectRange_BateComATabelaDaSpec cobre a outra metade
// da tabela da spec 3.3.2 (efeito nos fundamentos).
func TestFundamentalsEffectRange_BateComATabelaDaSpec(t *testing.T) {
	tests := []struct {
		band       Band
		wantMinPct float64
		wantMaxPct float64
	}{
		{BandLeve, 5, 10},
		{BandModerado, 10, 20},
		{BandSevero, 20, 35},
	}

	for _, tt := range tests {
		t.Run(string(tt.band), func(t *testing.T) {
			got, err := FundamentalsEffectRange(tt.band)
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if got.MinPct != tt.wantMinPct || got.MaxPct != tt.wantMaxPct {
				t.Errorf("got = %+v, want [%v, %v]", got, tt.wantMinPct, tt.wantMaxPct)
			}
		})
	}
}

func TestDurationDays_TabelaFixaPorBanda(t *testing.T) {
	tests := []struct {
		band Band
		want int
	}{
		{BandLeve, 1},
		{BandModerado, 2},
		{BandSevero, 3},
	}

	for _, tt := range tests {
		t.Run(string(tt.band), func(t *testing.T) {
			got, err := DurationDays(tt.band)
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if got != tt.want {
				t.Errorf("DurationDays(%v) = %d, want %d", tt.band, got, tt.want)
			}
		})
	}
}

func TestBandaDesconhecidaRetornaErro(t *testing.T) {
	band := Band("catastrofico")

	if _, err := PriceEffectRange(band); !errors.Is(err, ErrUnknownBand) {
		t.Errorf("PriceEffectRange: err = %v, want %v", err, ErrUnknownBand)
	}
	if _, err := FundamentalsEffectRange(band); !errors.Is(err, ErrUnknownBand) {
		t.Errorf("FundamentalsEffectRange: err = %v, want %v", err, ErrUnknownBand)
	}
	if _, err := DurationDays(band); !errors.Is(err, ErrUnknownBand) {
		t.Errorf("DurationDays: err = %v, want %v", err, ErrUnknownBand)
	}
}

func TestSamplePriceEffectPct_SinalPositivoNegativoDentroDaFaixa(t *testing.T) {
	for seed := int64(0); seed < 200; seed++ {
		rng := rand.New(rand.NewSource(seed))
		got, err := SamplePriceEffectPct(BandModerado, DirectionPositivo, rng)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if got < 8 || got > 12 {
			t.Fatalf("seed %d: got = %v, want dentro de [8, 12]", seed, got)
		}
	}

	for seed := int64(0); seed < 200; seed++ {
		rng := rand.New(rand.NewSource(seed))
		got, err := SamplePriceEffectPct(BandModerado, DirectionNegativo, rng)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if got < -12 || got > -8 {
			t.Fatalf("seed %d: got = %v, want dentro de [-12, -8]", seed, got)
		}
	}
}

func TestSamplePriceEffectPct_MistoSorteiaOsDoisSinais(t *testing.T) {
	sawPositive, sawNegative := false, false
	for seed := int64(0); seed < 200; seed++ {
		rng := rand.New(rand.NewSource(seed))
		got, err := SamplePriceEffectPct(BandLeve, DirectionMisto, rng)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if got > 0 {
			sawPositive = true
		}
		if got < 0 {
			sawNegative = true
		}
		if got != 0 && (got < -5 || got > 5) {
			t.Fatalf("seed %d: got = %v, fora da faixa leve [-5, -3] ∪ [3, 5]", seed, got)
		}
	}
	if !sawPositive || !sawNegative {
		t.Errorf("misto deveria sortear os dois sinais em 200 seeds — sawPositive=%v sawNegative=%v", sawPositive, sawNegative)
	}
}

func TestSampleFundamentalsEffectPct_DentroDaFaixaDaBanda(t *testing.T) {
	for seed := int64(0); seed < 100; seed++ {
		rng := rand.New(rand.NewSource(seed))
		got, err := SampleFundamentalsEffectPct(BandSevero, DirectionPositivo, rng)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if got < 20 || got > 35 {
			t.Fatalf("seed %d: got = %v, want dentro de [20, 35]", seed, got)
		}
	}
}

func TestSamplePriceEffectPct_BandaDesconhecidaPropagaErro(t *testing.T) {
	_, err := SamplePriceEffectPct(Band("inexistente"), DirectionPositivo, rand.New(rand.NewSource(1)))
	if !errors.Is(err, ErrUnknownBand) {
		t.Errorf("err = %v, want %v", err, ErrUnknownBand)
	}
}
