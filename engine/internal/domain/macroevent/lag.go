// lag.go implementa as três regras de defasagem preço↔fundamentos da spec
// 3.3 (linhas 106–109): a janela de corte que decide a que ciclo de
// relatório o efeito de fundamentos de um evento é atribuído, a soma com
// teto de eventos pendentes no mesmo ciclo, e a distribuição do efeito
// imediato de preço pelos dias simulados de sua duração.
package macroevent

import "math"

// ReportCutoffDays é a "janela de corte" da spec 3.3: um evento só afeta
// o relatório mais próximo se disparado com pelo menos esse número de
// dias simulados de antecedência do fechamento do ciclo — evita o cenário
// didaticamente estranho de "notícia de ontem virando balanço hoje".
const ReportCutoffDays = 2

// DefaultFundamentalsCapPct é o teto de magnitude total (escala
// percentual, mesma convenção de EffectRange) que a soma dos efeitos de
// fundamentos pendentes de uma empresa/setor no mesmo ciclo pode atingir
// (spec 3.3: "ex: ±40%") — valor ilustrativo citado como exemplo pela
// própria spec, sujeito à calibração da tarefa 8.1.
const DefaultFundamentalsCapPct = 40.0

// AssignReportDay decide a que dia simulado de relatório o efeito de
// fundamentos de um evento disparado em triggeredOnDay é atribuído: se
// faltam pelo menos ReportCutoffDays pro fechamento de nextReportDay (o
// próximo relatório da empresa/setor alvo), o efeito entra nesse ciclo;
// senão, é empurrado pro ciclo seguinte (nextReportDay +
// reportFrequencyDays) — spec 3.3, regra da "janela de corte".
func AssignReportDay(triggeredOnDay, reportFrequencyDays, nextReportDay int) int {
	if nextReportDay-triggeredOnDay >= ReportCutoffDays {
		return nextReportDay
	}
	return nextReportDay + reportFrequencyDays
}

// CombinePendingEffects soma (aditivo, spec 3.3: "múltiplos eventos no
// mesmo ciclo sobre a mesma empresa são somados") os efeitos pendentes de
// uma empresa/setor atribuídos ao mesmo ciclo de relatório, aplicando o
// teto capPct (tipicamente DefaultFundamentalsCapPct) por clamping nos
// dois sentidos — evita o resultado didaticamente absurdo de vários
// eventos severos empilhados sem limite.
func CombinePendingEffects(effects []float64, capPct float64) float64 {
	total := 0.0
	for _, e := range effects {
		total += e
	}
	if total > capPct {
		return capPct
	}
	if total < -capPct {
		return -capPct
	}
	return total
}

// IsPriceEffectActive confere se o efeito imediato de preço de um evento
// (triggeredOnDay, durationDays) ainda está ativo em currentDay — ativo
// do próprio dia do disparo até durationDays-1 dias depois, inclusive;
// currentDay == triggeredOnDay+durationDays já é o "dia seguinte ao fim
// da duração" em que o efeito para de ser aplicado (critério de aceite da
// tarefa 4.2).
func IsPriceEffectActive(triggeredOnDay, durationDays, currentDay int) bool {
	return currentDay >= triggeredOnDay && currentDay < triggeredOnDay+durationDays
}

// DailyPriceEffectMultiplier converte o efeito total de preço já
// amostrado (totalPct, escala percentual — SamplePriceEffectPct) num
// multiplicador diário a aplicar, uma vez por dia, sobre o preço que o
// GBM (equity.Series/equity.NextPrice, tarefa 3.1) já gerou naquele dia —
// empilha sobre o GBM, não o substitui. O efeito é espalhado igualmente
// pelos durationDays dias via (1+total)^(1/duration): compor esse
// multiplicador diário durationDays vezes reproduz exatamente 1+total no
// preço acumulado, então nenhum dia isolado sofre o choque inteiro de uma
// vez. Pressupõe durationDays >= 1 — sempre verdade pra qualquer Band
// conhecida (ver DurationDays), nunca chamada fora do resultado de
// DurationDays.
func DailyPriceEffectMultiplier(totalPct float64, durationDays int) float64 {
	total := totalPct / 100
	return math.Pow(1+total, 1/float64(durationDays))
}
