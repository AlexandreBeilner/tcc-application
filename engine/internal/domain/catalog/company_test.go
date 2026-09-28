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
		wantErr   error
	}{
		{name: "empresa válida", cName: "Mineradora Exemplo S.A.", cnpj: "12345678000199", sector: SectorMineracao, growthPct: DefaultBaseGrowthPct},
		{name: "nome vazio", cName: "", cnpj: "12345678000199", sector: SectorMineracao, growthPct: DefaultBaseGrowthPct, wantErr: ErrMissingCompanyName},
		{name: "cnpj curto", cName: "x", cnpj: "123", sector: SectorMineracao, growthPct: DefaultBaseGrowthPct, wantErr: ErrInvalidCNPJ},
		{name: "cnpj não numérico", cName: "x", cnpj: "1234567800019X", sector: SectorMineracao, growthPct: DefaultBaseGrowthPct, wantErr: ErrInvalidCNPJ},
		{name: "setor desconhecido", cName: "x", cnpj: "12345678000199", sector: Sector("Cripto"), growthPct: DefaultBaseGrowthPct, wantErr: ErrUnknownSector},
		{name: "crescimento inválido (zera o fator)", cName: "x", cnpj: "12345678000199", sector: SectorMineracao, growthPct: -100, wantErr: ErrInvalidBaseGrowthPct},
		{name: "crescimento inválido (inverte o fator)", cName: "x", cnpj: "12345678000199", sector: SectorMineracao, growthPct: -150, wantErr: ErrInvalidBaseGrowthPct},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewCompany(tt.cName, tt.cnpj, tt.sector, tt.growthPct)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr != nil {
				return
			}
			if got.ReportFrequencyDays != DefaultReportFrequencyDays {
				t.Errorf("ReportFrequencyDays = %d, want %d", got.ReportFrequencyDays, DefaultReportFrequencyDays)
			}
			if got.Name != tt.cName || got.CNPJ != tt.cnpj || got.Sector != tt.sector || got.BaseGrowthPct != tt.growthPct {
				t.Errorf("got = %+v", got)
			}
		})
	}
}
