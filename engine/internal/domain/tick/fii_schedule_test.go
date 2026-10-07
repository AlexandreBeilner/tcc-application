package tick

import (
	"testing"

	"tcc-investimentos/engine/internal/domain/dividend"
	"tcc-investimentos/engine/internal/domain/paymentschedule"
	"tcc-investimentos/engine/internal/domain/selic"
)

func scheduledFII(cutover, payBusinessDay int) DividendPayerAsset {
	netWorth := 100_000_000.0
	shares := int64(1_000_000)
	fiiType := "tijolo"
	return DividendPayerAsset{
		AssetID: "fii1", Type: "fii", NetWorth: &netWorth, OutstandingShares: &shares, FIIType: &fiiType,
		Holders:             []PositionHolder{{UserID: "u1", Quantity: 10}},
		FIIScheduleAssigned: true, FIIPayoutBusinessDay: payBusinessDay, ScheduleCutoverDay: cutover,
	}
}

func fiiDividendsOn(a DividendPayerAsset, day int) []DividendRecord {
	cfg := selic.Config{Neutral: 10, Seed: 1}
	return Advance(State{Day: day - 1, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{a}, nil, cfg, testIPCAConfig(), 1).NewDividends
}

func TestAdvance_FIIPagaNoMesRealComODiaUtilDoFundo(t *testing.T) {
	for _, n := range []int{5, 10, 15} {
		a := scheduledFII(0, n)
		count := 0
		for day := 1; day <= 365; day++ {
			recs := fiiDividendsOn(a, day)
			if len(recs) == 0 {
				continue
			}
			count++
			_, ex, pay, ok := paymentschedule.FIIPayoutOn(day, n)
			if !ok || recs[0].ExDay != ex || recs[0].PaymentDay != pay {
				t.Fatalf("n=%d dia %d: ex %d pay %d, want %d e %d", n, day, recs[0].ExDay, recs[0].PaymentDay, ex, pay)
			}
		}
		if count < 11 || count > 12 {
			t.Errorf("n=%d: %d pagamentos em 365 dias, want 12 (11 se o último mês ainda não fechou)", n, count)
		}
	}
}

func TestAdvance_FIIDeFundosDiferentesPagamEmDiasDiferentes(t *testing.T) {
	find := func(n int) int {
		for day := 40; day < 70; day++ {
			if len(fiiDividendsOn(scheduledFII(0, n), day)) > 0 {
				return fiiDividendsOn(scheduledFII(0, n), day)[0].PaymentDay
			}
		}
		return 0
	}
	if a, b := find(5), find(12); a == 0 || a == b {
		t.Errorf("fundos com dias úteis diferentes pagaram no mesmo dia: %d e %d", a, b)
	}
}

func TestAdvance_FIIRespeitaODiaDeCorte(t *testing.T) {
	a := scheduledFII(100, 10)
	// Antes do corte vale o ciclo legado de 30 dias (dia 30, 60, 90), sem data-ex futura.
	rec := fiiDividendsOn(a, 60)
	if len(rec) != 1 || rec[0].ExDay != 0 || rec[0].PaymentDay != 60+dividend.DefaultPaymentLagDays {
		t.Errorf("antes do corte esperava o legado, veio %+v", rec)
	}
	// Depois do corte o ciclo de 30 dias não paga mais; só a data-ex mensal.
	if len(fiiDividendsOn(a, 120)) != 0 {
		t.Error("o dia 120 é do ciclo legado e não deveria pagar depois do corte")
	}
}

func TestFIIDividendPriceEffectPct_BandaContaDesdeADataEx(t *testing.T) {
	a := scheduledFII(0, 10)
	ex := 0
	for day := 40; ex == 0; day++ {
		if _, e, _, ok := paymentschedule.FIIPayoutOn(day, 10); ok {
			ex = e
		}
	}
	at := func(day int) float64 {
		return fiiDividendPriceEffectPct(a, 100_000_000, 1_000_000, 1.0, day-1)
	}
	if at(ex) >= 0 {
		t.Error("na data-ex o efeito negativo começa")
	}
	if at(ex+dividendPriceEffectBandDays) != 0 {
		t.Error("depois da banda o efeito termina")
	}
}
