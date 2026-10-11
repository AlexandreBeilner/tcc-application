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
	ListPending(ctx context.Context) ([]corporategovernance.PendingView, error)
	RequestRelease(ctx context.Context, id string, reason corporategovernance.ReleaseReason) error
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
	// Value é o valor-alvo do efeito discreto (política de dividendo).
	Value string `json:"value,omitempty"`
}

// decisionRequest aceita `effects` (de 1 a 2, alavancas diferentes) ou, por compatibilidade
// com o formato anterior, um `effect` único.
type decisionRequest struct {
	AssemblyID string `json:"assembly_id"`
	CompanyID  string `json:"company_id"`
	OptionKey  string `json:"option_key"`
	// DeclarationID liga a decisão à declaração de dividendo retida da empresa (opcional).
	DeclarationID string                  `json:"declaration_id"`
	Effect        *decisionEffectRequest  `json:"effect"`
	Effects       []decisionEffectRequest `json:"effects"`
}

func (r decisionRequest) effects() []corporategovernance.Effect {
	reqs := r.Effects
	if len(reqs) == 0 && r.Effect != nil {
		reqs = []decisionEffectRequest{*r.Effect}
	}
	out := make([]corporategovernance.Effect, 0, len(reqs))
	for _, e := range reqs {
		out = append(out, corporategovernance.Effect{Metric: corporategovernance.Metric(e.Metric), Direction: e.Direction, Intensity: e.Intensity, Value: e.Value})
	}
	return out
}

type decisionEffectResponse struct {
	Metric       string  `json:"metric"`
	Direction    int     `json:"direction"`
	Intensity    float64 `json:"intensity"`
	Value        string  `json:"value,omitempty"`
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
			Metric: string(e.Metric), Direction: e.Direction, Intensity: e.Intensity, Value: e.TargetValue, Status: string(e.Status),
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
	case errors.Is(err, corporategovernance.ErrUnknownDeclaration):
		writeCatalogError(w, http.StatusNotFound, "declaração não encontrada")
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
		if req.DeclarationID != "" && !uuidPattern.MatchString(req.DeclarationID) {
			writeCatalogError(w, http.StatusBadRequest, "declaration_id deve ser um UUID válido")
			return
		}
		decision, created, err := m.RecordDecision(r.Context(), corporategovernance.DecisionInput{
			AssemblyID: req.AssemblyID, CompanyID: req.CompanyID, OptionKey: req.OptionKey, Effects: req.effects(), DeclarationID: req.DeclarationID,
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

type pendingDeclarationResponse struct {
	ID                string   `json:"id"`
	CompanyID         string   `json:"company_id"`
	Name              string   `json:"name"`
	Sector            string   `json:"sector"`
	Tickers           []string `json:"tickers"`
	CycleIndex        int      `json:"cycle_index"`
	ReportDay         int      `json:"report_day"`
	HeldDay           int      `json:"held_day"`
	DaysHeld          int      `json:"days_held"`
	SafetyDeadlineDay int      `json:"safety_deadline_day"`
	// DecisionAssemblyID é a assembleia cuja decisão já foi ligada à declaração, se houver.
	DecisionAssemblyID *string `json:"decision_assembly_id"`
	ReleaseRequested   bool    `json:"release_requested"`
	ReleaseReason      string  `json:"release_reason,omitempty"`
}

// handleGovernancePendingDeclarations serve GET /governance/pending-declarations: as
// declarações de dividendo retidas, para o backend abrir a assembleia de destinação do lucro.
// Não devolve o lucro do pool (o backend não precisa dele).
func handleGovernancePendingDeclarations(m governanceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "governança indisponível")
			return
		}
		pendings, err := m.ListPending(r.Context())
		if err != nil {
			writeGovernanceError(w, err)
			return
		}
		out := make([]pendingDeclarationResponse, 0, len(pendings))
		for _, p := range pendings {
			out = append(out, pendingDeclarationResponse{
				ID: p.ID, CompanyID: p.CompanyID, Name: p.Name, Sector: p.Sector, Tickers: p.Tickers,
				CycleIndex: p.CycleIndex, ReportDay: p.ReportDay, HeldDay: p.HeldDay, DaysHeld: p.DaysHeld, SafetyDeadlineDay: p.SafetyDeadlineDay,
				DecisionAssemblyID: p.DecisionAssemblyID, ReleaseRequested: p.ReleaseRequested, ReleaseReason: string(p.ReleaseReason),
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"declarations": out})
	}
}

// handleGovernanceReleaseDeclaration serve POST /governance/pending-declarations/{id}/release:
// pede a liberação de uma declaração retida (a assembleia fechou sem decisão, o recurso está
// desligado ou pausado, ou o painel liberou). O dividendo sai no próximo tick com o payout
// vigente. Idempotente.
func handleGovernanceReleaseDeclaration(m governanceManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "governança indisponível")
			return
		}
		id := r.PathValue("id")
		if !uuidPattern.MatchString(id) {
			writeCatalogError(w, http.StatusBadRequest, "id deve ser um UUID válido")
			return
		}
		var req struct {
			Reason string `json:"reason"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeCatalogError(w, http.StatusBadRequest, "corpo da requisição inválido")
			return
		}
		if err := m.RequestRelease(r.Context(), id, corporategovernance.ReleaseReason(req.Reason)); err != nil {
			writeGovernanceError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "release_requested": true})
	}
}
