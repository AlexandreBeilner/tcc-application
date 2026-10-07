package httpserver

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"tcc-investimentos/engine/internal/domain/enginesetting"
	"tcc-investimentos/engine/internal/domain/marketcalendar"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// marketCalendarService é o que GET /market/clock e GET /market/calendar
// precisam (tarefa S.10) — implementado por *marketcalendar.Service.
type marketCalendarService interface {
	Clock(ctx context.Context) (marketcalendar.Clock, error)
	DefaultWindow(ctx context.Context) (fromDay, toDay int, err error)
	CalendarWith(ctx context.Context, userID string, fromDay, toDay int, opts marketcalendar.Options) (marketcalendar.Result, error)
}

// CalendarAPI reúne o serviço do calendário e o que só a infraestrutura de
// agenda sabe: o fator de aceleração (dias simulados por dia real) e o
// instante do próximo tick. NextTick pode ser nil (agenda automática desligada:
// o tick é manual) e Now pode ser nil (usa o relógio de parede).
type CalendarAPI struct {
	Service        marketCalendarService
	DaysPerRealDay int
	// Current (opcional) devolve o ritmo vigente (N.7); sem ela vale DaysPerRealDay.
	Current  func(ctx context.Context) (enginesetting.Values, error)
	NextTick func(now time.Time) time.Time
	Now      func() time.Time
}

const dateLayout = "2006-01-02"

// weekdayCodes: código estável do dia da semana, independente de idioma
// (o frontend traduz), na ordem de time.Weekday (domingo = 0).
var weekdayCodes = [...]string{"sun", "mon", "tue", "wed", "thu", "fri", "sat"}

type clockResponse struct {
	SimulatedDay   int     `json:"simulated_day"`
	Date           string  `json:"date"`
	Weekday        string  `json:"weekday"`
	MarketOpen     bool    `json:"market_open"`
	DaysUntilOpen  int     `json:"days_until_open"`
	DaysPerRealDay int     `json:"days_per_real_day"`
	NextTickAt     *string `json:"next_tick_at"`
	QuarterDay     int     `json:"quarter_day"`
	QuarterLength  int     `json:"quarter_length"`
}

// handleGetMarketClock serve GET /market/clock: em que dia do mercado simulado
// estamos, se o mercado está aberto e quando vem o próximo dia.
func handleGetMarketClock(api *CalendarAPI) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if api == nil || api.Service == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de calendário indisponível")
			return
		}
		clock, err := api.Service.Clock(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar o relógio do mercado")
			return
		}
		daysPerRealDay := api.DaysPerRealDay
		if api.Current != nil {
			values, err := api.Current(r.Context())
			if err != nil {
				writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar o relógio do mercado")
				return
			}
			daysPerRealDay = values.TicksPerDay
		}
		resp := clockResponse{
			SimulatedDay:   clock.Day,
			Date:           clock.Date.Format(dateLayout),
			Weekday:        weekdayCodes[clock.Weekday],
			MarketOpen:     clock.MarketOpen,
			DaysUntilOpen:  clock.DaysUntilOpen,
			DaysPerRealDay: daysPerRealDay,
			QuarterDay:     clock.QuarterDay,
			QuarterLength:  clock.QuarterLength,
		}
		if api.NextTick != nil {
			now := time.Now
			if api.Now != nil {
				now = api.Now
			}
			next := api.NextTick(now()).UTC().Format(time.RFC3339)
			resp.NextTickAt = &next
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

type calendarEventResponse struct {
	Kind   string `json:"kind"`
	Scope  string `json:"scope"`
	Future bool   `json:"future"`
	// Campos por tipo: omitidos quando não se aplicam.
	Title             *string  `json:"title,omitempty"`
	Direction         *string  `json:"direction,omitempty"`
	Ticker            *string  `json:"ticker,omitempty"`
	Side              *string  `json:"side,omitempty"`
	Quantity          *float64 `json:"quantity,omitempty"`
	UnitValue         *float64 `json:"unit_value,omitempty"`
	SelicRate         *float64 `json:"selic_rate,omitempty"`
	PreviousSelicRate *float64 `json:"previous_selic_rate,omitempty"`
	// ReferenceMonth (achado 025) só vem em kind salary_payment — o
	// mês-calendário real a que o salário se refere, distinto do dia deste
	// evento quando o pagamento foi um catch-up de meses atrasados (T.5).
	ReferenceMonth *string `json:"reference_month,omitempty"`
	// Relevância pro usuário do token (RC.6.1). EstimatedAmount e UserQuantity são
	// sempre do próprio usuário; AmountIsEstimate é falso quando o valor é exato.
	Relevance        string   `json:"relevance"`
	RelevanceReason  *string  `json:"relevance_reason,omitempty"`
	EstimatedAmount  *float64 `json:"estimated_amount,omitempty"`
	AmountIsEstimate *bool    `json:"amount_is_estimate,omitempty"`
	UserQuantity     *float64 `json:"user_quantity,omitempty"`
}

type calendarSummaryResponse struct {
	MineCount   int `json:"mine_count"`
	MarketCount int `json:"market_count"`
}

type calendarDayResponse struct {
	SimulatedDay int                     `json:"simulated_day"`
	Date         string                  `json:"date"`
	Weekday      string                  `json:"weekday"`
	MarketOpen   bool                    `json:"market_open"`
	Events       []calendarEventResponse `json:"events"`
	Summary      calendarSummaryResponse `json:"summary"`
}

type calendarResponse struct {
	From int                   `json:"from_day"`
	To   int                   `json:"to_day"`
	Days []calendarDayResponse `json:"days"`
	// MarketTotal é o total de fatos de mercado na janela antes do corte por
	// market_limit; MarketShown é quantos vieram na resposta.
	MarketTotal int `json:"market_total"`
	MarketShown int `json:"market_shown"`
}

const (
	defaultMarketLimit = 50
	maxMarketLimit     = 200
)

// amountIsEstimate só aparece quando há valor estimado do usuário no fato.
func amountIsEstimate(e marketcalendar.Event) *bool {
	if e.EstimatedAmount == nil {
		return nil
	}
	return &e.AmountIsEstimate
}

func optionalString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// handleGetMarketCalendar serve GET /market/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD[&user_id=]:
// um item por dia da janela com os fatos dele. Sem from/to, uma semana atrás e
// duas à frente do dia corrente. user_id (opcional) junta os fatos daquele
// usuário; nunca há fato de terceiro nem patrimônio (RNF09). Como o resto do
// motor, a autenticação é do backend, que passa o id do usuário do token.
func handleGetMarketCalendar(api *CalendarAPI) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if api == nil || api.Service == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de calendário indisponível")
			return
		}
		q := r.URL.Query()
		fromDay, toDay, err := api.Service.DefaultWindow(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar o calendário do mercado")
			return
		}
		if raw := q.Get("from"); raw != "" {
			parsed, err := time.Parse(dateLayout, raw)
			if err != nil {
				writeCatalogError(w, http.StatusBadRequest, "from inválido, use AAAA-MM-DD")
				return
			}
			fromDay = simcalendar.DayOf(parsed)
		}
		if raw := q.Get("to"); raw != "" {
			parsed, err := time.Parse(dateLayout, raw)
			if err != nil {
				writeCatalogError(w, http.StatusBadRequest, "to inválido, use AAAA-MM-DD")
				return
			}
			toDay = simcalendar.DayOf(parsed)
		} else if q.Get("from") != "" {
			toDay = fromDay + 20
		}
		// A janela padrão nunca começa antes do dia 0.
		if q.Get("from") == "" && fromDay < 0 {
			fromDay = 0
		}

		userID := q.Get("user_id")
		if userID != "" && !uuidPattern.MatchString(userID) {
			writeCatalogError(w, http.StatusBadRequest, "user_id deve ser um UUID válido")
			return
		}

		opts := marketcalendar.Options{MarketLimit: defaultMarketLimit}
		switch q.Get("scope") {
		case "", "all":
		case "mine":
			opts.MineOnly = true
		default:
			writeCatalogError(w, http.StatusBadRequest, "scope deve ser mine ou all")
			return
		}
		if raw := q.Get("market_limit"); raw != "" {
			limit, err := strconv.Atoi(raw)
			if err != nil || limit < 0 || limit > maxMarketLimit {
				writeCatalogError(w, http.StatusBadRequest, "market_limit deve ser um inteiro de 0 a 200")
				return
			}
			opts.MarketLimit = limit
		}

		result, err := api.Service.CalendarWith(r.Context(), userID, fromDay, toDay, opts)
		if errors.Is(err, marketcalendar.ErrInvalidWindow) {
			writeCatalogError(w, http.StatusBadRequest, "janela inválida: from deve ser <= to e cobrir no máximo 92 dias")
			return
		}
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar o calendário do mercado")
			return
		}

		resp := calendarResponse{
			From: fromDay, To: toDay, Days: make([]calendarDayResponse, 0, len(result.Days)),
			MarketTotal: result.MarketTotal, MarketShown: result.MarketShown,
		}
		for _, d := range result.Days {
			events := make([]calendarEventResponse, 0, len(d.Events))
			for _, e := range d.Events {
				events = append(events, calendarEventResponse{
					Kind: string(e.Kind), Scope: e.Scope, Future: e.Future,
					Title: optionalString(e.Title), Direction: optionalString(e.Direction),
					Ticker: optionalString(e.Ticker), Side: optionalString(e.Side),
					Quantity: e.Quantity, UnitValue: e.UnitValue,
					SelicRate: e.SelicRate, PreviousSelicRate: e.PreviousSelicRate,
					ReferenceMonth: optionalString(e.ReferenceMonth),
					Relevance:      e.Relevance, RelevanceReason: optionalString(e.RelevanceReason),
					EstimatedAmount: e.EstimatedAmount, AmountIsEstimate: amountIsEstimate(e),
					UserQuantity: e.UserQuantity,
				})
			}
			resp.Days = append(resp.Days, calendarDayResponse{
				SimulatedDay: d.Day, Date: d.Date.Format(dateLayout), Weekday: weekdayCodes[d.Weekday],
				MarketOpen: d.MarketOpen, Events: events,
				Summary: calendarSummaryResponse{MineCount: d.Summary.Mine, MarketCount: d.Summary.Market},
			})
		}
		writeJSON(w, http.StatusOK, resp)
	}
}
