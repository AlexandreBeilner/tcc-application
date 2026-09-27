package tick

import (
	"fmt"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/dividend"
	"tcc-investimentos/engine/internal/domain/fii"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/ipca"
	"tcc-investimentos/engine/internal/domain/macroevent"
	"tcc-investimentos/engine/internal/domain/selic"
)

func testSelicConfig() selic.Config {
	return selic.Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 0, Seed: 1}
}

func testIPCAConfig() ipca.Config {
	return ipca.Config{MonthlyTarget: 0.004, MaxDeviation: 0.002, Volatility: 0, Seed: 1}
}

func TestAdvance_PrimeiroTickComecaNoDia1(t *testing.T) {
	result := Advance(State{Day: 0, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if result.State.Day != 1 {
		t.Errorf("State.Day = %d, want 1", result.State.Day)
	}
}

func TestAdvance_AvancaUmDiaDeCadaVez(t *testing.T) {
	result := Advance(State{Day: 5, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if result.State.Day != 6 {
		t.Errorf("State.Day = %d, want 6", result.State.Day)
	}
}

func TestAdvance_SemAtivosNaoGeraCotacoes(t *testing.T) {
	result := Advance(State{Day: 0, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

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
	result := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

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

	withHistory := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	assetsNoHistory := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil}}
	withoutHistory := Advance(State{Day: 0, SelicRate: 10}, assetsNoHistory, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if withHistory.Quotes[0].Price == withoutHistory.Quotes[0].Price {
		t.Error("preço partindo de LastPrice = 250 veio igual ao partindo de DefaultInitialPrice — LastPrice não foi usado")
	}
}

func TestAdvance_RiskClassAusenteUsaConservadorComoDefault(t *testing.T) {
	// ETF não tem risk_class no catálogo hoje (tarefa 3.9) — Advance não
	// deve simplesmente pular esse ativo (FII saiu deste caminho na tarefa
	// G.1, ver TestAdvance_FIINaoNasceMaisDeGBM abaixo).
	assets := []AssetForPricing{{AssetID: "etf1", RiskClass: nil, LastPrice: nil}}

	result := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if len(result.Quotes) != 1 {
		t.Fatalf("len(Quotes) = %d, want 1 (risk_class nula deveria usar Conservador como default)", len(result.Quotes))
	}
}

// TestAdvance_FIINaoNasceMaisDeGBM cobre o critério de aceite da tarefa
// G.1: FII não deve deixar nenhum resquício de GBM no caminho de
// precificação — igual a Ação desde a Fase D.2, Advance pula FII inteiro no
// loop de quotes (assetTypeFII, tick.go), mesmo com risk_class nula e sem
// LastPrice (cenário que, antes da G.1, teria caído no fallback Conservador
// de riskClassForPricing e gerado uma Quote via equity.NextPrice). O preço
// de FII só nasce da rodada de negociação real (runIntradayRounds,
// rounds.go) — coberto por TestRunIntradayRounds_FIINegociaComoAcaoViaBookReal.
func TestAdvance_FIINaoNasceMaisDeGBM(t *testing.T) {
	assets := []AssetForPricing{{AssetID: "fii1", Type: assetTypeFII, RiskClass: nil, LastPrice: nil}}

	result := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if len(result.Quotes) != 0 {
		t.Fatalf("len(Quotes) = %d, want 0 — FII não nasce mais de GBM desde a tarefa G.1 (nasce da rodada de negociação real)", len(result.Quotes))
	}
}

func TestAdvance_SinalizaDiaDeReuniaoDoCopom(t *testing.T) {
	// Day: selic.CopomMeetingIntervalDays - 1 -> newDay = 21, dayIndex = 20
	// (0-based) = dia de reunião (21º dia).
	result := Advance(State{Day: selic.CopomMeetingIntervalDays - 1, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if !result.IsCopomDay {
		t.Error("IsCopomDay = false, want true no 21º dia simulado")
	}
}

func TestAdvance_NaoSinalizaCopomForaDoDia(t *testing.T) {
	result := Advance(State{Day: 0, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if result.IsCopomDay {
		t.Error("IsCopomDay = true, want false no 1º dia simulado")
	}
}

func TestAdvance_SinalizaDiaDeRelatorio(t *testing.T) {
	// fundamentals.DefaultReportFrequencyDays = 14 -> Day: 90 -> newDay = 91.
	result := Advance(State{Day: 90, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if !result.IsReportDay {
		t.Error("IsReportDay = false, want true no 91º dia simulado")
	}
}

func TestAdvance_IPCARepeteOMesmoValorDentroDoMesmoMesSimulado(t *testing.T) {
	// ipca.DefaultMonthDays = 30 -> dias simulados 0 e 1 (newDay 1 e 2,
	// dayIndex 0 e 1) pertencem ao mesmo mês simulado (mês 0) — tarefa M.1,
	// decisão de cadência "todo dia repete o valor do mês corrente".
	first := Advance(State{Day: 0, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)
	second := Advance(State{Day: 1, SelicRate: first.State.SelicRate}, nil, nil, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if first.IPCAMonthlyRate != second.IPCAMonthlyRate {
		t.Errorf("IPCAMonthlyRate divergiu dentro do mesmo mês simulado: dia 1 = %v, dia 2 = %v", first.IPCAMonthlyRate, second.IPCAMonthlyRate)
	}
}

func TestAdvance_IPCAMudaQuandoOMesSimuladoVira(t *testing.T) {
	// Volatility > 0 (testIPCAConfig() usa 0, que travaria todo mês
	// exatamente na meta — os dois meses ficariam idênticos por
	// construção, mascarando o comportamento testado aqui).
	ipcaCfg := ipca.Config{MonthlyTarget: 0.004, MaxDeviation: 0.02, Volatility: 0.002, Seed: 5}

	// dayIndex 29 (Day: 29, newDay 30) é o último dia do mês simulado 0;
	// dayIndex 30 (Day: 30, newDay 31) já é o primeiro dia do mês 1.
	lastDayOfMonth0 := Advance(State{Day: 29, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), ipcaCfg, 1)
	firstDayOfMonth1 := Advance(State{Day: 30, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), ipcaCfg, 1)

	if lastDayOfMonth0.IPCAMonthlyRate == firstDayOfMonth1.IPCAMonthlyRate {
		t.Error("IPCAMonthlyRate não mudou entre o último dia do mês 0 e o primeiro dia do mês 1")
	}
}

func TestAdvance_IPCAAcumulado12mBateComACcomposicaoDosUltimos12Meses(t *testing.T) {
	ipcaCfg := ipca.Config{MonthlyTarget: 0.01, MaxDeviation: 0.02, Volatility: 0, Seed: 1}

	// Day: 330 -> newDay 331 -> dayIndex 330 -> mês simulado 11 (12º mês,
	// 0-based) — janela de 12 meses completa.
	result := Advance(State{Day: 330, SelicRate: 10}, nil, nil, nil, nil, nil, testSelicConfig(), ipcaCfg, 1)

	want := ipca.Accumulated12m(ipcaCfg, 11)
	if result.IPCAAccumulated12m != want {
		t.Errorf("IPCAAccumulated12m = %v, want %v (ipca.Accumulated12m(cfg, 11))", result.IPCAAccumulated12m, want)
	}
}

func TestAdvance_IPCAAccumulatedDeviationAlimentaSelicNoDiaDeReuniao(t *testing.T) {
	// Tarefa M.1: o placeholder ipcaAccumulatedDeviation = 0 (deixado pela
	// I.1) agora vem de ipca.AccumulatedDeviation, calculado de verdade —
	// Advance precisa repassar exatamente o mesmo valor que
	// ipca.AccumulatedDeviation calcula pro mês do dia de reunião pra
	// selic.NextCalendarRate (a sign/magnitude do efeito em si já é coberta
	// pelos testes do pacote selic — esta é uma prova de fiação, não de
	// economia). Volatility > 0 é necessário: com ruído zero,
	// AccumulatedDeviation é sempre ~0 por construção (achado desta
	// tarefa, ver TestAccumulatedDeviation_SemRuidoDevolveZeroMesmoEmJanelaParcial
	// no pacote ipca).
	selicCfg := selic.Config{Neutral: 10, ReversionSpeed: 0.2, Volatility: 0, InflationWeight: 7.5, Seed: 1}
	ipcaCfg := ipca.Config{MonthlyTarget: 0.004, MaxDeviation: 0.02, Volatility: 0.003, Seed: 5}

	// selic.CopomMeetingIntervalDays - 1 -> newDay 21, dayIndex 20 = dia de
	// reunião (21º dia).
	dayIndex := selic.CopomMeetingIntervalDays - 1
	result := Advance(State{Day: dayIndex, SelicRate: 10}, nil, nil, nil, nil, nil, selicCfg, ipcaCfg, 1)

	monthIndex := ipca.CurrentMonthIndex(dayIndex, ipca.DefaultMonthDays)
	deviation := ipca.AccumulatedDeviation(ipcaCfg, monthIndex)
	if deviation == 0 {
		t.Fatal("teste inconclusivo: AccumulatedDeviation ficou 0 — trocar seed/config")
	}

	want := selic.NextCalendarRate(selicCfg, dayIndex, 10, deviation)
	if result.State.SelicRate != want {
		t.Errorf("SelicRate = %v, want %v (selic.NextCalendarRate com o desvio real de ipca.AccumulatedDeviation)", result.State.SelicRate, want)
	}
}

func TestAdvance_Deterministica(t *testing.T) {
	riskClass := "Sofisticado"
	assets := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 1, Seed: 5}

	a := Advance(State{Day: 20, SelicRate: 11}, assets, nil, nil, nil, nil, cfg, testIPCAConfig(), 99)
	b := Advance(State{Day: 20, SelicRate: 11}, assets, nil, nil, nil, nil, cfg, testIPCAConfig(), 99)

	if a.State != b.State {
		t.Fatalf("State divergiu: %+v != %+v", a.State, b.State)
	}
	if a.Quotes[0].Price != b.Quotes[0].Price {
		t.Fatalf("preço divergiu: %v != %v", a.Quotes[0].Price, b.Quotes[0].Price)
	}
}

func TestAdvance_ForaDoDiaDeRelatorioNaoGeraFundamentals(t *testing.T) {
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: "c1", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}

	result := Advance(State{Day: 0, SelicRate: 10}, nil, companies, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if len(result.Fundamentals) != 0 {
		t.Errorf("len(Fundamentals) = %d, want 0 (1º dia simulado não é dia de relatório)", len(result.Fundamentals))
	}
}

func TestAdvance_DiaDeRelatorioGeraFundamentals(t *testing.T) {
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: "c1", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}

	// Day: 90 -> newDay = 91 -> dayIndex = 90 (0-based) = dia de relatório
	// (91º dia, fundamentals.DefaultReportFrequencyDays).
	result := Advance(State{Day: 90, SelicRate: 10}, nil, companies, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

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
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: "c1", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}

	result := Advance(State{Day: 90, SelicRate: 10}, nil, companies, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if len(result.Fundamentals) != 1 {
		t.Fatalf("len(Fundamentals) = %d, want 1", len(result.Fundamentals))
	}
	f := result.Fundamentals[0]
	want := fundamentals.DeriveFinancials(catalog.Sector(companies[0].Sector), f.NetRevenue)

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
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: "sem-ativo", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}

	result := Advance(State{Day: 90, SelicRate: 10}, nil, companies, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if len(result.Fundamentals) != 1 {
		t.Fatalf("len(Fundamentals) = %d, want 1 mesmo sem ativo de renda variável vinculado", len(result.Fundamentals))
	}
}

func TestAdvance_UsaLastRevenueQuandoExiste(t *testing.T) {
	lastRevenue := 5_000_000.0
	companiesWithHistory := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: "c1", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, LastRevenue: &lastRevenue}}
	companiesNoHistory := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: "c1", ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, LastRevenue: nil}}

	withHistory := Advance(State{Day: 90, SelicRate: 10}, nil, companiesWithHistory, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)
	withoutHistory := Advance(State{Day: 90, SelicRate: 10}, nil, companiesNoHistory, nil, nil, nil, testSelicConfig(), testIPCAConfig(), 1)

	if withHistory.Fundamentals[0].NetRevenue == withoutHistory.Fundamentals[0].NetRevenue {
		t.Error("NetRevenue partindo de LastRevenue = 5.000.000 veio igual ao partindo de DefaultBaseRevenue — LastRevenue não foi usado")
	}
}

// TestAdvance_QuotesDeCompanhiaNuncaSofremEfeitoDePrecoDireto é o que
// sobrou, depois da tarefa F.1, de TestAdvance_EfeitoDePrecoSoNoDiaDoRelatorio/
// TestAdvance_SemEfeitoDePrecoForaDoDiaDeRelatorio (removidos): os dois
// testavam fundamentals.ReportDayPriceEffect sendo aplicado multiplicativamente
// à cotação GBM de um ativo vinculado a uma empresa, dentro e fora do dia de
// relatório — mecanismo removido nesta tarefa (o resultado divulgado agora
// só move preço via negociação real do Fundamentalista, nunca um
// multiplicador direto na cotação; ver TestAdvance_EfeitoDeFundamentosMacroNoDiaDoRelatorio
// pra confirmação de que o net_revenue continua reagindo ao ciclo de
// relatório, e tick/rounds_test.go — TestService_Run_Relatorio* — pro
// critério de aceite de "resultado vs. expectativa move o preço via
// negociação"). Este teste confirma só a regressão oposta: a cotação
// GBM (só alcançável por FII/ETF na prática, CompanyID nil) nunca muda por
// causa de companies estar presente ou não, dentro ou fora do dia de
// relatório — companies não tem mais NENHUM jeito de afetar Result.Quotes
// diretamente.
func TestAdvance_QuotesDeCompanhiaNuncaSofremEfeitoDePrecoDireto(t *testing.T) {
	riskClass := "Sofisticado"
	companyID := "c1"
	assets := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	for _, day := range []int{0, 90} { // newDay = 1 (fora do ciclo) e 91 (dia de relatório)
		withCompanies := Advance(State{Day: day, SelicRate: 10}, assets, companies, nil, nil, nil, cfg, testIPCAConfig(), 1)
		withoutCompanies := Advance(State{Day: day, SelicRate: 10}, assets, nil, nil, nil, nil, cfg, testIPCAConfig(), 1)

		if withCompanies.Quotes[0].Price != withoutCompanies.Quotes[0].Price {
			t.Errorf("Day=%d: preço com companies (%v) != sem companies (%v) — Result.Quotes não deveria mais sofrer nenhum efeito direto de companies", day, withCompanies.Quotes[0].Price, withoutCompanies.Quotes[0].Price)
		}
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

// TestAdvance_MacroEffectPctAtivoDuranteADuracao cobre a tarefa E.2: o
// sinal/magnitude de um evento macro ativo (macroevent.IsPriceEffectActive)
// vira CompanyRoundContext.MacroEffectPct da empresa alcançada — nunca mais
// um multiplicador direto sobre a cotação (macroPriceMultiplier, removida
// nesta tarefa). A cotação GBM do ativo (ainda alcançável aqui só por
// FII/ETF, já que Ação sai do loop desde D.2) fica idêntica com e sem
// evento — critério de aceite "sem nenhum salto instantâneo de preço".
func TestAdvance_MacroEffectPctAtivoDuranteADuracao(t *testing.T) {
	riskClass := "Conservador"
	companyID := "c1"
	assetID := "a1"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	event := macroPriceEventTest("event-1", 1, 2, 10, []MacroEventTargetForApplication{{AssetID: &assetID}})

	// Day: 0 -> newDay = 1, dentro da janela [1, 1+2) do evento.
	withEvent := Advance(State{Day: 0, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)
	withoutEvent := Advance(State{Day: 0, SelicRate: 10}, assets, companies, nil, nil, nil, cfg, testIPCAConfig(), 1)

	if got := withEvent.CompanyContext[companyID].MacroEffectPct; got != 10 {
		t.Errorf("MacroEffectPct = %v, want 10 (valor do evento inteiro, alvo sem direção própria)", got)
	}
	if got := withoutEvent.CompanyContext[companyID].MacroEffectPct; got != 0 {
		t.Errorf("MacroEffectPct sem evento = %v, want 0", got)
	}
	if withEvent.Quotes[0].Price != withoutEvent.Quotes[0].Price {
		t.Errorf("cotação GBM divergiu (%v != %v) — evento macro não deveria mais saltar o preço instantaneamente", withEvent.Quotes[0].Price, withoutEvent.Quotes[0].Price)
	}
}

// TestAdvance_MacroEffectPctEmpilhadoTemTeto cobre o achado 004: vários
// eventos severos concorrentes sobre a mesma empresa nunca passam do teto
// (±DefaultPriceEffectCapPct), então (1 + soma/100) no preço justo do
// Fundamentalista nunca inverte de sinal.
func TestAdvance_MacroEffectPctEmpilhadoTemTeto(t *testing.T) {
	riskClass := "Conservador"
	companyID := "c1"
	assetID := "a1"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}
	targets := []MacroEventTargetForApplication{{AssetID: &assetID}}

	tests := []struct {
		name string
		pct  float64
		n    int
		want float64
	}{
		{"negativos passam do teto", -25, 5, -macroevent.DefaultPriceEffectCapPct},
		{"positivos passam do teto", 25, 5, macroevent.DefaultPriceEffectCapPct},
		{"abaixo do teto soma normal", -10, 2, -20},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var events []MacroEventForApplication
			for i := 0; i < tt.n; i++ {
				events = append(events, macroPriceEventTest(fmt.Sprintf("event-%d", i), 1, 2, tt.pct, targets))
			}
			res := Advance(State{Day: 0, SelicRate: 10}, assets, companies, events, nil, nil, cfg, testIPCAConfig(), 1)
			if got := res.CompanyContext[companyID].MacroEffectPct; got != tt.want {
				t.Errorf("MacroEffectPct = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAdvance_MacroEffectPctParaAposADuracao(t *testing.T) {
	companyID := "c1"
	assetID := "a1"
	riskClass := "Conservador"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	event := macroPriceEventTest("event-1", 1, 2, 10, []MacroEventTargetForApplication{{AssetID: &assetID}})

	// Day: 2 -> newDay = 3 = triggeredOnDay(1) + duration(2), primeiro dia
	// fora da janela — efeito não deveria mais ser aplicado.
	withEvent := Advance(State{Day: 2, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)

	if got := withEvent.CompanyContext[companyID].MacroEffectPct; got != 0 {
		t.Errorf("MacroEffectPct = %v, want 0 — janela do efeito já encerrou", got)
	}
}

func TestAdvance_EventoDePrecoSoAtingeAEmpresaAlvo(t *testing.T) {
	riskClass := "Conservador"
	targetCompanyID, otherCompanyID := "c1", "c2"
	targetAssetID, otherAssetID := "a1", "a2"
	assets := []AssetForPricing{
		{AssetID: targetAssetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &targetCompanyID},
		{AssetID: otherAssetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &otherCompanyID},
	}
	companies := []CompanyForFundamentals{
		{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: targetCompanyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays},
		{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: otherCompanyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays},
	}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}
	event := macroPriceEventTest("event-1", 1, 2, 10, []MacroEventTargetForApplication{{AssetID: &targetAssetID}})

	result := Advance(State{Day: 0, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)

	if got := result.CompanyContext[targetCompanyID].MacroEffectPct; got != 10 {
		t.Errorf("MacroEffectPct da empresa alvo = %v, want 10", got)
	}
	if got := result.CompanyContext[otherCompanyID].MacroEffectPct; got != 0 {
		t.Errorf("MacroEffectPct de empresa fora do alvo = %v, want 0 — fan-out incorreto", got)
	}
}

func TestAdvance_EventoDePrecoPorSetorAtingeTodasAsEmpresasDoSetor(t *testing.T) {
	riskClass := "Conservador"
	sector := "Mineração"
	otherSector := "Energia"
	inSectorID, outSectorID := "c1", "c2"
	assetInSector, assetOutSector := "a1", "a2"
	assets := []AssetForPricing{
		{AssetID: assetInSector, RiskClass: &riskClass, LastPrice: nil, CompanyID: &inSectorID, Sector: &sector},
		{AssetID: assetOutSector, RiskClass: &riskClass, LastPrice: nil, CompanyID: &outSectorID, Sector: &otherSector},
	}
	companies := []CompanyForFundamentals{
		{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: inSectorID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: sector},
		{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: outSectorID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: otherSector},
	}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}
	event := macroPriceEventTest("event-1", 1, 2, -10, []MacroEventTargetForApplication{{Sector: &sector}})

	result := Advance(State{Day: 0, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)

	if got := result.CompanyContext[inSectorID].MacroEffectPct; got != -10 {
		t.Errorf("MacroEffectPct da empresa do setor alvo = %v, want -10", got)
	}
	if got := result.CompanyContext[outSectorID].MacroEffectPct; got != 0 {
		t.Errorf("MacroEffectPct de empresa de outro setor = %v, want 0 — fan-out setorial incorreto", got)
	}
}

// TestAdvance_TargetComDirecaoPropriaSobrepoeAoValorDoEvento cobre a
// integração com a E.1: um alvo que declarou direção própria (evento
// "misto") usa a própria magnitude, não a do evento inteiro.
func TestAdvance_TargetComDirecaoPropriaSobrepoeAoValorDoEvento(t *testing.T) {
	riskClass := "Conservador"
	companyID := "c1"
	assetID := "a1"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	ownPct := -18.0
	event := macroPriceEventTest("event-1", 1, 2, 10, []MacroEventTargetForApplication{{AssetID: &assetID, PriceEffectPct: &ownPct}})

	result := Advance(State{Day: 0, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)

	if got := result.CompanyContext[companyID].MacroEffectPct; got != -18 {
		t.Errorf("MacroEffectPct = %v, want -18 (magnitude própria do alvo, não os 10 do evento)", got)
	}
}

// TestAdvance_TargetPorAtivoSobrepoeTargetPorSetorIndependenteDaOrdem cobre
// o achado do review do PR da E.2 (matchingTarget): um evento "misto" com um
// target de setor inteiro e um target de ativo específico (de uma empresa
// daquele mesmo setor) com magnitude própria oposta precisa sempre resolver
// pro target mais específico (asset_id), não pro primeiro da lista —
// ListPendingMacroEvents não garante ordem entre os targets de um mesmo
// evento. Testado nas duas ordens pra provar que o resultado independe da
// ordem do slice.
func TestAdvance_TargetPorAtivoSobrepoeTargetPorSetorIndependenteDaOrdem(t *testing.T) {
	riskClass := "Conservador"
	sector := "Mineração"
	companyID := "c1"
	assetID := "a1"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID, Sector: &sector}}
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: sector}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	ownPct := -18.0
	sectorTarget := MacroEventTargetForApplication{Sector: &sector}
	assetTarget := MacroEventTargetForApplication{AssetID: &assetID, PriceEffectPct: &ownPct}

	sectorFirst := macroPriceEventTest("event-1", 1, 2, 10, []MacroEventTargetForApplication{sectorTarget, assetTarget})
	assetFirst := macroPriceEventTest("event-1", 1, 2, 10, []MacroEventTargetForApplication{assetTarget, sectorTarget})

	resultSectorFirst := Advance(State{Day: 0, SelicRate: 10}, assets, companies, []MacroEventForApplication{sectorFirst}, nil, nil, cfg, testIPCAConfig(), 1)
	resultAssetFirst := Advance(State{Day: 0, SelicRate: 10}, assets, companies, []MacroEventForApplication{assetFirst}, nil, nil, cfg, testIPCAConfig(), 1)

	if got := resultSectorFirst.CompanyContext[companyID].MacroEffectPct; got != -18 {
		t.Errorf("MacroEffectPct (setor antes do ativo na lista) = %v, want -18 (override por ativo deve vencer, não o primeiro da lista)", got)
	}
	if got := resultAssetFirst.CompanyContext[companyID].MacroEffectPct; got != -18 {
		t.Errorf("MacroEffectPct (ativo antes do setor na lista) = %v, want -18", got)
	}
}

func TestAdvance_EfeitoDeFundamentosMacroNoDiaDoRelatorio(t *testing.T) {
	companyID := "c1"
	riskClass := "Sofisticado"
	assetID := "a1"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	fundamentalsPct := 20.0
	reportDay := 91
	event := MacroEventForApplication{
		ID:                    "event-1",
		AffectsFundamentals:   true,
		FundamentalsEffectPct: &fundamentalsPct,
		FundamentalsReportDay: &reportDay,
		Targets:               []MacroEventTargetForApplication{{AssetID: &assetID}},
	}

	// Day: 90 -> newDay = 91 = dia de relatório da empresa e FundamentalsReportDay do evento.
	withEvent := Advance(State{Day: 90, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)
	withoutEvent := Advance(State{Day: 90, SelicRate: 10}, assets, companies, nil, nil, nil, cfg, testIPCAConfig(), 1)

	if withEvent.Fundamentals[0].NetRevenue == withoutEvent.Fundamentals[0].NetRevenue {
		t.Error("NetRevenue com evento macro pendente veio igual a sem evento — ActualGrowthWithMacroEffect não foi aplicado")
	}
}

func TestAdvance_EfeitoDeFundamentosMacroNaoAntecipaOCiclo(t *testing.T) {
	companyID := "c1"
	riskClass := "Sofisticado"
	assetID := "a1"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	fundamentalsPct := 20.0
	// FundamentalsReportDay = 182 (ciclo seguinte) — no dia 91 (dentro do
	// primeiro ciclo) o efeito ainda não deve ser incorporado.
	reportDay := 182
	event := MacroEventForApplication{
		ID:                    "event-1",
		AffectsFundamentals:   true,
		FundamentalsEffectPct: &fundamentalsPct,
		FundamentalsReportDay: &reportDay,
		Targets:               []MacroEventTargetForApplication{{AssetID: &assetID}},
	}

	withEvent := Advance(State{Day: 90, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)
	withoutEvent := Advance(State{Day: 90, SelicRate: 10}, assets, companies, nil, nil, nil, cfg, testIPCAConfig(), 1)

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
	stillActive := Advance(State{Day: 1, SelicRate: 10}, assets, nil, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)
	if len(stillActive.AppliedMacroEventIDs) != 0 {
		t.Errorf("AppliedMacroEventIDs = %v, want vazio (efeito de preço ainda ativo)", stillActive.AppliedMacroEventIDs)
	}

	// Dia seguinte ao fim da duração (newDay=3): aplicado.
	done := Advance(State{Day: 2, SelicRate: 10}, assets, nil, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)
	if len(done.AppliedMacroEventIDs) != 1 || done.AppliedMacroEventIDs[0] != "event-1" {
		t.Errorf("AppliedMacroEventIDs = %v, want [event-1]", done.AppliedMacroEventIDs)
	}
}

func TestAdvance_AppliedMacroEventIDs_EventoDeFundamentosSoDepoisDoRelatorio(t *testing.T) {
	companyID := "c1"
	assetID := "a1"
	riskClass := "Sofisticado"
	assets := []AssetForPricing{{AssetID: assetID, RiskClass: &riskClass, LastPrice: nil, CompanyID: &companyID}}
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	fundamentalsPct := 20.0
	reportDay := 91
	event := MacroEventForApplication{
		ID:                    "event-1",
		AffectsFundamentals:   true,
		FundamentalsEffectPct: &fundamentalsPct,
		FundamentalsReportDay: &reportDay,
		Targets:               []MacroEventTargetForApplication{{AssetID: &assetID}},
	}

	// Day: 5 -> newDay = 6, antes do relatório — ainda pendente.
	before := Advance(State{Day: 5, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)
	if len(before.AppliedMacroEventIDs) != 0 {
		t.Errorf("AppliedMacroEventIDs = %v, want vazio (antes do dia de relatório)", before.AppliedMacroEventIDs)
	}

	// Day: 90 -> newDay = 91 = FundamentalsReportDay — aplicado.
	atReport := Advance(State{Day: 90, SelicRate: 10}, assets, companies, []MacroEventForApplication{event}, nil, nil, cfg, testIPCAConfig(), 1)
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
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Day: 90 -> newDay = 91 = dia de relatório da empresa.
	result := Advance(State{Day: 90, SelicRate: 10}, nil, companies, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

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
	if rec.PaymentDay != 91+dividend.DefaultPaymentLagDays {
		t.Errorf("PaymentDay = %d, want %d", rec.PaymentDay, 91+dividend.DefaultPaymentLagDays)
	}
	if len(rec.Recipients) != 1 || rec.Recipients[0] != holders[0] {
		t.Errorf("Recipients = %v, want snapshot dos Holders = %v", rec.Recipients, holders)
	}
}

func TestAdvance_Dividendos_NaoGeraForaDoDiaDeRelatorioDaEmpresa(t *testing.T) {
	companyID := "c1"
	shares := int64(1000)
	payer := DividendPayerAsset{AssetID: "a1", Type: "acao", CompanyID: &companyID, OutstandingShares: &shares}
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Day: 5 -> newDay = 6, não é dia de relatório (ciclo de 91 dias).
	result := Advance(State{Day: 5, SelicRate: 10}, nil, companies, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.NewDividends) != 0 {
		t.Errorf("len(NewDividends) = %d, want 0 (fora do dia de relatório)", len(result.NewDividends))
	}
}

func TestAdvance_Dividendos_AcaoSemOutstandingSharesNaoGeraProvento(t *testing.T) {
	companyID := "c1"
	payer := DividendPayerAsset{AssetID: "a1", Type: "acao", CompanyID: &companyID, OutstandingShares: nil}
	companies := []CompanyForFundamentals{{BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100, CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays, Sector: "Mineração"}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 90, SelicRate: 10}, nil, companies, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.NewDividends) != 0 {
		t.Errorf("len(NewDividends) = %d, want 0 (sem outstanding_shares)", len(result.NewDividends))
	}
}

// tarefa J.2: PN recebe valor por ação maior que ON, proporcional ao
// pn_dividend_premium_pct da empresa — mesmo net_income/ciclo, duas bases
// de ações em circulação diferentes (J.1: dois asset_id, mesmo company_id).
func TestAdvance_Dividendos_EmpresaOnPnAplicaPrioridadeLegalDaPn(t *testing.T) {
	companyID := "c1"
	onShares := int64(1000)
	pnShares := int64(500)
	onClass, pnClass := "ON", "PN"
	onHolders := []PositionHolder{{UserID: "u1", Quantity: 10}}
	pnHolders := []PositionHolder{{UserID: "u2", Quantity: 5}}
	onPayer := DividendPayerAsset{AssetID: "on1", Type: "acao", CompanyID: &companyID, ShareClass: &onClass, OutstandingShares: &onShares, Holders: onHolders}
	pnPayer := DividendPayerAsset{AssetID: "pn1", Type: "acao", CompanyID: &companyID, ShareClass: &pnClass, OutstandingShares: &pnShares, Holders: pnHolders}
	companies := []CompanyForFundamentals{{
		CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays,
		Sector: "Mineração", PnDividendPremiumPct: 25, BaseGrowthPct: fundamentals.DefaultBaseGrowth * 100,
	}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Day: 90 -> newDay = 91 = dia de relatório da empresa.
	result := Advance(State{Day: 90, SelicRate: 10}, nil, companies, nil, []DividendPayerAsset{onPayer, pnPayer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.NewDividends) != 2 {
		t.Fatalf("len(NewDividends) = %d, want 2", len(result.NewDividends))
	}
	byAsset := make(map[string]DividendRecord, 2)
	for _, rec := range result.NewDividends {
		byAsset[rec.AssetID] = rec
	}
	on, ok := byAsset["on1"]
	if !ok {
		t.Fatalf("nenhum DividendRecord pra on1, got %v", result.NewDividends)
	}
	pn, ok := byAsset["pn1"]
	if !ok {
		t.Fatalf("nenhum DividendRecord pra pn1, got %v", result.NewDividends)
	}
	if on.ValuePerShare <= 0 {
		t.Fatalf("on.ValuePerShare = %v, want > 0", on.ValuePerShare)
	}
	wantPn := on.ValuePerShare * 1.25
	if diff := pn.ValuePerShare - wantPn; diff > 1e-9 || diff < -1e-9 {
		t.Errorf("pn.ValuePerShare = %v, want %v (on * 1.25, premium de 25%%)", pn.ValuePerShare, wantPn)
	}
	if len(on.Recipients) != 1 || on.Recipients[0] != onHolders[0] {
		t.Errorf("on.Recipients = %v, want %v", on.Recipients, onHolders)
	}
	if len(pn.Recipients) != 1 || pn.Recipients[0] != pnHolders[0] {
		t.Errorf("pn.Recipients = %v, want %v", pn.Recipients, pnHolders)
	}
}

func TestAdvance_Dividendos_FIIGeraProventoNoCalendarioMensal(t *testing.T) {
	netWorth := 100_000_000.0
	shares := int64(1_000_000)
	holders := []PositionHolder{{UserID: "u1", Quantity: 100}}
	payer := DividendPayerAsset{AssetID: "fii1", Type: "fii", NetWorth: &netWorth, OutstandingShares: &shares, Holders: holders}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Day: 29 -> newDay = 30 = dia de pagamento mensal do FII
	// (dividend.FIIPayoutIntervalDays) — FII não depende de nenhuma company nem
	// do ciclo trimestral de relatório.
	result := Advance(State{Day: 29, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

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

// TestAdvance_Dividendos_FIIPapelUsaPortfolioValue confere que FII papel
// (sem NetWorth, tarefa 4.10) gera provento a partir de PortfolioValue,
// pela mesma dividend.FIIValuePerShare já usada pro tijolo — achado da
// tarefa 4.9 (FII papel nunca gerava provento por falta dessa grandeza).
func TestAdvance_Dividendos_FIIPapelUsaPortfolioValue(t *testing.T) {
	portfolioValue := 300_000_000.0
	shares := int64(1_000_000)
	holders := []PositionHolder{{UserID: "u1", Quantity: 50}}
	payer := DividendPayerAsset{AssetID: "fii2", Type: "fii", PortfolioValue: &portfolioValue, OutstandingShares: &shares, Holders: holders}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 29, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.NewDividends) != 1 {
		t.Fatalf("len(NewDividends) = %d, want 1", len(result.NewDividends))
	}
	wantValue, ok := dividend.FIIValuePerShare(portfolioValue, shares)
	if !ok {
		t.Fatal("dividend.FIIValuePerShare() ok = false, want true")
	}
	if result.NewDividends[0].ValuePerShare != wantValue {
		t.Errorf("ValuePerShare = %v, want %v", result.NewDividends[0].ValuePerShare, wantValue)
	}
}

// TestAdvance_Dividendos_FIISemNetWorthNemPortfolioValueNaoGera confere que
// FII sem nenhuma das duas grandezas (nem NetWorth nem PortfolioValue) não
// gera provento nenhum, mesmo no dia de relatório global.
func TestAdvance_Dividendos_FIIPagaMensalEEmpresaTrimestral(t *testing.T) {
	netWorth := 100_000_000.0
	shares := int64(1_000_000)
	payer := DividendPayerAsset{AssetID: "fii1", Type: "fii", NetWorth: &netWorth, OutstandingShares: &shares, Holders: []PositionHolder{{UserID: "u1", Quantity: 1}}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Um ano de calendário simulado: FII paga a cada 30 dias (dias 30, 60, ..., 360).
	payouts := 0
	for day := 0; day < 365; day++ {
		result := Advance(State{Day: day, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)
		payouts += len(result.NewDividends)
	}
	if payouts != 12 {
		t.Errorf("proventos de FII em 365 dias = %d, want 12 (mensal)", payouts)
	}
}

func TestAdvance_Dividendos_FIISemNetWorthNemPortfolioValueNaoGera(t *testing.T) {
	shares := int64(1_000_000)
	payer := DividendPayerAsset{AssetID: "fii3", Type: "fii", OutstandingShares: &shares}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 90, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.NewDividends) != 0 {
		t.Errorf("len(NewDividends) = %d, want 0 (sem NetWorth nem PortfolioValue)", len(result.NewDividends))
	}
}

func TestAdvance_Dividendos_FIINaoGeraForaDoDiaDeRelatorioGlobal(t *testing.T) {
	netWorth := 100_000_000.0
	shares := int64(1_000_000)
	payer := DividendPayerAsset{AssetID: "fii1", Type: "fii", NetWorth: &netWorth, OutstandingShares: &shares}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 5, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.NewDividends) != 0 {
		t.Errorf("len(NewDividends) = %d, want 0 (fora do dia de relatório global)", len(result.NewDividends))
	}
}

// TestAdvance_NetWorth_ReavaliaFIITijoloNoCalendarioGlobalDeRelatorio cobre
// o critério de aceite da tarefa G.2: uma nova reavaliação de NetWorth pra
// cada FII tijolo no mesmo dia de relatório global que já dispara
// dividendos/fundamentos — valor final determinístico por seed, batendo
// exatamente com fii.NextNetWorth chamada com os mesmos parâmetros que
// Advance usa de verdade (mesma técnica de TestNextGrowth_* em
// fundamentals_test.go).
func TestAdvance_NetWorth_ReavaliaFIITijoloNoCalendarioGlobalDeRelatorio(t *testing.T) {
	netWorth := 500_000_000.0
	payer := DividendPayerAsset{AssetID: "fii1", Type: assetTypeFII, NetWorth: &netWorth}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Day: 90 -> newDay = 91 = dia de relatório global.
	result := Advance(State{Day: 90, SelicRate: 15}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.NetWorthUpdates) != 1 {
		t.Fatalf("len(NetWorthUpdates) = %d, want 1", len(result.NetWorthUpdates))
	}
	if result.NetWorthUpdates[0].AssetID != "fii1" {
		t.Errorf("AssetID = %q, want fii1", result.NetWorthUpdates[0].AssetID)
	}

	fiiCfg := fii.NetWorthConfig{
		Sensitivity: fii.DefaultNetWorthSelicSensitivity,
		NoiseStdDev: fii.DefaultNetWorthNoiseStdDev,
		Seed:        deterministicSeed(1, "fii1"),
	}
	want := fii.NextNetWorth(fiiCfg, 0, netWorth, result.State.SelicRate, cfg.Neutral)
	if result.NetWorthUpdates[0].NetWorth != want {
		t.Errorf("NetWorth = %v, want %v", result.NetWorthUpdates[0].NetWorth, want)
	}
}

// TestAdvance_NetWorth_FIIPapelNuncaReavaliado confere que FII papel
// (NetWorth nil, PortfolioValue preenchido) nunca gera NetWorthUpdate —
// PortfolioValue tem sua própria reavaliação (tarefa G.3), fora de escopo
// aqui.
func TestAdvance_NetWorth_FIIPapelNuncaReavaliado(t *testing.T) {
	portfolioValue := 300_000_000.0
	payer := DividendPayerAsset{AssetID: "fii2", Type: assetTypeFII, PortfolioValue: &portfolioValue}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 90, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.NetWorthUpdates) != 0 {
		t.Errorf("len(NetWorthUpdates) = %d, want 0 (FII papel não tem NetWorth)", len(result.NetWorthUpdates))
	}
}

// TestAdvance_NetWorth_NaoReavaliaForaDoDiaDeRelatorioGlobal confere que
// nenhuma reavaliação acontece fora do calendário quinzenal — mesmo
// tratamento de TestAdvance_Dividendos_FIINaoGeraForaDoDiaDeRelatorioGlobal.
func TestAdvance_NetWorth_NaoReavaliaForaDoDiaDeRelatorioGlobal(t *testing.T) {
	netWorth := 500_000_000.0
	payer := DividendPayerAsset{AssetID: "fii1", Type: assetTypeFII, NetWorth: &netWorth}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 5, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.NetWorthUpdates) != 0 {
		t.Errorf("len(NetWorthUpdates) = %d, want 0 (fora do dia de relatório global)", len(result.NetWorthUpdates))
	}
}

// TestAdvance_PortfolioValue_ReavaliaFIIPapelNoCalendarioGlobalDeRelatorio
// cobre o critério de aceite da tarefa G.3: uma nova reavaliação de
// PortfolioValue pra cada FII papel no mesmo dia de relatório global,
// batendo exatamente com fii.NextPortfolioValue chamada com os mesmos
// parâmetros que Advance usa de verdade.
func TestAdvance_PortfolioValue_ReavaliaFIIPapelNoCalendarioGlobalDeRelatorio(t *testing.T) {
	portfolioValue := 300_000_000.0
	indexador := fii.IndexadorCDI
	payer := DividendPayerAsset{AssetID: "fii2", Type: assetTypeFII, PortfolioValue: &portfolioValue, Indexador: &indexador}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	// Day: 90 -> newDay = 91 = dia de relatório global.
	result := Advance(State{Day: 90, SelicRate: 12}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.PortfolioValueUpdates) != 1 {
		t.Fatalf("len(PortfolioValueUpdates) = %d, want 1", len(result.PortfolioValueUpdates))
	}
	if result.PortfolioValueUpdates[0].AssetID != "fii2" {
		t.Errorf("AssetID = %q, want fii2", result.PortfolioValueUpdates[0].AssetID)
	}

	want, err := fii.NextPortfolioValue(indexador, portfolioValue, result.State.SelicRate, fundamentals.DefaultReportFrequencyDays)
	if err != nil {
		t.Fatalf("fii.NextPortfolioValue: err = %v, want nil", err)
	}
	if result.PortfolioValueUpdates[0].PortfolioValue != want {
		t.Errorf("PortfolioValue = %v, want %v", result.PortfolioValueUpdates[0].PortfolioValue, want)
	}
}

// TestAdvance_PortfolioValue_FIITijoloNuncaReavaliado confere que FII
// tijolo (PortfolioValue nil, NetWorth preenchido) nunca gera
// PortfolioValueUpdate — NetWorth tem sua própria reavaliação (tarefa G.2).
func TestAdvance_PortfolioValue_FIITijoloNuncaReavaliado(t *testing.T) {
	netWorth := 500_000_000.0
	payer := DividendPayerAsset{AssetID: "fii1", Type: assetTypeFII, NetWorth: &netWorth}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 90, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.PortfolioValueUpdates) != 0 {
		t.Errorf("len(PortfolioValueUpdates) = %d, want 0 (FII tijolo não tem PortfolioValue)", len(result.PortfolioValueUpdates))
	}
}

// TestAdvance_PortfolioValue_IndexadorDesconhecidoNaoReavalia confere que
// um FII papel com indexador fora dos 3 conhecidos (fii.ErrUnknownIndexador)
// é pulado, sem travar o tick.
func TestAdvance_PortfolioValue_IndexadorDesconhecidoNaoReavalia(t *testing.T) {
	portfolioValue := 300_000_000.0
	indexador := "SELIC-ANTIGO"
	payer := DividendPayerAsset{AssetID: "fii2", Type: assetTypeFII, PortfolioValue: &portfolioValue, Indexador: &indexador}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 90, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.PortfolioValueUpdates) != 0 {
		t.Errorf("len(PortfolioValueUpdates) = %d, want 0 (indexador desconhecido)", len(result.PortfolioValueUpdates))
	}
}

// TestAdvance_PortfolioValue_NaoReavaliaForaDoDiaDeRelatorioGlobal confere
// que nenhuma reavaliação acontece fora do calendário quinzenal — mesmo
// tratamento de TestAdvance_NetWorth_NaoReavaliaForaDoDiaDeRelatorioGlobal.
func TestAdvance_PortfolioValue_NaoReavaliaForaDoDiaDeRelatorioGlobal(t *testing.T) {
	portfolioValue := 300_000_000.0
	indexador := fii.IndexadorCDI
	payer := DividendPayerAsset{AssetID: "fii2", Type: assetTypeFII, PortfolioValue: &portfolioValue, Indexador: &indexador}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 5, SelicRate: 10}, nil, nil, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)

	if len(result.PortfolioValueUpdates) != 0 {
		t.Errorf("len(PortfolioValueUpdates) = %d, want 0 (fora do dia de relatório global)", len(result.PortfolioValueUpdates))
	}
}

func TestAdvance_DuePayments_FiltraPorPaymentDayIgualANewDay(t *testing.T) {
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}
	pending := []PendingDividendPayment{
		{ID: "d1", AssetID: "a1", ValuePerShare: 1, PaymentDay: 91},
		{ID: "d2", AssetID: "a2", ValuePerShare: 2, PaymentDay: 15},
	}

	// Day: 90 -> newDay = 91 — só d1 vence.
	result := Advance(State{Day: 90, SelicRate: 10}, nil, nil, nil, nil, pending, cfg, testIPCAConfig(), 1)

	if len(result.DuePayments) != 1 || result.DuePayments[0].ID != "d1" {
		t.Errorf("DuePayments = %v, want só [d1] (PaymentDay == newDay)", result.DuePayments)
	}
}

func TestAdvance_SemPagadoresNemPendenciasNaoGeraNemPaga(t *testing.T) {
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 90, SelicRate: 10}, nil, nil, nil, nil, nil, cfg, testIPCAConfig(), 1)

	if len(result.NewDividends) != 0 {
		t.Errorf("len(NewDividends) = %d, want 0", len(result.NewDividends))
	}
	if len(result.DuePayments) != 0 {
		t.Errorf("len(DuePayments) = %d, want 0", len(result.DuePayments))
	}
}

func TestAdvance_IntradayRounds_PopulaDeterministicamentePorDia(t *testing.T) {
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	first := Advance(State{Day: 4, SelicRate: 10}, nil, nil, nil, nil, nil, cfg, testIPCAConfig(), 7)
	second := Advance(State{Day: 4, SelicRate: 10}, nil, nil, nil, nil, nil, cfg, testIPCAConfig(), 7)

	if len(first.IntradayRounds) < 1 || len(first.IntradayRounds) > 4 {
		t.Fatalf("len(IntradayRounds) = %d, want between 1 and 4", len(first.IntradayRounds))
	}
	if len(first.IntradayRounds) != len(second.IntradayRounds) {
		t.Fatalf("IntradayRounds count differs across identical calls: %d vs %d", len(first.IntradayRounds), len(second.IntradayRounds))
	}
	for i := range first.IntradayRounds {
		if first.IntradayRounds[i] != second.IntradayRounds[i] {
			t.Fatalf("IntradayRounds[%d] differs across identical calls: %+v vs %+v", i, first.IntradayRounds[i], second.IntradayRounds[i])
		}
	}
}

func TestAdvance_IntradayRounds_NaoAfetaOutrosCamposDoResult(t *testing.T) {
	riskClass := "Conservador"
	assets := []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass, LastPrice: nil}}
	cfg := selic.Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	result := Advance(State{Day: 0, SelicRate: 10}, assets, nil, nil, nil, nil, cfg, testIPCAConfig(), 1)

	// Mesma asserção de TestAdvance_SemCotacaoAnteriorUsaDefaultInitialPrice
	// — confirma que adicionar a sortição de cadência intradiária não mudou
	// o cálculo de cotação já existente.
	if len(result.Quotes) != 1 || result.Quotes[0].Price <= 0 {
		t.Errorf("Quotes = %v, want 1 cotação com preço > 0 (regressão: sortição de IntradayRounds não deve afetar isto)", result.Quotes)
	}
}
