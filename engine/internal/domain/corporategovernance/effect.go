package corporategovernance

import (
	"errors"
	"fmt"
	"math"

	"tcc-investimentos/engine/internal/domain/catalog"
)

// Metric é o botão de fundamento que um efeito mexe.
type Metric string

const (
	// MetricBaseGrowthPct é companies.base_growth_pct (crescimento base, em pontos percentuais).
	MetricBaseGrowthPct Metric = "base_growth_pct"
	// MetricQualityMultiplier é companies.quality_multiplier (margem e alavancagem da empresa).
	MetricQualityMultiplier Metric = "quality_multiplier"
	// MetricPayoutRatioPct é companies.payout_ratio_pct (fração do lucro distribuída em cada
	// balanço, em %; MO.6.10). Em centésimos de ponto percentual: 5000 = 50%.
	MetricPayoutRatioPct Metric = "payout_ratio_pct"
)

// Group é o conjunto de métricas que dividem o mesmo cooldown: a empresa só muda de novo
// depois de `cooldown` dias simulados da última mudança do MESMO grupo (decisão do autor,
// 2026-10-11: o payout tem cooldown próprio, independente dos fundamentos).
type Group string

const (
	// GroupFundamentals reúne crescimento e qualidade.
	GroupFundamentals Group = "fundamentals"
	// GroupPayout reúne o que decide o destino do lucro (hoje só o payout).
	GroupPayout Group = "payout"
)

// GroupOf devolve o grupo de cooldown de uma métrica.
func GroupOf(m Metric) Group {
	if m == MetricPayoutRatioPct {
		return GroupPayout
	}
	return GroupFundamentals
}

// MaxEffectsPerOption é quantos efeitos, em alavancas diferentes, uma opção pode ter.
const MaxEffectsPerOption = 2

// ErrInvalidEffects: a lista de efeitos de uma opção não obedece o limite ou repete alavanca.
var ErrInvalidEffects = errors.New("uma opção tem de 1 a 2 efeitos, em alavancas diferentes")

// ValidateEffects confere a lista de efeitos de uma opção: de 1 a MaxEffectsPerOption, cada
// um válido, sem repetir a métrica.
func ValidateEffects(effects []Effect) error {
	if len(effects) < 1 || len(effects) > MaxEffectsPerOption {
		return ErrInvalidEffects
	}
	seen := map[Metric]bool{}
	for _, e := range effects {
		if err := e.Validate(); err != nil {
			return err
		}
		if seen[e.Metric] {
			return ErrInvalidEffects
		}
		seen[e.Metric] = true
	}
	return nil
}

var (
	ErrInvalidMetric    = errors.New("métrica de efeito desconhecida")
	ErrInvalidDirection = errors.New("direção do efeito precisa ser +1 ou -1")
	ErrInvalidIntensity = errors.New("intensidade do efeito precisa estar em (0, 1]")
)

// Effect é o que a opção vencedora de uma pauta faz com a empresa: a métrica, o sentido e
// que fração da faixa máxima usar. Vem pronto do backend (catálogo de pautas), nunca com
// valor absoluto: o tamanho máximo da mudança é sempre decisão do motor (Limits).
type Effect struct {
	Metric    Metric
	Direction int
	Intensity float64
}

// Validate confere o efeito antes de qualquer cálculo.
func (e Effect) Validate() error {
	if e.Metric != MetricBaseGrowthPct && e.Metric != MetricQualityMultiplier && e.Metric != MetricPayoutRatioPct {
		return fmt.Errorf("%w: %q", ErrInvalidMetric, e.Metric)
	}
	if e.Direction != 1 && e.Direction != -1 {
		return ErrInvalidDirection
	}
	if math.IsNaN(e.Intensity) || e.Intensity <= 0 || e.Intensity > 1 {
		return ErrInvalidIntensity
	}
	return nil
}

// Limits é a faixa máxima de mudança por decisão, em centésimos (enginesetting).
type Limits struct {
	GrowthStep  int
	QualityStep int
	// PayoutStep é o degrau do payout em centésimos de p.p. (1000 = 10 p.p.); PayoutMin e
	// PayoutMax são a faixa válida do payout da empresa, também em centésimos de p.p.
	PayoutStep int
	PayoutMin  int
	PayoutMax  int
}

// TotalDelta é a mudança total de uma decisão, com sinal, em centésimos: a faixa máxima da
// métrica vezes a intensidade, arredondada. Nunca passa da faixa.
func TotalDelta(e Effect, l Limits) int {
	step := l.GrowthStep
	switch e.Metric {
	case MetricQualityMultiplier:
		step = l.QualityStep
	case MetricPayoutRatioPct:
		step = l.PayoutStep
	}
	return e.Direction * int(math.Round(float64(step)*e.Intensity))
}

// ToHundredths converte o valor de uma coluna numeric(_,2) para centésimos inteiros.
func ToHundredths(v float64) int {
	return int(math.Round(v * 100))
}

// FromHundredths é o inverso de ToHundredths.
func FromHundredths(h int) float64 {
	return float64(h) / 100
}

// ErrOutOfRange: o valor resultante sairia do que o catálogo aceita para a métrica.
var ErrOutOfRange = errors.New("o efeito levaria o fundamento para fora da faixa válida")

// CheckValue confere se um valor (em centésimos) é válido para a métrica, com as mesmas
// regras do cadastro de empresa (catalog.ValidateBaseGrowthPct / ValidateQualityMultiplier).
//
// O payout não tem faixa fixa (é parâmetro editável): use CheckValueWithLimits.
func CheckValue(metric Metric, hundredths int) error {
	return CheckValueWithLimits(metric, hundredths, Limits{})
}

// CheckValueWithLimits é CheckValue com a faixa do payout vinda dos parâmetros.
func CheckValueWithLimits(metric Metric, hundredths int, l Limits) error {
	value := FromHundredths(hundredths)
	var err error
	switch metric {
	case MetricBaseGrowthPct:
		err = catalog.ValidateBaseGrowthPct(value)
	case MetricQualityMultiplier:
		err = catalog.ValidateQualityMultiplier(value)
	case MetricPayoutRatioPct:
		if hundredths < l.PayoutMin || hundredths > l.PayoutMax {
			err = fmt.Errorf("payout precisa estar entre %v%% e %v%%", FromHundredths(l.PayoutMin), FromHundredths(l.PayoutMax))
		}
	default:
		return ErrInvalidMetric
	}
	if err != nil {
		return fmt.Errorf("%w: %v", ErrOutOfRange, err)
	}
	return nil
}
