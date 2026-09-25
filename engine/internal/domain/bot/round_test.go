package bot

import (
	"errors"
	"math"
	"math/rand"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/orderbook"
)

func TestSpecializationScope_MatchesEquity(t *testing.T) {
	scope, err := NewSpecializationScope(
		[]catalog.Sector{catalog.SectorMineracao},
		[]equity.RiskClass{equity.RiskClassSofisticado},
		nil, 0.85,
	)
	if err != nil {
		t.Fatalf("scope de setup inválido: %v", err)
	}

	tests := []struct {
		name      string
		sector    catalog.Sector
		riskClass equity.RiskClass
		want      bool
	}{
		{"bate por setor", catalog.SectorMineracao, equity.RiskClassConservador, true},
		{"bate por risk_class", catalog.SectorVarejo, equity.RiskClassSofisticado, true},
		{"bate pelos dois", catalog.SectorMineracao, equity.RiskClassSofisticado, true},
		{"não bate em nenhum", catalog.SectorVarejo, equity.RiskClassConservador, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := scope.MatchesEquity(tt.sector, tt.riskClass, ""); got != tt.want {
				t.Errorf("MatchesEquity(%v, %v, \"\") = %v, want %v", tt.sector, tt.riskClass, got, tt.want)
			}
		})
	}
}

// TestSpecializationScope_MatchesEquity_PorClasseDeAtivo cobre a tarefa
// G.1: FII não tem setor nem risk_class própria (spec 3.6), então o único
// jeito de um bot especializado em FII (AssetClasses, C.6) alcançá-lo é essa
// terceira via de match, independente de Sector/RiskClass.
func TestSpecializationScope_MatchesEquity_PorClasseDeAtivo(t *testing.T) {
	scope, err := NewSpecializationScope(nil, nil, []catalog.AssetType{catalog.AssetFII}, 0.85)
	if err != nil {
		t.Fatalf("scope de setup inválido: %v", err)
	}

	if !scope.MatchesEquity("", "", catalog.AssetFII) {
		t.Error("MatchesEquity(\"\", \"\", AssetFII) = false, want true (bot especializado em FII)")
	}
	if scope.MatchesEquity("", "", catalog.AssetETF) {
		t.Error("MatchesEquity(\"\", \"\", AssetETF) = true, want false (escopo não cobre ETF)")
	}
}

func TestSelectAssetForRound_ErrNoEquityAvailable(t *testing.T) {
	scope := validScope(t)
	rng := rand.New(rand.NewSource(1))

	_, err := SelectAssetForRound(scope, nil, rng)
	if !errors.Is(err, ErrNoEquityAvailable) {
		t.Fatalf("err = %v, want ErrNoEquityAvailable", err)
	}
}

func TestSelectAssetForRound_ScopeCobreTudoSempreEscolheDoUniverso(t *testing.T) {
	// Escopo do Market Maker (C.6): cobre todo o universo, sem "fora do
	// escopo" possível — SelectAssetForRound nunca deveria devolver algo
	// fora dele, mesmo quando o sorteio "quis" ir pro grupo de fora.
	scope, err := NewSpecializationScope([]catalog.Sector{catalog.SectorMineracao, catalog.SectorVarejo}, nil, nil, 0.85)
	if err != nil {
		t.Fatalf("scope de setup inválido: %v", err)
	}
	universe := []EquityForRound{
		{AssetID: "a1", Sector: catalog.SectorMineracao},
		{AssetID: "a2", Sector: catalog.SectorVarejo},
	}

	rng := rand.New(rand.NewSource(1))
	for i := 0; i < 200; i++ {
		got, err := SelectAssetForRound(scope, universe, rng)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if got.AssetID != "a1" && got.AssetID != "a2" {
			t.Fatalf("SelectAssetForRound devolveu ativo fora do universo: %+v", got)
		}
	}
}

func TestSelectAssetForRound_EscopoSemNenhumBateSempreCaiPraFora(t *testing.T) {
	scope := validScope(t) // Mineração
	universe := []EquityForRound{
		{AssetID: "a1", Sector: catalog.SectorVarejo},
		{AssetID: "a2", Sector: catalog.SectorEnergia},
	}

	rng := rand.New(rand.NewSource(1))
	for i := 0; i < 50; i++ {
		got, err := SelectAssetForRound(scope, universe, rng)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if got.AssetID != "a1" && got.AssetID != "a2" {
			t.Fatalf("SelectAssetForRound devolveu ativo fora do universo: %+v", got)
		}
	}
}

func TestSelectAssetForRound_DistribuicaorespeitaWithinScopePct(t *testing.T) {
	scope, err := NewSpecializationScope([]catalog.Sector{catalog.SectorMineracao}, nil, nil, 0.85)
	if err != nil {
		t.Fatalf("scope de setup inválido: %v", err)
	}
	universe := []EquityForRound{
		{AssetID: "dentro", Sector: catalog.SectorMineracao},
		{AssetID: "fora", Sector: catalog.SectorVarejo},
	}

	rng := rand.New(rand.NewSource(7))
	const samples = 20000
	within := 0
	for i := 0; i < samples; i++ {
		got, err := SelectAssetForRound(scope, universe, rng)
		if err != nil {
			t.Fatalf("err = %v, want nil", err)
		}
		if got.AssetID == "dentro" {
			within++
		}
	}

	gotPct := float64(within) / float64(samples)
	if gotPct < 0.80 || gotPct > 0.90 {
		t.Fatalf("fração dentro do escopo = %.4f, want perto de 0.85 (WithinScopePct)", gotPct)
	}
}

func TestSelectAssetForRound_Deterministico(t *testing.T) {
	scope := validScope(t)
	universe := []EquityForRound{
		{AssetID: "a1", Sector: catalog.SectorMineracao},
		{AssetID: "a2", Sector: catalog.SectorVarejo},
	}

	first, err := SelectAssetForRound(scope, universe, rand.New(rand.NewSource(99)))
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	second, err := SelectAssetForRound(scope, universe, rand.New(rand.NewSource(99)))
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if first != second {
		t.Fatalf("SelectAssetForRound não determinístico pra mesma seed: %+v vs %+v", first, second)
	}
}

func TestDecide_Ruido(t *testing.T) {
	personality, err := NewPersonality(ArchetypeRuido, validScope(t), nil, validRiskProfile(t))
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}

	decisions, err := Decide(personality, DecisionInput{ReferencePrice: 100, AvailableCash: 10_000, CurrentPosition: 50, Seed: 1})
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(decisions) != 1 {
		t.Fatalf("len(decisions) = %d, want 1", len(decisions))
	}
}

func TestDecide_Ruido_PropagaErroDeDecisao(t *testing.T) {
	personality, err := NewPersonality(ArchetypeRuido, validScope(t), nil, validRiskProfile(t))
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}

	_, err = Decide(personality, DecisionInput{ReferencePrice: 100, AvailableCash: 0, CurrentPosition: 0, Seed: 1})
	if !errors.Is(err, ErrNoViableOrder) {
		t.Fatalf("err = %v, want ErrNoViableOrder", err)
	}
}

func TestDecide_MarketMaker(t *testing.T) {
	riskProfile, err := NewRiskProfile(0.5, 0.5, 0.02)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	personality, err := NewPersonality(ArchetypeMarketMaker, validScope(t), nil, riskProfile)
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}

	decisions, err := Decide(personality, DecisionInput{ReferencePrice: 100, AvailableCash: 10_000, CurrentPosition: 50})
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(decisions) != 2 {
		t.Fatalf("len(decisions) = %d, want 2 (compra + venda)", len(decisions))
	}
}

func TestDecide_Chartista(t *testing.T) {
	personality := mustChartistPersonality(t, 0.5)

	decisions, err := Decide(personality, DecisionInput{
		PriceHistory:    []float64{10, 10.5, 11, 11.5, 12},
		AvailableCash:   10_000,
		CurrentPosition: 50,
	})
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(decisions) != 1 || decisions[0].Side != orderbook.SideBuy {
		t.Fatalf("decisions = %+v, want 1 decisão de compra (tendência de alta)", decisions)
	}
}

func TestDecide_Fundamentalista(t *testing.T) {
	personality := mustFundamentalistPersonality(t, 1, 0.5) // conhecimento=1: sem ruído

	decisions, err := Decide(personality, DecisionInput{
		Financials:        fundamentals.Financials{NetIncome: 100_000, NetEquity: 1_000_000},
		OutstandingShares: 100_000,
		GrowthRate:        0.03,
		ReferencePrice:    5, // preço justo ~10.3 (financialsFixture) — bem abaixo, compra clara
		SelicAnnualRate:   0.10,
		SelicNeutral:      0.10,
		RiskClass:         equity.RiskClassConservador,
		AvailableCash:     10_000,
		CurrentPosition:   50,
	})
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(decisions) != 1 || decisions[0].Side != orderbook.SideBuy {
		t.Fatalf("decisions = %+v, want 1 decisão de compra (mercado abaixo do preço justo)", decisions)
	}
}

func TestDecide_ArquetipoDesconhecido(t *testing.T) {
	personality := Personality{Archetype: Archetype("desconhecido"), Scope: validScope(t), RiskProfile: validRiskProfile(t)}

	_, err := Decide(personality, DecisionInput{})
	if !errors.Is(err, ErrUnknownArchetype) {
		t.Fatalf("err = %v, want ErrUnknownArchetype", err)
	}
}

func weightedUniverse(values ...float64) []EquityForRound {
	universe := make([]EquityForRound, len(values))
	for i, v := range values {
		universe[i] = EquityForRound{AssetID: string(rune('a' + i)), Sector: catalog.SectorMineracao, RiskClass: equity.RiskClassConservador, Type: catalog.AssetAcao, MarketValue: v}
	}
	return universe
}

func frequencies(t *testing.T, universe []EquityForRound, draws int, seed int64) map[string]float64 {
	t.Helper()
	scope, err := NewSpecializationScope([]catalog.Sector{catalog.SectorMineracao}, nil, nil, 0.85)
	if err != nil {
		t.Fatal(err)
	}
	rng := rand.New(rand.NewSource(seed))
	counts := map[string]int{}
	for i := 0; i < draws; i++ {
		e, err := SelectAssetForRound(scope, universe, rng)
		if err != nil {
			t.Fatal(err)
		}
		counts[e.AssetID]++
	}
	freq := map[string]float64{}
	for id, c := range counts {
		freq[id] = float64(c) / float64(draws)
	}
	return freq
}

// Q.3: ativo de maior valor de mercado recebe proporcionalmente mais turnos, na
// proporção do peso misto (metade uniforme, metade valor de mercado).
func TestSelectAssetForRound_PonderaPorValorDeMercado(t *testing.T) {
	// Valores 30x, 10x e 1x: participações de 73%, 24% e 2,4%.
	universe := weightedUniverse(30, 10, 1)
	freq := frequencies(t, universe, 200_000, 1)

	total := 41.0
	for i, v := range []float64{30, 10, 1} {
		want := (1-MarketValueWeight)/3 + MarketValueWeight*v/total
		got := freq[universe[i].AssetID]
		if math.Abs(got-want) > 0.01 {
			t.Errorf("ativo %s (valor %v): frequência %.4f, want %.4f", universe[i].AssetID, v, got, want)
		}
	}
	if freq["a"] <= freq["b"] || freq["b"] <= freq["c"] {
		t.Errorf("ordem de frequência não segue o valor de mercado: %v", freq)
	}
}

// O menor ativo nunca cai abaixo de (1 - MarketValueWeight) da taxa uniforme,
// por maior que seja a diferença de tamanho: nenhum ativo é esquecido.
func TestSelectAssetForRound_PisoUniformeParaOMenorAtivo(t *testing.T) {
	universe := weightedUniverse(1_000_000, 1_000_000, 1_000_000, 1) // o menor vale 3e-7 do total
	uniform := 1.0 / float64(len(universe))
	freq := frequencies(t, universe, 200_000, 2)

	floor := (1 - MarketValueWeight) * uniform
	if got := freq["d"]; got < floor*0.9 {
		t.Errorf("menor ativo com frequência %.4f, want pelo menos %.4f (piso)", got, floor)
	}
}

// Sem nenhum valor de mercado conhecido (float desconhecido), o sorteio é
// uniforme.
func TestSelectAssetForRound_SemValorDeMercadoEUniforme(t *testing.T) {
	freq := frequencies(t, weightedUniverse(0, 0, 0, 0), 200_000, 3)
	for id, f := range freq {
		if math.Abs(f-0.25) > 0.01 {
			t.Errorf("ativo %s: frequência %.4f, want 0.25", id, f)
		}
	}
}

// Mesma seed, mesma sequência de ativos (RNF08).
func TestSelectAssetForRound_PonderadoDeterministico(t *testing.T) {
	universe := weightedUniverse(5, 3, 9, 1)
	scope, _ := NewSpecializationScope([]catalog.Sector{catalog.SectorMineracao}, nil, nil, 0.85)
	a, b := rand.New(rand.NewSource(7)), rand.New(rand.NewSource(7))
	for i := 0; i < 500; i++ {
		x, _ := SelectAssetForRound(scope, universe, a)
		y, _ := SelectAssetForRound(scope, universe, b)
		if x.AssetID != y.AssetID {
			t.Fatalf("sorteio %d diverge: %s vs %s", i, x.AssetID, y.AssetID)
		}
	}
}

// A ponderação atua dentro do grupo (escopo ou fora dele): a divisão entre os
// dois grupos continua sendo WithinScopePct.
func TestSelectAssetForRound_MantemDivisaoEscopoForaDoEscopo(t *testing.T) {
	universe := []EquityForRound{
		{AssetID: "in1", Sector: catalog.SectorMineracao, Type: catalog.AssetAcao, MarketValue: 100},
		{AssetID: "in2", Sector: catalog.SectorMineracao, Type: catalog.AssetAcao, MarketValue: 1},
		{AssetID: "out", Sector: catalog.SectorBancario, Type: catalog.AssetAcao, MarketValue: 1_000_000},
	}
	freq := frequencies(t, universe, 200_000, 4)
	if got := freq["in1"] + freq["in2"]; math.Abs(got-0.85) > 0.01 {
		t.Errorf("fração dentro do escopo = %.4f, want 0.85 (WithinScopePct)", got)
	}
	if freq["in1"] <= freq["in2"] {
		t.Errorf("dentro do escopo, o maior ativo deveria receber mais: %v", freq)
	}
}
