package fundamentals

// DefaultReportFrequencyDays é o valor-padrão de `companies.report_
// frequency_days` (spec 3.3.1) — cadência quinzenal, igual pra todas as
// empresas nesta fase: a coluna existe por empresa no schema, mas a
// decisão de produto é um ciclo único e global disparado pelo Temporizador
// pra todas de uma vez, não escalonado por empresa (spec 3.3.1, "decisão
// tomada para simplificar o agendamento").
const DefaultReportFrequencyDays = 14

// IsReportDay confere se o dia de índice i (0-based) é dia de divulgação
// de relatório trimestral — o reportFrequencyDays-ésimo, 2×
// reportFrequencyDays-ésimo... dia real da simulação, contagem 1-based
// (mesma convenção de selic.CopomMeetingIntervalDays/isCopomMeetingDay,
// tarefa 3.3: o dia 1 nunca é relatório, a primeira divulgação só sai
// depois de reportFrequencyDays dias correndo). reportFrequencyDays é
// recebido como parâmetro, não fixado em DefaultReportFrequencyDays, pra
// respeitar o critério de aceite "`report_frequency_days` respeitado" —
// mesmo a decisão de produto sendo um valor global de 14 pra todas as
// empresas, a função em si não trava esse número.
func IsReportDay(i, reportFrequencyDays int) bool {
	return (i+1)%reportFrequencyDays == 0
}

// ReportSurprise é a diferença entre o crescimento efetivamente divulgado
// no relatório (actualGrowth — um elemento de GrowthSeries, já com o
// ruído idiossincrático) e o que já era esperado antes da divulgação
// (expectedGrowth — ExpectedGrowth, o componente sistêmico sem ruído).
// Positiva quando o resultado veio melhor que o esperado, negativa quando
// veio pior — é essa diferença, não o resultado em si, que a spec 3.3
// diz que deve mover o preço na divulgação (RF15/RF16).
func ReportSurprise(actualGrowth, expectedGrowth float64) float64 {
	return actualGrowth - expectedGrowth
}

// ReportDayPriceEffect converte uma ReportSurprise num efeito percentual
// de preço aplicado no dia da divulgação (spec 3.3: "se o resultado bate
// com o que o mercado já precificou, o preço quase não se move; se veio
// pior, cai mais; se veio melhor, sobe — efeito alívio"). Nos demais dias
// do ciclo (fora do dia do relatório) o preço não sofre este efeito — só
// segue a expectativa já embutida no drift do GBM (equity.Series).
// priceSensitivity converte a magnitude da surpresa (% de crescimento)
// num efeito de preço (%) — a spec descreve o mecanismo só
// qualitativamente, sem uma tabela numérica como a do GBM (tarefa 3.1),
// então este coeficiente, como SensitivityByRiskClass, fica sujeito à
// calibração fina da tarefa 8.1; 1.0 repassa a surpresa de crescimento
// 1:1 pro preço.
func ReportDayPriceEffect(surprise, priceSensitivity float64) float64 {
	return surprise * priceSensitivity
}
