import { describe, expect, it } from 'vitest'
import type { Lesson } from '../../../services/lessons'
import { computeTrackPathLayout, TRACK_PATH_WIDTH } from '.'

function lesson(overrides: Partial<Lesson>): Lesson {
    return {
        id: 'lesson',
        code: '0.1',
        title: 'Lição',
        trackNumber: 0,
        trackName: 'Fundamentos',
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
        status: 'locked',
        currentStep: 0,
        ...overrides,
    }
}

function lessonsWithStatuses(statuses: Lesson['status'][]): Lesson[] {
    return statuses.map((status, index) => lesson({ id: `${index}`, status }))
}

describe('computeTrackPathLayout', () => {
    it('retorna null com menos de 2 lições (trilha vira lista simples, não mapa)', () => {
        expect(computeTrackPathLayout([])).toBeNull()
        expect(computeTrackPathLayout([lesson({ id: '1' })])).toBeNull()
    })

    it.each([2, 5, 15])('é determinístico — a mesma trilha de %i lições sempre produz o mesmo layout', (count) => {
        const lessons = Array.from({ length: count }, (_, index) =>
            lesson({ id: `${index}`, status: index === 0 ? 'completed' : 'locked' }),
        )

        expect(computeTrackPathLayout(lessons)).toEqual(computeTrackPathLayout(lessons))
    })

    it.each([2, 5, 15])('com %i lições, nenhum nó fica fora da largura útil do canvas', (count) => {
        const lessons = Array.from({ length: count }, (_, index) => lesson({ id: `${index}`, status: 'locked' }))
        const layout = computeTrackPathLayout(lessons)!

        for (const point of layout.points) {
            expect(point.x).toBeGreaterThanOrEqual(0)
            expect(point.x).toBeLessThanOrEqual(TRACK_PATH_WIDTH)
        }
    })

    it.each([2, 5, 15])('com %i lições, o zigue-zague segue o período curto centro → direita → centro → esquerda', (count) => {
        const lessons = Array.from({ length: count }, (_, index) => lesson({ id: `${index}`, status: 'locked' }))
        const layout = computeTrackPathLayout(lessons)!
        const centerX = TRACK_PATH_WIDTH / 2

        for (const [index, point] of layout.points.entries()) {
            const phase = index % 4
            if (phase === 0) expect(point.x).toBeCloseTo(centerX, 5)
            if (phase === 1) expect(point.x).toBeGreaterThan(centerX)
            if (phase === 2) expect(point.x).toBeCloseTo(centerX, 5)
            if (phase === 3) expect(point.x).toBeLessThan(centerX)
        }
    })

    it('a altura do canvas cresce linearmente com o nº de lições', () => {
        const heightFor = (count: number) => computeTrackPathLayout(lessonsWithStatuses(Array(count).fill('locked')))!.height

        expect(heightFor(5)).toBeLessThan(heightFor(15))
        expect(heightFor(15) - heightFor(10)).toBeCloseTo(heightFor(10) - heightFor(5), 5)
    })

    it('cada lição fica mais abaixo que a anterior — progressão desce a página', () => {
        const layout = computeTrackPathLayout(lessonsWithStatuses(Array(5).fill('locked')))!

        for (let index = 1; index < layout.points.length; index++) {
            expect(layout.points[index].y).toBeGreaterThan(layout.points[index - 1].y)
        }
    })

    it('marca a lição available como o ponto atual ("você está aqui")', () => {
        const layout = computeTrackPathLayout(lessonsWithStatuses(['completed', 'available', 'locked']))!

        expect(layout.currentPoint?.lesson.id).toBe('1')
    })

    it('sem lição available, não há ponto atual', () => {
        const layout = computeTrackPathLayout(lessonsWithStatuses(['completed', 'completed']))!

        expect(layout.currentPoint).toBeNull()
    })

    it('trilha inteira bloqueada: nada sólido, tudo tracejado', () => {
        const layout = computeTrackPathLayout(lessonsWithStatuses(['locked', 'locked', 'locked']))!

        expect(layout.solidPath).toBeNull()
        expect(layout.dashedPath).not.toBeNull()
    })

    it('trilha inteira concluída: tudo sólido, nada tracejado', () => {
        const layout = computeTrackPathLayout(lessonsWithStatuses(['completed', 'completed', 'completed']))!

        expect(layout.solidPath).not.toBeNull()
        expect(layout.dashedPath).toBeNull()
    })

    it('trilha parcial: sólido até a lição available (inclusive), tracejado dali em diante', () => {
        const layout = computeTrackPathLayout(lessonsWithStatuses(['completed', 'completed', 'available', 'locked', 'locked']))!

        expect(layout.solidPath).not.toBeNull()
        expect(layout.dashedPath).not.toBeNull()
    })
})
