import { useMemo } from 'react'
import {
    computeSelicIpcaChartLayout,
    SELIC_IPCA_CHART_HEIGHT,
    SELIC_IPCA_CHART_WIDTH,
} from '../../../features/lessons/widgets/selicIpcaChartLayout'
import { INFLATION_TARGET_PCT, INFLATION_TOLERANCE_PP, inflationBand } from '../../../features/lessons/widgets/macroMath'
import { useIndicatorHistoryQuery } from '../../../features/market/useIndicatorHistoryQuery'
import type { SelicIpcaChartWidgetProps } from './types'
import styles from '../LessonWidget/widgetControls.module.css'

export type { SelicIpcaChartWidgetProps } from './types'

const pct = (value: number) => `${value.toFixed(2).replace('.', ',')}%`
const BAND_LABEL = { below: 'abaixo da faixa da meta', inside: 'dentro da faixa da meta', above: 'acima da faixa da meta' } as const

// Widget `selic-ipca-chart` (RC.3.4c): Selic (linha sólida) e IPCA acumulado em
// 12 meses (linha tracejada) na mesma escala, com a faixa da meta de inflação
// sombreada. Mesma fonte da tela Indicadores.
export function SelicIpcaChartWidget({ windowDays }: SelicIpcaChartWidgetProps) {
    const history = useIndicatorHistoryQuery(windowDays)
    const entries = history.data?.indicators
    const chartEntries = useMemo(
        () =>
            (entries ?? []).map((entry) => ({
                simulatedDay: entry.simulated_day,
                selicPct: entry.selic_rate,
                ipcaPct: entry.ipca_accumulated_12m * 100,
            })),
        [entries],
    )
    const layout = useMemo(() => computeSelicIpcaChartLayout(chartEntries), [chartEntries])

    if (history.isLoading) {
        return <p aria-live="polite">Carregando a série de juros e inflação…</p>
    }
    if (!layout) {
        return <p aria-live="polite">Ainda não há histórico suficiente de juros e inflação para desenhar o gráfico.</p>
    }

    const latest = chartEntries[chartEntries.length - 1]
    const lowLabel = INFLATION_TARGET_PCT - INFLATION_TOLERANCE_PP
    const highLabel = INFLATION_TARGET_PCT + INFLATION_TOLERANCE_PP

    return (
        <div className={styles.root}>
            <ul className={styles.legend}>
                <li>
                    <span className={styles.swatchSolid} aria-hidden="true" /> Selic (linha contínua)
                </li>
                <li>
                    <span className={styles.swatchDashed} aria-hidden="true" /> IPCA em 12 meses (linha tracejada)
                </li>
                <li>
                    <span className={styles.swatchBand} aria-hidden="true" /> Faixa da meta ({pct(lowLabel)} a {pct(highLabel)})
                </li>
            </ul>
            <svg
                className={styles.chartSvg}
                viewBox={`0 0 ${SELIC_IPCA_CHART_WIDTH} ${SELIC_IPCA_CHART_HEIGHT}`}
                preserveAspectRatio="none"
                role="img"
                aria-label="Gráfico da Selic e do IPCA acumulado em 12 meses com a faixa da meta de inflação"
            >
                <rect className={styles.chartBand} x={0} y={layout.bandTop} width={SELIC_IPCA_CHART_WIDTH} height={layout.bandHeight} />
                <line className={styles.chartTarget} x1={0} x2={SELIC_IPCA_CHART_WIDTH} y1={layout.targetY} y2={layout.targetY} />
                <path className={styles.chartSelic} d={layout.selicPath} fill="none" vectorEffect="non-scaling-stroke" />
                <path className={styles.chartIpca} d={layout.ipcaPath} fill="none" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className={styles.result} aria-live="polite">
                <p>Selic atual: {pct(latest.selicPct)} ao ano</p>
                <p>
                    IPCA em 12 meses: {pct(latest.ipcaPct)}, {BAND_LABEL[inflationBand(latest.ipcaPct)]}.
                </p>
            </div>
        </div>
    )
}

export function selicIpcaChartSummary({ windowDays }: SelicIpcaChartWidgetProps): string {
    return `Gráfico da Selic e do IPCA acumulado em 12 meses nos últimos ${windowDays} dias, com a faixa da meta de inflação de ${pct(INFLATION_TARGET_PCT)} com tolerância de ${INFLATION_TOLERANCE_PP.toString().replace('.', ',')} ponto percentual.`
}
