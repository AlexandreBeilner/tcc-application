import { describe, expect, it } from 'vitest'
import { BOOKBUILDING_ORDERS, bookbuilding, demandCurve, ownership } from '.'

describe('ownership', () => {
    it('100 de 1 milhão de ações a R$ 20: 0,01% da empresa e dividendo proporcional', () => {
        const result = ownership(20, 1_000_000, 100, 5_000_000, 30)
        expect(result.ownershipPct).toBeCloseTo(0.01, 6)
        expect(result.marketCap).toBe(20_000_000)
        expect(result.yourValue).toBe(2000)
        expect(result.dividend).toBeCloseTo(150, 6)
    })

    it('sem distribuição não há dividendo', () => {
        expect(ownership(20, 1_000_000, 100, 5_000_000, 0).dividend).toBe(0)
    })

    it('sem ações emitidas a participação é zero', () => {
        expect(ownership(20, 0, 100, 1000, 30).ownershipPct).toBe(0)
    })
})

describe('demandCurve', () => {
    it('acumula do maior preço para o menor', () => {
        const curve = demandCurve(BOOKBUILDING_ORDERS)
        expect(curve[0]).toEqual({ priceCents: 2200, cumulativeQty: 300_000 })
        expect(curve[3]).toEqual({ priceCents: 2000, cumulativeQty: 1_000_000 })
        expect(curve[curve.length - 1].cumulativeQty).toBe(1_850_000)
    })
})

describe('bookbuilding', () => {
    it('1 milhão de ações, 60% primária: corte em R$ 20,00', () => {
        const result = bookbuilding(BOOKBUILDING_ORDERS, 1_000_000, 60, 4_000_000)
        expect(result.cutCents).toBe(2000)
        expect(result.coverage).toBe(1)
        expect(result.companyCash).toBe(12_000_000)
        expect(result.sellersCash).toBe(8_000_000)
        expect(result.marketCap).toBe(92_000_000)
        expect(result.dilutionPct).toBeCloseTo(13.04, 2)
    })

    it('oferta menor sobe o preço de corte e a cobertura', () => {
        const result = bookbuilding(BOOKBUILDING_ORDERS, 500_000, 100, 4_000_000)
        expect(result.cutCents).toBe(2100)
        expect(result.coverage).toBeCloseTo(1.1, 6)
    })

    it('100% secundária: a empresa não recebe caixa', () => {
        const result = bookbuilding(BOOKBUILDING_ORDERS, 1_000_000, 0, 4_000_000)
        expect(result.companyCash).toBe(0)
        expect(result.dilutionPct).toBe(0)
    })

    it('oferta maior que toda a demanda não fecha', () => {
        const result = bookbuilding(BOOKBUILDING_ORDERS, 2_000_000, 60, 4_000_000)
        expect(result.cutCents).toBeNull()
    })
})
