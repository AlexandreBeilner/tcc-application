package selic

import "math/rand"

// CopomMeetingIntervalDays é a cadência das reuniões simuladas do "Copom"
// que ajustam a curva de juros (spec 3.2, 3.2.1) — 21 dias reais,
// disparadas pelo ator Temporizador (ainda não implementado; aqui o
// calendário é só a regra "a cada N dias", sem agendamento real).
const CopomMeetingIntervalDays = 21

// CalendarSeries gera a curva de juros de curto prazo — Vasicek
// simplificado, mesma fórmula de reversão à média de Series (tarefa 2.2) —
// discretizada pelo calendário de reuniões do Copom: a taxa só muda no dia
// de uma "decisão" (a cada CopomMeetingIntervalDays dias reais, TCC cap.
// 2.2.3/spec 3.2.1) e fica constante nos dias entre uma reunião e outra —
// diferente de Series, que reage todo dia. É essa taxa entre reuniões que
// serve de referência tanto pro rendimento diário da renda fixa
// pós-fixada (Tesouro Selic, CDB/LCI/LCA %CDI) quanto pra marcação a
// mercado dos títulos prefixados (currentMarketRate de
// fixedincome.EarlyRedemption, tarefa 2.4) — as duas pontas do critério de
// aceite da tarefa 3.3.
//
// mesmos Config e Seed sempre produzem exatamente a mesma curva (mesma
// garantia de reprodutibilidade de Series, RNF08). A taxa nunca fica
// negativa (Selic não é negativa).
func CalendarSeries(cfg Config, days int) []float64 {
	if days <= 0 {
		return nil
	}

	rng := rand.New(rand.NewSource(cfg.Seed))
	curve := make([]float64, days)
	rate := cfg.Initial
	for i := range curve {
		if IsCopomMeetingDay(i) {
			noise := rng.NormFloat64() * cfg.Volatility
			rate += cfg.ReversionSpeed*(cfg.Neutral-rate) + noise
			if rate < 0 {
				rate = 0
			}
		}
		curve[i] = rate
	}
	return curve
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
// inalterada, mesma regra de CalendarSeries. Nunca fica negativa.
func NextCalendarRate(cfg Config, dayIndex int, currentRate float64) float64 {
	if !IsCopomMeetingDay(dayIndex) {
		return currentRate
	}

	rng := rand.New(rand.NewSource(cfg.Seed + int64(dayIndex)))
	noise := rng.NormFloat64() * cfg.Volatility
	rate := currentRate + cfg.ReversionSpeed*(cfg.Neutral-currentRate) + noise
	if rate < 0 {
		rate = 0
	}
	return rate
}
