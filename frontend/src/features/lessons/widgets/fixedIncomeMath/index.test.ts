import { describe, expect, it } from 'vitest'
import { equivalentGrossRatePct, irOnYield, irRatePctForDays, netRatePct, productResult, winnerIndex } from '.'

describe('irRatePctForDays', () => {
    it.each([
        [1, 22.5],
        [180, 22.5],
        [181, 20],
        [360, 20],
        [361, 17.5],
        [720, 17.5],
        [721, 15],
        [3000, 15],
        [0, 22.5],
    ])('%i dias paga %f%%', (days, expected) => {
        expect(irRatePctForDays(days)).toBe(expected)
    })
})

describe('taxa equivalente', () => {
    it.each([
        [9.5, 22.5, 12.258],
        [9.5, 15, 11.176],
        [9, 15, 10.588],
    ])('isenta %f%% com IR %f%% equivale a %f%% bruto', (exempt, ir, expected) => {
        expect(equivalentGrossRatePct(exempt, ir)).toBeCloseTo(expected, 2)
    })

    it('taxa líquida de 12% com IR de 22,5% é 9,3%', () => {
        expect(netRatePct(12, 22.5)).toBeCloseTo(9.3, 6)
    })
})

describe('irOnYield', () => {
    it('R$ 1.000 de rendimento em 90 dias paga R$ 225 de IR', () => {
        const result = irOnYield(1000, 90)
        expect(result.ratePct).toBe(22.5)
        expect(result.tax).toBeCloseTo(225, 6)
        expect(result.net).toBeCloseTo(775, 6)
    })
})

describe('productResult e winnerIndex', () => {
    const cdb = { name: 'CDB', annualRatePct: 12, taxExempt: false }
    const lci = { name: 'LCI', annualRatePct: 9.5, taxExempt: true }

    it('em 360 dias o CDB de 12% (IR 20%) ainda vence a LCI isenta de 9,5%', () => {
        const [a, b] = [productResult(cdb, 10000, 360), productResult(lci, 10000, 360)]
        expect(a.tax).toBeCloseTo(a.grossYield * 0.2, 6)
        expect(b.tax).toBe(0)
        expect(a.netYield).toBeCloseTo(a.grossYield * 0.8, 6)
        // 12% * 0,8 = 9,6% > 9,5%: o CDB ainda vence por pouco.
        expect(winnerIndex([a, b])).toBe(0)
    })

    it('em 60 dias o isento vence', () => {
        expect(winnerIndex([productResult(cdb, 10000, 60), productResult(lci, 10000, 60)])).toBe(1)
    })

    it('empate devolve null', () => {
        const p = { name: 'A', annualRatePct: 10, taxExempt: true }
        expect(winnerIndex([productResult(p, 1000, 100), productResult(p, 1000, 100)])).toBeNull()
    })

    it('rendimento de 1 ano a 10% sobre 1.000 é 100', () => {
        expect(productResult({ name: 'x', annualRatePct: 10, taxExempt: true }, 1000, 365).netYield).toBeCloseTo(100, 6)
    })
})
