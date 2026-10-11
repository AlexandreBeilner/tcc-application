package corporategovernance

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"tcc-investimentos/engine/internal/domain/enginesetting"
)

type fakeSettings struct{ values enginesetting.Values }

func (f fakeSettings) Current(context.Context) (enginesetting.Values, error) { return f.values, nil }

type fakeRepo struct {
	company   CompanyState
	decisions map[string]*Decision
	events    []string // ids de assembleia, um por efeito, na ordem em que o evento foi gravado
	knob      map[Metric]int
	failApply map[string]bool
	standing  *StandingRecord
	pending   []Pending
}

func newFakeRepo(c CompanyState) *fakeRepo {
	return &fakeRepo{company: c, decisions: map[string]*Decision{}, knob: map[Metric]int{
		MetricBaseGrowthPct: c.BaseGrowthPct, MetricQualityMultiplier: c.QualityMultiplier, MetricPayoutRatioPct: c.PayoutRatioPct,
	}}
}

func (r *fakeRepo) TakeSnapshot(context.Context, string, string) (Snapshot, bool, error) {
	return Snapshot{}, false, nil
}
func (r *fakeRepo) GetSnapshot(context.Context, string) (Snapshot, bool, error) {
	return Snapshot{}, false, nil
}
func (r *fakeRepo) GetDecision(_ context.Context, id string) (Decision, bool, error) {
	d, ok := r.decisions[id]
	if !ok {
		return Decision{}, false, nil
	}
	return *d, true, nil
}

func (r *fakeRepo) RecordDecision(_ context.Context, in DecisionInput, plan PlanFunc) (Decision, bool, error) {
	if d, ok := r.decisions[in.AssemblyID]; ok {
		return *d, false, nil
	}
	plans, err := plan(r.company)
	if err != nil {
		return Decision{}, false, err
	}
	d := &Decision{ID: "dec-" + in.AssemblyID, AssemblyID: in.AssemblyID, CompanyID: in.CompanyID, OptionKey: in.OptionKey}
	for i, e := range in.Effects {
		p := plans[i]
		// Evento antes de qualquer efeito, uma linha por efeito.
		r.events = append(r.events, in.AssemblyID)
		d.Effects = append(d.Effects, EffectRecord{
			ID: fmt.Sprintf("%s-%d", d.ID, i), AssemblyID: in.AssemblyID, Position: i,
			Metric: e.Metric, Direction: e.Direction, Intensity: e.Intensity,
			Status: p.Status, TotalDelta: p.TotalDelta, RampTicks: p.RampTicks, StartDay: p.StartDay,
		})
		if p.Status == StatusScheduled {
			if r.company.LastStartDay == nil {
				r.company.LastStartDay = map[Group]int{}
			}
			r.company.LastStartDay[GroupOf(e.Metric)] = p.StartDay
		}
	}
	r.decisions[in.AssemblyID] = d
	return *d, true, nil
}

func (r *fakeRepo) CompanyStanding(context.Context, string, string) (StandingRecord, bool, error) {
	if r.standing == nil {
		return StandingRecord{}, false, nil
	}
	return *r.standing, true, nil
}

func (r *fakeRepo) ListPending(context.Context) ([]Pending, error) { return r.pending, nil }

func (r *fakeRepo) RequestRelease(_ context.Context, id string, reason ReleaseReason) error {
	for i := range r.pending {
		if r.pending[i].ID == id {
			if !r.pending[i].ReleaseRequested {
				r.pending[i].ReleaseRequested, r.pending[i].ReleaseReason = true, reason
			}
			return nil
		}
	}
	return ErrUnknownDeclaration
}

func (r *fakeRepo) ListScheduled(context.Context) ([]EffectRecord, error) {
	var out []EffectRecord
	for _, d := range r.decisions {
		for _, e := range d.Effects {
			if e.Status == StatusScheduled {
				out = append(out, e)
			}
		}
	}
	return out, nil
}

func (r *fakeRepo) ApplyStep(_ context.Context, id string, prev int, step StepApplication, _ Limits) (bool, error) {
	for _, d := range r.decisions {
		for i := range d.Effects {
			e := &d.Effects[i]
			if e.ID != id {
				continue
			}
			if r.failApply[d.AssemblyID] {
				return false, errors.New("falha de banco")
			}
			if e.AppliedTicks != prev {
				return false, nil
			}
			r.knob[e.Metric] += step.Delta
			e.AppliedTicks, e.AppliedDelta = step.AppliedTicks, e.AppliedDelta+step.Delta
			if step.Done {
				e.Status = StatusCompleted
			}
			return true, nil
		}
	}
	return false, nil
}

func newService(c CompanyState, ramp int) (*Service, *fakeRepo) {
	repo := newFakeRepo(c)
	values := enginesetting.Values{
		GovernanceGrowthStepCentiPP: 50, GovernanceQualityStepCenti: 5,
		GovernanceRampTicks: ramp, GovernanceCooldownDays: 90,
		GovernancePayoutStepCentiPP: 1000, GovernancePayoutMinPct: 20, GovernancePayoutMaxPct: 90, GovernancePayoutCooldownDays: 90,
		GovernanceHoldDeclarations: 1, GovernanceDeclarationSafetyDays: 60,
		GovernancePremiumStepCentiPP: 500, GovernancePremiumMinPct: 10, GovernancePremiumMaxPct: 30,
	}
	return NewService(repo, fakeSettings{values}), repo
}

var growthUp = Effect{MetricBaseGrowthPct, 1, 1, ""}
var payoutDown = Effect{MetricPayoutRatioPct, -1, 1, ""}

func TestService_RecordDecision_IdempotentePelaAssembleia(t *testing.T) {
	svc, repo := newService(CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, Today: 10}, 10)
	ctx := context.Background()
	in := DecisionInput{AssemblyID: "a1", CompanyID: "c1", OptionKey: "reinvestir", Effects: []Effect{growthUp}}

	first, created, err := svc.RecordDecision(ctx, in)
	if err != nil || !created {
		t.Fatalf("primeira chamada: created=%v err=%v", created, err)
	}
	again, created, err := svc.RecordDecision(ctx, in)
	if err != nil || created {
		t.Fatalf("segunda chamada: created=%v err=%v", created, err)
	}
	if again.ID != first.ID || len(repo.events) != 1 {
		t.Errorf("repetir não pode gerar outro evento: eventos=%d", len(repo.events))
	}
	if repo.knob[MetricBaseGrowthPct] != 300 {
		t.Errorf("registrar a decisão não pode mexer no fundamento: %d", repo.knob[MetricBaseGrowthPct])
	}
}

func TestService_RecordDecision_Validacao(t *testing.T) {
	svc, repo := newService(CompanyState{}, 10)
	for name, in := range map[string]DecisionInput{
		"sem assembleia":  {CompanyID: "c", OptionKey: "o", Effects: []Effect{growthUp}},
		"sem empresa":     {AssemblyID: "a", OptionKey: "o", Effects: []Effect{growthUp}},
		"sem opção":       {AssemblyID: "a", CompanyID: "c", Effects: []Effect{growthUp}},
		"sem efeito":      {AssemblyID: "a", CompanyID: "c", OptionKey: "o"},
		"mesma alavanca":  {AssemblyID: "a", CompanyID: "c", OptionKey: "o", Effects: []Effect{growthUp, {MetricBaseGrowthPct, -1, 1, ""}}},
		"efeito inválido": {AssemblyID: "a", CompanyID: "c", OptionKey: "o", Effects: []Effect{{"price", 1, 1, ""}}},
	} {
		t.Run(name, func(t *testing.T) {
			_, _, err := svc.RecordDecision(context.Background(), in)
			if !errors.Is(err, ErrInvalidInput) {
				t.Errorf("erro = %v, esperado ErrInvalidInput", err)
			}
		})
	}
	if len(repo.events) != 0 {
		t.Error("entrada inválida não pode gravar evento")
	}
}

func TestService_ApplyDue_RampaGradualFechaNoTotal(t *testing.T) {
	svc, repo := newService(CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, Today: 10}, 10)
	ctx := context.Background()
	if _, _, err := svc.RecordDecision(ctx, DecisionInput{AssemblyID: "a1", CompanyID: "c1", OptionKey: "o", Effects: []Effect{growthUp}}); err != nil {
		t.Fatal(err)
	}

	// Dia 11 é o primeiro tick (efeito começa no tick seguinte à decisão).
	for day := 11; day <= 20; day++ {
		n, err := svc.ApplyDue(ctx, day)
		if err != nil || n != 1 {
			t.Fatalf("dia %d: aplicados=%d err=%v", day, n, err)
		}
		want := 300 + CumulativeDelta(50, 10, day-10)
		if repo.knob[MetricBaseGrowthPct] != want {
			t.Fatalf("dia %d: fundamento = %d, esperado %d", day, repo.knob[MetricBaseGrowthPct], want)
		}
	}
	if repo.knob[MetricBaseGrowthPct] != 350 {
		t.Errorf("fundamento final = %d, esperado 350", repo.knob[MetricBaseGrowthPct])
	}
	if repo.decisions["a1"].Effects[0].Status != StatusCompleted {
		t.Errorf("status = %s", repo.decisions["a1"].Effects[0].Status)
	}
	// Depois de concluída, nada mais acontece.
	if n, _ := svc.ApplyDue(ctx, 21); n != 0 || repo.knob[MetricBaseGrowthPct] != 350 {
		t.Errorf("rodar de novo não pode mexer: n=%d valor=%d", n, repo.knob[MetricBaseGrowthPct])
	}
}

func TestService_ApplyDue_RecuperacaoEmLoteIgualPassoAPasso(t *testing.T) {
	run := func(days []int) int {
		svc, repo := newService(CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, Today: 10}, 10)
		ctx := context.Background()
		_, _, _ = svc.RecordDecision(ctx, DecisionInput{AssemblyID: "a1", CompanyID: "c1", OptionKey: "o", Effects: []Effect{growthUp}})
		for _, d := range days {
			if _, err := svc.ApplyDue(ctx, d); err != nil {
				t.Fatal(err)
			}
		}
		return repo.knob[MetricBaseGrowthPct]
	}
	oneByOne := run([]int{11, 12, 13, 14, 15, 16, 17, 18, 19, 20})
	catchUp := run([]int{13, 20}) // motor parado e recuperando em lote
	if oneByOne != catchUp || oneByOne != 350 {
		t.Errorf("passo a passo=%d, em lote=%d, esperado 350 nos dois", oneByOne, catchUp)
	}
}

func TestService_ApplyDue_CooldownNaoAplicaNada(t *testing.T) {
	svc, repo := newService(CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, Today: 10, LastStartDay: map[Group]int{GroupFundamentals: 5}}, 10)
	ctx := context.Background()
	d, created, err := svc.RecordDecision(ctx, DecisionInput{AssemblyID: "a1", CompanyID: "c1", OptionKey: "o", Effects: []Effect{growthUp}})
	if err != nil || !created {
		t.Fatalf("created=%v err=%v", created, err)
	}
	if d.Effects[0].Status != StatusSkippedCooldown || len(repo.events) != 1 {
		t.Errorf("status=%s eventos=%d (a decisão fica registrada mesmo sem efeito)", d.Effects[0].Status, len(repo.events))
	}
	if n, _ := svc.ApplyDue(ctx, 11); n != 0 || repo.knob[MetricBaseGrowthPct] != 300 {
		t.Errorf("cooldown não pode mudar nada: n=%d valor=%d", n, repo.knob[MetricBaseGrowthPct])
	}
}

func TestService_ApplyDue_FalhaDeUmaNaoImpedeAsOutras(t *testing.T) {
	svc, repo := newService(CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, Today: 10}, 10)
	ctx := context.Background()
	_, _, _ = svc.RecordDecision(ctx, DecisionInput{AssemblyID: "a1", CompanyID: "c1", OptionKey: "o", Effects: []Effect{growthUp}})
	// Segunda decisão de outra métrica, em outra "empresa" (o fake guarda uma só; zera o cooldown).
	repo.company.LastStartDay = nil
	_, _, _ = svc.RecordDecision(ctx, DecisionInput{AssemblyID: "a2", CompanyID: "c2", OptionKey: "o", Effects: []Effect{{MetricQualityMultiplier, 1, 1, ""}}})
	repo.failApply = map[string]bool{"a1": true}

	n, err := svc.ApplyDue(ctx, 11)
	if err == nil {
		t.Error("esperava o erro da decisão que falhou")
	}
	if n != 1 || repo.knob[MetricQualityMultiplier] == 100 {
		t.Errorf("a outra decisão deveria ter aplicado: n=%d qualidade=%d", n, repo.knob[MetricQualityMultiplier])
	}
}

// Decisão composta: um evento por efeito, os dois aplicados, e o payout vale inteiro no
// primeiro tick (sem rampa) enquanto o crescimento segue a rampa.
func TestService_DecisaoComposta(t *testing.T) {
	svc, repo := newService(CompanyState{BaseGrowthPct: 300, QualityMultiplier: 100, PayoutRatioPct: 5000, Today: 10}, 10)
	ctx := context.Background()
	in := DecisionInput{AssemblyID: "a1", CompanyID: "c1", OptionKey: "reinvestir", Effects: []Effect{payoutDown, growthUp}}
	d, created, err := svc.RecordDecision(ctx, in)
	if err != nil || !created || len(d.Effects) != 2 {
		t.Fatalf("created=%v err=%v efeitos=%d", created, err, len(d.Effects))
	}
	if len(repo.events) != 2 {
		t.Errorf("um evento por efeito: %d", len(repo.events))
	}
	if repo.knob[MetricPayoutRatioPct] != 5000 || repo.knob[MetricBaseGrowthPct] != 300 {
		t.Fatal("registrar a decisão não pode mexer em nada")
	}

	if n, err := svc.ApplyDue(ctx, 11); err != nil || n != 2 {
		t.Fatalf("primeiro tick: aplicados=%d err=%v", n, err)
	}
	if repo.knob[MetricPayoutRatioPct] != 4000 {
		t.Errorf("payout = %d, esperado 4000 já no primeiro tick", repo.knob[MetricPayoutRatioPct])
	}
	if repo.knob[MetricBaseGrowthPct] != 305 {
		t.Errorf("crescimento = %d, esperado 305 (1/10 da rampa)", repo.knob[MetricBaseGrowthPct])
	}
	for day := 12; day <= 20; day++ {
		if _, err := svc.ApplyDue(ctx, day); err != nil {
			t.Fatal(err)
		}
	}
	if repo.knob[MetricBaseGrowthPct] != 350 || repo.knob[MetricPayoutRatioPct] != 4000 {
		t.Errorf("final: crescimento=%d payout=%d", repo.knob[MetricBaseGrowthPct], repo.knob[MetricPayoutRatioPct])
	}
	// Repetir a decisão não gera evento nem efeito novo.
	if _, created, _ := svc.RecordDecision(ctx, in); created || len(repo.events) != 2 {
		t.Errorf("idempotência: created=%v eventos=%d", created, len(repo.events))
	}
}
