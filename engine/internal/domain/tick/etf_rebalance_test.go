package tick

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/orderbook"
)

func rebalanceFixture(a, b int64, last *int, dayIndex int) (*Service, *roundRun, *fakeOrderSubmitter, *fakeETFFunds) {
	funds := &fakeETFFunds{}
	svc := newTestService(&fakeRepository{})
	submitter := &fakeOrderSubmitter{fillPrice: 10}
	svc.orderSubmitter = submitter
	svc.WithETF(ETFDeps{Funds: funds})
	fund := etf.FundSnapshot{
		ETFAssetID: "etf1", FundAccountID: "fund1", Shares: 1000, RebalanceEveryDays: 14, LastRebalanceDay: last,
		Holdings: []etf.FundHolding{{AssetID: "a", Quantity: a}, {AssetID: "b", Quantity: b}},
		Targets:  []etf.TargetWeight{{AssetID: "a", WeightPct: 50}, {AssetID: "b", WeightPct: 50}},
	}
	run := &roundRun{
		dayIndex:        dayIndex,
		equities:        map[string]*equityRoundState{"a": {Price: 10}, "b": {Price: 10}},
		volumeByAssetID: map[string]int{},
		etfFunds:        map[string]etf.FundSnapshot{"etf1": fund},
	}
	return svc, run, submitter, funds
}

func TestRebalanceETFs_NoDiaDoCalendarioVendeAntesDeComprar(t *testing.T) {
	svc, run, submitter, funds := rebalanceFixture(700, 300, intPtr(0), 14)

	traded, err := svc.rebalanceETFs(context.Background(), run)
	if err != nil || !traded {
		t.Fatalf("traded = %v, err = %v, want true, nil", traded, err)
	}
	if len(submitter.submitted) != 2 {
		t.Fatalf("ordens = %+v, want 2", submitter.submitted)
	}
	sell, buy := submitter.submitted[0].req, submitter.submitted[1].req
	if sell.Side != orderbook.SideSell || sell.AssetID != "a" || sell.Quantity != 200 || sell.UserID != "fund1" {
		t.Errorf("primeira ordem = %+v, want venda de 200 de a pela conta do fundo", sell)
	}
	if buy.Side != orderbook.SideBuy || buy.AssetID != "b" || buy.Quantity != 196 {
		// a venda rende 2.000 e a folga de 2% de preço limita a compra a 196 (cash drag esperado)
		t.Errorf("segunda ordem = %+v, want compra de 196 de b", buy)
	}
	if funds.rebalanced["etf1"] != 14 {
		t.Errorf("último rebalanceamento = %v, want dia 14 gravado", funds.rebalanced)
	}
}

func intPtr(i int) *int { return &i }

func TestRebalanceETFs_ForaDoCalendarioESemDerivaNaoFazNada(t *testing.T) {
	// deriva de 2 pontos (52/48) e só 5 dias desde o último
	svc, run, submitter, funds := rebalanceFixture(520, 480, intPtr(9), 14)

	traded, err := svc.rebalanceETFs(context.Background(), run)
	if err != nil || traded {
		t.Fatalf("traded = %v, err = %v, want false, nil", traded, err)
	}
	if len(submitter.submitted) != 0 || len(funds.rebalanced) != 0 {
		t.Errorf("ordens = %d, marcações = %v, want nada", len(submitter.submitted), funds.rebalanced)
	}
}

func TestRebalanceETFs_DerivaForteRebalanceiaForaDoCalendario(t *testing.T) {
	// 80/20: deriva de 30 pontos, mesmo com o último rebalanceamento ontem
	svc, run, submitter, _ := rebalanceFixture(800, 200, intPtr(13), 14)

	traded, err := svc.rebalanceETFs(context.Background(), run)
	if err != nil || !traded {
		t.Fatalf("traded = %v, err = %v, want true, nil", traded, err)
	}
	if len(submitter.submitted) != 2 {
		t.Errorf("ordens = %d, want 2", len(submitter.submitted))
	}
}

func TestRebalanceETFs_CompraLimitadaAoCaixaDaVenda(t *testing.T) {
	// o fundo não tem caixa: a compra só pode usar o que a venda gerou
	svc, run, submitter, _ := rebalanceFixture(700, 300, intPtr(0), 14)
	submitter.fillPrice = 5 // a venda rende metade do que a compra custaria a preço de referência
	svc.orderSubmitter = submitter

	if _, err := svc.rebalanceETFs(context.Background(), run); err != nil {
		t.Fatal(err)
	}
	buy := submitter.submitted[len(submitter.submitted)-1].req
	// caixa da venda: 200 x 5 = 1000; preço corrente de b após o fill é 5 (equities atualizado): cabe 1000/(5*1,02)
	if buy.Quantity > 196 {
		t.Errorf("compra = %d, want limitada pelo caixa da venda (<= 196)", buy.Quantity)
	}
}

func TestRebalanceETFs_ConstituenteForaDoUniversoNaoAge(t *testing.T) {
	svc, run, submitter, _ := rebalanceFixture(700, 300, nil, 14)
	delete(run.equities, "b")

	traded, err := svc.rebalanceETFs(context.Background(), run)
	if err != nil || traded || len(submitter.submitted) != 0 {
		t.Errorf("traded = %v, err = %v, ordens = %d, want nada", traded, err, len(submitter.submitted))
	}
}

func TestRebalanceETFs_SemWithETFNaoFazNada(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	if traded, err := svc.rebalanceETFs(context.Background(), etfTestRun()); err != nil || traded {
		t.Errorf("traded = %v, err = %v, want false, nil", traded, err)
	}
}

func TestClosingETFNAVs_IndiceAvancaEMedeTracking(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.WithETF(ETFDeps{Funds: &fakeETFFunds{
		funds: []etf.FundSnapshot{{
			ETFAssetID: "etf1", Shares: 1000, Holdings: []etf.FundHolding{{AssetID: "a", Quantity: 600}, {AssetID: "b", Quantity: 400}},
			Targets: []etf.TargetWeight{{AssetID: "a", WeightPct: 60}, {AssetID: "b", WeightPct: 40}},
		}},
		indexes: map[string]float64{"etf1": 10},
	}})

	got, _, err := svc.closingETFNAVs(context.Background(),
		map[string]float64{"a": 11, "b": 10}, map[string]float64{"etf1": 10},
		map[string]float64{"a": 10, "b": 10}, false, 15, 0)
	if err != nil || len(got) != 1 {
		t.Fatalf("got = %+v, err = %v", got, err)
	}
	// índice: 10 x (1 + 0,6 x 10%) = 10,6; NAV = (600x11 + 400x10)/1000 = 10,6, sem desvio
	if got[0].IndexValue < 10.599 || got[0].IndexValue > 10.601 {
		t.Errorf("índice = %v, want 10,6", got[0].IndexValue)
	}
	if got[0].TrackingErrorPct > 0.001 || got[0].TrackingErrorPct < -0.001 {
		t.Errorf("tracking = %v, want ~0", got[0].TrackingErrorPct)
	}
}
