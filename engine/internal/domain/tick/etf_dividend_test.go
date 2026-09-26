package tick

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/etf"
)

func dividendFixture(cash, liabilities float64) (*Service, *fakeETFFunds) {
	funds := &fakeETFFunds{
		funds: []etf.FundSnapshot{{
			ETFAssetID: "etf1", FundAccountID: "fund1", Shares: 1000, Cash: cash, Liabilities: liabilities,
			Holdings: []etf.FundHolding{{AssetID: "a", Quantity: 1000}},
		}},
		holders: map[string][]PositionHolder{"etf1": {{UserID: "u1", Quantity: 600}, {UserID: "u2", Quantity: 400}}},
	}
	svc := newTestService(&fakeRepository{})
	svc.WithETF(ETFDeps{Funds: funds})
	return svc, funds
}

func TestClosingETFNAVs_DiaDeRelatorioDistribuiOCaixaLivre(t *testing.T) {
	svc, _ := dividendFixture(5000, 0)

	navs, dividends, err := svc.closingETFNAVs(context.Background(),
		map[string]float64{"a": 10}, map[string]float64{"etf1": 15}, map[string]float64{"a": 10}, true, 20)
	if err != nil || len(dividends) != 1 || len(navs) != 1 {
		t.Fatalf("navs = %+v, dividendos = %+v, err = %v", navs, dividends, err)
	}
	d := dividends[0]
	if d.AssetID != "etf1" || d.ValuePerShare != 5 || d.PaymentDay != 20 || d.FundLiability != 5000 || len(d.Recipients) != 2 {
		t.Errorf("provento = %+v, want 5,00 por cota, pago no dia 20, passivo de 5.000 e 2 cotistas", d)
	}
	// NAV cai na data-ex: (1000 x 10 + 5000 - 5000) / 1000 = 10, sem o passivo seria 15
	if navs[0].NAV != 10 {
		t.Errorf("NAV = %v, want 10 (o passivo do provento já entra no NAV do dia)", navs[0].NAV)
	}
}

func TestClosingETFNAVs_ForaDoDiaDeRelatorioNaoGeraProvento(t *testing.T) {
	svc, _ := dividendFixture(5000, 0)

	navs, dividends, err := svc.closingETFNAVs(context.Background(),
		map[string]float64{"a": 10}, map[string]float64{"etf1": 15}, map[string]float64{"a": 10}, false, 20)
	if err != nil || len(dividends) != 0 {
		t.Fatalf("dividendos = %+v, err = %v, want nenhum", dividends, err)
	}
	if navs[0].NAV != 15 {
		t.Errorf("NAV = %v, want 15 (caixa ainda conta inteiro)", navs[0].NAV)
	}
}

func TestClosingETFNAVs_SemCaixaLivreNaoGeraProvento(t *testing.T) {
	// o caixa inteiro já é devido a um provento anterior ainda não pago
	svc, _ := dividendFixture(5000, 5000)

	_, dividends, err := svc.closingETFNAVs(context.Background(),
		map[string]float64{"a": 10}, map[string]float64{"etf1": 15}, map[string]float64{"a": 10}, true, 20)
	if err != nil || len(dividends) != 0 {
		t.Errorf("dividendos = %+v, err = %v, want nenhum", dividends, err)
	}
}

func TestClosingETFNAVs_ProventoNuncaExcedeOCaixa(t *testing.T) {
	// 1.000 cotas, caixa 1.000,50: 1,00 por cota (arredonda para baixo), total 1.000
	svc, _ := dividendFixture(1000.5, 0)

	_, dividends, _ := svc.closingETFNAVs(context.Background(),
		map[string]float64{"a": 10}, map[string]float64{"etf1": 15}, map[string]float64{"a": 10}, true, 20)
	if len(dividends) != 1 || dividends[0].ValuePerShare != 1 || dividends[0].FundLiability != 1000 {
		t.Errorf("dividendos = %+v, want 1,00 por cota e total 1.000", dividends)
	}
}

func TestRebalanceETFs_NaoInvesteOCaixaDeDividendoDoFundo(t *testing.T) {
	// 100% em a, alvo 50/50; o caixa do fundo (dividendo a distribuir, devido ou não)
	// não financia a compra: só a venda financia a compra de b
	svc, run, submitter, _ := rebalanceFixture(1000, 0, nil, 14)
	fund := run.etfFunds["etf1"]
	fund.Cash, fund.Liabilities = 3000, 0
	run.etfFunds["etf1"] = fund

	if _, err := svc.rebalanceETFs(context.Background(), run); err != nil {
		t.Fatal(err)
	}
	var bought int
	for _, o := range submitter.submitted {
		if o.req.AssetID == "b" {
			bought += o.req.Quantity
		}
	}
	// vende 500 de a a 10 = 5.000 de caixa; a compra de b é limitada a 5.000/(10 x 1,02) = 490
	if bought != 490 {
		t.Errorf("comprou %d de b, want 490 (o caixa de dividendo não entra)", bought)
	}
}
