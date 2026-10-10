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

func candidatesOf(archetype Archetype, scopes ...SpecializationScope) []TurnCandidate {
	out := make([]TurnCandidate, len(scopes))
	for i, sc := range scopes {
		out[i] = TurnCandidate{Scope: sc, Archetype: archetype}
	}
	return out
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

	if got := SelectBotForTurn(asset, nil, false, rand.New(rand.NewSource(1))); got != -1 {
		t.Fatalf("sem bots: %d, want -1", got)
	}

	candidates := candidatesOf(ArchetypeRuido, fiis, mineracao, fiis)
	rng := rand.New(rand.NewSource(1))
	const draws = 20000
	inScope := 0
	for i := 0; i < draws; i++ {
		idx := SelectBotForTurn(asset, candidates, false, rng)
		if idx < 0 || idx >= len(candidates) {
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
	if got := SelectBotForTurn(asset, candidatesOf(ArchetypeRuido, fiis), false, rng); got != 0 {
		t.Errorf("só bots fora do escopo: %d, want 0", got)
	}
	// Todos cobrem o ativo: não há grupo de fora.
	if got := SelectBotForTurn(asset, candidatesOf(ArchetypeRuido, mineracao), false, rng); got != 0 {
		t.Errorf("só bots dentro do escopo: %d, want 0", got)
	}
}

// Q.10: num turno sob atenção, AttentionFundamentalistShare das vezes só os
// Fundamentalistas concorrem; sem atenção o arquétipo não pesa.
func TestSelectBotForTurn_AtencaoPrefereFundamentalista(t *testing.T) {
	mineracao, err := NewSpecializationScope([]catalog.Sector{catalog.SectorMineracao}, nil, nil, 0.85)
	if err != nil {
		t.Fatal(err)
	}
	asset := EquityForRound{AssetID: "a", Sector: catalog.SectorMineracao, RiskClass: equity.RiskClassConservador, Type: catalog.AssetAcao}
	candidates := []TurnCandidate{
		{Scope: mineracao, Archetype: ArchetypeRuido},
		{Scope: mineracao, Archetype: ArchetypeChartista},
		{Scope: mineracao, Archetype: ArchetypeFundamentalista},
		{Scope: mineracao, Archetype: ArchetypeRuido},
	}
	share := func(attention bool) float64 {
		rng := rand.New(rand.NewSource(5))
		fund := 0
		const draws = 20000
		for i := 0; i < draws; i++ {
			if candidates[SelectBotForTurn(asset, candidates, attention, rng)].Archetype == ArchetypeFundamentalista {
				fund++
			}
		}
		return float64(fund) / draws
	}
	// Com atenção: 75% só Fundamentalista mais 25% uniforme entre os 4 (1/4 deles).
	if got, want := share(true), AttentionFundamentalistShare+(1-AttentionFundamentalistShare)/4; math.Abs(got-want) > 0.02 {
		t.Errorf("com atenção: %.3f, want ~%.3f", got, want)
	}
	if got := share(false); math.Abs(got-0.25) > 0.02 {
		t.Errorf("sem atenção: %.3f, want ~0,25 (uniforme)", got)
	}
	// Sem nenhum Fundamentalista, a atenção não bloqueia o turno.
	noFund := candidates[:2]
	if got := SelectBotForTurn(asset, noFund, true, rand.New(rand.NewSource(1))); got < 0 {
		t.Errorf("sem Fundamentalista: %d, want um bot qualquer", got)
	}
}

func TestAttentionMultiplier(t *testing.T) {
	if got := AttentionMultiplier(0); got != 1 {
		t.Errorf("sem evento: %v, want 1", got)
	}
	if got := AttentionMultiplier(-25); got != 1+AttentionBoost {
		t.Errorf("evento severo negativo: %v, want %v", got, 1+AttentionBoost)
	}
	if AttentionMultiplier(25) != AttentionMultiplier(-25) {
		t.Error("a atenção depende só da magnitude, não do sinal")
	}
	if got := AttentionMultiplier(AttentionFullEffectPct / 2); math.Abs(got-(1+AttentionBoost/2)) > 1e-12 {
		t.Errorf("meio efeito: %v, want %v", got, 1+AttentionBoost/2)
	}
}

// Q.10: o ativo em atenção recebe mais turnos, o orçamento total não muda, o
// piso continua valendo e os turnos dele levam a marca de atenção.
func TestAllocateTurns_AtencaoRedistribuiSemMudarOOrcamento(t *testing.T) {
	universe := weightedUniverse(1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
	const days, budget = 5000, 40
	var base, boosted float64
	for d := 0; d < days; d++ {
		plain := turnsPerAsset(AllocateTurns(universe, budget, rand.New(rand.NewSource(int64(d)))))
		base += float64(plain[universe[0].AssetID])

		hot := append([]EquityForRound(nil), universe...)
		hot[0].Attention = 1 + AttentionBoost
		turns := AllocateTurns(hot, budget, rand.New(rand.NewSource(int64(d))))
		if len(turns) != budget {
			t.Fatalf("dia %d: %d turnos, want %d (orçamento fixo)", d, len(turns), budget)
		}
		per := turnsPerAsset(turns)
		boosted += float64(per[hot[0].AssetID])
		for _, e := range hot {
			if per[e.AssetID] < 1 {
				t.Fatalf("dia %d: ativo %s perdeu o piso", d, e.AssetID)
			}
		}
		for _, tn := range turns {
			if tn.Attention != (tn.AssetID == hot[0].AssetID) {
				t.Fatalf("marca de atenção errada no turno %+v", tn)
			}
		}
	}
	if boosted/days <= 1.5*base/days {
		t.Errorf("turnos médios com atenção %.2f, sem %.2f: want bem mais com atenção", boosted/days, base/days)
	}
}
