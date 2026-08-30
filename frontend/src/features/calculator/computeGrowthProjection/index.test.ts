import { describe, expect, it } from 'vitest'
import { computeGrowthProjection, resolveMonthlyRate, resolvePeriodInMonths } from '.'

describe('resolveMonthlyRate', () => {
    it('taxa já em % a.m.: devolve a razão direta, igual nos dois modos (sem conversão)', () => {
        expect(resolveMonthlyRate(1, 'month', 'compound')).toBeCloseTo(0.01, 10)
        expect(resolveMonthlyRate(1, 'month', 'simple')).toBeCloseTo(0.01, 10)
    })

    it('taxa em % a.a., modo simples: proporcional (nominal/12)', () => {
        expect(resolveMonthlyRate(12, 'year', 'simple')).toBeCloseTo(0.01, 10)
    })

    it('taxa em % a.a., modo composto: equivalente mensal (1+i)^(1/12)-1, nunca nominal/12', () => {
        const monthlyRate = resolveMonthlyRate(12, 'year', 'compound')
        expect(monthlyRate).toBeCloseTo(1.12 ** (1 / 12) - 1, 10)
        // A taxa nominal/12 (0.01) sempre superestima o composto — a
        // equivalente mensal correta é sempre menor que ela para i > 0
        // (12 capitalizações de 1%a.m. rendem mais que 12%a.a. efetivo).
        expect(monthlyRate).toBeLessThan(0.01)
        // Reaplicada 12x, a taxa equivalente mensal reproduz exatamente os
        // 12% a.a. de entrada — é essa a definição de "equivalente".
        expect((1 + monthlyRate) ** 12 - 1).toBeCloseTo(0.12, 10)
    })
})

describe('resolvePeriodInMonths', () => {
    it('unidade meses: devolve o valor arredondado', () => {
        expect(resolvePeriodInMonths(24, 'months')).toBe(24)
        expect(resolvePeriodInMonths(24.4, 'months')).toBe(24)
    })

    it('unidade anos: multiplica por 12 e arredonda', () => {
        expect(resolvePeriodInMonths(2, 'years')).toBe(24)
        expect(resolvePeriodInMonths(1.5, 'years')).toBe(18)
        expect(resolvePeriodInMonths(2.3, 'years')).toBe(28)
    })
})

describe('computeGrowthProjection', () => {
    it('mês 0 é sempre o capital inicial, nos dois modos', () => {
        for (const mode of ['simple', 'compound'] as const) {
            const result = computeGrowthProjection({
                initialCapital: 1000,
                monthlyContribution: 100,
                ratePct: 12,
                rateUnit: 'year',
                months: 6,
                mode,
            })
            expect(result.points[0]).toEqual({ month: 0, interest: 0, invested: 1000, total: 1000 })
        }
    })

    it('taxa zero: total sempre igual ao investido, em qualquer modo', () => {
        for (const mode of ['simple', 'compound'] as const) {
            const result = computeGrowthProjection({
                initialCapital: 1000,
                monthlyContribution: 200,
                ratePct: 0,
                rateUnit: 'year',
                months: 12,
                mode,
            })
            expect(result.totalValue).toBeCloseTo(result.totalInvested, 8)
            expect(result.totalInvested).toBeCloseTo(1000 + 200 * 12, 8)
            expect(result.totalInterest).toBeCloseTo(0, 8)
        }
    })

    it('sem aporte mensal, capital inicial positivo e taxa positiva: composto rende mais que simples a partir do 2º mês', () => {
        const base = { initialCapital: 10000, monthlyContribution: 0, ratePct: 12, rateUnit: 'year' as const, months: 12 }
        const compound = computeGrowthProjection({ ...base, mode: 'compound' })
        const simple = computeGrowthProjection({ ...base, mode: 'simple' })

        expect(compound.points[12].total).toBeGreaterThan(simple.points[12].total)
    })

    it('modo composto reproduz exatamente a taxa anual efetiva após 12 meses (sem aporte)', () => {
        const result = computeGrowthProjection({
            initialCapital: 10000,
            monthlyContribution: 0,
            ratePct: 12,
            rateUnit: 'year',
            months: 12,
            mode: 'compound',
        })
        expect(result.totalValue).toBeCloseTo(10000 * 1.12, 6)
    })

    it('modo simples: juros de cada mês incide só sobre o capital investido até ali, nunca sobre juros acumulados', () => {
        const result = computeGrowthProjection({
            initialCapital: 1000,
            monthlyContribution: 0,
            ratePct: 12,
            rateUnit: 'year',
            months: 3,
            mode: 'simple',
        })
        const monthlyRate = 0.12 / 12
        expect(result.points[1].total).toBeCloseTo(1000 + 1000 * monthlyRate, 8)
        expect(result.points[2].total).toBeCloseTo(1000 + 2 * 1000 * monthlyRate, 8)
        expect(result.points[3].total).toBeCloseTo(1000 + 3 * 1000 * monthlyRate, 8)
    })

    it('point.interest (tarefa 6.7.3, tabela mês a mês) é o juros do mês específico, não acumulado', () => {
        const result = computeGrowthProjection({
            initialCapital: 1000,
            monthlyContribution: 200,
            ratePct: 12,
            rateUnit: 'month',
            months: 3,
            mode: 'compound',
        })
        expect(result.points[0].interest).toBe(0)
        // Mês 1: juros sobre os 1000 iniciais.
        expect(result.points[1].interest).toBeCloseTo(1000 * 0.12, 8)
        // Mês 2: juros sobre o total do mês 1 (1000+120+200=1320), não sobre
        // o acumulado de juros nem sobre o investido.
        expect(result.points[2].interest).toBeCloseTo(result.points[1].total * 0.12, 8)
        // Soma dos juros mensais bate com o total de juros acumulado.
        const sumOfMonthlyInterest = result.points.reduce((sum, p) => sum + p.interest, 0)
        expect(sumOfMonthlyInterest).toBeCloseTo(result.totalInterest, 8)
    })

    it('taxa digitada direto em % a.m. não sofre conversão nenhuma, em nenhum dos dois modos', () => {
        const compound = computeGrowthProjection({
            initialCapital: 1000,
            monthlyContribution: 0,
            ratePct: 1,
            rateUnit: 'month',
            months: 1,
            mode: 'compound',
        })
        const simple = computeGrowthProjection({
            initialCapital: 1000,
            monthlyContribution: 0,
            ratePct: 1,
            rateUnit: 'month',
            months: 1,
            mode: 'simple',
        })
        expect(compound.points[1].total).toBeCloseTo(1010, 8)
        expect(simple.points[1].total).toBeCloseTo(1010, 8)
    })

    it('aporte mensal soma ao investido a cada mês, independente do modo', () => {
        const result = computeGrowthProjection({
            initialCapital: 500,
            monthlyContribution: 300,
            ratePct: 10,
            rateUnit: 'year',
            months: 4,
            mode: 'compound',
        })
        expect(result.points.map((p) => p.invested)).toEqual([500, 800, 1100, 1400, 1700])
    })

    it('months = 0 devolve só o ponto inicial', () => {
        const result = computeGrowthProjection({
            initialCapital: 1000,
            monthlyContribution: 100,
            ratePct: 12,
            rateUnit: 'year',
            months: 0,
            mode: 'compound',
        })
        expect(result.points).toHaveLength(1)
        expect(result.totalValue).toBe(1000)
        expect(result.totalInvested).toBe(1000)
    })
})
