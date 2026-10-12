package httpserver

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"tcc-investimentos/engine/internal/domain/enginesetting"
)

// fakeSettings usa o Service real por cima de um repositório em memória, então a
// validação de faixa testada aqui é a do domínio, não uma cópia.
type memorySettingsRepo struct {
	rows map[enginesetting.Key]enginesetting.Override
}

func (m *memorySettingsRepo) Overrides(context.Context) (map[enginesetting.Key]enginesetting.Override, error) {
	return m.rows, nil
}

func (m *memorySettingsRepo) Save(_ context.Context, key enginesetting.Key, value int, by string) error {
	m.rows[key] = enginesetting.Override{Value: value, UpdatedBy: by, Version: m.rows[key].Version + 1}
	return nil
}

func (m *memorySettingsRepo) Delete(_ context.Context, key enginesetting.Key) error {
	delete(m.rows, key)
	return nil
}

func callSettings(t *testing.T, api *SettingsAPI, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var opts []Option
	if api != nil {
		opts = append(opts, WithSettings(api))
	}
	rec := httptest.NewRecorder()
	New("", nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, opts...).Handler.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

func newSettingsAPI() *SettingsAPI {
	svc := enginesetting.NewService(&memorySettingsRepo{rows: map[enginesetting.Key]enginesetting.Override{}}, enginesetting.Values{TicksPerDay: 5, MaxCatchUp: 3})
	return &SettingsAPI{Manager: svc, Seed: 42}
}

func TestSettings_RotasRespondem503SemServico(t *testing.T) {
	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/admin/settings"},
		{http.MethodPut, "/admin/settings/ticks_per_day"},
		{http.MethodDelete, "/admin/settings/ticks_per_day"},
	} {
		if rec := callSettings(t, nil, tc.method, tc.path, `{}`); rec.Code != http.StatusServiceUnavailable {
			t.Errorf("%s %s sem serviço = %d, want 503", tc.method, tc.path, rec.Code)
		}
	}
}

func TestSettings_ListaEditaveisESomenteLeitura(t *testing.T) {
	rec := callSettings(t, newSettingsAPI(), http.MethodGet, "/admin/settings", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", rec.Code, rec.Body)
	}
	var resp struct {
		Editable []editableSettingResponse `json:"editable"`
		ReadOnly []readOnlySettingResponse `json:"read_only"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Editable) != 15 || resp.Editable[0].Key != "ticks_per_day" || resp.Editable[0].Value != 5 || resp.Editable[0].Overridden {
		t.Errorf("editáveis = %+v", resp.Editable)
	}
	if len(resp.ReadOnly) == 0 || resp.ReadOnly[0].Key != "simulation_seed" || resp.ReadOnly[0].Value != "42" {
		t.Errorf("somente leitura = %+v", resp.ReadOnly)
	}
	for _, ro := range resp.ReadOnly {
		for _, ed := range resp.Editable {
			if ro.Key == ed.Key {
				t.Errorf("%s aparece como editável e somente leitura", ro.Key)
			}
		}
	}
}

func TestSettings_PutValidaEGrava(t *testing.T) {
	admin := `"admin_id":"` + validUserID + `"`
	tests := []struct {
		name, path, body string
		want             int
	}{
		{"grava valor válido", "/admin/settings/ticks_per_day", `{"value":12,` + admin + `}`, http.StatusOK},
		{"fora da faixa", "/admin/settings/ticks_per_day", `{"value":99,` + admin + `}`, http.StatusUnprocessableEntity},
		{"chave somente leitura não edita", "/admin/settings/initial_capital", `{"value":1,` + admin + `}`, http.StatusNotFound},
		{"sem valor", "/admin/settings/max_catch_up", `{` + admin + `}`, http.StatusBadRequest},
		{"sem admin", "/admin/settings/max_catch_up", `{"value":4}`, http.StatusBadRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if rec := callSettings(t, newSettingsAPI(), http.MethodPut, tt.path, tt.body); rec.Code != tt.want {
				t.Errorf("status = %d, want %d: %s", rec.Code, tt.want, rec.Body)
			}
		})
	}
}

func TestSettings_PutEDeleteMudamOValorVigente(t *testing.T) {
	api := newSettingsAPI()
	callSettings(t, api, http.MethodPut, "/admin/settings/ticks_per_day", `{"value":12,"admin_id":"`+validUserID+`"}`)
	cur, _ := api.Manager.(*enginesetting.Service).Current(context.Background())
	if cur.TicksPerDay != 12 {
		t.Fatalf("depois do PUT = %+v", cur)
	}
	rec := callSettings(t, api, http.MethodDelete, "/admin/settings/ticks_per_day", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("DELETE = %d: %s", rec.Code, rec.Body)
	}
	cur, _ = api.Manager.(*enginesetting.Service).Current(context.Background())
	if cur.TicksPerDay != 5 {
		t.Errorf("depois do DELETE = %+v, want padrão", cur)
	}
	if rec := callSettings(t, api, http.MethodDelete, "/admin/settings/xyz", ""); rec.Code != http.StatusNotFound {
		t.Errorf("DELETE de chave desconhecida = %d", rec.Code)
	}
}
