package marketcalendar

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeGlobal struct {
	day       int
	macros    []MacroEventFact
	selic     map[int]float64
	dividends []DividendFact
}

func (f fakeGlobal) CurrentDay(context.Context) (int, error) { return f.day, nil }
func (f fakeGlobal) MacroEventsBetween(context.Context, int, int) ([]MacroEventFact, error) {
	return f.macros, nil
}
func (f fakeGlobal) SelicByDay(context.Context, int, int) (map[int]float64, error) {
	return f.selic, nil
}
func (f fakeGlobal) DividendsBetween(context.Context, int, int) ([]DividendFact, error) {
	return f.dividends, nil
}

type fakeUser struct {
	facts      []UserFact
	called     string
	holdings   []Holding
	recipients []RecipientFact
}

func (f *fakeUser) HoldingsOf(context.Context, string) ([]Holding, error) { return f.holdings, nil }
func (f *fakeUser) DividendRecipientsBetween(context.Context, string, int, int) ([]RecipientFact, error) {
	return f.recipients, nil
}

func (f *fakeUser) UserFactsBetween(_ context.Context, userID string, _, _ int) ([]UserFact, error) {
	f.called = userID
	return f.facts, nil
}

func kinds(d DayEntry) []Kind {
	out := make([]Kind, 0, len(d.Events))
	for _, e := range d.Events {
		out = append(out, e.Kind)
	}
	return out
}

func TestClockAt(t *testing.T) {
	tests := []struct {
		name          string
		day           int
		open          bool
		untilOpen     int
		quarterDay    int
		weekday       time.Weekday
		wantQuarterOf int
	}{
		{"dia 0 (sem tick), segunda", 0, true, 0, 1, time.Monday, 91},
		{"sexta", 4, true, 0, 4, time.Friday, 91},
		{"sábado", 5, false, 2, 5, time.Saturday, 91},
		{"domingo", 6, false, 1, 6, time.Sunday, 91},
		{"segunda seguinte", 7, true, 0, 7, time.Monday, 91},
		{"dia de relatório é o 91", 91, true, 0, 91, time.Monday, 91},
		{"começa o segundo trimestre", 92, true, 0, 1, time.Tuesday, 91},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := ClockAt(tt.day)
			if c.MarketOpen != tt.open || c.DaysUntilOpen != tt.untilOpen || c.QuarterDay != tt.quarterDay ||
				c.Weekday != tt.weekday || c.QuarterLength != tt.wantQuarterOf {
				t.Errorf("ClockAt(%d) = %+v", tt.day, c)
			}
		})
	}
}

func TestCalendar_JanelaInvalida(t *testing.T) {
	svc := NewService(fakeGlobal{day: 10}, nil)
	for _, w := range [][2]int{{5, 4}, {0, MaxWindowDays}} {
		if _, err := svc.Calendar(context.Background(), "", w[0], w[1]); !errors.Is(err, ErrInvalidWindow) {
			t.Errorf("janela %v: err = %v", w, err)
		}
	}
}

func TestCalendar_CopomERelatorioDeterministicos(t *testing.T) {
	// Dia 45 é reunião do Copom (segundas-feiras... 45 = quarta, dia útil); 91 é relatório.
	svc := NewService(fakeGlobal{day: 50, selic: map[int]float64{44: 10.5, 45: 10.75}}, nil)
	days, err := svc.Calendar(context.Background(), "", 44, 92)
	if err != nil {
		t.Fatal(err)
	}
	byDay := map[int]DayEntry{}
	for _, d := range days {
		byDay[d.Day] = d
	}

	copom := byDay[45]
	if got := kinds(copom); len(got) != 1 || got[0] != KindCopom {
		t.Fatalf("dia 45 = %v", got)
	}
	e := copom.Events[0]
	if e.Future || e.SelicRate == nil || *e.SelicRate != 10.75 || e.PreviousSelicRate == nil || *e.PreviousSelicRate != 10.5 {
		t.Errorf("Copom passado deve trazer Selic anterior e resultante: %+v", e)
	}

	// O dia 91 é relatório e também a reunião do Copom empurrada do dia 90
	// (domingo) pra segunda; kinds vem ordenado por nome.
	report := byDay[91]
	if got := kinds(report); len(got) != 2 || got[0] != KindCopom || got[1] != KindReport || !report.Events[1].Future {
		t.Errorf("dia 91 (futuro) = %+v", report.Events)
	}
	if len(byDay[90].Events) != 0 {
		t.Errorf("dia 90 (domingo) não tem reunião: %+v", byDay[90].Events)
	}
	if len(byDay[46].Events) != 0 {
		t.Errorf("dia comum não deve ter fato: %+v", byDay[46].Events)
	}
}

func TestCalendar_CopomFuturoSemResultado(t *testing.T) {
	svc := NewService(fakeGlobal{day: 10, selic: map[int]float64{}}, nil)
	days, err := svc.Calendar(context.Background(), "", 44, 46)
	if err != nil {
		t.Fatal(err)
	}
	e := days[1].Events[0]
	if e.Kind != KindCopom || !e.Future || e.SelicRate != nil {
		t.Errorf("Copom futuro não pode antecipar o resultado: %+v", e)
	}
}

func TestCalendar_EventoMacroFuturoNuncaAparece(t *testing.T) {
	svc := NewService(fakeGlobal{day: 10, macros: []MacroEventFact{
		{Day: 9, Title: "Passado", Direction: "positivo"},
		{Day: 10, Title: "Hoje", Direction: "negativo"},
		{Day: 12, Title: "Futuro", Direction: "misto"},
	}}, nil)
	days, err := svc.Calendar(context.Background(), "", 8, 14)
	if err != nil {
		t.Fatal(err)
	}
	titles := []string{}
	for _, d := range days {
		for _, e := range d.Events {
			if e.Kind == KindMacroEvent {
				titles = append(titles, e.Title)
			}
		}
	}
	if len(titles) != 2 || titles[0] != "Passado" || titles[1] != "Hoje" {
		t.Errorf("títulos = %v", titles)
	}
}

func TestCalendar_ProventosAnunciados(t *testing.T) {
	svc := NewService(fakeGlobal{day: 10, dividends: []DividendFact{{Ticker: "BNDD3", ValuePerShare: 0.5, ExDay: 8, PaymentDay: 13}}}, nil)
	days, err := svc.Calendar(context.Background(), "", 8, 14)
	if err != nil {
		t.Fatal(err)
	}
	if got := kinds(days[0]); len(got) != 1 || got[0] != KindDividendExDate || days[0].Events[0].Future {
		t.Errorf("data-ex = %+v", days[0].Events)
	}
	pay := days[5].Events
	if len(pay) != 1 || pay[0].Kind != KindDividendPayDate || !pay[0].Future || pay[0].Ticker != "BNDD3" {
		t.Errorf("pagamento = %+v", pay)
	}
}

func TestCalendar_FatosDoUsuario(t *testing.T) {
	qty, price := 10.0, 25.5
	user := &fakeUser{facts: []UserFact{
		{Day: 9, EventType: "buy_order_executed", Ticker: "BNDD3", Quantity: &qty, UnitValue: &price},
		{Day: 9, EventType: "sell_order_executed", Ticker: "BNDD3", Quantity: &qty, UnitValue: &price},
		{Day: 9, EventType: "initial_deposit"},
		{Day: 9, EventType: "etf_creation", Ticker: "ETFX"},
		{Day: 10, EventType: "dividend_payment", Ticker: "BNDD3", Quantity: &qty, UnitValue: &price},
		{Day: 11, Ticker: "LTN2027", Maturity: true},
	}}
	svc := NewService(fakeGlobal{day: 10}, user)

	days, err := svc.Calendar(context.Background(), "u-1", 9, 11)
	if err != nil {
		t.Fatal(err)
	}
	if user.called != "u-1" {
		t.Errorf("fatos lidos pro usuário %q", user.called)
	}
	if len(days[0].Events) != 2 || days[0].Events[0].Side != "buy" || days[0].Events[1].Side != "sell" {
		t.Errorf("dia 9 = %+v (depósito e movimento de ETF ficam de fora)", days[0].Events)
	}
	if e := days[1].Events[0]; e.Kind != KindDividendReceived || e.Scope != "user" {
		t.Errorf("dia 10 = %+v", e)
	}
	if e := days[2].Events[0]; e.Kind != KindFixedIncomeMaturity || !e.Future {
		t.Errorf("dia 11 = %+v", e)
	}
}

func TestCalendar_SalarioPagoVemDoFatoReal(t *testing.T) {
	value := 1000.0
	user := &fakeUser{facts: []UserFact{{Day: 9, EventType: "salary_payment", UnitValue: &value, ReferenceMonth: "2026-01"}}}
	svc := NewService(fakeGlobal{day: 10}, user)

	days, err := svc.Calendar(context.Background(), "u-1", 9, 9)
	if err != nil {
		t.Fatal(err)
	}
	if got := kinds(days[0]); len(got) != 1 || got[0] != KindSalaryPayment {
		t.Fatalf("dia 9 = %+v", days[0].Events)
	}
	e := days[0].Events[0]
	if e.Future || e.UnitValue == nil || *e.UnitValue != value || e.Scope != scopeUser {
		t.Errorf("salário pago deve trazer o valor e não ser futuro: %+v", e)
	}
	if e.ReferenceMonth != "2026-01" {
		t.Errorf("ReferenceMonth = %q, want \"2026-01\"", e.ReferenceMonth)
	}
}

// TestCalendar_CatchUpDeVariosMesesTrazReferenceMonthDistinto cobre o achado
// 025: quando o job de folha de pagamento (T.5) recupera vários meses
// atrasados de uma vez, todos os eventos caem no mesmo simulated_day (o dia
// em que o job rodou) — sem reference_month eles seriam indistinguíveis no
// calendário. Aqui simula 3 meses (junho, julho, agosto) creditados juntos no
// dia 217, e confere que cada Event carrega o mês certo.
func TestCalendar_CatchUpDeVariosMesesTrazReferenceMonthDistinto(t *testing.T) {
	value := 100.0
	user := &fakeUser{facts: []UserFact{
		{Day: 217, EventType: "salary_payment", UnitValue: &value, ReferenceMonth: "2026-06"},
		{Day: 217, EventType: "salary_payment", UnitValue: &value, ReferenceMonth: "2026-07"},
		{Day: 217, EventType: "salary_payment", UnitValue: &value, ReferenceMonth: "2026-08"},
	}}
	svc := NewService(fakeGlobal{day: 217}, user)

	days, err := svc.Calendar(context.Background(), "u-1", 217, 217)
	if err != nil {
		t.Fatal(err)
	}
	events := days[0].Events
	if len(events) != 3 {
		t.Fatalf("events = %+v, want 3 salários", events)
	}
	got := map[string]bool{}
	for _, e := range events {
		if e.Kind != KindSalaryPayment {
			t.Errorf("evento inesperado no catch-up: %+v", e)
		}
		got[e.ReferenceMonth] = true
	}
	for _, month := range []string{"2026-06", "2026-07", "2026-08"} {
		if !got[month] {
			t.Errorf("catch-up não trouxe ReferenceMonth = %q: events = %+v", month, events)
		}
	}
}

func TestCalendar_SalarioFuturoAnunciaDiaSemValor(t *testing.T) {
	// dia 32 (6/fev/2026) é o 5º dia útil de fevereiro; today = dia 15 (20/jan/2026), no passado do salário.
	svc := NewService(fakeGlobal{day: 15}, &fakeUser{})

	days, err := svc.Calendar(context.Background(), "u-1", 30, 34)
	if err != nil {
		t.Fatal(err)
	}
	byDay := map[int]DayEntry{}
	for _, d := range days {
		byDay[d.Day] = d
	}
	e := byDay[32].Events
	if len(e) != 1 || e[0].Kind != KindSalaryPayment || !e[0].Future || e[0].UnitValue != nil || e[0].Scope != scopeUser {
		t.Fatalf("dia 32 (5º dia útil futuro) = %+v", e)
	}
	if e[0].ReferenceMonth != "2026-02" {
		t.Errorf("ReferenceMonth = %q, want \"2026-02\" (mês do dia 32)", e[0].ReferenceMonth)
	}
	if len(byDay[31].Events) != 0 || len(byDay[33].Events) != 0 {
		t.Errorf("dias vizinhos não são o 5º dia útil: %+v / %+v", byDay[31].Events, byDay[33].Events)
	}
}

func TestCalendar_SalarioFuturoNaoAparecemSemUsuario(t *testing.T) {
	svc := NewService(fakeGlobal{day: 15}, nil)
	days, err := svc.Calendar(context.Background(), "", 30, 34)
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range days {
		if len(d.Events) != 0 {
			t.Fatalf("sem userID não deve anunciar salário futuro: dia %d = %+v", d.Day, d.Events)
		}
	}
}

func TestCalendar_SemUsuarioNaoLeFatosPessoais(t *testing.T) {
	user := &fakeUser{facts: []UserFact{{Day: 9, EventType: "buy_order_executed", Ticker: "X"}}}
	svc := NewService(fakeGlobal{day: 10}, user)
	days, err := svc.Calendar(context.Background(), "", 9, 10)
	if err != nil {
		t.Fatal(err)
	}
	if user.called != "" || len(days[0].Events) != 0 {
		t.Errorf("sem userID não pode ler fato pessoal: called=%q events=%+v", user.called, days[0].Events)
	}
}

func TestCalendar_DiasDaJanelaSaoCompletos(t *testing.T) {
	svc := NewService(fakeGlobal{day: 10}, nil)
	days, err := svc.Calendar(context.Background(), "", 3, 9)
	if err != nil {
		t.Fatal(err)
	}
	if len(days) != 7 {
		t.Fatalf("len = %d", len(days))
	}
	// dia 3 = quinta, 5 = sábado
	if !days[0].MarketOpen || days[2].MarketOpen || days[3].MarketOpen || !days[4].MarketOpen {
		t.Errorf("mercado aberto por dia: %v %v %v %v %v", days[0].MarketOpen, days[1].MarketOpen, days[2].MarketOpen, days[3].MarketOpen, days[4].MarketOpen)
	}
}

func calendarWith(t *testing.T, svc *Service, user string, from, to int, opts Options) Result {
	t.Helper()
	result, err := svc.CalendarWith(context.Background(), user, from, to, opts)
	if err != nil {
		t.Fatal(err)
	}
	return result
}

func eventOf(d DayEntry, kind Kind) (Event, bool) {
	for _, e := range d.Events {
		if e.Kind == kind {
			return e, true
		}
	}
	return Event{}, false
}

func TestCalendar_RelevanciaDeProventoPorPosicao(t *testing.T) {
	qty := 120.0
	global := fakeGlobal{day: 10, dividends: []DividendFact{
		{Ticker: "TJLO11", ValuePerShare: 0.5, ExDay: 12, PaymentDay: 14},
		{Ticker: "BNDD3", ValuePerShare: 0.3, ExDay: 12, PaymentDay: 14},
	}}
	user := &fakeUser{holdings: []Holding{{Ticker: "TJLO11", Class: "fii", Quantity: qty}}}
	result := calendarWith(t, NewService(global, user), "u-1", 12, 14, Options{MarketLimit: -1})

	var mine, market []Event
	for _, e := range result.Days[0].Events {
		if e.Relevance == RelevanceMine {
			mine = append(mine, e)
		} else {
			market = append(market, e)
		}
	}
	if len(mine) != 1 || mine[0].Ticker != "TJLO11" || mine[0].RelevanceReason != ReasonPosition {
		t.Fatalf("mine = %+v", mine)
	}
	if mine[0].UserQuantity == nil || *mine[0].UserQuantity != 120 || mine[0].EstimatedAmount == nil || *mine[0].EstimatedAmount != 60 || !mine[0].AmountIsEstimate {
		t.Errorf("antes da data-ex o valor é estimado (0,50 x 120): %+v", mine[0])
	}
	if len(market) != 1 || market[0].Ticker != "BNDD3" || market[0].EstimatedAmount != nil || market[0].UserQuantity != nil {
		t.Errorf("provento de ativo que o usuário não tem é market, sem valor nem quantidade: %+v", market)
	}
}

func TestCalendar_ProventoComSnapshotEExato(t *testing.T) {
	global := fakeGlobal{day: 10, dividends: []DividendFact{{Ticker: "TJLO11", ValuePerShare: 0.5, ExDay: 8, PaymentDay: 12}}}
	// O usuário vendeu depois da data-ex: não tem posição agora, mas o snapshot garante o direito.
	user := &fakeUser{recipients: []RecipientFact{{Ticker: "TJLO11", ExDay: 8, PaymentDay: 12, Quantity: 40}}}
	result := calendarWith(t, NewService(global, user), "u-1", 12, 12, Options{MarketLimit: -1})

	e, ok := eventOf(result.Days[0], KindDividendPayDate)
	if !ok || e.Relevance != RelevanceMine || e.AmountIsEstimate || e.EstimatedAmount == nil || *e.EstimatedAmount != 20 {
		t.Fatalf("pagamento com snapshot = %+v", e)
	}
}

func TestCalendar_CompradoDepoisDaDataExNaoTemDireito(t *testing.T) {
	global := fakeGlobal{day: 10, dividends: []DividendFact{{Ticker: "TJLO11", ValuePerShare: 0.5, ExDay: 8, PaymentDay: 12}}}
	user := &fakeUser{holdings: []Holding{{Ticker: "TJLO11", Class: "fii", Quantity: 10}}}
	result := calendarWith(t, NewService(global, user), "u-1", 12, 12, Options{MarketLimit: -1})

	e, _ := eventOf(result.Days[0], KindDividendPayDate)
	if e.Relevance != RelevanceMarket || e.EstimatedAmount != nil {
		t.Errorf("sem snapshot e depois da data-ex o provento não é do usuário: %+v", e)
	}
}

func TestCalendar_RelatorioEMineSoComAcao(t *testing.T) {
	svc := func(h []Holding) *Service { return NewService(fakeGlobal{day: 50}, &fakeUser{holdings: h}) }
	withStock := calendarWith(t, svc([]Holding{{Ticker: "VALR3", Class: "acao", Quantity: 5}}), "u-1", 91, 91, Options{MarketLimit: -1})
	if e, _ := eventOf(withStock.Days[0], KindReport); e.Relevance != RelevanceMine {
		t.Errorf("com ação o relatório é mine: %+v", e)
	}
	onlyFund := calendarWith(t, svc([]Holding{{Ticker: "TJLO11", Class: "fii", Quantity: 5}}), "u-1", 91, 91, Options{MarketLimit: -1})
	if e, _ := eventOf(onlyFund.Days[0], KindReport); e.Relevance != RelevanceMarket {
		t.Errorf("só com FII o relatório é market: %+v", e)
	}
	copom, _ := eventOf(withStock.Days[0], KindCopom)
	if copom.Relevance != RelevanceMarket {
		t.Errorf("Copom é informação macro (market): %+v", copom)
	}
}

func TestCalendar_FatosPropriosSaoMineComMotivo(t *testing.T) {
	qty := 3.0
	user := &fakeUser{facts: []UserFact{
		{Day: 9, EventType: "buy_order_executed", Ticker: "X", Quantity: &qty},
		{Day: 9, EventType: "salary_payment"},
		{Day: 9, Ticker: "LTN2027", Maturity: true},
	}}
	result := calendarWith(t, NewService(fakeGlobal{day: 10}, user), "u-1", 9, 9, Options{MarketLimit: -1})
	reasons := map[Kind]string{}
	for _, e := range result.Days[0].Events {
		if e.Relevance != RelevanceMine {
			t.Errorf("fato próprio deve ser mine: %+v", e)
		}
		reasons[e.Kind] = e.RelevanceReason
	}
	if reasons[KindOrderExecuted] != ReasonOwnFact || reasons[KindSalaryPayment] != ReasonSalary || reasons[KindFixedIncomeMaturity] != ReasonFixedIncomePosition {
		t.Errorf("motivos = %v", reasons)
	}
}

func TestCalendar_SalarioFuturoEMine(t *testing.T) {
	result := calendarWith(t, NewService(fakeGlobal{day: 15}, &fakeUser{}), "u-1", 32, 32, Options{MarketLimit: -1})
	if e, _ := eventOf(result.Days[0], KindSalaryPayment); e.Relevance != RelevanceMine || e.RelevanceReason != ReasonSalary {
		t.Errorf("salário futuro = %+v", e)
	}
}

func TestCalendar_EscopoMineEResumoPorDia(t *testing.T) {
	global := fakeGlobal{day: 10, dividends: []DividendFact{
		{Ticker: "TJLO11", ValuePerShare: 1, ExDay: 12, PaymentDay: 14},
		{Ticker: "BNDD3", ValuePerShare: 1, ExDay: 12, PaymentDay: 14},
	}}
	user := &fakeUser{holdings: []Holding{{Ticker: "TJLO11", Class: "fii", Quantity: 1}}}
	svc := NewService(global, user)

	all := calendarWith(t, svc, "u-1", 12, 12, Options{MarketLimit: -1})
	if all.Days[0].Summary != (DaySummary{Mine: 1, Market: 1}) || all.MarketTotal != 1 || all.MarketShown != 1 {
		t.Errorf("all = %+v %+v", all.Days[0].Summary, all)
	}
	mine := calendarWith(t, svc, "u-1", 12, 12, Options{MineOnly: true, MarketLimit: -1})
	if len(mine.Days[0].Events) != 1 || mine.Days[0].Events[0].Relevance != RelevanceMine {
		t.Errorf("mine só devolve os do usuário: %+v", mine.Days[0].Events)
	}
	if mine.Days[0].Summary.Market != 1 || mine.MarketTotal != 1 || mine.MarketShown != 0 {
		t.Errorf("o resumo conta o mercado mesmo sem devolvê-lo: %+v", mine)
	}
}

func TestCalendar_LimiteDeMercadoMantemOsMaisProximosDeHoje(t *testing.T) {
	var dividends []DividendFact
	for i := 0; i < 6; i++ {
		dividends = append(dividends, DividendFact{Ticker: "T" + string(rune('A'+i)), ValuePerShare: 1, ExDay: 20 + i, PaymentDay: 1000})
	}
	svc := NewService(fakeGlobal{day: 22, dividends: dividends}, &fakeUser{})
	result := calendarWith(t, svc, "u-1", 18, 30, Options{MarketLimit: 3})

	if result.MarketTotal != 6 || result.MarketShown != 3 {
		t.Fatalf("total/shown = %d/%d", result.MarketTotal, result.MarketShown)
	}
	var days []int
	for _, d := range result.Days {
		if len(d.Events) > 0 {
			days = append(days, d.Day)
		}
	}
	// Hoje é o dia 22: ficam 22, 21 e 23 (distância 0, 1 e 1, o mais cedo primeiro), nunca os extremos.
	if len(days) != 3 || days[0] != 21 || days[1] != 22 || days[2] != 23 {
		t.Errorf("dias mantidos = %v", days)
	}
	none := calendarWith(t, svc, "u-1", 18, 30, Options{MarketLimit: 0})
	if none.MarketShown != 0 || none.MarketTotal != 6 {
		t.Errorf("limite 0 = %+v", none)
	}
}

func TestCalendar_SemUsuarioTudoEMarket(t *testing.T) {
	global := fakeGlobal{day: 10, dividends: []DividendFact{{Ticker: "TJLO11", ValuePerShare: 1, ExDay: 12, PaymentDay: 14}}}
	result := calendarWith(t, NewService(global, &fakeUser{holdings: []Holding{{Ticker: "TJLO11", Quantity: 9}}}), "", 12, 12, Options{MarketLimit: -1})
	e := result.Days[0].Events[0]
	if e.Relevance != RelevanceMarket || e.UserQuantity != nil {
		t.Errorf("sem userID nada é do usuário: %+v", e)
	}
}
