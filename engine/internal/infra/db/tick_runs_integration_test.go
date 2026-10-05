package db

import (
	"context"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/tick"
)

// Cobre a tarefa N.6 contra um Postgres real (banco descartável de
// openAccountRepositoryOnScratchDB; roda só com TEST_DATABASE_URL).
func TestTickRuns_GravaEListaMaisRecentePrimeiroComTotal(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	repo := NewTickRepository(conn, nil)

	base := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	records := []tick.RunRecord{
		{Day: 10, Trigger: tick.TriggerScheduled, Status: tick.RunSuccess, StartedAt: base, Duration: 1500 * time.Millisecond,
			Counters: tick.RunCounters{SelicRate: 10.75, IsCopomDay: true, QuotesCount: 24, BotFillsCount: 7, IntradayRoundsCount: 3}},
		{Day: 11, Trigger: tick.TriggerCatchUp, Status: tick.RunSuccess, StartedAt: base.Add(time.Minute), Duration: time.Second, CatchUpDiscarded: 9,
			Counters: tick.RunCounters{SelicRate: 10.75}},
		{Day: 0, Trigger: tick.TriggerManual, Status: tick.RunFailed, ErrorMessage: "banco caiu", StartedAt: base.Add(2 * time.Minute), Duration: 20 * time.Millisecond},
	}
	for _, rec := range records {
		if err := repo.RecordRun(ctx, rec); err != nil {
			t.Fatalf("RecordRun: %v", err)
		}
	}

	got, total, err := repo.ListRuns(ctx, 10, 0)
	if err != nil {
		t.Fatalf("ListRuns: %v", err)
	}
	if total != 3 || len(got) != 3 {
		t.Fatalf("total = %d, len = %d, want 3, 3", total, len(got))
	}
	// Mais recente primeiro: a falha, depois o catch-up, depois o agendado.
	if got[0].Status != tick.RunFailed || got[0].ErrorMessage != "banco caiu" || got[0].Day != 0 || got[0].Trigger != tick.TriggerManual {
		t.Errorf("got[0] = %+v, want a falha manual sem dia", got[0])
	}
	if got[1].Trigger != tick.TriggerCatchUp || got[1].CatchUpDiscarded != 9 {
		t.Errorf("got[1] = %+v, want catch-up com 9 descartados", got[1])
	}
	last := got[2]
	if last.Day != 10 || last.Duration != 1500*time.Millisecond || !last.Counters.IsCopomDay || last.Counters.QuotesCount != 24 ||
		last.Counters.BotFillsCount != 7 || last.Counters.IntradayRoundsCount != 3 || last.Counters.SelicRate != 10.75 || !last.StartedAt.Equal(base) {
		t.Errorf("got[2] = %+v, não bate com o gravado", last)
	}

	page, total, err := repo.ListRuns(ctx, 1, 1)
	if err != nil || total != 3 || len(page) != 1 || page[0].Trigger != tick.TriggerCatchUp {
		t.Errorf("página 2 de tamanho 1 = %+v (total %d, err %v), want o catch-up", page, total, err)
	}
}

func TestTickRuns_RecusaGatilhoEStatusInvalidos(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	repo := NewTickRepository(conn, nil)
	err := repo.RecordRun(context.Background(), tick.RunRecord{Trigger: "agendado", Status: tick.RunSuccess, StartedAt: time.Now()})
	if err == nil {
		t.Error("RecordRun com gatilho fora da lista fechada deveria falhar (CHECK)")
	}
}

func TestSchedulerControl_PausaERetomadaPersistem(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	repo := NewSchedulerControlRepository(conn)

	paused, resumedAt, err := repo.State(ctx)
	if err != nil || paused || !resumedAt.IsZero() {
		t.Fatalf("estado inicial = %v, %v, %v, want não pausado, sem retomada", paused, resumedAt, err)
	}

	if err := repo.Pause(ctx); err != nil {
		t.Fatal(err)
	}
	if paused, _, _ := repo.State(ctx); !paused {
		t.Error("depois de Pause, State.paused = false")
	}
	// Pausar de novo é idempotente.
	if err := repo.Pause(ctx); err != nil {
		t.Fatal(err)
	}

	if err := repo.Resume(ctx); err != nil {
		t.Fatal(err)
	}
	paused, resumedAt, _ = repo.State(ctx)
	if paused || resumedAt.IsZero() {
		t.Fatalf("depois de Resume: paused = %v, resumedAt = %v, want não pausado e com retomada", paused, resumedAt)
	}

	// Retomar de novo não mexe no resumed_at.
	if err := repo.Resume(ctx); err != nil {
		t.Fatal(err)
	}
	if _, again, _ := repo.State(ctx); !again.Equal(resumedAt) {
		t.Errorf("Resume repetido mudou resumed_at: %v -> %v", resumedAt, again)
	}
}
