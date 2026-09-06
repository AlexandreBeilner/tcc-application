import { describe, expect, it } from 'vitest'
import { splitIntoCards } from '.'

describe('splitIntoCards', () => {
    it('sem \\n\\n devolve 1 cartão só, com o texto original (retrocompatível)', () => {
        expect(splitIntoCards('Espalhar capital reduz risco')).toEqual([{ text: 'Espalhar capital reduz risco', hidden: false }])
    })

    it('texto vazio devolve 1 cartão vazio, não uma lista vazia', () => {
        expect(splitIntoCards('')).toEqual([{ text: '', hidden: false }])
    })

    it('separa em cartões por quebra dupla de linha', () => {
        expect(splitIntoCards('Primeira ideia.\n\nSegunda ideia.\n\nTerceira ideia.')).toEqual([
            { text: 'Primeira ideia.', hidden: false },
            { text: 'Segunda ideia.', hidden: false },
            { text: 'Terceira ideia.', hidden: false },
        ])
    })

    it('remove espaço em branco nas bordas de cada cartão', () => {
        expect(splitIntoCards('  Primeiro cartão.  \n\n  Segundo cartão.  ')).toEqual([
            { text: 'Primeiro cartão.', hidden: false },
            { text: 'Segundo cartão.', hidden: false },
        ])
    })

    it('múltiplas quebras duplas seguidas não geram cartão vazio no meio', () => {
        expect(splitIntoCards('Primeiro.\n\n\n\nSegundo.')).toEqual([
            { text: 'Primeiro.', hidden: false },
            { text: 'Segundo.', hidden: false },
        ])
    })

    it('cartão marcado com [revelar] some texto e marca hidden', () => {
        expect(splitIntoCards('[revelar] O LCI vence.')).toEqual([{ text: 'O LCI vence.', hidden: true }])
    })

    it('só o cartão com o prefixo fica hidden — os demais no mesmo texto continuam diretos', () => {
        expect(splitIntoCards('Explicação normal.\n\n[revelar] Resultado escondido.\n\nConclusão normal.')).toEqual([
            { text: 'Explicação normal.', hidden: false },
            { text: 'Resultado escondido.', hidden: true },
            { text: 'Conclusão normal.', hidden: false },
        ])
    })

    it('prefixo só conta no início do cartão (depois do trim), não em qualquer lugar do texto', () => {
        expect(splitIntoCards('O texto menciona [revelar] no meio, sem ser prefixo.')).toEqual([
            { text: 'O texto menciona [revelar] no meio, sem ser prefixo.', hidden: false },
        ])
    })
})
