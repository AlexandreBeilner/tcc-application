package integrity

import (
	"context"
	"errors"
	"sync"
	"testing"
)

type fakeSource struct {
	snapshot Snapshot
	err      error
	// release trava o Load até o teste soltar, pra observar o estado "em andamento".
	release chan struct{}
	started chan struct{}
	once    sync.Once
}

func (f *fakeSource) Load(_ context.Context, replay *Replay) (Snapshot, error) {
	if f.started != nil {
		f.once.Do(func() { close(f.started) })
	}
	if f.release != nil {
		<-f.release
	}
	if f.err != nil {
		return Snapshot{}, f.err
	}
	replay.Apply(Event{UserID: "u1", EventType: "initial_deposit", UnitCents: ptrCents(1000)})
	return f.snapshot, nil
}

func TestService_VerificacaoConcluida(t *testing.T) {
	svc := NewService(&fakeSource{snapshot: Snapshot{Accounts: []Account{{UserID: "u1", BalanceCents: 1000}}}})
	if _, ok := svc.Latest(); ok {
		t.Fatal("antes de rodar não há verificação")
	}
	run, err := svc.Start()
	if err != nil || run.Status != StatusRunning || run.ID == "" {
		t.Fatalf("Start = %+v, %v", run, err)
	}
	svc.Wait()
	latest, ok := svc.Latest()
	if !ok || latest.Status != StatusDone || latest.Report == nil || latest.FinishedAt == nil {
		t.Fatalf("Latest = %+v", latest)
	}
	if latest.Report.Total != 0 || latest.Report.Checked.Events != 1 {
		t.Fatalf("relatório inesperado: %+v", latest.Report)
	}
}

func TestService_FalhaDeLeituraViraRunFailed(t *testing.T) {
	svc := NewService(&fakeSource{err: errors.New("banco fora")})
	if _, err := svc.Start(); err != nil {
		t.Fatal(err)
	}
	svc.Wait()
	latest, _ := svc.Latest()
	if latest.Status != StatusFailed || latest.Error != "banco fora" || latest.Report != nil {
		t.Fatalf("Latest = %+v", latest)
	}
}

func TestService_UmaPorVez(t *testing.T) {
	source := &fakeSource{release: make(chan struct{}), started: make(chan struct{})}
	svc := NewService(source)
	if _, err := svc.Start(); err != nil {
		t.Fatal(err)
	}
	<-source.started
	if _, err := svc.Start(); !errors.Is(err, ErrAlreadyRunning) {
		t.Fatalf("segunda verificação durante a primeira = %v; quer ErrAlreadyRunning", err)
	}
	if latest, _ := svc.Latest(); latest.Status != StatusRunning {
		t.Fatalf("durante a leitura o estado é running: %+v", latest)
	}
	close(source.release)
	svc.Wait()
	// Terminada, uma nova verificação é permitida.
	source.release = nil
	if _, err := svc.Start(); err != nil {
		t.Fatalf("depois de terminar pode rodar de novo: %v", err)
	}
	svc.Wait()
}
