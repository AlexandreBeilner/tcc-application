package bot

import (
	"math"
	"sort"
)

// Giro-alvo por ativo (tarefa Q.9, achado 014). O volume de um ativo é
// aproximadamente turnos do dia vezes tamanho da ordem, e o número de turnos é
// limitado pelo custo do tick (Q.8), então o tamanho da ordem é a alavanca de
// volume que não custa nenhum comando SQL. Cada ativo tem um giro-alvo diário
// (fração do float) que cresce, de forma sublinear, com o valor de mercado, como
// o giro real: papel maior gira mais, mas não proporcionalmente. Valores
// ilustrativos, a validar na Q.4.
const (
	// MedianTurnoverPct é o giro-alvo do ativo de valor de mercado mediano.
	MedianTurnoverPct = 0.0025
	// MinTurnoverPct e MaxTurnoverPct limitam o giro-alvo: o piso é o mínimo
	// exigido do ativo mediano (0,15% com folga) e o teto é a faixa dos líderes.
	MinTurnoverPct = 0.002
	MaxTurnoverPct = 0.006
	// TurnoverSizeExponent é a elasticidade do giro ao valor de mercado
	// (giro proporcional a (valor/mediana)^0,3).
	TurnoverSizeExponent = 0.3
	// TurnoverPerCeiling é quanto do teto de tamanho de ordem vira volume por
	// turno, em média: uma ordem sorteia entre 1 e o teto (metade em média) e só
	// parte das ordens cruza a cotação do Market Maker. Medido na Q.9 (volume
	// por turno de 0,21 vezes o teto).
	TurnoverPerCeiling = 0.21
	// MaxOrderCeilingPct é o teto do teto de tamanho de ordem, em fração do
	// float: acima dele uma ordem passaria da cotação do Market Maker.
	MaxOrderCeilingPct = 0.012
)

// TargetTurnoverPct devolve o giro-alvo diário (fração do float) de um ativo de
// valor de mercado marketValue, dado o valor de mercado mediano do catálogo.
// Sem valor conhecido (marketValue ou medianValue zero), o giro é o mediano.
func TargetTurnoverPct(marketValue, medianValue float64) float64 {
	if marketValue <= 0 || medianValue <= 0 {
		return MedianTurnoverPct
	}
	target := MedianTurnoverPct * math.Pow(marketValue/medianValue, TurnoverSizeExponent)
	return math.Min(math.Max(target, MinTurnoverPct), MaxTurnoverPct)
}

// MedianMarketValue devolve o valor de mercado mediano dos ativos com valor
// conhecido (zero se nenhum tem).
func MedianMarketValue(universe []EquityForRound) float64 {
	values := make([]float64, 0, len(universe))
	for _, e := range universe {
		if e.MarketValue > 0 {
			values = append(values, e.MarketValue)
		}
	}
	if len(values) == 0 {
		return 0
	}
	sort.Float64s(values)
	mid := len(values) / 2
	if len(values)%2 == 1 {
		return values[mid]
	}
	return (values[mid-1] + values[mid]) / 2
}

// OrderCeilingPct devolve o teto de tamanho de ordem (fração do float) que faz
// um ativo com turns turnos no dia render targetTurnoverPct de giro:
// giro = turnos vezes TurnoverPerCeiling vezes o teto. Nunca passa de
// MaxOrderCeilingPct. Sem turno no dia, devolve o máximo.
func OrderCeilingPct(targetTurnoverPct float64, turns int) float64 {
	if turns <= 0 {
		return MaxOrderCeilingPct
	}
	return math.Min(targetTurnoverPct/(TurnoverPerCeiling*float64(turns)), MaxOrderCeilingPct)
}
