import { describe, expect, it } from 'vitest'
import type { Lesson } from '../../../services/lessons'
import { computeTrackChartLayout, TRACK_CHART_HEIGHT, TRACK_CHART_WIDTH } from '.'

function lesson(overrides: Partial<Lesson>): Lesson {
    return {
        id: 'lesson',
        code: '0.1',
        title: 'Lição',
        trackNumber: 0,
        trackName: 'Fundamentos',
        sortOrder: 1,
        centralConcept: '',
        unlocksDescription: '',
        unlocksKeys: [],
        status: 'locked',
        currentStep: 0,
        ...overrides,
    }
}

describe('computeTrackChartLayout', () => {
    it('retorna null com menos de 2 lições (trilha vira lista simples, não gráfico)', () => {
        expect(computeTrackChartLayout([])).toBeNull()
        expect(computeTrackChartLayout([lesson({ id: '1' })])).toBeNull()
    })

    it('é determinístico — a mesma trilha sempre produz o mesmo layout', () => {
        const lessons = [
            lesson({ id: '1', status: 'completed' }),
            lesson({ id: '2', status: 'available' }),
            lesson({ id: '3', status: 'locked' }),
        ]

        expect(computeTrackChartLayout(lessons)).toEqual(computeTrackChartLayout(lessons))
    })

    it('cada marco real fica acima do anterior — tendência de alta de longo prazo garantida', () => {
        const lessons = [
            lesson({ id: '1', status: 'completed' }),
            lesson({ id: '2', status: 'completed' }),
            lesson({ id: '3', status: 'available' }),
            lesson({ id: '4', status: 'locked' }),
            lesson({ id: '5', status: 'locked' }),
        ]

        const layout = computeTrackChartLayout(lessons)!

        for (let index = 1; index < layout.points.length; index++) {
            // y menor = mais alto na tela (sistema de coordenadas SVG)
            expect(layout.points[index].y).toBeLessThan(layout.points[index - 1].y)
        }
    })

    it('todos os pontos ficam dentro da área virtual do gráfico', () => {
        const lessons = [
            lesson({ id: '1', status: 'completed' }),
            lesson({ id: '2', status: 'available' }),
            lesson({ id: '3', status: 'locked' }),
            lesson({ id: '4', status: 'locked' }),
        ]

        const layout = computeTrackChartLayout(lessons)!

        for (const point of layout.points) {
            expect(point.x).toBeGreaterThanOrEqual(0)
            expect(point.x).toBeLessThanOrEqual(TRACK_CHART_WIDTH)
            expect(point.y).toBeGreaterThanOrEqual(0)
            expect(point.y).toBeLessThanOrEqual(TRACK_CHART_HEIGHT)
        }
    })

    it('marca a lição available como o ponto atual ("você está aqui")', () => {
        const lessons = [lesson({ id: '1', status: 'completed' }), lesson({ id: '2', status: 'available' }), lesson({ id: '3', status: 'locked' })]

        const layout = computeTrackChartLayout(lessons)!

        expect(layout.currentPoint?.lesson.id).toBe('2')
    })

    it('sem lição available, não há ponto atual', () => {
        const lessons = [lesson({ id: '1', status: 'completed' }), lesson({ id: '2', status: 'completed' })]

        expect(computeTrackChartLayout(lessons)!.currentPoint).toBeNull()
    })

    it('trilha inteira bloqueada: nada sólido, tudo tracejado, sem preenchimento', () => {
        const lessons = [lesson({ id: '1', status: 'locked' }), lesson({ id: '2', status: 'locked' })]

        const layout = computeTrackChartLayout(lessons)!

        expect(layout.solidPath).toBeNull()
        expect(layout.fillPath).toBeNull()
        expect(layout.dashedPath).not.toBeNull()
    })

    it('trilha inteira concluída: tudo sólido e preenchido, nada tracejado', () => {
        const lessons = [lesson({ id: '1', status: 'completed' }), lesson({ id: '2', status: 'completed' })]

        const layout = computeTrackChartLayout(lessons)!

        expect(layout.solidPath).not.toBeNull()
        expect(layout.fillPath).not.toBeNull()
        expect(layout.dashedPath).toBeNull()
    })

    it('trilha parcial: sólido até a lição available (inclusive), tracejado dali em diante', () => {
        const lessons = [
            lesson({ id: '1', status: 'completed' }),
            lesson({ id: '2', status: 'available' }),
            lesson({ id: '3', status: 'locked' }),
        ]

        const layout = computeTrackChartLayout(lessons)!

        expect(layout.solidPath).not.toBeNull()
        expect(layout.fillPath).not.toBeNull()
        expect(layout.dashedPath).not.toBeNull()
    })
})
