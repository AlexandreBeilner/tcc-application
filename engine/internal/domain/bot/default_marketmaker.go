package bot

import (
	"tcc-investimentos/engine/internal/domain/catalog"
)

// Perfil padrão de um Market Maker provisionado pela cobertura (tarefa P.2,
// proposta-cobertura-market-maker.md seção 3.4): mesmo perfil de risco que o
// seed usava para o Market Maker único. Valores ilustrativos, sem calibração
// fina (mesmo tratamento dos demais coeficientes do motor).
const (
	DefaultMarketMakerMaxPositionSizePct = 0.50
	DefaultMarketMakerOrderPreference    = 0.50
	DefaultMarketMakerSpreadWidthPct     = 0.02
)

// defaultMarketMakerSectors são os 6 setores fixos da spec 3.3.2: o Market
// Maker padrão cobre todos. Cópia local deliberada (mesmo raciocínio de
// validRiskClasses): catalog não expõe a lista como slice.
var defaultMarketMakerSectors = []catalog.Sector{
	catalog.SectorMineracao, catalog.SectorAgronegocio, catalog.SectorBancario,
	catalog.SectorVarejo, catalog.SectorEnergia, catalog.SectorTecnologia,
}

// DefaultMarketMakerPersonality devolve a personalidade de um Market Maker
// novo: escopo amplo (todos os setores mais FII e ETF, atividade no teto da
// faixa de especialização), perfil de risco padrão e o teto padrão de ativos
// cobertos (DefaultMaxCoveredAssets).
func DefaultMarketMakerPersonality() (Personality, error) {
	scope, err := NewSpecializationScope(
		defaultMarketMakerSectors, nil, []catalog.AssetType{catalog.AssetFII, catalog.AssetETF}, SpecializationWithinScopeMax,
	)
	if err != nil {
		return Personality{}, err
	}
	risk, err := NewRiskProfile(DefaultMarketMakerMaxPositionSizePct, DefaultMarketMakerOrderPreference, DefaultMarketMakerSpreadWidthPct)
	if err != nil {
		return Personality{}, err
	}
	return NewPersonality(ArchetypeMarketMaker, scope, nil, risk)
}
