import { describe, expect, it } from 'vitest'
import { computeGrowthProjection } from '.'

describe('computeGrowthProjection', () => {
    it('mês 0 é sempre o capital inicial, nos dois modos', () => {
        for (const mode of ['simple', 'compound'] as const) {
            const result = computeGrowthProjection({
                initialCapital: 1000,
                monthlyContribution: 100,
                annualRatePct: 12,
                months: 6,
                mode,
            })
            expect(result.points[0]).toEqual({ month: 0, invested: 1000, total: 1000 })
        }
    })

    it('taxa zero: total sempre igual ao investido, em qualquer modo', () => {
        for (const mode of ['simple', 'compound'] as const) {
            const result = computeGrowthProjection({
                initialCapital: 1000,
                monthlyContribution: 200,
                annualRatePct: 0,
                months: 12,
                mode,
            })
            expect(result.totalValue).toBeCloseTo(result.totalInvested, 8)
            expect(result.totalInvested).toBeCloseTo(1000 + 200 * 12, 8)
            expect(result.totalInterest).toBeCloseTo(0, 8)
        }
    })

    it('sem aporte mensal, capital inicial positivo e taxa positiva: composto rende mais que simples a partir do 2º mês', () => {
        const base = { initialCapital: 10000, monthlyContribution: 0, annualRatePct: 12, months: 12 }
        const compound = computeGrowthProjection({ ...base, mode: 'compound' })
        const simple = computeGrowthProjection({ ...base, mode: 'simple' })

        expect(compound.points[1].total).toBeCloseTo(simple.points[1].total, 6)
        expect(compound.points[12].total).toBeGreaterThan(simple.points[12].total)
    })

    it('modo simples: juros de cada mês incide só sobre o capital investido até ali, nunca sobre juros acumulados', () => {
        const result = computeGrowthProjection({
            initialCapital: 1000,
            monthlyContribution: 0,
            annualRatePct: 12,
            months: 3,
            mode: 'simple',
        })
        const monthlyRate = 0.12 / 12
        // Juros de cada mês é fixo (sempre sobre os mesmos 1000 investidos,
        // sem aporte novo) — soma linear, não geométrica.
        expect(result.points[1].total).toBeCloseTo(1000 + 1000 * monthlyRate, 8)
        expect(result.points[2].total).toBeCloseTo(1000 + 2 * 1000 * monthlyRate, 8)
        expect(result.points[3].total).toBeCloseTo(1000 + 3 * 1000 * monthlyRate, 8)
    })

    it('modo composto: juros reinveste sobre o saldo total do mês anterior', () => {
        const result = computeGrowthProjection({
            initialCapital: 1000,
            monthlyContribution: 0,
            annualRatePct: 12,
            months: 2,
            mode: 'compound',
        })
        const monthlyRate = 0.12 / 12
        const month1 = 1000 * (1 + monthlyRate)
        const month2 = month1 * (1 + monthlyRate)
        expect(result.points[1].total).toBeCloseTo(month1, 8)
        expect(result.points[2].total).toBeCloseTo(month2, 8)
    })

    it('aporte mensal soma ao investido a cada mês, independente do modo', () => {
        const result = computeGrowthProjection({
            initialCapital: 500,
            monthlyContribution: 300,
            annualRatePct: 10,
            months: 4,
            mode: 'compound',
        })
        expect(result.points.map((p) => p.invested)).toEqual([500, 800, 1100, 1400, 1700])
    })

    it('months = 0 devolve só o ponto inicial', () => {
        const result = computeGrowthProjection({
            initialCapital: 1000,
            monthlyContribution: 100,
            annualRatePct: 12,
            months: 0,
            mode: 'compound',
        })
        expect(result.points).toHaveLength(1)
        expect(result.totalValue).toBe(1000)
        expect(result.totalInvested).toBe(1000)
    })
})
