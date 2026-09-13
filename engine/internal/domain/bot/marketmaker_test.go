package bot

import (
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

func TestDecideMarketMakerOrders_SempreOfertaDoisLadosComRecursoSuficiente(t *testing.T) {
	tests := []struct {
		name               string
		referencePrice     float64
		spreadWidthPct     float64
		maxPositionSizePct float64
		availableCash      float64
		currentPosition    int
	}{
		{name: "spread estreito, recursos generosos", referencePrice: 50, spreadWidthPct: 0.02, maxPositionSizePct: 0.5, availableCash: 100_000, currentPosition: 10_000},
		{name: "spread largo, recursos generosos", referencePrice: 10, spreadWidthPct: 0.20, maxPositionSizePct: 0.1, availableCash: 5_000, currentPosition: 500},
		{name: "fração pequena, recursos generosos (piso de 1 não deveria disparar)", referencePrice: 100, spreadWidthPct: 0.05, maxPositionSizePct: 0.9, availableCash: 1_000_000, currentPosition: 50_000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			personality := mustMarketMakerPersonality(t, tt.spreadWidthPct, tt.maxPositionSizePct)
			decisions, err := DecideMarketMakerOrders(personality, tt.referencePrice, tt.availableCash, tt.currentPosition)
			if err != nil {
				t.Fatalf("err = %v, want nil", err)
			}
			if len(decisions) != 2 {
				t.Fatalf("len(decisions) = %d, want 2", len(decisions))
			}

			bid, ask := decisions[0], decisions[1]
			if bid.Side != orderbook.SideBuy {
				t.Fatalf("decisions[0].Side = %v, want buy", bid.Side)
			}
			if ask.Side != orderbook.SideSell {
				t.Fatalf("decisions[1].Side = %v, want sell", ask.Side)
			}
			if bid.Price >= ask.Price {
				t.Fatalf("bid.Price (%.4f) >= ask.Price (%.4f), want bid < ask", bid.Price, ask.Price)
			}
			if bid.Quantity < 1 || ask.Quantity < 1 {
				t.Fatalf("quantidades devem ser >= 1: bid=%d ask=%d", bid.Quantity, ask.Quantity)
			}
			if cost := bid.Price * float64(bid.Quantity); cost > tt.availableCash+1e-9 {
				t.Fatalf("custo do bid (%.4f) excede caixa disponível (%.4f)", cost, tt.availableCash)
			}
			if ask.Quantity > tt.currentPosition {
				t.Fatalf("quantidade do ask (%d) excede posição atual (%d)", ask.Quantity, tt.currentPosition)
			}
		})
	}
}

func TestDecideMarketMakerOrders_SpreadSimetricoAoRedorDoPrecoDeReferencia(t *testing.T) {
	referencePrice := 40.0
	spreadWidthPct := 0.10
	personality := mustMarketMakerPersonality(t, spreadWidthPct, 0.5)

	decisions, err := DecideMarketMakerOrders(personality, referencePrice, 1_000_000, 1_000_000)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	wantBid := referencePrice * (1 - spreadWidthPct/2)
	wantAsk := referencePrice * (1 + spreadWidthPct/2)
	if decisions[0].Price != wantBid {
		t.Fatalf("bid price = %.6f, want %.6f", decisions[0].Price, wantBid)
	}
	if decisions[1].Price != wantAsk {
		t.Fatalf("ask price = %.6f, want %.6f", decisions[1].Price, wantAsk)
	}
}

func TestDecideMarketMakerOrders_Deterministico(t *testing.T) {
	personality := mustMarketMakerPersonality(t, 0.04, 0.3)
	first, err := DecideMarketMakerOrders(personality, 33.33, 10_000, 300)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	second, err := DecideMarketMakerOrders(personality, 33.33, 10_000, 300)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(first) != len(second) {
		t.Fatalf("chamadas repetidas com o mesmo estado devolveram tamanhos diferentes: %d != %d", len(first), len(second))
	}
	for i := range first {
		if first[i] != second[i] {
			t.Fatalf("chamadas repetidas com o mesmo estado devolveram decisões diferentes: %+v != %+v", first[i], second[i])
		}
	}
}

func TestDecideMarketMakerOrders_ApenasLadoDeVendaSemCaixa(t *testing.T) {
	personality := mustMarketMakerPersonality(t, 0.05, 0.5)
	decisions, err := DecideMarketMakerOrders(personality, 20, 0, 100)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(decisions) != 1 {
		t.Fatalf("len(decisions) = %d, want 1", len(decisions))
	}
	if decisions[0].Side != orderbook.SideSell {
		t.Fatalf("Side = %v, want sell", decisions[0].Side)
	}
	if decisions[0].Quantity > 100 {
		t.Fatalf("Quantity = %d, want <= 100", decisions[0].Quantity)
	}
}

func TestDecideMarketMakerOrders_ApenasLadoDeCompraSemPosicao(t *testing.T) {
	personality := mustMarketMakerPersonality(t, 0.05, 0.5)
	decisions, err := DecideMarketMakerOrders(personality, 20, 100_000, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(decisions) != 1 {
		t.Fatalf("len(decisions) = %d, want 1", len(decisions))
	}
	if decisions[0].Side != orderbook.SideBuy {
		t.Fatalf("Side = %v, want buy", decisions[0].Side)
	}
}

func TestDecideMarketMakerOrders_SustentaOfertaAoLongoDeVariasRodadas(t *testing.T) {
	personality := mustMarketMakerPersonality(t, 0.05, 0.5)
	referencePrice := 25.0

	cash, position := 1_000.0, 40
	for round := 0; round < 5; round++ {
		decisions, err := DecideMarketMakerOrders(personality, referencePrice, cash, position)
		if err != nil {
			t.Fatalf("rodada %d: err = %v, want nil", round, err)
		}
		if len(decisions) != 2 {
			t.Fatalf("rodada %d: len(decisions) = %d, want 2 (recurso ainda suficiente)", round, len(decisions))
		}
		// Simula um fill total dos dois lados: caixa/posição mudam pra
		// próxima rodada, e a próxima chamada deve reabastecer os dois
		// lados de novo, recalculados sobre o novo estado — não é preciso
		// nenhum estado guardado entre chamadas.
		bid, ask := decisions[0], decisions[1]
		cash = cash - bid.Price*float64(bid.Quantity) + ask.Price*float64(ask.Quantity)
		position = position - ask.Quantity + bid.Quantity
	}
}

func TestDecideMarketMakerOrders_ErroSemCaixaNemPosicao(t *testing.T) {
	personality := mustMarketMakerPersonality(t, 0.05, 0.5)
	_, err := DecideMarketMakerOrders(personality, 20, 0, 0)
	if !errors.Is(err, ErrNoViableOrder) {
		t.Fatalf("err = %v, want %v", err, ErrNoViableOrder)
	}
}

func TestDecideMarketMakerOrders_ErroArquetipoErrado(t *testing.T) {
	riskProfile, err := NewRiskProfile(0.5, 0.5, 0.05)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	scope := validScope(t)
	personality, err := NewPersonality(ArchetypeRuido, scope, nil, riskProfile)
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}

	_, err = DecideMarketMakerOrders(personality, 20, 1_000, 100)
	if !errors.Is(err, ErrWrongArchetype) {
		t.Fatalf("err = %v, want %v", err, ErrWrongArchetype)
	}
}

func TestDecideMarketMakerOrders_ErroPrecoDeReferenciaInvalido(t *testing.T) {
	personality := mustMarketMakerPersonality(t, 0.05, 0.5)
	for _, price := range []float64{0, -1} {
		_, err := DecideMarketMakerOrders(personality, price, 1_000, 100)
		if !errors.Is(err, ErrInvalidReferencePrice) {
			t.Fatalf("referencePrice %v: err = %v, want %v", price, err, ErrInvalidReferencePrice)
		}
	}
}

func TestDecideMarketMakerOrders_ErroSpreadInvalido(t *testing.T) {
	personality := mustMarketMakerPersonality(t, 2.0, 0.5)
	_, err := DecideMarketMakerOrders(personality, 20, 1_000, 100)
	if !errors.Is(err, ErrInvalidSpreadForQuote) {
		t.Fatalf("err = %v, want %v", err, ErrInvalidSpreadForQuote)
	}
}

// mustMarketMakerPersonality monta uma Personality válida do arquétipo
// Market Maker com o escopo de setup padrão (validScope) e o spread/fração
// de posição pedidos pelo teste.
func mustMarketMakerPersonality(t *testing.T, spreadWidthPct, maxPositionSizePct float64) Personality {
	t.Helper()
	riskProfile, err := NewRiskProfile(maxPositionSizePct, 0.5, spreadWidthPct)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	scope := validScope(t)
	personality, err := NewPersonality(ArchetypeMarketMaker, scope, nil, riskProfile)
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}
	return personality
}
