import { describe, expect, it } from 'vitest'
import type { PlayerCard } from '../playerCards'
import { lessonScore, scoreSummary, scoreTitle } from '.'

const check = (id: string): PlayerCard => ({ kind: 'check', block: { type: 'check', id, kind: 'true_false', prompt: 'p' } })
const text: PlayerCard = { kind: 'text', text: 'oi', hidden: false }

describe('lessonScore', () => {
    it('conta um estado por pergunta, na ordem, ignorando cartões que não são pergunta', () => {
        const states: Record<string, 'first-try' | 'later' | 'pending'> = { a: 'first-try', b: 'later', c: 'pending' }
        const score = lessonScore([[text, check('a')], [check('b')], [text, check('c')]], (id) => states[id])
        expect(score).toEqual({ total: 3, firstTry: 1, states: ['first-try', 'later', 'pending'] })
    })

    it('lição sem pergunta tem placar vazio', () => {
        expect(lessonScore([[text], [], [text]], () => 'pending')).toEqual({ total: 0, firstTry: 0, states: [] })
    })
})

describe('scoreTitle', () => {
    it.each([
        [{ total: 5, firstTry: 5 }, 'Na mosca!'],
        [{ total: 1, firstTry: 1 }, 'Na mosca!'],
        [{ total: 5, firstTry: 4 }, 'Mandou bem!'],
        [{ total: 5, firstTry: 3 }, 'Mandou bem!'],
        [{ total: 4, firstTry: 2 }, 'Lição concluída'],
        [{ total: 5, firstTry: 0 }, 'Lição concluída'],
        [{ total: 0, firstTry: 0 }, 'Lição concluída'],
    ])('%j vira "%s"', (score, title) => {
        expect(scoreTitle(score)).toBe(title)
    })
})

describe('scoreSummary', () => {
    it('diz quantas foram de primeira', () => {
        expect(scoreSummary({ total: 5, firstTry: 4 })).toBe('4 de 5 de primeira')
    })
})
