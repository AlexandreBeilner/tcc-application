package tick

import (
	"context"
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/orderbook"
)

func expenseFixture(cash, fees float64) *Service {
	funds := &fakeETFFunds{funds: []etf.FundSnapshot{{
		ETFAssetID: "etf1", FundAccountID: "fund1", Shares: 1000, Cash: cash, Liabilities: fees, FeesPayable: fees,
		ExpenseRatioPct: 0.5,
		Holdings:        []etf.FundHolding{{AssetID: "a", Quantity: 1000}},
	}}}
	svc := newTestService(&fakeRepository{})
	svc.WithETF(ETFDeps{Funds: funds})
	return svc
}

func TestClosingETFNAVs_TaxaDiariaReduzONAV(t *testing.T) {
	svc := expenseFixture(0, 0)
	prices := map[string]float64{"a": 100}

	navs, _, err := svc.closingETFNAVs(context.Background(), prices, map[string]float64{"etf1": 100}, prices, false, 0)
	if err != nil || len(navs) != 1 {
		t.Fatalf("navs = %+v, err = %v", navs, err)
	}
	// patrimônio 100.000, 0,5% ao ano: 1,3699 por dia; NAV = (100.000 - 1,3699) / 1000
	wantFee := 100_000 * 0.005 / 365
	if math.Abs(navs[0].ExpenseAccrued-wantFee) > 1e-9 {
		t.Errorf("taxa do dia = %v, want %v", navs[0].ExpenseAccrued, wantFee)
	}
	if want := (100_000 - wantFee) / 1000; math.Abs(navs[0].NAV-want) > 1e-9 {
		t.Errorf("NAV = %v, want %v (sem negociação, cai só a taxa do dia)", navs[0].NAV, want)
	}
	if navs[0].ExpensePaid != 0 {
		t.Errorf("pago = %v, want 0 fora do dia de relatório", navs[0].ExpensePaid)
	}
}

func TestClosingETFNAVs_DiaDeRelatorioQuitaATaxaDoCaixa(t *testing.T) {
	svc := expenseFixture(500, 30)
	prices := map[string]float64{"a": 100}

	navs, _, err := svc.closingETFNAVs(context.Background(), prices, map[string]float64{"etf1": 100}, prices, true, 20)
	if err != nil {
		t.Fatal(err)
	}
	if navs[0].ExpensePaid != 30 {
		t.Errorf("pago = %v, want 30 (a taxa acumulada, o caixa cobre)", navs[0].ExpensePaid)
	}
	// pagar do caixa não muda o NAV: cai o caixa e cai o passivo pelo mesmo valor
	wantFee := (100_000 + 500 - 30) * 0.005 / 365
	if want := (100_000 + 470 - wantFee) / 1000; math.Abs(navs[0].NAV-want) > 1e-6 {
		t.Errorf("NAV = %v, want %v", navs[0].NAV, want)
	}
}

func TestClosingETFNAVs_TaxaNaoEntraNoCaixaLivreDoProvento(t *testing.T) {
	// caixa 40 com 30 de taxa acumulada e sem dividendos devidos: paga a taxa e distribui só o resto
	svc := expenseFixture(40, 30)
	svc.etf.Funds.(*fakeETFFunds).holders = map[string][]PositionHolder{"etf1": {{UserID: "u1", Quantity: 1000}}}
	prices := map[string]float64{"a": 100}

	_, dividends, err := svc.closingETFNAVs(context.Background(), prices, map[string]float64{"etf1": 100}, prices, true, 20)
	if err != nil {
		t.Fatal(err)
	}
	// depois de pagar 30 sobram 10 de caixa; a taxa do dia (1,37) é passivo, então distribui 8,63 / 1000 -> 0,00
	if len(dividends) != 0 {
		t.Errorf("dividendos = %+v, want nenhum (o que sobra é menos de um centavo por cota)", dividends)
	}
}

func TestRaiseFundCash_VendeConstituintesQuandoFaltaCaixaParaATaxa(t *testing.T) {
	svc, run, submitter, _ := rebalanceFixture(600, 400, nil, 13) // dayIndex 13 é dia de relatório (ciclo de 14)
	fund := run.etfFunds["etf1"]
	fund.Cash, fund.Liabilities, fund.FeesPayable = 0, 100, 100
	run.etfFunds["etf1"] = fund

	traded, err := svc.raiseFundCash(context.Background(), run)
	if err != nil || !traded {
		t.Fatalf("traded = %v, err = %v, want true, nil", traded, err)
	}
	var sold float64
	for _, o := range submitter.submitted {
		if o.req.Side != orderbook.SideSell || o.req.UserID != "fund1" {
			t.Errorf("ordem = %+v, want só vendas pela conta do fundo", o.req)
		}
		sold += float64(o.req.Quantity) * 10
	}
	if sold < 100 || sold > 150 {
		t.Errorf("vendeu %v, want cerca de 100 (a taxa) com folga pequena", sold)
	}
}

func TestRaiseFundCash_CaixaCobreOuForaDoDiaDeRelatorioNaoFazNada(t *testing.T) {
	svc, run, submitter, _ := rebalanceFixture(600, 400, nil, 13)
	fund := run.etfFunds["etf1"]
	fund.Cash, fund.Liabilities, fund.FeesPayable = 500, 100, 100
	run.etfFunds["etf1"] = fund
	if traded, _ := svc.raiseFundCash(context.Background(), run); traded || len(submitter.submitted) != 0 {
		t.Errorf("com caixa suficiente: traded = %v, ordens = %d, want nada", traded, len(submitter.submitted))
	}

	run.etfFunds["etf1"] = etf.FundSnapshot{ETFAssetID: "etf1", FundAccountID: "fund1", Liabilities: 100, FeesPayable: 100,
		Holdings: []etf.FundHolding{{AssetID: "a", Quantity: 600}, {AssetID: "b", Quantity: 400}}}
	run.dayIndex = 5
	if traded, _ := svc.raiseFundCash(context.Background(), run); traded || len(submitter.submitted) != 0 {
		t.Errorf("fora do dia de relatório: traded = %v, ordens = %d, want nada", traded, len(submitter.submitted))
	}
}
