package marketcalendar

import (
	"context"
	"errors"
	"sort"
	"time"

	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/selic"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// MaxWindowDays é o teto da janela de GET /market/calendar (um trimestre e um
// dia de folga): a paginação do calendário é por janela de datas, não por página.
const MaxWindowDays = fundamentals.DefaultReportFrequencyDays + 1

// ErrInvalidWindow: janela vazia, invertida ou maior que MaxWindowDays.
var ErrInvalidWindow = errors.New("janela de calendário inválida")

// Kind classifica um fato do calendário.
type Kind string

const (
	// Fatos globais, iguais pra todos os usuários.
	KindMacroEvent      Kind = "macro_event"
	KindCopom           Kind = "copom"
	KindReport          Kind = "report"
	KindDividendExDate  Kind = "dividend_ex_date"
	KindDividendPayDate Kind = "dividend_payment_date"
	// Fatos do usuário autenticado, nunca de terceiros.
	KindOrderExecuted       Kind = "order_executed"
	KindDividendReceived    Kind = "dividend_received"
	KindFixedIncomePurchase Kind = "fixed_income_purchase"
	KindFixedIncomeRedeem   Kind = "fixed_income_redemption"
	KindFixedIncomeMaturity Kind = "fixed_income_maturity"
	KindSalaryPayment       Kind = "salary_payment"
)

const (
	scopeGlobal = "global"
	scopeUser   = "user"

	// Relevância pro usuário (RC.6.1): "mine" é o que o afeta de forma direta,
	// "market" é informação do mercado. Calculada aqui, no servidor, pra o
	// cliente nunca precisar cruzar posição com a lista de proventos de todos.
	RelevanceMine   = "mine"
	RelevanceMarket = "market"

	ReasonPosition            = "position"
	ReasonFixedIncomePosition = "fixed_income_position"
	ReasonOwnFact             = "own_fact"
	ReasonSalary              = "salary"

	orderSideBuy  = "buy"
	orderSideSell = "sell"

	// Nomes do enum market_event_type que viram fato do usuário.
	eventBuyOrderExecuted      = "buy_order_executed"
	eventSellOrderExecuted     = "sell_order_executed"
	eventDividendPayment       = "dividend_payment"
	eventFixedIncomePurchase   = "fixed_income_purchase"
	eventFixedIncomeRedemption = "fixed_income_redemption"
	eventSalaryPayment         = "salary_payment"
)

// Event é um fato de um dia. Só os campos do tipo dele vêm preenchidos.
type Event struct {
	Kind Kind
	// Scope é "global" ou "user"; o frontend usa pra separar "o mercado" de "meus eventos".
	Scope string
	// Future é verdadeiro pra fato que ainda vai acontecer (só os determinísticos).
	Future bool

	Title     string // evento macro
	Direction string // evento macro: positivo, negativo ou misto
	Ticker    string // provento, ordem, renda fixa
	Side      string // ordem: buy ou sell
	Quantity  *float64
	UnitValue *float64 // preço da ordem, valor por cota do provento, valor por título

	// ReferenceMonth ('YYYY-MM', achado 025) só existe em KindSalaryPayment —
	// o mês-calendário real a que o salário se refere, que pode divergir do
	// dia deste Event quando o pagamento foi um catch-up de meses atrasados
	// (T.5): sem ele, vários salários de meses diferentes creditados no mesmo
	// dia (mesmo simulated_day) ficam indistinguíveis pro usuário.
	ReferenceMonth string

	SelicRate         *float64 // Copom já realizado: a Selic resultante
	PreviousSelicRate *float64 // Copom já realizado: a Selic anterior

	// Relevance é "mine" ou "market" (RC.6.1); RelevanceReason diz por quê, só em "mine".
	Relevance       string
	RelevanceReason string
	// EstimatedAmount é o valor do usuário no fato (provento a receber), sempre dele,
	// nunca de terceiro (RNF09). AmountIsEstimate é verdadeiro quando depende da posição
	// que ele ainda pode mudar; falso quando vem do snapshot de quem tem direito.
	EstimatedAmount  *float64
	AmountIsEstimate bool
	// UserQuantity é a quantidade do próprio usuário no ativo do fato.
	UserQuantity *float64
}

// DaySummary conta os fatos do dia por relevância, antes do corte por market_limit,
// pra grade e a faixa de dias pintarem o dia sem baixar tudo.
type DaySummary struct {
	Mine   int
	Market int
}

// DayEntry é um dia da janela com os fatos dele.
type DayEntry struct {
	Day        int
	Date       time.Time
	Weekday    time.Weekday
	MarketOpen bool
	Events     []Event
	Summary    DaySummary
}

// MacroEventFact é um evento macro já disparado.
type MacroEventFact struct {
	Day       int
	Title     string
	Direction string
}

// DividendFact é um provento já anunciado (data-ex e pagamento).
type DividendFact struct {
	Ticker        string
	ValuePerShare float64
	ExDay         int
	PaymentDay    int
}

// UserFact é um fato do usuário no dia simulado: um evento de market_events
// (EventType no vocabulário do enum) ou um vencimento de renda fixa que ele carrega.
type UserFact struct {
	Day       int
	EventType string // vazio no vencimento
	Ticker    string
	Quantity  *float64
	UnitValue *float64
	Maturity  bool
	// ReferenceMonth (achado 025) só vem preenchido no fato salary_payment —
	// ver Event.ReferenceMonth.
	ReferenceMonth string
}

// GlobalFacts lê o que é igual pra todos.
type GlobalFacts interface {
	CurrentDay(ctx context.Context) (int, error)
	MacroEventsBetween(ctx context.Context, fromDay, toDay int) ([]MacroEventFact, error)
	// SelicByDay devolve a Selic gravada por dia simulado em [fromDay, toDay].
	SelicByDay(ctx context.Context, fromDay, toDay int) (map[int]float64, error)
	// DividendsBetween devolve os proventos com data-ex ou pagamento na janela.
	DividendsBetween(ctx context.Context, fromDay, toDay int) ([]DividendFact, error)
}

// Holding é uma posição de renda variável do próprio usuário (quantidade > 0).
type Holding struct {
	Ticker   string
	Class    string // acao, fii ou etf
	Quantity float64
}

// RecipientFact é o direito de um usuário a um provento: a quantidade que ele
// tinha quando o snapshot foi tirado (dividend_event_recipients).
type RecipientFact struct {
	Ticker     string
	ExDay      int
	PaymentDay int
	Quantity   float64
}

// UserFacts lê o que é do usuário.
type UserFacts interface {
	UserFactsBetween(ctx context.Context, userID string, fromDay, toDay int) ([]UserFact, error)
	// HoldingsOf devolve as posições de renda variável abertas do usuário.
	HoldingsOf(ctx context.Context, userID string) ([]Holding, error)
	// DividendRecipientsBetween devolve os proventos com data-ex ou pagamento na
	// janela aos quais o usuário tem direito.
	DividendRecipientsBetween(ctx context.Context, userID string, fromDay, toDay int) ([]RecipientFact, error)
}

// Options controla o recorte da resposta (RC.6.1). MarketLimit negativo é sem
// limite; com limite, ficam os fatos de mercado mais próximos do dia corrente.
type Options struct {
	MineOnly    bool
	MarketLimit int
}

// Result é o calendário de uma janela e o total de fatos de mercado nela
// (antes do corte), pro cliente mostrar "+N outros".
type Result struct {
	Days        []DayEntry
	MarketTotal int
	MarketShown int
}

// Service monta a linha do tempo.
type Service struct {
	global GlobalFacts
	user   UserFacts
}

func NewService(global GlobalFacts, user UserFacts) *Service {
	return &Service{global: global, user: user}
}

// Clock devolve o relógio do dia simulado corrente.
func (s *Service) Clock(ctx context.Context) (Clock, error) {
	day, err := s.global.CurrentDay(ctx)
	if err != nil {
		return Clock{}, err
	}
	return ClockAt(day), nil
}

// DefaultWindow devolve a janela padrão do calendário (uma semana atrás, duas à frente).
func (s *Service) DefaultWindow(ctx context.Context) (int, int, error) {
	day, err := s.global.CurrentDay(ctx)
	if err != nil {
		return 0, 0, err
	}
	return day - 7, day + 14, nil
}

// Calendar devolve um DayEntry por dia de fromDay a toDay (inclusive). Só entram
// fatos determinísticos no futuro (Copom, relatório, proventos já anunciados e
// vencimentos do usuário) e, no passado, o que de fato aconteceu; um evento
// macro ainda não disparado nunca aparece. userID vazio devolve só os fatos globais.
func (s *Service) Calendar(ctx context.Context, userID string, fromDay, toDay int) ([]DayEntry, error) {
	result, err := s.CalendarWith(ctx, userID, fromDay, toDay, Options{MarketLimit: -1})
	if err != nil {
		return nil, err
	}
	return result.Days, nil
}

// CalendarWith é o Calendar com relevância (RC.6.1): cada fato sai marcado como
// "mine" ou "market" pro usuário, e Options recorta a resposta.
func (s *Service) CalendarWith(ctx context.Context, userID string, fromDay, toDay int, opts Options) (Result, error) {
	if toDay < fromDay || toDay-fromDay+1 > MaxWindowDays {
		return Result{}, ErrInvalidWindow
	}
	today, err := s.global.CurrentDay(ctx)
	if err != nil {
		return Result{}, err
	}

	byDay := make(map[int]*DayEntry, toDay-fromDay+1)
	entries := make([]DayEntry, 0, toDay-fromDay+1)
	for d := fromDay; d <= toDay; d++ {
		entries = append(entries, DayEntry{
			Day: d, Date: simcalendar.DateOf(d), Weekday: simcalendar.Weekday(d), MarketOpen: simcalendar.IsBusinessDay(d),
			Events: []Event{},
		})
		byDay[d] = &entries[len(entries)-1]
	}
	add := func(day int, e Event) {
		if entry, ok := byDay[day]; ok {
			e.Future = day > today
			if e.Relevance == "" {
				e.Relevance = RelevanceMarket
			}
			entry.Events = append(entry.Events, e)
		}
	}

	// O que o usuário tem e a que proventos tem direito: só dele, só quando há userID.
	var holdings map[string]Holding
	var recipients map[recipientKey]float64
	if userID != "" && s.user != nil {
		held, err := s.user.HoldingsOf(ctx, userID)
		if err != nil {
			return Result{}, err
		}
		holdings = make(map[string]Holding, len(held))
		for _, h := range held {
			holdings[h.Ticker] = h
		}
		rows, err := s.user.DividendRecipientsBetween(ctx, userID, fromDay, toDay)
		if err != nil {
			return Result{}, err
		}
		recipients = make(map[recipientKey]float64, len(rows))
		for _, r := range rows {
			recipients[recipientKey{r.Ticker, r.ExDay, r.PaymentDay}] += r.Quantity
		}
	}

	macros, err := s.global.MacroEventsBetween(ctx, fromDay, toDay)
	if err != nil {
		return Result{}, err
	}
	for _, m := range macros {
		if m.Day <= today {
			add(m.Day, Event{Kind: KindMacroEvent, Scope: scopeGlobal, Title: m.Title, Direction: m.Direction})
		}
	}

	// Copom e relatório são determinísticos: valem no passado e no futuro. O
	// tick do dia d usa o índice d-1 (mesma convenção do Temporizador). Copom é
	// informação macro (market); o relatório é do usuário só quando ele tem ação.
	selicRates, err := s.global.SelicByDay(ctx, fromDay-1, min(toDay, today))
	if err != nil {
		return Result{}, err
	}
	holdsStock := false
	for _, h := range holdings {
		if h.Class == "acao" {
			holdsStock = true
		}
	}
	for d := max(fromDay, 1); d <= toDay; d++ {
		if selic.IsCopomMeetingDay(d - 1) {
			e := Event{Kind: KindCopom, Scope: scopeGlobal}
			if rate, ok := selicRates[d]; ok && d <= today {
				e.SelicRate = &rate
				if prev, ok := selicRates[d-1]; ok {
					e.PreviousSelicRate = &prev
				}
			}
			add(d, e)
		}
		if fundamentals.IsReportDay(d-1, fundamentals.DefaultReportFrequencyDays) {
			e := Event{Kind: KindReport, Scope: scopeGlobal}
			if holdsStock {
				e.Relevance, e.RelevanceReason = RelevanceMine, ReasonPosition
			}
			add(d, e)
		}
	}

	dividends, err := s.global.DividendsBetween(ctx, fromDay, toDay)
	if err != nil {
		return Result{}, err
	}
	for _, dv := range dividends {
		value := dv.ValuePerShare
		ex := Event{Kind: KindDividendExDate, Scope: scopeGlobal, Ticker: dv.Ticker, UnitValue: &value}
		pay := Event{Kind: KindDividendPayDate, Scope: scopeGlobal, Ticker: dv.Ticker, UnitValue: &value}
		if quantity, estimate, ok := entitlement(dv, holdings, recipients, today); ok {
			amount := value * quantity
			for _, e := range []*Event{&ex, &pay} {
				q := quantity
				a := amount
				e.Relevance, e.RelevanceReason = RelevanceMine, ReasonPosition
				e.UserQuantity, e.EstimatedAmount, e.AmountIsEstimate = &q, &a, estimate
			}
		}
		add(dv.ExDay, ex)
		add(dv.PaymentDay, pay)
	}

	if userID != "" {
		if s.user != nil {
			facts, err := s.user.UserFactsBetween(ctx, userID, fromDay, toDay)
			if err != nil {
				return Result{}, err
			}
			for _, f := range facts {
				if e, ok := userEvent(f); ok {
					add(f.Day, e)
				}
			}
		}
		// O dia de pagamento futuro é determinístico (5º dia útil do mês), mas o
		// valor depende do nível no momento do pagamento (backend, T.3/T.5) — só
		// anuncia o dia, sem UnitValue. O salário já pago vem do fato real acima
		// (market_events), nunca duplicado aqui: essa sintética só entra no futuro.
		for d := max(fromDay, today+1); d <= toDay; d++ {
			if simcalendar.IsFifthBusinessDayOfMonth(d) {
				add(d, Event{
					Kind: KindSalaryPayment, Scope: scopeUser, ReferenceMonth: simcalendar.MonthKeyOf(d),
					Relevance: RelevanceMine, RelevanceReason: ReasonSalary,
				})
			}
		}
	}

	for i := range entries {
		sortEvents(entries[i].Events)
	}
	return shape(entries, today, opts), nil
}

type recipientKey struct {
	ticker     string
	exDay      int
	paymentDay int
}

// entitlement diz se o usuário é afetado por um provento e com que quantidade.
// Com snapshot (a data-ex já foi tirada), o valor é exato. Sem snapshot, só quem
// tem posição agora e ainda está antes da data-ex vê uma estimativa ("se mantiver
// a posição"); depois da data-ex sem snapshot o usuário não tem direito.
func entitlement(dv DividendFact, holdings map[string]Holding, recipients map[recipientKey]float64, today int) (quantity float64, estimate, ok bool) {
	if q, found := recipients[recipientKey{dv.Ticker, dv.ExDay, dv.PaymentDay}]; found {
		return q, false, true
	}
	if h, found := holdings[dv.Ticker]; found && dv.ExDay > today {
		return h.Quantity, true, true
	}
	return 0, false, false
}

// shape conta os fatos por relevância e aplica o recorte de Options: só "mine"
// quando pedido, e no máximo MarketLimit fatos de mercado, os mais próximos de
// hoje (dia corrente conta primeiro, empate resolvido pelo dia mais cedo).
func shape(entries []DayEntry, today int, opts Options) Result {
	type ref struct{ entry, event int }
	var market []ref
	for i := range entries {
		for j, e := range entries[i].Events {
			if e.Relevance == RelevanceMine {
				entries[i].Summary.Mine++
			} else {
				entries[i].Summary.Market++
				market = append(market, ref{i, j})
			}
		}
	}
	total := len(market)

	keep := make(map[ref]bool, len(market))
	if !opts.MineOnly {
		sort.SliceStable(market, func(a, b int) bool {
			da, db := distance(entries[market[a].entry].Day, today), distance(entries[market[b].entry].Day, today)
			if da != db {
				return da < db
			}
			return entries[market[a].entry].Day < entries[market[b].entry].Day
		})
		limit := len(market)
		if opts.MarketLimit >= 0 && opts.MarketLimit < limit {
			limit = opts.MarketLimit
		}
		for _, r := range market[:limit] {
			keep[r] = true
		}
	}

	shown := 0
	for i := range entries {
		kept := make([]Event, 0, len(entries[i].Events))
		for j, e := range entries[i].Events {
			if e.Relevance == RelevanceMine {
				kept = append(kept, e)
			} else if keep[ref{i, j}] {
				kept = append(kept, e)
				shown++
			}
		}
		entries[i].Events = kept
	}
	return Result{Days: entries, MarketTotal: total, MarketShown: shown}
}

func distance(day, today int) int {
	if day < today {
		return today - day
	}
	return day - today
}

// userEvent traduz um fato do usuário; tipos de evento que não são "coisa que o
// usuário fez ou recebeu" (depósito inicial, movimentos de bot/ETF) ficam de fora.
func userEvent(f UserFact) (Event, bool) {
	e := Event{
		Scope: scopeUser, Ticker: f.Ticker, Quantity: f.Quantity, UnitValue: f.UnitValue, ReferenceMonth: f.ReferenceMonth,
		Relevance: RelevanceMine, RelevanceReason: ReasonOwnFact,
	}
	if f.Maturity {
		e.Kind = KindFixedIncomeMaturity
		e.RelevanceReason = ReasonFixedIncomePosition
		return e, true
	}
	switch f.EventType {
	case eventBuyOrderExecuted:
		e.Kind, e.Side = KindOrderExecuted, orderSideBuy
	case eventSellOrderExecuted:
		e.Kind, e.Side = KindOrderExecuted, orderSideSell
	case eventDividendPayment:
		e.Kind = KindDividendReceived
	case eventFixedIncomePurchase:
		e.Kind = KindFixedIncomePurchase
	case eventFixedIncomeRedemption:
		e.Kind = KindFixedIncomeRedeem
	case eventSalaryPayment:
		e.Kind = KindSalaryPayment
		e.RelevanceReason = ReasonSalary
	default:
		return Event{}, false
	}
	return e, true
}

// sortEvents dá uma ordem estável: fatos do mercado antes dos do usuário, depois por tipo e ticker.
func sortEvents(events []Event) {
	rank := func(e Event) int {
		if e.Scope == scopeUser {
			return 1
		}
		return 0
	}
	sort.SliceStable(events, func(i, j int) bool {
		a, b := events[i], events[j]
		if rank(a) != rank(b) {
			return rank(a) < rank(b)
		}
		if a.Kind != b.Kind {
			return a.Kind < b.Kind
		}
		return a.Ticker < b.Ticker
	})
}
