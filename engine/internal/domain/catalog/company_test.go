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

func TestNewCompany_AgendaLegadaPorPadrao(t *testing.T) {
	c, err := NewCompany("Empresa S.A.", "12345678000199", SectorEnergia, DefaultBaseGrowthPct, DefaultQualityMultiplier)
	if err != nil {
		t.Fatal(err)
	}
	if c.ReportOffsetDays != 0 || c.DividendPolicy != DividendQuarterly || c.ComLagDays != 0 || c.PaymentLagDays != DefaultPaymentLagDays || c.ScheduleAssigned {
		t.Errorf("agenda padrão = %+v, quer o legado sem atribuição", c)
	}
}

func TestCompany_WithPaymentSchedule(t *testing.T) {
	base, _ := NewCompany("Empresa S.A.", "12345678000199", SectorEnergia, DefaultBaseGrowthPct, DefaultQualityMultiplier)
	tests := []struct {
		name           string
		offset         int
		policy         DividendPolicy
		comLag, payLag int
		wantErr        bool
	}{
		{name: "agenda típica", offset: 28, policy: DividendSemiannual, comLag: 2, payLag: 12},
		{name: "limites máximos", offset: MaxReportOffsetDays, policy: DividendAnnual, comLag: MaxComLagDays, payLag: MaxPaymentLagDays},
		{name: "offset negativo", offset: -1, policy: DividendQuarterly, wantErr: true},
		{name: "offset acima da janela", offset: MaxReportOffsetDays + 1, policy: DividendQuarterly, wantErr: true},
		{name: "política inválida", offset: 5, policy: DividendPolicy("mensal"), wantErr: true},
		{name: "defasagem da data-com acima do teto", offset: 5, policy: DividendQuarterly, comLag: MaxComLagDays + 1, wantErr: true},
		{name: "defasagem do pagamento acima do teto", offset: 5, policy: DividendQuarterly, payLag: MaxPaymentLagDays + 1, wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := base.WithPaymentSchedule(tt.offset, tt.policy, tt.comLag, tt.payLag)
			if tt.wantErr {
				if !errors.Is(err, ErrInvalidPaymentSchedule) {
					t.Fatalf("err = %v, quer ErrInvalidPaymentSchedule", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got.ReportOffsetDays != tt.offset || got.DividendPolicy != tt.policy || got.ComLagDays != tt.comLag || got.PaymentLagDays != tt.payLag || !got.ScheduleAssigned {
				t.Errorf("empresa = %+v", got)
			}
		})
	}
	if base.ScheduleAssigned {
		t.Error("WithPaymentSchedule não deve alterar a empresa original")
	}
}
