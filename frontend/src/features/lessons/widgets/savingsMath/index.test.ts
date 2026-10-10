import { describe, expect, it } from 'vitest'
import { compareSavingsToTesouroSelic, savingsAnnualRatePct, savingsMonthlyRatePct, savingsRule } from '.'

describe('savingsRule', () => {
    it.each([
        [14, 'fixed'],
        [8.51, 'fixed'],
        [8.5, 'share'],
        [2, 'share'],
    ] as const)('Selic %f%% usa a regra %s', (selic, expected) => {
        expect(savingsRule(selic)).toBe(expected)
    })
})

describe('savingsMonthlyRatePct / savingsAnnualRatePct', () => {
    it('acima de 8,5% com TR zero: 0,5% ao mês, 6,17% ao ano', () => {
        expect(savingsMonthlyRatePct(14, 0)).toBeCloseTo(0.5, 6)
        expect(savingsAnnualRatePct(14, 0)).toBeCloseTo(6.1678, 3)
    })

    it('a TR positiva se soma aos juros', () => {
        expect(savingsMonthlyRatePct(14, 0.15)).toBeCloseTo(0.6507, 3)
        expect(savingsAnnualRatePct(14, 0.15)).toBeCloseTo(8.094, 2)
    })

    it('com a Selic em 7%, usa 70% da Selic ao ano (4,9%)', () => {
        expect(savingsAnnualRatePct(7, 0)).toBeCloseTo(4.9, 6)
    })

    it('a regra dá um degrau na fronteira: 8,5% rende 5,95% e 8,51% rende 6,17%', () => {
        expect(savingsAnnualRatePct(8.5, 0)).toBeCloseTo(5.95, 6)
        expect(savingsAnnualRatePct(8.51, 0)).toBeCloseTo(6.1678, 3)
    })
})

describe('compareSavingsToTesouroSelic', () => {
    it('com Selic alta o Tesouro Selic vence mesmo pagando IR', () => {
        const r = compareSavingsToTesouroSelic({ amount: 10000, selicPct: 14, trMonthlyPct: 0.15, months: 12 })
        expect(r.rule).toBe('fixed')
        expect(r.tesouroIrRatePct).toBe(20)
        expect(r.tesouroGrossFinal).toBeCloseTo(11400, 4)
        expect(r.tesouroNetFinal).toBeCloseTo(11120, 4)
        expect(r.savingsFinal).toBeCloseTo(10809.4, 0)
        expect(r.savingsWins).toBe(false)
    })

    it('com Selic muito baixa a diferença quase some: menos de 0,2 ponto em 12 meses', () => {
        const r = compareSavingsToTesouroSelic({ amount: 10000, selicPct: 2, trMonthlyPct: 0, months: 12 })
        expect(r.rule).toBe('share')
        expect(r.tesouroIrRatePct).toBe(20)
        expect(r.savingsFinal).toBeCloseTo(10140, 0)
        expect(r.tesouroNetFinal).toBeCloseTo(10160, 0)
        expect(Math.abs(r.tesouroNetFinal - r.savingsFinal) / 10000).toBeLessThan(0.002)
    })
})
