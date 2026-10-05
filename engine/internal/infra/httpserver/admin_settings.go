package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"tcc-investimentos/engine/internal/domain/account"
	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/enginesetting"
	"tcc-investimentos/engine/internal/domain/orderexecution"
	"tcc-investimentos/engine/internal/domain/selic"
	"tcc-investimentos/engine/internal/domain/tick"
)

// Parâmetros de simulação do painel (tarefa N.7). Mesmo trust boundary de POST
// /admin/tick: o backend valida role = admin e informa o admin_id. Só os parâmetros de
// ritmo são editáveis; o resto aparece como somente leitura (decisão do autor, achado 029).

// settingsManager é o que as rotas precisam — *enginesetting.Service.
type settingsManager interface {
	List(ctx context.Context) ([]enginesetting.Setting, error)
	Set(ctx context.Context, key enginesetting.Key, value int, updatedBy string) error
	Reset(ctx context.Context, key enginesetting.Key) error
}

// SettingsAPI agrupa o serviço e o que só o processo sabe (a semente vem do ambiente).
type SettingsAPI struct {
	Manager settingsManager
	Seed    int64
}

// WithSettings liga as rotas /admin/settings; sem ela respondem 503.
func WithSettings(api *SettingsAPI) Option {
	return func(o *options) { o.settings = api }
}

type editableSettingResponse struct {
	Key        string     `json:"key"`
	Value      int        `json:"value"`
	Default    int        `json:"default"`
	Min        int        `json:"min"`
	Max        int        `json:"max"`
	Overridden bool       `json:"overridden"`
	UpdatedBy  *string    `json:"updated_by"`
	UpdatedAt  *time.Time `json:"updated_at"`
	Version    int        `json:"version"`
}

type readOnlySettingResponse struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Reason string `json:"reason"`
}

func toEditableResponse(s enginesetting.Setting) editableSettingResponse {
	resp := editableSettingResponse{
		Key: string(s.Key), Value: s.Value, Default: s.Default, Min: s.Min, Max: s.Max,
		Overridden: s.Overriden, Version: s.Version,
	}
	if s.Overriden {
		by, at := s.UpdatedBy, s.UpdatedAt
		resp.UpdatedBy, resp.UpdatedAt = &by, &at
	}
	return resp
}

// readOnlySettings lista o que o painel mostra sem controle de edição, com o motivo.
func (api *SettingsAPI) readOnlySettings() []readOnlySettingResponse {
	pct := func(v float64) string { return strconv.FormatFloat(v*100, 'f', -1, 64) + "%" }
	return []readOnlySettingResponse{
		{"simulation_seed", strconv.FormatInt(api.Seed, 10), "Define a sequência aleatória do mercado; mudar quebra a reprodutibilidade (RNF08). Vem do ambiente."},
		{"initial_capital", "R$ " + strconv.FormatFloat(account.InitialBalance, 'f', 2, 64), "Capital inicial é igual pra toda conta nova (RNF06)."},
		{"copom_interval_days", strconv.Itoa(selic.CopomMeetingIntervalDays) + " dias simulados", "Constante de calendário do Copom."},
		{"max_spread_width_pct", pct(bot.MaxSpreadWidthPct), "Teto da largura de spread de um bot; invariante do domínio dos bots."},
		{"max_order_pct_of_volume", pct(tick.MaxOrderPctOfAverageVolumePct), "Teto do tamanho de ordem de bot sobre o volume recente; regra de liquidez do motor."},
		{"max_advance_days", strconv.Itoa(tick.MaxAdvanceDays) + " dias", "Teto do botão de avançar vários dias."},
		{"max_admin_cancel_batch", strconv.Itoa(orderexecution.MaxAdminCancelBatch) + " ordens", "Teto do cancelamento em lote do painel."},
	}
}

// handleAdminListSettings serve GET /admin/settings.
func handleAdminListSettings(api *SettingsAPI) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if api == nil || api.Manager == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "parâmetros indisponíveis")
			return
		}
		settings, err := api.Manager.List(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao ler os parâmetros")
			return
		}
		editable := make([]editableSettingResponse, 0, len(settings))
		for _, s := range settings {
			editable = append(editable, toEditableResponse(s))
		}
		writeJSON(w, http.StatusOK, map[string]any{"editable": editable, "read_only": api.readOnlySettings()})
	}
}

type setSettingRequest struct {
	Value   *int   `json:"value"`
	AdminID string `json:"admin_id"`
}

func writeSettingError(w http.ResponseWriter, err error) {
	var outOfRange *enginesetting.OutOfRangeError
	switch {
	case errors.As(err, &outOfRange):
		writeCatalogError(w, http.StatusUnprocessableEntity, outOfRange.Error())
	case errors.Is(err, enginesetting.ErrUnknownKey):
		writeCatalogError(w, http.StatusNotFound, err.Error())
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao gravar o parâmetro")
	}
}

// handleAdminSetSetting serve PUT /admin/settings/{key}: grava o valor depois de validar
// a faixa. 404 pra chave que não é editável, 422 pra valor fora da faixa.
func handleAdminSetSetting(api *SettingsAPI) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if api == nil || api.Manager == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "parâmetros indisponíveis")
			return
		}
		var req setSettingRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Value == nil {
			writeCatalogError(w, http.StatusBadRequest, "value é obrigatório e deve ser um inteiro")
			return
		}
		if !uuidPattern.MatchString(req.AdminID) {
			writeCatalogError(w, http.StatusBadRequest, "admin_id é obrigatório e deve ser um UUID válido")
			return
		}
		if err := api.Manager.Set(r.Context(), enginesetting.Key(r.PathValue("key")), *req.Value, req.AdminID); err != nil {
			writeSettingError(w, err)
			return
		}
		handleAdminListSettings(api)(w, r)
	}
}

// handleAdminResetSetting serve DELETE /admin/settings/{key}: volta ao padrão do ambiente.
func handleAdminResetSetting(api *SettingsAPI) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if api == nil || api.Manager == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "parâmetros indisponíveis")
			return
		}
		if err := api.Manager.Reset(r.Context(), enginesetting.Key(r.PathValue("key"))); err != nil {
			writeSettingError(w, err)
			return
		}
		handleAdminListSettings(api)(w, r)
	}
}
