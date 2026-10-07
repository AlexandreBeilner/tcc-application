package tick

import (
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/paymentschedule"
	"tcc-investimentos/engine/internal/domain/selic"
)

func payingCompany(policy catalog.DividendPolicy, offset int, prior ...float64) CompanyForFundamentals {
	c := scheduledCompany("c1", offset)
	c.ScheduleAssigned = true
	c.DividendPolicy = policy
	c.ComLagDays = 1
	c.PaymentLagDays = 10
	c.PriorNetIncomes = prior
	return c
}

func dividendsOn(c CompanyForFundamentals, day int) []DividendRecord {
	shares := int64(1000)
	id := c.CompanyID
	payer := DividendPayerAsset{AssetID: "a1", Type: "acao", CompanyID: &id, OutstandingShares: &shares}
	cfg := selic.Config{Neutral: 10, Seed: 1}
	return Advance(State{Day: day - 1, SelicRate: 10}, nil, []CompanyForFundamentals{c}, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1).NewDividends
}

func TestAdvance_ProventoPorPolitica(t *testing.T) {
	// Ciclos 0..3 de uma empresa com offset 0 (balanços nos dias 91, 182, 273, 364), corte 0.
	days := []int{91, 182, 273, 364}
	tests := []struct {
		policy catalog.DividendPolicy
		pays   [4]bool
	}{
		{catalog.DividendQuarterly, [4]bool{true, true, true, true}},
		{catalog.DividendSemiannual, [4]bool{false, true, false, true}},
		{catalog.DividendAnnual, [4]bool{false, false, false, true}},
	}
	for _, tt := range tests {
		for k, day := range days {
			got := len(dividendsOn(payingCompany(tt.policy, 0), day)) == 1
			if got != tt.pays[k] {
				t.Errorf("%s, balanço %d (dia %d): pagou = %v, want %v", tt.policy, k+1, day, got, tt.pays[k])
			}
		}
	}
}

func TestAdvance_ProventoSemestralAcumulaOPool(t *testing.T) {
	single := dividendsOn(payingCompany(catalog.DividendSemiannual, 0), 182)
	if len(single) != 1 {
		t.Fatal("o 2º balanço do semestral deveria pagar")
	}
	c := payingCompany(catalog.DividendSemiannual, 0)
	fin := fundamentals.DeriveFinancials(catalog.SectorMineracao, 1, fundamentals.DefaultBaseRevenue)
	c.PriorNetIncomes = []float64{fin.NetIncome}
	withPrior := dividendsOn(c, 182)[0].ValuePerShare
	if withPrior <= single[0].ValuePerShare {
		t.Errorf("com o lucro do trimestre anterior no pool o valor deveria subir: %v <= %v", withPrior, single[0].ValuePerShare)
	}
}

func TestAdvance_ProventoDatasEmDiaUtil(t *testing.T) {
	c := payingCompany(catalog.DividendQuarterly, 7)
	report := paymentschedule.ReportDay(91, 7, 0)
	rec := dividendsOn(c, report)[0]

	wantEx := paymentschedule.ExDay(paymentschedule.ComDay(report, 1))
	if rec.ExDay != wantEx || rec.PaymentDay != paymentschedule.PaymentDay(wantEx, 10) {
		t.Errorf("ex = %d, pagamento = %d, want %d e %d", rec.ExDay, rec.PaymentDay, wantEx, paymentschedule.PaymentDay(wantEx, 10))
	}
	if rec.ExDay <= report || rec.PaymentDay <= rec.ExDay {
		t.Errorf("ordem inválida: balanço %d, ex %d, pagamento %d", report, rec.ExDay, rec.PaymentDay)
	}
}

func TestAdvance_ProventoSemAgendaSegueOLegado(t *testing.T) {
	c := scheduledCompany("c1", 0) // ScheduleAssigned false
	rec := dividendsOn(c, 91)[0]
	if rec.ExDay != 91 || rec.PaymentDay != 91+catalog.DefaultPaymentLagDays {
		t.Errorf("ex = %d, pagamento = %d, want 91 e %d", rec.ExDay, rec.PaymentDay, 91+catalog.DefaultPaymentLagDays)
	}
}

func TestDividendPriceEffectPct_AncoradoNaDataExEPulaBalancoQueNaoPaga(t *testing.T) {
	fin := fundamentals.DeriveFinancials(catalog.SectorMineracao, 1, fundamentals.DefaultBaseRevenue)
	c := payingCompany(catalog.DividendSemiannual, 0)
	paying := paymentschedule.EquityCycleAt(91, 0, 0, true, c.DividendPolicy, c.ComLagDays, c.PaymentLagDays, 1)

	at := func(day int) float64 { return dividendPriceEffectPct(fin, day-1, c) }

	if at(91+3) != 0 {
		t.Error("o 1º balanço do semestral não paga: sem efeito")
	}
	if at(paying.Ex-1) != 0 {
		t.Error("antes da data-ex ainda não há efeito")
	}
	if at(paying.Ex) >= 0 {
		t.Error("na data-ex o efeito negativo começa")
	}
	if at(paying.Ex+dividendPriceEffectBandDays) != 0 {
		t.Error("depois da banda o efeito termina")
	}
}
