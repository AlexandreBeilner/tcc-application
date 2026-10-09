import { describe, expect, it } from 'vitest'
import { parseLessonMarkup, termsInText } from '.'

describe('parseLessonMarkup', () => {
    it('texto sem marcação devolve um único segmento de texto, igual ao original', () => {
        const segments = parseLessonMarkup('Texto normal, sem termo nenhum.')

        expect(segments).toEqual([{ type: 'text', value: 'Texto normal, sem termo nenhum.' }])
    })

    it('termo marcado no catálogo vira segmento term com a definição resolvida', () => {
        const segments = parseLessonMarkup('Garantido pelo {{FGC}} até o limite.')

        expect(segments).toEqual([
            { type: 'text', value: 'Garantido pelo ' },
            { type: 'term', term: 'FGC', definition: expect.stringContaining('Fundo Garantidor') },
            { type: 'text', value: ' até o limite.' },
        ])
    })

    it('termo sem entrada no catálogo cai de volta pro texto puro, sem quebrar', () => {
        const segments = parseLessonMarkup('Isso é {{TermoInexistente}} no meio da frase.')

        expect(segments).toEqual([
            { type: 'text', value: 'Isso é ' },
            { type: 'text', value: 'TermoInexistente' },
            { type: 'text', value: ' no meio da frase.' },
        ])
    })

    it('suporta mais de um termo marcado no mesmo texto', () => {
        const segments = parseLessonMarkup('{{FGC}} e {{EBIT}} são termos diferentes.')

        expect(segments.map((segment) => segment.type)).toEqual(['term', 'text', 'term', 'text'])
        expect(segments[0]).toMatchObject({ term: 'FGC' })
        expect(segments[2]).toMatchObject({ term: 'EBIT' })
    })

    it('marcação {{ref:X.Y}} vira segmento ref com o código da lição', () => {
        const segments = parseLessonMarkup('Você já viu isso em {{ref:2.1}} antes.')

        expect(segments).toEqual([
            { type: 'text', value: 'Você já viu isso em ' },
            { type: 'ref', code: '2.1' },
            { type: 'text', value: ' antes.' },
        ])
    })

    it('suporta termo de glossário e referência de lição no mesmo texto', () => {
        const segments = parseLessonMarkup('{{FGC}} apareceu em {{ref:1.3}}.')

        expect(segments.map((segment) => segment.type)).toEqual(['term', 'text', 'ref', 'text'])
        expect(segments[2]).toMatchObject({ code: '1.3' })
    })
})

describe('termsInText', () => {
    it('lista só termos do catálogo, na ordem, ignorando ref e desconhecidos', () => {
        expect(termsInText('{{FGC}} {{ref:1.4}} {{Inexistente}} {{Selic}}')).toEqual(['FGC', 'Selic'])
    })
})
