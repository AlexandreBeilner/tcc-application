import { describe, expect, it } from 'vitest'
import type { LessonCardFunnel } from '../../../services/admin'
import { barPercent, cardLabel, isBiggestDrop, summarizeFunnel } from '.'

const funnel: LessonCardFunnel = {
    lesson: { id: 'l1', code: '0.1', title: 'Lição' },
    days: 30,
    since: '2026-09-19',
    bars: [
        { phase: 0, card_index: 0, reached: 10, lost: 0, lost_rate: null },
        { phase: 0, card_index: 1, reached: 4, lost: 6, lost_rate: 0.6 },
        { phase: 3, card_index: 0, reached: 3, lost: 1, lost_rate: 0.25 },
    ],
    biggest_drop: { phase: 0, card_index: 1 },
}

describe('cardLabel', () => {
    it('usa o nome da fase e conta os cartões a partir de 1', () => {
        expect(cardLabel({ phase: 0, card_index: 0 })).toBe('Cenário · cartão 1')
        expect(cardLabel({ phase: 2, card_index: 4 })).toBe('Revelação · cartão 5')
        expect(cardLabel({ phase: 3, card_index: 0 })).toBe('Tela final')
    })
})

describe('barPercent', () => {
    it.each([
        [5, 10, 50],
        [10, 10, 100],
        [0, 10, 0],
        [3, 0, 0],
    ])('%i de %i -> %i%%', (reached, max, expected) => {
        expect(barPercent(reached, max)).toBe(expected)
    })
})

describe('summarizeFunnel', () => {
    it('resume começo, fim e a maior queda', () => {
        expect(isBiggestDrop(funnel, funnel.bars[1]!)).toBe(true)
        expect(isBiggestDrop(funnel, funnel.bars[0]!)).toBe(false)
        expect(summarizeFunnel(funnel)).toBe(
            '10 chegaram ao primeiro cartão e 3 ao último medido. Maior queda: Cenário · cartão 2, 6 a menos que o cartão anterior (60%).',
        )
    })

    it('avisa quando não há dado nem queda', () => {
        expect(summarizeFunnel({ ...funnel, bars: [], biggest_drop: null })).toContain('Ninguém chegou')
        expect(summarizeFunnel({ ...funnel, bars: [funnel.bars[0]!], biggest_drop: null })).toContain('Ninguém parou')
    })
})
