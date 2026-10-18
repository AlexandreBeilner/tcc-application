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

describe('lessonScore com missão de widget (LJ.3.1)', () => {
    const mission = (id: string): PlayerCard => ({
        kind: 'widget',
        block: { type: 'widget', id, widget: 'real-return', props: {}, goal: { text: 't', metric: 'm', op: 'lt', value: 0, reveal: 'r' } },
    })
    const plainWidget: PlayerCard = { kind: 'widget', block: { type: 'widget', id: 'w', widget: 'callout', props: {} } }

    it('conta a missão junto com as perguntas e ignora widget sem missão', () => {
        const states: Record<string, 'first-try' | 'later' | 'pending'> = { a: 'first-try', m: 'later' }
        const score = lessonScore([[check('a'), plainWidget, mission('m')]], (id) => states[id])
        expect(score).toEqual({ total: 2, firstTry: 1, states: ['first-try', 'later'] })
    })

    it('estado indefinido tira o cartão da conta (missão em revisão)', () => {
        const score = lessonScore([[check('a'), mission('m')]], (id) => (id === 'm' ? undefined : 'first-try'))
        expect(score).toEqual({ total: 1, firstTry: 1, states: ['first-try'] })
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
