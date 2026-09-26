package bot

import (
	"math"
	"math/rand"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/equity"
)

func turnsPerAsset(turns []Turn) map[string]int {
	got := map[string]int{}
	for _, tn := range turns {
		got[tn.AssetID]++
	}
	return got
}

func TestTurnBudget(t *testing.T) {
	tests := []struct {
		assets, want int
	}{
		{5, 20},
		{30, 120},
		{60, 200},
		{100, MaxTurnsPerTick},
		{400, 400}, // o piso de 1 turno por ativo vem antes do teto
		{0, 0},
	}
	for _, tc := range tests {
		if got := TurnBudget(tc.assets); got != tc.want {
			t.Errorf("TurnBudget(%d) = %d, want %d", tc.assets, got, tc.want)
		}
	}
}

func TestAllocateTurns_SomaExataEPisoRigido(t *testing.T) {
	universe := weightedUniverse(1e9, 5e8, 1e6, 1e3, 1)
	for seed := int64(0); seed < 200; seed++ {
		budget := 37 + int(seed%20)
		turns := AllocateTurns(universe, budget, rand.New(rand.NewSource(seed)))
		if len(turns) != budget {
			t.Fatalf("seed %d: %d turnos, want %d", seed, len(turns), budget)
		}
		per := turnsPerAsset(turns)
		for _, e := range universe {
			if per[e.AssetID] < 1 {
				t.Fatalf("seed %d: ativo %s sem turno de piso", seed, e.AssetID)
			}
		}
		floors := map[string]int{}
		for _, tn := range turns {
			if tn.Floor {
				floors[tn.AssetID]++
			}
		}
		for _, e := range universe {
			if floors[e.AssetID] != 1 {
				t.Fatalf("seed %d: ativo %s com %d turnos de piso, want 1", seed, e.AssetID, floors[e.AssetID])
			}
		}
	}
}

func TestAllocateTurns_BudgetMenorQueOsAtivosViraUmPorAtivo(t *testing.T) {
	universe := weightedUniverse(3, 2, 1)
	turns := AllocateTurns(universe, 1, rand.New(rand.NewSource(1)))
	if len(turns) != 3 {
		t.Fatalf("%d turnos, want 3 (um por ativo)", len(turns))
	}
}

func TestAllocateTurns_VazioSemAtivos(t *testing.T) {
	if turns := AllocateTurns(nil, 10, rand.New(rand.NewSource(1))); turns != nil {
		t.Fatalf("turns = %v, want nil", turns)
	}
}

// O ativo maior recebe proporcionalmente mais turnos além do piso, na proporção
// do peso misto (metade uniforme, metade valor de mercado), em média sobre dias.
func TestAllocateTurns_MaiorAtivoRecebeMaisTurnos(t *testing.T) {
	universe := weightedUniverse(30, 10, 1)
	const days, budget = 20000, 100
	total := map[string]float64{}
	for d := 0; d < days; d++ {
		for id, c := range turnsPerAsset(AllocateTurns(universe, budget, rand.New(rand.NewSource(int64(d))))) {
			total[id] += float64(c)
		}
	}
	extra := float64(budget - len(universe))
	for i, v := range []float64{30, 10, 1} {
		weight := (1-MarketValueWeight)/3 + MarketValueWeight*v/41
		want := 1 + extra*weight
		got := total[universe[i].AssetID] / days
		if math.Abs(got-want) > 0.05 {
			t.Errorf("ativo %d: média de %.3f turnos por dia, want %.3f", i, got, want)
		}
	}
}

func TestAllocateTurns_SemValorDeMercadoReparteUniforme(t *testing.T) {
	universe := weightedUniverse(0, 0, 0, 0)
	turns := AllocateTurns(universe, 40, rand.New(rand.NewSource(3)))
	for id, c := range turnsPerAsset(turns) {
		if c != 10 {
			t.Errorf("ativo %s recebeu %d turnos, want 10", id, c)
		}
	}
}

func TestAllocateTurns_Deterministico(t *testing.T) {
	universe := weightedUniverse(30, 10, 1)
	first := AllocateTurns(universe, 50, rand.New(rand.NewSource(9)))
	second := AllocateTurns(universe, 50, rand.New(rand.NewSource(9)))
	for i := range first {
		if first[i] != second[i] {
			t.Fatalf("turno %d difere entre chamadas com a mesma seed: %+v vs %+v", i, first[i], second[i])
		}
	}
}

func TestSelectBotForTurn(t *testing.T) {
	mineracao, err := NewSpecializationScope([]catalog.Sector{catalog.SectorMineracao}, nil, nil, 0.85)
	if err != nil {
		t.Fatal(err)
	}
	fiis, err := NewSpecializationScope(nil, nil, []catalog.AssetType{catalog.AssetFII}, 0.85)
	if err != nil {
		t.Fatal(err)
	}
	asset := EquityForRound{AssetID: "a", Sector: catalog.SectorMineracao, RiskClass: equity.RiskClassConservador, Type: catalog.AssetAcao}

	if got := SelectBotForTurn(asset, nil, rand.New(rand.NewSource(1))); got != -1 {
		t.Fatalf("sem bots: %d, want -1", got)
	}

	scopes := []SpecializationScope{fiis, mineracao, fiis}
	rng := rand.New(rand.NewSource(1))
	const draws = 20000
	inScope := 0
	for i := 0; i < draws; i++ {
		idx := SelectBotForTurn(asset, scopes, rng)
		if idx < 0 || idx >= len(scopes) {
			t.Fatalf("índice fora do intervalo: %d", idx)
		}
		if idx == 1 {
			inScope++
		}
	}
	if got := float64(inScope) / draws; math.Abs(got-TurnWithinScopePct) > 0.02 {
		t.Errorf("fração dentro do escopo = %.3f, want ~%.3f", got, TurnWithinScopePct)
	}

	// Nenhum bot cobre o ativo: cai para os de fora, nunca devolve -1.
	if got := SelectBotForTurn(asset, []SpecializationScope{fiis}, rng); got != 0 {
		t.Errorf("só bots fora do escopo: %d, want 0", got)
	}
	// Todos cobrem o ativo: não há grupo de fora.
	if got := SelectBotForTurn(asset, []SpecializationScope{mineracao}, rng); got != 0 {
		t.Errorf("só bots dentro do escopo: %d, want 0", got)
	}
}
