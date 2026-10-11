package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
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
	RecentReports(ctx context.Context, minDays, maxDays int) (corporategovernance.ReportsResult, error)
	Standing(ctx context.Context, companyID, userID string) (corporategovernance.Standing, error)
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

// decisionRequest aceita `effects` (de 1 a 2, alavancas diferentes) ou, por compatibilidade
// com o formato anterior, um `effect` único.
type decisionRequest struct {
	AssemblyID string                  `json:"assembly_id"`
	CompanyID  string                  `json:"company_id"`
	OptionKey  string                  `json:"option_key"`
	Effect     *decisionEffectRequest  `json:"effect"`
	Effects    []decisionEffectRequest `json:"effects"`
}

func (r decisionRequest) effects() []corporategovernance.Effect {
	reqs := r.Effects
	if len(reqs) == 0 && r.Effect != nil {
		reqs = []decisionEffectRequest{*r.Effect}
	}
	out := make([]corporategovernance.Effect, 0, len(reqs))
	for _, e := range reqs {
		out = append(out, corporategovernance.Effect{Metric: corporategovernance.Metric(e.Metric), Direction: e.Direction, Intensity: e.Intensity})
	}
	return out
}

type decisionEffectResponse struct {
	Metric       string  `json:"metric"`
	Direction    int     `json:"direction"`
	Intensity    float64 `json:"intensity"`
	Status       string  `json:"status"`
	TotalDelta   int     `json:"total_delta"`
	RampTicks    int     `json:"ramp_ticks"`
	StartDay     int     `json:"start_day"`
	AppliedTicks int     `json:"applied_ticks"`
	AppliedDelta int     `json:"applied_delta"`
}

type decisionResponse struct {
	AssemblyID string                   `json:"assembly_id"`
	CompanyID  string                   `json:"company_id"`
	OptionKey  string                   `json:"option_key"`
	Effects    []decisionEffectResponse `json:"effects"`
	DecidedAt  time.Time                `json:"decided_at"`
}

func toDecisionResponse(d corporategovernance.Decision) decisionResponse {
	effects := make([]decisionEffectResponse, 0, len(d.Effects))
	for _, e := range d.Effects {
		effects = append(effects, decisionEffectResponse{
			Metric: string(e.Metric), Direction: e.Direction, Intensity: e.Intensity, Status: string(e.Status),
			TotalDelta: e.TotalDelta, RampTicks: e.RampTicks, StartDay: e.StartDay,
			AppliedTicks: e.AppliedTicks, AppliedDelta: e.AppliedDelta,
		})
	}
	return decisionResponse{
		AssemblyID: d.AssemblyID, CompanyID: d.CompanyID, OptionKey: d.OptionKey, Effects: effects, DecidedAt: d.DecidedAt.UTC(),
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
			AssemblyID: req.AssemblyID, CompanyID: req.CompanyID, OptionKey: req.OptionKey, Effects: req.effects(),
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

type companyReportResponse struct {
	CompanyID       string   `json:"company_id"`
	Name            string   `json:"name"`
	Sector          string   `json:"sector"`
	Tickers         []string `json:"tickers"`
	ReportDay       int      `json:"report_day"`
	DaysSinceReport int      `json:"days_since_report"`
}

type reportsResponse struct {
	SimulatedDay int                     `json:"simulated_day"`
	Reports      []companyReportResponse `json:"reports"`
}

// handleGovernanceReports serve GET /governance/reports?min_days=&max_days=: o último balanço
// já divulgado por empresa, quando saiu entre min_days e max_days dias antes do dia corrente.
// É o gatilho da abertura das assembleias (o backend pede "balanço de 2 a 9 dias atrás").
func handleGovernanceReports(m governanceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "governança indisponível")
			return
		}
		minDays, errMin := strconv.Atoi(r.URL.Query().Get("min_days"))
		maxDays, errMax := strconv.Atoi(r.URL.Query().Get("max_days"))
		if errMin != nil || errMax != nil {
			writeCatalogError(w, http.StatusBadRequest, "min_days e max_days devem ser inteiros")
			return
		}
		res, err := m.RecentReports(r.Context(), minDays, maxDays)
		if err != nil {
			writeGovernanceError(w, err)
			return
		}
		out := reportsResponse{SimulatedDay: res.SimulatedDay, Reports: make([]companyReportResponse, 0, len(res.Reports))}
		for _, rep := range res.Reports {
			out.Reports = append(out.Reports, companyReportResponse{
				CompanyID: rep.CompanyID, Name: rep.Name, Sector: rep.Sector, Tickers: rep.Tickers,
				ReportDay: rep.ReportDay, DaysSinceReport: rep.DaysSinceReport,
			})
		}
		writeJSON(w, http.StatusOK, out)
	}
}

type standingResponse struct {
	CompanyID        string `json:"company_id"`
	Name             string `json:"name"`
	Sector           string `json:"sector"`
	HoldsShares      bool   `json:"holds_shares"`
	CooldownDaysLeft int    `json:"cooldown_days_left"`
}

// handleGovernanceStanding serve GET /governance/companies/{company_id}/standing?user_id=: se a
// pessoa tem ações da empresa agora e quantos dias simulados faltam para o cooldown acabar. É o
// que o backend consulta antes de aceitar uma proposta ou um apoio de pauta.
func handleGovernanceStanding(m governanceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "governança indisponível")
			return
		}
		companyID, userID := r.PathValue("company_id"), r.URL.Query().Get("user_id")
		if !uuidPattern.MatchString(companyID) || !uuidPattern.MatchString(userID) {
			writeCatalogError(w, http.StatusBadRequest, "company_id e user_id devem ser UUIDs válidos")
			return
		}
		st, err := m.Standing(r.Context(), companyID, userID)
		if err != nil {
			writeGovernanceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, standingResponse{
			CompanyID: st.CompanyID, Name: st.Name, Sector: st.Sector,
			HoldsShares: st.HoldsShares, CooldownDaysLeft: st.CooldownDaysLeft,
		})
	}
}
