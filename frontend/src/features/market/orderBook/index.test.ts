import { describe, expect, it } from 'vitest'
import { averageFillPrice, estimateExecution, estimateOrderCost, maxAffordableQuantity } from '.'

describe('estimateExecution', () => {
    it.each([
        {
            name: 'sem book (null)',
            levels: null,
            quantity: 10,
            expected: { filledQuantity: 0, totalCost: 0, averagePrice: null, fullyEstimated: false },
        },
        {
            name: 'book vazio',
            levels: [],
            quantity: 10,
            expected: { filledQuantity: 0, totalCost: 0, averagePrice: null, fullyEstimated: false },
        },
        {
            name: 'quantidade zero',
            levels: [{ price: 10, quantity: 5 }],
            quantity: 0,
            expected: { filledQuantity: 0, totalCost: 0, averagePrice: null, fullyEstimated: false },
        },
        {
            name: 'um nível cobre tudo',
            levels: [{ price: 10, quantity: 20 }],
            quantity: 5,
            expected: { filledQuantity: 5, totalCost: 50, averagePrice: 10, fullyEstimated: true },
        },
        {
            name: 'caminha por dois níveis',
            levels: [
                { price: 10, quantity: 3 },
                { price: 11, quantity: 10 },
            ],
            quantity: 5,
            expected: { filledQuantity: 5, totalCost: 3 * 10 + 2 * 11, averagePrice: (3 * 10 + 2 * 11) / 5, fullyEstimated: true },
        },
        {
            name: 'profundidade visível insuficiente',
            levels: [{ price: 10, quantity: 3 }],
            quantity: 5,
            expected: { filledQuantity: 3, totalCost: 30, averagePrice: 10, fullyEstimated: false },
        },
    ])('$name', ({ levels, quantity, expected }) => {
        expect(estimateExecution(levels, quantity)).toEqual(expected)
    })
})

describe('estimateOrderCost', () => {
    it('sem book, cai pro preço de fallback (último negócio)', () => {
        expect(estimateOrderCost(null, 4, 30)).toEqual({ unitPrice: 30, total: 120, boundedByDepth: false })
    })

    it('sem book nem fallback, sem estimativa nenhuma', () => {
        expect(estimateOrderCost(null, 4, undefined)).toEqual({ unitPrice: undefined, total: undefined, boundedByDepth: false })
    })

    it('book cobre a quantidade inteira: custo exato, sem extrapolar', () => {
        const levels = [
            { price: 10, quantity: 3 },
            { price: 11, quantity: 10 },
        ]
        expect(estimateOrderCost(levels, 5, 9)).toEqual({ unitPrice: (3 * 10 + 2 * 11) / 5, total: 3 * 10 + 2 * 11, boundedByDepth: false })
    })

    it('book raso: extrapola o resto pelo preço médio já encontrado, marca boundedByDepth', () => {
        const levels = [{ price: 10, quantity: 2 }]
        const result = estimateOrderCost(levels, 5, 9)
        // 2 cotas a 10 (20) + 3 cotas extrapoladas a 10 (média conhecida) = 50
        expect(result).toEqual({ unitPrice: 10, total: 50, boundedByDepth: true })
    })

    it('book raso sem nenhum fill (nível vazio): extrapola pelo fallback', () => {
        const result = estimateOrderCost([], 5, 9)
        expect(result).toEqual({ unitPrice: 9, total: 45, boundedByDepth: false })
    })
})

describe('maxAffordableQuantity', () => {
    it('sem asks, nada afordável', () => {
        expect(maxAffordableQuantity(null, 1000)).toBe(0)
    })

    it('sem saldo, nada afordável', () => {
        expect(maxAffordableQuantity([{ price: 10, quantity: 100 }], 0)).toBe(0)
    })

    it('caminha os níveis até o saldo acabar', () => {
        const asks = [
            { price: 10, quantity: 5 },
            { price: 12, quantity: 5 },
        ]
        // 5 * 10 = 50 (sobra 50); 50 / 12 = 4 (sobra 2, não dá pra mais nenhuma)
        expect(maxAffordableQuantity(asks, 100)).toBe(9)
    })

    it('saldo cobre só uma fração do primeiro nível', () => {
        expect(maxAffordableQuantity([{ price: 10, quantity: 5 }], 25)).toBe(2)
    })
})

describe('averageFillPrice', () => {
    it('sem fills, null', () => {
        expect(averageFillPrice([])).toBeNull()
    })

    it('média ponderada pela quantidade de cada fill', () => {
        const fills = [
            { price: 31, quantity: 6, synthetic: false },
            { price: 32, quantity: 4, synthetic: false },
        ]
        expect(averageFillPrice(fills)).toBeCloseTo(31.4)
    })
})
