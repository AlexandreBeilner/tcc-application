import { describe, expect, it } from 'vitest'
import { glossary } from '../glossary'
import { allTermCards, deriveTermCollection, trackNumberOfLessonCode } from '.'

const catalog = {
    Selic: { definition: 'Juro básico.', originLesson: '0.5' },
    EBIT: { definition: 'Lucro operacional.', example: 'ex', originLesson: '2.7.1' },
    'day trade': { definition: 'Mesmo dia.', originLesson: '2.12' },
    orçamento: { definition: 'Entra e sai.', originLesson: 'F.1' },
    órfão: { definition: 'Sem lição.' },
    estranho: { definition: 'Código fora do padrão.', originLesson: 'X.9' },
}

describe('trackNumberOfLessonCode', () => {
    it.each([
        ['0.1', 0],
        ['2.7.1', 2],
        ['3.5', 3],
        ['F.2', 4],
        ['9.1', undefined],
        ['X.1', undefined],
        ['', undefined],
    ])('%s -> %s', (code, expected) => {
        expect(trackNumberOfLessonCode(code)).toBe(expected)
    })
})

describe('deriveTermCollection', () => {
    it('ganha a carta ao concluir a lição que ensina o termo; as outras ficam por ganhar', () => {
        const { earned, locked, total } = deriveTermCollection(['0.5', '2.7.1'], catalog)

        expect(earned.map((c) => c.term)).toEqual(['Selic', 'EBIT'])
        expect(locked.map((c) => c.term)).toEqual(['day trade', 'orçamento'])
        expect(total).toBe(4)
    })

    it('termo sem lição de origem, ou com código fora do padrão, não entra no baralho', () => {
        expect(allTermCards(catalog).map((c) => c.term)).not.toContain('órfão')
        expect(allTermCards(catalog).map((c) => c.term)).not.toContain('estranho')
    })

    it('sem lição concluída, nenhuma carta ganha; com todas, nenhuma por ganhar', () => {
        expect(deriveTermCollection([], catalog).earned).toEqual([])
        expect(deriveTermCollection(['0.5', '2.7.1', '2.12', 'F.1'], catalog).locked).toEqual([])
    })

    it('segue a ordem do currículo (código de lição numérico, 2.7.1 antes de 2.12)', () => {
        const { earned } = deriveTermCollection(['2.12', '2.7.1', 'F.1', '0.5'], catalog)

        expect(earned.map((c) => c.lessonCode)).toEqual(['0.5', '2.7.1', '2.12', 'F.1'])
    })

    it('leva o exemplo só quando o termo tem um', () => {
        const { earned } = deriveTermCollection(['0.5', '2.7.1'], catalog)

        expect(earned[0]).not.toHaveProperty('example')
        expect(earned[1]?.example).toBe('ex')
    })

    it('o glossário de verdade gera um baralho com carta para quase todo termo', () => {
        const cards = allTermCards()
        const withOrigin = Object.values(glossary).filter((entry) => entry.originLesson).length

        expect(cards.length).toBe(withOrigin)
        expect(cards.length).toBeGreaterThan(40)
    })
})
