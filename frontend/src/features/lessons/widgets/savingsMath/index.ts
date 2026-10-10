import { irOnYield } from '../fixedIncomeMath'

// Contas do widget `savings-vs-selic` (RC.5.2). Regra da poupança do fato
// `poupanca-regra` (Lei 12.703/2012, art. 1º, II): com a meta da Selic acima de
// 8,5% ao ano, juros de 0,5% ao mês; com a meta em 8,5% ou menos, 70% da meta
// ao ano, mensalizada. Nos dois casos soma a TR do mês. Mudar lá exige mudar aqui.
export const SAVINGS_SELIC_THRESHOLD_PCT = 8.5
export const SAVINGS_FIXED_MONTHLY_PCT = 0.5
export const SAVINGS_SELIC_SHARE = 0.7
const DAYS_PER_MONTH = 30

export type SavingsRule = 'fixed' | 'share'

export function savingsRule(selicTargetPct: number): SavingsRule {
    return selicTargetPct > SAVINGS_SELIC_THRESHOLD_PCT ? 'fixed' : 'share'
}

// Taxa mensal total (em %): juros da regra e TR do mês, compostos entre si.
export function savingsMonthlyRatePct(selicTargetPct: number, trMonthlyPct: number): number {
    const interest =
        savingsRule(selicTargetPct) === 'fixed'
            ? SAVINGS_FIXED_MONTHLY_PCT / 100
            : (1 + (SAVINGS_SELIC_SHARE * selicTargetPct) / 100) ** (1 / 12) - 1
    return ((1 + interest) * (1 + trMonthlyPct / 100) - 1) * 100
}

export function savingsAnnualRatePct(selicTargetPct: number, trMonthlyPct: number): number {
    return ((1 + savingsMonthlyRatePct(selicTargetPct, trMonthlyPct) / 100) ** 12 - 1) * 100
}

export interface SavingsVsSelicResult {
    rule: SavingsRule
    savingsAnnualPct: number
    savingsFinal: number
    tesouroGrossFinal: number
    tesouroIrRatePct: number
    tesouroNetFinal: number
    savingsWins: boolean
}

// Tesouro Selic aproximado em 100% da meta da Selic, com IR regressivo sobre o
// ganho (prazo em dias corridos, 30 por mês). Custódia e a diferença de cerca de
// 0,10 ponto entre a meta e a Selic efetiva ficam de fora, de propósito.
export function compareSavingsToTesouroSelic(input: {
    amount: number
    selicPct: number
    trMonthlyPct: number
    months: number
}): SavingsVsSelicResult {
    const { amount, selicPct, trMonthlyPct, months } = input
    const monthly = savingsMonthlyRatePct(selicPct, trMonthlyPct) / 100
    const savingsFinal = amount * (1 + monthly) ** months
    const tesouroGrossFinal = amount * (1 + selicPct / 100) ** (months / 12)
    const { ratePct, net } = irOnYield(tesouroGrossFinal - amount, months * DAYS_PER_MONTH)
    const tesouroNetFinal = amount + net
    return {
        rule: savingsRule(selicPct),
        savingsAnnualPct: savingsAnnualRatePct(selicPct, trMonthlyPct),
        savingsFinal,
        tesouroGrossFinal,
        tesouroIrRatePct: ratePct,
        tesouroNetFinal,
        savingsWins: savingsFinal > tesouroNetFinal,
    }
}
