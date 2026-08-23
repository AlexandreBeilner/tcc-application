// Package dividend implementa a geração periódica de proventos e o
// pagamento aos usuários com posição na data ex (RF21, lição 2.7 do
// currículo) — dividend_events existe desde a migration 000001 (tarefa
// 1.3) mas nunca foi implementado até aqui (tarefa 4.9): nenhuma geração,
// nenhum pagamento, accounts.total_dividends_received nunca creditado, o
// evento dividend_payment do enum market_event_type nunca usado.
//
// Decisão de implementação (a spec não detalha a mecânica de provento de
// FII além de citar Dividend Yield como indicador exigido, RF21): ações
// distribuem uma fração ilustrativa do net_income do ciclo
// (fundamentals.DeriveFinancials, tarefa 4.8) — mesmo tratamento "sujeito
// à calibração da tarefa 8.1" já dado às margens/alavancagem ilustrativas
// de fundamentals. FII não é vinculado a uma company (spec 3.6: só ação
// tem company_id) e por isso não tem net_income nenhum — usa em vez disso
// uma fração ilustrativa de net_worth (fii_details), a única grandeza
// própria de FII já modelada no catálogo, como proxy do resultado
// distribuído nesse ciclo.
package dividend

const (
	// DefaultEquityPayoutRatio é a fração ilustrativa do net_income do
	// ciclo distribuída como provento por ação — mesmo tratamento "sujeito
	// à calibração da tarefa 8.1" de fundamentals.DefaultNetMarginPct.
	DefaultEquityPayoutRatio = 0.5
	// DefaultFIIYieldPerCyclePct é a fração ilustrativa (%) de net_worth
	// distribuída por ciclo de 14 dias (fundamentals.DefaultReportFrequencyDays)
	// pra FII — ver nota de implementação no doc do pacote. 0.5% a cada 14
	// dias equivale a um Dividend Yield ilustrativo de ~13% a.a., ordem de
	// grandeza plausível pra FII no mercado real.
	DefaultFIIYieldPerCyclePct = 0.5
	// DefaultPaymentLagDays é a defasagem, em dias simulados, entre a data
	// ex e o dia de pagamento de um provento — menor que o ciclo de
	// relatório (14 dias) pra sempre liquidar antes do próximo ciclo gerar
	// um novo provento sobre o mesmo ativo.
	DefaultPaymentLagDays = 5
)

// EquityValuePerShare deriva o provento por ação do ciclo — netIncome já
// calculado (fundamentals.DeriveFinancials, tarefa 4.8), outstandingShares
// do catálogo (variable_income_assets). Mesmo formato (float64, bool) de
// fundamentals.LPA/VPA — ok = false sem ações em circulação, em vez de
// propagar divisão por zero.
func EquityValuePerShare(netIncome float64, outstandingShares int64) (float64, bool) {
	if outstandingShares <= 0 {
		return 0, false
	}
	return netIncome * DefaultEquityPayoutRatio / float64(outstandingShares), true
}

// FIIValuePerShare deriva o provento por cota do ciclo a partir de
// net_worth (fii_details) — ver nota de implementação no doc do pacote.
func FIIValuePerShare(netWorth float64, outstandingShares int64) (float64, bool) {
	if outstandingShares <= 0 {
		return 0, false
	}
	return netWorth * DefaultFIIYieldPerCyclePct / 100 / float64(outstandingShares), true
}

// Yield (Dividend Yield, RF21 — exigido tanto pra Ações quanto pros dois
// perfis de FII) é a soma dos proventos por ação/cota pagos nos últimos 12
// meses sobre o preço corrente do ativo. ok = false sem cotação corrente
// válida, mesmo tratamento de fundamentals.PriceToEarnings/PriceToBookValue.
func Yield(sumLast12Months, currentPrice float64) (float64, bool) {
	if currentPrice <= 0 {
		return 0, false
	}
	return sumLast12Months / currentPrice, true
}
