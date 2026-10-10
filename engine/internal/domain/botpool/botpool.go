// Package botpool é o pool de bots direcionais (Ruído, Chartista e Fundamentalista) que o seed
// e o cadastro de ativo do painel (N.13) provisionam do mesmo jeito: id determinístico por
// índice, personalidade por índice e as constantes de alocação do float. Vive no domínio, e
// não no seed, porque o painel precisa crescer o pool com a MESMA regra: se as duas pontas
// divergissem, um ativo criado pelo painel teria bots diferentes dos do seed. Crescer o pool
// nunca altera um bot que já existe (o índice i sempre gera o mesmo id e a mesma personalidade).
package botpool

import (
	"fmt"
	"math/rand"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
)

const (
	// Seed é fixa (não derivada de time.Now()) pro seed continuar determinístico entre
	// execuções (RNF08).
	Seed = int64(20260913)
	// MarketMakerSharePct é o meio da faixa confirmada (bot.MarketMakerShareMin/Max, proposta 2.2).
	MarketMakerSharePct = 0.50
	// LegacyPoolSize é o pool de antes da Fase Q (bot.MinPoolSize): os bots de índice abaixo
	// dele mantêm exatamente a personalidade que sempre tiveram.
	LegacyPoolSize = bot.MinPoolSize
	// MinimumOrderShares é a "ordem de tamanho médio" ilustrativa que calibra o piso de caixa.
	MinimumOrderShares = 100

	specializationWithinScopePct = (bot.SpecializationWithinScopeMin + bot.SpecializationWithinScopeMax) / 2
	directionalMaxPositionSize   = 0.20
	marketOrderPreference        = 0.50
)

// UserID é o uuid fixo e determinístico do bot direcional de índice i (0-based).
func UserID(i int) string {
	return fmt.Sprintf("00000000-0000-0000-0000-%012d", i+2)
}

// IndexOf devolve o índice de um id gerado por UserID, ou false se não é um deles.
func IndexOf(userID string) (int, bool) {
	var i int
	if n, err := fmt.Sscanf(userID, "00000000-0000-0000-0000-%012d", &i); err != nil || n != 1 || i < 2 || UserID(i-2) != userID {
		return 0, false
	}
	return i - 2, true
}

// SixFixedSectors são os 6 setores fixos da spec 3.3.2.
var SixFixedSectors = []catalog.Sector{
	catalog.SectorMineracao, catalog.SectorAgronegocio, catalog.SectorBancario,
	catalog.SectorVarejo, catalog.SectorEnergia, catalog.SectorTecnologia,
}

var nonEquityAssetClasses = []catalog.AssetType{catalog.AssetFII, catalog.AssetETF}

var directionalArchetypes = []bot.Archetype{bot.ArchetypeRuido, bot.ArchetypeChartista, bot.ArchetypeFundamentalista}

// Personalities devolve a personalidade dos poolSize bots direcionais, por índice. Os
// LegacyPoolSize primeiros mantêm a distribuição e o sorteio de conhecimento de sempre; os
// acima repetem ciclicamente a especialização dos originais (a proporção entre arquétipos e a
// cobertura de todo setor e classe se mantêm), com sorteio de conhecimento próprio por bot.
func Personalities(poolSize int) ([]bot.Personality, error) {
	legacy, err := bot.AssignSpecializations(directionalArchetypes, SixFixedSectors, nonEquityAssetClasses, LegacyPoolSize)
	if err != nil {
		return nil, fmt.Errorf("distribuir especialização entre os %d bots direcionais: %w", LegacyPoolSize, err)
	}
	assignments := append([]bot.SpecializationAssignment{}, legacy...)
	for i := LegacyPoolSize; i < poolSize; i++ {
		assignments = append(assignments, legacy[i%LegacyPoolSize])
	}

	knowledgeRNG := rand.New(rand.NewSource(Seed))
	risk, err := bot.NewRiskProfile(directionalMaxPositionSize, marketOrderPreference, 0)
	if err != nil {
		return nil, fmt.Errorf("perfil de risco dos bots direcionais: %w", err)
	}

	out := make([]bot.Personality, 0, poolSize)
	for i, assignment := range assignments[:poolSize] {
		scope, err := bot.NewSpecializationScope(assignment.Sectors, nil, assignment.AssetClasses, specializationWithinScopePct)
		if err != nil {
			return nil, fmt.Errorf("escopo de especialização do bot direcional %d: %w", i, err)
		}
		var knowledgeLevel *float64
		if assignment.Archetype == bot.ArchetypeFundamentalista {
			var level float64
			if i < LegacyPoolSize {
				level = knowledgeRNG.Float64()
			} else {
				level = rand.New(rand.NewSource(Seed + int64(i))).Float64()
			}
			knowledgeLevel = &level
		}
		personality, err := bot.NewPersonality(assignment.Archetype, scope, knowledgeLevel, risk)
		if err != nil {
			return nil, fmt.Errorf("personalidade do bot direcional %d: %w", i, err)
		}
		out = append(out, personality)
	}
	return out, nil
}
