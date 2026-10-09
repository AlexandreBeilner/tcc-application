package integrity

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sync"
	"time"
)

// ErrAlreadyRunning é devolvido quando já há uma verificação em andamento: só uma por vez,
// pra duas leituras longas do mesmo banco não se acumularem.
var ErrAlreadyRunning = errors.New("já existe uma verificação de integridade em andamento")

// RunTimeout limita uma verificação. Passou disso, falha com o erro de contexto em vez de
// prender a conexão do banco indefinidamente.
const RunTimeout = 5 * time.Minute

// Status é o estado de uma verificação.
type Status string

const (
	StatusRunning Status = "running"
	StatusDone    Status = "done"
	StatusFailed  Status = "failed"
)

// Source lê a fotografia consistente do banco e alimenta `replay` com os eventos, na ordem.
// Uma fotografia só (uma transação de leitura): sem isso, um tick rodando no meio da leitura
// geraria divergência falsa entre eventos e projeção.
type Source interface {
	Load(ctx context.Context, replay *Replay) (Snapshot, error)
}

// Run é uma verificação, em andamento ou concluída.
type Run struct {
	ID         string
	Status     Status
	StartedAt  time.Time
	FinishedAt *time.Time
	Report     *Report
	Error      string
}

// Service dispara a verificação em segundo plano (ela pode levar mais que alguns segundos
// numa base grande) e guarda a última. O resultado vive em memória: é um diagnóstico sob
// demanda, não histórico, e quem quiser o registro de que foi rodada tem a auditoria do painel.
type Service struct {
	source Source
	now    func() time.Time

	mu   sync.Mutex
	last *Run
	done chan struct{}
}

func NewService(source Source) *Service {
	return &Service{source: source, now: time.Now}
}

func newRunID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// Start abre uma verificação e devolve na hora; o trabalho segue em segundo plano.
func (s *Service) Start() (Run, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.last != nil && s.last.Status == StatusRunning {
		return Run{}, ErrAlreadyRunning
	}
	run := &Run{ID: newRunID(), Status: StatusRunning, StartedAt: s.now()}
	s.last = run
	s.done = make(chan struct{})
	done := s.done
	go func() {
		defer close(done)
		s.execute(run)
	}()
	return *run, nil
}

func (s *Service) execute(run *Run) {
	ctx, cancel := context.WithTimeout(context.Background(), RunTimeout)
	defer cancel()
	replay := NewReplay()
	snapshot, err := s.source.Load(ctx, replay)
	var report *Report
	if err == nil {
		snapshot.Replay = replay
		r := Evaluate(snapshot)
		report = &r
	}
	finished := s.now()

	s.mu.Lock()
	defer s.mu.Unlock()
	run.FinishedAt = &finished
	if err != nil {
		run.Status = StatusFailed
		run.Error = err.Error()
		return
	}
	run.Status = StatusDone
	run.Report = report
}

// Latest devolve uma cópia da última verificação, ou false se nunca rodou desde a subida.
func (s *Service) Latest() (Run, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.last == nil {
		return Run{}, false
	}
	return *s.last, true
}

// Wait bloqueia até a verificação em andamento terminar. Existe pra os testes, que precisam
// esperar o segundo plano sem dormir.
func (s *Service) Wait() {
	s.mu.Lock()
	done := s.done
	s.mu.Unlock()
	if done != nil {
		<-done
	}
}
