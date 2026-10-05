// Package enginesetting guarda os parâmetros operacionais do motor que o painel admin
// pode ajustar em runtime (tarefa N.7). A lista é fechada de propósito (decisão do autor,
// 2026-10-03, achado 029): só o ritmo do Temporizador é editável. Regra financeira e
// invariante de domínio (salário, spread, limites de ordem, semente, capital inicial,
// constantes de calendário) são constantes de código e aparecem só como leitura.
package enginesetting

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"
)

// Key identifica um parâmetro editável.
type Key string

const (
	// TicksPerDay é quantos ticks (dias simulados) acontecem por dia real
	// (SIMULATION_DAYS_PER_REAL_DAY no ambiente).
	TicksPerDay Key = "ticks_per_day"
	// MaxCatchUp é o teto de ticks recuperados de uma vez depois de uma parada
	// (TICK_MAX_CATCHUP no ambiente).
	MaxCatchUp Key = "max_catch_up"
)

// ErrUnknownKey: a chave não é um parâmetro editável.
var ErrUnknownKey = errors.New("parâmetro desconhecido ou somente leitura")

// OutOfRangeError: o valor está fora da faixa permitida da chave.
type OutOfRangeError struct {
	Key      Key
	Min, Max int
}

func (e *OutOfRangeError) Error() string {
	return fmt.Sprintf("%s precisa ser um inteiro entre %d e %d", e.Key, e.Min, e.Max)
}

// Definition descreve a faixa permitida de um parâmetro editável.
type Definition struct {
	Key      Key
	Min, Max int
}

// definitions é a lista fechada. A faixa de ticks_per_day acompanha a agenda ancorada
// na meia-noite (intervalo 24h/N); a de max_catch_up acompanha tick.MaxAdvanceDays.
var definitions = []Definition{
	{Key: TicksPerDay, Min: 1, Max: 24},
	{Key: MaxCatchUp, Min: 1, Max: 30},
}

// Definitions devolve os parâmetros editáveis na ordem de exibição.
func Definitions() []Definition {
	return append([]Definition(nil), definitions...)
}

func definitionOf(key Key) (Definition, bool) {
	for _, d := range definitions {
		if d.Key == key {
			return d, true
		}
	}
	return Definition{}, false
}

// Validate confere chave e faixa de um valor.
func Validate(key Key, value int) error {
	def, ok := definitionOf(key)
	if !ok {
		return ErrUnknownKey
	}
	if value < def.Min || value > def.Max {
		return &OutOfRangeError{Key: key, Min: def.Min, Max: def.Max}
	}
	return nil
}

// Values são os valores vigentes dos parâmetros editáveis.
type Values struct {
	TicksPerDay int
	MaxCatchUp  int
}

func (v Values) get(key Key) int {
	if key == TicksPerDay {
		return v.TicksPerDay
	}
	return v.MaxCatchUp
}

func (v *Values) set(key Key, value int) {
	if key == TicksPerDay {
		v.TicksPerDay = value
	} else {
		v.MaxCatchUp = value
	}
}

// Override é um valor gravado por um admin por cima do padrão.
type Override struct {
	Value     int
	UpdatedBy string
	UpdatedAt time.Time
	Version   int
}

// Repository persiste os valores alterados (uma linha por chave); chave sem linha usa
// o padrão.
type Repository interface {
	Overrides(ctx context.Context) (map[Key]Override, error)
	Save(ctx context.Context, key Key, value int, updatedBy string) error
	Delete(ctx context.Context, key Key) error
}

// Setting é um parâmetro editável como o painel o mostra.
type Setting struct {
	Key       Key
	Value     int
	Default   int
	Min, Max  int
	Overriden bool
	UpdatedBy string
	UpdatedAt time.Time
	Version   int
}

// cacheTTL evita uma ida ao banco por requisição do relógio público.
const cacheTTL = 5 * time.Second

// Service junta o padrão do ambiente (Defaults) com o que o admin alterou.
type Service struct {
	repo     Repository
	defaults Values
	now      func() time.Time

	mu       sync.Mutex
	cached   Values
	cachedAt time.Time
	valid    bool
}

// NewService recebe o padrão vindo do ambiente (já validado pelo chamador).
func NewService(repo Repository, defaults Values) *Service {
	return &Service{repo: repo, defaults: defaults, now: time.Now}
}

func (s *Service) merge(overrides map[Key]Override) Values {
	values := s.defaults
	for key, o := range overrides {
		if _, ok := definitionOf(key); ok {
			values.set(key, o.Value)
		}
	}
	return values
}

// Current devolve os valores vigentes (com cache curto; Set e Reset o invalidam).
func (s *Service) Current(ctx context.Context) (Values, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.valid && s.now().Sub(s.cachedAt) < cacheTTL {
		return s.cached, nil
	}
	overrides, err := s.repo.Overrides(ctx)
	if err != nil {
		return Values{}, err
	}
	s.cached, s.cachedAt, s.valid = s.merge(overrides), s.now(), true
	return s.cached, nil
}

// List devolve os parâmetros editáveis com valor, padrão, faixa e último autor.
func (s *Service) List(ctx context.Context) ([]Setting, error) {
	overrides, err := s.repo.Overrides(ctx)
	if err != nil {
		return nil, err
	}
	values := s.merge(overrides)
	settings := make([]Setting, 0, len(definitions))
	for _, def := range definitions {
		setting := Setting{Key: def.Key, Value: values.get(def.Key), Default: s.defaults.get(def.Key), Min: def.Min, Max: def.Max}
		if o, ok := overrides[def.Key]; ok {
			setting.Overriden, setting.UpdatedBy, setting.UpdatedAt, setting.Version = true, o.UpdatedBy, o.UpdatedAt, o.Version
		}
		settings = append(settings, setting)
	}
	return settings, nil
}

func (s *Service) invalidate() {
	s.mu.Lock()
	s.valid = false
	s.mu.Unlock()
}

// Set grava um valor novo depois de validar chave e faixa. Vale a partir da próxima
// tentativa do agendador, nunca no meio de um tick.
func (s *Service) Set(ctx context.Context, key Key, value int, updatedBy string) error {
	if err := Validate(key, value); err != nil {
		return err
	}
	if err := s.repo.Save(ctx, key, value, updatedBy); err != nil {
		return err
	}
	s.invalidate()
	return nil
}

// Reset volta o parâmetro ao padrão do ambiente. Idempotente.
func (s *Service) Reset(ctx context.Context, key Key) error {
	if _, ok := definitionOf(key); !ok {
		return ErrUnknownKey
	}
	if err := s.repo.Delete(ctx, key); err != nil {
		return err
	}
	s.invalidate()
	return nil
}
