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
)

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
	if e.Metric != MetricBaseGrowthPct && e.Metric != MetricQualityMultiplier {
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
}

// TotalDelta é a mudança total de uma decisão, com sinal, em centésimos: a faixa máxima da
// métrica vezes a intensidade, arredondada. Nunca passa da faixa.
func TotalDelta(e Effect, l Limits) int {
	step := l.GrowthStep
	if e.Metric == MetricQualityMultiplier {
		step = l.QualityStep
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
func CheckValue(metric Metric, hundredths int) error {
	value := FromHundredths(hundredths)
	var err error
	switch metric {
	case MetricBaseGrowthPct:
		err = catalog.ValidateBaseGrowthPct(value)
	case MetricQualityMultiplier:
		err = catalog.ValidateQualityMultiplier(value)
	default:
		return ErrInvalidMetric
	}
	if err != nil {
		return fmt.Errorf("%w: %v", ErrOutOfRange, err)
	}
	return nil
}
