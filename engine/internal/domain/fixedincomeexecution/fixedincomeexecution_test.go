package fixedincomeexecution

import (
	"math"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/fixedincome"
	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/domain/ipca"
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

	_, err := Purchase(Request{Amount: 0}, ctx, purchaseNow, 0, 0)
	if err != ErrInvalidAmount {
		t.Fatalf("err = %v, want %v", err, ErrInvalidAmount)
	}
}

func TestPurchase_AbaixoDaAplicacaoMinima(t *testing.T) {
	ctx := PurchaseContext{AccountBalance: 5000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: purchaseMaturity}

	_, err := Purchase(Request{Amount: 50}, ctx, purchaseNow, 0, 0)
	if err != ErrBelowMinimumInvestment {
		t.Fatalf("err = %v, want %v", err, ErrBelowMinimumInvestment)
	}
}

func TestPurchase_SaldoInsuficiente(t *testing.T) {
	ctx := PurchaseContext{AccountBalance: 1000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: purchaseMaturity}

	_, err := Purchase(Request{Amount: 2000}, ctx, purchaseNow, 0, 0)
	if err != ErrInsufficientBalance {
		t.Fatalf("err = %v, want %v", err, ErrInsufficientBalance)
	}
}

func TestPurchase_PrecificaEBlendaNaPosicao(t *testing.T) {
	ctx := PurchaseContext{AccountBalance: 5000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: purchaseMaturity}

	outcome, err := Purchase(Request{Amount: 2000}, ctx, purchaseNow, 0, 0)
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

// TestPurchase_Prefixado_TaxaOfertadaAcompanhaSelicCorrente é o critério de
// aceite principal da L.4 (backlog-motor-mercado-realista, decisão 1): a
// taxa que uma compra NOVA trava não pode ficar presa ao valor do seed pra
// sempre — o mesmo spread contratual (AnnualRatePct, reinterpretado por
// esta tarefa) travado em dois momentos com a Selic simulada em patamares
// diferentes tem que travar taxas diferentes.
func TestPurchase_Prefixado_TaxaOfertadaAcompanhaSelicCorrente(t *testing.T) {
	spread := 1.75
	ctxSelicBaixa := PurchaseContext{
		AccountBalance: 5000, AnnualRatePct: spread, MinimumInvestment: 100, MaturityDate: purchaseMaturity,
		ProductType: fixedincome.ProductTesouroPrefixado, CurrentMarketRatePct: 8,
	}
	ctxSelicAlta := ctxSelicBaixa
	ctxSelicAlta.CurrentMarketRatePct = 14

	low, err := Purchase(Request{Amount: 2000}, ctxSelicBaixa, purchaseNow, 0, 0)
	if err != nil {
		t.Fatalf("Selic baixa: err = %v, want nil", err)
	}
	high, err := Purchase(Request{Amount: 2000}, ctxSelicAlta, purchaseNow, 0, 0)
	if err != nil {
		t.Fatalf("Selic alta: err = %v, want nil", err)
	}

	wantRateLow := (spread + 8) / 100
	wantRateHigh := (spread + 14) / 100
	if !almostEqual(low.NewPosition.AverageRate, wantRateLow, 1e-9) {
		t.Errorf("AverageRate (Selic 8%%) = %v, want %v (spread + Selic)", low.NewPosition.AverageRate, wantRateLow)
	}
	if !almostEqual(high.NewPosition.AverageRate, wantRateHigh, 1e-9) {
		t.Errorf("AverageRate (Selic 14%%) = %v, want %v (spread + Selic)", high.NewPosition.AverageRate, wantRateHigh)
	}
	if high.NewPosition.AverageRate <= low.NewPosition.AverageRate {
		t.Errorf("Selic mais alta deveria travar uma taxa contratada maior: baixa=%v alta=%v", low.NewPosition.AverageRate, high.NewPosition.AverageRate)
	}
}

// TestPurchase_Prefixado_Sandbox_NaoSomaSelicSobreORoteiro prova a ressalva
// documentada em PurchaseContext.IsSandbox: o roteiro sandbox já entrega
// AnnualRatePct como taxa ABSOLUTA pronta (Repository, RF12) — Purchase não
// pode somar CurrentMarketRatePct em cima, ou dobraria o efeito da Selic.
func TestPurchase_Prefixado_Sandbox_NaoSomaSelicSobreORoteiro(t *testing.T) {
	ctx := PurchaseContext{
		AccountBalance: 5000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: purchaseMaturity,
		ProductType: fixedincome.ProductTesouroPrefixado, CurrentMarketRatePct: 20, IsSandbox: true,
	}

	outcome, err := Purchase(Request{Amount: 2000}, ctx, purchaseNow, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if !almostEqual(outcome.NewPosition.AverageRate, 0.10, 1e-9) {
		t.Errorf("AverageRate = %v, want 0.10 (taxa do roteiro sandbox, sem somar CurrentMarketRatePct)", outcome.NewPosition.AverageRate)
	}
}

func TestPurchase_SegundaCompraBlendaComAPosicaoExistente(t *testing.T) {
	ctxFirst := PurchaseContext{AccountBalance: 10000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: purchaseMaturity}
	first, err := Purchase(Request{Amount: 2000}, ctxFirst, purchaseNow, 0, 0)
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
	second, err := Purchase(Request{Amount: 1000}, ctxSecond, purchaseNow, 0, 0)
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
	_, err := Redeem(RedeemContext{Position: fixedincomeposition.Position{Quantity: 0}}, purchaseNow, 0, 0)
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

	outcome, err := Redeem(ctx, now, 0, 0)
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

// TestRedeem_Prefixado_SpreadNaoGeraGanhoArtificialQuandoSelicNaoMudou é o
// achado 011 (pontos-em-aberto-decisao-produto.md, teste de ponta a ponta
// da Fase L): antes da correção, comprar e resgatar Tesouro Prefixado no
// mesmo instante, com a Selic simulada parada, devolvia um "ganho"
// artificial — a marcação a mercado comparava a taxa CHEIA travada na
// compra (spread + Selic) contra a Selic CRUA de agora (sem o mesmo
// spread), nunca zero mesmo sem nenhum movimento real de mercado. Validado
// ao vivo: 4 ciclos seguidos de compra+resgate instantâneo em LTN2027
// levaram uma conta de R$ 10.000 pra R$ 11.129 sem nenhum tick do
// Temporizador rodar. Round-trip via Purchase (não construído à mão) pra
// reproduzir exatamente o cenário real: a mesma taxa que a compra trava é
// a que o resgate teria que igualar pra não gerar dinheiro do nada.
func TestRedeem_Prefixado_SpreadNaoGeraGanhoArtificialQuandoSelicNaoMudou(t *testing.T) {
	const spread = 1.75
	const selic = 10.0

	pctx := PurchaseContext{
		AccountBalance: 5000, AnnualRatePct: spread, MinimumInvestment: 100,
		MaturityDate: purchaseMaturity, ProductType: fixedincome.ProductTesouroPrefixado,
		CurrentMarketRatePct: selic,
	}
	purchase, err := Purchase(Request{Amount: 2000}, pctx, purchaseNow, 0, 0)
	if err != nil {
		t.Fatalf("compra: err = %v, want nil", err)
	}

	rctx := RedeemContext{
		Position:             purchase.NewPosition,
		MaturityDate:         purchaseMaturity,
		CurrentMarketRatePct: selic, // Selic não mudou desde a compra
		PurchasedAt:          purchaseNow,
		ProductType:          fixedincome.ProductTesouroPrefixado,
		AnnualRatePct:        spread,
	}

	outcome, err := Redeem(rctx, purchaseNow, 0, 0)
	if err != nil {
		t.Fatalf("resgate: err = %v, want nil", err)
	}
	if !almostEqual(outcome.MarkToMarket.VsContractedRate, 0, 1e-6) {
		t.Errorf("VsContractedRate = %v, want 0 (Selic não mudou desde a compra — achado 011)", outcome.MarkToMarket.VsContractedRate)
	}
	if !almostEqual(outcome.TotalValue, 2000, 1e-6) {
		t.Errorf("TotalValue = %v, want 2000 (resgate instantâneo devolve exatamente o valor aplicado, sem ganho nem perda — achado 011)", outcome.TotalValue)
	}
}

// TestRedeem_Prefixado_ComSpread_SelicSubiuAindaGeraPerdaReal confere que a
// correção do achado 011 não anula a marcação a mercado genuína — só o
// componente artificial do spread. Com a Selic realmente subindo depois da
// compra, o resgate antecipado ainda deve mostrar perda.
func TestRedeem_Prefixado_ComSpread_SelicSubiuAindaGeraPerdaReal(t *testing.T) {
	const spread = 1.75

	pctx := PurchaseContext{
		AccountBalance: 5000, AnnualRatePct: spread, MinimumInvestment: 100,
		MaturityDate: purchaseMaturity, ProductType: fixedincome.ProductTesouroPrefixado,
		CurrentMarketRatePct: 10,
	}
	purchase, err := Purchase(Request{Amount: 2000}, pctx, purchaseNow, 0, 0)
	if err != nil {
		t.Fatalf("compra: err = %v, want nil", err)
	}

	rctx := RedeemContext{
		Position:             purchase.NewPosition,
		MaturityDate:         purchaseMaturity,
		CurrentMarketRatePct: 15, // Selic subiu de 10% pra 15%
		PurchasedAt:          purchaseNow,
		ProductType:          fixedincome.ProductTesouroPrefixado,
		AnnualRatePct:        spread,
	}

	outcome, err := Redeem(rctx, purchaseNow, 0, 0)
	if err != nil {
		t.Fatalf("resgate: err = %v, want nil", err)
	}
	if outcome.MarkToMarket.VsContractedRate >= 0 {
		t.Errorf("VsContractedRate = %v, want negativo (Selic subiu de verdade)", outcome.MarkToMarket.VsContractedRate)
	}
}

// TestRedeem_Prefixado_Sandbox_NaoSomaSpreadSobreATaxaDoRoteiro prova que a
// correção do achado 011 não alcança sandbox: a taxa do roteiro
// (sandbox.RateOnDay, resolvida pelo Repository em CurrentMarketRatePct) já
// é uma taxa absoluta pronta, sem spread separado — mesma taxa que a compra
// sandbox trava em Position.AverageRate (PurchaseContext.IsSandbox). Usa um
// AnnualRatePct absurdo (999) de propósito: se a correção fosse aplicada
// por engano num resgate sandbox, isso distorceria o resultado longe de
// zero — devolver exatamente 0 confirma que IsSandbox bloqueou a soma.
func TestRedeem_Prefixado_Sandbox_NaoSomaSpreadSobreATaxaDoRoteiro(t *testing.T) {
	const sandboxRate = 0.10
	purchasePrice := fixedincome.PrefixedPrice(sandboxRate, 252)

	rctx := RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: purchasePrice, AverageRate: sandboxRate},
		MaturityDate:         purchaseMaturity,
		CurrentMarketRatePct: 10, // mesma taxa do roteiro sandbox usada na compra
		PurchasedAt:          purchaseNow,
		ProductType:          fixedincome.ProductTesouroPrefixado,
		AnnualRatePct:        999,
		IsSandbox:            true,
	}

	outcome, err := Redeem(rctx, purchaseNow, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if !almostEqual(outcome.MarkToMarket.VsContractedRate, 0, 1e-6) {
		t.Errorf("VsContractedRate = %v, want 0 (sandbox não soma spread — AnnualRatePct=999 deveria ser ignorado)", outcome.MarkToMarket.VsContractedRate)
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

	outcome, err := Redeem(ctx, now, 0, 0)
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

func TestRedeem_AplicaImpostoRegressivoSobreOGanho(t *testing.T) {
	purchaseRate := 0.10
	purchasePrice := fixedincome.PrefixedPrice(purchaseRate, 252)
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	maturity := now.AddDate(0, 0, 183)

	ctx := RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: purchasePrice, AverageRate: purchaseRate},
		MaturityDate:         maturity,
		CurrentMarketRatePct: 6, // taxa caiu — ganho extraordinário, há lucro a tributar
		PurchasedAt:          now.AddDate(0, 0, -200),
	}

	outcome, err := Redeem(ctx, now, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	wantTaxRate := fixedincome.RegressiveIncomeTaxRate(200)
	if outcome.TaxRate != wantTaxRate {
		t.Errorf("TaxRate = %v, want %v", outcome.TaxRate, wantTaxRate)
	}
	profit := outcome.TotalValue - ctx.Position.AveragePrice*ctx.Position.Quantity
	if profit <= 0 {
		t.Fatalf("cenário inválido: profit = %v, want positivo pra este teste fazer sentido", profit)
	}
	wantNetValue := outcome.TotalValue - profit*wantTaxRate
	if !almostEqual(outcome.NetValue, wantNetValue, 1e-9) {
		t.Errorf("NetValue = %v, want %v", outcome.NetValue, wantNetValue)
	}
	if outcome.NetValue >= outcome.TotalValue {
		t.Errorf("NetValue = %v, want menor que TotalValue = %v (houve lucro tributável)", outcome.NetValue, outcome.TotalValue)
	}
}

func TestRedeem_AtivoIsentoNuncaAplicaImposto(t *testing.T) {
	purchaseRate := 0.10
	purchasePrice := fixedincome.PrefixedPrice(purchaseRate, 252)
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	maturity := now.AddDate(0, 0, 183)

	ctx := RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: purchasePrice, AverageRate: purchaseRate},
		MaturityDate:         maturity,
		CurrentMarketRatePct: 6,
		PurchasedAt:          now.AddDate(0, 0, -200),
		TaxExempt:            true,
	}

	outcome, err := Redeem(ctx, now, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.TaxRate != 0 {
		t.Errorf("TaxRate = %v, want 0 (ativo isento)", outcome.TaxRate)
	}
	if outcome.NetValue != outcome.TotalValue {
		t.Errorf("NetValue = %v, want igual a TotalValue = %v (ativo isento)", outcome.NetValue, outcome.TotalValue)
	}
}

// TestPurchase_PosFixado_CompraAoParSemDesagio confere a nota 1 do doc do
// pacote (tarefa L.1): produto pós-fixado (Tesouro Selic, CDB, LCI, LCA,
// CRI, CRA) compra "ao par" — unitPrice = fixedincome.FaceValue, nenhum
// deságio — diferente de um prefixado, cujo unitPrice varia com
// AnnualRatePct/prazo (TestPurchase_PrecificaEBlendaNaPosicao acima).
func TestPurchase_PosFixado_CompraAoParSemDesagio(t *testing.T) {
	ctx := PurchaseContext{
		AccountBalance: 5000, AnnualRatePct: 110, MinimumInvestment: 100,
		MaturityDate: purchaseMaturity, ProductType: fixedincome.ProductCDB,
	}

	outcome, err := Purchase(Request{Amount: 2000}, ctx, purchaseNow, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.UnitPrice != fixedincome.FaceValue {
		t.Errorf("UnitPrice = %v, want %v (compra ao par)", outcome.UnitPrice, fixedincome.FaceValue)
	}
	wantQuantity := 2000 / fixedincome.FaceValue
	if !almostEqual(outcome.QuantityPurchased, wantQuantity, 1e-9) {
		t.Errorf("QuantityPurchased = %v, want %v", outcome.QuantityPurchased, wantQuantity)
	}
	// AnnualRatePct = 110 ("110% do CDI") vira 1.10 decimal na posição —
	// mesma convenção 0-1 de rate pra qualquer tipo de produto.
	if !almostEqual(outcome.NewPosition.AverageRate, 1.10, 1e-9) {
		t.Errorf("NewPosition.AverageRate = %v, want 1.10 (110%% do CDI)", outcome.NewPosition.AverageRate)
	}
}

// flatSelicSeries monta uma série de n dias com a mesma Selic repetida —
// usada pelos testes abaixo pra simular "a Selic ficou parada nesse
// patamar por todo o período" via ctx.SelicRatesSincePurchase (achado do
// teste de ponta a ponta da Fase L: Redeem passou a receber a série REAL
// desde a compra, em vez de sintetizá-la internamente a partir da Selic
// corrente — ver nota do campo em RedeemContext).
func flatSelicSeries(rate float64, n int) []float64 {
	series := make([]float64, n)
	for i := range series {
		series[i] = rate
	}
	return series
}

// TestRedeem_PosFixado_RendeDeVerdadeComASelicCorrente confere o núcleo do
// critério de aceite da L.1: produto pós-fixado rende de acordo com a
// série real de Selic simulada desde a compra
// (ctx.SelicRatesSincePurchase), não com uma taxa travada na compra —
// comprado "ao par" (AveragePrice = FaceValue, mesmo preço que Purchase
// produziria) a 100% do CDI, segurado por dias suficientes pra render algo
// mensurável, deve valorizar.
func TestRedeem_PosFixado_RendeDeVerdadeComASelicCorrente(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	ctx := RedeemContext{
		Position:                fixedincomeposition.Position{Quantity: 10, AveragePrice: fixedincome.FaceValue, AverageRate: 1.0},
		SelicRatesSincePurchase: flatSelicSeries(10, 252),
		PurchasedAt:             now.AddDate(0, 0, -365),
		ProductType:             fixedincome.ProductTesouroSelic,
	}

	outcome, err := Redeem(ctx, now, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	invested := ctx.Position.AveragePrice * ctx.Position.Quantity
	if !(outcome.TotalValue > invested) {
		t.Errorf("TotalValue = %v, want maior que o valor investido (%v) — 1 ano a 10%% a.a. deveria render", outcome.TotalValue, invested)
	}
	if outcome.MarkToMarket.VsContractedRate != 0 {
		t.Errorf("VsContractedRate = %v, want 0 (não há marcação a mercado pra pós-fixado)", outcome.MarkToMarket.VsContractedRate)
	}
}

// TestRedeem_PosFixado_SelicMaisAltaRendeMais confere que o resgate reage à
// série REAL de Selic percorrida desde a compra (ctx.
// SelicRatesSincePurchase), não a uma taxa fixa travada — a prova, ponta a
// ponta, de que "nunca uma taxa fixa travada na compra" (critério de
// aceite da L.1) vale pro fluxo real, não só pra
// fixedincome.PostFixedFactor isolado.
func TestRedeem_PosFixado_SelicMaisAltaRendeMais(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	basePosition := fixedincomeposition.Position{Quantity: 1, AveragePrice: fixedincome.FaceValue, AverageRate: 1.0}

	baixa, err := Redeem(RedeemContext{
		Position: basePosition, SelicRatesSincePurchase: flatSelicSeries(5, 252),
		PurchasedAt: now.AddDate(0, 0, -365), ProductType: fixedincome.ProductTesouroSelic,
	}, now, 0, 0)
	if err != nil {
		t.Fatalf("err (Selic baixa) = %v, want nil", err)
	}
	alta, err := Redeem(RedeemContext{
		Position: basePosition, SelicRatesSincePurchase: flatSelicSeries(15, 252),
		PurchasedAt: now.AddDate(0, 0, -365), ProductType: fixedincome.ProductTesouroSelic,
	}, now, 0, 0)
	if err != nil {
		t.Fatalf("err (Selic alta) = %v, want nil", err)
	}

	if !(alta.TotalValue > baixa.TotalValue) {
		t.Errorf("TotalValue com Selic alta (%v) não rendeu mais que com Selic baixa (%v)", alta.TotalValue, baixa.TotalValue)
	}
}

// TestRedeem_PosFixado_RendeConformeOCaminhoRealNaoUmaTaxaFinalRetroativa é
// o achado do teste de ponta a ponta da Fase L que motivou a correção:
// antes, Redeem repetia a Selic do dia do RESGATE por todo o período
// decorrido — uma alta de Selic no fim do período rendia retroativamente
// sobre os dias em que a Selic estava baixa, um ganho que um investidor
// real nunca teria (só se beneficiaria da alta dali pra frente). Compara
// dois cenários com a MESMA Selic final (15%) mas caminhos diferentes: um
// que ficou o ano inteiro a 15%, outro que passou a maior parte do ano a
// 5% e só virou 15% perto do resgate — o segundo tem que render MENOS,
// nunca igual.
func TestRedeem_PosFixado_RendeConformeOCaminhoRealNaoUmaTaxaFinalRetroativa(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	position := fixedincomeposition.Position{Quantity: 1, AveragePrice: fixedincome.FaceValue, AverageRate: 1.0}

	semprePresa, err := Redeem(RedeemContext{
		Position: position, SelicRatesSincePurchase: flatSelicSeries(15, 252),
		PurchasedAt: now.AddDate(0, 0, -365), ProductType: fixedincome.ProductTesouroSelic,
	}, now, 0, 0)
	if err != nil {
		t.Fatalf("err (sempre 15%%) = %v, want nil", err)
	}

	caminhoReal := append(flatSelicSeries(5, 230), flatSelicSeries(15, 22)...)
	subiuNoFim, err := Redeem(RedeemContext{
		Position: position, SelicRatesSincePurchase: caminhoReal,
		PurchasedAt: now.AddDate(0, 0, -365), ProductType: fixedincome.ProductTesouroSelic,
	}, now, 0, 0)
	if err != nil {
		t.Fatalf("err (subiu no fim) = %v, want nil", err)
	}

	if !(subiuNoFim.TotalValue < semprePresa.TotalValue) {
		t.Errorf("TotalValue (subiu no fim) = %v, want menor que TotalValue (sempre 15%%) = %v — a alta não pode render retroativamente sobre os dias em que a Selic estava baixa", subiuNoFim.TotalValue, semprePresa.TotalValue)
	}
}

// TestRedeem_PosFixado_ResgateNoMesmoDiaDaCompraNaoRendeNada confere o
// caso-limite (série vazia de fixedincome.PostFixedFactor, tarefa L.1):
// resgatar no mesmo dia da compra devolve exatamente o principal, sem
// erro.
func TestRedeem_PosFixado_ResgateNoMesmoDiaDaCompraNaoRendeNada(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	ctx := RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: fixedincome.FaceValue, AverageRate: 1.0},
		CurrentMarketRatePct: 10,
		PurchasedAt:          now,
		ProductType:          fixedincome.ProductCDB,
	}

	outcome, err := Redeem(ctx, now, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if !almostEqual(outcome.TotalValue, fixedincome.FaceValue, 1e-9) {
		t.Errorf("TotalValue = %v, want %v (resgate no mesmo dia da compra, sem rendimento)", outcome.TotalValue, fixedincome.FaceValue)
	}
}

// ipcaExecutionTestConfig gera uma série de IPCA sem ruído (Volatility = 0
// — mesmo raciocínio de fixedincome.ipcaTestConfig), pra deixar
// determinístico o VNA usado nos testes de Purchase/Redeem de Tesouro
// IPCA+ abaixo (tarefa L.2), sem depender da seed.
var ipcaExecutionTestConfig = ipca.Config{MonthlyTarget: 0.004, MaxDeviation: 0.01, Volatility: 0, Seed: 1}

// TestPurchase_IPCAMais_UsaVNAEmVezDeDesagioNominal confere o critério de
// aceite central da L.2: Tesouro IPCA+ (fixedincome.IsIPCAMais) precifica a
// unidade pelo VNA (fixedincome.VNAProjected + IPCAPrice), não mais pelo
// deságio nominal (fixedincome.PrefixedPrice) que TestPurchase_
// PrecificaEBlendaNaPosicao (acima) confirma pro Tesouro Prefixado com os
// mesmos AnnualRatePct/prazo — vnaBase aqui vem de vários meses depois de
// VNAEpoch (windowIndex > 0), então UnitPrice != PrefixedPrice por
// construção (o VNA já compôs inflação, deixou de ser o FaceValue puro).
func TestPurchase_IPCAMais_UsaVNAEmVezDeDesagioNominal(t *testing.T) {
	now := fixedincome.VNAEpoch.AddDate(2, 0, 3)
	vnaBase, monthlyIPCA := fixedincome.CurrentVNAWindow(ipcaExecutionTestConfig, now)
	maturity := now.AddDate(1, 0, 0)

	ctx := PurchaseContext{
		AccountBalance: 5000, AnnualRatePct: 6, MinimumInvestment: 100,
		MaturityDate: maturity, ProductType: fixedincome.ProductTesouroIPCA,
	}

	outcome, err := Purchase(Request{Amount: 2000}, ctx, now, vnaBase, monthlyIPCA)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	remainingDays := remainingBusinessDays(now, maturity)
	wantUnitPrice := fixedincome.IPCAPrice(fixedincome.VNAProjected(vnaBase, monthlyIPCA, now), fixedincome.IPCAQuote(0.06, remainingDays))
	if !almostEqual(outcome.UnitPrice, wantUnitPrice, 1e-6) {
		t.Errorf("UnitPrice = %v, want %v (VNAProjected × IPCAQuote)", outcome.UnitPrice, wantUnitPrice)
	}

	nominalUnitPrice := fixedincome.PrefixedPrice(0.06, remainingDays)
	if almostEqual(outcome.UnitPrice, nominalUnitPrice, 0.01) {
		t.Errorf("UnitPrice = %v, ficou igual ao deságio nominal (%v) — VNA não teve efeito", outcome.UnitPrice, nominalUnitPrice)
	}

	wantQuantity := 2000 / wantUnitPrice
	if !almostEqual(outcome.QuantityPurchased, wantQuantity, 1e-6) {
		t.Errorf("QuantityPurchased = %v, want %v", outcome.QuantityPurchased, wantQuantity)
	}
	if !almostEqual(outcome.NewPosition.AverageRate, 0.06, 1e-9) {
		t.Errorf("NewPosition.AverageRate = %v, want 0.06 (taxa real contratada, travada)", outcome.NewPosition.AverageRate)
	}
}

// TestRedeem_IPCAMais_VNACrescePorInflacaoAumentaOResgate confere que o
// resgate de Tesouro IPCA+ rende de acordo com o VNA de hoje — comprado há
// 3 anos com a mesma taxa real de mercado da compra (VsContractedRate
// isolado em 0, só o efeito do VNA em jogo), o valor resgatado precisa
// superar o principal investido puramente pela inflação simulada acumulada
// (ipcaExecutionTestConfig.MonthlyTarget > 0).
func TestRedeem_IPCAMais_VNACrescePorInflacaoAumentaOResgate(t *testing.T) {
	const realRate = 0.06
	purchasedAt := fixedincome.VNAEpoch
	now := purchasedAt.AddDate(3, 0, 0)

	vnaAtPurchase, _ := fixedincome.CurrentVNAWindow(ipcaExecutionTestConfig, purchasedAt)
	purchasePrice := fixedincome.IPCAPrice(vnaAtPurchase, fixedincome.IPCAQuote(realRate, 252))
	vnaBase, monthlyIPCA := fixedincome.CurrentVNAWindow(ipcaExecutionTestConfig, now)

	ctx := RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: purchasePrice, AverageRate: realRate},
		MaturityDate:         now.AddDate(2, 0, 0),
		CurrentMarketRatePct: realRate * 100, // taxa de mercado igual à contratada — isola o efeito do VNA
		PurchasedAt:          purchasedAt,
		ProductType:          fixedincome.ProductTesouroIPCA,
	}

	outcome, err := Redeem(ctx, now, vnaBase, monthlyIPCA)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	invested := ctx.Position.AveragePrice * ctx.Position.Quantity
	if !(outcome.TotalValue > invested) {
		t.Errorf("TotalValue = %v, want maior que o valor investido (%v) — VNA deveria ter crescido com a inflação em 3 anos", outcome.TotalValue, invested)
	}
	if math.Abs(outcome.MarkToMarket.VsContractedRate) > 1e-6 {
		t.Errorf("VsContractedRate = %v, want ≈0 (taxa de mercado igual à contratada, só o VNA mudou)", outcome.MarkToMarket.VsContractedRate)
	}
}

// TestRedeem_IPCAMais_MarcacaoAMercado_TaxaRealSubiu_RentabilidadeInferiorAContratada
// é o critério de aceite da L.3 (backlog-motor-mercado-realista):
// Tesouro IPCA+ continua sofrendo marcação a mercado no resgate antecipado,
// igual Tesouro Prefixado (TestRedeem_MarcacaoAMercado_TaxaSubiu... acima) —
// decisão confirmada com o usuário, já que a taxa real contratada na compra
// funciona como uma prefixada sobre o VNA (diferente dos 6 produtos
// pós-fixados, cujo rendimento É o índice de mercado). Mesmo cenário de
// fixedincome.TestIPCAEarlyRedemption_TaxaRealSubiu_RentabilidadeInferiorAContratada,
// agora ponta a ponta via Redeem, com o VNA parado (CurrentVNAWindow na
// mesma janela da compra) pra isolar o efeito da taxa.
func TestRedeem_IPCAMais_MarcacaoAMercado_TaxaRealSubiu_RentabilidadeInferiorAContratada(t *testing.T) {
	const purchaseRealRate = 0.06
	purchasedAt := fixedincome.VNAEpoch
	now := purchasedAt.AddDate(0, 0, 5) // mesma janela de VNA da compra

	vnaBase, _ := fixedincome.CurrentVNAWindow(ipcaExecutionTestConfig, purchasedAt)
	purchasePrice := fixedincome.IPCAPrice(vnaBase, fixedincome.IPCAQuote(purchaseRealRate, 252))
	vnaNow, monthlyIPCA := fixedincome.CurrentVNAWindow(ipcaExecutionTestConfig, now)

	ctx := RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: purchasePrice, AverageRate: purchaseRealRate},
		MaturityDate:         purchasedAt.AddDate(1, 0, 0),
		CurrentMarketRatePct: 9, // taxa real de mercado subiu (6% → 9%)
		PurchasedAt:          purchasedAt,
		ProductType:          fixedincome.ProductTesouroIPCA,
	}

	outcome, err := Redeem(ctx, now, vnaNow, monthlyIPCA)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.MarkToMarket.VsContractedRate >= 0 {
		t.Errorf("VsContractedRate = %v, want negativo (taxa real de mercado subiu)", outcome.MarkToMarket.VsContractedRate)
	}
}

// TestPurchase_IPCAMais_TaxaOfertadaUsaCorrecaoDeFisherNaoSelicNominalDireta
// é o critério de aceite da L.4 (decisão 3, sub-decisão de Fisher): a taxa
// real ofertada não pode reaproveitar a Selic NOMINAL direto como se já
// fosse real — precisa descontar o IPCA acumulado via fixedincome.
// FisherRealRate antes de somar o spread.
func TestPurchase_IPCAMais_TaxaOfertadaUsaCorrecaoDeFisherNaoSelicNominalDireta(t *testing.T) {
	now := fixedincome.VNAEpoch.AddDate(2, 0, 3)
	vnaBase, monthlyIPCA := fixedincome.CurrentVNAWindow(ipcaExecutionTestConfig, now)
	maturity := now.AddDate(1, 0, 0)
	spread := 0.5

	ctx := PurchaseContext{
		AccountBalance: 5000, AnnualRatePct: spread, MinimumInvestment: 100,
		MaturityDate: maturity, ProductType: fixedincome.ProductTesouroIPCA,
		CurrentMarketRatePct: 10, IPCAAccumulated12m: 0.03,
	}

	outcome, err := Purchase(Request{Amount: 2000}, ctx, now, vnaBase, monthlyIPCA)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	wantFisherReal := fixedincome.FisherRealRate(0.10, 0.03)
	wantRate := (spread / 100) + wantFisherReal
	if !almostEqual(outcome.NewPosition.AverageRate, wantRate, 1e-9) {
		t.Errorf("AverageRate = %v, want %v (spread + Fisher(Selic, IPCA))", outcome.NewPosition.AverageRate, wantRate)
	}

	naiveRate := (spread / 100) + 0.10
	if almostEqual(outcome.NewPosition.AverageRate, naiveRate, 1e-6) {
		t.Errorf("AverageRate = %v ficou igual à Selic nominal direta (%v) — correção de Fisher não teve efeito", outcome.NewPosition.AverageRate, naiveRate)
	}
}

// TestRedeem_IPCAMais_MarcacaoAMercadoUsaCorrecaoDeFisher prova o achado da
// L.4 do lado do resgate: a Selic NOMINAL subindo não significa que a taxa
// REAL de mercado subiu junto — se o IPCA acumulado também subiu o
// suficiente, a taxa real (via Fisher) pode até CAIR frente à contratada,
// invertendo o sinal do ganho/perda que a simplificação antiga (Selic
// nominal usada direto como proxy de taxa real, sem descontar a inflação)
// erraria.
func TestRedeem_IPCAMais_MarcacaoAMercadoUsaCorrecaoDeFisher(t *testing.T) {
	const purchaseRealRate = 0.06
	purchasedAt := fixedincome.VNAEpoch
	now := purchasedAt.AddDate(0, 0, 5) // mesma janela de VNA da compra

	vnaBase, _ := fixedincome.CurrentVNAWindow(ipcaExecutionTestConfig, purchasedAt)
	purchasePrice := fixedincome.IPCAPrice(vnaBase, fixedincome.IPCAQuote(purchaseRealRate, 252))
	vnaNow, monthlyIPCA := fixedincome.CurrentVNAWindow(ipcaExecutionTestConfig, now)

	// Selic nominal subiu de 9% (6% real + 3% inflação) pra 12%, mas o IPCA
	// acumulado também subiu de 3% pra 6% — a taxa REAL de mercado (Fisher
	// (12%, 6%) ≈ 5,66%) na verdade ficou ABAIXO dos 6% contratados, então
	// a posição vale MAIS que uma emissão nova a essa taxa real mais baixa
	// (ganho extraordinário) — o oposto do que a leitura ingênua ("Selic
	// nominal subiu, deveria perder") sugeriria sem a correção de Fisher.
	ctx := RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: purchasePrice, AverageRate: purchaseRealRate},
		MaturityDate:         purchasedAt.AddDate(1, 0, 0),
		CurrentMarketRatePct: 12,
		IPCAAccumulated12m:   0.06,
		PurchasedAt:          purchasedAt,
		ProductType:          fixedincome.ProductTesouroIPCA,
	}

	outcome, err := Redeem(ctx, now, vnaNow, monthlyIPCA)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	wantFisherReal := fixedincome.FisherRealRate(0.12, 0.06)
	if wantFisherReal >= purchaseRealRate {
		t.Fatalf("cenário mal montado: Fisher(12%%, 6%%) = %v deveria ficar abaixo de 6%% contratados", wantFisherReal)
	}
	if outcome.MarkToMarket.VsContractedRate <= 0 {
		t.Errorf("VsContractedRate = %v, want positivo (taxa REAL de mercado, via Fisher, ficou abaixo da contratada — ganho extraordinário mesmo com a Selic nominal tendo subido)", outcome.MarkToMarket.VsContractedRate)
	}
}

// TestRedeem_IPCAMais_SpreadNaoGeraGanhoArtificialQuandoBenchmarkNaoMudou é
// o achado 011 (pontos-em-aberto-decisao-produto.md) aplicado a Tesouro
// IPCA+: sem a correção, Redeem comparava a taxa real contratada CHEIA
// (spread + taxa real via Fisher, tarefa L.4) contra a taxa real CRUA de
// agora (sem o mesmo spread) — round-trip via Purchase prova que a
// correção zera o "ganho" quando Selic/IPCA não mudaram desde a compra.
func TestRedeem_IPCAMais_SpreadNaoGeraGanhoArtificialQuandoBenchmarkNaoMudou(t *testing.T) {
	const spread = 0.5
	purchasedAt := fixedincome.VNAEpoch
	vnaBase, monthlyIPCA := fixedincome.CurrentVNAWindow(ipcaExecutionTestConfig, purchasedAt)
	maturity := purchasedAt.AddDate(2, 0, 0)

	pctx := PurchaseContext{
		AccountBalance: 5000, AnnualRatePct: spread, MinimumInvestment: 100,
		MaturityDate: maturity, ProductType: fixedincome.ProductTesouroIPCA,
		CurrentMarketRatePct: 10, IPCAAccumulated12m: 0.03,
	}
	purchase, err := Purchase(Request{Amount: 2000}, pctx, purchasedAt, vnaBase, monthlyIPCA)
	if err != nil {
		t.Fatalf("compra: err = %v, want nil", err)
	}

	rctx := RedeemContext{
		Position:             purchase.NewPosition,
		MaturityDate:         maturity,
		CurrentMarketRatePct: 10,   // Selic não mudou
		IPCAAccumulated12m:   0.03, // IPCA acumulado não mudou
		PurchasedAt:          purchasedAt,
		ProductType:          fixedincome.ProductTesouroIPCA,
		AnnualRatePct:        spread,
	}

	outcome, err := Redeem(rctx, purchasedAt, vnaBase, monthlyIPCA)
	if err != nil {
		t.Fatalf("resgate: err = %v, want nil", err)
	}
	if !almostEqual(outcome.MarkToMarket.VsContractedRate, 0, 1e-6) {
		t.Errorf("VsContractedRate = %v, want 0 (Selic/IPCA não mudaram desde a compra — achado 011)", outcome.MarkToMarket.VsContractedRate)
	}
	if !almostEqual(outcome.TotalValue, 2000, 1e-6) {
		t.Errorf("TotalValue = %v, want 2000 (resgate instantâneo devolve o valor aplicado, sem ganho nem perda — achado 011)", outcome.TotalValue)
	}
}

func TestSimulate_ValorInvalido(t *testing.T) {
	ctx := SimulateContext{AnnualRatePct: 10, MaturityDate: purchaseMaturity}

	_, err := Simulate(SimulateRequest{Amount: 0, DaysHeld: 180}, ctx, purchaseNow, 0, 0, 0, 0)
	if err != ErrInvalidAmount {
		t.Fatalf("err = %v, want %v", err, ErrInvalidAmount)
	}
}

func TestSimulate_DiasInvalidos(t *testing.T) {
	ctx := SimulateContext{AnnualRatePct: 10, MaturityDate: purchaseMaturity}

	_, err := Simulate(SimulateRequest{Amount: 2000, DaysHeld: 0}, ctx, purchaseNow, 0, 0, 0, 0)
	if err != ErrInvalidDaysHeld {
		t.Fatalf("err = %v, want %v", err, ErrInvalidDaysHeld)
	}
}

func TestSimulate_PrecificaAUnidadeIgualAPurchase(t *testing.T) {
	ctx := SimulateContext{AnnualRatePct: 10, MaturityDate: purchaseMaturity}

	outcome, err := Simulate(SimulateRequest{Amount: 2000, DaysHeld: 180}, ctx, purchaseNow, 0, 0, 0, 0)
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
}

// TestSimulate_PosFixadoCompraAoParEProjetaPostFixedValue é o achado do
// teste de ponta a ponta da Fase L (nota 3.2 do doc do pacote): antes desta
// correção, Simulate ignorava ProductType e sempre descontava
// fixedincome.PrefixedPrice — pra um CDB 110% CDI (AnnualRatePct = 110, "%
// do CDI" desde a L.1), isso tratava 110 como "110% a.a.", uma ordem de
// grandeza maior que o retorno real. UnitPrice = FaceValue (compra ao par)
// e GrossProjectedValue = fixedincome.PostFixedValue são a mesma mecânica
// de Purchase/Redeem desde a L.1.
func TestSimulate_PosFixadoCompraAoParEProjetaPostFixedValue(t *testing.T) {
	ctx := SimulateContext{
		AnnualRatePct:        110,
		CurrentMarketRatePct: 10,
		MaturityDate:         purchaseMaturity,
		ProductType:          fixedincome.ProductCDB,
	}

	outcome, err := Simulate(SimulateRequest{Amount: 2000, DaysHeld: 360}, ctx, purchaseNow, 0, 0, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	if outcome.UnitPrice != fixedincome.FaceValue {
		t.Errorf("UnitPrice = %v, want %v (comprado ao par, sem deságio)", outcome.UnitPrice, fixedincome.FaceValue)
	}
	wantGross := fixedincome.PostFixedValue(2000, 110, postFixedDailyRates(10, 360))
	if !almostEqual(outcome.GrossProjectedValue, wantGross, 1e-6) {
		t.Errorf("GrossProjectedValue = %v, want %v (fixedincome.PostFixedValue, mesma fórmula de Redeem)", outcome.GrossProjectedValue, wantGross)
	}
	// CDB 110% CDI sobre Selic 10% ~1 ano rende ~11% a.a. — bem longe da
	// distorção antiga (~110% a.a., que devolveria algo perto de 4200).
	if outcome.GrossProjectedValue <= 2000 || outcome.GrossProjectedValue > 2400 {
		t.Errorf("GrossProjectedValue = %v, want perto de 2220 (~11%% sobre 2000), não ~4200 (achado da Fase L: taxa antiga tratava 110 como %% a.a.)", outcome.GrossProjectedValue)
	}
}

// TestSimulate_IPCAMaisUsaVNAEmVezDeDesagioNominal é o achado do teste de
// ponta a ponta da Fase L (nota 3.2 do doc do pacote): antes desta
// correção, Simulate ignorava o VNA pra Tesouro IPCA+, descontando a taxa
// REAL contratada como se fosse uma taxa NOMINAL sobre o Valor Nominal
// fixo (fixedincome.PrefixedPrice) — o unit_price mostrado ficava bem
// abaixo do preço real de compra (que embute décadas de IPCA simulado
// composto desde fixedincome.VNAEpoch, ver TestPurchase_
// IPCAMais_UsaVNAEmVezDeDesagioNominal). UnitPrice agora bate exatamente
// com o que Purchase cobraria no mesmo instante, com os mesmos parâmetros.
func TestSimulate_IPCAMaisUsaVNAEmVezDeDesagioNominal(t *testing.T) {
	now := fixedincome.VNAEpoch.AddDate(2, 0, 3)
	vnaBase, monthlyIPCA := fixedincome.CurrentVNAWindow(ipcaExecutionTestConfig, now)
	maturity := now.AddDate(1, 0, 0)
	const realRate = 6.0 // já reprecificado (spread + Fisher), mesma convenção de PurchaseContext.AnnualRatePct pós-L.4

	ctx := SimulateContext{
		AnnualRatePct: realRate,
		MaturityDate:  maturity,
		ProductType:   fixedincome.ProductTesouroIPCA,
	}

	outcome, err := Simulate(SimulateRequest{Amount: 2000, DaysHeld: 30}, ctx, now, vnaBase, monthlyIPCA, vnaBase, monthlyIPCA)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	remainingDays := remainingBusinessDays(now, maturity)
	wantUnitPrice := fixedincome.IPCAPrice(fixedincome.VNAProjected(vnaBase, monthlyIPCA, now), fixedincome.IPCAQuote(realRate/100, remainingDays))
	if !almostEqual(outcome.UnitPrice, wantUnitPrice, 1e-6) {
		t.Errorf("UnitPrice = %v, want %v (fixedincome.IPCAPrice/VNAProjected, mesma fórmula de Purchase)", outcome.UnitPrice, wantUnitPrice)
	}
	// PrefixedPrice(0.06, remainingDays) (deságio nominal puro, valor da
	// distorção antiga) fica bem abaixo do preço real com VNA, que embute o
	// IPCA composto desde 2000.
	wantWrongUnitPrice := fixedincome.PrefixedPrice(realRate/100, remainingDays)
	if outcome.UnitPrice <= wantWrongUnitPrice {
		t.Errorf("UnitPrice = %v, want maior que o deságio nominal puro (%v) — achado da Fase L: o VNA composto por anos de IPCA simulado precisa estar em jogo", outcome.UnitPrice, wantWrongUnitPrice)
	}
}

func TestSimulate_ProjecaoAoLongoDoTempoValorizaPertoDoValorNominal(t *testing.T) {
	ctx := SimulateContext{AnnualRatePct: 10, MaturityDate: purchaseMaturity}

	curto, err := Simulate(SimulateRequest{Amount: 2000, DaysHeld: 30}, ctx, purchaseNow, 0, 0, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	longo, err := Simulate(SimulateRequest{Amount: 2000, DaysHeld: 360}, ctx, purchaseNow, 0, 0, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	if !(longo.GrossProjectedValue > curto.GrossProjectedValue) {
		t.Errorf("GrossProjectedValue não cresce com o tempo: 30d = %v, 360d = %v", curto.GrossProjectedValue, longo.GrossProjectedValue)
	}
}

func TestSimulate_AlemDoVencimentoProjetaValorNominal(t *testing.T) {
	ctx := SimulateContext{AnnualRatePct: 10, MaturityDate: purchaseMaturity}

	outcome, err := Simulate(SimulateRequest{Amount: 2000, DaysHeld: 3650}, ctx, purchaseNow, 0, 0, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	wantGross := outcome.QuantityPurchased * fixedincome.FaceValue
	if !almostEqual(outcome.GrossProjectedValue, wantGross, 1e-6) {
		t.Errorf("GrossProjectedValue = %v, want %v (VN — dias simulados além do vencimento)", outcome.GrossProjectedValue, wantGross)
	}
}

func TestSimulate_AtivoIsentoNuncaAplicaImposto(t *testing.T) {
	ctx := SimulateContext{AnnualRatePct: 10, MaturityDate: purchaseMaturity, TaxExempt: true}

	outcome, err := Simulate(SimulateRequest{Amount: 2000, DaysHeld: 360}, ctx, purchaseNow, 0, 0, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.TaxRate != 0 {
		t.Errorf("TaxRate = %v, want 0 (ativo isento)", outcome.TaxRate)
	}
	if outcome.NetProjectedValue != outcome.GrossProjectedValue {
		t.Errorf("NetProjectedValue = %v, want igual a GrossProjectedValue = %v (ativo isento)", outcome.NetProjectedValue, outcome.GrossProjectedValue)
	}
}

func TestSimulate_AplicaAliquotaCorrespondenteAosDiasSimulados(t *testing.T) {
	ctx := SimulateContext{AnnualRatePct: 10, MaturityDate: purchaseMaturity}

	outcome, err := Simulate(SimulateRequest{Amount: 2000, DaysHeld: 200}, ctx, purchaseNow, 0, 0, 0, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	wantTaxRate := fixedincome.RegressiveIncomeTaxRate(200)
	if outcome.TaxRate != wantTaxRate {
		t.Errorf("TaxRate = %v, want %v", outcome.TaxRate, wantTaxRate)
	}
	profit := outcome.GrossProjectedValue - 2000
	if profit <= 0 {
		t.Fatalf("cenário inválido: profit = %v, want positivo pra este teste fazer sentido", profit)
	}
	wantNet := outcome.GrossProjectedValue - profit*wantTaxRate
	if !almostEqual(outcome.NetProjectedValue, wantNet, 1e-9) {
		t.Errorf("NetProjectedValue = %v, want %v", outcome.NetProjectedValue, wantNet)
	}
}

// TestSimulate_NaoRecebeRepositoryNemPersisteNada confere estruturalmente o
// critério de aceite "endpoint de simulação nunca grava market_events":
// Simulate só recebe SimulateRequest/SimulateContext (nenhum Repository,
// nenhuma conexão de banco) — não há como persistir nada a partir daqui,
// diferente de Purchase/Redeem (chamados só via Service, que sim recebe um
// Repository). A garantia de zero linhas novas em market_events é validada
// ponta a ponta via docker compose (.docs/engine/fixedincome.md).
func TestSimulate_NaoRecebeRepositoryNemPersisteNada(t *testing.T) {
	ctx := SimulateContext{AnnualRatePct: 10, MaturityDate: purchaseMaturity}
	if _, err := Simulate(SimulateRequest{Amount: 2000, DaysHeld: 180}, ctx, purchaseNow, 0, 0, 0, 0); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
}
