import { describe, expect, it } from 'vitest'
import { buildPhaseCards, termsSeenBeforeEachCard } from '.'
import type { PlayerCard } from '.'

describe('buildPhaseCards', () => {
    it('sem blocos usa o texto legado, igual a splitIntoCards', () => {
        expect(buildPhaseCards(undefined, 'a\n\nb')).toEqual([
            { kind: 'text', text: 'a', hidden: false },
            { kind: 'text', text: 'b', hidden: false },
        ])
        expect(buildPhaseCards([], 'x')).toEqual([{ kind: 'text', text: 'x', hidden: false }])
    })

    it('blocos de texto fatiam em cartões e cada widget é um cartão próprio', () => {
        const widget = { type: 'widget' as const, id: 'w', widget: 'callout', props: {} }

        expect(buildPhaseCards([{ type: 'text', markup: 'a\n\nb' }, widget, { type: 'text', markup: 'c' }], 'ignorado')).toEqual([
            { kind: 'text', text: 'a', hidden: false },
            { kind: 'text', text: 'b', hidden: false },
            { kind: 'widget', block: widget },
            { kind: 'text', text: 'c', hidden: false },
        ])
    })

    it('pergunta intermediária é um cartão próprio', () => {
        const check = { type: 'check' as const, id: 'q', kind: 'true_false' as const, prompt: 'p' }

        expect(buildPhaseCards([{ type: 'text', markup: 'a' }, check], '')).toEqual([
            { kind: 'text', text: 'a', hidden: false },
            { kind: 'check', block: check },
        ])
    })
})

describe('termsSeenBeforeEachCard', () => {
    const text = (t: string): PlayerCard => ({ kind: 'text', text: t, hidden: false })

    it('cada cartão de texto sabe quais termos já apareceram antes, entre fases', () => {
        const a = text('Veja o {{FGC}} e o {{Selic}}.')
        const b = text('Sem termo.')
        const c = text('De novo o {{FGC}} e o {{CDI}}.')
        const seen = termsSeenBeforeEachCard([a, b, c])

        expect([...(seen.get(a) ?? [])]).toEqual([])
        expect([...(seen.get(b) ?? [])]).toEqual(['FGC', 'Selic'])
        expect([...(seen.get(c) ?? [])]).toEqual(['FGC', 'Selic'])
    })
})
