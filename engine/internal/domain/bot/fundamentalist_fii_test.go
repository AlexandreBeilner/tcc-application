package bot

import (
	"errors"
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

// fiiFixture: patrimônio de 1.000.000 em 100.000 cotas (VP 10) com P/VP-alvo
// 0,8 (preço justo 8,00).
func fiiFixture() (FIIFairPriceInput, int64) {
	return FIIFairPriceInput{BaseValue: 1_000_000, TargetPriceToBook: 0.8}, 100_000
}

func TestDecideFundamentalistFIIOrder_DirecaoConformeAoDesvio(t *testing.T) {
	input, shares := fiiFixture()
	const fairPrice = 8.0
	// knowledgeLevel = 1 elimina o ruído, então o limite da ordem é o preço justo exato.
	personality := mustFundamentalistPersonality(t, 1.0, 0.5)

	tests := []struct {
		name         string
		marketPrice  float64
		cash         float64
		position     int
		wantSide     orderbook.Side
		wantErr      error
		wantLimitEqs float64
	}{
		{"mercado abaixo do justo, compra", fairPrice * 0.5, 1_000_000, 0, orderbook.SideBuy, nil, fairPrice},
		{"mercado acima do justo, vende", fairPrice * 2, 0, 1_000, orderbook.SideSell, nil, fairPrice},
		{"dentro do limiar, sem mispricing", fairPrice * 1.005, 1_000_000, 1_000, "", ErrNoMispricingDetected, 0},
		{"compra sem caixa, sem ordem viável", fairPrice * 0.5, 0, 0, "", ErrNoViableOrder, 0},
		{"venda sem posição, sem ordem viável", fairPrice * 2, 0, 0, "", ErrNoViableOrder, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := DecideFundamentalistFIIOrder(personality, input, shares, tt.marketPrice, tt.cash, tt.position, 1, nil)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr != nil {
				return
			}
			if got.Side != tt.wantSide || got.Type != orderbook.TypeLimit {
				t.Fatalf("got side=%v type=%v, want side=%v limit", got.Side, got.Type, tt.wantSide)
			}
			if math.Abs(got.Price-tt.wantLimitEqs) > 1e-9 {
				t.Fatalf("Price = %.6f, want %.6f (preço justo)", got.Price, tt.wantLimitEqs)
			}
		})
	}
}

func TestDecideFundamentalistFIIOrder_EfeitoDeProventoDesloca(t *testing.T) {
	input, shares := fiiFixture()
	input.DividendEffectPct = -10
	personality := mustFundamentalistPersonality(t, 1.0, 0.5)

	got, err := DecideFundamentalistFIIOrder(personality, input, shares, 8, 1_000_000, 1_000, 1, nil)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	// justo 7,20 contra mercado 8,00: vende, limitado a 7,20.
	if got.Side != orderbook.SideSell || math.Abs(got.Price-7.2) > 1e-9 {
		t.Fatalf("got side=%v price=%.4f, want sell @ 7.20", got.Side, got.Price)
	}
}

func TestDecideFundamentalistFIIOrder_TetoDeTamanhoDeOrdem(t *testing.T) {
	input, shares := fiiFixture()
	personality := mustFundamentalistPersonality(t, 1.0, 1.0)
	ceiling := int64(25)

	got, err := DecideFundamentalistFIIOrder(personality, input, shares, 4, 1_000_000, 0, 1, &ceiling)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if got.Quantity <= 0 || int64(got.Quantity) > ceiling {
		t.Fatalf("Quantity = %d, want 1..%d", got.Quantity, ceiling)
	}
}

func TestDecideFundamentalistFIIOrder_RuidoDependeDoConhecimento(t *testing.T) {
	input, shares := fiiFixture()
	low := mustFundamentalistPersonality(t, 0.0, 0.5)
	got, err := DecideFundamentalistFIIOrder(low, input, shares, 4, 1_000_000, 0, 7, nil)
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if got.Price == 8.0 {
		t.Fatalf("conhecimento 0 deveria ruidar o preço justo, got exatamente 8.00")
	}
}

func TestDecideFundamentalistFIIOrder_Erros(t *testing.T) {
	input, shares := fiiFixture()
	personality := mustFundamentalistPersonality(t, 1.0, 0.5)

	if _, err := DecideFundamentalistFIIOrder(personality, input, 0, 4, 1_000, 0, 1, nil); !errors.Is(err, ErrInvalidFinancials) {
		t.Fatalf("cotas zero: err = %v, want %v", err, ErrInvalidFinancials)
	}
	if _, err := DecideFundamentalistFIIOrder(personality, input, shares, 0, 1_000, 0, 1, nil); !errors.Is(err, ErrInvalidReferencePrice) {
		t.Fatalf("preço inválido: err = %v, want %v", err, ErrInvalidReferencePrice)
	}
	noise := Personality{Archetype: ArchetypeRuido}
	if _, err := DecideFundamentalistFIIOrder(noise, input, shares, 4, 1_000, 0, 1, nil); !errors.Is(err, ErrWrongArchetype) {
		t.Fatalf("arquétipo errado: err = %v, want %v", err, ErrWrongArchetype)
	}
	noKnowledge := personality
	noKnowledge.KnowledgeLevel = nil
	if _, err := DecideFundamentalistFIIOrder(noKnowledge, input, shares, 4, 1_000, 0, 1, nil); !errors.Is(err, ErrMissingKnowledgeLevel) {
		t.Fatalf("sem conhecimento: err = %v, want %v", err, ErrMissingKnowledgeLevel)
	}
}

func TestDecide_FundamentalistaComFIIUsaPrecoJustoDeFII(t *testing.T) {
	input, shares := fiiFixture()
	personality := mustFundamentalistPersonality(t, 1.0, 0.5)

	decisions, err := Decide(personality, DecisionInput{
		ReferencePrice: 4, AvailableCash: 1_000_000, OutstandingShares: shares, FII: &input, Seed: 1,
	})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if len(decisions) != 1 || decisions[0].Side != orderbook.SideBuy || math.Abs(decisions[0].Price-8.0) > 1e-9 {
		t.Fatalf("decisions = %+v, want 1 compra @ 8.00", decisions)
	}
}
