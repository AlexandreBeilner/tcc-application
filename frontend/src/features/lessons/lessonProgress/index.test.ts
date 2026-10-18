import { describe, expect, it } from 'vitest'
import { lessonProgress, progressMarkers, scoredCardId } from '.'
import type { PlayerCard } from '../playerCards'

describe('lessonProgress', () => {
    it.each([
        { counts: [3, 2, 4], step: 0, card: 0, current: 1 },
        { counts: [3, 2, 4], step: 0, card: 2, current: 3 },
        { counts: [3, 2, 4], step: 1, card: 0, current: 4 },
        { counts: [3, 2, 4], step: 2, card: 3, current: 9 },
        { counts: [3, 2, 4], step: 3, card: 0, current: 10 },
    ])('fases $counts, passo $step, cartão $card: cartão $current de 10', ({ counts, step, card, current }) => {
        expect(lessonProgress(counts, step, card)).toEqual({ current, total: 10 })
    })

    it('fase com 1 cartão só: avançar de fase anda exatamente um', () => {
        expect(lessonProgress([1, 1, 1], 0, 0)).toEqual({ current: 1, total: 4 })
        expect(lessonProgress([1, 1, 1], 1, 0)).toEqual({ current: 2, total: 4 })
        expect(lessonProgress([1, 1, 1], 3, 0)).toEqual({ current: 4, total: 4 })
    })

    it('fase vazia não conta cartão e não quebra', () => {
        expect(lessonProgress([2, 0, 2], 2, 0)).toEqual({ current: 3, total: 5 })
        expect(lessonProgress([2, 0, 2], 1, 0)).toEqual({ current: 3, total: 5 })
    })

    it('cartão fora do intervalo fica preso no último da fase (Voltar e revisão)', () => {
        expect(lessonProgress([2, 2, 2], 0, 9)).toEqual({ current: 2, total: 7 })
        expect(lessonProgress([2, 2, 2], 1, -1)).toEqual({ current: 3, total: 7 })
    })
})

describe('progressMarkers', () => {
    const text: PlayerCard = { kind: 'text', text: 'a', hidden: false }
    const check = (id: string): PlayerCard => ({ kind: 'check', block: { type: 'check', id, kind: 'true_false', prompt: 'p' } })

    it('a enquete tem cartão na barra, mas não ganha marco nem vale ponto (LJ.2.6)', () => {
        const poll: PlayerCard = { kind: 'poll', block: { type: 'poll', id: 'e', prompt: 'p', options: ['a', 'b'] } }

        expect(progressMarkers([[text, poll, check('q1')], [], []], () => 'pending')).toEqual([{ position: 3, state: 'pending' }])
        expect(scoredCardId(poll)).toBeUndefined()
    })

    it('marca só os cartões de pergunta, com a posição na lição inteira e o estado de cada um', () => {
        const states: Record<string, 'pending' | 'first-try' | 'later'> = { q1: 'first-try', q2: 'later', q3: 'pending' }
        const markers = progressMarkers(
            [
                [text, check('q1')],
                [check('q2'), text],
                [text, check('q3')],
            ],
            (id) => states[id],
        )

        expect(markers).toEqual([
            { position: 2, state: 'first-try' },
            { position: 3, state: 'later' },
            { position: 6, state: 'pending' },
        ])
    })

    it('lição sem pergunta não tem marco', () => {
        expect(progressMarkers([[text], [text], [text]], () => 'pending')).toEqual([])
    })
})
