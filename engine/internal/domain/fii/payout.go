package fii

// Taxa de provento por segmento (achado 027, pontos-em-aberto-decisao-produto.md).
//
// O provento mensal é uma fração do valor patrimonial por cota (VP), não do
// preço. Com uma taxa única (1,1% do VP), o Dividend Yield sobre o preço
// dependia do P/VP do segmento (DY anual = 12 × taxa ÷ P/VP): lajes (P/VP 0,75)
// chegava a 17,7% e logística (0,85) a 15,6%, acima da faixa plausível de ~8% a
// 15%. Aqui a taxa deriva do P/VP-base de cada segmento, de modo que todos
// nasçam com o mesmo Dividend Yield anual-alvo sobre o preço.

// TargetAnnualDividendYieldPct é o Dividend Yield anual-alvo (em %) sobre o
// preço na Selic neutra, o mesmo de um FII de papel com taxa de 1,1% ao mês
// (12 × 1,1 = 13,2). Ilustrativo, sujeito à calibração fina da tarefa 8.1.
const TargetAnnualDividendYieldPct = 13.2

// PayoutsPerYear é o número de pagamentos mensais por ano
// (dividend.FIIPayoutIntervalDays = 30 dias, tarefa S.2).
const PayoutsPerYear = 12

// PayoutYieldPerCyclePct devolve a fração (em %) do VP por cota distribuída a
// cada pagamento mensal: TargetAnnualDividendYieldPct × P/VP-base ÷ 12. Usa o
// P/VP-base (Selic neutra), não o P/VP-alvo deslocado pela Selic do dia: a
// taxa é uma característica do fundo e não oscila com o juro. Segmento vazio
// ou desconhecido usa o padrão do tijolo (mesmo fallback de
// TargetPriceToBook); tipo desconhecido devolve ErrUnknownFairPriceType.
func PayoutYieldPerCyclePct(fiiType Type, segment string) (float64, error) {
	base, err := basePriceToBook(fiiType, segment)
	if err != nil {
		return 0, err
	}
	return TargetAnnualDividendYieldPct * base / PayoutsPerYear, nil
}
