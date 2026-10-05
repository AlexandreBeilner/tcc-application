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
	if got != (Values{TicksPerDay: 5, MaxCatchUp: 3}) {
		t.Fatalf("padrão = %+v", got)
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
