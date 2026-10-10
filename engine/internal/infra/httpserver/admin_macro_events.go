package httpserver

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"tcc-investimentos/engine/internal/domain/macroevent"
	"tcc-investimentos/engine/internal/domain/macroeventadmin"
	"tcc-investimentos/engine/internal/domain/simcalendar"
	"tcc-investimentos/engine/internal/domain/tick"
)

// Ciclo de vida do evento macro no painel (tarefa N.11): detalhe com impacto realizado e
// cancelamento. Mesmo trust boundary de POST /macro-events: o backend valida role = admin.

// macroEventAdmin é o que as rotas precisam — *macroeventadmin.Service.
type macroEventAdmin interface {
	Detail(ctx context.Context, id string, windowDays int) (macroeventadmin.Detail, error)
	Cancel(ctx context.Context, id string) (macroevent.Record, error)
}

// WithMacroEventAdmin liga GET /macro-events/{id} e DELETE /macro-events/{id}; sem ela
// respondem 503.
func WithMacroEventAdmin(m macroEventAdmin) Option {
	return func(o *options) { o.macroEventAdmin = m }
}

type impactAssetResponse struct {
	AssetID     string  `json:"asset_id"`
	Ticker      string  `json:"ticker"`
	PriceBefore float64 `json:"price_before"`
	PriceAfter  float64 `json:"price_after"`
	ChangePct   float64 `json:"change_pct"`
}

type impactTargetResponse struct {
	macroEventTargetResponse
	Assets           []impactAssetResponse `json:"assets"`
	AverageChangePct *float64              `json:"average_change_pct"`
}

type impactResponse struct {
	Available      bool                   `json:"available"`
	WindowDays     int                    `json:"window_days"`
	BaseDay        int                    `json:"base_day"`
	EndDay         int                    `json:"end_day"`
	AvailableOnDay int                    `json:"available_on_day"`
	Targets        []impactTargetResponse `json:"targets"`
}

type macroEventDetailResponse struct {
	macroEventResponse
	CreatedBy *string `json:"created_by"`
	// CurrentDay é o dia simulado em que o detalhe foi lido; ReportDate, a data do dia do
	// relatório de fundamentos (AAAA-MM-DD), só quando o evento afeta fundamentos.
	CurrentDay int     `json:"current_day"`
	ReportDate *string `json:"report_date,omitempty"`
	// PubliclyVisible diz se o usuário já enxerga o evento no feed e no calendário
	// (macroevent.IsPubliclyVisible).
	PubliclyVisible bool           `json:"publicly_visible"`
	Impact          impactResponse `json:"impact"`
}

func toMacroEventDetailResponse(d macroeventadmin.Detail) macroEventDetailResponse {
	base := toMacroEventResponseFromRecord(d.Record)
	scheduled, cancellable := d.Scheduled, d.Cancellable
	base.Scheduled, base.Cancellable = &scheduled, &cancellable

	resp := macroEventDetailResponse{
		macroEventResponse: base, CreatedBy: d.Record.CreatedBy, CurrentDay: d.CurrentDay,
		PubliclyVisible: macroevent.IsPubliclyVisible(d.Record.Status, d.Record.TriggeredOnDay, d.Record.RevealLeadDays, d.CurrentDay),
	}
	if d.Record.FundamentalsReportDay != nil {
		date := simcalendar.DateOf(*d.Record.FundamentalsReportDay).Format(dateLayout)
		resp.ReportDate = &date
	}

	resp.Impact = impactResponse{
		Available: d.Impact.Available, WindowDays: d.Impact.WindowDays, BaseDay: d.Impact.BaseDay,
		EndDay: d.Impact.EndDay, AvailableOnDay: d.Impact.AvailableOnDay, Targets: []impactTargetResponse{},
	}
	for _, t := range d.Impact.Targets {
		assets := make([]impactAssetResponse, 0, len(t.Assets))
		for _, a := range t.Assets {
			assets = append(assets, impactAssetResponse{AssetID: a.AssetID, Ticker: a.Ticker, PriceBefore: a.PriceBefore, PriceAfter: a.PriceAfter, ChangePct: a.ChangePct})
		}
		// O alvo é descrito pelos mesmos campos do evento (setor, classe de risco ou ativo).
		targetOnly := toMacroEventResponse("", macroevent.Event{Targets: []macroevent.Target{t.Target}}).Targets[0]
		resp.Impact.Targets = append(resp.Impact.Targets, impactTargetResponse{macroEventTargetResponse: targetOnly, Assets: assets, AverageChangePct: t.AverageChangePct})
	}
	return resp
}

// handleAdminMacroEventDetail serve GET /macro-events/{id}?window_days=: o evento com o
// estado de ciclo de vida e o impacto realizado de preço por alvo.
func handleAdminMacroEventDetail(m macroEventAdmin) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de eventos macro indisponível")
			return
		}
		id := r.PathValue("id")
		if !uuidPattern.MatchString(id) {
			writeCatalogError(w, http.StatusBadRequest, "id deve ser um UUID válido")
			return
		}
		window := 0
		if raw := r.URL.Query().Get("window_days"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed < 1 {
				writeCatalogError(w, http.StatusBadRequest, "window_days inválido")
				return
			}
			window = parsed
		}
		detail, err := m.Detail(r.Context(), id, window)
		if err != nil {
			writeMacroEventAdminError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, toMacroEventDetailResponse(detail))
	}
}

// handleAdminMacroEventCancel serve DELETE /macro-events/{id}: cancela um evento
// pendente que ainda não produziu efeito. Devolve o evento já cancelado.
func handleAdminMacroEventCancel(m macroEventAdmin) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de eventos macro indisponível")
			return
		}
		id := r.PathValue("id")
		if !uuidPattern.MatchString(id) {
			writeCatalogError(w, http.StatusBadRequest, "id deve ser um UUID válido")
			return
		}
		rec, err := m.Cancel(r.Context(), id)
		if err != nil {
			writeMacroEventAdminError(w, err)
			return
		}
		cancellable, scheduled := false, false
		resp := toMacroEventResponseFromRecord(rec)
		resp.Scheduled, resp.Cancellable = &scheduled, &cancellable
		writeJSON(w, http.StatusOK, resp)
	}
}

func writeMacroEventAdminError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, macroeventadmin.ErrNotFound):
		writeCatalogError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, macroeventadmin.ErrInvalidWindow):
		writeCatalogError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, macroevent.ErrNotPending), errors.Is(err, macroevent.ErrEffectStarted):
		writeCatalogError(w, http.StatusConflict, err.Error())
	case errors.Is(err, tick.ErrTickInProgress):
		writeCatalogError(w, http.StatusConflict, "já existe um tick em andamento; tente de novo em instantes")
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao processar o evento macro")
	}
}
