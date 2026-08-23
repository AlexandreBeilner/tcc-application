package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"tcc-investimentos/engine/internal/domain/macroevent"
	"tcc-investimentos/engine/internal/domain/macroeventtrigger"
)

// macroEventTriggerer é o colaborador que POST /macro-events precisa pra
// disparar um evento macro ponta a ponta — implementado por
// *macroeventtrigger.Service, injetado em New (tarefa 4.4). Rota interna
// do motor, sem porta publicada — mesma convenção de POST /accounts
// (tarefa 1.5): o gate de role = admin acontece no backend
// (POST /admin/macro-events), antes de chamar esta rota.
type macroEventTriggerer interface {
	Trigger(ctx context.Context, req macroeventtrigger.Request) (string, macroevent.Event, error)
}

type triggerMacroEventTargetRequest struct {
	Sector    *string `json:"sector"`
	RiskClass *string `json:"risk_class"`
	AssetID   *string `json:"asset_id"`
}

// triggerMacroEventRequest espelha o payload da tarefa 4.4: com
// template_key, os demais campos textuais/de efeito são ignorados
// (resolvidos do catálogo, macroevent.FindTemplate) — só targets é
// sempre lido do corpo da requisição.
type triggerMacroEventRequest struct {
	TemplateKey         *string                          `json:"template_key"`
	Title               *string                          `json:"title"`
	Narrative           *string                          `json:"narrative"`
	Direction           *string                          `json:"direction"`
	MagnitudeBand       *string                          `json:"magnitude_band"`
	AffectsPrice        *bool                            `json:"affects_price"`
	AffectsFundamentals *bool                            `json:"affects_fundamentals"`
	Targets             []triggerMacroEventTargetRequest `json:"targets"`
	CreatedBy           *string                          `json:"created_by"`
}

type macroEventResponse struct {
	ID                    string   `json:"id"`
	TemplateKey           *string  `json:"template_key,omitempty"`
	Title                 string   `json:"title"`
	Narrative             string   `json:"narrative"`
	Direction             string   `json:"direction"`
	MagnitudeBand         string   `json:"magnitude_band"`
	AffectsPrice          bool     `json:"affects_price"`
	AffectsFundamentals   bool     `json:"affects_fundamentals"`
	Status                string   `json:"status"`
	TriggeredOnDay        int      `json:"triggered_on_day"`
	DurationDays          int      `json:"duration_days"`
	PriceEffectPct        *float64 `json:"price_effect_pct,omitempty"`
	FundamentalsEffectPct *float64 `json:"fundamentals_effect_pct,omitempty"`
	FundamentalsReportDay *int     `json:"fundamentals_report_day,omitempty"`
}

func toMacroEventResponse(id string, event macroevent.Event) macroEventResponse {
	return macroEventResponse{
		ID:                    id,
		TemplateKey:           event.TemplateKey,
		Title:                 event.Title,
		Narrative:             event.Narrative,
		Direction:             string(event.Direction),
		MagnitudeBand:         string(event.MagnitudeBand),
		AffectsPrice:          event.AffectsPrice,
		AffectsFundamentals:   event.AffectsFundamentals,
		Status:                string(event.Status),
		TriggeredOnDay:        event.TriggeredOnDay,
		DurationDays:          event.DurationDays,
		PriceEffectPct:        event.PriceEffectPct,
		FundamentalsEffectPct: event.FundamentalsEffectPct,
		FundamentalsReportDay: event.FundamentalsReportDay,
	}
}

// handleTriggerMacroEvent serve POST /macro-events — dispara um evento
// macro ponta a ponta (tarefa 4.4), a partir de um template (4.3) ou
// avulso. macroeventtrigger.Service já valida a definição do evento
// (macroevent.NewEvent/NewTarget) independente da validação Zod que o
// backend já fez antes de chamar esta rota — defesa em profundidade
// documentada no critério de aceite da 4.4, não redundância acidental.
func handleTriggerMacroEvent(macroEvents macroEventTriggerer) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if macroEvents == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de eventos macro indisponível")
			return
		}

		var body triggerMacroEventRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		if len(body.Targets) == 0 {
			writeCatalogError(w, http.StatusBadRequest, "evento macro precisa de pelo menos um alvo")
			return
		}

		req := macroeventtrigger.Request{
			TemplateKey:         body.TemplateKey,
			Title:               body.Title,
			Narrative:           body.Narrative,
			AffectsPrice:        body.AffectsPrice,
			AffectsFundamentals: body.AffectsFundamentals,
			CreatedBy:           body.CreatedBy,
		}
		if body.Direction != nil {
			d := macroevent.Direction(*body.Direction)
			req.Direction = &d
		}
		if body.MagnitudeBand != nil {
			b := macroevent.Band(*body.MagnitudeBand)
			req.MagnitudeBand = &b
		}
		req.Targets = make([]macroeventtrigger.TargetInput, 0, len(body.Targets))
		for _, t := range body.Targets {
			req.Targets = append(req.Targets, macroeventtrigger.TargetInput{
				Sector:    t.Sector,
				RiskClass: t.RiskClass,
				AssetID:   t.AssetID,
			})
		}

		id, event, err := macroEvents.Trigger(r.Context(), req)
		if err != nil {
			writeMacroEventTriggerError(w, err)
			return
		}

		writeJSON(w, http.StatusCreated, toMacroEventResponse(id, event))
	}
}

// macroEventLister é o colaborador que GET /macro-events precisa pra ler o
// histórico — implementado por *db.MacroEventRepository, injetado em New
// (tarefa 4.5). Rota interna do motor, mesma convenção de POST
// /macro-events: o gate de role = admin acontece no backend (GET
// /admin/macro-events), esta rota só é alcançável de dentro da rede do
// Compose.
type macroEventLister interface {
	List(ctx context.Context, limit, offset int) ([]macroevent.Record, error)
}

// defaultMacroEventListLimit/maxMacroEventListLimit balizam a paginação
// simples pedida pelo critério de aceite da tarefa 4.5 (?limit=&offset=,
// "default razoável" — não fixado por nenhum critério anterior, só evita
// devolver a tabela inteira sem limite).
const (
	defaultMacroEventListLimit = 20
	maxMacroEventListLimit     = 100
)

type macroEventListResponse struct {
	Events []macroEventResponse `json:"events"`
}

// parsePaginationParam lê um parâmetro de paginação (?limit=/?offset=) da
// query string — devolve def se ausente, erro se presente mas não for um
// inteiro >= min (e <= max, quando max > 0).
func parsePaginationParam(raw string, def, min, max int) (int, bool) {
	if raw == "" {
		return def, true
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < min || (max > 0 && parsed > max) {
		return 0, false
	}
	return parsed, true
}

// handleListMacroEvents serve GET /macro-events — histórico de eventos
// macro (tela 10.1, RF14), status já refletindo a aplicação contínua do
// efeito (tarefa 4.5: tick.Service.Run/SaveTick atualizam a coluna a cada
// tick), não um valor congelado da criação.
func handleListMacroEvents(macroEvents macroEventLister) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if macroEvents == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de eventos macro indisponível")
			return
		}

		limit, ok := parsePaginationParam(r.URL.Query().Get("limit"), defaultMacroEventListLimit, 1, maxMacroEventListLimit)
		if !ok {
			writeCatalogError(w, http.StatusBadRequest, "limit inválido")
			return
		}
		offset, ok := parsePaginationParam(r.URL.Query().Get("offset"), 0, 0, 0)
		if !ok {
			writeCatalogError(w, http.StatusBadRequest, "offset inválido")
			return
		}

		records, err := macroEvents.List(r.Context(), limit, offset)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao listar eventos macro")
			return
		}

		events := make([]macroEventResponse, 0, len(records))
		for _, rec := range records {
			events = append(events, toMacroEventResponse(rec.ID, rec.Event))
		}
		writeJSON(w, http.StatusOK, macroEventListResponse{Events: events})
	}
}

func writeMacroEventTriggerError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, macroeventtrigger.ErrUnknownTemplate),
		errors.Is(err, macroeventtrigger.ErrMissingFields),
		errors.Is(err, macroeventtrigger.ErrUnknownSector),
		errors.Is(err, macroevent.ErrMissingTitle),
		errors.Is(err, macroevent.ErrMissingNarrative),
		errors.Is(err, macroevent.ErrNoEffectEnabled),
		errors.Is(err, macroevent.ErrNoTarget),
		errors.Is(err, macroevent.ErrTargetScopeAmbiguous),
		errors.Is(err, macroevent.ErrUnknownBand):
		writeCatalogError(w, http.StatusBadRequest, err.Error())
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao disparar evento macro")
	}
}
