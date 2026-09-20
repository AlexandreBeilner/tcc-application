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

// Valores de referência calibrados na tarefa L.2 (backlog-motor-mercado-
// realista) — até aqui `Config` não tinha nenhum default (ver doc do tipo
// acima), porque `VNAProjected`/`IPCAPrice` não tinham consumidor real no
// motor. L.2 liga os dois em `fixedincomeexecution.Purchase`/`Redeem`
// (Tesouro IPCA+), o que exige uma calibração concreta pra existir. Meta
// de 3% a.a. reflete a meta contínua de inflação do CMN vigente (substitui
// o regime de metas anuais escalonadas); convertida pra mensal via
// composição ((1+0,03)^(1/12) - 1), não divisão simples por 12 (mesmo
// cuidado de juros compostos do resto do pacote `fixedincome`).
// MaxDeviation/Volatility aproximam a banda de tolerância oficial (meta ±
// 1,5 p.p. a.a.) sem reproduzi-la exatamente — "ajustável conforme
// calibração" (semana 8 do roadmap), mesmo tratamento dado a
// selic.DefaultNeutralRate/DefaultReversionSpeed/DefaultVolatility.
const (
	// DefaultMonthlyTarget é a meta de IPCA mensal (decimal) — (1.03)^(1/12)
	// - 1 ≈ 0,4% a.m., arredondado.
	DefaultMonthlyTarget = 0.0025
	// DefaultMaxDeviation é a banda mensal em torno da meta — aproxima o
	// intervalo de tolerância oficial (1,5 a 4,5% a.a.) sem replicar a
	// conversão exata mês a mês.
	DefaultMaxDeviation = 0.0015
	// DefaultVolatility é o desvio-padrão do ruído mensal — menor que
	// MaxDeviation de propósito, pra clamp (MonthlySeries) raramente ser o
	// fator dominante, e a "pequena variação em torno de uma meta" da spec
	// 3.2 continuar visível na série.
	DefaultVolatility = 0.0008
)

// DefaultConfig monta a configuração de referência calibrada nesta tarefa
// (L.2), variando só a seed (RNF08 — mesma seed sempre reproduz a mesma
// série, mesmo raciocínio de selic.DefaultConfig).
func DefaultConfig(seed int64) Config {
	return Config{
		MonthlyTarget: DefaultMonthlyTarget,
		MaxDeviation:  DefaultMaxDeviation,
		Volatility:    DefaultVolatility,
		Seed:          seed,
	}
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
