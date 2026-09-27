package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/marketcalendar"
)

type fakeCalendarService struct {
	day      int
	gotUser  string
	gotFrom  int
	gotTo    int
	calendar []marketcalendar.DayEntry
	err      error
}

func (f *fakeCalendarService) Clock(context.Context) (marketcalendar.Clock, error) {
	return marketcalendar.ClockAt(f.day), f.err
}
func (f *fakeCalendarService) DefaultWindow(context.Context) (int, int, error) {
	return f.day - 7, f.day + 14, f.err
}
func (f *fakeCalendarService) Calendar(_ context.Context, userID string, from, to int) ([]marketcalendar.DayEntry, error) {
	f.gotUser, f.gotFrom, f.gotTo = userID, from, to
	if to < from {
		return nil, marketcalendar.ErrInvalidWindow
	}
	return f.calendar, f.err
}

func getCalendar(api *CalendarAPI, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, api).Handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))
	return rec
}

func TestGetMarketClock_Sabado(t *testing.T) {
	now := time.Date(2026, 9, 26, 10, 0, 0, 0, time.UTC)
	api := &CalendarAPI{
		Service:        &fakeCalendarService{day: 5},
		DaysPerRealDay: 5,
		Now:            func() time.Time { return now },
		NextTick:       func(t time.Time) time.Time { return t.Add(4*time.Hour + 48*time.Minute) },
	}
	rec := getCalendar(api, "/market/clock")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	var got clockResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.SimulatedDay != 5 || got.Date != "2026-01-10" || got.Weekday != "sat" || got.MarketOpen || got.DaysUntilOpen != 2 ||
		got.DaysPerRealDay != 5 || got.QuarterDay != 5 || got.QuarterLength != 91 {
		t.Errorf("clock = %+v", got)
	}
	if got.NextTickAt == nil || *got.NextTickAt != "2026-09-26T14:48:00Z" {
		t.Errorf("next_tick_at = %v", got.NextTickAt)
	}
}

func TestGetMarketClock_SemAgendaNextTickNulo(t *testing.T) {
	rec := getCalendar(&CalendarAPI{Service: &fakeCalendarService{day: 1}, DaysPerRealDay: 5}, "/market/clock")
	var raw map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &raw)
	if v, ok := raw["next_tick_at"]; !ok || v != nil {
		t.Errorf("next_tick_at deve vir como null: %v", raw)
	}
}

func TestGetMarketClock_ServicoIndisponivel(t *testing.T) {
	if rec := getCalendar(nil, "/market/clock"); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d", rec.Code)
	}
	if rec := getCalendar(nil, "/market/calendar"); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d", rec.Code)
	}
}

func TestGetMarketCalendar(t *testing.T) {
	price := 12.5
	svc := &fakeCalendarService{day: 10, calendar: []marketcalendar.DayEntry{{
		Day: 9, Date: time.Date(2026, 1, 14, 0, 0, 0, 0, time.UTC), Weekday: time.Wednesday, MarketOpen: true,
		Events: []marketcalendar.Event{{Kind: marketcalendar.KindOrderExecuted, Scope: "user", Ticker: "BNDD3", Side: "buy", UnitValue: &price}},
	}}}
	rec := getCalendar(&CalendarAPI{Service: svc}, "/market/calendar?from=2026-01-14&to=2026-01-20&user_id=6f1d3c1e-8a3b-4f43-9f3e-2f7f1b1c0a11")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	if svc.gotFrom != 9 || svc.gotTo != 15 || svc.gotUser != "6f1d3c1e-8a3b-4f43-9f3e-2f7f1b1c0a11" {
		t.Errorf("janela/usuário repassados: %d %d %q", svc.gotFrom, svc.gotTo, svc.gotUser)
	}
	var got calendarResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	if len(got.Days) != 1 || got.Days[0].Weekday != "wed" || got.Days[0].Date != "2026-01-14" ||
		len(got.Days[0].Events) != 1 || *got.Days[0].Events[0].Ticker != "BNDD3" || got.Days[0].Events[0].Title != nil {
		t.Errorf("resposta = %+v", got)
	}
}

func TestGetMarketCalendar_JanelaPadrao(t *testing.T) {
	svc := &fakeCalendarService{day: 3}
	getCalendar(&CalendarAPI{Service: svc}, "/market/calendar")
	if svc.gotFrom != 0 || svc.gotTo != 17 {
		t.Errorf("janela padrão = %d..%d (nunca antes do dia 0)", svc.gotFrom, svc.gotTo)
	}
	svc = &fakeCalendarService{day: 30}
	getCalendar(&CalendarAPI{Service: svc}, "/market/calendar")
	if svc.gotFrom != 23 || svc.gotTo != 44 {
		t.Errorf("janela padrão = %d..%d", svc.gotFrom, svc.gotTo)
	}
}

func TestGetMarketCalendar_Entradas_Invalidas(t *testing.T) {
	api := &CalendarAPI{Service: &fakeCalendarService{day: 10}}
	for _, target := range []string{
		"/market/calendar?from=14-01-2026",
		"/market/calendar?to=amanha",
		"/market/calendar?user_id=nao-e-uuid",
		"/market/calendar?from=2026-01-20&to=2026-01-14",
	} {
		if rec := getCalendar(api, target); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d", target, rec.Code)
		}
	}
}
