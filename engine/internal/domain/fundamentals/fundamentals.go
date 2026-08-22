// Package fundamentals gera os fundamentos sintéticos das empresas
// (`company_fundamentals`) com coerência macro em relação à Selic simulada
// (spec 3.2.2) — o fator sistêmico e contínuo que replica, na simulação, o
// mecanismo de transmissão da política monetária (Selic alta →
// desaceleração econômica → resultados corporativos mais fracos).
package fundamentals

import (
	"math/rand"

	"tcc-investimentos/engine/internal/domain/equity"
)

// SensitivityByRiskClass são valores ilustrativos de sensibilidade a
// desvios da Selic por `risk_class` do ativo vinculado à empresa (spec
// 3.2.2: setores cíclicos/mais alavancados — Sofisticado — são mais
// sensíveis a juros altos que setores de fluxo de caixa mais estável —
// Conservador). A spec não fecha uma tabela numérica pra isso como fechou
// pro GBM (tarefa 3.1) — só o invariante relativo (Sofisticado mais
// sensível que Conservador) é exigido —, então estes números, como
// selic.DefaultNeutralRate, ficam sujeitos à calibração fina da tarefa
// 8.1, não são "a" resposta fechada da spec.
var SensitivityByRiskClass = map[equity.RiskClass]float64{
	equity.RiskClassConservador: 0.02,
	equity.RiskClassSofisticado: 0.06,
}

// Config parametriza a geração de fundamentos sintéticos de uma empresa
// por ciclo de relatório.
type Config struct {
	// BaseGrowth é o crescimento_base do ciclo, em decimal (ex: 0.03 para
	// 3% no trimestre), antes do ajuste pelo fator Selic e do ruído.
	BaseGrowth float64
	// Sensitivity é a sensibilidade a desvios da Selic em relação à Selic
	// neutra — tipicamente um valor de SensitivityByRiskClass pra
	// risk_class do ativo vinculado à empresa.
	Sensitivity float64
	// NoiseStdDev é o desvio-padrão do ruído idiossincrático por ciclo.
	NoiseStdDev float64
	Seed        int64
}

// ExpectedGrowth é o componente sistêmico do crescimento de um ciclo —
// crescimento_base ajustado pelo fator Selic (spec 3.2.2), sem o ruído
// idiossincrático de GrowthSeries. É esse valor, conhecido/precificado
// antes da divulgação do relatório, que serve de referência de
// "expectativa" pra ReportSurprise (tarefa 3.6): o preço reage ao
// resultado divulgado só na medida em que ele diverge desta expectativa,
// não ao resultado em si (spec 3.3).
func ExpectedGrowth(cfg Config, selicAnnualRate, selicNeutral float64) float64 {
	return cfg.BaseGrowth - cfg.Sensitivity*(selicAnnualRate-selicNeutral)
}

// GrowthSeries gera uma taxa de crescimento trimestral sintética por ciclo
// de relatório (spec 3.2.2):
//
//	crescimento = crescimento_base − sensibilidade × (Selic_atual − Selic_neutra) + ruído
//
// selicAnnualRates é a Selic simulada (% a.a., mesma unidade devolvida por
// selic.Series/selic.CalendarSeries) vigente em cada ciclo — um elemento
// por ciclo de relatório, não por dia; a amostragem da curva diária na
// cadência de 14 dias é responsabilidade de quem compõe esta série (tarefa
// 3.6). selicNeutral é a mesma âncora de reversão à média da Selic
// simulada (ex: selic.DefaultNeutralRate). GrowthSeries recebe os dois
// como parâmetros em vez de importar o pacote selic — mesma decisão de
// desacoplamento já tomada em equity.Series (tarefa 3.1): mantém a função
// pura/determinística por seed sem acoplar dois conceitos de domínio.
func GrowthSeries(cfg Config, selicAnnualRates []float64, selicNeutral float64) []float64 {
	if len(selicAnnualRates) == 0 {
		return nil
	}

	rng := rand.New(rand.NewSource(cfg.Seed))
	growth := make([]float64, len(selicAnnualRates))
	for i, selicRate := range selicAnnualRates {
		noise := rng.NormFloat64() * cfg.NoiseStdDev
		growth[i] = ExpectedGrowth(cfg, selicRate, selicNeutral) + noise
	}
	return growth
}

// RevenueSeries encadeia uma série de crescimento (GrowthSeries) numa
// trajetória de receita líquida (`net_revenue` de company_fundamentals),
// aplicando cada taxa multiplicativamente sobre o ciclo anterior — mesmo
// papel que fixedincome.VNAMonthlySeries cumpre pro VNA do Tesouro IPCA+
// (tarefa 3.4): transforma uma série de taxas numa série de nível.
// Derivar net_income/ebit/gross_debt/cash_equivalents a partir da receita
// (margens, alavancagem) é fora do escopo desta tarefa — fica pra quem
// popular `company_fundamentals` de fato (seed/ciclo de relatórios).
func RevenueSeries(baseRevenue float64, growth []float64) []float64 {
	revenues := make([]float64, len(growth))
	revenue := baseRevenue
	for i, g := range growth {
		revenue *= 1 + g
		revenues[i] = revenue
	}
	return revenues
}
