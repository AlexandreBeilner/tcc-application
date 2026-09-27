package fundamentals

// DefaultReportFrequencyDays é o valor-padrão de `companies.report_
// frequency_days` (spec 3.3.1) — um trimestre real (91 dias de calendário
// simulado, tarefa S.2, decisão do autor de 2026-09-26; antes era quinzenal,
// o que com 3% de crescimento por ciclo dava ~+40% a.a.), igual pra todas as
// empresas nesta fase: a coluna existe por empresa no schema, mas a
// decisão de produto é um ciclo único e global disparado pelo Temporizador
// pra todas de uma vez, não escalonado por empresa (spec 3.3.1, "decisão
// tomada para simplificar o agendamento").
const DefaultReportFrequencyDays = 91

// IsReportDay confere se o dia de índice i (0-based) é dia de divulgação
// de relatório trimestral — o reportFrequencyDays-ésimo, 2×
// reportFrequencyDays-ésimo... dia real da simulação, contagem 1-based
// (mesma convenção de selic.CopomMeetingIntervalDays/isCopomMeetingDay,
// tarefa 3.3: o dia 1 nunca é relatório, a primeira divulgação só sai
// depois de reportFrequencyDays dias correndo). reportFrequencyDays é
// recebido como parâmetro, não fixado em DefaultReportFrequencyDays, pra
// respeitar o critério de aceite "`report_frequency_days` respeitado" —
// mesmo a decisão de produto sendo um valor global de 91 pra todas as
// empresas, a função em si não trava esse número.
func IsReportDay(i, reportFrequencyDays int) bool {
	return (i+1)%reportFrequencyDays == 0
}

// ActualGrowthWithMacroEffect incorpora o efeito agregado de eventos
// macro pendentes (macroevent.CombinePendingEffects, tarefa 4.2 — já
// somado e limitado a ±macroevent.DefaultFundamentalsCapPct) no
// crescimento real de um ciclo: o resultado divulgado (net_revenue do
// ciclo, RevenueSeries) precisa refletir o efeito macro embutido, não só o
// crescimento sintético puro sem o evento. combinedMacroEffectPct vem em
// escala percentual (ex: -12.5 para -12,5%, mesma convenção de
// macroevent.EffectRange/price_effect_pct/fundamentals_effect_pct);
// baseGrowth vem em fração decimal (ex: 0.03 para 3%, mesma convenção de
// GrowthSeries/NextGrowth/ExpectedGrowth) — por isso a divisão por 100
// antes de somar. Não importa o pacote macroevent (só o parâmetro já
// combinado) pelo mesmo motivo de equity.Series não importar selic:
// mantém fundamentals decoplado, função pura e testável sem depender de
// outro conceito de domínio. baseGrowth normalmente vem de GrowthSeries/
// NextGrowth já chamada antes. O efeito de preço do resultado divulgado
// (melhor/pior que o esperado, spec 3.3/RF15-RF16) não é mais uma fórmula
// direta (fundamentals.ReportSurprise/ReportDayPriceEffect, removidas na
// tarefa F.1 do backlog-motor-mercado-realista) — nasce da negociação real
// do arquétipo Fundamentalista (tick.companyRoundContexts/
// bot.FundamentalistFairPrice), que reavalia o preço justo contra o
// net_revenue recém-divulgado (já incorporando este efeito macro) todo dia
// de relatório.
func ActualGrowthWithMacroEffect(baseGrowth, combinedMacroEffectPct float64) float64 {
	return baseGrowth + combinedMacroEffectPct/100
}
