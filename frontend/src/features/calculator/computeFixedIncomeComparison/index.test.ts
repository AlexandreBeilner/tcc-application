import { describe, expect, it } from 'vitest'
import { computeFixedIncomeComparison } from '.'

describe('computeFixedIncomeComparison', () => {
    it('produto isento: netValue sempre igual a grossValue, taxRate 0, mesmo com marketTaxRate > 0', () => {
        const result = computeFixedIncomeComparison({ name: 'LCI 90% CDI', annualRatePct: 9, taxExempt: true }, 10000, 365, 0.225)
        expect(result.taxRate).toBe(0)
        expect(result.netValue).toBeCloseTo(result.grossValue, 8)
    })

    it('produto tributado: netValue = amount + lucro líquido de IR, nunca igual ao bruto quando há lucro', () => {
        const result = computeFixedIncomeComparison({ name: 'CDB 110% CDI', annualRatePct: 11, taxExempt: false }, 10000, 365, 0.175)
        const profit = result.grossValue - 10000
        expect(result.taxRate).toBe(0.175)
        expect(result.netValue).toBeCloseTo(10000 + profit * (1 - 0.175), 8)
        expect(result.netValue).toBeLessThan(result.grossValue)
    })

    it('taxa zero: grossValue = netValue = amount, independente do prazo', () => {
        const result = computeFixedIncomeComparison({ name: 'X', annualRatePct: 0, taxExempt: false }, 5000, 720, 0.15)
        expect(result.grossValue).toBeCloseTo(5000, 8)
        expect(result.netValue).toBeCloseTo(5000, 8)
    })

    it('prazo maior com mesma taxa produz valor bruto maior (capitalização composta)', () => {
        const product = { name: 'X', annualRatePct: 10, taxExempt: true }
        const shortTerm = computeFixedIncomeComparison(product, 1000, 180, 0)
        const longTerm = computeFixedIncomeComparison(product, 1000, 720, 0)
        expect(longTerm.grossValue).toBeGreaterThan(shortTerm.grossValue)
    })
})
