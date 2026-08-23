package tick

import (
	"testing"

	"tcc-investimentos/engine/internal/domain/dividend"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/macroevent"
	"tcc-investimentos/engine/internal/domain/selic"
)

func testSelicConfig() selic.Config {
	return selic.Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 0, Seed: 1}
}

func TestAdvance_PrimeiroTickComecaNoDia1(t *testing.T) {
	result := Advance(State{Day: 0, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), 1)

	if result.State.Day != 1 {
		t.Errorf("State.Day = %d, want 1", result.State.Day)
	}
}

func TestAdvance_AvancaUmDiaDeCadaVez(t *testing.T) {
	result := Advance(State{Day: 5, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), 1)

	if result.State.Day != 6 {
		t.Errorf("State.Day = %d, want 6", result.State.Day)
	}
}

func TestAdvance_SemAtivosNaoGeraCotacoes(t *testing.T) {
	result := Advance(State{Day: 0, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), 1)

	if len(result.Quotes) != 0 {
		t.Errorf("len(Quotes) = %d, want 0", len(result.Quotes))
	}
}

func TestAdvance_SemCotacaoAnteriorUsaDefaultInitialPrice(t *testing.T) {
	riskClass := "Conservador"
	assets := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil}}

	// Volatility=0 e ReversionSpeed=0 isolam o efeito do preço inicial —
	// sem eles o drift ainda move o preço, mas o teste só quer confirmar
	// que partiu de DefaultInitialPrice, não de outro valor arbitrário.
	result := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, testSelicConfig(), 1)

	if len(result.Quotes) != 1 {
		t.Fatalf("len(Quotes) = %d, want 1", len(result.Quotes))
	}
	// O preço gerado deve ser próximo de DefaultInitialPrice (GBM de um
	// único passo não se afasta muito do ponto de partida).
	if result.Quotes[0].Price <= 0 {
		t.Errorf("Quotes[0].Price = %v, want > 0", result.Quotes[0].Price)
	}
}

func TestAdvance_UsaLastPriceQuandoExiste(t *testing.T) {
	riskClass := "Conservador"
	lastPrice := 250.0
	assets := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: &lastPrice}}

	withHistory := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, testSelicConfig(), 1)

	assetsNoHistory := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil}}
	withoutHistory := Advance(State{Day: 0, SelicRate: 10}, assetsNoHistory, nil, nil, nil, nil, testSelicConfig(), 1)

	if withHistory.Quotes[0].Price == withoutHistory.Quotes[0].Price {
		t.Error("preço partindo de LastPrice = 250 veio igual ao partindo de DefaultInitialPrice — LastPrice não foi usado")
	}
}

func TestAdvance_RiskClassAusenteUsaConservadorComoDefault(t *testing.T) {
	// ETF/FII não têm risk_class no catálogo hoje (tarefa 3.9) — Advance
	// não deve simplesmente pular esses ativos.
	assets := []AssetForPricing{{AssetID: "etf1", RiskClass: nil, LastPrice: nil}}

	result := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, testSelicConfig(), 1)

	if len(result.Quotes) != 1 {
		t.Fatalf("len(Quotes) = %d, want 1 (risk_class nula deveria usar Conservador como default)", len(result.Quotes))
	}
}

func TestAdvance_SinalizaDiaDeReuniaoDoCopom(t *testing.T) {
	// Day: selic.CopomMeetingIntervalDays - 1 -> newDay = 21, dayIndex = 20
	// (0-based) = dia de reunião (21º dia).
	result := Advance(State{Day: selic.CopomMeetingIntervalDays - 1, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), 1)

	if !result.IsCopomDay {
		t.Error("IsCopomDay = false, want true no 21º dia simulado")
	}
}

func TestAdvance_NaoSinalizaCopomForaDoDia(t *testing.T) {
	result := Advance(State{Day: 0, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), 1)

	if result.IsCopomDay {
		t.Error("IsCopomDay = true, want false no 1º dia simulado")
	}
}

func TestAdvance_SinalizaDiaDeRelatorio(t *testing.T) {
	// fundamentals.DefaultReportFrequencyDays = 14 -> Day: 13 -> newDay = 14.
	result := Advance(State{Day: 13, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), 1)

	if !result.IsReportDay {
		t.Error("IsReportDay = false, want true no 14º dia simulado")
	}
}

func TestAdvance_Deterministica(t *testing.T) {
	riskClass := "Sofisticado"
	assets := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 1, Seed: 5}

	a := Advance(State{Day: 20, SelicRate: 11}, assets, nil, nil, nil, nil, cfg, 99)
	b := Advance(State{Day: 20, SelicRate: 11}, assets, nil, nil, nil, nil, cfg, 99)

	if a.State != b.State {
		t.Fatalf("State divergiu: %+v != %+v", a.State, b.State)
	}
	if a.Quotes[0].Price != b.Quotes[0].Price {
		t.Fatalf("preço divergiu: %v != %v", a.Quotes[0].Price, b.Quotes[0].Price)
	}
}

func TestAdvance_ForaDoDiaDeRelatorioNaoGeraFundamentals(t *testing.T) {
	companies := []CompanyForFundamentals{{CompanyID: "c1", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}

	result := Advance(State{Day: 0, SelicRate: 10}, nil, companies, nil, nil, nil, testSelicConfig(), 1)

	if len(result.Fundamentals) != 0 {
		t.Errorf("len(Fundamentals) = %d, want 0 (1º dia simulado não é dia de relatório)", len(result.Fundamentals))
	}
}

func TestAdvance_DiaDeRelatorioGeraFundamentals(t *testing.T) {
	companies := []CompanyForFundamentals{{CompanyID: "c1", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}

	// Day: 13 -> newDay = 14 -> dayIndex = 13 (0-based) = dia de relatório
	// (14º dia, fundamentals.DefaultReportFrequencyDays).
	result := Advance(State{Day: 13, SelicRate: 10}, nil, companies, nil, nil, nil, testSelicConfig(), 1)

	if len(result.Fundamentals) != 1 {
		t.Fatalf("len(Fundamentals) = %d, want 1", len(result.Fundamentals))
	}
	if result.Fundamentals[0].CompanyID != "c1" {
		t.Errorf("CompanyID = %q, want c1", result.Fundamentals[0].CompanyID)
	}
	if result.Fundamentals[0].NetRevenue <= 0 {
		t.Errorf("NetRevenue = %v, want > 0", result.Fundamentals[0].NetRevenue)
	}
}

// TestAdvance_DiaDeRelatorioGeraOsSeisCamposDeFundamentals é o critério de
// aceite central da tarefa 4.8: antes só NetRevenue vinha preenchido, os
// outros 5 campos de FundamentalsRecord ficavam sempre no zero value (nunca
// persistidos). fundamentals.DeriveFinancials é determinística a partir de
// NetRevenue, então o valor exato pode ser conferido contra ela.
func TestAdvance_DiaDeRelatorioGeraOsSeisCamposDeFundamentals(t *testing.T) {
	companies := []CompanyForFundamentals{{CompanyID: "c1", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}

	result := Advance(State{Day: 13, SelicRate: 10}, nil, companies, nil, nil, nil, testSelicConfig(), 1)

	if len(result.Fundamentals) != 1 {
		t.Fatalf("len(Fundamentals) = %d, want 1", len(result.Fundamentals))
	}
	f := result.Fundamentals[0]
	want := fundamentals.DeriveFinancials(f.NetRevenue)

	if f.NetIncome != want.NetIncome {
		t.Errorf("NetIncome = %v, want %v", f.NetIncome, want.NetIncome)
	}
	if f.EBIT != want.EBIT {
		t.Errorf("EBIT = %v, want %v", f.EBIT, want.EBIT)
	}
	if f.NetEquity != want.NetEquity {
		t.Errorf("NetEquity = %v, want %v", f.NetEquity, want.NetEquity)
	}
	if f.GrossDebt != want.GrossDebt {
		t.Errorf("GrossDebt = %v, want %v", f.GrossDebt, want.GrossDebt)
	}
	if f.CashEquivalents != want.CashEquivalents {
		t.Errorf("CashEquivalents = %v, want %v", f.CashEquivalents, want.CashEquivalents)
	}
}

func TestAdvance_EmpresaSemAtivoVinculadoAindaGeraFundamentals(t *testing.T) {
	// Nenhum AssetForPricing aponta pra "sem-ativo" — Sensitivity cai pro
	// zero value de SensitivityByRiskClass, mas o ciclo de relatório não
	// deveria travar por isso.
	companies := []CompanyForFundamentals{{CompanyID: "sem-ativo", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}

	result := Advance(State{Day: 13, SelicRate: 10}, nil, companies, nil, nil, nil, testSelicConfig(), 1)

	if len(result.Fundamentals) != 1 {
		t.Fatalf("len(Fundamentals) = %d, want 1 mesmo sem ativo de renda variável vinculado", len(result.Fundamentals))
	}
}

func TestAdvance_UsaLastRevenueQuandoExiste(t *testing.T) {
	lastRevenue := 5_000_000.0
	companiesWithHistory := []CompanyForFundamentals{{CompanyID: "c1", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, LastRevenue: &lastRevenue}}
	companiesNoHistory := []CompanyForFundamentals{{CompanyID: "c1", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, LastRevenue: nil}}

	withHistory := Advance(State{Day: 13, SelicRate: 10}, nil, companiesWithHistory, nil, nil, nil, testSelicConfig(), 1)
	withoutHistory := Advance(State{Day: 13, SelicRate: 10}, nil, companiesNoHistory, nil, nil, nil, testSelicConfig(), 1)

	if withHistory.Fundamentals[0].NetRevenue == withoutHistory.Fundamentals[0].NetRevenue {
		t.Error("NetRevenue partindo de LastRevenue = 5.000.000 veio igual ao partindo de DefaultBaseRevenue — LastRevenue não foi usado")
	}
}

func TestAdvance_EfeitoDePrecoSoNoDiaDoRelatorio(t *testing.T) {
	riskClass := "Sofisticado"
	companyID := "c1"
	assets := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Day: 13 -> newDay = 14 = dia de relatório da empresa vinculada.
	withReport := Advance(State{Day: 13, SelicRate: 10}, assets, companies, nil, nil, nil, cfg, 1)
	withoutReport := Advance(State{Day: 13, SelicRate: 10}, assets, nil, nil, nil, nil, cfg, 1)

	if withReport.Quotes[0].Price == withoutReport.Quotes[0].Price {
		t.Error("preço no dia de relatório com companies veio igual a sem companies — efeito de surpresa (ReportDayPriceEffect) não foi aplicado")
	}
}

func TestAdvance_SemEfeitoDePrecoForaDoDiaDeRelatorio(t *testing.T) {
	riskClass := "Sofisticado"
	companyID := "c1"
	assets := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Day: 0 -> newDay = 1, fora do ciclo de 14 dias — preço não deveria
	// sofrer efeito de surpresa mesmo com companies presentes.
	withCompanies := Advance(State{Day: 0, SelicRate: 10}, assets, companies, nil, nil, nil, cfg, 1)
	withoutCompanies := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, cfg, 1)

	if withCompanies.Quotes[0].Price != withoutCompanies.Quotes[0].Price {
		t.Errorf("preço fora do dia de relatório divergiu (%v != %v) — efeito só deveria aparecer no dia da divulgação", withCompanies.Quotes[0].Price, withoutCompanies.Quotes[0].Price)
	}
}

func macroPriceEventTest(id string, triggeredOnDay, durationDays int, pricePct float64, targets []MacroEventTargetForApplication) MacroEventForApplication {
	return MacroEventForApplication{
		ID:             id,
		TriggeredOnDay: triggeredOnDay,
		DurationDays:   durationDays,
		AffectsPrice:   true,
		PriceEffectPct: &pricePct,
		Targets:        targets,
	}
}

func TestAdvance_EfeitoDePrecoMacroAtivoDuranteADuracao(t *testing.T) {
	riskClass := "Conservador"
	assetID := "a1"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	event := macroPriceEventTest("event-1", 1, 2, 10, []MacroEventTargetForApplication{{AssetID: &assetID}})

	// Day: 0 -> newDay = 1, dentro da janela [1, 1+2) do evento.
	withEvent := Advance(State{Day: 0, SelicRate: 10}, assets, nil, []MacroEventForApplication{event}, nil, nil, cfg, 1)
	withoutEvent := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, cfg, 1)

	if withEvent.Quotes[0].Price == withoutEvent.Quotes[0].Price {
		t.Error("preço com evento macro ativo veio igual ao preço sem evento — efeito de preço não foi aplicado")
	}

	wantMultiplier := macroevent.DailyPriceEffectMultiplier(10, 2)
	got := withEvent.Quotes[0].Price / withoutEvent.Quotes[0].Price
	if diff := got - wantMultiplier; diff > 1e-9 || diff < -1e-9 {
		t.Errorf("multiplicador aplicado = %v, want %v", got, wantMultiplier)
	}
}

func TestAdvance_EfeitoDePrecoMacroParaAposADuracao(t *testing.T) {
	riskClass := "Conservador"
	assetID := "a1"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	event := macroPriceEventTest("event-1", 1, 2, 10, []MacroEventTargetForApplication{{AssetID: &assetID}})

	// Day: 2 -> newDay = 3 = triggeredOnDay(1) + duration(2), primeiro dia
	// fora da janela — efeito não deveria mais ser aplicado.
	withEvent := Advance(State{Day: 2, SelicRate: 10}, assets, nil, []MacroEventForApplication{event}, nil, nil, cfg, 1)
	withoutEvent := Advance(State{Day: 2, SelicRate: 10}, assets, nil, nil, nil, nil, cfg, 1)

	if withEvent.Quotes[0].Price != withoutEvent.Quotes[0].Price {
		t.Errorf("preço divergiu no dia seguinte ao fim da duração (%v != %v) — efeito deveria ter parado", withEvent.Quotes[0].Price, withoutEvent.Quotes[0].Price)
	}
}

func TestAdvance_EventoDePrecoSoAtingeAlvoCorreto(t *testing.T) {
	riskClass := "Conservador"
	targetID, otherID := "a1", "a2"
	assets := []AssetForPricing{
		{AssetID: targetID, RiskClass: &riskClass, LastPrice: nil},
		{AssetID: otherID, RiskClass: &riskClass, LastPrice: nil},
	}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}
	event := macroPriceEventTest("event-1", 1, 2, 10, []MacroEventTargetForApplication{{AssetID: &targetID}})

	withEvent := Advance(State{Day: 0, SelicRate: 10}, assets, nil, []MacroEventForApplication{event}, nil, nil, cfg, 1)
	withoutEvent := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, cfg, 1)

	quoteByID := func(r Result, id string) float64 {
		for _, q := range r.Quotes {
			if q.AssetID == id {
				return q.Price
			}
		}
		t.Fatalf("cotação de %q não encontrada", id)
		return 0
	}

	if quoteByID(withEvent, targetID) == quoteByID(withoutEvent, targetID) {
		t.Error("ativo alvo não sofreu o efeito de preço macro")
	}
	if quoteByID(withEvent, otherID) != quoteByID(withoutEvent, otherID) {
		t.Error("ativo fora do alvo sofreu o efeito de preço macro — fan-out incorreto")
	}
}

func TestAdvance_EventoDePrecoPorSetorAtingeTodosOsAtivosDoSetor(t *testing.T) {
	riskClass := "Conservador"
	sector := "Mineração"
	otherSector := "Energia"
	inSectorID, outSectorID := "a1", "a2"
	assets := []AssetForPricing{
		{AssetID: inSectorID, RiskClass: &riskClass, LastPrice: nil, Sector: &sector},
		{AssetID: outSectorID, RiskClass: &riskClass, LastPrice: nil, Sector: &otherSector},
	}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}
	event := macroPriceEventTest("event-1", 1, 2, 10, []MacroEventTargetForApplication{{Sector: &sector}})

	withEvent := Advance(State{Day: 0, SelicRate: 10}, assets, nil, []MacroEventForApplication{event}, nil, nil, cfg, 1)
	withoutEvent := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, cfg, 1)

	quoteByID := func(r Result, id string) float64 {
		for _, q := range r.Quotes {
			if q.AssetID == id {
				return q.Price
			}
		}
		t.Fatalf("cotação de %q não encontrada", id)
		return 0
	}

	if quoteByID(withEvent, inSectorID) == quoteByID(withoutEvent, inSectorID) {
		t.Error("ativo do setor alvo não sofreu o efeito de preço macro")
	}
	if quoteByID(withEvent, outSectorID) != quoteByID(withoutEvent, outSectorID) {
		t.Error("ativo de outro setor sofreu o efeito de preço macro — fan-out setorial incorreto")
	}
}

func TestAdvance_EfeitoDeFundamentosMacroNoDiaDoRelatorio(t *testing.T) {
	companyID := "c1"
	riskClass := "Sofisticado"
	assetID := "a1"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	fundamentalsPct := 20.0
	reportDay := 14
	event := MacroEventForApplication{
		ID:                    "event-1",
		AffectsFundamentals:   true,
		FundamentalsEffectPct: &fundamentalsPct,
		FundamentalsReportDay: &reportDay,
		Targets:               []MacroEventTargetForApplication{{AssetID: &assetID}},
	}

	// Day: 13 -> newDay = 14 = dia de relatório da empresa e FundamentalsReportDay do evento.
	withEvent := Advance(State{Day: 13, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, 1)
	withoutEvent := Advance(State{Day: 13, SelicRate: 10}, assets, companies, nil, nil, nil, cfg, 1)

	if withEvent.Fundamentals[0].NetRevenue == withoutEvent.Fundamentals[0].NetRevenue {
		t.Error("NetRevenue com evento macro pendente veio igual a sem evento — ActualGrowthWithMacroEffect não foi aplicado")
	}
}

func TestAdvance_EfeitoDeFundamentosMacroNaoAntecipaOCiclo(t *testing.T) {
	companyID := "c1"
	riskClass := "Sofisticado"
	assetID := "a1"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	fundamentalsPct := 20.0
	// FundamentalsReportDay = 28 (ciclo seguinte) — no dia 14 (dentro do
	// primeiro ciclo) o efeito ainda não deve ser incorporado.
	reportDay := 28
	event := MacroEventForApplication{
		ID:                    "event-1",
		AffectsFundamentals:   true,
		FundamentalsEffectPct: &fundamentalsPct,
		FundamentalsReportDay: &reportDay,
		Targets:               []MacroEventTargetForApplication{{AssetID: &assetID}},
	}

	withEvent := Advance(State{Day: 13, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, 1)
	withoutEvent := Advance(State{Day: 13, SelicRate: 10}, assets, companies, nil, nil, nil, cfg, 1)

	if withEvent.Fundamentals[0].NetRevenue != withoutEvent.Fundamentals[0].NetRevenue {
		t.Error("NetRevenue divergiu no ciclo errado — efeito de fundamentos foi antecipado pro relatório antes do FundamentalsReportDay")
	}
}

func TestAdvance_AppliedMacroEventIDs_EventoSoDePreco(t *testing.T) {
	assetID := "a1"
	riskClass := "Conservador"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}
	event := macroPriceEventTest("event-1", 1, 2, 10, []MacroEventTargetForApplication{{AssetID: &assetID}})

	// Dentro da janela (newDay=2): ainda não aplicado.
	stillActive := Advance(State{Day: 1, SelicRate: 10}, assets, nil, []MacroEventForApplication{event}, nil, nil, cfg, 1)
	if len(stillActive.AppliedMacroEventIDs) != 0 {
		t.Errorf("AppliedMacroEventIDs = %v, want vazio (efeito de preço ainda ativo)", stillActive.AppliedMacroEventIDs)
	}

	// Dia seguinte ao fim da duração (newDay=3): aplicado.
	done := Advance(State{Day: 2, SelicRate: 10}, assets, nil, []MacroEventForApplication{event}, nil, nil, cfg, 1)
	if len(done.AppliedMacroEventIDs) != 1 || done.AppliedMacroEventIDs[0] != "event-1" {
		t.Errorf("AppliedMacroEventIDs = %v, want [event-1]", done.AppliedMacroEventIDs)
	}
}

func TestAdvance_AppliedMacroEventIDs_EventoDeFundamentosSoDepoisDoRelatorio(t *testing.T) {
	companyID := "c1"
	assetID := "a1"
	riskClass := "Sofisticado"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	fundamentalsPct := 20.0
	reportDay := 14
	event := MacroEventForApplication{
		ID:                    "event-1",
		AffectsFundamentals:   true,
		FundamentalsEffectPct: &fundamentalsPct,
		FundamentalsReportDay: &reportDay,
		Targets:               []MacroEventTargetForApplication{{AssetID: &assetID}},
	}

	// Day: 5 -> newDay = 6, antes do relatório — ainda pendente.
	before := Advance(State{Day: 5, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, 1)
	if len(before.AppliedMacroEventIDs) != 0 {
		t.Errorf("AppliedMacroEventIDs = %v, want vazio (antes do dia de relatório)", before.AppliedMacroEventIDs)
	}

	// Day: 13 -> newDay = 14 = FundamentalsReportDay — aplicado.
	atReport := Advance(State{Day: 13, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, 1)
	if len(atReport.AppliedMacroEventIDs) != 1 || atReport.AppliedMacroEventIDs[0] != "event-1" {
		t.Errorf("AppliedMacroEventIDs = %v, want [event-1]", atReport.AppliedMacroEventIDs)
	}
}

// --- tarefa 4.9: geração/pagamento de dividendos ---

func TestAdvance_Dividendos_GeraProventoDeAcaoNoDiaDeRelatorio(t *testing.T) {
	companyID := "c1"
	shares := int64(1000)
	holders := []PositionHolder{{UserID: "u1", Quantity: 10}}
	payer := DividendPayerAsset{AssetID: "a1", Type: "acao", CompanyID: &companyID, OutstandingShares: &shares, Holders: holders}
	companies := []CompanyForFundamentals{{CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Day: 13 -> newDay = 14 = dia de relatório da empresa.
	result := Advance(State{Day: 13, SelicRate: 10}, nil, companies, nil, []DividendPayerAsset{payer}, nil, cfg, 1)

	if len(result.NewDividends) != 1 {
		t.Fatalf("len(NewDividends) = %d, want 1", len(result.NewDividends))
	}
	rec := result.NewDividends[0]
	if rec.AssetID != "a1" {
		t.Errorf("AssetID = %q, want a1", rec.AssetID)
	}
	if rec.ValuePerShare <= 0 {
		t.Errorf("ValuePerShare = %v, want > 0 (net_income sempre positivo com os coeficientes ilustrativos padrão)", rec.ValuePerShare)
	}
	if rec.PaymentDay != 14+dividend.DefaultPaymentLagDays {
		t.Errorf("PaymentDay = %d, want %d", rec.PaymentDay, 14+dividend.DefaultPaymentLagDays)
	}
	if len(rec.Recipients) != 1 || rec.Recipients[0] != holders[0] {
		t.Errorf("Recipients = %v, want snapshot dos Holders = %v", rec.Recipients, holders)
	}
}

func TestAdvance_Dividendos_NaoGeraForaDoDiaDeRelatorioDaEmpresa(t *testing.T) {
	companyID := "c1"
	shares := int64(1000)
	payer := DividendPayerAsset{AssetID: "a1", Type: "acao", CompanyID: &companyID, OutstandingShares: &shares}
	companies := []CompanyForFundamentals{{CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Day: 5 -> newDay = 6, não é dia de relatório (ciclo de 14 dias).
	result := Advance(State{Day: 5, SelicRate: 10}, nil, companies, nil, []DividendPayerAsset{payer}, nil, cfg, 1)

	if len(result.NewDividends) != 0 {
		t.Errorf("len(NewDividends) = %d, want 0 (fora do dia de relatório)", len(result.NewDividends))
	}
}

func TestAdvance_Dividendos_AcaoSemOutstandingSharesNaoGeraProvento(t *testing.T) {
	companyID := "c1"
	payer := DividendPayerAsset{AssetID: "a1", Type: "acao", CompanyID: &companyID, OutstandingShares: nil}
	companies := []CompanyForFundamentals{{CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 13, SelicRate: 10}, nil, companies, nil, []DividendPayerAsset{payer}, nil, cfg, 1)

	if len(result.NewDividends) != 0 {
		t.Errorf("len(NewDividends) = %d, want 0 (sem outstanding_shares)", len(result.NewDividends))
	}
}

func TestAdvance_Dividendos_FIIGeraProventoNoCalendarioGlobalDeRelatorio(t *testing.T) {
	netWorth := 100_000_000.0
	shares := int64(1_000_000)
	holders := []PositionHolder{{UserID: "u1", Quantity: 100}}
	payer := DividendPayerAsset{AssetID: "fii1", Type: "fii", NetWorth: &netWorth, OutstandingShares: &shares, Holders: holders}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Day: 13 -> newDay = 14 = dia de relatório global (fundamentals.
	// DefaultReportFrequencyDays) — FII não depende de nenhuma company.
	result := Advance(State{Day: 13, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, 1)

	if len(result.NewDividends) != 1 {
		t.Fatalf("len(NewDividends) = %d, want 1", len(result.NewDividends))
	}
	wantValue, ok := dividend.FIIValuePerShare(netWorth, shares)
	if !ok {
		t.Fatal("dividend.FIIValuePerShare() ok = false, want true")
	}
	if result.NewDividends[0].ValuePerShare != wantValue {
		t.Errorf("ValuePerShare = %v, want %v", result.NewDividends[0].ValuePerShare, wantValue)
	}
}

func TestAdvance_Dividendos_FIINaoGeraForaDoDiaDeRelatorioGlobal(t *testing.T) {
	netWorth := 100_000_000.0
	shares := int64(1_000_000)
	payer := DividendPayerAsset{AssetID: "fii1", Type: "fii", NetWorth: &netWorth, OutstandingShares: &shares}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 5, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, 1)

	if len(result.NewDividends) != 0 {
		t.Errorf("len(NewDividends) = %d, want 0 (fora do dia de relatório global)", len(result.NewDividends))
	}
}

func TestAdvance_DuePayments_FiltraPorPaymentDayIgualANewDay(t *testing.T) {
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}
	pending := []PendingDividendPayment{
		{ID: "d1", AssetID: "a1", ValuePerShare: 1, PaymentDay: 14},
		{ID: "d2", AssetID: "a2", ValuePerShare: 2, PaymentDay: 15},
	}

	// Day: 13 -> newDay = 14 — só d1 vence.
	result := Advance(State{Day: 13, SelicRate: 10}, nil, nil, nil, nil, pending, cfg, 1)

	if len(result.DuePayments) != 1 || result.DuePayments[0].ID != "d1" {
		t.Errorf("DuePayments = %v, want só [d1] (PaymentDay == newDay)", result.DuePayments)
	}
}

func TestAdvance_SemPagadoresNemPendenciasNaoGeraNemPaga(t *testing.T) {
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 13, SelicRate: 10}, nil, nil, nil, nil, nil, cfg, 1)

	if len(result.NewDividends) != 0 {
		t.Errorf("len(NewDividends) = %d, want 0", len(result.NewDividends))
	}
	if len(result.DuePayments) != 0 {
		t.Errorf("len(DuePayments) = %d, want 0", len(result.DuePayments))
	}
}
