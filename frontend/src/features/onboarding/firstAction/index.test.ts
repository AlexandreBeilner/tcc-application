import { afterEach, describe, expect, it } from 'vitest'
import { calculateFirstActionResult, readFirstActionDismissed, writeFirstActionDismissed } from '.'

describe('calculateFirstActionResult', () => {
    it.each([
        { averagePrice: 100, currentPrice: 103, ratio: 0.03 },
        { averagePrice: 100, currentPrice: 101, ratio: 0.01 },
        { averagePrice: 100, currentPrice: 98, ratio: -0.02 },
    ])('preço $currentPrice contra compra a $averagePrice varia $ratio', ({ averagePrice, currentPrice, ratio }) => {
        expect(calculateFirstActionResult({ averagePrice, currentPrice })?.changeRatio).toBeCloseTo(ratio, 10)
    })

    it('sem resultado enquanto o roteiro não andou, para não fingir uma subida', () => {
        expect(calculateFirstActionResult({ averagePrice: 100, currentPrice: 100 })).toBeNull()
    })

    it('sem resultado sem preço de hoje ou com preço médio inválido', () => {
        expect(calculateFirstActionResult({ averagePrice: 100, currentPrice: null })).toBeNull()
        expect(calculateFirstActionResult({ averagePrice: 100, currentPrice: undefined })).toBeNull()
        expect(calculateFirstActionResult({ averagePrice: 0, currentPrice: 103 })).toBeNull()
    })
})

describe('cartão dispensado', () => {
    afterEach(() => localStorage.clear())

    it('lembra a dispensa por usuário', () => {
        expect(readFirstActionDismissed('u1')).toBe(false)
        writeFirstActionDismissed('u1')
        expect(readFirstActionDismissed('u1')).toBe(true)
        expect(readFirstActionDismissed('u2')).toBe(false)
    })
})
