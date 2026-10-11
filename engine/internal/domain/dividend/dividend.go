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
// uma fração ilustrativa da grandeza numérica própria de cada perfil
// (fii_details): net_worth pro perfil tijolo, portfolio_value pro perfil
// papel (tarefa 4.10 — mesma fórmula, só a coluna de origem muda por
// perfil), como proxy do resultado distribuído nesse ciclo.
package dividend

const (
	// DefaultEquityPayoutRatio é a fração ilustrativa do net_income do
	// ciclo distribuída como provento por ação — mesmo tratamento "sujeito
	// à calibração da tarefa 8.1" de fundamentals.DefaultNetMarginPct.
	DefaultEquityPayoutRatio = 0.5
	// FIIPayoutIntervalDays é a cadência de pagamento de proventos do FII:
	// mensal, como no mercado real (tarefa S.2) — independente do ciclo
	// trimestral de relatório (fundamentals.DefaultReportFrequencyDays).
	FIIPayoutIntervalDays = 30
	// DefaultPaymentLagDays é a defasagem, em dias simulados, entre a data
	// ex e o dia de pagamento de um provento — menor que o menor
	// intervalo entre proventos do mesmo ativo (30 dias, FII) pra sempre liquidar antes do próximo ciclo gerar
	// um novo provento sobre o mesmo ativo.
	DefaultPaymentLagDays = 5
	// DefaultPnDividendPremiumPct é o piso legal da vantagem mínima de
	// dividendo da ação PN sobre a ON (Lei 6.404/76, art. 17, reforma da
	// Lei 10.303/2001) — default de companies.pn_dividend_premium_pct
	// (tarefa J.2) pra empresa que não personaliza o percentual no próprio
	// estatuto.
	DefaultPnDividendPremiumPct = 10.0
)

// EquityValuePerShare deriva o provento por ação do ciclo pras duas classes
// de ação de uma empresa (tarefa J.2) — netIncome já calculado
// (fundamentals.DeriveFinancials, tarefa 4.8), onShares/pnShares (bases de
// ações em circulação de cada classe, do catálogo variable_income_assets)
// somadas a zero quando a empresa não tem aquela classe. O provento total do
// ciclo (netIncome * DefaultEquityPayoutRatio) é dividido entre as duas
// bases de forma que o valor por ação da PN seja exatamente pnPremiumPct%
// maior que o da ON (piso legal do art. 17 — chamador passa
// DefaultPnDividendPremiumPct quando a empresa não personaliza) — não uma
// simples divisão igualitária das duas bases.
//
// Empresa só-ON (pnShares = 0) reduz à mesma fórmula de antes desta tarefa
// (netIncome * payout / onShares) — sem quebra de compatibilidade. onValue é
// inválido (não deve ser lido) se a empresa não tem ativo ON — mesma regra
// vale pra pnValue sem ativo PN; ok = false só quando nenhuma das duas
// classes tem ação em circulação, mesmo tratamento de "sem dado, não
// divisão por zero" de fundamentals.LPA/VPA.
//
// payoutRatio é a fração do lucro distribuída (companies.payout_ratio_pct / 100,
// MO.6.10): cada empresa tem o seu, decidido em assembleia; ResolvePayoutRatio
// devolve o padrão (DefaultEquityPayoutRatio) pra empresa sem valor gravado.
func EquityValuePerShare(netIncome float64, onShares, pnShares int64, pnPremiumPct, payoutRatio float64) (onValue, pnValue float64, ok bool) {
	if onShares < 0 || pnShares < 0 || (onShares == 0 && pnShares == 0) {
		return 0, 0, false
	}

	pool := netIncome * payoutRatio
	premiumFactor := 1 + pnPremiumPct/100
	denom := float64(onShares) + float64(pnShares)*premiumFactor

	onValue = pool / denom
	pnValue = onValue * premiumFactor
	return onValue, pnValue, true
}

// ResolvePayoutRatio converte companies.payout_ratio_pct (em %) na fração usada pelas
// fórmulas. Valor não positivo (campo nunca preenchido, como nos testes) vale o padrão
// de antes da MO.6.10 (DefaultEquityPayoutRatio), mesmo tratamento de "zero é neutro" do
// quality_multiplier; a faixa válida (20% a 90% por padrão) é do cadastro e da assembleia.
func ResolvePayoutRatio(payoutRatioPct float64) float64 {
	if payoutRatioPct <= 0 {
		return DefaultEquityPayoutRatio
	}
	return payoutRatioPct / 100
}

// FIIValuePerShare deriva o provento por cota do ciclo a partir da
// grandeza numérica própria do perfil de FII (fii_details.net_worth pro
// tijolo, fii_details.portfolio_value pro papel desde a tarefa 4.10) — ver
// nota de implementação no doc do pacote. A fórmula é a mesma pros dois
// perfis, só a coluna de origem que o chamador passa muda. yieldPerCyclePct é a
// fração (em %) do valor-base distribuída a cada pagamento mensal, por
// segmento (fii.PayoutYieldPerCyclePct, achado 027).
func FIIValuePerShare(baseValue float64, outstandingShares int64, yieldPerCyclePct float64) (float64, bool) {
	if outstandingShares <= 0 {
		return 0, false
	}
	return baseValue * yieldPerCyclePct / 100 / float64(outstandingShares), true
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

// FIIPriceEffectPct (tarefa U.4, achado 024, fecha a reserva S.14) estima
// quanto o provento de FII recém-pago reduz o preço justo do Fundamentalista
// (fii.FairPrice, dividendEffectPct): provento por cota sobre o valor
// patrimonial por cota, em escala percentual negativa (mesma convenção de
// EquityPriceEffectPct), clampada em MinEquityPriceEffectPct. Diferente da
// ação, o provento de FII sai da renda recorrente do fundo e não do
// patrimônio (o VP nunca é decrementado), então quem chama só aplica o efeito
// durante uma banda curta pós data-ex e ele NÃO é permanente: fora da banda o
// preço justo volta ao valor-base, e o preço faz um dente de serra mensal.
// Sem VP por cota positivo, 0 (mesmo tratamento de "sem dado" de
// EquityPriceEffectPct).
func FIIPriceEffectPct(valuePerShare, baseValuePerShare float64) float64 {
	if baseValuePerShare <= 0 || valuePerShare <= 0 {
		return 0
	}
	effect := -(valuePerShare / baseValuePerShare) * 100
	if effect < MinEquityPriceEffectPct {
		return MinEquityPriceEffectPct
	}
	return effect
}

// MinEquityPriceEffectPct é o piso de EquityPriceEffectPct — o pool
// distribuído nunca reduz o patrimônio líquido em mais de 100% dele mesmo
// (payout > patrimônio não deveria acontecer com DefaultEquityPayoutRatio
// ilustrativo, mas a função não confia nisso). Não inventa um piso de
// preço novo: bot.FundamentalistFairPrice já clampa o resultado final
// não-positivo em bot.FundamentalistMinFairPrice, então -100% aqui só
// evita que o multiplicador (1 + efeito/100) vire negativo e inverta o
// sinal do preço justo por causa só deste termo.
const MinEquityPriceEffectPct = -100.0

// EquityPriceEffectPct estima quanto o provento de ação recém-pago (tarefa
// S.13, achado 018-023) reduz o preço justo do Fundamentalista
// (bot.FundamentalistFairPrice) — conservação de valor, não um degrau
// direto de preço (a mesma arquitetura que já veta multiplicador direto
// pra evento macro/balanço, ver doc do pacote tick): o pool distribuído
// (netIncome × payout da empresa) sai do caixa da empresa,
// reduzindo seu patrimônio líquido na mesma proporção — e como VPA =
// netEquity / ações em circulação, o preço justo cai por essa mesma fração
// percentual pra QUALQUER classe (ON ou PN), sem precisar saber a base de
// ações de cada uma (diferente de EquityValuePerShare acima, que precisa
// da base pra dividir o pool entre as duas classes). Escala percentual
// negativa (mesma convenção de macroevent.EffectRange/
// CompanyRoundContext.MacroEffectPct), clampada em MinEquityPriceEffectPct.
// netEquity <= 0 devolve 0 — sem patrimônio, sem razão calculável (mesmo
// tratamento de "sem dado, não divisão por zero" de fundamentals.VPA/ROE).
// Quem chama decide a janela de dias em que este efeito fica ativo
// (tick.companyRoundContexts) — esta função não sabe de calendário, só da
// proporção do valor distribuído.
func EquityPriceEffectPct(netIncome, netEquity, payoutRatio float64) float64 {
	if netEquity <= 0 {
		return 0
	}
	pool := netIncome * payoutRatio
	effect := -(pool / netEquity) * 100
	if effect < MinEquityPriceEffectPct {
		return MinEquityPriceEffectPct
	}
	return effect
}
