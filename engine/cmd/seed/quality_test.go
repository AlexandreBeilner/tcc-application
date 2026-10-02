package main

import (
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
)

// TestNewCompanySeeds_QualidadeAcompanhaCrescimento (achado 025): cada nível
// de crescimento do seed (Boa/Média/Ruim) vem pareado com seu multiplicador
// de qualidade, e todo par passa pela validação de catalog.NewCompany —
// dentro de um setor, ROE/margem/alavancagem deixam de ser idênticos.
func TestNewCompanySeeds_QualidadeAcompanhaCrescimento(t *testing.T) {
	want := map[float64]float64{growthPctBoa: qualityBoa, growthPctMedia: qualityMedia, growthPctRuim: qualityRuim}
	qualityBySector := map[catalog.Sector]map[float64]bool{}

	for _, s := range newCompanySeeds {
		if got := want[s.GrowthPct]; s.QualityMultiplier != got {
			t.Errorf("%s: qualidade %v pareada com crescimento %v, want %v", s.Ticker, s.QualityMultiplier, s.GrowthPct, got)
		}
		if _, err := catalog.NewCompany(s.CompanyName, s.CNPJ, s.Sector, s.GrowthPct, s.QualityMultiplier); err != nil {
			t.Errorf("%s: %v", s.Ticker, err)
		}
		if qualityBySector[s.Sector] == nil {
			qualityBySector[s.Sector] = map[float64]bool{}
		}
		qualityBySector[s.Sector][s.QualityMultiplier] = true
	}
	for sector, qualities := range qualityBySector {
		if len(qualities) < 3 {
			t.Errorf("%s: %d níveis de qualidade, want Boa/Média/Ruim", sector, len(qualities))
		}
	}
}
