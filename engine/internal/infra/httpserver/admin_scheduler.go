package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"tcc-investimentos/engine/internal/domain/tick"
)

// Rotas administrativas do Temporizador (tarefa N.6) — mesmo trust boundary de
// POST /admin/tick: sem checagem de role aqui, o backend valida role = admin
// antes de repassar (ver admin.go).

type schedulerStateStore interface {
	State(ctx context.Context) (paused bool, resumedAt time.Time, err error)
	Pause(ctx context.Context) error
	Resume(ctx context.Context) error
}

type tickRunLister interface {
	ListRuns(ctx context.Context, limit, offset int) ([]tick.RunRecord, int, error)
}

type tickAdvancer interface {
	RunMany(ctx context.Context, days int) ([]tick.Result, error)
}

// SchedulerAdminAPI agrupa o que as rotas /admin/scheduler, /admin/ticks e
// /admin/tick/advance precisam. Enabled/TicksPerDay/MaxCatchUp/Timezone/NextSlot
// descrevem a agenda do processo (vêm do ambiente no boot, só leitura aqui); a
// pausa é estado em runtime (Control).
type SchedulerAdminAPI struct {
	Control     schedulerStateStore
	Runs        tickRunLister
	Advancer    tickAdvancer
	Enabled     bool
	TicksPerDay int
	MaxCatchUp  int
	Timezone    string
	NextSlot    func(now time.Time) time.Time
	// InProgress diz se há um tick rodando agora (sonda da trava consultiva); LastTickAt
	// é o instante do último tick gravado.
	InProgress func(ctx context.Context) (bool, error)
	LastTickAt func(ctx context.Context) (time.Time, bool, error)
	Now        func() time.Time
}

// Option configura rotas opcionais de New/Run sem mexer na assinatura posicional.
type Option func(*options)

type options struct {
	scheduler   *SchedulerAdminAPI
	adminReader adminReader
}

// WithSchedulerAdmin liga as rotas do painel de Tempo (N.6); sem ela respondem 503.
func WithSchedulerAdmin(api *SchedulerAdminAPI) Option {
	return func(o *options) { o.scheduler = api }
}

type schedulerStatusResponse struct {
	Enabled        bool    `json:"enabled"`
	Paused         bool    `json:"paused"`
	ResumedAt      *string `json:"resumed_at"`
	TicksPerDay    int     `json:"ticks_per_day"`
	Timezone       string  `json:"timezone"`
	MaxCatchUp     int     `json:"max_catch_up"`
	NextSlotAt     *string `json:"next_slot_at"`
	TickInProgress bool    `json:"tick_in_progress"`
	LastTickAt     *string `json:"last_tick_at"`
}

func rfc3339Ptr(t time.Time) *string {
	if t.IsZero() {
		return nil
	}
	s := t.UTC().Format(time.RFC3339)
	return &s
}

func (api *SchedulerAdminAPI) now() time.Time {
	if api.Now != nil {
		return api.Now()
	}
	return time.Now()
}

func (api *SchedulerAdminAPI) status(ctx context.Context) (schedulerStatusResponse, error) {
	paused, resumedAt, err := api.Control.State(ctx)
	if err != nil {
		return schedulerStatusResponse{}, err
	}
	resp := schedulerStatusResponse{
		Enabled:     api.Enabled,
		Paused:      paused,
		ResumedAt:   rfc3339Ptr(resumedAt),
		TicksPerDay: api.TicksPerDay,
		Timezone:    api.Timezone,
		MaxCatchUp:  api.MaxCatchUp,
	}
	// Sem próximo slot quando a agenda está desligada no ambiente ou pausada.
	if api.Enabled && !paused && api.NextSlot != nil {
		resp.NextSlotAt = rfc3339Ptr(api.NextSlot(api.now()))
	}
	if api.InProgress != nil {
		if resp.TickInProgress, err = api.InProgress(ctx); err != nil {
			return schedulerStatusResponse{}, err
		}
	}
	if api.LastTickAt != nil {
		last, found, err := api.LastTickAt(ctx)
		if err != nil {
			return schedulerStatusResponse{}, err
		}
		if found {
			resp.LastTickAt = rfc3339Ptr(last)
		}
	}
	return resp, nil
}

// handleGetScheduler serve GET /admin/scheduler: estado da agenda do Temporizador.
func handleGetScheduler(api *SchedulerAdminAPI) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if api == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "controle do temporizador indisponível")
			return
		}
		resp, err := api.status(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao ler o estado do temporizador")
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// handleSetSchedulerPaused serve POST /admin/scheduler/pause e /resume. Idempotente:
// pausar quem já está pausado (ou retomar quem não está) devolve o estado atual. Com a
// agenda desligada no ambiente (TICK_SCHEDULER_ENABLED=false) responde 409: não há o
// que pausar.
func handleSetSchedulerPaused(api *SchedulerAdminAPI, paused bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if api == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "controle do temporizador indisponível")
			return
		}
		if !api.Enabled {
			writeCatalogError(w, http.StatusConflict, "a agenda automática está desligada neste ambiente")
			return
		}
		var err error
		if paused {
			err = api.Control.Pause(r.Context())
		} else {
			err = api.Control.Resume(r.Context())
		}
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao alterar a pausa do temporizador")
			return
		}
		resp, err := api.status(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao ler o estado do temporizador")
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

const (
	defaultTickRunListLimit = 20
	maxTickRunListLimit     = 100
)

type tickRunResponse struct {
	SimulatedDay            *int     `json:"simulated_day"`
	Trigger                 string   `json:"trigger"`
	Status                  string   `json:"status"`
	ErrorMessage            *string  `json:"error_message"`
	StartedAt               string   `json:"started_at"`
	DurationMs              int64    `json:"duration_ms"`
	CatchUpDiscarded        int      `json:"catch_up_discarded"`
	SelicRate               *float64 `json:"selic_rate"`
	IsCopomDay              bool     `json:"is_copom_day"`
	IsReportDay             bool     `json:"is_report_day"`
	QuotesCount             int      `json:"quotes_count"`
	FundamentalsCount       int      `json:"fundamentals_count"`
	DividendsGeneratedCount int      `json:"dividends_generated_count"`
	DividendsPaidCount      int      `json:"dividends_paid_count"`
	BotFillsCount           int      `json:"bot_fills_count"`
	ExpiredOrdersCount      int      `json:"expired_orders_count"`
	UncoveredAssetsCount    int      `json:"uncovered_assets_count"`
	IntradayRoundsCount     int      `json:"intraday_rounds_count"`
}

func toTickRunResponse(rec tick.RunRecord) tickRunResponse {
	resp := tickRunResponse{
		Trigger:                 string(rec.Trigger),
		Status:                  string(rec.Status),
		StartedAt:               rec.StartedAt.UTC().Format(time.RFC3339),
		DurationMs:              rec.Duration.Milliseconds(),
		CatchUpDiscarded:        rec.CatchUpDiscarded,
		IsCopomDay:              rec.Counters.IsCopomDay,
		IsReportDay:             rec.Counters.IsReportDay,
		QuotesCount:             rec.Counters.QuotesCount,
		FundamentalsCount:       rec.Counters.FundamentalsCount,
		DividendsGeneratedCount: rec.Counters.DividendsGeneratedCount,
		DividendsPaidCount:      rec.Counters.DividendsPaidCount,
		BotFillsCount:           rec.Counters.BotFillsCount,
		ExpiredOrdersCount:      rec.Counters.ExpiredOrdersCount,
		UncoveredAssetsCount:    rec.Counters.UncoveredAssetsCount,
		IntradayRoundsCount:     rec.Counters.IntradayRoundsCount,
	}
	if rec.Day > 0 {
		day := rec.Day
		resp.SimulatedDay = &day
	}
	if rec.ErrorMessage != "" {
		msg := rec.ErrorMessage
		resp.ErrorMessage = &msg
	}
	if rec.Status == tick.RunSuccess {
		selic := rec.Counters.SelicRate
		resp.SelicRate = &selic
	}
	return resp
}

// handleListTicks serve GET /admin/ticks: histórico de ticks, mais recente primeiro.
func handleListTicks(api *SchedulerAdminAPI) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if api == nil || api.Runs == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "histórico de ticks indisponível")
			return
		}
		limit, ok := parsePaginationParam(r.URL.Query().Get("limit"), defaultTickRunListLimit, 1, maxTickRunListLimit)
		if !ok {
			writeCatalogError(w, http.StatusBadRequest, "limit inválido")
			return
		}
		offset, ok := parsePaginationParam(r.URL.Query().Get("offset"), 0, 0, 0)
		if !ok {
			writeCatalogError(w, http.StatusBadRequest, "offset inválido")
			return
		}
		records, total, err := api.Runs.ListRuns(r.Context(), limit, offset)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao listar o histórico de ticks")
			return
		}
		ticks := make([]tickRunResponse, 0, len(records))
		for _, rec := range records {
			ticks = append(ticks, toTickRunResponse(rec))
		}
		writeJSON(w, http.StatusOK, map[string]any{"ticks": ticks, "total_entries": total})
	}
}

type advanceTickRequest struct {
	Days int `json:"days"`
}

// handleAdvanceTicks serve POST /admin/tick/advance: roda `days` ticks manuais em
// sequência sob uma só trava (1 a tick.MaxAdvanceDays). Numa falha no meio devolve 500
// com os ticks que já rodaram em `ticks` (eles ficam gravados; o mercado não volta atrás).
func handleAdvanceTicks(api *SchedulerAdminAPI) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if api == nil || api.Advancer == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "temporizador indisponível")
			return
		}
		var req advanceTickRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo inválido")
			return
		}
		if req.Days < 1 || req.Days > tick.MaxAdvanceDays {
			writeCatalogError(w, http.StatusBadRequest, "days precisa estar entre 1 e 30")
			return
		}

		extendWriteDeadline(w, adminTickWriteTimeout*time.Duration(req.Days))

		results, err := api.Advancer.RunMany(r.Context(), req.Days)
		ticks := make([]tickResponse, 0, len(results))
		for _, res := range results {
			ticks = append(ticks, toTickResponse(res))
		}
		if errors.Is(err, tick.ErrTickInProgress) {
			writeCatalogError(w, http.StatusConflict, "já existe um tick em andamento")
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "erro ao executar tick", "requested": req.Days, "ticks": ticks})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"requested": req.Days, "ticks": ticks})
	}
}
