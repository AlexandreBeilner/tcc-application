import { describe, expect, it } from 'vitest'
import { estimateMessage, formatEstimateValue, parseEstimateInput, scalePosition, snapToRange, stepByKey } from './index'

const range = { min: 1000, max: 10000, step: 100 }

describe('formatEstimateValue', () => {
    it.each([
        [3100, 'brl', 'R$ 3.100'],
        [6727.5, 'brl', 'R$ 6.727,50'],
        [7.5, 'pct', '7,5%'],
        [1, 'years', '1 ano'],
        [20, 'years', '20 anos'],
        [1234.5, 'none', '1.234,5'],
    ] as const)('%s em %s', (value, unit, expected) => {
        expect(formatEstimateValue(value, unit)).toBe(expected)
    })
})

describe('scalePosition', () => {
    it.each([
        [1000, 0],
        [5500, 50],
        [10000, 100],
        [500, 0],
        [20000, 100],
    ])('%s fica em %s%%', (value, expected) => {
        expect(scalePosition(value, range)).toBe(expected)
    })

    it('régua degenerada não quebra', () => {
        expect(scalePosition(5, { min: 5, max: 5, step: 1 })).toBe(0)
    })
})

describe('snapToRange', () => {
    it.each([
        [3140, 3100],
        [3160, 3200],
        [50, 1000],
        [99999, 10000],
    ])('%s vira %s', (value, expected) => {
        expect(snapToRange(value, range)).toBe(expected)
    })

    it('passo fracionário não acumula ruído', () => {
        expect(snapToRange(0.30000000000000004, { min: 0, max: 1, step: 0.1 })).toBe(0.3)
    })
})

describe('stepByKey', () => {
    it('PageUp e PageDown andam 10 passos e param nas pontas', () => {
        expect(stepByKey(3000, 'PageUp', range)).toBe(4000)
        expect(stepByKey(3000, 'PageDown', range)).toBe(2000)
        expect(stepByKey(9500, 'PageUp', range)).toBe(10000)
        expect(stepByKey(1500, 'PageDown', range)).toBe(1000)
    })

    it('outras teclas ficam com o controle nativo', () => {
        expect(stepByKey(3000, 'ArrowRight', range)).toBeUndefined()
    })
})

describe('parseEstimateInput', () => {
    it.each([
        ['3100', 3100],
        ['3.100', 3100],
        ['3100,5', 3100.5],
        [' 2500 ', 2500],
    ])('lê "%s"', (text, expected) => {
        expect(parseEstimateInput(text, range)).toBe(expected)
    })

    it.each(['', 'abc', '999', '10001', '1e2'])('recusa "%s"', (text) => {
        expect(parseEstimateInput(text, range)).toBeUndefined()
    })
})

describe('estimateMessage', () => {
    it('uma frase por faixa, nenhuma negativa', () => {
        expect(estimateMessage('exact')).toBe('Na mosca!')
        expect(estimateMessage('close')).toBe('Quase lá')
        expect(estimateMessage('far')).toBe('Bem diferente do que parece, né?')
    })
})
