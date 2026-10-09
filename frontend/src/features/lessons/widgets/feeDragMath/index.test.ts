import { describe, expect, it } from 'vitest'
import { compareFeeDrag, netAnnualReturnPct, simulateFeeDrag } from '.'

describe('feeDragMath', () => {
    it('retorno líquido é o bruto menos a taxa', () => {
        expect(netAnnualReturnPct(10, 2)).toBe(8)
    })

    it('sem aporte, R$ 10.000 a 8% ao ano por 20 anos viram 10.000 x 1,08^20', () => {
        const result = simulateFeeDrag({ initial: 10000, monthly: 0, grossReturnPct: 10, feePct: 2, years: 20 })
        expect(result.finalValue).toBeCloseTo(10000 * 1.08 ** 20, 2)
        expect(result.points).toHaveLength(21)
        expect(result.invested).toBe(10000)
    })

    it('taxa zero com retorno zero só soma os aportes', () => {
        const result = simulateFeeDrag({ initial: 1000, monthly: 100, grossReturnPct: 0, feePct: 0, years: 2 })
        expect(result.finalValue).toBeCloseTo(3400, 6)
        expect(result.gain).toBeCloseTo(0, 6)
    })

    it('2% de taxa em 20 anos consome mais de um quarto do ganho do produto de taxa baixa', () => {
        const comparison = compareFeeDrag({ initial: 10000, monthly: 0, grossReturnPct: 10, years: 20 }, 0, 2)
        expect(comparison.differenceBRL).toBeCloseTo(10000 * (1.1 ** 20 - 1.08 ** 20), 2)
        expect(comparison.gainShareLostPct).toBeGreaterThan(25)
        expect(comparison.differencePct).toBeGreaterThan(30)
    })

    it('taxas iguais não geram diferença', () => {
        const comparison = compareFeeDrag({ initial: 5000, monthly: 200, grossReturnPct: 9, years: 10 }, 1, 1)
        expect(comparison.differenceBRL).toBeCloseTo(0, 6)
    })
})
