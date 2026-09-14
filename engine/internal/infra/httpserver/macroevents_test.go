package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/macroevent"
	"tcc-investimentos/engine/internal/domain/macroeventtrigger"
)

type fakeMacroEventTriggerer struct {
	id    string
	event macroevent.Event
	err   error
	got   macroeventtrigger.Request
}

func (f *fakeMacroEventTriggerer) Trigger(_ context.Context, req macroeventtrigger.Request) (string, macroevent.Event, error) {
	f.got = req
	return f.id, f.event, f.err
}

func postMacroEvent(t *testing.T, triggerer macroEventTriggerer, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/macro-events", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, triggerer, nil, nil).Handler.ServeHTTP(rec, req)
	return rec
}

type fakeMacroEventLister struct {
	records   []macroevent.Record
	total     int
	err       error
	countErr  error
	gotLimit  int
	gotOffset int
}

func (f *fakeMacroEventLister) List(_ context.Context, limit, offset int) ([]macroevent.Record, error) {
	f.gotLimit = limit
	f.gotOffset = offset
	return f.records, f.err
}

func (f *fakeMacroEventLister) Count(_ context.Context) (int, error) {
	return f.total, f.countErr
}

func getMacroEvents(t *testing.T, lister macroEventLister, query string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/macro-events"+query, nil)
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, lister, nil).Handler.ServeHTTP(rec, req)
	return rec
}

func TestHandleListMacroEvents_DefaultPagination(t *testing.T) {
	fake := &fakeMacroEventLister{records: []macroevent.Record{
		{ID: "event-1", Event: macroevent.Event{Title: "t1", Status: macroevent.StatusPendente}},
	}}

	rec := getMacroEvents(t, fake, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if fake.gotLimit != defaultMacroEventListLimit || fake.gotOffset != 0 {
		t.Errorf("limit/offset = %d/%d, want %d/0", fake.gotLimit, fake.gotOffset, defaultMacroEventListLimit)
	}

	var body macroEventListResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body.Events) != 1 || body.Events[0].ID != "event-1" {
		t.Errorf("Events = %+v, want 1 evento com ID event-1", body.Events)
	}
}

// TestHandleListMacroEvents_IncluiTargets cobre o gap achado na sessão da
// tarefa 6.6 (frontend): GET /macro-events nunca devolvia targets (nem no
// domínio nem na resposta HTTP) apesar da tela 5.1 (Feed de Notícias)
// precisar deles pra linkar cada evento pro ativo/empresa afetado.
func TestHandleListMacroEvents_IncluiTargets(t *testing.T) {
	sector := catalog.Sector("Financeiro")
	riskClass := "alto"
	assetID := "asset-1"
	fake := &fakeMacroEventLister{records: []macroevent.Record{
		{
			ID: "event-1",
			Event: macroevent.Event{
				Title:  "t1",
				Status: macroevent.StatusPendente,
				Targets: []macroevent.Target{
					{Sector: &sector, AffectedMetric: macroevent.MetricPrice},
					{RiskClass: &riskClass, AffectedMetric: macroevent.MetricPrice},
					{AssetID: &assetID, AffectedMetric: macroevent.MetricPrice},
				},
			},
		},
	}}

	rec := getMacroEvents(t, fake, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body macroEventListResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body.Events) != 1 {
		t.Fatalf("Events = %+v, want 1 evento", body.Events)
	}
	targets := body.Events[0].Targets
	if len(targets) != 3 {
		t.Fatalf("Targets = %+v, want 3", targets)
	}
	if targets[0].Sector == nil || *targets[0].Sector != "Financeiro" {
		t.Errorf("Targets[0].Sector = %v, want Financeiro", targets[0].Sector)
	}
	if targets[1].RiskClass == nil || *targets[1].RiskClass != "alto" {
		t.Errorf("Targets[1].RiskClass = %v, want alto", targets[1].RiskClass)
	}
	if targets[2].AssetID == nil || *targets[2].AssetID != "asset-1" {
		t.Errorf("Targets[2].AssetID = %v, want asset-1", targets[2].AssetID)
	}
}

// TestHandleListMacroEvents_SemTargetsDevolveArrayVazio garante que um
// evento sem target (não deveria existir de verdade — macroevent.NewEvent
// exige >= 1 — mas o zero-value de um Record{} não popula Targets) devolve
// `"targets": []`, nunca `null`, pra não obrigar o frontend a checar nulo
// antes de iterar.
func TestHandleListMacroEvents_SemTargetsDevolveArrayVazio(t *testing.T) {
	fake := &fakeMacroEventLister{records: []macroevent.Record{
		{ID: "event-1", Event: macroevent.Event{Title: "t1", Status: macroevent.StatusPendente}},
	}}

	rec := getMacroEvents(t, fake, "")
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"targets":[]`)) {
		t.Errorf("body = %s, want targets como array vazio, não null", rec.Body.String())
	}
}

// TestHandleListMacroEvents_IncluiCreatedAt cobre o gap achado na sessão da
// tarefa 6.6.1: GET /macro-events nunca lia macro_events.created_at (a
// coluna existe desde a migration 000001, mas List/DTO nunca a expunham) —
// a tela 5.1 (Feed de Notícias) precisa da data real de criação, não do
// dia simulado (triggered_on_day).
func TestHandleListMacroEvents_IncluiCreatedAt(t *testing.T) {
	createdAt := time.Date(2026, 8, 30, 14, 5, 0, 0, time.UTC)
	fake := &fakeMacroEventLister{records: []macroevent.Record{
		{ID: "event-1", CreatedAt: createdAt, Event: macroevent.Event{Title: "t1", Status: macroevent.StatusPendente}},
	}}

	rec := getMacroEvents(t, fake, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body macroEventListResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(body.Events) != 1 || body.Events[0].CreatedAt == nil {
		t.Fatalf("Events = %+v, want 1 evento com CreatedAt preenchido", body.Events)
	}
	if !body.Events[0].CreatedAt.Equal(createdAt) {
		t.Errorf("CreatedAt = %v, want %v", body.Events[0].CreatedAt, createdAt)
	}
}

func TestHandleListMacroEvents_RepassaLimitEOffset(t *testing.T) {
	fake := &fakeMacroEventLister{}
	rec := getMacroEvents(t, fake, "?limit=5&offset=10")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if fake.gotLimit != 5 || fake.gotOffset != 10 {
		t.Errorf("limit/offset = %d/%d, want 5/10", fake.gotLimit, fake.gotOffset)
	}
}

func TestHandleListMacroEvents_LimitInvalidoRetorna400(t *testing.T) {
	fake := &fakeMacroEventLister{}
	for _, raw := range []string{"0", "-1", "abc", "101"} {
		rec := getMacroEvents(t, fake, "?limit="+raw)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("limit=%s: status = %d, want %d", raw, rec.Code, http.StatusBadRequest)
		}
	}
}

func TestHandleListMacroEvents_OffsetInvalidoRetorna400(t *testing.T) {
	fake := &fakeMacroEventLister{}
	for _, raw := range []string{"-1", "abc"} {
		rec := getMacroEvents(t, fake, "?offset="+raw)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("offset=%s: status = %d, want %d", raw, rec.Code, http.StatusBadRequest)
		}
	}
}

func TestHandleListMacroEvents_SemLister(t *testing.T) {
	rec := getMacroEvents(t, nil, "")
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestHandleListMacroEvents_ErroInternoRetorna500(t *testing.T) {
	fake := &fakeMacroEventLister{err: errors.New("falha de conexão")}
	rec := getMacroEvents(t, fake, "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

// TestHandleListMacroEvents_DevolveTotalEntries cobre a tarefa 6.9.9
// (frontend trocando "Carregar mais" por paginação numerada): a resposta
// precisa do total de eventos, não só da página pedida, pra sustentar
// "Página X de Y".
func TestHandleListMacroEvents_DevolveTotalEntries(t *testing.T) {
	fake := &fakeMacroEventLister{
		records: []macroevent.Record{{ID: "event-1", Event: macroevent.Event{Title: "t1", Status: macroevent.StatusPendente}}},
		total:   47,
	}

	rec := getMacroEvents(t, fake, "?limit=1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var body macroEventListResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.TotalEntries != 47 {
		t.Errorf("TotalEntries = %d, want 47", body.TotalEntries)
	}
}

func TestHandleListMacroEvents_ErroAoContarRetorna500(t *testing.T) {
	fake := &fakeMacroEventLister{countErr: errors.New("falha de conexão")}
	rec := getMacroEvents(t, fake, "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func TestHandleTriggerMacroEvent_ComTemplate(t *testing.T) {
	priceEffect := -10.5
	sector := catalog.Sector("Mineração")
	fake := &fakeMacroEventTriggerer{
		id: "event-1",
		event: macroevent.Event{
			TemplateKey:    ptrTest("legislacao-ambiental-mineracao"),
			Title:          "Nova legislação ambiental restringe atividade de mineração",
			Narrative:      "narrativa",
			Direction:      macroevent.DirectionNegativo,
			MagnitudeBand:  macroevent.BandModerado,
			AffectsPrice:   true,
			Status:         macroevent.StatusPendente,
			TriggeredOnDay: 5,
			DurationDays:   2,
			PriceEffectPct: &priceEffect,
			Targets:        []macroevent.Target{{Sector: &sector, AffectedMetric: macroevent.MetricPrice}},
		},
	}

	rec := postMacroEvent(t, fake, `{"template_key":"legislacao-ambiental-mineracao","targets":[{"sector":"Mineração"}]}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body.String())
	}

	var body macroEventResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body.ID != "event-1" {
		t.Errorf("ID = %q, want %q", body.ID, "event-1")
	}
	if body.TriggeredOnDay != 5 || body.DurationDays != 2 {
		t.Errorf("TriggeredOnDay/DurationDays = %d/%d, want 5/2", body.TriggeredOnDay, body.DurationDays)
	}
	if body.PriceEffectPct == nil || *body.PriceEffectPct != -10.5 {
		t.Errorf("PriceEffectPct = %v, want -10.5", body.PriceEffectPct)
	}
	if len(body.Targets) != 1 || body.Targets[0].Sector == nil || *body.Targets[0].Sector != "Mineração" {
		t.Errorf("Targets = %+v, want 1 target com Sector Mineração", body.Targets)
	}

	if fake.got.TemplateKey == nil || *fake.got.TemplateKey != "legislacao-ambiental-mineracao" {
		t.Errorf("template_key não repassado corretamente: %v", fake.got.TemplateKey)
	}
	if len(fake.got.Targets) != 1 || fake.got.Targets[0].Sector == nil || *fake.got.Targets[0].Sector != "Mineração" {
		t.Errorf("targets não repassados corretamente: %+v", fake.got.Targets)
	}
}

func TestHandleTriggerMacroEvent_Avulso(t *testing.T) {
	fake := &fakeMacroEventTriggerer{id: "event-2", event: macroevent.Event{Status: macroevent.StatusPendente}}

	body := `{
		"title": "título avulso",
		"narrative": "narrativa avulsa",
		"direction": "negativo",
		"magnitude_band": "leve",
		"affects_price": true,
		"affects_fundamentals": false,
		"targets": [{"asset_id": "asset-1"}]
	}`

	rec := postMacroEvent(t, fake, body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body.String())
	}

	if fake.got.Title == nil || *fake.got.Title != "título avulso" {
		t.Errorf("title não repassado: %v", fake.got.Title)
	}
	if fake.got.Direction == nil || *fake.got.Direction != macroevent.DirectionNegativo {
		t.Errorf("direction não repassado: %v", fake.got.Direction)
	}
	if fake.got.AffectsPrice == nil || !*fake.got.AffectsPrice {
		t.Errorf("affects_price não repassado: %v", fake.got.AffectsPrice)
	}
}

// TestHandleTriggerMacroEvent_DirecaoPropriaPorAlvo cobre a fronteira HTTP
// da tarefa E.1: `targets[].direction` do payload chega até
// macroeventtrigger.TargetInput.Direction, e Target.Direction/
// PriceEffectPct de volta do Service aparecem no item de `targets` da
// resposta (só quando o próprio Target os carrega, não os campos do
// evento).
func TestHandleTriggerMacroEvent_DirecaoPropriaPorAlvo(t *testing.T) {
	exportadorSector := catalog.Sector("Mineração")
	priceEffect := 8.2
	direction := macroevent.DirectionPositivo
	fake := &fakeMacroEventTriggerer{
		id: "event-3",
		event: macroevent.Event{
			Title:         "desvalorização do real",
			Narrative:     "narrativa",
			Direction:     macroevent.DirectionMisto,
			MagnitudeBand: macroevent.BandModerado,
			AffectsPrice:  true,
			Status:        macroevent.StatusPendente,
			Targets: []macroevent.Target{
				{Sector: &exportadorSector, AffectedMetric: macroevent.MetricPrice, Direction: &direction, PriceEffectPct: &priceEffect},
			},
		},
	}

	body := `{
		"title": "desvalorização do real",
		"narrative": "narrativa",
		"direction": "misto",
		"magnitude_band": "moderado",
		"affects_price": true,
		"affects_fundamentals": false,
		"targets": [{"sector": "Mineração", "direction": "positivo"}]
	}`

	rec := postMacroEvent(t, fake, body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusCreated, rec.Body.String())
	}

	if len(fake.got.Targets) != 1 || fake.got.Targets[0].Direction == nil || *fake.got.Targets[0].Direction != macroevent.DirectionPositivo {
		t.Fatalf("direction do alvo não repassada ao Service: %+v", fake.got.Targets)
	}

	var respBody macroEventResponse
	if err := json.NewDecoder(rec.Body).Decode(&respBody); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(respBody.Targets) != 1 {
		t.Fatalf("Targets = %+v, want 1", respBody.Targets)
	}
	target := respBody.Targets[0]
	if target.Direction == nil || *target.Direction != "positivo" {
		t.Errorf("target.Direction = %v, want \"positivo\"", target.Direction)
	}
	if target.PriceEffectPct == nil || *target.PriceEffectPct != 8.2 {
		t.Errorf("target.PriceEffectPct = %v, want 8.2", target.PriceEffectPct)
	}
}

func TestHandleTriggerMacroEvent_SemAlvoRetorna400(t *testing.T) {
	fake := &fakeMacroEventTriggerer{}
	rec := postMacroEvent(t, fake, `{"template_key":"legislacao-ambiental-mineracao","targets":[]}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleTriggerMacroEvent_CorpoInvalidoRetorna400(t *testing.T) {
	fake := &fakeMacroEventTriggerer{}
	rec := postMacroEvent(t, fake, `{ corpo quebrado`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestHandleTriggerMacroEvent_SemTriggerer(t *testing.T) {
	rec := postMacroEvent(t, nil, `{"template_key":"x","targets":[{"sector":"Mineração"}]}`)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusServiceUnavailable)
	}
}

func TestHandleTriggerMacroEvent_ErrosDeValidacaoRetornam400(t *testing.T) {
	tests := []struct {
		name string
		err  error
	}{
		{"template desconhecido", macroeventtrigger.ErrUnknownTemplate},
		{"campos obrigatórios ausentes", macroeventtrigger.ErrMissingFields},
		{"setor desconhecido", macroeventtrigger.ErrUnknownSector},
		{"alvo com escopo ambíguo", macroevent.ErrTargetScopeAmbiguous},
		{"banda desconhecida", macroevent.ErrUnknownBand},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeMacroEventTriggerer{err: tt.err}
			rec := postMacroEvent(t, fake, `{"template_key":"x","targets":[{"sector":"Mineração"}]}`)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusBadRequest, rec.Body.String())
			}
		})
	}
}

func TestHandleTriggerMacroEvent_ErroInternoRetorna500(t *testing.T) {
	fake := &fakeMacroEventTriggerer{err: errors.New("falha inesperada")}
	rec := postMacroEvent(t, fake, `{"template_key":"x","targets":[{"sector":"Mineração"}]}`)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusInternalServerError)
	}
}

func ptrTest[T any](v T) *T { return &v }
