package bot

import "testing"

func TestDefaultMarketMakerPersonality(t *testing.T) {
	p, err := DefaultMarketMakerPersonality()
	if err != nil {
		t.Fatalf("DefaultMarketMakerPersonality: %v", err)
	}
	if p.Archetype != ArchetypeMarketMaker {
		t.Errorf("Archetype = %s, want market_maker", p.Archetype)
	}
	if len(p.Scope.Sectors) != 6 || len(p.Scope.AssetClasses) != 2 {
		t.Errorf("escopo = %d setores, %d classes; want 6 e 2", len(p.Scope.Sectors), len(p.Scope.AssetClasses))
	}
	if p.RiskProfile.SpreadWidthPct != DefaultMarketMakerSpreadWidthPct {
		t.Errorf("SpreadWidthPct = %v", p.RiskProfile.SpreadWidthPct)
	}
	if p.MaxCoveredAssets == nil || *p.MaxCoveredAssets != DefaultMaxCoveredAssets {
		t.Errorf("MaxCoveredAssets = %v, want %d", p.MaxCoveredAssets, DefaultMaxCoveredAssets)
	}
}
