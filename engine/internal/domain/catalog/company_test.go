package catalog

import (
	"errors"
	"testing"
)

func TestNewCompany(t *testing.T) {
	tests := []struct {
		name      string
		cName     string
		cnpj      string
		sector    Sector
		growthPct float64
		quality   float64 // 0 vira DefaultQualityMultiplier
		wantErr   error
	}{
		{name: "empresa válida", cName: "Mineradora Exemplo S.A.", cnpj: "12345678000199", sector: SectorMineracao, growthPct: DefaultBaseGrowthPct},
		{name: "nome vazio", cName: "", cnpj: "12345678000199", sector: SectorMineracao, growthPct: DefaultBaseGrowthPct, wantErr: ErrMissingCompanyName},
		{name: "cnpj curto", cName: "x", cnpj: "123", sector: SectorMineracao, growthPct: DefaultBaseGrowthPct, wantErr: ErrInvalidCNPJ},
		{name: "cnpj não numérico", cName: "x", cnpj: "1234567800019X", sector: SectorMineracao, growthPct: DefaultBaseGrowthPct, wantErr: ErrInvalidCNPJ},
		{name: "setor desconhecido", cName: "x", cnpj: "12345678000199", sector: Sector("Cripto"), growthPct: DefaultBaseGrowthPct, wantErr: ErrUnknownSector},
		{name: "crescimento inválido (zera o fator)", cName: "x", cnpj: "12345678000199", sector: SectorMineracao, growthPct: -100, wantErr: ErrInvalidBaseGrowthPct},
		{name: "crescimento inválido (inverte o fator)", cName: "x", cnpj: "12345678000199", sector: SectorMineracao, growthPct: -150, wantErr: ErrInvalidBaseGrowthPct},
		{name: "empresa boa (multiplicador acima da média)", cName: "x", cnpj: "12345678000199", sector: SectorMineracao, growthPct: DefaultBaseGrowthPct, quality: 1.25},
		{name: "multiplicador negativo", cName: "x", cnpj: "12345678000199", sector: SectorMineracao, growthPct: DefaultBaseGrowthPct, quality: -1, wantErr: ErrInvalidQualityMultiplier},
		{name: "multiplicador acima do teto", cName: "x", cnpj: "12345678000199", sector: SectorMineracao, growthPct: DefaultBaseGrowthPct, quality: 2.01, wantErr: ErrInvalidQualityMultiplier},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			quality := tt.quality
			if quality == 0 {
				quality = DefaultQualityMultiplier
			}
			got, err := NewCompany(tt.cName, tt.cnpj, tt.sector, tt.growthPct, quality)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr != nil {
				return
			}
			if got.ReportFrequencyDays != DefaultReportFrequencyDays {
				t.Errorf("ReportFrequencyDays = %d, want %d", got.ReportFrequencyDays, DefaultReportFrequencyDays)
			}
			if got.Name != tt.cName || got.CNPJ != tt.cnpj || got.Sector != tt.sector || got.BaseGrowthPct != tt.growthPct || got.QualityMultiplier != quality {
				t.Errorf("got = %+v", got)
			}
		})
	}
}
