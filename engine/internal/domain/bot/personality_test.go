package bot

import (
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/equity"
)

func float64Ptr(v float64) *float64 { return &v }

func validScope(t *testing.T) SpecializationScope {
	t.Helper()
	scope, err := NewSpecializationScope([]catalog.Sector{catalog.SectorMineracao}, nil, nil, 0.85)
	if err != nil {
		t.Fatalf("scope de setup inválido: %v", err)
	}
	return scope
}

func validRiskProfile(t *testing.T) RiskProfile {
	t.Helper()
	profile, err := NewRiskProfile(0.10, 0.5, 0.01)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	return profile
}

func TestNewSpecializationScope(t *testing.T) {
	tests := []struct {
		name           string
		sectors        []catalog.Sector
		riskClasses    []equity.RiskClass
		assetClasses   []catalog.AssetType
		withinScopePct float64
		wantErr        error
	}{
		{
			name:           "só setor, dentro da faixa",
			sectors:        []catalog.Sector{catalog.SectorMineracao, catalog.SectorEnergia},
			withinScopePct: 0.85,
		},
		{
			name:           "só risk_class",
			riskClasses:    []equity.RiskClass{equity.RiskClassConservador},
			withinScopePct: 0.90,
		},
		{
			name:           "só classe de ativo",
			assetClasses:   []catalog.AssetType{catalog.AssetFII, catalog.AssetETF},
			withinScopePct: 0.88,
		},
		{
			name:           "combinação das três",
			sectors:        []catalog.Sector{catalog.SectorBancario},
			riskClasses:    []equity.RiskClass{equity.RiskClassSofisticado},
			assetClasses:   []catalog.AssetType{catalog.AssetAcao},
			withinScopePct: 0.87,
		},
		{
			name:           "escopo vazio",
			withinScopePct: 0.85,
			wantErr:        ErrEmptySpecializationScope,
		},
		{
			name:           "setor desconhecido",
			sectors:        []catalog.Sector{"Setor Inexistente"},
			withinScopePct: 0.85,
			wantErr:        ErrUnknownSectorInScope,
		},
		{
			name:           "risk_class desconhecida",
			riskClasses:    []equity.RiskClass{"Arriscado"},
			withinScopePct: 0.85,
			wantErr:        ErrUnknownRiskClassInScope,
		},
		{
			name:           "classe de ativo fora de renda variável",
			assetClasses:   []catalog.AssetType{catalog.AssetCDB},
			withinScopePct: 0.85,
			wantErr:        ErrUnknownAssetClassInScope,
		},
		{
			name:           "classe de ativo desconhecida",
			assetClasses:   []catalog.AssetType{"cripto"},
			withinScopePct: 0.85,
			wantErr:        ErrUnknownAssetClassInScope,
		},
		{
			name:           "withinScopePct abaixo do mínimo",
			sectors:        []catalog.Sector{catalog.SectorVarejo},
			withinScopePct: 0.84,
			wantErr:        ErrInvalidWithinScopePct,
		},
		{
			name:           "withinScopePct acima do máximo",
			sectors:        []catalog.Sector{catalog.SectorVarejo},
			withinScopePct: 0.91,
			wantErr:        ErrInvalidWithinScopePct,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewSpecializationScope(tt.sectors, tt.riskClasses, tt.assetClasses, tt.withinScopePct)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr == nil && got.WithinScopePct != tt.withinScopePct {
				t.Fatalf("WithinScopePct = %v, want %v", got.WithinScopePct, tt.withinScopePct)
			}
		})
	}
}

func TestNewRiskProfile(t *testing.T) {
	tests := []struct {
		name                  string
		maxPositionSizePct    float64
		marketOrderPreference float64
		spreadWidthPct        float64
		wantErr               error
	}{
		{name: "válido, meio da faixa", maxPositionSizePct: 0.2, marketOrderPreference: 0.5, spreadWidthPct: 0.01},
		{name: "maxPositionSizePct no teto (1.0)", maxPositionSizePct: 1.0, marketOrderPreference: 0, spreadWidthPct: 0},
		{name: "spreadWidthPct zero é válido", maxPositionSizePct: 0.5, marketOrderPreference: 1, spreadWidthPct: 0},
		{name: "maxPositionSizePct zero é inválido", maxPositionSizePct: 0, marketOrderPreference: 0.5, spreadWidthPct: 0, wantErr: ErrInvalidMaxPositionSizePct},
		{name: "maxPositionSizePct negativo", maxPositionSizePct: -0.1, marketOrderPreference: 0.5, spreadWidthPct: 0, wantErr: ErrInvalidMaxPositionSizePct},
		{name: "maxPositionSizePct acima de 1", maxPositionSizePct: 1.1, marketOrderPreference: 0.5, spreadWidthPct: 0, wantErr: ErrInvalidMaxPositionSizePct},
		{name: "marketOrderPreference negativo", maxPositionSizePct: 0.2, marketOrderPreference: -0.01, spreadWidthPct: 0, wantErr: ErrInvalidMarketOrderPreferencePct},
		{name: "marketOrderPreference acima de 1", maxPositionSizePct: 0.2, marketOrderPreference: 1.01, spreadWidthPct: 0, wantErr: ErrInvalidMarketOrderPreferencePct},
		{name: "spreadWidthPct negativo", maxPositionSizePct: 0.2, marketOrderPreference: 0.5, spreadWidthPct: -0.001, wantErr: ErrInvalidSpreadWidthPct},
		{name: "spreadWidthPct no teto é válido", maxPositionSizePct: 0.2, marketOrderPreference: 0.5, spreadWidthPct: MaxSpreadWidthPct},
		{name: "spreadWidthPct acima do teto", maxPositionSizePct: 0.2, marketOrderPreference: 0.5, spreadWidthPct: 0.1001, wantErr: ErrSpreadWidthAboveMax},
		{name: "spreadWidthPct absurdo perto de 2 (achado 002)", maxPositionSizePct: 0.2, marketOrderPreference: 0.5, spreadWidthPct: 1.999999, wantErr: ErrSpreadWidthAboveMax},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewRiskProfile(tt.maxPositionSizePct, tt.marketOrderPreference, tt.spreadWidthPct)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestNewPersonality(t *testing.T) {
	scope := validScope(t)
	riskProfile := validRiskProfile(t)

	tests := []struct {
		name           string
		archetype      Archetype
		knowledgeLevel *float64
		wantErr        error
	}{
		{name: "ruído sem nível de conhecimento", archetype: ArchetypeRuido, knowledgeLevel: nil},
		{name: "market maker sem nível de conhecimento", archetype: ArchetypeMarketMaker, knowledgeLevel: nil},
		{name: "chartista sem nível de conhecimento", archetype: ArchetypeChartista, knowledgeLevel: nil},
		{name: "fundamentalista com nível de conhecimento válido", archetype: ArchetypeFundamentalista, knowledgeLevel: float64Ptr(0.7)},
		{name: "fundamentalista com nível de conhecimento no piso", archetype: ArchetypeFundamentalista, knowledgeLevel: float64Ptr(0)},
		{name: "fundamentalista com nível de conhecimento no teto", archetype: ArchetypeFundamentalista, knowledgeLevel: float64Ptr(1)},
		{name: "arquétipo desconhecido", archetype: "aleatorio", knowledgeLevel: nil, wantErr: ErrUnknownArchetype},
		{name: "ruído com nível de conhecimento (rejeitado)", archetype: ArchetypeRuido, knowledgeLevel: float64Ptr(0.5), wantErr: ErrKnowledgeLevelWrongArchetype},
		{name: "market maker com nível de conhecimento (rejeitado)", archetype: ArchetypeMarketMaker, knowledgeLevel: float64Ptr(0.5), wantErr: ErrKnowledgeLevelWrongArchetype},
		{name: "chartista com nível de conhecimento (rejeitado)", archetype: ArchetypeChartista, knowledgeLevel: float64Ptr(0.5), wantErr: ErrKnowledgeLevelWrongArchetype},
		{name: "fundamentalista sem nível de conhecimento", archetype: ArchetypeFundamentalista, knowledgeLevel: nil, wantErr: ErrMissingKnowledgeLevel},
		{name: "fundamentalista com nível de conhecimento negativo", archetype: ArchetypeFundamentalista, knowledgeLevel: float64Ptr(-0.01), wantErr: ErrInvalidKnowledgeLevel},
		{name: "fundamentalista com nível de conhecimento acima de 1", archetype: ArchetypeFundamentalista, knowledgeLevel: float64Ptr(1.01), wantErr: ErrInvalidKnowledgeLevel},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewPersonality(tt.archetype, scope, tt.knowledgeLevel, riskProfile)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr == nil {
				if got.Archetype != tt.archetype {
					t.Fatalf("Archetype = %v, want %v", got.Archetype, tt.archetype)
				}
				if (got.KnowledgeLevel == nil) != (tt.knowledgeLevel == nil) {
					t.Fatalf("KnowledgeLevel = %v, want %v", got.KnowledgeLevel, tt.knowledgeLevel)
				}
			}
		})
	}
}

func TestIsValidArchetype(t *testing.T) {
	tests := []struct {
		archetype Archetype
		want      bool
	}{
		{ArchetypeRuido, true},
		{ArchetypeMarketMaker, true},
		{ArchetypeChartista, true},
		{ArchetypeFundamentalista, true},
		{"desconhecido", false},
		{"", false},
	}

	for _, tt := range tests {
		if got := IsValidArchetype(tt.archetype); got != tt.want {
			t.Errorf("IsValidArchetype(%q) = %v, want %v", tt.archetype, got, tt.want)
		}
	}
}

func TestNewPersonality_MarketMakerTemTetoPadraoDeCobertura(t *testing.T) {
	scope, _ := NewSpecializationScope(nil, nil, nil, SpecializationWithinScopeMin)
	risk, _ := NewRiskProfile(0.5, 0.1, 0.02)

	mm, err := NewPersonality(ArchetypeMarketMaker, scope, nil, risk)
	if err != nil {
		t.Fatalf("NewPersonality: %v", err)
	}
	if mm.MaxCoveredAssets == nil || *mm.MaxCoveredAssets != DefaultMaxCoveredAssets {
		t.Errorf("MaxCoveredAssets = %v, want %d", mm.MaxCoveredAssets, DefaultMaxCoveredAssets)
	}

	noise, err := NewPersonality(ArchetypeRuido, scope, nil, risk)
	if err != nil {
		t.Fatalf("NewPersonality: %v", err)
	}
	if noise.MaxCoveredAssets != nil {
		t.Errorf("Ruído não deveria ter teto de cobertura, got %d", *noise.MaxCoveredAssets)
	}
}

func TestPersonality_WithMaxCoveredAssets(t *testing.T) {
	scope, _ := NewSpecializationScope(nil, nil, nil, SpecializationWithinScopeMin)
	risk, _ := NewRiskProfile(0.5, 0.1, 0.02)
	mm, _ := NewPersonality(ArchetypeMarketMaker, scope, nil, risk)
	noise, _ := NewPersonality(ArchetypeRuido, scope, nil, risk)

	got, err := mm.WithMaxCoveredAssets(3)
	if err != nil || got.MaxCoveredAssets == nil || *got.MaxCoveredAssets != 3 {
		t.Errorf("WithMaxCoveredAssets(3) = %v, %v", got.MaxCoveredAssets, err)
	}
	if *mm.MaxCoveredAssets != DefaultMaxCoveredAssets {
		t.Error("o original não pode ser alterado")
	}
	for _, invalid := range []int{0, -1} {
		if _, err := mm.WithMaxCoveredAssets(invalid); err != ErrInvalidMaxCoveredAssets {
			t.Errorf("WithMaxCoveredAssets(%d) err = %v, want ErrInvalidMaxCoveredAssets", invalid, err)
		}
	}
	if _, err := noise.WithMaxCoveredAssets(3); err != ErrMaxCoveredAssetsWrongArchetype {
		t.Errorf("err = %v, want ErrMaxCoveredAssetsWrongArchetype", err)
	}
}
