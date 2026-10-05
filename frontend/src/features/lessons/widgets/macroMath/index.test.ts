import { describe, expect, it } from 'vitest'
import { inflationBand, oneYearOutcome, realReturnPct } from '.'

describe('realReturnPct', () => {
    it.each([
        [10, 5, 4.7619],
        [10, 10, 0],
        [4, 6, -1.8868],
        [0, 5, -4.7619],
    ])('nominal %f%% com inflação %f%% rende %f%% real', (nominal, inflation, expected) => {
        expect(realReturnPct(nominal, inflation)).toBeCloseTo(expected, 3)
    })
})

describe('oneYearOutcome', () => {
    it('em dinheiro de hoje, o valor só cresce o ganho real', () => {
        const { nominal, inTodaysMoney } = oneYearOutcome(10000, 10, 5)
        expect(nominal).toBeCloseTo(11000, 6)
        expect(inTodaysMoney).toBeCloseTo(10476.19, 2)
    })

    it('inflação maior que o rendimento encolhe o poder de compra', () => {
        expect(oneYearOutcome(10000, 4, 6).inTodaysMoney).toBeLessThan(10000)
    })
})

describe('inflationBand', () => {
    it.each([
        [1.4, 'below'],
        [1.5, 'inside'],
        [3, 'inside'],
        [4.5, 'inside'],
        [4.6, 'above'],
    ] as const)('%f%% fica %s', (value, expected) => {
        expect(inflationBand(value)).toBe(expected)
    })
})
