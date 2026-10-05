import { describe, expect, it } from 'vitest'
import { INITIAL_BOOK, matchOrder, spreadCents } from '.'

describe('spreadCents', () => {
    it('livro inicial: melhor compra 10,00 e melhor venda 10,05 dão spread de 5 centavos', () => {
        expect(spreadCents(INITIAL_BOOK)).toBe(5)
    })

    it('livro sem um dos lados não tem spread', () => {
        expect(spreadCents({ ...INITIAL_BOOK, asks: [] })).toBeNull()
    })
})

describe('matchOrder', () => {
    it('compra a mercado de 500 passa por dois níveis e paga preço médio de 10,07', () => {
        const result = matchOrder(INITIAL_BOOK, { side: 'buy', type: 'market', qty: 500 })
        expect(result.fills).toEqual([
            { priceCents: 1005, qty: 300 },
            { priceCents: 1010, qty: 200 },
        ])
        expect(result.avgCents).toBeCloseTo(1007, 6)
        expect(result.slippageCents).toBeCloseTo(2, 6)
        expect(result.book.lastCents).toBe(1010)
        expect(result.book.asks[0]).toEqual({ priceCents: 1010, qty: 300 })
    })

    it('venda a mercado de 400 consome a melhor compra e parte da seguinte', () => {
        const result = matchOrder(INITIAL_BOOK, { side: 'sell', type: 'market', qty: 400 })
        expect(result.filledQty).toBe(400)
        expect(result.avgCents).toBeCloseTo((1000 * 300 + 995 * 100) / 400, 6)
        expect(result.book.bids[0]).toEqual({ priceCents: 995, qty: 400 })
    })

    it('compra limitada abaixo da melhor venda não executa e fica no livro', () => {
        const result = matchOrder(INITIAL_BOOK, { side: 'buy', type: 'limit', qty: 200, limitCents: 950 })
        expect(result.filledQty).toBe(0)
        expect(result.restingQty).toBe(200)
        expect(result.book.bids.map((l) => l.priceCents)).toEqual([1000, 995, 990, 985, 950])
        expect(result.book.lastCents).toBe(1000)
    })

    it('compra limitada que cruza executa o que dá e deixa o resto como nova melhor compra', () => {
        const result = matchOrder(INITIAL_BOOK, { side: 'buy', type: 'limit', qty: 500, limitCents: 1005 })
        expect(result.filledQty).toBe(300)
        expect(result.restingQty).toBe(200)
        expect(result.book.bids[0]).toEqual({ priceCents: 1005, qty: 200 })
        expect(result.book.asks[0].priceCents).toBe(1010)
    })

    it('ordem limitada no mesmo preço soma ao nível existente', () => {
        const result = matchOrder(INITIAL_BOOK, { side: 'buy', type: 'limit', qty: 100, limitCents: 995 })
        expect(result.book.bids[1]).toEqual({ priceCents: 995, qty: 600 })
    })

    it('ordem a mercado maior que o livro deixa quantidade sem executar', () => {
        const result = matchOrder(INITIAL_BOOK, { side: 'buy', type: 'market', qty: 5000 })
        expect(result.filledQty).toBe(2600)
        expect(result.unfilledQty).toBe(2400)
        expect(result.book.asks).toEqual([])
    })

    it('não altera o livro original', () => {
        matchOrder(INITIAL_BOOK, { side: 'buy', type: 'market', qty: 500 })
        expect(INITIAL_BOOK.asks[0]).toEqual({ priceCents: 1005, qty: 300 })
    })
})
