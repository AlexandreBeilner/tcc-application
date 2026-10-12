package corporategovernance

import "math"

// CumulativeDelta é quanto da mudança total já deveria estar aplicado depois de `elapsed`
// ticks de uma rampa linear de `rampTicks`, em centésimos. Fora de [0, rampTicks] fica nas
// pontas, e em rampTicks vale exatamente o total.
func CumulativeDelta(total, rampTicks, elapsed int) int {
	if rampTicks <= 0 || elapsed >= rampTicks {
		return total
	}
	if elapsed <= 0 {
		return 0
	}
	return int(math.Round(float64(total) * float64(elapsed) / float64(rampTicks)))
}

// StepDelta é o que aplicar agora, indo de `applied` ticks já aplicados para `elapsed`.
// A soma de todos os passos é exatamente `total`, qualquer que seja o jeito que os ticks
// chegaram (um por vez ou recuperados em lote depois de uma parada).
func StepDelta(total, rampTicks, applied, elapsed int) int {
	return CumulativeDelta(total, rampTicks, elapsed) - CumulativeDelta(total, rampTicks, applied)
}

// ElapsedTicks é quantos ticks da rampa já aconteceram no dia `newDay`, dado que o efeito
// começou a valer em `startDay` (o primeiro tick aplicado é o do próprio `startDay`).
func ElapsedTicks(startDay, newDay, rampTicks int) int {
	elapsed := newDay - startDay + 1
	if elapsed < 0 {
		return 0
	}
	if elapsed > rampTicks {
		return rampTicks
	}
	return elapsed
}
