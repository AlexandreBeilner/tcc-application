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

// Valores ilustrativos do ciclo de relatórios (tarefa 3.14) — a spec 3.2.2/
// 3.3 não fecha estes números como fechou pro GBM (tabela da tarefa 3.1),
// só os invariantes qualitativos (Sofisticado mais sensível à Selic,
// surpresa positiva sobe o preço/negativa desce). Mesmo tratamento de
// SensitivityByRiskClass/selic.DefaultNeutralRate/tick.DefaultInitialPrice:
// sujeitos à calibração fina da tarefa 8.1.
const (
	// DefaultBaseGrowth é o crescimento_base ilustrativo aplicado a toda
	// empresa seedada, na ausência de uma calibração por empresa (a spec
	// não define currículo de crescimento por empresa nesta fase).
	DefaultBaseGrowth = 0.03
	// DefaultNoiseStdDev é o desvio-padrão ilustrativo do ruído
	// idiossincrático por ciclo de relatório.
	DefaultNoiseStdDev = 0.02
	// DefaultReportPriceSensitivity converte ReportSurprise num efeito de
	// preço no dia do relatório (ReportDayPriceEffect) — 1.5 amplifica a
	// surpresa de crescimento um pouco além de 1:1, coerente com o "efeito
	// alívio" qualitativo descrito na spec 3.3.
	DefaultReportPriceSensitivity = 1.5
	// DefaultBaseRevenue é a receita líquida de partida de uma empresa sem
	// nenhuma linha de company_fundamentals gerada ainda — mesmo papel que
	// tick.DefaultInitialPrice cumpre pro preço de um ativo sem cotação
	// anterior.
	DefaultBaseRevenue = 1_000_000.0

	// Os cinco coeficientes abaixo (tarefa 4.8) derivam net_income/ebit/
	// net_equity/gross_debt/cash_equivalents a partir de net_revenue já
	// calculado (RevenueSeries/NextGrowth) — igual a DefaultBaseGrowth e
	// SensitivityByRiskClass, são margens/alavancagem ilustrativas sem
	// tabela numérica fechada pela spec, sujeitas à calibração da tarefa
	// 8.1. EBITMargin > NetMargin reflete o efeito de impostos/juros entre
	// os dois indicadores, mesmo invariante contábil qualquer companhia
	// real respeita.

	// DefaultNetMarginPct é a margem líquida ilustrativa (net_income /
	// net_revenue) aplicada a toda empresa seedada.
	DefaultNetMarginPct = 0.10
	// DefaultEBITMarginPct é a margem EBIT ilustrativa (ebit / net_revenue)
	// — maior que DefaultNetMarginPct pelo mesmo motivo que EBIT > net
	// income numa demonstração de resultado real (antes de juros/impostos).
	DefaultEBITMarginPct = 0.18
	// DefaultEquityToRevenueRatio converte net_revenue em net_equity
	// ilustrativo (patrimônio líquido tipicamente maior que a receita de um
	// único ciclo trimestral).
	DefaultEquityToRevenueRatio = 1.2
	// DefaultDebtToEquityRatio converte net_equity em gross_debt ilustrativo
	// — alavancagem moderada (dívida bruta menor que o patrimônio líquido).
	DefaultDebtToEquityRatio = 0.4
	// DefaultCashToRevenueRatio converte net_revenue em cash_equivalents
	// ilustrativo.
	DefaultCashToRevenueRatio = 0.15
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

// NextGrowth avança o crescimento trimestral de uma empresa por um único
// ciclo de relatório, a partir do estado persistido — usado pelo
// Temporizador (tarefa 3.14) em vez de GrowthSeries, que nunca regenera a
// série do zero a cada ciclo (mesma decisão de arquitetura de
// selic.NextCalendarRate/equity.NextPrice, tarefa 3.11). cycleIndex
// (0-based, um por ciclo de fundamentals.IsReportDay verdadeiro — não por
// dia simulado) entra na derivação da rng junto com cfg.Seed pra que o
// ruído desse ciclo seja determinístico sem precisar repassar pelos ciclos
// anteriores (RNF08: mesmos cfg.Seed e cycleIndex sempre produzem o mesmo
// crescimento). selicAnnualRate/selicNeutral são a Selic simulada do dia do
// relatório e a âncora de reversão à média, mesma fonte que GrowthSeries
// usa via selicAnnualRates/selicNeutral.
func NextGrowth(cfg Config, cycleIndex int, selicAnnualRate, selicNeutral float64) float64 {
	rng := rand.New(rand.NewSource(cfg.Seed + int64(cycleIndex)))
	noise := rng.NormFloat64() * cfg.NoiseStdDev
	return ExpectedGrowth(cfg, selicAnnualRate, selicNeutral) + noise
}

// RevenueSeries encadeia uma série de crescimento (GrowthSeries) numa
// trajetória de receita líquida (`net_revenue` de company_fundamentals),
// aplicando cada taxa multiplicativamente sobre o ciclo anterior — mesmo
// papel que fixedincome.VNAMonthlySeries cumpre pro VNA do Tesouro IPCA+
// (tarefa 3.4): transforma uma série de taxas numa série de nível.
// Derivar net_income/ebit/net_equity/gross_debt/cash_equivalents a partir
// da receita é DeriveFinancials (tarefa 4.8).
func RevenueSeries(baseRevenue float64, growth []float64) []float64 {
	revenues := make([]float64, len(growth))
	revenue := baseRevenue
	for i, g := range growth {
		revenue *= 1 + g
		revenues[i] = revenue
	}
	return revenues
}

// Financials são os seis campos de uma linha de company_fundamentals já
// derivados (tarefa 4.8) — insumo dos indicadores de ação de RF21
// (indicators.go).
type Financials struct {
	NetRevenue      float64
	NetIncome       float64
	EBIT            float64
	NetEquity       float64
	GrossDebt       float64
	CashEquivalents float64
}

// DeriveFinancials deriva net_income/ebit/net_equity/gross_debt/
// cash_equivalents a partir de net_revenue já calculado (RevenueSeries/
// NextGrowth), aplicando os coeficientes ilustrativos DefaultNetMarginPct/
// DefaultEBITMarginPct/DefaultEquityToRevenueRatio/
// DefaultDebtToEquityRatio/DefaultCashToRevenueRatio — mesmo tratamento
// "sujeito à calibração 8.1" já dado a SensitivityByRiskClass/
// priceSensitivity (tarefa 3.5/3.6). Usada pelo Temporizador (tarefa 3.14)
// a cada ciclo de relatório, junto de RevenueSeries/NextGrowth.
func DeriveFinancials(netRevenue float64) Financials {
	netEquity := netRevenue * DefaultEquityToRevenueRatio
	return Financials{
		NetRevenue:      netRevenue,
		NetIncome:       netRevenue * DefaultNetMarginPct,
		EBIT:            netRevenue * DefaultEBITMarginPct,
		NetEquity:       netEquity,
		GrossDebt:       netEquity * DefaultDebtToEquityRatio,
		CashEquivalents: netRevenue * DefaultCashToRevenueRatio,
	}
}
