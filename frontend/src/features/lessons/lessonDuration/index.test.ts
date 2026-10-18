import { describe, expect, it } from 'vitest'
import type { PlayerCard } from '../playerCards'
import type { MicroDecisionType } from '../../../services/lessons'
import { cardSeconds, durationLabel, lessonMinutes, toMinutes } from '.'
import seedLessons from './seedLessons.fixture.json'

// Três lições reais do seed, como a API as devolve (sem gabarito): a menor (0.1), uma de tamanho médio (1.12)
// e a mais longa (2.12). Se o currículo mudar, os minutos esperados abaixo são o primeiro lugar a conferir.
function real(code: string, currentStep: number) {
    const lesson = seedLessons.find((candidate) => candidate.code === code)!
    return { ...lesson, microDecisionType: lesson.microDecisionType as MicroDecisionType, currentStep }
}

const text = (chars: number): PlayerCard => ({ kind: 'text', text: 'a'.repeat(chars), hidden: false })

describe('cardSeconds', () => {
    it('texto conta 15 caracteres por segundo e ignora a marcação', () => {
        expect(cardSeconds(text(150))).toBe(10)
        expect(cardSeconds({ kind: 'text', text: 'O {{FGC}} protege {{ref:1.4}}', hidden: false })).toBe('O FGC protege'.length / 15)
    })

    it('pergunta vale 15 s e widget de ferramenta 30 s', () => {
        expect(cardSeconds({ kind: 'check', block: { type: 'check', id: 'q', kind: 'true_false', prompt: 'p' } })).toBe(15)
        expect(cardSeconds({ kind: 'widget', block: { type: 'widget', id: 'w', widget: 'growth-calculator', props: {} } })).toBe(30)
        const goal = { text: 't', metric: 'interestRatio', op: 'gte', value: 2, reveal: 'r' } as const
        expect(cardSeconds({ kind: 'widget', block: { type: 'widget', id: 'w', widget: 'growth-calculator', props: {}, goal } })).toBe(45)
    })

    it('callout e "Na plataforma" são leitura: contam pelos caracteres do texto', () => {
        const callout: PlayerCard = {
            kind: 'widget',
            block: { type: 'widget', id: 'c', widget: 'callout', props: { title: 'a'.repeat(60), body: 'b'.repeat(90) } },
        }
        expect(cardSeconds(callout)).toBe(10)
    })

    it('rodapé "Na plataforma" recolhido não entra na conta', () => {
        const note = {
            type: 'widget' as const,
            id: 'n',
            widget: 'platform-note' as const,
            props: { brazil: 'x'.repeat(300), here: 'y', why: 'z' },
        }
        expect(cardSeconds({ ...text(150), footnotes: [note] })).toBe(10)
    })
})

describe('toMinutes', () => {
    it.each([
        [0, 2],
        [60, 2],
        [149, 2],
        [150, 3],
        [330, 6],
    ])('%i s vira %i min (arredonda, mínimo 2)', (seconds, minutes) => {
        expect(toMinutes(seconds)).toBe(minutes)
    })
})

describe('lessonMinutes e durationLabel com lições reais do seed', () => {
    it.each([
        ['0.1', 2, 2],
        ['1.12', 4, 3],
        ['2.12', 4, 4],
    ])('lição %s: %i min inteira, %i min a partir da Micro-decisão', (code, whole, fromBet) => {
        const lesson = real(code, 0)
        expect(lessonMinutes(lesson)).toBe(whole)
        expect(lessonMinutes(lesson, 1)).toBe(fromBet)
    })

    it('lição nova mostra "~N min" e a retomada mostra "Faltam ~N min"', () => {
        expect(durationLabel(real('1.12', 0))).toBe('~4 min')
        expect(durationLabel(real('1.12', 1))).toBe('Faltam ~3 min')
        expect(durationLabel(real('0.1', 2))).toBe('Faltam ~2 min')
    })

    it('lição sem blocks usa o texto legado e a aposta legada conta como uma pergunta', () => {
        const legacy = {
            blocks: null,
            scenarioText: 'a'.repeat(1500),
            microDecisionPrompt: '',
            revelationText: '',
            microDecisionType: 'reflection' as const,
            microDecisionOptions: ['sim', 'não'],
            currentStep: 0,
        }
        // 1500 caracteres = 100 s, mais 15 s da aposta = 115 s, que arredondam para 2 min.
        expect(lessonMinutes(legacy)).toBe(2)
        expect(lessonMinutes({ ...legacy, scenarioText: 'a'.repeat(3000) })).toBe(4)
    })
})
