import { describe, expect, it } from 'vitest'
import { splitIntoCards } from '.'

describe('splitIntoCards', () => {
    it('sem \\n\\n devolve 1 cartão só, com o texto original (retrocompatível)', () => {
        expect(splitIntoCards('Espalhar capital reduz risco')).toEqual(['Espalhar capital reduz risco'])
    })

    it('texto vazio devolve 1 cartão vazio, não uma lista vazia', () => {
        expect(splitIntoCards('')).toEqual([''])
    })

    it('separa em cartões por quebra dupla de linha', () => {
        expect(splitIntoCards('Primeira ideia.\n\nSegunda ideia.\n\nTerceira ideia.')).toEqual([
            'Primeira ideia.',
            'Segunda ideia.',
            'Terceira ideia.',
        ])
    })

    it('remove espaço em branco nas bordas de cada cartão', () => {
        expect(splitIntoCards('  Primeiro cartão.  \n\n  Segundo cartão.  ')).toEqual(['Primeiro cartão.', 'Segundo cartão.'])
    })

    it('múltiplas quebras duplas seguidas não geram cartão vazio no meio', () => {
        expect(splitIntoCards('Primeiro.\n\n\n\nSegundo.')).toEqual(['Primeiro.', 'Segundo.'])
    })
})
