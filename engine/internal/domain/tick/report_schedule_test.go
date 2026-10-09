package tick

import (
	"testing"

	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/paymentschedule"
	"tcc-investimentos/engine/internal/domain/selic"
)

func scheduledCompany(id string, offset int) CompanyForFundamentals {
	return CompanyForFundamentals{
		BaseGrowthPct:       fundamentals.DefaultBaseGrowth * 100,
		CompanyID:           id,
		ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays,
		Sector:              "Mineração",
		ReportOffsetDays:    offset,
	}
}

// reportDaysOf avança o motor dia a dia e devolve, por empresa, os dias (1-based)
// em que ela divulgou balanço.
func reportDaysOf(companies []CompanyForFundamentals, days int) map[string][]int {
	got := map[string][]int{}
	for d := 0; d < days; d++ {
		r := Advance(State{Day: d, SelicRate: 10}, nil, companies, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)
		for _, f := range r.Fundamentals {
			got[f.CompanyID] = append(got[f.CompanyID], d+1)
		}
	}
	return got
}

func TestAdvance_BalancoEscalonadoPorEmpresa(t *testing.T) {
	companies := []CompanyForFundamentals{scheduledCompany("legado", 0), scheduledCompany("cedo", 5), scheduledCompany("tarde", 30)}

	got := reportDaysOf(companies, 330)

	for _, c := range companies {
		var want []int
		for k := 0; k < 3; k++ {
			want = append(want, paymentschedule.ReportDay(91, c.ReportOffsetDays, k))
		}
		if len(got[c.CompanyID]) != len(want) {
			t.Fatalf("%s: dias %v, want %v", c.CompanyID, got[c.CompanyID], want)
		}
		for i := range want {
			if got[c.CompanyID][i] != want[i] {
				t.Errorf("%s: dias %v, want %v", c.CompanyID, got[c.CompanyID], want)
				break
			}
		}
	}
	if got["legado"][0] != 91 {
		t.Errorf("offset 0 deveria reportar no dia 91, reportou em %d", got["legado"][0])
	}
	if got["cedo"][0] == got["tarde"][0] || got["cedo"][0] == got["legado"][0] {
		t.Errorf("empresas com offsets diferentes reportaram no mesmo dia: %v", got)
	}
}

func TestAdvance_BalancoRespeitaODiaDeCorte(t *testing.T) {
	c := scheduledCompany("c1", 10)
	c.ScheduleCutoverDay = 100 // o ciclo 0 (fim no dia 91) já saiu pelo relógio global

	got := reportDaysOf([]CompanyForFundamentals{c}, 200)["c1"]

	if len(got) != 2 || got[0] != 91 || got[1] != paymentschedule.ReportDay(91, 10, 1) {
		t.Errorf("dias = %v, want [91 %d] (ciclo 0 legado, ciclo 1 com offset)", got, paymentschedule.ReportDay(91, 10, 1))
	}
}

func TestAdvance_EfeitoMacroDeFundamentosAplicaNoBalancoDeCadaEmpresa(t *testing.T) {
	assetID := "a1"
	companyID := "tarde"
	risk := "Sofisticado"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &risk, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{scheduledCompany(companyID, 30)}
	cfg := selic.Config{Neutral: 10, Seed: 1}
	pct, reportDay := 20.0, 91
	event := MacroEventForApplication{
		ID: "e1", AffectsFundamentals: true, FundamentalsEffectPct: &pct, FundamentalsReportDay: &reportDay,
		Targets: []MacroEventTargetForApplication{{AssetID: &assetID}},
	}
	lateDay := paymentschedule.ReportDay(91, 30, 0)

	// No dia global do ciclo a empresa ainda não reportou: o evento segue pendente.
	atBase := Advance(State{Day: 90, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)
	if len(atBase.Fundamentals) != 0 || len(atBase.AppliedMacroEventIDs) != 0 {
		t.Fatalf("no dia 91 a empresa não reporta e o evento não termina: %+v", atBase.AppliedMacroEventIDs)
	}

	with := Advance(State{Day: lateDay - 1, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)
	without := Advance(State{Day: lateDay - 1, SelicRate: 10}, assets, companies, nil, nil, nil, cfg, testIPCAConfig(), 1)
	if with.Fundamentals[0].NetRevenue == without.Fundamentals[0].NetRevenue {
		t.Error("o efeito macro não foi aplicado no balanço atrasado da empresa")
	}
	if len(with.AppliedMacroEventIDs) != 0 {
		t.Errorf("AppliedMacroEventIDs = %v, o evento só termina depois da folga máxima de balanço do ciclo", with.AppliedMacroEventIDs)
	}
	done := Advance(State{Day: reportDay + paymentschedule.MaxReportSpanDays(30) - 1, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)
	if len(done.AppliedMacroEventIDs) != 1 {
		t.Errorf("AppliedMacroEventIDs = %v, want o evento concluído depois do último balanço do ciclo", done.AppliedMacroEventIDs)
	}
}

func TestDividendPriceEffectPct_JanelaContaDesdeOBalancoDaEmpresa(t *testing.T) {
	fin := fundamentals.DeriveFinancials("Mineração", 1, fundamentals.DefaultBaseRevenue)
	c := scheduledCompany("c1", 10)
	reportDay := paymentschedule.ReportDay(91, 10, 0)

	if got := dividendPriceEffectPct(fin, reportDay-2, c); got != 0 {
		t.Errorf("antes do balanço da empresa o efeito deveria ser 0, veio %v", got)
	}
	if got := dividendPriceEffectPct(fin, reportDay-1, c); got == 0 {
		t.Error("no dia do balanço o efeito deveria estar ativo")
	}
	if got := dividendPriceEffectPct(fin, reportDay-1+dividendPriceEffectBandDays, c); got != 0 {
		t.Errorf("fora da banda o efeito deveria ser 0, veio %v", got)
	}
}
