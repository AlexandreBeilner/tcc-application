// Contas dos widgets de dívida (RC.4.5). Funções puras. Juros compostos contra quem deve:
// a cada mês os juros incidem sobre o saldo, que já inclui os juros anteriores, e o
// pagamento é descontado depois (ordem usual de cobrança).

export const MAX_DEBT_MONTHS = 600

export interface DebtInput {
    balance: number
    monthlyRatePct: number
    payment: number
}

export interface DebtPoint {
    month: number
    balance: number
}

export interface DebtResult {
    // `null` quando o pagamento não cobre nem os juros do mês e a dívida só cresce.
    months: number | null
    totalInterest: number
    totalPaid: number
    firstMonthInterest: number
    points: DebtPoint[]
}

export function simulateDebt({ balance, monthlyRatePct, payment }: DebtInput): DebtResult {
    const rate = monthlyRatePct / 100
    const firstMonthInterest = balance * rate
    const points: DebtPoint[] = [{ month: 0, balance }]
    if (payment <= firstMonthInterest) {
        // A dívida não cai: mostra 24 meses de crescimento em vez de rodar sem fim.
        let current = balance
        for (let month = 1; month <= 24; month += 1) {
            current = current + current * rate - payment
            points.push({ month, balance: current })
        }
        return { months: null, totalInterest: current - balance + payment * 24, totalPaid: payment * 24, firstMonthInterest, points }
    }
    let current = balance
    let paid = 0
    let interest = 0
    let month = 0
    while (current > 0.005 && month < MAX_DEBT_MONTHS) {
        month += 1
        const monthInterest = current * rate
        interest += monthInterest
        const pay = Math.min(payment, current + monthInterest)
        paid += pay
        current = current + monthInterest - pay
        points.push({ month, balance: Math.max(0, current) })
    }
    return { months: month, totalInterest: interest, totalPaid: paid, firstMonthInterest, points }
}

// Saldo de uma dívida de `balance` sem nenhum pagamento depois de `months` meses.
export function debtGrowth(balance: number, monthlyRatePct: number, months: number): number {
    return balance * (1 + monthlyRatePct / 100) ** months
}

export function annualFromMonthlyPct(monthlyPct: number): number {
    return ((1 + monthlyPct / 100) ** 12 - 1) * 100
}

export interface PayOrInvestInput {
    amount: number
    debtMonthlyPct: number
    investAnnualPct: number
    irPct: number
}

export interface PayOrInvestResult {
    debtAnnualPct: number
    investNetAnnualPct: number
    // Valor em 12 meses: a dívida mantida cresce; o dinheiro investido rende líquido de IR.
    debtAfterYear: number
    investedAfterYear: number
    verdict: 'pay-debt' | 'invest' | 'tie'
}

export function payOrInvest({ amount, debtMonthlyPct, investAnnualPct, irPct }: PayOrInvestInput): PayOrInvestResult {
    const debtAnnualPct = annualFromMonthlyPct(debtMonthlyPct)
    const investNetAnnualPct = investAnnualPct * (1 - irPct / 100)
    const diff = debtAnnualPct - investNetAnnualPct
    return {
        debtAnnualPct,
        investNetAnnualPct,
        debtAfterYear: amount * (1 + debtAnnualPct / 100),
        investedAfterYear: amount * (1 + investNetAnnualPct / 100),
        verdict: Math.abs(diff) < 0.005 ? 'tie' : diff > 0 ? 'pay-debt' : 'invest',
    }
}
