package enginesetting

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeRepo struct {
	rows  map[Key]Override
	reads int
}

func (f *fakeRepo) Overrides(context.Context) (map[Key]Override, error) {
	f.reads++
	out := map[Key]Override{}
	for k, v := range f.rows {
		out[k] = v
	}
	return out, nil
}

func (f *fakeRepo) Save(_ context.Context, key Key, value int, by string) error {
	row := f.rows[key]
	f.rows[key] = Override{Value: value, UpdatedBy: by, UpdatedAt: time.Now(), Version: row.Version + 1}
	return nil
}

func (f *fakeRepo) Delete(_ context.Context, key Key) error {
	delete(f.rows, key)
	return nil
}

func newService() (*Service, *fakeRepo) {
	repo := &fakeRepo{rows: map[Key]Override{}}
	return NewService(repo, Values{TicksPerDay: 5, MaxCatchUp: 3}), repo
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name  string
		key   Key
		value int
		want  error
	}{
		{"ticks no mínimo", TicksPerDay, 1, nil},
		{"ticks no máximo", TicksPerDay, 24, nil},
		{"ticks abaixo", TicksPerDay, 0, &OutOfRangeError{}},
		{"ticks acima", TicksPerDay, 25, &OutOfRangeError{}},
		{"catch-up no máximo", MaxCatchUp, 30, nil},
		{"catch-up acima", MaxCatchUp, 31, &OutOfRangeError{}},
		{"catch-up negativo", MaxCatchUp, -1, &OutOfRangeError{}},
		{"chave somente leitura", Key("initial_capital"), 10000, ErrUnknownKey},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Validate(tt.key, tt.value)
			var oor *OutOfRangeError
			switch {
			case tt.want == nil && err != nil:
				t.Errorf("err = %v, want nil", err)
			case errors.Is(tt.want, ErrUnknownKey) && !errors.Is(err, ErrUnknownKey):
				t.Errorf("err = %v, want ErrUnknownKey", err)
			case tt.want != nil && !errors.Is(tt.want, ErrUnknownKey) && !errors.As(err, &oor):
				t.Errorf("err = %v, want OutOfRangeError", err)
			}
		})
	}
}

func TestService_SetEReset(t *testing.T) {
	svc, _ := newService()
	ctx := context.Background()

	got, _ := svc.Current(ctx)
	if got.TicksPerDay != 5 || got.MaxCatchUp != 3 {
		t.Fatalf("padrão = %+v", got)
	}
	if got.GovernanceGrowthStepCentiPP != DefaultGovernanceGrowthStepCentiPP || got.GovernanceQualityStepCenti != DefaultGovernanceQualityStepCenti ||
		got.GovernanceRampTicks != DefaultGovernanceRampTicks || got.GovernanceCooldownDays != DefaultGovernanceCooldownDays ||
		got.GovernancePayoutStepCentiPP != DefaultGovernancePayoutStepCentiPP || got.GovernancePayoutMinPct != DefaultGovernancePayoutMinPct ||
		got.GovernancePayoutMaxPct != DefaultGovernancePayoutMaxPct || got.GovernancePayoutCooldownDays != DefaultGovernancePayoutCooldownDays ||
		got.GovernanceHoldDeclarations != DefaultGovernanceHoldDeclarations || got.GovernanceDeclarationSafetyDays != DefaultGovernanceDeclarationSafetyDays {
		t.Fatalf("padrões de governança = %+v", got)
	}
	if err := svc.Set(ctx, TicksPerDay, 12, "admin-1"); err != nil {
		t.Fatal(err)
	}
	got, _ = svc.Current(ctx)
	if got.TicksPerDay != 12 || got.MaxCatchUp != 3 {
		t.Errorf("depois do Set = %+v, want 12 e 3 (cache invalidado)", got)
	}
	list, _ := svc.List(ctx)
	if !list[0].Overriden || list[0].UpdatedBy != "admin-1" || list[0].Default != 5 || list[1].Overriden {
		t.Errorf("lista = %+v", list)
	}
	if err := svc.Reset(ctx, TicksPerDay); err != nil {
		t.Fatal(err)
	}
	got, _ = svc.Current(ctx)
	if got.TicksPerDay != 5 {
		t.Errorf("depois do Reset = %+v, want padrão", got)
	}
}

func TestService_SetInvalidoNaoGrava(t *testing.T) {
	svc, repo := newService()
	if err := svc.Set(context.Background(), MaxCatchUp, 99, "admin-1"); err == nil {
		t.Fatal("aceitou valor fora da faixa")
	}
	if len(repo.rows) != 0 {
		t.Errorf("gravou mesmo recusando: %v", repo.rows)
	}
	if err := svc.Reset(context.Background(), Key("x")); !errors.Is(err, ErrUnknownKey) {
		t.Errorf("Reset de chave desconhecida = %v", err)
	}
}

func TestService_CurrentUsaCacheCurto(t *testing.T) {
	svc, repo := newService()
	clock := time.Now()
	svc.now = func() time.Time { return clock }
	ctx := context.Background()
	_, _ = svc.Current(ctx)
	_, _ = svc.Current(ctx)
	if repo.reads != 1 {
		t.Errorf("leituras = %d, want 1 dentro do TTL", repo.reads)
	}
	clock = clock.Add(cacheTTL + time.Second)
	_, _ = svc.Current(ctx)
	if repo.reads != 2 {
		t.Errorf("leituras = %d, want 2 depois do TTL", repo.reads)
	}
}

func TestService_GovernancaPadraoEOverride(t *testing.T) {
	svc, _ := newService()
	ctx := context.Background()
	if err := svc.Set(ctx, GovernanceCooldownDays, 0, "admin-1"); err != nil {
		t.Fatalf("cooldown 0 é válido (sem intervalo): %v", err)
	}
	if err := svc.Set(ctx, GovernanceRampTicks, 0, "admin-1"); err == nil {
		t.Fatal("rampa de 0 ticks deveria ser recusada")
	}
	if err := svc.Set(ctx, GovernanceGrowthStepCentiPP, 501, "admin-1"); err == nil {
		t.Fatal("faixa acima do teto deveria ser recusada")
	}
	got, _ := svc.Current(ctx)
	if got.GovernanceCooldownDays != 0 {
		t.Fatalf("cooldown = %d, esperado 0 depois do override", got.GovernanceCooldownDays)
	}
	if got.GovernanceRampTicks != DefaultGovernanceRampTicks {
		t.Fatalf("rampa = %d, esperado o padrão", got.GovernanceRampTicks)
	}
}

// Valores de lançamento da Assembleia de Acionistas aprovados pelo autor em 2026-10-11 (MO.6.9).
// Os literais ficam aqui de propósito: mudar um padrão exige mudar este teste junto, de forma
// consciente, e não só a constante.
func TestGovernanceDefaults_ValoresDeLancamentoAprovados(t *testing.T) {
	cases := []struct {
		name string
		got  int
		want int
	}{
		{"degrau de crescimento (0,50 p.p., em centésimos)", DefaultGovernanceGrowthStepCentiPP, 50},
		{"degrau de qualidade (0,05, em centésimos)", DefaultGovernanceQualityStepCenti, 5},
		{"rampa em ticks", DefaultGovernanceRampTicks, 30},
		{"cooldown em dias simulados", DefaultGovernanceCooldownDays, 90},
		// Payout (MO.6.10, decisões do autor em 2026-10-11).
		{"degrau do payout (10 p.p., em centésimos)", DefaultGovernancePayoutStepCentiPP, 1000},
		{"piso do payout (%)", DefaultGovernancePayoutMinPct, 20},
		{"teto do payout (%)", DefaultGovernancePayoutMaxPct, 90},
		{"cooldown do payout em dias simulados", DefaultGovernancePayoutCooldownDays, 90},
		// Prêmio da PN (MO.6.12): degrau de 5 p.p., do piso legal de 10% a 30%.
		{"degrau do prêmio da PN (5 p.p., em centésimos)", DefaultGovernancePremiumStepCentiPP, 500},
		{"piso do prêmio da PN (%)", DefaultGovernancePremiumMinPct, 10},
		{"teto do prêmio da PN (%)", DefaultGovernancePremiumMaxPct, 30},
		// Declaração pendente (MO.6.11): a retenção nasce ligada, o prazo de segurança é de 60 dias.
		{"retenção de declaração (1 = ligada, a Assembleia nasce ligada)", DefaultGovernanceHoldDeclarations, 1},
		{"prazo de segurança da declaração em dias simulados", DefaultGovernanceDeclarationSafetyDays, 60},
	}
	for _, c := range cases {
		if c.got != c.want {
			t.Errorf("%s = %d, aprovado %d", c.name, c.got, c.want)
		}
	}
}
