// Package equity simula preços de ações do Mercado Ao Vivo via Movimento
// Browniano Geométrico (GBM), com drift e volatilidade calibrados pela
// `risk_class` do ativo (spec 3.2) — precursor da tarefa 3.2 (order book),
// que vai consumir essa série como cotação de referência.
package equity

import (
	"math"
	"math/rand"
)

// RiskClass espelha o campo `risk_class` de `assets` (varchar, valores
// "Conservador"/"Sofisticado" dos wireframes — spec 3.2).
type RiskClass string

const (
	RiskClassConservador RiskClass = "Conservador"
	RiskClassSofisticado RiskClass = "Sofisticado"
)

// BusinessDaysPerYear é a mesma base de 252 dias úteis das fórmulas de
// renda fixa (fixedincome.BusinessDaysPerYear) — a própria spec 3.2 cita
// essa convenção compartilhada pra conversão de volatilidade anual em
// diária do GBM.
const BusinessDaysPerYear = 252

// riskParams é a calibração por risk_class da tabela da spec 3.2:
// volatilidade anualizada (σ) e o prêmio de drift sobre a Selic simulada.
type riskParams struct {
	AnnualVolatility      float64
	DriftPremiumOverSelic float64 // decimal, ex: 0.03 para "Selic + 3% a.a."
}

var paramsByRiskClass = map[RiskClass]riskParams{
	RiskClassConservador: {AnnualVolatility: 0.22, DriftPremiumOverSelic: 0.03},
	RiskClassSofisticado: {AnnualVolatility: 0.45, DriftPremiumOverSelic: 0.07},
}

// Config parametriza a geração da série de preços de um ativo de renda
// variável.
type Config struct {
	InitialPrice float64
	RiskClass    RiskClass
	// SelicAnnualRates é a Selic simulada (% a.a., mesma unidade devolvida
	// por selic.Series — tarefa 2.2) no dia de cada passo da série: o
	// drift do GBM é a Selic do dia somada ao prêmio de risco da
	// risk_class (spec 3.2). len(SelicAnnualRates) determina quantos
	// preços Series gera — um por dia útil simulado.
	SelicAnnualRates []float64
	Seed             int64
}

// Series gera uma série determinística de preços via GBM (spec 3.2):
// mesmos Config e Seed sempre produzem exatamente a mesma série, a mesma
// garantia de reprodutibilidade já documentada em selic.Series (tarefa
// 2.2), necessária tanto pro determinismo do sandbox (RNF08) quanto pra
// auditabilidade do Mercado Ao Vivo. RiskClass desconhecida ou
// SelicAnnualRates vazio devolvem nil. O preço nunca chega a zero ou
// fica negativo — propriedade do próprio GBM (exponencial de um passeio
// aleatório), não uma trava adicional como a de selic.Series.
func Series(cfg Config) []float64 {
	params, ok := paramsByRiskClass[cfg.RiskClass]
	if !ok || len(cfg.SelicAnnualRates) == 0 {
		return nil
	}

	rng := rand.New(rand.NewSource(cfg.Seed))
	const dt = 1.0 / BusinessDaysPerYear
	dailyVolatility := params.AnnualVolatility / math.Sqrt(BusinessDaysPerYear)

	prices := make([]float64, len(cfg.SelicAnnualRates))
	price := cfg.InitialPrice
	for i, selicAnnualRate := range cfg.SelicAnnualRates {
		annualDrift := selicAnnualRate/100 + params.DriftPremiumOverSelic
		logReturn := (annualDrift-0.5*params.AnnualVolatility*params.AnnualVolatility)*dt +
			dailyVolatility*rng.NormFloat64()
		price *= math.Exp(logReturn)
		prices[i] = price
	}
	return prices
}
