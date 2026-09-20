package fixedincome

import "math"

// PostFixedFactor calcula o fator de crescimento acumulado (ex: 1.0347
// para +3,47%) de um produto pós-fixado (Tesouro Selic, CDB/LCI/LCA/CRI/
// CRA %CDI — fixedincome.IndexPosFixado) ao longo de dailySelicAnnualRates
// — um elemento por dia útil decorrido, cada um a Selic simulada (% a.a.,
// mesma escala de selic.Config) vigente NAQUELE dia. Diferente de
// PrefixedPrice (uma taxa travada na compra), o rendimento pós-fixado é a
// composição de um fator DIÁRIO por dia útil — cada elemento da série pode
// ser diferente do anterior (a Selic muda em dias de reunião do Copom),
// então o resultado acompanha o caminho real percorrido pela Selic
// simulada, não uma média ou uma foto única (TCC lição 1.2: "o rendimento
// acompanha a Selic diariamente"). pctOfIndex é o percentual do índice
// contratado (ex: 110 para "110% do CDI", 100 para Tesouro Selic — 1:1
// com a Selic).
//
// Série vazia devolve 1.0 (nenhum dia decorrido, nenhum crescimento) —
// nunca erro: fixedincomeexecution.Redeem no mesmo dia da compra é um
// cenário válido (resgate sem rendimento nenhum ainda).
func PostFixedFactor(pctOfIndex float64, dailySelicAnnualRates []float64) float64 {
	factor := 1.0
	for _, annualRate := range dailySelicAnnualRates {
		effectiveAnnualRate := (annualRate / 100) * (pctOfIndex / 100)
		dailyRate := math.Pow(1+effectiveAnnualRate, 1.0/BusinessDaysPerYear) - 1
		factor *= 1 + dailyRate
	}
	return factor
}

// PostFixedValue aplica PostFixedFactor sobre principal (o valor investido,
// já em R$) — o "rendimento acumulado" de verdade de uma posição
// pós-fixada, consumido por fixedincomeexecution.Redeem em vez da
// marcação a mercado (fixedincome.EarlyRedemption, que só faz sentido pra
// um título prefixado — TCC cap. 2.2.3).
func PostFixedValue(principal, pctOfIndex float64, dailySelicAnnualRates []float64) float64 {
	return principal * PostFixedFactor(pctOfIndex, dailySelicAnnualRates)
}
