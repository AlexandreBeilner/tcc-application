// Package ipca simula a inflação mensal (IPCA) — o fator macro que
// alimenta a atualização do Valor Nominal Atualizado (VNA) do Tesouro
// IPCA+ (TCC cap. 2.2.2, eq. 6 e 7, calculado em
// fixedincome.VNAMonthlySeries/VNAProjected).
package ipca

import (
	"math"
	"math/rand"
)

// Valores de referência ilustrativos (tarefa M.1, backlog-motor-mercado-
// realista) — a spec só diz "pequena variação em torno de uma meta" (3.2),
// sem número de referência (ao contrário da Selic_neutra=10%,
// selic.DefaultNeutralRate); mesmo tratamento de "default sujeito a
// calibração futura" já dado a fii.DefaultNetWorthSelicSensitivity/
// selic.DefaultInflationWeight (antes do recalibre do achado 007). Meta
// mensal escolhida pra compor perto de 4,5% a.a. (histórico da meta de
// inflação do Brasil), coerente com selic.DefaultNeutralRate = 10% (um
// juro real historicamente alto, mesmo raciocínio que já embasa esse
// default).
const (
	// DefaultMonthlyTarget é a meta de IPCA mensal simulada (decimal).
	DefaultMonthlyTarget = 0.00367
	// DefaultMaxDeviation é a banda máxima de variação mensal em torno da
	// meta (decimal).
	DefaultMaxDeviation = 0.0025
	// DefaultVolatility é o desvio-padrão do ruído mensal (decimal).
	DefaultVolatility = 0.0008
	// DefaultMonthDays é quantos dias simulados compõem um "mês" de IPCA —
	// o calendário simulado não modela meses de calendário real (dias
	// variáveis 28-31), mesma simplificação que
	// selic.CopomMeetingIntervalDays já aplica pro Copom (a cada N dias
	// fixos corridos, não uma data de calendário real).
	DefaultMonthDays = 30
)

// DefaultConfig monta a configuração de referência ilustrativa desta
// tarefa, variando só a seed por simulação — mesmo padrão de
// selic.DefaultConfig.
func DefaultConfig(seed int64) Config {
	return Config{
		MonthlyTarget: DefaultMonthlyTarget,
		MaxDeviation:  DefaultMaxDeviation,
		Volatility:    DefaultVolatility,
		Seed:          seed,
	}
}

// Config parametriza o IPCA mensal sintético: uma pequena variação em
// torno de uma meta configurável (spec 3.2 — "IPCA mensal sintético,
// pequena variação em torno de uma meta"). Diferente da Selic simulada
// (selic.Series), o IPCA aqui não reverte à média a partir do valor do mês
// anterior — cada mês é a meta mais ruído, sem memória —, por isso não há
// um campo `Initial` como em selic.Config.
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

// CurrentMonthIndex devolve o índice do mês simulado (0-based) ao qual o
// dia simulado de índice dayIndex (0-based) pertence — dayIndex 0..
// monthDays-1 é sempre o mês 0, monthDays..2*monthDays-1 é o mês 1, e
// assim por diante. Diferente de fundamentals.IsReportDay/
// selic.IsCopomMeetingDay (que só disparam no último dia de um ciclo),
// todo dia simulado já pertence a um mês desde o primeiro — é essa
// garantia que permite tick.Advance (tarefa M.1) persistir uma linha por
// dia com um IPCA mensal sempre definido, repetindo o mesmo valor todo dia
// dentro do mesmo mês simulado (decisão de cadência da tarefa M.1) e só
// mudando no dia em que o mês vira.
func CurrentMonthIndex(dayIndex, monthDays int) int {
	return dayIndex / monthDays
}

// MonthlyRate deriva o valor de IPCA mensal sintético (decimal) do mês de
// índice monthIndex (0-based), sem depender dos meses anteriores — o IPCA
// simulado não tem memória entre meses (cada mês é a meta mais ruído, ver
// doc do pacote), diferente da Selic (selic.NextCalendarRate, que precisa
// da taxa do dia anterior pra reverter à média). Por isso, ao contrário de
// selic.CalendarSeries/NextCalendarRate (duas implementações que precisam
// concordar dia a dia), aqui não existe uma "MonthlySeries de referência"
// pra manter compatível: MonthlyRate deriva sua própria rng de (cfg.Seed,
// monthIndex), mesmo padrão de decorrelação por índice de
// selic.NextCalendarRate — determinístico por mês sem precisar repassar
// pelos meses anteriores (condição necessária pra tick.Advance, que nunca
// regenera a série do zero, ver doc do pacote tick). Mesmos Config e
// monthIndex sempre produzem o mesmo valor (RNF08).
func MonthlyRate(cfg Config, monthIndex int) float64 {
	rng := rand.New(rand.NewSource(cfg.Seed + int64(monthIndex)))
	lowerBound := cfg.MonthlyTarget - cfg.MaxDeviation
	upperBound := cfg.MonthlyTarget + cfg.MaxDeviation
	rate := cfg.MonthlyTarget + rng.NormFloat64()*cfg.Volatility
	return clamp(rate, lowerBound, upperBound)
}

// accumulatedWindowMonths devolve quantos meses (1-12) entram na janela de
// acumulado terminando em monthIndex (inclusive) — 12 meses só depois do
// primeiro ano simulado (monthIndex >= 11); antes disso, só os meses já
// existentes (0 até monthIndex), mesmo raciocínio de Accumulated12m.
func accumulatedWindowMonths(monthIndex int) int {
	n := monthIndex + 1
	if n > 12 {
		n = 12
	}
	return n
}

// Accumulated12m compõe (produto, não soma simples) os valores mensais de
// IPCA (MonthlyRate) dos até 12 meses mais recentes terminando em
// monthIndex (inclusive) — se monthIndex ainda não completou 12 meses
// simulados (monthIndex < 11), compõe só os meses já existentes (0 até
// monthIndex): sem essa aproximação a Selic simulada (tarefa I.1) nunca
// reagiria ao IPCA antes do primeiro ano de simulação. Custo sempre O(12),
// nunca cresce com monthIndex — MonthlyRate não precisa replay desde o mês
// 0 (mesma vantagem de ser memoryless, ver doc de MonthlyRate).
func Accumulated12m(cfg Config, monthIndex int) float64 {
	if monthIndex < 0 {
		return 0
	}
	months := accumulatedWindowMonths(monthIndex)
	start := monthIndex - months + 1

	accumulated := 1.0
	for m := start; m <= monthIndex; m++ {
		accumulated *= 1 + MonthlyRate(cfg, m)
	}
	return accumulated - 1
}

// TargetForWindow compõe a meta mensal (cfg.MonthlyTarget) ao longo de
// `months` meses (mesma convenção "acumulado, não soma simples" de
// Accumulated12m) — a meta que corresponderia a uma janela de `months`
// meses, se o IPCA tivesse ficado exatamente na meta o tempo todo.
func TargetForWindow(cfg Config, months int) float64 {
	return math.Pow(1+cfg.MonthlyTarget, float64(months)) - 1
}

// AnnualizedTarget converte a meta mensal (cfg.MonthlyTarget) pra uma meta
// anualizada por composição — caso particular de TargetForWindow com 12
// meses, útil como referência de exibição (ex: "meta: 4,5% a.a.", tarefa
// M.4) independente do quanto a simulação já rodou.
func AnnualizedTarget(cfg Config) float64 {
	return TargetForWindow(cfg, 12)
}

// AccumulatedDeviation é o desvio do IPCA acumulado (Accumulated12m) frente
// à meta **composta pela mesma janela** (TargetForWindow com o mesmo
// número de meses de Accumulated12m, não sempre AnnualizedTarget/12 meses)
// — decimal (ex: 0.02 = 2 p.p. acima da meta), exatamente a convenção que
// selic.Config.InflationWeight/selic.NextCalendarRate já esperam (tarefa
// I.1) como ipcaAccumulatedDeviation. Usar sempre AnnualizedTarget (12
// meses fixos) aqui seria um viés sistemático antes do primeiro ano
// simulado: comparar um acumulado de poucos meses contra uma meta composta
// por 12 sempre pareceria "abaixo da meta", mesmo com o IPCA mensal
// rodando exatamente em cima dela — comparar contra a meta da MESMA janela
// elimina esse viés (deviation fica ~0 quando MonthlyRate ≈ MonthlyTarget,
// não importa quantos meses já existem).
func AccumulatedDeviation(cfg Config, monthIndex int) float64 {
	if monthIndex < 0 {
		return 0
	}
	months := accumulatedWindowMonths(monthIndex)
	return Accumulated12m(cfg, monthIndex) - TargetForWindow(cfg, months)
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
