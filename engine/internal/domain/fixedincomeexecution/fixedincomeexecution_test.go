package fixedincomeexecution

import (
	"math"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/fixedincome"
	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
)

func almostEqual(a, b, tolerance float64) bool {
	return math.Abs(a-b) < tolerance
}

// now/maturityDate escolhidos pra que remainingBusinessDays(now, maturityDate)
// dê exatamente 252 DU (1 ano útil) — 2026 não é bissexto, então
// now.AddDate(1,0,0) são exatos 365 dias corridos.
var (
	purchaseNow      = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	purchaseMaturity = purchaseNow.AddDate(1, 0, 0)
)

func TestPurchase_ValorInvalido(t *testing.T) {
	ctx := PurchaseContext{AccountBalance: 5000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: purchaseMaturity}

	_, err := Purchase(Request{Amount: 0}, ctx, purchaseNow)
	if err != ErrInvalidAmount {
		t.Fatalf("err = %v, want %v", err, ErrInvalidAmount)
	}
}

func TestPurchase_AbaixoDaAplicacaoMinima(t *testing.T) {
	ctx := PurchaseContext{AccountBalance: 5000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: purchaseMaturity}

	_, err := Purchase(Request{Amount: 50}, ctx, purchaseNow)
	if err != ErrBelowMinimumInvestment {
		t.Fatalf("err = %v, want %v", err, ErrBelowMinimumInvestment)
	}
}

func TestPurchase_SaldoInsuficiente(t *testing.T) {
	ctx := PurchaseContext{AccountBalance: 1000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: purchaseMaturity}

	_, err := Purchase(Request{Amount: 2000}, ctx, purchaseNow)
	if err != ErrInsufficientBalance {
		t.Fatalf("err = %v, want %v", err, ErrInsufficientBalance)
	}
}

func TestPurchase_PrecificaEBlendaNaPosicao(t *testing.T) {
	ctx := PurchaseContext{AccountBalance: 5000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: purchaseMaturity}

	outcome, err := Purchase(Request{Amount: 2000}, ctx, purchaseNow)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	wantUnitPrice := fixedincome.PrefixedPrice(0.10, 252)
	if !almostEqual(outcome.UnitPrice, wantUnitPrice, 0.01) {
		t.Errorf("UnitPrice = %v, want %v", outcome.UnitPrice, wantUnitPrice)
	}
	wantQuantity := 2000 / wantUnitPrice
	if !almostEqual(outcome.QuantityPurchased, wantQuantity, 1e-6) {
		t.Errorf("QuantityPurchased = %v, want %v", outcome.QuantityPurchased, wantQuantity)
	}
	if !almostEqual(outcome.NewPosition.AverageRate, 0.10, 1e-9) {
		t.Errorf("NewPosition.AverageRate = %v, want 0.10", outcome.NewPosition.AverageRate)
	}
}

func TestPurchase_SegundaCompraBlendaComAPosicaoExistente(t *testing.T) {
	ctxFirst := PurchaseContext{AccountBalance: 10000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: purchaseMaturity}
	first, err := Purchase(Request{Amount: 2000}, ctxFirst, purchaseNow)
	if err != nil {
		t.Fatalf("primeira compra: err = %v, want nil", err)
	}

	ctxSecond := PurchaseContext{
		AccountBalance:    10000,
		AnnualRatePct:     12,
		MinimumInvestment: 100,
		MaturityDate:      purchaseMaturity,
		CurrentPosition:   first.NewPosition,
	}
	second, err := Purchase(Request{Amount: 1000}, ctxSecond, purchaseNow)
	if err != nil {
		t.Fatalf("segunda compra: err = %v, want nil", err)
	}

	if second.NewPosition.Quantity <= first.NewPosition.Quantity {
		t.Errorf("Quantity não cresceu após a segunda compra: %v -> %v", first.NewPosition.Quantity, second.NewPosition.Quantity)
	}
	// A taxa blendada deve ficar estritamente entre 10% e 12% — nem igual à
	// primeira, nem igual à segunda, ponderada pelo valor de cada aporte.
	if !(second.NewPosition.AverageRate > 0.10 && second.NewPosition.AverageRate < 0.12) {
		t.Errorf("AverageRate = %v, want entre 0.10 e 0.12", second.NewPosition.AverageRate)
	}
}

func TestRedeem_PosicaoInexistente(t *testing.T) {
	_, err := Redeem(RedeemContext{Position: fixedincomeposition.Position{Quantity: 0}}, purchaseNow)
	if err != ErrPositionNotFound {
		t.Fatalf("err = %v, want %v", err, ErrPositionNotFound)
	}
}

// Mesmo cenário de fixedincome/markingtomarket_test.go (taxa contratada
// 10%, prazo de compra 252 DU, resgate na metade — 126 DU restantes),
// agora ponta a ponta via Redeem — critério de aceite da 3.13 pede
// exatamente essa reprodução "agora ponta a ponta".
func TestRedeem_MarcacaoAMercado_TaxaSubiu_RentabilidadeInferiorAContratada(t *testing.T) {
	purchaseRate := 0.10
	purchasePrice := fixedincome.PrefixedPrice(purchaseRate, 252)
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	// 183 dias corridos → remainingBusinessDays(now, maturity) = 126 DU.
	maturity := now.AddDate(0, 0, 183)

	ctx := RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: purchasePrice, AverageRate: purchaseRate},
		MaturityDate:         maturity,
		CurrentMarketRatePct: 15,
	}

	outcome, err := Redeem(ctx, now)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.MarkToMarket.VsContractedRate >= 0 {
		t.Errorf("VsContractedRate = %v, want negativo (taxa de mercado subiu)", outcome.MarkToMarket.VsContractedRate)
	}
	if outcome.MarkToMarket.RealizedReturnPct <= 0 {
		t.Errorf("RealizedReturnPct = %v, want positivo (ainda houve valorização, só que menor)", outcome.MarkToMarket.RealizedReturnPct)
	}
	if !almostEqual(outcome.TotalValue, outcome.MarkToMarket.MarkToMarketPrice, 1e-9) {
		t.Errorf("TotalValue = %v, want igual a MarkToMarketPrice (Quantity = 1)", outcome.TotalValue)
	}
}

func TestRedeem_TotalValueEscalaComAQuantidade(t *testing.T) {
	purchaseRate := 0.10
	purchasePrice := fixedincome.PrefixedPrice(purchaseRate, 252)
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	maturity := now.AddDate(0, 0, 183)

	ctx := RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 3, AveragePrice: purchasePrice, AverageRate: purchaseRate},
		MaturityDate:         maturity,
		CurrentMarketRatePct: 6,
	}

	outcome, err := Redeem(ctx, now)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	want := 3 * outcome.MarkToMarket.MarkToMarketPrice
	if !almostEqual(outcome.TotalValue, want, 1e-9) {
		t.Errorf("TotalValue = %v, want %v", outcome.TotalValue, want)
	}
}

func TestRemainingBusinessDays_NuncaMenorQueUm(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	past := now.AddDate(0, 0, -10) // vencimento já passou

	got := remainingBusinessDays(now, past)
	if got != 1 {
		t.Errorf("remainingBusinessDays = %d, want 1 (piso pra vencimento no passado)", got)
	}
}
