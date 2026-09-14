package bot

import (
	"errors"
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
			if got := scope.MatchesEquity(tt.sector, tt.riskClass); got != tt.want {
				t.Errorf("MatchesEquity(%v, %v) = %v, want %v", tt.sector, tt.riskClass, got, tt.want)
			}
		})
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
