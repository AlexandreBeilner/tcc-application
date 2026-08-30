import { describe, expect, it } from 'vitest'
import { computeGrowthChartLayout, GROWTH_CHART_HEIGHT } from '.'
import type { GrowthProjectionPoint } from '../computeGrowthProjection'

function points(...values: [number, number][]): GrowthProjectionPoint[] {
    return values.map(([invested, total], month) => ({ month, interest: 0, invested, total }))
}

describe('computeGrowthChartLayout', () => {
    it('devolve null com menos de 2 pontos', () => {
        expect(computeGrowthChartLayout([])).toBeNull()
        expect(computeGrowthChartLayout(points([1000, 1000]))).toBeNull()
    })

    it('primeiro ponto de cada path começa em x=0', () => {
        const layout = computeGrowthChartLayout(points([1000, 1000], [1100, 1150], [1200, 1310]))
        expect(layout).not.toBeNull()
        expect(layout!.investedPath.startsWith('M0.0,')).toBe(true)
        expect(layout!.totalPath.startsWith('M0.0,')).toBe(true)
    })

    it('valor máximo mapeia pro topo (y pequeno) e mínimo pro fundo (y grande)', () => {
        const layout = computeGrowthChartLayout(points([0, 0], [100, 200]))!
        // Ponto final do total (200, o maior valor) deve estar mais perto do
        // topo do que o ponto final do investido (100).
        const totalYs = layout.totalPath.match(/[ML][\d.]+,([\d.]+)/g)!.map((segment) => Number(segment.split(',')[1]))
        const investedYs = layout.investedPath.match(/[ML][\d.]+,([\d.]+)/g)!.map((segment) => Number(segment.split(',')[1]))
        expect(totalYs[totalYs.length - 1]).toBeLessThan(investedYs[investedYs.length - 1])
    })

    it('investedFillPath fecha a área até a base do gráfico (GROWTH_CHART_HEIGHT)', () => {
        const layout = computeGrowthChartLayout(points([1000, 1000], [1100, 1150]))!
        expect(layout.investedFillPath).toContain(`,${GROWTH_CHART_HEIGHT}`)
        expect(layout.investedFillPath.endsWith('Z')).toBe(true)
    })

    it('minValue nunca é maior que zero, mesmo com valores todos positivos', () => {
        const layout = computeGrowthChartLayout(points([500, 500], [600, 700]))!
        expect(layout.minValue).toBeLessThanOrEqual(0)
        expect(layout.maxValue).toBe(700)
    })

    it('points (tarefa 6.7.1, hover) tem um item por mês, com mês/invested/total originais e x crescente', () => {
        const layout = computeGrowthChartLayout(points([1000, 1000], [1100, 1150], [1200, 1310]))!
        expect(layout.points).toHaveLength(3)
        expect(layout.points.map((p) => p.month)).toEqual([0, 1, 2])
        expect(layout.points.map((p) => p.invested)).toEqual([1000, 1100, 1200])
        expect(layout.points.map((p) => p.total)).toEqual([1000, 1150, 1310])
        expect(layout.points[0].x).toBe(0)
        expect(layout.points[2].x).toBeGreaterThan(layout.points[1].x)
        expect(layout.points[1].x).toBeGreaterThan(layout.points[0].x)
    })

    it('points: totalY fica acima (menor) de investedY quando total > investido', () => {
        const layout = computeGrowthChartLayout(points([1000, 1000], [1100, 1400]))!
        expect(layout.points[1].totalY).toBeLessThan(layout.points[1].investedY)
    })
})
