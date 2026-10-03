package scheduler

import (
	"context"
	"errors"
	"testing"
	"time"
)

var saoPaulo = mustZone("America/Sao_Paulo")

func mustZone(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

func testConfig() Config { return Config{Location: saoPaulo, TicksPerDay: 5, MaxCatchUp: 3} }

func at(h, m int) time.Time { return time.Date(2026, 9, 28, h, m, 0, 0, saoPaulo) }

func TestConfig_SlotsAncoradosNaMeiaNoite(t *testing.T) {
	cfg := testConfig()
	base := cfg.SlotOf(at(0, 0))
	tests := []struct {
		at   time.Time
		want int64
	}{
		{at(0, 0), 0}, {at(4, 47), 0}, {at(4, 48), 1}, {at(9, 35), 1}, {at(9, 36), 2},
		{at(14, 24), 3}, {at(19, 12), 4}, {at(23, 59), 4},
		{at(0, 0).AddDate(0, 0, 1), 5},
	}
	for _, tt := range tests {
		if got := cfg.SlotOf(tt.at) - base; got != tt.want {
			t.Errorf("SlotOf(%s) - base = %d, want %d", tt.at.Format("15:04"), got, tt.want)
		}
	}
}

func TestConfig_NextSlotStart(t *testing.T) {
	cfg := testConfig()
	tests := []struct{ now, want time.Time }{
		{at(0, 0), at(4, 48)},
		{at(4, 47), at(4, 48)},
		{at(4, 48), at(9, 36)},
		{at(19, 12), at(0, 0).AddDate(0, 0, 1)},
		{at(23, 59), at(0, 0).AddDate(0, 0, 1)},
	}
	for _, tt := range tests {
		if got := cfg.NextSlotStart(tt.now); !got.Equal(tt.want) {
			t.Errorf("NextSlotStart(%s) = %s, want %s", tt.now.Format("15:04"), got.Format("15:04 02/01"), tt.want.Format("15:04 02/01"))
		}
	}
}

func TestConfig_Plan(t *testing.T) {
	cfg := testConfig()
	now := at(10, 0) // slot 2 do dia
	tests := []struct {
		name  string
		last  time.Time
		found bool
		want  int
	}{
		{"nunca rodou", time.Time{}, false, 1},
		{"já rodou neste slot (deploy repetido)", at(9, 40), true, 0},
		{"rodou no slot anterior", at(5, 0), true, 1},
		{"perdeu 2 slots", at(0, 30), true, 2},
		{"perdeu mais que o teto", at(0, 0).AddDate(0, 0, -2), true, 3},
		{"relógio anterior ao último tick", at(12, 0), true, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := cfg.Plan(now, tt.last, tt.found); got != tt.want {
				t.Errorf("Plan() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestRun_RecuperaNaSubidaEDisparaNoProximoSlot(t *testing.T) {
	cfg := Config{Location: saoPaulo, TicksPerDay: 5, MaxCatchUp: 3}
	// Relógio injetado: 10:00 é o slot 2 do dia; o último tick foi às 00:30 (slot 0).
	clock := at(10, 0)
	now := func() time.Time { return clock }

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var plans []int
	run := func(_ context.Context, plan func(time.Time, bool) (int, int)) (int, error) {
		n, _ := plan(at(0, 30), true) // último tick às 00:30
		plans = append(plans, n)
		cancel() // encerra depois da recuperação da subida
		return n, nil
	}
	Run(ctx, cfg, now, run, nil)
	if len(plans) != 1 || plans[0] != 2 {
		t.Errorf("planos = %v, want [2] (2 slots perdidos recuperados na subida)", plans)
	}
}

func TestConfig_PlanWithDiscard(t *testing.T) {
	cfg := testConfig()
	now := at(10, 0)
	tests := []struct {
		name          string
		last          time.Time
		found         bool
		wantRun, want int
	}{
		{"nunca rodou", time.Time{}, false, 1, 0},
		{"dentro do teto não descarta", at(0, 30), true, 2, 0},
		{"exatamente no teto não descarta", at(19, 30).AddDate(0, 0, -1), true, 3, 0},
		{"2 dias atrás: 12 slots perdidos, 3 recuperados, 9 descartados", at(0, 0).AddDate(0, 0, -2), true, 3, 9},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			run, discarded := cfg.PlanWithDiscard(now, tt.last, tt.found)
			if run != tt.wantRun || discarded != tt.want {
				t.Errorf("PlanWithDiscard() = (%d, %d), want (%d, %d)", run, discarded, tt.wantRun, tt.want)
			}
		})
	}
}

type fakeControl struct {
	paused    bool
	resumedAt time.Time
	err       error
}

func (f fakeControl) State(context.Context) (bool, time.Time, error) {
	return f.paused, f.resumedAt, f.err
}

// runOnce roda a tentativa da subida do Run uma vez e devolve o plano calculado
// (ou -1 se a agenda nem chamou run).
func runOnce(t *testing.T, control Control, last time.Time) (plan int, called bool) {
	t.Helper()
	cfg := testConfig()
	now := func() time.Time { return at(10, 0) }
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	run := func(_ context.Context, plan func(time.Time, bool) (int, int)) (int, error) {
		called = true
		n, _ := plan(last, true)
		cancel()
		return n, nil
	}
	// Quando run não é chamado o ctx nunca é cancelado pelo teste: cancelamos
	// por fora logo depois da tentativa da subida.
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()
	var got int
	wrapped := func(c context.Context, p func(time.Time, bool) (int, int)) (int, error) {
		n, err := run(c, p)
		got = n
		return n, err
	}
	Run(ctx, cfg, now, wrapped, control)
	return got, called
}

func TestRun_PausadoNaoRodaOTickAgendado(t *testing.T) {
	if _, called := runOnce(t, fakeControl{paused: true}, at(0, 30)); called {
		t.Error("agenda pausada chamou o tick")
	}
}

func TestRun_FalhaAoLerAPausaNaoRodaOTick(t *testing.T) {
	if _, called := runOnce(t, fakeControl{err: errors.New("banco fora")}, at(0, 30)); called {
		t.Error("sem conseguir ler a pausa, o tick rodou")
	}
}

func TestRun_NaoPausadoSemRetomadaRecuperaNormalmente(t *testing.T) {
	plan, called := runOnce(t, fakeControl{}, at(0, 30))
	if !called || plan != 2 {
		t.Errorf("called = %v, plano = %d, want true, 2", called, plan)
	}
}

// Retomar não recupera o tempo que ficou pausado de propósito: os slots são
// contados a partir de resumedAt, não do último tick.
func TestRun_RetomadaContaOsSlotsPerdidosAPartirDoResumedAt(t *testing.T) {
	plan, called := runOnce(t, fakeControl{resumedAt: at(9, 50)}, at(0, 30))
	if !called || plan != 0 {
		t.Errorf("called = %v, plano = %d, want true, 0 (retomou no slot atual, nada a recuperar)", called, plan)
	}
	// Retomou há dois slots: recupera só o que passou desde então.
	plan, _ = runOnce(t, fakeControl{resumedAt: at(4, 50)}, at(0, 30))
	if plan != 1 {
		t.Errorf("plano = %d, want 1", plan)
	}
	// resumedAt anterior ao último tick não interfere.
	plan, _ = runOnce(t, fakeControl{resumedAt: at(0, 10)}, at(0, 30))
	if plan != 2 {
		t.Errorf("plano = %d, want 2", plan)
	}
}
