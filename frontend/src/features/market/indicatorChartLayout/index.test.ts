import { describe, expect, it } from 'vitest'
import { computeIndicatorChartLayout, INDICATOR_CHART_HEIGHT, INDICATOR_CHART_WIDTH } from '.'

describe('features/market/indicatorChartLayout', () => {
    it('devolve null com menos de 2 entradas', () => {
        expect(computeIndicatorChartLayout([])).toBeNull()
        expect(computeIndicatorChartLayout([{ simulatedDay: 1, value: 9.75 }])).toBeNull()
    })

    it('primeiro e último ponto ficam nas bordas do viewBox', () => {
        const layout = computeIndicatorChartLayout([
            { simulatedDay: 1, value: 10 },
            { simulatedDay: 21, value: 9.75 },
            { simulatedDay: 42, value: 9.5 },
        ])!

        expect(layout.points[0].x).toBe(0)
        expect(layout.points[layout.points.length - 1].x).toBe(INDICATOR_CHART_WIDTH)
        expect(layout.points.every((p) => p.y >= 0 && p.y <= INDICATOR_CHART_HEIGHT)).toBe(true)
    })

    it('minValue/maxValue refletem o range real das entradas', () => {
        const layout = computeIndicatorChartLayout([
            { simulatedDay: 1, value: 0.003 },
            { simulatedDay: 31, value: 0.0061 },
            { simulatedDay: 61, value: 0.002 },
        ])!

        expect(layout.minValue).toBe(0.002)
        expect(layout.maxValue).toBe(0.0061)
    })
})
