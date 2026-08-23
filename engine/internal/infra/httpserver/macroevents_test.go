package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

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
	New("", nil, nil, nil, nil, nil, triggerer).Handler.ServeHTTP(rec, req)
	return rec
}

func TestHandleTriggerMacroEvent_ComTemplate(t *testing.T) {
	priceEffect := -10.5
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
