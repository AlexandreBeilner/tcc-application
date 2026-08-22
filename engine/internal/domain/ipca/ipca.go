// Package ipca simula a inflação mensal (IPCA) — o fator macro que
// alimenta a atualização do Valor Nominal Atualizado (VNA) do Tesouro
// IPCA+ (TCC cap. 2.2.2, eq. 6 e 7, calculado em
// fixedincome.VNAMonthlySeries/VNAProjected).
package ipca

import "math/rand"

// Config parametriza o IPCA mensal sintético: uma pequena variação em
// torno de uma meta configurável (spec 3.2 — "IPCA mensal sintético,
// pequena variação em torno de uma meta"). Diferente da Selic simulada
// (selic.Series), o IPCA aqui não reverte à média a partir do valor do mês
// anterior — cada mês é a meta mais ruído, sem memória —, por isso não há
// um campo `Initial` como em selic.Config. Os valores numéricos de
// calibração (meta, banda, volatilidade) ficam a cargo de quem chama, não
// de um `DefaultConfig`: a spec não documenta números de referência pro
// IPCA (ao contrário da Selic_neutra=10% e da tabela de risk_class do
// GBM), então travar um default aqui seria inventar um número que a
// tarefa 8.1 (calibração fina) ainda vai decidir.
type Config struct {
	// MonthlyTarget é a meta de IPCA mensal, em decimal (ex: 0.004 para
	// 0,4% a.m.).
	MonthlyTarget float64
	// MaxDeviation é a banda máxima de variação em torno da meta, em
	// decimal — a série nunca sai de [MonthlyTarget-MaxDeviation,
	// MonthlyTarget+MaxDeviation].
	MaxDeviation float64
	// Volatility é o desvio-padrão do ruído mensal, em decimal.
	Volatility float64
	Seed       int64
}

// MonthlySeries gera `months` valores determinísticos de IPCA mensal
// sintético (decimal, ex: 0.004 = 0,4% a.m.), sempre dentro da banda
// [MonthlyTarget-MaxDeviation, MonthlyTarget+MaxDeviation]. Mesmos Config e
// Seed sempre produzem a mesma série — mesma garantia de reprodutibilidade
// de selic.Series (RNF08).
func MonthlySeries(cfg Config, months int) []float64 {
	if months <= 0 {
		return nil
	}

	rng := rand.New(rand.NewSource(cfg.Seed))
	lowerBound := cfg.MonthlyTarget - cfg.MaxDeviation
	upperBound := cfg.MonthlyTarget + cfg.MaxDeviation

	rates := make([]float64, months)
	for i := range rates {
		rate := cfg.MonthlyTarget + rng.NormFloat64()*cfg.Volatility
		rates[i] = clamp(rate, lowerBound, upperBound)
	}
	return rates
}

func clamp(v, lowerBound, upperBound float64) float64 {
	if v < lowerBound {
		return lowerBound
	}
	if v > upperBound {
		return upperBound
	}
	return v
}
