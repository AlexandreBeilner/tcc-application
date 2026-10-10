package httpserver

import (
	"errors"
	"net/http"
	"time"

	"tcc-investimentos/engine/internal/domain/integrity"
)

// Integridade financeira (tarefa N.21). Mesmo trust boundary das outras rotas /admin/*: o
// backend valida role = admin. A verificação roda em segundo plano (pode levar mais que
// alguns segundos numa base grande): POST abre e responde 202; GET devolve a última.

// integrityChecker é o que as rotas precisam — *integrity.Service.
type integrityChecker interface {
	Start() (integrity.Run, error)
	Latest() (integrity.Run, bool)
}

// WithIntegrity liga as rotas de integridade; sem ela respondem 503.
func WithIntegrity(c integrityChecker) Option {
	return func(o *options) { o.integrity = c }
}

type integrityDivergenceResponse struct {
	Kind     string  `json:"kind"`
	UserID   *string `json:"user_id"`
	AssetID  *string `json:"asset_id"`
	Ticker   *string `json:"ticker"`
	OrderID  *string `json:"order_id"`
	Expected string  `json:"expected"`
	Found    string  `json:"found"`
	Detail   string  `json:"detail"`
}

type integrityCheckedResponse struct {
	Events        int `json:"events"`
	Accounts      int `json:"accounts"`
	Positions     int `json:"positions"`
	Assets        int `json:"assets"`
	RestingOrders int `json:"resting_orders"`
}

type integrityReportResponse struct {
	Checked     integrityCheckedResponse      `json:"checked"`
	Total       int                           `json:"total"`
	Counts      map[string]int                `json:"counts"`
	Truncated   bool                          `json:"truncated"`
	Divergences []integrityDivergenceResponse `json:"divergences"`
}

type integrityRunResponse struct {
	ID         string                   `json:"id"`
	Status     string                   `json:"status"`
	StartedAt  time.Time                `json:"started_at"`
	FinishedAt *time.Time               `json:"finished_at"`
	Error      *string                  `json:"error"`
	Report     *integrityReportResponse `json:"report"`
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func toIntegrityRunResponse(run integrity.Run) integrityRunResponse {
	resp := integrityRunResponse{
		ID: run.ID, Status: string(run.Status), StartedAt: run.StartedAt, FinishedAt: run.FinishedAt, Error: optional(run.Error),
	}
	if run.Report != nil {
		counts := map[string]int{}
		for _, kind := range integrity.AllKinds {
			// Toda categoria aparece, mesmo com zero: o painel mostra a lista inteira.
			counts[string(kind)] = run.Report.Counts[kind]
		}
		divergences := make([]integrityDivergenceResponse, 0, len(run.Report.Divergences))
		for _, d := range run.Report.Divergences {
			divergences = append(divergences, integrityDivergenceResponse{
				Kind: string(d.Kind), UserID: optional(d.UserID), AssetID: optional(d.AssetID), Ticker: optional(d.Ticker),
				OrderID: optional(d.OrderID), Expected: d.Expected, Found: d.Found, Detail: d.Detail,
			})
		}
		c := run.Report.Checked
		resp.Report = &integrityReportResponse{
			Checked: integrityCheckedResponse{Events: c.Events, Accounts: c.Accounts, Positions: c.Positions, Assets: c.Assets, RestingOrders: c.RestingOrders},
			Total:   run.Report.Total, Counts: counts, Truncated: run.Report.Truncated, Divergences: divergences,
		}
	}
	return resp
}

// handleAdminIntegrityStart serve POST /admin/integrity/check: abre uma verificação.
func handleAdminIntegrityStart(c integrityChecker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if c == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "verificação de integridade indisponível")
			return
		}
		run, err := c.Start()
		if errors.Is(err, integrity.ErrAlreadyRunning) {
			writeCatalogError(w, http.StatusConflict, err.Error())
			return
		}
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao iniciar a verificação")
			return
		}
		writeJSON(w, http.StatusAccepted, toIntegrityRunResponse(run))
	}
}

// handleAdminIntegrityLatest serve GET /admin/integrity/check: a última verificação, ou
// `{"run": null}` se nenhuma rodou desde a subida do motor.
func handleAdminIntegrityLatest(c integrityChecker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if c == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "verificação de integridade indisponível")
			return
		}
		run, ok := c.Latest()
		if !ok {
			writeJSON(w, http.StatusOK, map[string]any{"run": nil})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"run": toIntegrityRunResponse(run)})
	}
}
