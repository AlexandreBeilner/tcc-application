package corporategovernance

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/enginesetting"
)

func TestShouldHold(t *testing.T) {
	on := HoldPolicy{Enabled: true, PayoutCooldownDays: 90, SafetyDays: 60}
	free := HoldCompany{HasUserShareholders: true, Today: 200}
	for name, tt := range map[string]struct {
		p    HoldPolicy
		c    HoldCompany
		want bool
	}{
		"empresa elegível retém":               {on, free, true},
		"retenção desligada nunca retém":       {HoldPolicy{PayoutCooldownDays: 90}, free, false},
		"sem acionista de usuário paga normal": {on, HoldCompany{Today: 200}, false},
		"já tem declaração retida":             {on, HoldCompany{HasUserShareholders: true, HasHeld: true, Today: 200}, false},
		"payout em cooldown paga normal":       {on, HoldCompany{HasUserShareholders: true, LastPayoutStartDay: intPtr(150), Today: 200}, false},
		"cooldown do payout acabou":            {on, HoldCompany{HasUserShareholders: true, LastPayoutStartDay: intPtr(110), Today: 200}, true},
		"cooldown zero desliga a trava":        {HoldPolicy{Enabled: true}, HoldCompany{HasUserShareholders: true, LastPayoutStartDay: intPtr(199), Today: 200}, true},
	} {
		t.Run(name, func(t *testing.T) {
			if got := ShouldHold(tt.p, tt.c); got != tt.want {
				t.Errorf("ShouldHold = %v, esperado %v", got, tt.want)
			}
		})
	}
}

func TestReleaseReasonFor(t *testing.T) {
	assembly := "a1"
	base := Pending{HeldDay: 100}
	for name, tt := range map[string]struct {
		p          Pending
		today      int
		wantOK     bool
		wantReason ReleaseReason
	}{
		"nada resolvido, dentro do prazo":             {base, 150, false, ""},
		"no último dia antes do prazo":                {base, 159, false, ""},
		"prazo de segurança vencido":                  {base, 160, true, ReleaseExpired},
		"liberação pedida sem decisão":                {Pending{HeldDay: 100, ReleaseRequested: true, ReleaseReason: ReleaseNoDecision}, 101, true, ReleaseNoDecision},
		"liberação do painel":                         {Pending{HeldDay: 100, ReleaseRequested: true, ReleaseReason: ReleaseAdmin}, 101, true, ReleaseAdmin},
		"decisão ligada com payout ainda por aplicar": {Pending{HeldDay: 100, DecisionAssemblyID: &assembly, PayoutEffectPending: true}, 101, false, ""},
		"decisão ligada e payout já aplicado":         {Pending{HeldDay: 100, DecisionAssemblyID: &assembly}, 101, true, ReleaseDecision},
		"pedido tem prioridade sobre a decisão":       {Pending{HeldDay: 100, DecisionAssemblyID: &assembly, ReleaseRequested: true, ReleaseReason: ReleaseNoDecision}, 101, true, ReleaseNoDecision},
	} {
		t.Run(name, func(t *testing.T) {
			reason, ok := ReleaseReasonFor(tt.p, tt.today, 60)
			if ok != tt.wantOK || reason != tt.wantReason {
				t.Errorf("ReleaseReasonFor = (%q, %v), esperado (%q, %v)", reason, ok, tt.wantReason, tt.wantOK)
			}
		})
	}
	t.Run("prazo zero desliga o vencimento", func(t *testing.T) {
		if _, ok := ReleaseReasonFor(base, 100_000, 0); ok {
			t.Error("sem prazo, nada vence sozinho")
		}
	})
}

func TestSafetyDeadline(t *testing.T) {
	if got := SafetyDeadline(100, 60); got != 160 {
		t.Errorf("SafetyDeadline = %d", got)
	}
}

func TestService_DeclaracaoPendente(t *testing.T) {
	svc, repo := newService(CompanyState{Today: 100}, 10)
	ctx := context.Background()
	assembly := "a1"
	repo.pending = []Pending{
		{ID: "p-aberta", CompanyID: "c1", CycleIndex: 0, HeldDay: 100},
		{ID: "p-decidida", CompanyID: "c2", CycleIndex: 0, HeldDay: 100, DecisionAssemblyID: &assembly},
		{ID: "p-aguardando-payout", CompanyID: "c3", CycleIndex: 0, HeldDay: 100, DecisionAssemblyID: &assembly, PayoutEffectPending: true},
		{ID: "p-pedida", CompanyID: "c4", CycleIndex: 0, HeldDay: 100, ReleaseRequested: true, ReleaseReason: ReleaseNoDecision},
		{ID: "p-vencida", CompanyID: "c5", CycleIndex: 0, HeldDay: 30},
	}

	orders, err := svc.ReleaseDue(ctx, 101)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]ReleaseReason{}
	for _, o := range orders {
		got[o.ID] = o.Reason
	}
	want := map[string]ReleaseReason{"p-decidida": ReleaseDecision, "p-pedida": ReleaseNoDecision, "p-vencida": ReleaseExpired}
	if len(got) != len(want) {
		t.Fatalf("ordens = %v, esperado %v", got, want)
	}
	for id, reason := range want {
		if got[id] != reason {
			t.Errorf("%s: motivo = %q, esperado %q", id, got[id], reason)
		}
	}

	views, err := svc.ListPending(ctx)
	if err != nil || len(views) != 5 || views[0].SafetyDeadlineDay != 160 {
		t.Errorf("ListPending: %+v err=%v", views, err)
	}
}

func TestService_RequestRelease(t *testing.T) {
	svc, repo := newService(CompanyState{}, 10)
	ctx := context.Background()
	repo.pending = []Pending{{ID: "p1"}}

	if err := svc.RequestRelease(ctx, "p1", ReleaseNoDecision); err != nil {
		t.Fatal(err)
	}
	// Repetir mantém o primeiro motivo.
	if err := svc.RequestRelease(ctx, "p1", ReleaseAdmin); err != nil {
		t.Fatal(err)
	}
	if repo.pending[0].ReleaseReason != ReleaseNoDecision {
		t.Errorf("motivo = %q, o primeiro deveria valer", repo.pending[0].ReleaseReason)
	}
	if err := svc.RequestRelease(ctx, "nao-existe", ReleaseAdmin); !errors.Is(err, ErrUnknownDeclaration) {
		t.Errorf("declaração inexistente: %v", err)
	}
	for name, tt := range map[string]struct {
		id     string
		reason ReleaseReason
	}{"sem id": {"", ReleaseAdmin}, "motivo decision não vale de fora": {"p1", ReleaseDecision}, "motivo vazio": {"p1", ""}} {
		if err := svc.RequestRelease(ctx, tt.id, tt.reason); !errors.Is(err, ErrInvalidInput) {
			t.Errorf("%s: erro = %v, esperado ErrInvalidInput", name, err)
		}
	}
}

func TestHoldPolicyFrom(t *testing.T) {
	p := HoldPolicyFrom(enginesetting.Values{GovernanceHoldDeclarations: 1, GovernancePayoutCooldownDays: 90, GovernanceDeclarationSafetyDays: 60})
	if !p.Enabled || p.PayoutCooldownDays != 90 || p.SafetyDays != 60 {
		t.Errorf("política = %+v", p)
	}
	if HoldPolicyFrom(enginesetting.Values{}).Enabled {
		t.Error("por padrão a retenção fica desligada")
	}
}
