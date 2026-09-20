import type { IndicatorChartEntry, IndicatorChartLayout } from './types'

export type { IndicatorChartEntry, IndicatorChartLayout, IndicatorChartPoint } from './types'

// Mesma convenção de unidades virtuais de `features/market/
// priceChartLayout` (viewBox escala pro container real). Generalizado por
// `value` em vez de `price` — tela "Indicadores Econômicos" (M.4) desenha
// Selic (já em pontos percentuais) e IPCA acumulado 12m (razão 0–1) com a
// mesma matemática de escala, só o `formatValue` de exibição muda por
// instância de `IndicatorLineChart`. Diferente de `PriceChart`, não há
// noção de "ganho/perda" aqui — Selic/IPCA são dado macro neutro, não
// rentabilidade (identidade-visual-tokens.md §2.3/2.3a: `--color-gain-*`/
// `--color-loss-*` têm semântica própria, não reaproveitável aqui).
export const INDICATOR_CHART_WIDTH = 1000
export const INDICATOR_CHART_HEIGHT = 400

const MARGIN_Y = INDICATOR_CHART_HEIGHT * 0.1

export function computeIndicatorChartLayout(entries: IndicatorChartEntry[]): IndicatorChartLayout | null {
    if (entries.length < 2) return null

    const values = entries.map((e) => e.value)
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const range = maxValue - minValue || 1
    const usableH = INDICATOR_CHART_HEIGHT - 2 * MARGIN_Y

    const points = entries.map((entry, index) => {
        const x = entries.length === 1 ? 0 : (index / (entries.length - 1)) * INDICATOR_CHART_WIDTH
        const y = MARGIN_Y + usableH - ((entry.value - minValue) / range) * usableH
        return { x, y, value: entry.value, simulatedDay: entry.simulatedDay }
    })

    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
    const lastPoint = points[points.length - 1]
    const firstPoint = points[0]
    const fillPath = `${linePath} L${lastPoint.x.toFixed(1)},${INDICATOR_CHART_HEIGHT} L${firstPoint.x.toFixed(1)},${INDICATOR_CHART_HEIGHT} Z`

    return { points, linePath, fillPath, minValue, maxValue }
}
