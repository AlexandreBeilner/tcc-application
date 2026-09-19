package fii

import (
	"errors"
	"math"
	"testing"
)

func TestPortfolioValueVariation_TresIndexadores(t *testing.T) {
	tests := []struct {
		name      string
		indexador string
		selicRate float64
		want      float64
	}{
		{"CDI usa a Selic simulada do dia", IndexadorCDI, 12.0, math.Pow(1.12, 14.0/365) - 1},
		{"IPCA+ usa a taxa ilustrativa fixa, ignora Selic", IndexadorIPCAPlus, 25.0, math.Pow(1+DefaultIPCAPlusAnnualRatePct/100, 14.0/365) - 1},
		{"Prefixado usa a taxa ilustrativa fixa, ignora Selic", IndexadorPrefixado, 25.0, math.Pow(1+DefaultPrefixadoAnnualRatePct/100, 14.0/365) - 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := PortfolioValueVariation(tt.indexador, tt.selicRate, 14)
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if math.Abs(got-tt.want) > 1e-12 {
				t.Errorf("PortfolioValueVariation(%q) = %v, want %v", tt.indexador, got, tt.want)
			}
		})
	}
}

func TestPortfolioValueVariation_IndexadorDesconhecido(t *testing.T) {
	_, err := PortfolioValueVariation("SELIC-ANTIGO", 10, 14)
	if !errors.Is(err, ErrUnknownIndexador) {
		t.Errorf("err = %v, want ErrUnknownIndexador", err)
	}
}

func TestPortfolioValueVariation_CDIReageAMudancaDeSelic(t *testing.T) {
	baixa, err := PortfolioValueVariation(IndexadorCDI, 5, 14)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	alta, err := PortfolioValueVariation(IndexadorCDI, 15, 14)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if alta <= baixa {
		t.Errorf("variação com Selic alta (%v) deveria ser maior que com Selic baixa (%v)", alta, baixa)
	}
}

func TestNextPortfolioValue_AcumulaCorretamenteAoLongoDeCiclosSucessivos(t *testing.T) {
	tests := []struct {
		name      string
		indexador string
		selicRate float64
	}{
		{"CDI", IndexadorCDI, 12.0},
		{"IPCA+", IndexadorIPCAPlus, 12.0},
		{"Prefixado", IndexadorPrefixado, 12.0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			const initial = 300_000_000.0
			const cycleDays = 14

			afterCycle1, err := NextPortfolioValue(tt.indexador, initial, tt.selicRate, cycleDays)
			if err != nil {
				t.Fatalf("ciclo 1: err = %v, want nil", err)
			}
			afterCycle2, err := NextPortfolioValue(tt.indexador, afterCycle1, tt.selicRate, cycleDays)
			if err != nil {
				t.Fatalf("ciclo 2: err = %v, want nil", err)
			}
			afterCycle3, err := NextPortfolioValue(tt.indexador, afterCycle2, tt.selicRate, cycleDays)
			if err != nil {
				t.Fatalf("ciclo 3: err = %v, want nil", err)
			}

			variation, err := PortfolioValueVariation(tt.indexador, tt.selicRate, cycleDays)
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			factor := 1 + variation
			want := initial * factor * factor * factor

			if math.Abs(afterCycle3-want) > 1e-6 {
				t.Errorf("após 3 ciclos = %v, want %v (composição fechada de 3 fatores idênticos)", afterCycle3, want)
			}
			if !(afterCycle1 < afterCycle2 && afterCycle2 < afterCycle3) {
				t.Errorf("valor não cresce monotonicamente entre ciclos: %v, %v, %v", afterCycle1, afterCycle2, afterCycle3)
			}
		})
	}
}

func TestNextPortfolioValue_IndexadorDesconhecidoPropagaErro(t *testing.T) {
	_, err := NextPortfolioValue("desconhecido", 300_000_000.0, 10, 14)
	if !errors.Is(err, ErrUnknownIndexador) {
		t.Errorf("err = %v, want ErrUnknownIndexador", err)
	}
}
