package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"sync"
	"time"

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
	// Direction (E.1) é opcional — só declarado num evento "misto" pra dar
	// a este alvo um sinal próprio (positivo/negativo, nunca misto) em vez
	// de herdar a direção do evento. Ausente na maioria dos disparos.
	Direction *string `json:"direction"`
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

// macroEventTargetResponse espelha macroevent.Target — exatamente um entre
// Sector/RiskClass/AssetID preenchido (macroevent.NewTarget já garante essa
// exclusividade antes da persistência). AffectedMetric não é exposto: é
// derivado deterministicamente de affects_price/affects_fundamentals (já no
// nível do evento), redundante pra quem consome esta resposta. Direction/
// PriceEffectPct/FundamentalsEffectPct (E.1) só aparecem quando este alvo
// declarou uma direção própria — omitidos (não null) no caso comum, em que
// o alvo herda o efeito do evento (campos de mesmo nome na raiz da
// resposta).
type macroEventTargetResponse struct {
	Sector                *string  `json:"sector,omitempty"`
	RiskClass             *string  `json:"risk_class,omitempty"`
	AssetID               *string  `json:"asset_id,omitempty"`
	Direction             *string  `json:"direction,omitempty"`
	PriceEffectPct        *float64 `json:"price_effect_pct,omitempty"`
	FundamentalsEffectPct *float64 `json:"fundamentals_effect_pct,omitempty"`
}

type macroEventResponse struct {
	ID                    string                     `json:"id"`
	TemplateKey           *string                    `json:"template_key,omitempty"`
	Title                 string                     `json:"title"`
	Narrative             string                     `json:"narrative"`
	Direction             string                     `json:"direction"`
	MagnitudeBand         string                     `json:"magnitude_band"`
	AffectsPrice          bool                       `json:"affects_price"`
	AffectsFundamentals   bool                       `json:"affects_fundamentals"`
	Status                string                     `json:"status"`
	TriggeredOnDay        int                        `json:"triggered_on_day"`
	DurationDays          int                        `json:"duration_days"`
	PriceEffectPct        *float64                   `json:"price_effect_pct,omitempty"`
	FundamentalsEffectPct *float64                   `json:"fundamentals_effect_pct,omitempty"`
	FundamentalsReportDay *int                       `json:"fundamentals_report_day,omitempty"`
	Targets               []macroEventTargetResponse `json:"targets"`
	// CreatedAt só é preenchido por toMacroEventResponseFromRecord (GET
	// /macro-events, tarefa 6.6.1) — o disparo em si (POST /macro-events)
	// não busca created_at de volta do banco depois do INSERT, então fica
	// omitido (não zero-valued) nessa resposta.
	CreatedAt *time.Time `json:"created_at,omitempty"`
}

func toMacroEventResponse(id string, event macroevent.Event) macroEventResponse {
	targets := make([]macroEventTargetResponse, 0, len(event.Targets))
	for _, target := range event.Targets {
		var sector *string
		if target.Sector != nil {
			s := string(*target.Sector)
			sector = &s
		}
		var direction *string
		if target.Direction != nil {
			d := string(*target.Direction)
			direction = &d
		}
		targets = append(targets, macroEventTargetResponse{
			Sector:                sector,
			RiskClass:             target.RiskClass,
			AssetID:               target.AssetID,
			Direction:             direction,
			PriceEffectPct:        target.PriceEffectPct,
			FundamentalsEffectPct: target.FundamentalsEffectPct,
		})
	}

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
		Targets:               targets,
	}
}

// toMacroEventResponseFromRecord estende toMacroEventResponse com
// created_at (macroevent.Record, não macroevent.Event — ver doc do pacote
// pra por que os dois campos vivem separados) — usado só por
// handleListMacroEvents (GET /macro-events, tarefa 6.6.1), nunca pelo
// disparo (POST /macro-events não tem created_at de volta do INSERT).
func toMacroEventResponseFromRecord(rec macroevent.Record) macroEventResponse {
	resp := toMacroEventResponse(rec.ID, rec.Event)
	createdAt := rec.CreatedAt
	resp.CreatedAt = &createdAt
	return resp
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
			var direction *macroevent.Direction
			if t.Direction != nil {
				d := macroevent.Direction(*t.Direction)
				direction = &d
			}
			req.Targets = append(req.Targets, macroeventtrigger.TargetInput{
				Sector:    t.Sector,
				RiskClass: t.RiskClass,
				AssetID:   t.AssetID,
				Direction: direction,
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
	// Count devolve o total de eventos macro (sem paginação) — usado pra
	// compor total_entries/total_pages na resposta (tarefa 6.9.9, frontend
	// trocando "Carregar mais" por paginação numerada).
	Count(ctx context.Context) (int, error)
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
	Events       []macroEventResponse `json:"events"`
	TotalEntries int                  `json:"total_entries"`
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

		// List e Count são independentes (achado de revisão da 6.9.9) —
		// disparadas em paralelo em vez de sequenciais, *db.MacroEventRepository
		// usa database/sql por baixo, seguro pra uso concorrente.
		var records []macroevent.Record
		var total int
		var listErr, countErr error
		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			records, listErr = macroEvents.List(r.Context(), limit, offset)
		}()
		go func() {
			defer wg.Done()
			total, countErr = macroEvents.Count(r.Context())
		}()
		wg.Wait()

		if listErr != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao listar eventos macro")
			return
		}
		if countErr != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao contar eventos macro")
			return
		}

		events := make([]macroEventResponse, 0, len(records))
		for _, rec := range records {
			events = append(events, toMacroEventResponseFromRecord(rec))
		}
		writeJSON(w, http.StatusOK, macroEventListResponse{Events: events, TotalEntries: total})
	}
}

func writeMacroEventTriggerError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, macroeventtrigger.ErrUnknownTemplate),
		errors.Is(err, macroeventtrigger.ErrMissingFields),
		errors.Is(err, macroeventtrigger.ErrUnknownSector),
		errors.Is(err, macroeventtrigger.ErrUnknownTargetAsset),
		errors.Is(err, macroeventtrigger.ErrAssetNotTargetable),
		errors.Is(err, macroevent.ErrMissingTitle),
		errors.Is(err, macroevent.ErrMissingNarrative),
		errors.Is(err, macroevent.ErrNoEffectEnabled),
		errors.Is(err, macroevent.ErrNoTarget),
		errors.Is(err, macroevent.ErrTargetScopeAmbiguous),
		errors.Is(err, macroevent.ErrTargetDirectionMustBeSigned),
		errors.Is(err, macroevent.ErrUnknownBand):
		writeCatalogError(w, http.StatusBadRequest, err.Error())
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao disparar evento macro")
	}
}
