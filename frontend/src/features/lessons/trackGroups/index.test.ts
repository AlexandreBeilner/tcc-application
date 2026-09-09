import { describe, expect, it } from 'vitest'
import { findActiveTrackNumber, groupLessonsByTrack } from '.'
import type { Lesson } from '../../../services/lessons'

function lesson(overrides: Partial<Lesson>): Lesson {
    return {
        id: overrides.id ?? 'id',
        code: overrides.code ?? '0.1',
        title: overrides.title ?? 'Lição',
        trackNumber: overrides.trackNumber ?? 0,
        trackName: overrides.trackName ?? 'Fundamentos',
        sortOrder: overrides.sortOrder ?? 1,
        centralConcept: overrides.centralConcept ?? 'Conceito',
        scenarioText: overrides.scenarioText ?? '',
        microDecisionPrompt: overrides.microDecisionPrompt ?? '',
        microDecisionType: overrides.microDecisionType ?? 'reflection',
        microDecisionAssetTicker: overrides.microDecisionAssetTicker ?? null,
        revelationText: overrides.revelationText ?? '',
        unlocksDescription: overrides.unlocksDescription ?? '',
        unlocksKeys: overrides.unlocksKeys ?? [],
        unlocksAssetTicker: overrides.unlocksAssetTicker ?? null,
        microDecisionOptions: overrides.microDecisionOptions ?? null,
        status: overrides.status ?? 'locked',
        currentStep: overrides.currentStep ?? 0,
    }
}

describe('groupLessonsByTrack', () => {
    it('agrupa por trackNumber preservando a ordem de chegada dentro do grupo', () => {
        const lessons = [
            lesson({ id: '1', trackNumber: 0, trackName: 'Fundamentos', sortOrder: 1 }),
            lesson({ id: '2', trackNumber: 1, trackName: 'Renda Fixa', sortOrder: 2 }),
            lesson({ id: '3', trackNumber: 0, trackName: 'Fundamentos', sortOrder: 3 }),
        ]

        expect(groupLessonsByTrack(lessons)).toEqual([
            { trackNumber: 0, trackName: 'Fundamentos', lessons: [lessons[0], lessons[2]] },
            { trackNumber: 1, trackName: 'Renda Fixa', lessons: [lessons[1]] },
        ])
    })

    it('devolve lista vazia pra entrada vazia', () => {
        expect(groupLessonsByTrack([])).toEqual([])
    })

    it('ordena os grupos por trackNumber, não pela ordem de chegada', () => {
        const lessons = [lesson({ trackNumber: 2, trackName: 'Estratégia' }), lesson({ trackNumber: 0, trackName: 'Fundamentos' })]

        expect(groupLessonsByTrack(lessons).map((group) => group.trackNumber)).toEqual([0, 2])
    })
})

describe('findActiveTrackNumber', () => {
    it('escolhe a trilha que contém uma lição available', () => {
        const groups = groupLessonsByTrack([
            lesson({ trackNumber: 0, status: 'completed' }),
            lesson({ trackNumber: 1, status: 'available' }),
            lesson({ trackNumber: 2, status: 'locked' }),
        ])

        expect(findActiveTrackNumber(groups)).toBe(1)
    })

    it('cai pra primeira trilha com lição locked quando não há available (trilha 100% concluída)', () => {
        const groups = groupLessonsByTrack([lesson({ trackNumber: 0, status: 'completed' }), lesson({ trackNumber: 1, status: 'locked' })])

        expect(findActiveTrackNumber(groups)).toBe(1)
    })

    it('devolve undefined quando tudo está concluído', () => {
        const groups = groupLessonsByTrack([lesson({ trackNumber: 0, status: 'completed' })])

        expect(findActiveTrackNumber(groups)).toBeUndefined()
    })
})
