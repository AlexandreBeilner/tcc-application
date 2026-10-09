import { describe, expect, it } from 'vitest'
import { bondPurchase, breakevenInflationPct, breakevenWinner, ipcaPlusOutcome, ipcaPlusYears } from '.'

describe('bondPurchase', () => {
    it('2 anos a 11,75%: preço, deságio e bruto', () => {
        const result = bondPurchase(11.75, 2, 10_000)
        expect(result.unitPrice).toBeCloseTo(800.76, 2)
        expect(result.discount).toBeCloseTo(199.24, 2)
        expect(result.discountPct).toBeCloseTo(19.92, 2)
        expect(result.quantity).toBeCloseTo(12.49, 2)
        expect(result.grossAtMaturity).toBeCloseTo(12_488.06, 1)
        expect(result.irRatePct).toBe(15)
    })

    it.each([
        [0.25, 22.5],
        [0.75, 20],
        [1.5, 17.5],
        [3, 15],
    ])('prazo de %f ano usa IR de %f%%', (years, ir) => {
        expect(bondPurchase(11.75, years, 1000).irRatePct).toBe(ir)
    })

    it('líquido é menor que o bruto e desconta IR e custódia', () => {
        const result = bondPurchase(11.75, 2, 10_000)
        const grossGain = result.grossAtMaturity - 10_000
        expect(result.netGain).toBeCloseTo(grossGain - result.ir - result.custody, 6)
        expect(result.custody).toBeCloseTo(40, 6)
        expect(result.netAnnualPct).toBeLessThan(11.75)
    })
})

describe('ipcaPlusYears e ipcaPlusOutcome', () => {
    it('R$ 1.000 em 2 anos, IPCA 4%, taxa real 6%: R$ 1.215,29', () => {
        const years = ipcaPlusYears(1000, 6, 4, 2)
        expect(years).toHaveLength(2)
        expect(years[1].total).toBeCloseTo(1215.29, 2)
    })

    it('principal, inflação e juros reais somam o total', () => {
        for (const row of ipcaPlusYears(1000, 6, 5, 5)) {
            expect(row.principal + row.inflation + row.realInterest).toBeCloseTo(row.total, 6)
        }
    })

    it('IPCA 5% e taxa 6%: retorno nominal de 11,30%, não 11%', () => {
        const outcome = ipcaPlusOutcome(1000, 6, 5, 1)
        expect(outcome.gross).toBeCloseTo(1113, 6)
    })

    it('IR sobre o ganho nominal deixa o real líquido abaixo da taxa real', () => {
        const outcome = ipcaPlusOutcome(10_000, 6, 5, 5)
        expect(outcome.netAnnualPct).toBeCloseTo(9.9, 0)
        expect(outcome.realNetAnnualPct).toBeLessThan(6)
        expect(outcome.realNetAnnualPct).toBeGreaterThan(4)
    })
})

describe('breakevenInflationPct', () => {
    it.each([
        [12.5, 7.5, 4.65],
        [13, 7, 5.61],
        [11.75, 11.75, 0],
    ])('prefixado %f%% e real %f%% empatam em %f%% de inflação', (pre, real, expected) => {
        expect(breakevenInflationPct(pre, real)).toBeCloseTo(expected, 2)
    })

    it.each([
        [6, 5.61, 'ipca-plus'],
        [4, 5.61, 'prefixed'],
        [5.61, 5.61, 'tie'],
    ] as const)('inflação esperada %f contra equilíbrio %f: %s', (expected, breakeven, winner) => {
        expect(breakevenWinner(expected, breakeven)).toBe(winner)
    })
})
