// Package fii — reavaliação periódica de NetWorth do FII tijolo (tarefa
// G.2, backlog-motor-mercado-realista): substitui o número fixo desde o
// seed por uma variação sintética ligada à Selic simulada, mesmo mecanismo
// de custo de capital real (proposta seção 4) — juro alto pressiona a
// avaliação de imóveis pra baixo (custo de financiamento imobiliário mais
// caro, cap rate exigido mais alto), juro baixo valoriza. Vacância/segmento
// não entram nesta reavaliação (campos cadastrais fixos, fora do escopo
// desta tarefa). Não confundir com o comportamento de negociação dos bots
// (tarefa G.1, já entregue) — este pacote só recalcula o dado de fundamento
// que os bots leem; quem reage a ele negociando continua sendo o motor de
// bot/orderexecution.
package fii

import "math/rand"

// DefaultNetWorthSelicSensitivity/DefaultNetWorthNoiseStdDev são valores
// ilustrativos (mesma nota de fundamentals.SensitivityByRiskClass/
// DefaultNoiseStdDev — a spec/proposta não fecham uma tabela numérica pra
// isso, só o invariante qualitativo "juro alto pressiona pra baixo, juro
// baixo valoriza") — sujeitos à calibração fina da tarefa 8.1. FII não tem
// risk_class própria (spec 3.6), por isso uma sensibilidade única global,
// diferente da tabela por risk_class de fundamentals.
const (
	DefaultNetWorthSelicSensitivity = 0.03
	DefaultNetWorthNoiseStdDev      = 0.01
)

// NetWorthConfig parametriza a reavaliação periódica de NetWorth de um FII
// tijolo por ciclo (mesmo papel de fundamentals.Config pro ciclo de
// relatório de uma empresa).
type NetWorthConfig struct {
	// Sensitivity é o quanto a avaliação reage a um desvio da Selic em
	// relação à Selic neutra — tipicamente DefaultNetWorthSelicSensitivity.
	Sensitivity float64
	// NoiseStdDev é o desvio-padrão do ruído idiossincrático por ciclo
	// (variação de avaliação que não vem só do fator Selic).
	NoiseStdDev float64
	Seed        int64
}

// NetWorthVariation é o componente de variação (fração decimal, ex: -0.03
// para -3%) aplicado ao NetWorth vigente num ciclo — simétrico a
// fundamentals.ExpectedGrowth/NextGrowth, mas com o sinal invertido em
// relação ao desvio da Selic: juro acima da neutra reduz a avaliação (sinal
// negativo), juro abaixo aumenta (sinal positivo), sempre com um ruído
// idiossincrático somado por cima. cycleIndex (0-based, um por ciclo de
// fundamentals.IsReportDay verdadeiro) entra na derivação da rng junto com
// cfg.Seed, mesma técnica de fundamentals.NextGrowth — RNF08: mesmos
// cfg.Seed e cycleIndex sempre produzem a mesma variação.
func NetWorthVariation(cfg NetWorthConfig, cycleIndex int, selicAnnualRate, selicNeutral float64) float64 {
	rng := rand.New(rand.NewSource(cfg.Seed + int64(cycleIndex)))
	noise := rng.NormFloat64() * cfg.NoiseStdDev
	return -cfg.Sensitivity*(selicAnnualRate-selicNeutral) + noise
}

// NextNetWorth reavalia o NetWorth vigente de um FII tijolo por um único
// ciclo, a partir do último valor persistido (fii_details.net_worth) —
// nunca regenera uma série do zero (mesma decisão de arquitetura de
// equity.NextPrice/fundamentals.NextGrowth, tarefa 3.11): o Temporizador
// (tick.Advance) lê o NetWorth atual e encadeia só o próximo passo.
func NextNetWorth(cfg NetWorthConfig, cycleIndex int, currentNetWorth, selicAnnualRate, selicNeutral float64) float64 {
	return currentNetWorth * (1 + NetWorthVariation(cfg, cycleIndex, selicAnnualRate, selicNeutral))
}
