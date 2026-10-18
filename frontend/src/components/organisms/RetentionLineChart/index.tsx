import { useId, useMemo, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { computeRetentionChartLayout, RETENTION_CHART_HEIGHT, RETENTION_CHART_WIDTH } from '../../../features/admin/retentionChartLayout'
import { formatDay } from '../../../features/admin/retentionFormat'
import type { RetentionLineChartProps } from './types'
import styles from './index.module.css'

export type { RetentionLineChartProps, RetentionLineChartSeries } from './types'

// Gráfico de contagem por dia do painel de retenção (RT.1.3). Mesmo motivo visual "papel de gráfico"
// do `IndicatorLineChart`, mas com a regra de linha de `identidade-visual-padroes.md` §4 aplicada ao
// dado real: os pontos de cada dia são ligados em reta, sem suavização nem média móvel, então os altos
// e baixos do uso aparecem como são. Tudo aqui já aconteceu, por isso sólido; dia sem registro
// interrompe a linha em vez de cair a zero (§3: nunca fingir um valor que não existe).
export function RetentionLineChart({ title, days, series, formatValue, summary, emptyMessage, note }: RetentionLineChartProps) {
    const gradientId = useId()
    const layout = useMemo(
        () =>
            computeRetentionChartLayout(
                days.length,
                series.map((s) => ({ key: s.key, values: s.values })),
            ),
        [days.length, series],
    )
    const [hovered, setHovered] = useState<number | null>(null)

    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        if (!layout) return
        const rect = event.currentTarget.getBoundingClientRect()
        const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
        setHovered(Math.round(fraction * (days.length - 1)))
    }

    function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
        if (!layout) return
        if (event.key === 'Escape') setHovered(null)
        else if (event.key === 'ArrowLeft') setHovered((index) => Math.max(0, (index ?? days.length) - 1))
        else if (event.key === 'ArrowRight') setHovered((index) => Math.min(days.length - 1, (index ?? -1) + 1))
        else return
        event.preventDefault()
    }

    const hoveredX = layout && hovered !== null ? layout.xs[hovered] : null

    return (
        <figure className={styles.card}>
            <figcaption className={styles.header}>
                <span className={styles.title}>{title}</span>
                <ul className={styles.legend} aria-label="Legenda">
                    {series.map((s) => (
                        <li key={s.key} className={styles.legendItem}>
                            <span className={styles.swatch} style={{ background: s.color }} aria-hidden="true" />
                            {s.label}
                        </li>
                    ))}
                </ul>
            </figcaption>

            <div
                className={styles.chart}
                data-testid="retention-line-chart"
                role="img"
                aria-label={summary}
                tabIndex={layout ? 0 : undefined}
                onPointerMove={layout ? handlePointerMove : undefined}
                onPointerLeave={() => setHovered(null)}
                onBlur={() => setHovered(null)}
                onKeyDown={handleKeyDown}
            >
                <div className={styles.canvas}>
                    {layout ? (
                        <>
                            <svg
                                viewBox={`0 0 ${RETENTION_CHART_WIDTH} ${RETENTION_CHART_HEIGHT}`}
                                className={styles.svg}
                                preserveAspectRatio="none"
                                aria-hidden="true"
                            >
                                <defs>
                                    {series.map((s) => (
                                        <linearGradient key={s.key} id={`${gradientId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                                            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                {series.map((s, i) =>
                                    s.filled ? (
                                        <path key={`fill-${s.key}`} d={layout.series[i].fillPath} fill={`url(#${gradientId}-${s.key})`} />
                                    ) : null,
                                )}
                                {series.map((s, i) => (
                                    <path
                                        key={`line-${s.key}`}
                                        d={layout.series[i].linePath}
                                        fill="none"
                                        stroke={s.color}
                                        strokeWidth={s.filled ? 3 : 2.5}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                ))}
                                {series.flatMap((s, i) =>
                                    layout.series[i].segments
                                        .filter((segment) => segment.length === 1)
                                        .map((segment) => (
                                            <circle
                                                key={`dot-${s.key}-${segment[0].x}`}
                                                cx={segment[0].x}
                                                cy={segment[0].y}
                                                r={4}
                                                fill={s.color}
                                            />
                                        )),
                                )}
                                {hoveredX !== null && (
                                    <line className={styles.guideLine} x1={hoveredX} y1={0} x2={hoveredX} y2={RETENTION_CHART_HEIGHT} />
                                )}
                            </svg>
                            <span className={styles.maxLabel}>{formatValue(layout.maxValue)}</span>
                            <span className={styles.minLabel}>{formatValue(0)}</span>
                        </>
                    ) : (
                        <p className={styles.empty}>{emptyMessage}</p>
                    )}
                </div>

                {layout && hovered !== null && hoveredX !== null && (
                    <div
                        className={styles.tooltip}
                        data-testid="retention-line-chart-tooltip"
                        style={{ left: `${Math.min(88, Math.max(12, (hoveredX / RETENTION_CHART_WIDTH) * 100))}%` }}
                        aria-hidden="true"
                    >
                        <span className={styles.tooltipDay}>{formatDay(days[hovered])}</span>
                        {series.map((s) => (
                            <span key={s.key} className={styles.tooltipRow}>
                                <span className={styles.swatch} style={{ background: s.color }} />
                                {s.values[hovered] === null ? 'sem dado' : formatValue(s.values[hovered] as number)}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {layout && (
                <div className={styles.axis} aria-hidden="true">
                    <span>{formatDay(days[0])}</span>
                    <span>{formatDay(days[days.length - 1])}</span>
                </div>
            )}
            {note && <p className={styles.note}>{note}</p>}
        </figure>
    )
}
