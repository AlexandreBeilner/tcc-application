import type { RetentionChartLayout, RetentionChartPoint, RetentionChartSeries, RetentionChartSeriesInput } from './types'

export type { RetentionChartLayout, RetentionChartPoint, RetentionChartSeries, RetentionChartSeriesInput } from './types'

export const RETENTION_CHART_WIDTH = 1000
export const RETENTION_CHART_HEIGHT = 300

const MARGIN_TOP = RETENTION_CHART_HEIGHT * 0.08
const MARGIN_BOTTOM = RETENTION_CHART_HEIGHT * 0.04

// Teto "redondo" do eixo (1, 2, 5 vezes uma potência de 10) para o rótulo máximo ser legível.
export function niceMax(value: number): number {
    if (value <= 0) return 1
    const exponent = Math.floor(Math.log10(value))
    const base = 10 ** exponent
    const fraction = value / base
    const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
    return step * base
}

const fmt = (n: number) => n.toFixed(1)

// Geometria do gráfico de ativos por dia. Os valores são os reais de cada dia, ligados em linha reta
// de ponto a ponto: sem suavização nem média móvel, para os altos e baixos do uso aparecerem como
// são (identidade-visual-padroes.md §4: o ruído é o que faz a linha ler como dado de verdade, e aqui
// ele já vem dos dados). Eixo de baixo sempre em zero, porque contagem de pessoas não tem base
// arbitrária.
export function computeRetentionChartLayout(days: number, inputs: RetentionChartSeriesInput[]): RetentionChartLayout | null {
    if (days < 2) return null
    const present = inputs.flatMap((s) => s.values.filter((v): v is number => v !== null))
    if (present.length === 0) return null

    const maxValue = niceMax(Math.max(...present))
    const usable = RETENTION_CHART_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM
    const xs = Array.from({ length: days }, (_, i) => (i / (days - 1)) * RETENTION_CHART_WIDTH)
    const yOf = (value: number) => MARGIN_TOP + usable - (value / maxValue) * usable
    const baseline = RETENTION_CHART_HEIGHT - MARGIN_BOTTOM

    const series = inputs.map<RetentionChartSeries>((input) => {
        const byIndex = input.values.map<RetentionChartPoint | null>((value, i) =>
            value === null ? null : { x: xs[i], y: yOf(value), value },
        )
        const segments: RetentionChartPoint[][] = []
        let current: RetentionChartPoint[] = []
        for (const point of byIndex) {
            if (point === null) {
                if (current.length > 0) segments.push(current)
                current = []
            } else {
                current.push(point)
            }
        }
        if (current.length > 0) segments.push(current)

        const linePath = segments
            .map((segment) => segment.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)},${fmt(p.y)}`).join(' '))
            .join(' ')
        const fillPath = segments
            .map((segment) => {
                const line = segment.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)},${fmt(p.y)}`).join(' ')
                const last = segment[segment.length - 1]
                const first = segment[0]
                return `${line} L${fmt(last.x)},${fmt(baseline)} L${fmt(first.x)},${fmt(baseline)} Z`
            })
            .join(' ')
        return { key: input.key, segments, linePath, fillPath, byIndex }
    })

    return { series, maxValue, xs }
}
