package httpserver

import (
	"context"
	"errors"
	"net/http"
	"time"

	"tcc-investimentos/engine/internal/domain/marketcalendar"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// marketCalendarService é o que GET /market/clock e GET /market/calendar
// precisam (tarefa S.10) — implementado por *marketcalendar.Service.
type marketCalendarService interface {
	Clock(ctx context.Context) (marketcalendar.Clock, error)
	DefaultWindow(ctx context.Context) (fromDay, toDay int, err error)
	Calendar(ctx context.Context, userID string, fromDay, toDay int) ([]marketcalendar.DayEntry, error)
}

// CalendarAPI reúne o serviço do calendário e o que só a infraestrutura de
// agenda sabe: o fator de aceleração (dias simulados por dia real) e o
// instante do próximo tick. NextTick pode ser nil (agenda automática desligada:
// o tick é manual) e Now pode ser nil (usa o relógio de parede).
type CalendarAPI struct {
	Service        marketCalendarService
	DaysPerRealDay int
	NextTick       func(now time.Time) time.Time
	Now            func() time.Time
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
		resp := clockResponse{
			SimulatedDay:   clock.Day,
			Date:           clock.Date.Format(dateLayout),
			Weekday:        weekdayCodes[clock.Weekday],
			MarketOpen:     clock.MarketOpen,
			DaysUntilOpen:  clock.DaysUntilOpen,
			DaysPerRealDay: api.DaysPerRealDay,
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
}

type calendarDayResponse struct {
	SimulatedDay int                     `json:"simulated_day"`
	Date         string                  `json:"date"`
	Weekday      string                  `json:"weekday"`
	MarketOpen   bool                    `json:"market_open"`
	Events       []calendarEventResponse `json:"events"`
}

type calendarResponse struct {
	From int                   `json:"from_day"`
	To   int                   `json:"to_day"`
	Days []calendarDayResponse `json:"days"`
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

		days, err := api.Service.Calendar(r.Context(), userID, fromDay, toDay)
		if errors.Is(err, marketcalendar.ErrInvalidWindow) {
			writeCatalogError(w, http.StatusBadRequest, "janela inválida: from deve ser <= to e cobrir no máximo 92 dias")
			return
		}
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar o calendário do mercado")
			return
		}

		resp := calendarResponse{From: fromDay, To: toDay, Days: make([]calendarDayResponse, 0, len(days))}
		for _, d := range days {
			events := make([]calendarEventResponse, 0, len(d.Events))
			for _, e := range d.Events {
				events = append(events, calendarEventResponse{
					Kind: string(e.Kind), Scope: e.Scope, Future: e.Future,
					Title: optionalString(e.Title), Direction: optionalString(e.Direction),
					Ticker: optionalString(e.Ticker), Side: optionalString(e.Side),
					Quantity: e.Quantity, UnitValue: e.UnitValue,
					SelicRate: e.SelicRate, PreviousSelicRate: e.PreviousSelicRate,
				})
			}
			resp.Days = append(resp.Days, calendarDayResponse{
				SimulatedDay: d.Day, Date: d.Date.Format(dateLayout), Weekday: weekdayCodes[d.Weekday],
				MarketOpen: d.MarketOpen, Events: events,
			})
		}
		writeJSON(w, http.StatusOK, resp)
	}
}
