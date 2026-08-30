import { describe, expect, it } from 'vitest'
import { formatDecimal, formatRatePercent, formatSignedPercent } from '.'

describe('features/market/format', () => {
    it('formatSignedPercent adiciona + pra valores positivos', () => {
        expect(formatSignedPercent(1.854)).toBe('+1,9%')
    })

    it('formatSignedPercent usa − (não hífen) pra valores negativos', () => {
        expect(formatSignedPercent(-2.1)).toBe('−2,1%')
    })

    it('formatSignedPercent não usa sinal pra zero', () => {
        expect(formatSignedPercent(0)).toBe('0,0%')
    })

    it('formatDecimal usa 1 casa decimal com vírgula', () => {
        expect(formatDecimal(14.24)).toBe('14,2')
    })

    it('formatRatePercent não multiplica por 100 (valor já vem em pontos percentuais)', () => {
        expect(formatRatePercent(11.75)).toBe('11,8%')
    })
})
