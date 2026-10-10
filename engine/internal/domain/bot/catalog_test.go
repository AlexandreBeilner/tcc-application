package bot

import (
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
)

var sixSectors = []catalog.Sector{
	catalog.SectorMineracao, catalog.SectorAgronegocio, catalog.SectorBancario,
	catalog.SectorVarejo, catalog.SectorEnergia, catalog.SectorTecnologia,
}

var nonEquityAssetClasses = []catalog.AssetType{catalog.AssetFII, catalog.AssetETF}

var threeNonMarketMakerArchetypes = []Archetype{ArchetypeRuido, ArchetypeChartista, ArchetypeFundamentalista}

func TestAssignSpecializations_CoberturaCompletaPorArquetipo(t *testing.T) {
	// Cenário real do seed (tarefa C.6): 19 bots direcionais, 3 arquétipos,
	// 6 setores + 2 classes de ativo sem setor (FII/ETF).
	assignments, err := AssignSpecializations(threeNonMarketMakerArchetypes, sixSectors, nonEquityAssetClasses, 19)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	for _, archetype := range threeNonMarketMakerArchetypes {
		coveredSectors := map[catalog.Sector]bool{}
		coveredClasses := map[catalog.AssetType]bool{}
		for _, a := range assignments {
			if a.Archetype != archetype {
				continue
			}
			for _, s := range a.Sectors {
				coveredSectors[s] = true
			}
			for _, c := range a.AssetClasses {
				coveredClasses[c] = true
			}
		}
		for _, s := range sixSectors {
			if !coveredSectors[s] {
				t.Errorf("arquétipo %v: setor %v sem nenhum bot cobrindo", archetype, s)
			}
		}
		for _, c := range nonEquityAssetClasses {
			if !coveredClasses[c] {
				t.Errorf("arquétipo %v: classe de ativo %v sem nenhum bot cobrindo", archetype, c)
			}
		}
	}
}

func TestAssignSpecializations_NenhumBotComEscopoVazio(t *testing.T) {
	assignments, err := AssignSpecializations(threeNonMarketMakerArchetypes, sixSectors, nonEquityAssetClasses, 19)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	for i, a := range assignments {
		if len(a.Sectors) == 0 && len(a.AssetClasses) == 0 {
			t.Fatalf("assignments[%d] (%+v) tem escopo vazio", i, a)
		}
	}
}

func TestAssignSpecializations_TamanhoTotalBateComBotCount(t *testing.T) {
	const botCount = 19
	assignments, err := AssignSpecializations(threeNonMarketMakerArchetypes, sixSectors, nonEquityAssetClasses, botCount)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(assignments) != botCount {
		t.Fatalf("len(assignments) = %d, want %d", len(assignments), botCount)
	}
}

func TestAssignSpecializations_DistribuicaoEntreArquetiposEquilibrada(t *testing.T) {
	assignments, err := AssignSpecializations(threeNonMarketMakerArchetypes, sixSectors, nonEquityAssetClasses, 19)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	counts := map[Archetype]int{}
	for _, a := range assignments {
		counts[a.Archetype]++
	}

	min, max := 19, 0
	for _, archetype := range threeNonMarketMakerArchetypes {
		if counts[archetype] < min {
			min = counts[archetype]
		}
		if counts[archetype] > max {
			max = counts[archetype]
		}
	}
	if max-min > 1 {
		t.Fatalf("distribuição desequilibrada entre arquétipos: contagens = %v (diferença máxima permitida: 1)", counts)
	}
}

func TestAssignSpecializations_Deterministico(t *testing.T) {
	first, err := AssignSpecializations(threeNonMarketMakerArchetypes, sixSectors, nonEquityAssetClasses, 19)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	second, err := AssignSpecializations(threeNonMarketMakerArchetypes, sixSectors, nonEquityAssetClasses, 19)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(first) != len(second) {
		t.Fatalf("chamadas repetidas devolveram tamanhos diferentes: %d != %d", len(first), len(second))
	}
	for i := range first {
		a, b := first[i], second[i]
		if a.Archetype != b.Archetype || len(a.Sectors) != len(b.Sectors) || len(a.AssetClasses) != len(b.AssetClasses) {
			t.Fatalf("assignments[%d] mudou entre chamadas: %+v != %+v", i, a, b)
		}
		for j := range a.Sectors {
			if a.Sectors[j] != b.Sectors[j] {
				t.Fatalf("assignments[%d].Sectors[%d] mudou entre chamadas: %v != %v", i, j, a.Sectors[j], b.Sectors[j])
			}
		}
		for j := range a.AssetClasses {
			if a.AssetClasses[j] != b.AssetClasses[j] {
				t.Fatalf("assignments[%d].AssetClasses[%d] mudou entre chamadas: %v != %v", i, j, a.AssetClasses[j], b.AssetClasses[j])
			}
		}
	}
}

func TestAssignSpecializations_MaisBotsQueChaves(t *testing.T) {
	// 1 arquétipo, 10 bots, só 6 chaves (setores) — força o caminho de
	// wraparound (repetição) de chunkKeysAcrossBots.
	assignments, err := AssignSpecializations([]Archetype{ArchetypeRuido}, sixSectors, nil, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(assignments) != 10 {
		t.Fatalf("len(assignments) = %d, want 10", len(assignments))
	}
	covered := map[catalog.Sector]bool{}
	for _, a := range assignments {
		if len(a.Sectors) != 1 {
			t.Fatalf("cada bot deveria receber exatamente 1 setor neste cenário (botCount >= chaves), got %d", len(a.Sectors))
		}
		covered[a.Sectors[0]] = true
	}
	for _, s := range sixSectors {
		if !covered[s] {
			t.Fatalf("setor %v sem cobertura", s)
		}
	}
}

func TestAssignSpecializations_MenosBotsQueChaves(t *testing.T) {
	// 1 arquétipo, 3 bots, 6 setores + 2 classes (8 chaves) — força o
	// caminho de chunking (cada bot recebe múltiplas chaves).
	assignments, err := AssignSpecializations([]Archetype{ArchetypeRuido}, sixSectors, nonEquityAssetClasses, 3)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(assignments) != 3 {
		t.Fatalf("len(assignments) = %d, want 3", len(assignments))
	}

	coveredSectors := map[catalog.Sector]bool{}
	coveredClasses := map[catalog.AssetType]bool{}
	totalKeys := 0
	for _, a := range assignments {
		if len(a.Sectors)+len(a.AssetClasses) == 0 {
			t.Fatalf("bot com escopo vazio: %+v", a)
		}
		totalKeys += len(a.Sectors) + len(a.AssetClasses)
		for _, s := range a.Sectors {
			coveredSectors[s] = true
		}
		for _, c := range a.AssetClasses {
			coveredClasses[c] = true
		}
	}
	if totalKeys != len(sixSectors)+len(nonEquityAssetClasses) {
		t.Fatalf("totalKeys = %d, want %d (nenhuma chave deveria repetir quando botCount < len(chaves))", totalKeys, len(sixSectors)+len(nonEquityAssetClasses))
	}
	for _, s := range sixSectors {
		if !coveredSectors[s] {
			t.Fatalf("setor %v sem cobertura", s)
		}
	}
	for _, c := range nonEquityAssetClasses {
		if !coveredClasses[c] {
			t.Fatalf("classe de ativo %v sem cobertura", c)
		}
	}
}

func TestAssignSpecializations_ErroSemArquetipos(t *testing.T) {
	_, err := AssignSpecializations(nil, sixSectors, nonEquityAssetClasses, 19)
	if !errors.Is(err, ErrNoArchetypesToAssign) {
		t.Fatalf("err = %v, want %v", err, ErrNoArchetypesToAssign)
	}
}

func TestAssignSpecializations_ErroBotsInsuficientesParaArquetipos(t *testing.T) {
	_, err := AssignSpecializations(threeNonMarketMakerArchetypes, sixSectors, nonEquityAssetClasses, 2)
	if !errors.Is(err, ErrInsufficientBotsForArchetypes) {
		t.Fatalf("err = %v, want %v", err, ErrInsufficientBotsForArchetypes)
	}
}

func TestAssignSpecializations_ErroSemChavesDeCobertura(t *testing.T) {
	_, err := AssignSpecializations(threeNonMarketMakerArchetypes, nil, nil, 19)
	if !errors.Is(err, ErrNoCoverageKeys) {
		t.Fatalf("err = %v, want %v", err, ErrNoCoverageKeys)
	}
}
