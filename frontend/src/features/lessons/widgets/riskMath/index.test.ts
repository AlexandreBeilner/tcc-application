import { describe, expect, it } from 'vitest'
import {
    EXAMPLE_ALLOCATIONS,
    QUIZ_QUESTIONS,
    allocationTotal,
    badYearLoss,
    normalizedShares,
    productsWithin,
    riskProfileFromAnswers,
} from '.'

const answersWith = (points: 1 | 2 | 3) => Object.fromEntries(QUIZ_QUESTIONS.map((q) => [q.id, points])) as Record<string, 1 | 2 | 3>

describe('riskMath', () => {
    it('o conservador só tem produtos de baixa oscilação, o arrojado tem todos', () => {
        expect(productsWithin('conservative').map((p) => p.id)).toEqual(['savings', 'selic-bond', 'cdb'])
        expect(productsWithin('moderate').map((p) => p.id)).toContain('fii')
        expect(productsWithin('moderate').map((p) => p.id)).not.toContain('stocks')
        expect(productsWithin('aggressive')).toHaveLength(6)
    })

    it('os exemplos de alocação somam 100%', () => {
        for (const allocation of Object.values(EXAMPLE_ALLOCATIONS)) expect(allocationTotal(allocation)).toBe(100)
    })

    it('normaliza quando a soma não fecha em 100', () => {
        const shares = normalizedShares({ 'post-fixed': 50, 'longer-fixed': 50, fii: 50, stocks: 50 })
        expect(shares.stocks).toBeCloseTo(25, 6)
        expect(allocationTotal(shares)).toBeCloseTo(100, 6)
    })

    it('perda de um ano ruim cresce com o perfil', () => {
        const loss = (p: keyof typeof EXAMPLE_ALLOCATIONS) => badYearLoss(EXAMPLE_ALLOCATIONS[p], 10000).lossPct
        expect(loss('conservative')).toBeLessThan(loss('moderate'))
        expect(loss('moderate')).toBeLessThan(loss('aggressive'))
        expect(badYearLoss(EXAMPLE_ALLOCATIONS.aggressive, 10000).lossAmount).toBeCloseTo((10000 * loss('aggressive')) / 100, 6)
    })

    it('carteira toda em ações perde 30% no ano ruim ilustrativo', () => {
        expect(badYearLoss({ 'post-fixed': 0, 'longer-fixed': 0, fii: 0, stocks: 100 }, 1000).lossPct).toBe(30)
    })

    it('questionário: tudo cauteloso é conservador, tudo tolerante é arrojado', () => {
        expect(riskProfileFromAnswers(answersWith(1)).profile).toBe('conservative')
        expect(riskProfileFromAnswers(answersWith(3)).profile).toBe('aggressive')
        expect(riskProfileFromAnswers(answersWith(2)).profile).toBe('moderate')
    })

    it('precisar do dinheiro em menos de 1 ano limita ao conservador, mesmo com pontuação alta', () => {
        const result = riskProfileFromAnswers({ ...answersWith(3), horizon: 1 })
        expect(result.profile).toBe('conservative')
        expect(result.capped).toBe(true)
    })

    it('sem reserva o arrojado vira moderado', () => {
        const result = riskProfileFromAnswers({ ...answersWith(3), reserve: 1 })
        expect(result.profile).toBe('moderate')
        expect(result.capped).toBe(true)
    })
})
