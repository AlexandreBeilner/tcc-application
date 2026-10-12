import { describe, expect, it } from 'vitest'
import { annualDiscountPercent, annualPerMonth, annualSavings } from '.'
import type { WebPlan } from '.'

const plan = (id: WebPlan['id'], amountMicros: number): WebPlan => ({ id, amountMicros, currency: 'BRL', formattedPrice: '', handle: null })

describe('annualDiscountPercent', () => {
    it('calcula o desconto do anual sobre 12 mensalidades', () => {
        expect(annualDiscountPercent(plan('monthly', 19_970_000), plan('annual', 199_970_000))).toBe(17)
    })

    it('devolve null se o anual não é mais barato', () => {
        expect(annualDiscountPercent(plan('monthly', 10_000_000), plan('annual', 120_000_000))).toBeNull()
    })
})

describe('annualPerMonth', () => {
    it('divide o anual por 12 na moeda do plano', () => {
        expect(annualPerMonth(plan('annual', 120_000_000)).replace(/\s/g, ' ')).toBe('R$ 10,00')
    })
})

describe('annualSavings', () => {
    it('calcula a economia em reais sobre 12 mensalidades (9,90 e 89,90 poupam 28,90)', () => {
        expect(annualSavings(plan('monthly', 9_900_000), plan('annual', 89_900_000))?.replace(/\s/g, ' ')).toBe('R$ 28,90')
    })

    it('devolve null se o anual não é mais barato', () => {
        expect(annualSavings(plan('monthly', 10_000_000), plan('annual', 120_000_000))).toBeNull()
    })
})
