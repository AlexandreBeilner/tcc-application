import { INFLATION_TARGET_PCT, INFLATION_TOLERANCE_PP } from '../macroMath'

export const SELIC_IPCA_CHART_WIDTH = 1000
export const SELIC_IPCA_CHART_HEIGHT = 360

const MARGIN_Y = SELIC_IPCA_CHART_HEIGHT * 0.08

export interface SelicIpcaEntry {
    simulatedDay: number
    selicPct: number
    ipcaPct: number
}

export interface SelicIpcaChartLayout {
    selicPath: string
    ipcaPath: string
    bandTop: number
    bandHeight: number
    targetY: number
    minValue: number
    maxValue: number
}

// Selic e IPCA acumulado em 12 meses dividem a mesma escala (os dois em % ao
// ano), e a faixa da meta entra no domínio para sempre aparecer inteira.
export function computeSelicIpcaChartLayout(entries: SelicIpcaEntry[]): SelicIpcaChartLayout | null {
    if (entries.length < 2) return null

    const bandLow = INFLATION_TARGET_PCT - INFLATION_TOLERANCE_PP
    const bandHigh = INFLATION_TARGET_PCT + INFLATION_TOLERANCE_PP
    const values = entries.flatMap((entry) => [entry.selicPct, entry.ipcaPct]).concat([bandLow, bandHigh])
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const range = maxValue - minValue || 1
    const usableH = SELIC_IPCA_CHART_HEIGHT - 2 * MARGIN_Y
    const yOf = (value: number) => MARGIN_Y + usableH - ((value - minValue) / range) * usableH
    const pathOf = (pick: (entry: SelicIpcaEntry) => number) =>
        entries
            .map((entry, index) => {
                const x = (index / (entries.length - 1)) * SELIC_IPCA_CHART_WIDTH
                return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${yOf(pick(entry)).toFixed(1)}`
            })
            .join(' ')

    return {
        selicPath: pathOf((entry) => entry.selicPct),
        ipcaPath: pathOf((entry) => entry.ipcaPct),
        bandTop: yOf(bandHigh),
        bandHeight: yOf(bandLow) - yOf(bandHigh),
        targetY: yOf(INFLATION_TARGET_PCT),
        minValue,
        maxValue,
    }
}
