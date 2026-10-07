import { describe, expect, it } from 'vitest'
import { annualFromMonthlyPct, debtGrowth, payOrInvest, simulateDebt } from '.'

describe('debtMath', () => {
    it('sem pagar nada, R$ 1.000 a 8% ao mês viram cerca de R$ 2.518 em 12 meses', () => {
        expect(debtGrowth(1000, 8, 12)).toBeCloseTo(2518.17, 2)
    })

    it('8% ao mês equivalem a cerca de 152% ao ano', () => {
        expect(annualFromMonthlyPct(8)).toBeCloseTo(151.82, 2)
    })

    it('pagamento que não cobre os juros do mês nunca quita', () => {
        const result = simulateDebt({ balance: 1000, monthlyRatePct: 10, payment: 50 })
        expect(result.months).toBeNull()
        expect(result.points[24].balance).toBeGreaterThan(1000)
    })

    it('quita em prazo finito e soma os juros pagos', () => {
        const result = simulateDebt({ balance: 1000, monthlyRatePct: 2, payment: 200 })
        expect(result.months).toBe(6)
        expect(result.totalPaid).toBeCloseTo(1000 + result.totalInterest, 6)
        expect(result.points[result.points.length - 1].balance).toBe(0)
    })

    it('pagar mais reduz prazo e juros totais', () => {
        const slow = simulateDebt({ balance: 5000, monthlyRatePct: 6, payment: 400 })
        const fast = simulateDebt({ balance: 5000, monthlyRatePct: 6, payment: 800 })
        expect(fast.months!).toBeLessThan(slow.months!)
        expect(fast.totalInterest).toBeLessThan(slow.totalInterest)
    })

    it('dívida a 5% ao mês perde para investimento de 14% ao ano líquido de 15% de IR', () => {
        const result = payOrInvest({ amount: 1000, debtMonthlyPct: 5, investAnnualPct: 14, irPct: 15 })
        expect(result.verdict).toBe('pay-debt')
        expect(result.investNetAnnualPct).toBeCloseTo(11.9, 6)
        expect(result.debtAfterYear).toBeGreaterThan(result.investedAfterYear)
    })

    it('juro de dívida muito baixo deixa o investimento na frente', () => {
        expect(payOrInvest({ amount: 1000, debtMonthlyPct: 0.5, investAnnualPct: 14, irPct: 15 }).verdict).toBe('invest')
    })
})
