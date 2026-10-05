package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/tick"
)

type fakeSchedulerStore struct {
	paused    bool
	resumedAt time.Time
	err       error
	pauses    int
	resumes   int
}

func (f *fakeSchedulerStore) State(context.Context) (bool, time.Time, error) {
	return f.paused, f.resumedAt, f.err
}

func (f *fakeSchedulerStore) Pause(context.Context) error {
	f.pauses++
	f.paused = true
	return f.err
}

func (f *fakeSchedulerStore) Resume(context.Context) error {
	f.resumes++
	f.paused = false
	f.resumedAt = time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	return f.err
}

type fakeRunLister struct {
	records []tick.RunRecord
	total   int
	err     error
	limit   int
	offset  int
}

func (f *fakeRunLister) ListRuns(_ context.Context, limit, offset int) ([]tick.RunRecord, int, error) {
	f.limit, f.offset = limit, offset
	return f.records, f.total, f.err
}

type fakeAdvancer struct {
	results []tick.Result
	err     error
	days    int
}

func (f *fakeAdvancer) RunMany(_ context.Context, days int) ([]tick.Result, error) {
	f.days = days
	return f.results, f.err
}

func schedulerAPI(store *fakeSchedulerStore) *SchedulerAdminAPI {
	return &SchedulerAdminAPI{
		Control:     store,
		Enabled:     true,
		TicksPerDay: 5,
		MaxCatchUp:  3,
		Timezone:    "America/Sao_Paulo",
		NextSlot:    func(time.Time) time.Time { return time.Date(2026, 10, 3, 15, 0, 0, 0, time.UTC) },
		InProgress:  func(context.Context) (bool, error) { return false, nil },
		LastTickAt: func(context.Context) (time.Time, bool, error) {
			return time.Date(2026, 10, 3, 10, 0, 0, 0, time.UTC), true, nil
		},
		Now: func() time.Time { return time.Date(2026, 10, 3, 11, 0, 0, 0, time.UTC) },
	}
}

func callScheduler(t *testing.T, api *SchedulerAdminAPI, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, WithSchedulerAdmin(api)).Handler.ServeHTTP(rec, req)
	return rec
}

func TestHandleGetScheduler(t *testing.T) {
	rec := callScheduler(t, schedulerAPI(&fakeSchedulerStore{}), http.MethodGet, "/admin/scheduler", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var got schedulerStatusResponse
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	if !got.Enabled || got.Paused || got.TicksPerDay != 5 || got.MaxCatchUp != 3 || got.Timezone != "America/Sao_Paulo" || got.TickInProgress {
		t.Errorf("status = %+v", got)
	}
	if got.NextSlotAt == nil || *got.NextSlotAt != "2026-10-03T15:00:00Z" {
		t.Errorf("next_slot_at = %v, want 2026-10-03T15:00:00Z", got.NextSlotAt)
	}
	if got.LastTickAt == nil || *got.LastTickAt != "2026-10-03T10:00:00Z" {
		t.Errorf("last_tick_at = %v", got.LastTickAt)
	}
	if got.ResumedAt != nil {
		t.Errorf("resumed_at = %v, want nil", got.ResumedAt)
	}
}

func TestHandleGetScheduler_PausadoOuDesligadoNaoTemProximoSlot(t *testing.T) {
	paused := schedulerAPI(&fakeSchedulerStore{paused: true})
	disabled := schedulerAPI(&fakeSchedulerStore{})
	disabled.Enabled = false
	for name, api := range map[string]*SchedulerAdminAPI{"pausado": paused, "desligado": disabled} {
		rec := callScheduler(t, api, http.MethodGet, "/admin/scheduler", "")
		var got schedulerStatusResponse
		_ = json.NewDecoder(rec.Body).Decode(&got)
		if got.NextSlotAt != nil {
			t.Errorf("%s: next_slot_at = %v, want nil", name, *got.NextSlotAt)
		}
	}
}

func TestHandleGetScheduler_TickEmAndamento(t *testing.T) {
	api := schedulerAPI(&fakeSchedulerStore{})
	api.InProgress = func(context.Context) (bool, error) { return true, nil }
	var got schedulerStatusResponse
	_ = json.NewDecoder(callScheduler(t, api, http.MethodGet, "/admin/scheduler", "").Body).Decode(&got)
	if !got.TickInProgress {
		t.Error("tick_in_progress = false, want true")
	}
}

func TestHandleGetScheduler_ErroDeLeitura(t *testing.T) {
	rec := callScheduler(t, schedulerAPI(&fakeSchedulerStore{err: errors.New("banco")}), http.MethodGet, "/admin/scheduler", "")
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
}

func TestSchedulerRoutes_SemAPIDa503(t *testing.T) {
	for _, tt := range []struct{ method, path, body string }{
		{http.MethodGet, "/admin/scheduler", ""},
		{http.MethodPost, "/admin/scheduler/pause", ""},
		{http.MethodPost, "/admin/scheduler/resume", ""},
		{http.MethodGet, "/admin/ticks", ""},
		{http.MethodPost, "/admin/tick/advance", `{"days":1}`},
	} {
		rec := httptest.NewRecorder()
		New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil).Handler.ServeHTTP(rec, httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body)))
		if rec.Code != http.StatusServiceUnavailable {
			t.Errorf("%s %s = %d, want 503", tt.method, tt.path, rec.Code)
		}
	}
}

func TestHandlePauseResume(t *testing.T) {
	store := &fakeSchedulerStore{}
	api := schedulerAPI(store)

	rec := callScheduler(t, api, http.MethodPost, "/admin/scheduler/pause", "")
	var got schedulerStatusResponse
	_ = json.NewDecoder(rec.Body).Decode(&got)
	if rec.Code != http.StatusOK || !got.Paused || store.pauses != 1 || got.NextSlotAt != nil {
		t.Errorf("pause: status = %d, %+v, pauses = %d", rec.Code, got, store.pauses)
	}

	rec = callScheduler(t, api, http.MethodPost, "/admin/scheduler/resume", "")
	got = schedulerStatusResponse{}
	_ = json.NewDecoder(rec.Body).Decode(&got)
	if rec.Code != http.StatusOK || got.Paused || store.resumes != 1 || got.ResumedAt == nil || got.NextSlotAt == nil {
		t.Errorf("resume: status = %d, %+v, resumes = %d", rec.Code, got, store.resumes)
	}
}

func TestHandlePause_AgendaDesligadaNoAmbienteDa409(t *testing.T) {
	store := &fakeSchedulerStore{}
	api := schedulerAPI(store)
	api.Enabled = false
	for _, path := range []string{"/admin/scheduler/pause", "/admin/scheduler/resume"} {
		if rec := callScheduler(t, api, http.MethodPost, path, ""); rec.Code != http.StatusConflict {
			t.Errorf("%s = %d, want 409", path, rec.Code)
		}
	}
	if store.pauses+store.resumes != 0 {
		t.Error("com a agenda desligada nada deveria ser gravado")
	}
}

func TestHandlePause_ErroAoGravar(t *testing.T) {
	rec := callScheduler(t, schedulerAPI(&fakeSchedulerStore{err: errors.New("banco")}), http.MethodPost, "/admin/scheduler/pause", "")
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
}

func TestHandleListTicks(t *testing.T) {
	started := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	lister := &fakeRunLister{total: 45, records: []tick.RunRecord{
		{Day: 12, Trigger: tick.TriggerCatchUp, Status: tick.RunSuccess, StartedAt: started, Duration: 2500 * time.Millisecond, CatchUpDiscarded: 9,
			Counters: tick.RunCounters{SelicRate: 10.5, IsCopomDay: true, QuotesCount: 24, BotFillsCount: 5}},
		{Day: 0, Trigger: tick.TriggerManual, Status: tick.RunFailed, ErrorMessage: "banco caiu", StartedAt: started},
	}}
	api := schedulerAPI(&fakeSchedulerStore{})
	api.Runs = lister

	rec := callScheduler(t, api, http.MethodGet, "/admin/ticks?limit=2&offset=4", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if lister.limit != 2 || lister.offset != 4 {
		t.Errorf("repassou limit/offset = %d/%d, want 2/4", lister.limit, lister.offset)
	}
	var body struct {
		Ticks        []tickRunResponse `json:"ticks"`
		TotalEntries int               `json:"total_entries"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.TotalEntries != 45 || len(body.Ticks) != 2 {
		t.Fatalf("body = %+v", body)
	}
	ok, failed := body.Ticks[0], body.Ticks[1]
	if ok.SimulatedDay == nil || *ok.SimulatedDay != 12 || ok.Trigger != "catchup" || ok.DurationMs != 2500 || ok.CatchUpDiscarded != 9 ||
		ok.SelicRate == nil || *ok.SelicRate != 10.5 || !ok.IsCopomDay || ok.QuotesCount != 24 || ok.BotFillsCount != 5 || ok.ErrorMessage != nil {
		t.Errorf("tick ok = %+v", ok)
	}
	if failed.SimulatedDay != nil || failed.SelicRate != nil || failed.ErrorMessage == nil || *failed.ErrorMessage != "banco caiu" || failed.Status != "failed" {
		t.Errorf("tick falho = %+v", failed)
	}
}

func TestHandleListTicks_DefaultsEValidacao(t *testing.T) {
	lister := &fakeRunLister{}
	api := schedulerAPI(&fakeSchedulerStore{})
	api.Runs = lister

	if rec := callScheduler(t, api, http.MethodGet, "/admin/ticks", ""); rec.Code != http.StatusOK || lister.limit != 20 || lister.offset != 0 {
		t.Errorf("sem query: status = %d, limit/offset = %d/%d, want 200 e 20/0", rec.Code, lister.limit, lister.offset)
	}
	var body struct {
		Ticks []tickRunResponse `json:"ticks"`
	}
	rec := callScheduler(t, api, http.MethodGet, "/admin/ticks", "")
	_ = json.NewDecoder(rec.Body).Decode(&body)
	if body.Ticks == nil {
		t.Error("ticks deveria ser [] e não null quando vazio")
	}
	for _, q := range []string{"limit=0", "limit=101", "limit=abc", "offset=-1"} {
		if rec := callScheduler(t, api, http.MethodGet, "/admin/ticks?"+q, ""); rec.Code != http.StatusBadRequest {
			t.Errorf("?%s = %d, want 400", q, rec.Code)
		}
	}
}

func TestHandleAdvanceTicks(t *testing.T) {
	adv := &fakeAdvancer{results: []tick.Result{{State: tick.State{Day: 1, SelicRate: 10}}, {State: tick.State{Day: 2, SelicRate: 10.25}}}}
	api := schedulerAPI(&fakeSchedulerStore{})
	api.Advancer = adv

	rec := callScheduler(t, api, http.MethodPost, "/admin/tick/advance", `{"days":2}`)
	if rec.Code != http.StatusOK || adv.days != 2 {
		t.Fatalf("status = %d, days = %d, body = %s", rec.Code, adv.days, rec.Body.String())
	}
	var body struct {
		Requested int            `json:"requested"`
		Ticks     []tickResponse `json:"ticks"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&body)
	if body.Requested != 2 || len(body.Ticks) != 2 || body.Ticks[1].Day != 2 || body.Ticks[1].SelicRate != 10.25 {
		t.Errorf("body = %+v", body)
	}
}

func TestHandleAdvanceTicks_Validacao(t *testing.T) {
	adv := &fakeAdvancer{}
	api := schedulerAPI(&fakeSchedulerStore{})
	api.Advancer = adv
	for name, body := range map[string]string{
		"zero":        `{"days":0}`,
		"negativo":    `{"days":-3}`,
		"acima":       `{"days":31}`,
		"ausente":     `{}`,
		"json quebra": `{"days":`,
		"tipo errado": `{"days":"2"}`,
	} {
		if rec := callScheduler(t, api, http.MethodPost, "/admin/tick/advance", body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, want 400", name, rec.Code)
		}
	}
	if adv.days != 0 {
		t.Errorf("nada deveria rodar com corpo inválido, rodou com days = %d", adv.days)
	}
}

func TestHandleAdvanceTicks_TickEmAndamentoDa409(t *testing.T) {
	api := schedulerAPI(&fakeSchedulerStore{})
	api.Advancer = &fakeAdvancer{err: tick.ErrTickInProgress}
	if rec := callScheduler(t, api, http.MethodPost, "/admin/tick/advance", `{"days":3}`); rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409", rec.Code)
	}
}

func TestHandleAdvanceTicks_FalhaNoMeioDevolveOQueJaRodou(t *testing.T) {
	api := schedulerAPI(&fakeSchedulerStore{})
	api.Advancer = &fakeAdvancer{results: []tick.Result{{State: tick.State{Day: 7}}}, err: errors.New("banco caiu")}

	rec := callScheduler(t, api, http.MethodPost, "/admin/tick/advance", `{"days":5}`)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	var body struct {
		Requested int            `json:"requested"`
		Ticks     []tickResponse `json:"ticks"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&body)
	if body.Requested != 5 || len(body.Ticks) != 1 || body.Ticks[0].Day != 7 {
		t.Errorf("body = %+v, want requested 5 e 1 tick já rodado (dia 7)", body)
	}
}
