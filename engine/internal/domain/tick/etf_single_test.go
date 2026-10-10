package tick

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/etf"
)

// ETF com um só constituinte (caso de borda da R.12): a cesta inteira é um ativo, sem
// nada para reponderar, e o NAV segue o preço dele.

func TestIssueETFs_UmSoConstituinteCriaCotasPelaCestaInteira(t *testing.T) {
	pending := etf.PendingIssuance{
		ETFAssetID: "etf1", FundAccountID: "fund1",
		Holdings: []etf.Holding{{ConstituentName: "A", AssetID: assetPtr("a"), WeightPct: 100}},
	}
	svc, _, exchanger := etfTestService([]etf.PendingIssuance{pending}, nil)
	run := &roundRun{equities: map[string]*equityRoundState{"a": {Price: 100}}, volumeByAssetID: map[string]int{}}

	if err := svc.issueETFs(context.Background(), run); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(exchanger.created) != 1 {
		t.Fatalf("criações = %d, want 1", len(exchanger.created))
	}
	got := exchanger.created[0]
	if got.Shares != 10000 || len(got.Basket) != 1 || got.Basket[0].Quantity != 10000 {
		t.Errorf("troca = %+v, want 10000 cotas contra 10000 do único constituinte", got)
	}
}

func TestClosingETFNAVs_UmSoConstituinteSegueOPrecoDele(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.WithETF(ETFDeps{Funds: &fakeETFFunds{funds: []etf.FundSnapshot{{
		ETFAssetID: "etf1", Shares: 1000, Holdings: []etf.FundHolding{{AssetID: "a", Quantity: 1000}},
		Targets: []etf.TargetWeight{{AssetID: "a", WeightPct: 100}},
	}}, indexes: map[string]float64{"etf1": 10}}})

	got, _, err := svc.closingETFNAVs(context.Background(), map[string]float64{"a": 11}, map[string]float64{"etf1": 11}, map[string]float64{"a": 10}, false, 15, 0)
	if err != nil || len(got) != 1 {
		t.Fatalf("entradas = %+v, err = %v", got, err)
	}
	// NAV 11 e índice 10 x 1,1 = 11: o fundo acompanha o único constituinte sem desvio
	if got[0].NAV != 11 || got[0].IndexValue < 10.999 || got[0].IndexValue > 11.001 || got[0].TrackingErrorPct > 0.01 || got[0].TrackingErrorPct < -0.01 {
		t.Errorf("NAV = %v, índice = %v, tracking = %v, want 11, 11 e 0", got[0].NAV, got[0].IndexValue, got[0].TrackingErrorPct)
	}
}

func TestRebalanceETFs_UmSoConstituinteNaoTemNadaParaReponderar(t *testing.T) {
	svc, run, submitter, _ := rebalanceFixture(1000, 0, intPtr(0), 14)
	fund := run.etfFunds["etf1"]
	fund.Holdings = []etf.FundHolding{{AssetID: "a", Quantity: 1000}}
	fund.Targets = []etf.TargetWeight{{AssetID: "a", WeightPct: 100}}
	run.etfFunds["etf1"] = fund

	if _, err := svc.rebalanceETFs(context.Background(), run); err != nil {
		t.Fatal(err)
	}
	if len(submitter.submitted) != 0 {
		t.Errorf("ordens = %d, want 0 (cesta de um ativo já está no peso-alvo)", len(submitter.submitted))
	}
}
