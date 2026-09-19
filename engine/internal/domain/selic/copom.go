package selic

import (
	"math"
	"math/rand"
)

// CopomMeetingIntervalDays é a cadência das reuniões simuladas do "Copom"
// que ajustam a curva de juros (spec 3.2, 3.2.1) — 21 dias reais,
// disparadas pelo ator Temporizador (ainda não implementado; aqui o
// calendário é só a regra "a cada N dias", sem agendamento real).
const CopomMeetingIntervalDays = 21

// CopomStepIncrement é o incremento mínimo de uma decisão do Copom
// simulado (tarefa I.2, proposta seção 6) — toda mudança de Selic simulada
// num dia de reunião é sempre um múltiplo deste valor (0,25 p.p., o mesmo
// passo do Copom real), nunca um valor decimal contínuo saído direto do
// ruído gaussiano da regra de reação.
const CopomStepIncrement = 0.25

// quantizeStep arredonda `step` (p.p., positivo ou negativo) pro múltiplo
// mais próximo de CopomStepIncrement — replica o hábito real do Copom de
// decidir entre passos "redondos" (0,25/0,50/0,75/1,00 p.p.) em vez de
// aplicar direto o valor fracionário que a regra de reação sugeriu.
func quantizeStep(step float64) float64 {
	return math.Round(step/CopomStepIncrement) * CopomStepIncrement
}

// reactionStep calcula o tamanho (não quantizado) do movimento de uma
// decisão do Copom simulado — reversão à média + reação ao desvio do IPCA
// acumulado frente à meta (tarefa I.1, `peso_inflação × (IPCA_acumulado −
// meta_IPCA)`, proposta seção 6) + ruído. ipcaAccumulatedDeviation = 0
// (ou cfg.InflationWeight = 0) anula o termo novo por completo,
// reproduzindo exatamente a fórmula anterior à tarefa I.1.
func reactionStep(cfg Config, currentRate, ipcaAccumulatedDeviation float64, rng *rand.Rand) float64 {
	noise := rng.NormFloat64() * cfg.Volatility
	return cfg.ReversionSpeed*(cfg.Neutral-currentRate) + cfg.InflationWeight*ipcaAccumulatedDeviation + noise
}

// CalendarSeries gera a curva de juros de curto prazo — Vasicek
// simplificado, mesma fórmula de reversão à média de Series (tarefa 2.2),
// mais a regra de reação ao IPCA (tarefa I.1) e a quantização em passos de
// CopomStepIncrement (tarefa I.2) — discretizada pelo calendário de
// reuniões do Copom: a taxa só muda no dia de uma "decisão" (a cada
// CopomMeetingIntervalDays dias reais, TCC cap. 2.2.3/spec 3.2.1) e fica
// constante nos dias entre uma reunião e outra — diferente de Series, que
// reage todo dia. É essa taxa entre reuniões que serve de referência tanto
// pro rendimento diário da renda fixa pós-fixada (Tesouro Selic, CDB/LCI/
// LCA %CDI) quanto pra marcação a mercado dos títulos prefixados
// (currentMarketRate de fixedincome.EarlyRedemption, tarefa 2.4) — as duas
// pontas do critério de aceite da tarefa 3.3.
//
// ipcaAccumulatedDeviations é o desvio do IPCA acumulado frente à meta
// (decimal, ex: 0.02 para 2 p.p. acima), um valor por dia — só lido nos
// dias de reunião (IsCopomMeetingDay); índice fora do slice (incluindo
// slice nil, pra quem ainda não tem série de IPCA disponível) vale 0, sem
// erro. mesmos Config e Seed sempre produzem exatamente a mesma curva
// (mesma garantia de reprodutibilidade de Series, RNF08). A taxa nunca
// fica negativa (Selic não é negativa).
func CalendarSeries(cfg Config, days int, ipcaAccumulatedDeviations []float64) []float64 {
	if days <= 0 {
		return nil
	}

	rng := rand.New(rand.NewSource(cfg.Seed))
	curve := make([]float64, days)
	rate := cfg.Initial
	for i := range curve {
		if IsCopomMeetingDay(i) {
			step := reactionStep(cfg, rate, deviationAt(ipcaAccumulatedDeviations, i), rng)
			rate += quantizeStep(step)
			if rate < 0 {
				rate = 0
			}
		}
		curve[i] = rate
	}
	return curve
}

// deviationAt devolve ipcaAccumulatedDeviations[i], ou 0 se o índice está
// fora do slice (incluindo slice nil) — mesma convenção de "dado ausente
// vale neutro" já usada em outros pontos do motor.
func deviationAt(ipcaAccumulatedDeviations []float64, i int) float64 {
	if i < 0 || i >= len(ipcaAccumulatedDeviations) {
		return 0
	}
	return ipcaAccumulatedDeviations[i]
}

// IsCopomMeetingDay confere se o dia de índice i (0-based) é uma reunião do
// Copom — o 21º, 42º, 63º... dia real da simulação, contagem 1-based (o
// dia 1 nunca é reunião; a primeira decisão só sai depois de 21 dias
// correndo, consistente com "a cada 21 dias reais" da spec 3.2.1, não uma
// decisão já no primeiro dia). Exportada (era isCopomMeetingDay até a
// tarefa 3.11) porque o Temporizador (pacote tick) precisa sinalizar
// "hoje é dia de reunião" sem duplicar essa regra.
func IsCopomMeetingDay(i int) bool {
	return (i+1)%CopomMeetingIntervalDays == 0
}

// NextCalendarRate avança a curva de juros por um único dia, a partir da
// taxa persistida no fim do dia anterior — usado pelo Temporizador (tarefa
// 3.11), que nunca regenera a série do zero a cada tick (decisão de
// arquitetura confirmada em 2026-08-22, backlog 3.11): diferente de
// CalendarSeries (que recalcula a curva inteira desde o dia 0 com uma única
// rng contínua), aqui cada dia deriva sua própria rng de
// (cfg.Seed, dayIndex) — determinístico por dia sem precisar repassar por
// todos os dias anteriores, condição necessária pra ler só o último estado
// persistido e continuar dali (RNF08 continua valendo: mesmos cfg.Seed e
// dayIndex sempre produzem a mesma taxa). A taxa só muda em dia de reunião
// do Copom (IsCopomMeetingDay); nos demais dias devolve currentRate
// inalterada, mesma regra de CalendarSeries. ipcaAccumulatedDeviation é o
// desvio do IPCA acumulado frente à meta (tarefa I.1) só relevante no dia
// de reunião — decimal, 0 quando não disponível/aplicável. O movimento é
// quantizado pro múltiplo mais próximo de CopomStepIncrement (tarefa I.2)
// antes de somar a currentRate. Nunca fica negativa.
func NextCalendarRate(cfg Config, dayIndex int, currentRate, ipcaAccumulatedDeviation float64) float64 {
	if !IsCopomMeetingDay(dayIndex) {
		return currentRate
	}

	rng := rand.New(rand.NewSource(cfg.Seed + int64(dayIndex)))
	step := reactionStep(cfg, currentRate, ipcaAccumulatedDeviation, rng)
	rate := currentRate + quantizeStep(step)
	if rate < 0 {
		rate = 0
	}
	return rate
}
