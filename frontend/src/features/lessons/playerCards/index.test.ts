import { describe, expect, it } from 'vitest'
import { buildPhaseCards } from '.'

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
})
