import type { AssetCategory, CategorySlice } from './distribution'
import { formatPercentage } from './format'
import styles from './DistributionChart.module.css'

// Slots 1-6 da paleta categórica validada (`index.css`) — mesma ordem fixa
// de `CATEGORY_ORDER` (`distribution.ts`), nunca reordenada por valor.
const SLICE_COLOR_VAR: Record<AssetCategory, string> = {
    tesouro: 'var(--chart-series-1)',
    cdbLcaLci: 'var(--chart-series-2)',
    criCra: 'var(--chart-series-3)',
    acao: 'var(--chart-series-4)',
    etf: 'var(--chart-series-5)',
    fii: 'var(--chart-series-6)',
}

interface DistributionChartProps {
    slices: CategorySlice[]
}

// Fora do componente (sem variável reatribuída durante o render) — cada
// fatia soma sua própria fração de 360deg às anteriores via `reduce`, sem
// mutar uma variável capturada pelo closure do `.map`.
function buildConicGradientStops(slices: CategorySlice[]): string[] {
    const stops: string[] = []
    slices.reduce((cumulativeDegrees, slice) => {
        const end = cumulativeDegrees + slice.percentage * 360
        stops.push(`${SLICE_COLOR_VAR[slice.category]} ${cumulativeDegrees}deg ${end}deg`)
        return end
    }, 0)
    return stops
}

// Anel via `conic-gradient` (sem lib de gráfico nova — decisão da
// introdução da Semana 6: só TanStack Query é dependência de runtime
// nova). Sem gap entre fatias (mark spec da skill `dataviz` pede um
// respiro de 2px entre segmentos, deixado de fora aqui por simplicidade —
// o donut já tem legenda com rótulo direto de texto, que é o canal de
// alívio exigido pelo contraste abaixo de 3:1 de 3 das 6 cores no tema
// claro, `index.css`).
export function DistributionChart({ slices }: DistributionChartProps) {
    const stops = buildConicGradientStops(slices)

    return (
        <div className={styles.wrapper}>
            <div
                className={styles.ring}
                style={{ background: `conic-gradient(${stops.join(', ')})` }}
                role="img"
                aria-label="Distribuição dos investimentos por categoria de ativo"
            />
            <ul className={styles.legend}>
                {slices.map((slice) => (
                    <li key={slice.category} className={styles.legendItem}>
                        <span className={styles.swatch} style={{ background: SLICE_COLOR_VAR[slice.category] }} aria-hidden="true" />
                        <span className={styles.legendLabel}>{slice.label}</span>
                        <span className={`${styles.legendValue} tabular-nums`}>{formatPercentage(slice.percentage)}</span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
