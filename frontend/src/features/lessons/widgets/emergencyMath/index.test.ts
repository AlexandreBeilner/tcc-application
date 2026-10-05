import { describe, expect, it } from 'vitest'
import { emergencyFundTarget, monthsToReach } from '.'

describe('emergencyFundTarget', () => {
    it.each([
        [3000, 'stable', 9000, 18000],
        [3000, 'variable', 18000, 36000],
        [0, 'stable', 0, 0],
    ] as const)('custo de %f com renda %s dá meta de %f a %f', (cost, type, min, max) => {
        const target = emergencyFundTarget(cost, type)
        expect(target.minAmount).toBe(min)
        expect(target.maxAmount).toBe(max)
    })
})

describe('monthsToReach', () => {
    it.each([
        [9000, 500, 18],
        [9000, 400, 23],
        [9000, 9000, 1],
    ])('meta de %f com aporte de %f leva %f meses', (target, monthly, expected) => {
        expect(monthsToReach(target, monthly)).toBe(expected)
    })

    it('sem aporte não há prazo', () => {
        expect(monthsToReach(9000, 0)).toBeNull()
    })
})
