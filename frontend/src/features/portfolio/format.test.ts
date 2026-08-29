import { describe, expect, it } from 'vitest'
import { formatCurrency, formatPercentage } from './format'

describe('formatCurrency', () => {
    it('formata em BRL', () => {
        expect(formatCurrency(10000)).toBe('R$ 10.000,00')
    })

    it('formata zero', () => {
        expect(formatCurrency(0)).toBe('R$ 0,00')
    })
})

describe('formatPercentage', () => {
    it('formata uma razão como percentual com 1 casa decimal', () => {
        expect(formatPercentage(0.5)).toBe('50.0%')
        expect(formatPercentage(0.253)).toBe('25.3%')
    })
})
