import { describe, expect, it } from 'vitest'
import type { Lesson } from '../../../services/lessons'
import { nextLessonTeaser } from '.'

function lesson(overrides: Partial<Lesson>): Lesson {
    return {
        id: 'l',
        code: '1.1',
        title: 'Título',
        trackNumber: 1,
        trackName: 'Trilha',
        sortOrder: 1,
        centralConcept: '',
        scenarioText: '',
        microDecisionPrompt: '',
        microDecisionType: 'reflection',
        microDecisionAssetTicker: null,
        revelationText: '',
        unlocksDescription: '',
        unlocksKeys: [],
        unlocksAssetTicker: null,
        microDecisionOptions: null,
        status: 'available',
        currentStep: 0,
        ...overrides,
    }
}

describe('nextLessonTeaser', () => {
    const current = lesson({ id: 'a', sortOrder: 1 })

    it('pega o título e o começo do primeiro cartão de texto da lição seguinte, sem marcação', () => {
        const next = lesson({
            id: 'b',
            sortOrder: 2,
            title: 'Juros compostos',
            scenarioText: 'O {{FGC}} protege até um limite {{ref:1.4}}.\n\nSegundo cartão.',
        })
        expect(nextLessonTeaser([current, next], current)).toEqual({
            id: 'b',
            title: 'Juros compostos',
            excerpt: 'O FGC protege até um limite .',
        })
    })

    it('corta o texto longo em uma linha, na fronteira de palavra', () => {
        const next = lesson({ id: 'b', sortOrder: 2, scenarioText: 'palavra '.repeat(40) })
        const excerpt = nextLessonTeaser([current, next], current)?.excerpt ?? ''
        expect(excerpt.length).toBeLessThanOrEqual(111)
        expect(excerpt.endsWith('palavra…')).toBe(true)
    })

    it('abrindo com widget, devolve só o título', () => {
        const blocks = {
            schemaVersion: 1,
            phases: {
                scenario: [{ type: 'widget', id: 'w', widget: 'growth-calculator', props: {} }],
                microDecision: [],
                revelation: [],
            },
        }
        const next = lesson({ id: 'b', sortOrder: 2, title: 'Calculadora', blocks })
        expect(nextLessonTeaser([current, next], current)).toEqual({ id: 'b', title: 'Calculadora' })
    })

    it('sem próxima lição, ou com ela bloqueada, não há teaser', () => {
        expect(nextLessonTeaser([current], current)).toBeNull()
        expect(nextLessonTeaser([current, lesson({ id: 'b', sortOrder: 2, status: 'locked' })], current)).toBeNull()
        expect(nextLessonTeaser([current], undefined)).toBeNull()
    })
})
