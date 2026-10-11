package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"tcc-investimentos/engine/internal/domain/corporategovernance"
)

// Governança corporativa (MO.6.2): lado do motor da Assembleia de Acionistas. Mesmo trust
// boundary das outras rotas internas: só o backend as chama, o motor não é exposto ao
// navegador (gateway). O backend é dono do ciclo da assembleia; o motor só tira o snapshot de
// posições, registra a decisão como evento e aplica o efeito aos poucos.

// governanceManager é o que as rotas precisam — *corporategovernance.Service.
type governanceManager interface {
	TakeSnapshot(ctx context.Context, assemblyID, companyID string) (corporategovernance.Snapshot, bool, error)
	GetSnapshot(ctx context.Context, assemblyID string) (corporategovernance.Snapshot, bool, error)
	RecordDecision(ctx context.Context, in corporategovernance.DecisionInput) (corporategovernance.Decision, bool, error)
	GetDecision(ctx context.Context, assemblyID string) (corporategovernance.Decision, bool, error)
}

// WithGovernance liga as rotas /governance; sem ela respondem 503.
func WithGovernance(m governanceManager) Option {
	return func(o *options) { o.governance = m }
}

type snapshotHoldingResponse struct {
	UserID   string `json:"user_id"`
	Quantity int64  `json:"quantity"`
}

type snapshotResponse struct {
	AssemblyID   string                    `json:"assembly_id"`
	CompanyID    string                    `json:"company_id"`
	TakenAt      time.Time                 `json:"taken_at"`
	SimulatedDay int                       `json:"simulated_day"`
	Holdings     []snapshotHoldingResponse `json:"holdings"`
}

func toSnapshotResponse(s corporategovernance.Snapshot) snapshotResponse {
	holdings := make([]snapshotHoldingResponse, 0, len(s.Holdings))
	for _, h := range s.Holdings {
		holdings = append(holdings, snapshotHoldingResponse{UserID: h.UserID, Quantity: h.Quantity})
	}
	return snapshotResponse{
		AssemblyID: s.AssemblyID, CompanyID: s.CompanyID, TakenAt: s.TakenAt.UTC(),
		SimulatedDay: s.SimulatedDay, Holdings: holdings,
	}
}

type decisionEffectRequest struct {
	Metric    string  `json:"metric"`
	Direction int     `json:"direction"`
	Intensity float64 `json:"intensity"`
}

type decisionRequest struct {
	AssemblyID string                `json:"assembly_id"`
	CompanyID  string                `json:"company_id"`
	OptionKey  string                `json:"option_key"`
	Effect     decisionEffectRequest `json:"effect"`
}

type decisionResponse struct {
	AssemblyID   string                `json:"assembly_id"`
	CompanyID    string                `json:"company_id"`
	OptionKey    string                `json:"option_key"`
	Effect       decisionEffectRequest `json:"effect"`
	Status       string                `json:"status"`
	TotalDelta   int                   `json:"total_delta"`
	RampTicks    int                   `json:"ramp_ticks"`
	StartDay     int                   `json:"start_day"`
	AppliedTicks int                   `json:"applied_ticks"`
	AppliedDelta int                   `json:"applied_delta"`
	DecidedAt    time.Time             `json:"decided_at"`
}

func toDecisionResponse(d corporategovernance.Decision) decisionResponse {
	return decisionResponse{
		AssemblyID: d.AssemblyID, CompanyID: d.CompanyID, OptionKey: d.OptionKey,
		Effect: decisionEffectRequest{Metric: string(d.Metric), Direction: d.Direction, Intensity: d.Intensity},
		Status: string(d.Status), TotalDelta: d.TotalDelta, RampTicks: d.RampTicks, StartDay: d.StartDay,
		AppliedTicks: d.AppliedTicks, AppliedDelta: d.AppliedDelta, DecidedAt: d.DecidedAt.UTC(),
	}
}

func writeGovernanceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, corporategovernance.ErrInvalidInput):
		writeCatalogError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, corporategovernance.ErrUnknownCompany):
		writeCatalogError(w, http.StatusNotFound, "empresa não encontrada")
	default:
		writeCatalogError(w, http.StatusInternalServerError, "erro ao processar a governança")
	}
}

// handleGovernanceTakeSnapshot serve POST /governance/snapshots: tira o snapshot de posições
// da empresa na data de corte. Idempotente pelo id da assembleia (repetir devolve o mesmo).
func handleGovernanceTakeSnapshot(m governanceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "governança indisponível")
			return
		}
		var req struct {
			AssemblyID string `json:"assembly_id"`
			CompanyID  string `json:"company_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		if !uuidPattern.MatchString(req.AssemblyID) || !uuidPattern.MatchString(req.CompanyID) {
			writeCatalogError(w, http.StatusBadRequest, "assembly_id e company_id devem ser UUIDs válidos")
			return
		}
		snap, created, err := m.TakeSnapshot(r.Context(), req.AssemblyID, req.CompanyID)
		if err != nil {
			writeGovernanceError(w, err)
			return
		}
		status := http.StatusOK
		if created {
			status = http.StatusCreated
		}
		writeJSON(w, status, toSnapshotResponse(snap))
	}
}

// handleGovernanceGetSnapshot serve GET /governance/snapshots/{assembly_id}.
func handleGovernanceGetSnapshot(m governanceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "governança indisponível")
			return
		}
		id := r.PathValue("assembly_id")
		if !uuidPattern.MatchString(id) {
			writeCatalogError(w, http.StatusBadRequest, "assembly_id deve ser um UUID válido")
			return
		}
		snap, found, err := m.GetSnapshot(r.Context(), id)
		if err != nil {
			writeGovernanceError(w, err)
			return
		}
		if !found {
			writeCatalogError(w, http.StatusNotFound, "snapshot não encontrado")
			return
		}
		writeJSON(w, http.StatusOK, toSnapshotResponse(snap))
	}
}

// handleGovernanceRecordDecision serve POST /governance/decisions: registra a decisão de uma
// assembleia aprovada como evento imutável e agenda o efeito nos fundamentos. Idempotente
// pelo id da assembleia (repetir devolve a decisão original, sem novo evento).
func handleGovernanceRecordDecision(m governanceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "governança indisponível")
			return
		}
		var req decisionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		if !uuidPattern.MatchString(req.AssemblyID) || !uuidPattern.MatchString(req.CompanyID) {
			writeCatalogError(w, http.StatusBadRequest, "assembly_id e company_id devem ser UUIDs válidos")
			return
		}
		decision, created, err := m.RecordDecision(r.Context(), corporategovernance.DecisionInput{
			AssemblyID: req.AssemblyID, CompanyID: req.CompanyID, OptionKey: req.OptionKey,
			Effect: corporategovernance.Effect{
				Metric: corporategovernance.Metric(req.Effect.Metric), Direction: req.Effect.Direction, Intensity: req.Effect.Intensity,
			},
		})
		if err != nil {
			writeGovernanceError(w, err)
			return
		}
		status := http.StatusOK
		if created {
			status = http.StatusCreated
		}
		writeJSON(w, status, toDecisionResponse(decision))
	}
}

// handleGovernanceGetDecision serve GET /governance/decisions/{assembly_id}.
func handleGovernanceGetDecision(m governanceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "governança indisponível")
			return
		}
		id := r.PathValue("assembly_id")
		if !uuidPattern.MatchString(id) {
			writeCatalogError(w, http.StatusBadRequest, "assembly_id deve ser um UUID válido")
			return
		}
		decision, found, err := m.GetDecision(r.Context(), id)
		if err != nil {
			writeGovernanceError(w, err)
			return
		}
		if !found {
			writeCatalogError(w, http.StatusNotFound, "decisão não encontrada")
			return
		}
		writeJSON(w, http.StatusOK, toDecisionResponse(decision))
	}
}
