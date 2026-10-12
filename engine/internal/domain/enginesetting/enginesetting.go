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

	// Governança corporativa (MO.6.2, Assembleia de Acionistas). Exceção deliberada à lista
	// fechada do achado 029: o backlog de monetização manda os parâmetros da assembleia
	// ficarem em enginesetting, "nunca fixos", para o admin calibrá-los sem redeploy.

	// GovernanceGrowthStepCentiPP é a faixa máxima de mudança do crescimento base de uma
	// empresa por decisão, em centésimos de ponto percentual (50 = 0,50 p.p.).
	GovernanceGrowthStepCentiPP Key = "governance_growth_step_centipp"
	// GovernanceQualityStepCenti é a faixa máxima de mudança do multiplicador de qualidade
	// por decisão, em centésimos (5 = 0,05).
	GovernanceQualityStepCenti Key = "governance_quality_step_centi"
	// GovernanceRampTicks é em quantos ticks o efeito de uma decisão é aplicado, aos poucos.
	GovernanceRampTicks Key = "governance_ramp_ticks"
	// GovernanceCooldownDays é o intervalo mínimo, em dias simulados, entre duas mudanças
	// de uma mesma empresa (90 = no máximo uma por trimestre).
	GovernanceCooldownDays Key = "governance_cooldown_days"

	// Payout por empresa (MO.6.10). O degrau é em centésimos de p.p. (1000 = 10 p.p.); a
	// faixa válida do payout da empresa é em % inteiros; o cooldown é próprio do payout.
	GovernancePayoutStepCentiPP  Key = "governance_payout_step_centipp"
	GovernancePayoutMinPct       Key = "governance_payout_min_pct"
	GovernancePayoutMaxPct       Key = "governance_payout_max_pct"
	GovernancePayoutCooldownDays Key = "governance_payout_cooldown_days"

	// Declaração pendente (MO.6.11). GovernanceHoldDeclarations (0 ou 1, padrão 1: a Assembleia
	// nasce com a aplicação) liga a retenção do dividendo do balanço enquanto a assembleia de
	// destinação do lucro decide; ao desligar as assembleias em emergência
	// (ASSEMBLIES_ENABLED=off no backend), desligar este junto. GovernanceDeclarationSafetyDays é o prazo,
	// em dias simulados, para a declaração retida sair sozinha com o payout vigente.
	GovernanceHoldDeclarations Key = "governance_hold_declarations"

	// Prêmio da ação PN sobre a ON (MO.6.12): degrau em centésimos de p.p. (500 = 5 p.p.) e
	// faixa válida em % inteiros (o piso é o legal, 10%).
	GovernancePremiumStepCentiPP    Key = "governance_premium_step_centipp"
	GovernancePremiumMinPct         Key = "governance_premium_min_pct"
	GovernancePremiumMaxPct         Key = "governance_premium_max_pct"
	GovernanceDeclarationSafetyDays Key = "governance_declaration_safety_days"
)

// Padrões da governança, aplicados por NewService quando o chamador não informa o valor.
// Ponto de partida conservador; a calibração em escala é a MO.6.9.
const (
	DefaultGovernanceGrowthStepCentiPP = 50
	DefaultGovernanceQualityStepCenti  = 5
	DefaultGovernanceRampTicks         = 30
	DefaultGovernanceCooldownDays      = 90

	DefaultGovernancePayoutStepCentiPP  = 1000
	DefaultGovernancePayoutMinPct       = 20
	DefaultGovernancePayoutMaxPct       = 90
	DefaultGovernancePayoutCooldownDays = 90

	DefaultGovernancePremiumStepCentiPP = 500
	DefaultGovernancePremiumMinPct      = 10
	DefaultGovernancePremiumMaxPct      = 30

	DefaultGovernanceHoldDeclarations      = 1
	DefaultGovernanceDeclarationSafetyDays = 60
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
	{Key: GovernanceGrowthStepCentiPP, Min: 1, Max: 500},
	{Key: GovernanceQualityStepCenti, Min: 1, Max: 50},
	{Key: GovernanceRampTicks, Min: 1, Max: 365},
	{Key: GovernanceCooldownDays, Min: 0, Max: 720},
	{Key: GovernancePayoutStepCentiPP, Min: 1, Max: 5000},
	{Key: GovernancePayoutMinPct, Min: 0, Max: 100},
	{Key: GovernancePayoutMaxPct, Min: 0, Max: 100},
	{Key: GovernancePayoutCooldownDays, Min: 0, Max: 720},
	// O prazo de segurança fica abaixo do ciclo trimestral (91 dias): uma declaração retida
	// sempre sai antes de o próximo balanço gerar outra.
	{Key: GovernancePremiumStepCentiPP, Min: 1, Max: 2000},
	{Key: GovernancePremiumMinPct, Min: 10, Max: 100},
	{Key: GovernancePremiumMaxPct, Min: 10, Max: 100},
	{Key: GovernanceHoldDeclarations, Min: 0, Max: 1},
	{Key: GovernanceDeclarationSafetyDays, Min: 1, Max: 80},
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

	GovernanceGrowthStepCentiPP int
	GovernanceQualityStepCenti  int
	GovernanceRampTicks         int
	GovernanceCooldownDays      int

	GovernancePayoutStepCentiPP  int
	GovernancePayoutMinPct       int
	GovernancePayoutMaxPct       int
	GovernancePayoutCooldownDays int

	GovernancePremiumStepCentiPP int
	GovernancePremiumMinPct      int
	GovernancePremiumMaxPct      int

	GovernanceHoldDeclarations      int
	GovernanceDeclarationSafetyDays int
}

// withGovernanceDefaults completa os campos de governança que o chamador deixou em zero.
// Cooldown zero é válido (sem intervalo), então só os demais são completados; o cooldown
// só ganha padrão se TODOS os de governança vieram zerados (valor nunca informado).
func (v Values) withGovernanceDefaults() Values {
	unset := v.GovernanceGrowthStepCentiPP == 0 && v.GovernanceQualityStepCenti == 0 &&
		v.GovernanceRampTicks == 0 && v.GovernanceCooldownDays == 0
	if v.GovernanceGrowthStepCentiPP == 0 {
		v.GovernanceGrowthStepCentiPP = DefaultGovernanceGrowthStepCentiPP
	}
	if v.GovernanceQualityStepCenti == 0 {
		v.GovernanceQualityStepCenti = DefaultGovernanceQualityStepCenti
	}
	if v.GovernanceRampTicks == 0 {
		v.GovernanceRampTicks = DefaultGovernanceRampTicks
	}
	if unset {
		v.GovernanceCooldownDays = DefaultGovernanceCooldownDays
		// A retenção é 0 ou 1 (0 é válido), então só ganha o padrão (ligada) quando nenhum
		// parâmetro de governança foi informado, como o cooldown.
		v.GovernanceHoldDeclarations = DefaultGovernanceHoldDeclarations
	}
	// Payout: a faixa só vale se o máximo foi informado (mínimo 0 é válido); cooldown 0 é
	// válido, então só ganha padrão se nenhum parâmetro de payout veio.
	payoutUnset := v.GovernancePayoutStepCentiPP == 0 && v.GovernancePayoutMinPct == 0 &&
		v.GovernancePayoutMaxPct == 0 && v.GovernancePayoutCooldownDays == 0
	if v.GovernancePayoutStepCentiPP == 0 {
		v.GovernancePayoutStepCentiPP = DefaultGovernancePayoutStepCentiPP
	}
	if v.GovernancePayoutMaxPct == 0 {
		v.GovernancePayoutMaxPct = DefaultGovernancePayoutMaxPct
	}
	if payoutUnset {
		v.GovernancePayoutMinPct = DefaultGovernancePayoutMinPct
		v.GovernancePayoutCooldownDays = DefaultGovernancePayoutCooldownDays
	}
	if v.GovernancePremiumStepCentiPP == 0 {
		v.GovernancePremiumStepCentiPP = DefaultGovernancePremiumStepCentiPP
	}
	if v.GovernancePremiumMinPct == 0 {
		v.GovernancePremiumMinPct = DefaultGovernancePremiumMinPct
	}
	if v.GovernancePremiumMaxPct == 0 {
		v.GovernancePremiumMaxPct = DefaultGovernancePremiumMaxPct
	}
	if v.GovernanceDeclarationSafetyDays == 0 {
		v.GovernanceDeclarationSafetyDays = DefaultGovernanceDeclarationSafetyDays
	}
	return v
}

func (v Values) get(key Key) int {
	switch key {
	case TicksPerDay:
		return v.TicksPerDay
	case MaxCatchUp:
		return v.MaxCatchUp
	case GovernanceGrowthStepCentiPP:
		return v.GovernanceGrowthStepCentiPP
	case GovernanceQualityStepCenti:
		return v.GovernanceQualityStepCenti
	case GovernanceRampTicks:
		return v.GovernanceRampTicks
	case GovernanceCooldownDays:
		return v.GovernanceCooldownDays
	case GovernancePayoutStepCentiPP:
		return v.GovernancePayoutStepCentiPP
	case GovernancePayoutMinPct:
		return v.GovernancePayoutMinPct
	case GovernancePayoutMaxPct:
		return v.GovernancePayoutMaxPct
	case GovernancePayoutCooldownDays:
		return v.GovernancePayoutCooldownDays
	case GovernancePremiumStepCentiPP:
		return v.GovernancePremiumStepCentiPP
	case GovernancePremiumMinPct:
		return v.GovernancePremiumMinPct
	case GovernancePremiumMaxPct:
		return v.GovernancePremiumMaxPct
	case GovernanceHoldDeclarations:
		return v.GovernanceHoldDeclarations
	case GovernanceDeclarationSafetyDays:
		return v.GovernanceDeclarationSafetyDays
	}
	return 0
}

func (v *Values) set(key Key, value int) {
	switch key {
	case TicksPerDay:
		v.TicksPerDay = value
	case MaxCatchUp:
		v.MaxCatchUp = value
	case GovernanceGrowthStepCentiPP:
		v.GovernanceGrowthStepCentiPP = value
	case GovernanceQualityStepCenti:
		v.GovernanceQualityStepCenti = value
	case GovernanceRampTicks:
		v.GovernanceRampTicks = value
	case GovernanceCooldownDays:
		v.GovernanceCooldownDays = value
	case GovernancePayoutStepCentiPP:
		v.GovernancePayoutStepCentiPP = value
	case GovernancePayoutMinPct:
		v.GovernancePayoutMinPct = value
	case GovernancePayoutMaxPct:
		v.GovernancePayoutMaxPct = value
	case GovernancePayoutCooldownDays:
		v.GovernancePayoutCooldownDays = value
	case GovernancePremiumStepCentiPP:
		v.GovernancePremiumStepCentiPP = value
	case GovernancePremiumMinPct:
		v.GovernancePremiumMinPct = value
	case GovernancePremiumMaxPct:
		v.GovernancePremiumMaxPct = value
	case GovernanceHoldDeclarations:
		v.GovernanceHoldDeclarations = value
	case GovernanceDeclarationSafetyDays:
		v.GovernanceDeclarationSafetyDays = value
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
	return &Service{repo: repo, defaults: defaults.withGovernanceDefaults(), now: time.Now}
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
