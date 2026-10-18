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

describe('buildPhaseCards: "Na plataforma" como rodapé (LJ.1.3)', () => {
    const note = (id: string) => ({ type: 'widget' as const, id, widget: 'platform-note', props: { brazil: 'a', here: 'b', why: 'c' } })
    const widget = { type: 'widget' as const, id: 'w', widget: 'callout', props: {} }

    it('nota depois de outro bloco vira rodapé do cartão anterior, sem cartão próprio', () => {
        const cards = buildPhaseCards([{ type: 'text', markup: 'a\n\nb' }, note('n1'), { type: 'text', markup: 'c' }], '')

        expect(cards).toEqual([
            { kind: 'text', text: 'a', hidden: false },
            { kind: 'text', text: 'b', hidden: false, footnotes: [note('n1')] },
            { kind: 'text', text: 'c', hidden: false },
        ])
    })

    it('nota depois de widget ou de pergunta também gruda no cartão deles', () => {
        const check = { type: 'check' as const, id: 'q', kind: 'true_false' as const, prompt: 'p' }
        const cards = buildPhaseCards([widget, note('n1'), check, note('n2')], '')

        expect(cards).toEqual([
            { kind: 'widget', block: widget, footnotes: [note('n1')] },
            { kind: 'check', block: check, footnotes: [note('n2')] },
        ])
    })

    it('nota como primeiro bloco da fase continua cartão próprio', () => {
        expect(buildPhaseCards([note('n1'), { type: 'text', markup: 'a' }], '')).toEqual([
            { kind: 'widget', block: note('n1') },
            { kind: 'text', text: 'a', hidden: false },
        ])
    })

    it('duas notas seguidas ficam as duas no mesmo cartão, na ordem', () => {
        const cards = buildPhaseCards([{ type: 'text', markup: 'a' }, note('n1'), note('n2')], '')

        expect(cards).toEqual([{ kind: 'text', text: 'a', hidden: false, footnotes: [note('n1'), note('n2')] }])
    })

    it('a nota de uma fase não gruda no último cartão da fase anterior', () => {
        const phase2 = buildPhaseCards([note('n1')], '')

        expect(phase2).toEqual([{ kind: 'widget', block: note('n1') }])
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

describe('buildPhaseCards: "Saiba mais" recolhido (LJ.5.7)', () => {
    const more = (id: string, markup = 'detalhe') => ({
        type: 'more' as const,
        id,
        title: 'Título',
        blocks: [{ type: 'text' as const, markup }],
    })

    it('gruda no cartão anterior e não conta como cartão', () => {
        const cards = buildPhaseCards([{ type: 'text', markup: 'a\n\nb' }, more('m1'), { type: 'text', markup: 'c' }], '')

        expect(cards).toEqual([
            { kind: 'text', text: 'a', hidden: false },
            { kind: 'text', text: 'b', hidden: false, more: [more('m1')] },
            { kind: 'text', text: 'c', hidden: false },
        ])
    })

    it('convive com a nota "Na plataforma" no mesmo cartão', () => {
        const note = { type: 'widget' as const, id: 'n', widget: 'platform-note', props: {} }
        const [card] = buildPhaseCards([{ type: 'text', markup: 'a' }, note, more('m1')], '')

        expect(card).toMatchObject({ footnotes: [note], more: [more('m1')] })
    })

    it('sem cartão a que se colar, o conteúdo vira cartões em vez de sumir', () => {
        expect(buildPhaseCards([more('m1', 'solto'), { type: 'text', markup: 'a' }], '')).toEqual([
            { kind: 'text', text: 'solto', hidden: false },
            { kind: 'text', text: 'a', hidden: false },
        ])
    })
})

describe('buildPhaseCards: enquete (LJ.2.6)', () => {
    const poll = { type: 'poll' as const, id: 'e1', prompt: 'E você?', options: ['a', 'b'] }

    it('vira um cartão próprio, na posição do bloco, e uma nota "Na plataforma" cola nele', () => {
        const note = { type: 'widget' as const, id: 'n', widget: 'platform-note' as const, props: { brazil: 'a', here: 'b', why: 'c' } }
        const cards = buildPhaseCards([{ type: 'text', markup: 'antes' }, poll, note, { type: 'text', markup: 'depois' }], '')

        expect(cards.map((card) => card.kind)).toEqual(['text', 'poll', 'text'])
        expect(cards[1]).toEqual({ kind: 'poll', block: poll, footnotes: [note] })
    })
})
