import type { GrowthProjectionPoint } from '../computeGrowthProjection'
import type { GrowthChartLayout } from './types'

export type { GrowthChartLayout } from './types'

// Mesma convenção de unidades virtuais de `features/market/priceChartLayout`
// (o componente escala pro container real via viewBox).
export const GROWTH_CHART_WIDTH = 1000
export const GROWTH_CHART_HEIGHT = 400

const MARGIN_Y = GROWTH_CHART_HEIGHT * 0.1

// Gráfico "total vs. investido" da tela 6.1 (inventário) — diferente do
// gráfico de preço (dado histórico real), aqui as duas séries são 100%
// projeção matemática de uma fórmula determinística (juros simples/
// compostos), nunca dado real do usuário. Por isso a regra de "linhas de
// progressão têm altos e baixos" (identidade-visual-padroes.md §4) não se
// aplica — inserir ruído sintético numa curva de juros distorceria a
// própria fórmula que a tela existe pra ensinar. A convenção sólido/
// tracejado (§3) se aplica de outro jeito aqui: "investido" (capital
// aportado, um fato) é a linha sólida preenchida; "total" (aportado +
// juros projetados, uma expectativa) é a linha tracejada por cima, sem
// preenchimento — o ganho nunca aparece "pintado" como se já fosse seu.
export function computeGrowthChartLayout(points: GrowthProjectionPoint[]): GrowthChartLayout | null {
    if (points.length < 2) return null

    const values = points.flatMap((point) => [point.invested, point.total])
    const minValue = Math.min(0, ...values)
    const maxValue = Math.max(...values)
    const range = maxValue - minValue || 1
    const usableHeight = GROWTH_CHART_HEIGHT - 2 * MARGIN_Y

    function toXY(index: number, value: number): { x: number; y: number } {
        const x = (index / (points.length - 1)) * GROWTH_CHART_WIDTH
        const y = MARGIN_Y + usableHeight - ((value - minValue) / range) * usableHeight
        return { x, y }
    }

    function toPath(coords: { x: number; y: number }[]): string {
        return coords.map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(1)},${coord.y.toFixed(1)}`).join(' ')
    }

    const investedCoords = points.map((point, index) => toXY(index, point.invested))
    const totalCoords = points.map((point, index) => toXY(index, point.total))

    const investedPath = toPath(investedCoords)
    const lastX = investedCoords[investedCoords.length - 1].x
    const firstX = investedCoords[0].x
    const investedFillPath = `${investedPath} L${lastX.toFixed(1)},${GROWTH_CHART_HEIGHT} L${firstX.toFixed(1)},${GROWTH_CHART_HEIGHT} Z`

    const hoverPoints = points.map((point, index) => ({
        x: investedCoords[index].x,
        investedY: investedCoords[index].y,
        totalY: totalCoords[index].y,
        month: point.month,
        invested: point.invested,
        total: point.total,
    }))

    return {
        investedPath,
        investedFillPath,
        totalPath: toPath(totalCoords),
        minValue,
        maxValue,
        points: hoverPoints,
    }
}
