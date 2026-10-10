import { describe, expect, it } from 'vitest'
import { formatCents, formatRate } from '.'

const nbsp = (s: string) => s.replace(/\s/g, ' ')

describe('conversionFormat', () => {
    it('formata centavos em reais e deixa traço sem valor', () => {
        expect(nbsp(formatCents(199_90))).toBe('R$ 199,90')
        expect(formatCents(null)).toBe('—')
    })

    it('formata a taxa em porcentagem e deixa traço sem base', () => {
        expect(nbsp(formatRate(0.125))).toBe('12,5%')
        expect(formatRate(0)).toBe('0%')
        expect(formatRate(null)).toBe('—')
    })
})
