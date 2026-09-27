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
)

const (
	scopeGlobal = "global"
	scopeUser   = "user"

	orderSideBuy  = "buy"
	orderSideSell = "sell"

	// Nomes do enum market_event_type que viram fato do usuário.
	eventBuyOrderExecuted      = "buy_order_executed"
	eventSellOrderExecuted     = "sell_order_executed"
	eventDividendPayment       = "dividend_payment"
	eventFixedIncomePurchase   = "fixed_income_purchase"
	eventFixedIncomeRedemption = "fixed_income_redemption"
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

	SelicRate         *float64 // Copom já realizado: a Selic resultante
	PreviousSelicRate *float64 // Copom já realizado: a Selic anterior
}

// DayEntry é um dia da janela com os fatos dele.
type DayEntry struct {
	Day        int
	Date       time.Time
	Weekday    time.Weekday
	MarketOpen bool
	Events     []Event
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

// UserFacts lê o que é do usuário.
type UserFacts interface {
	UserFactsBetween(ctx context.Context, userID string, fromDay, toDay int) ([]UserFact, error)
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
	if toDay < fromDay || toDay-fromDay+1 > MaxWindowDays {
		return nil, ErrInvalidWindow
	}
	today, err := s.global.CurrentDay(ctx)
	if err != nil {
		return nil, err
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
			entry.Events = append(entry.Events, e)
		}
	}

	macros, err := s.global.MacroEventsBetween(ctx, fromDay, toDay)
	if err != nil {
		return nil, err
	}
	for _, m := range macros {
		if m.Day <= today {
			add(m.Day, Event{Kind: KindMacroEvent, Scope: scopeGlobal, Title: m.Title, Direction: m.Direction})
		}
	}

	// Copom e relatório são determinísticos: valem no passado e no futuro. O
	// tick do dia d usa o índice d-1 (mesma convenção do Temporizador).
	selicRates, err := s.global.SelicByDay(ctx, fromDay-1, min(toDay, today))
	if err != nil {
		return nil, err
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
			add(d, Event{Kind: KindReport, Scope: scopeGlobal})
		}
	}

	dividends, err := s.global.DividendsBetween(ctx, fromDay, toDay)
	if err != nil {
		return nil, err
	}
	for _, dv := range dividends {
		value := dv.ValuePerShare
		add(dv.ExDay, Event{Kind: KindDividendExDate, Scope: scopeGlobal, Ticker: dv.Ticker, UnitValue: &value})
		add(dv.PaymentDay, Event{Kind: KindDividendPayDate, Scope: scopeGlobal, Ticker: dv.Ticker, UnitValue: &value})
	}

	if userID != "" && s.user != nil {
		facts, err := s.user.UserFactsBetween(ctx, userID, fromDay, toDay)
		if err != nil {
			return nil, err
		}
		for _, f := range facts {
			if e, ok := userEvent(f); ok {
				add(f.Day, e)
			}
		}
	}

	for i := range entries {
		sortEvents(entries[i].Events)
	}
	return entries, nil
}

// userEvent traduz um fato do usuário; tipos de evento que não são "coisa que o
// usuário fez ou recebeu" (depósito inicial, movimentos de bot/ETF) ficam de fora.
func userEvent(f UserFact) (Event, bool) {
	e := Event{Scope: scopeUser, Ticker: f.Ticker, Quantity: f.Quantity, UnitValue: f.UnitValue}
	if f.Maturity {
		e.Kind = KindFixedIncomeMaturity
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
