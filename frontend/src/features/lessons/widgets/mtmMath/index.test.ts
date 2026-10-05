import { describe, expect, it } from 'vitest'
import { bondPrice, mtmOutcome, pricingYears, seesawTiltDeg } from '.'

describe('bondPrice', () => {
    it.each([
        [11.75, 2, 800.76],
        [14, 2, 769.47],
        [10, 2, 826.45],
        [11.75, 5, 573.8],
        [14, 5, 519.37],
    ])('taxa %f%% em %f anos dá R$ %f', (rate, years, expected) => {
        expect(bondPrice(rate, years)).toBeCloseTo(expected, 2)
    })
})

describe('mtmOutcome', () => {
    it.each([
        [11.75, 14, 2, -3.9],
        [11.75, 10, 2, 3.2],
        [11.75, 14, 5, -9.49],
        [11.75, 11.75, 2, 0],
    ])('contratada %f, mercado %f, %f anos: variação %f%%', (contract, market, years, expected) => {
        expect(mtmOutcome(contract, market, years).changePct).toBeCloseTo(expected, 1)
    })

    it('prazo longo oscila mais que o curto com o mesmo choque', () => {
        expect(Math.abs(mtmOutcome(11.75, 14, 10).changePct)).toBeGreaterThan(Math.abs(mtmOutcome(11.75, 14, 1).changePct))
    })

    it('Selic quase não oscila', () => {
        const years = pricingYears('selic', 5)
        expect(Math.abs(mtmOutcome(11.75, 14, years).changePct)).toBeLessThan(0.1)
        expect(pricingYears('prefixed', 5)).toBe(5)
    })
})

describe('seesawTiltDeg', () => {
    it.each([
        [11.75, 11.75, 0],
        [11.75, 15.75, 8],
        [11.75, 30, 16],
        [11.75, 2, -16],
    ])('contratada %f e mercado %f inclinam %f graus', (contract, market, expected) => {
        expect(seesawTiltDeg(contract, market)).toBeCloseTo(expected, 5)
    })
})
