package fundamentals

// Indicadores fundamentalistas de ação (RF21, lições 2.6.1–2.6.6 do
// currículo) — funções puras, sem I/O, mesmo padrão de
// ActualGrowthWithMacroEffect/IsReportDay (reportcycle.go). Cada uma devolve
// ok = false quando o denominador é inválido (zero ou, pra
// PriceToEarnings/PriceToBookValue, um LPA/VPA não-positivo — P/L e P/VP
// não têm leitura útil sobre prejuízo/patrimônio negativo nesta fase) em
// vez de propagar Inf/NaN pro payload HTTP — quem chama (GET /assets/:id,
// tarefa 4.8) trata ok = false do mesmo jeito que "empresa sem ciclo de
// relatório ainda": indicador omitido, não erro nem 0.

// LPA (lucro por ação) é net_income dividido pelas ações em circulação
// (variable_income_assets.outstanding_shares).
func LPA(netIncome float64, outstandingShares int64) (float64, bool) {
	if outstandingShares <= 0 {
		return 0, false
	}
	return netIncome / float64(outstandingShares), true
}

// VPA (valor patrimonial por ação) é net_equity dividido pelas ações em
// circulação.
func VPA(netEquity float64, outstandingShares int64) (float64, bool) {
	if outstandingShares <= 0 {
		return 0, false
	}
	return netEquity / float64(outstandingShares), true
}

// ROE (retorno sobre patrimônio líquido) é net_income sobre net_equity.
func ROE(netIncome, netEquity float64) (float64, bool) {
	if netEquity == 0 {
		return 0, false
	}
	return netIncome / netEquity, true
}

// EBITMargin (margem EBIT) é ebit sobre net_revenue.
func EBITMargin(ebit, netRevenue float64) (float64, bool) {
	if netRevenue == 0 {
		return 0, false
	}
	return ebit / netRevenue, true
}

// NetMargin (margem líquida) é net_income sobre net_revenue.
func NetMargin(netIncome, netRevenue float64) (float64, bool) {
	if netRevenue == 0 {
		return 0, false
	}
	return netIncome / netRevenue, true
}

// NetDebtToEBIT (dívida líquida / EBIT) é (gross_debt − cash_equivalents)
// sobre ebit — quanto maior, mais ciclos de resultado operacional a
// empresa levaria pra quitar a dívida líquida.
func NetDebtToEBIT(grossDebt, cashEquivalents, ebit float64) (float64, bool) {
	if ebit == 0 {
		return 0, false
	}
	return (grossDebt - cashEquivalents) / ebit, true
}

// PriceToEarnings (P/L) é o preço corrente do ativo (asset_quotes, tarefa
// 4.6) sobre LPA.
func PriceToEarnings(currentPrice, lpa float64) (float64, bool) {
	if lpa <= 0 {
		return 0, false
	}
	return currentPrice / lpa, true
}

// PriceToBookValue (P/VP) é o preço corrente do ativo sobre VPA.
func PriceToBookValue(currentPrice, vpa float64) (float64, bool) {
	if vpa <= 0 {
		return 0, false
	}
	return currentPrice / vpa, true
}
