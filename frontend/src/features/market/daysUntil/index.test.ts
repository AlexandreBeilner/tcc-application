import { describe, expect, it } from 'vitest'
import { daysUntil } from '.'

describe('features/market/daysUntil', () => {
    const now = new Date('2026-01-01T00:00:00Z')

    it('calcula dias corridos até uma data futura', () => {
        expect(daysUntil('2026-01-11T00:00:00Z', now)).toBe(10)
    })

    it('nunca devolve menos de 1 dia (ativo já vencido)', () => {
        expect(daysUntil('2025-01-01T00:00:00Z', now)).toBe(1)
    })
})
