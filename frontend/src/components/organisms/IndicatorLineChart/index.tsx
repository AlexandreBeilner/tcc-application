import { useId, useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { computeIndicatorChartLayout, INDICATOR_CHART_HEIGHT, INDICATOR_CHART_WIDTH } from '../../../features/market/indicatorChartLayout'
import type { IndicatorLineChartProps } from './types'
import styles from './index.module.css'

export type { IndicatorLineChartProps, IndicatorLineChartRange } from './types'

// Gráfico da tela "Indicadores Econômicos" (tarefa M.4) — mesmo motivo
// visual "papel de gráfico" + área preenchida de `PriceChart`, mas sem a
// semântica de ganho/perda (Selic/IPCA são dado macro, não rentabilidade
// de posição): sempre `--color-brand-500`, nunca `--color-gain-*`/
// `--color-loss-*` (identidade-visual-tokens.md §2.3/2.3a). Reusado pelas duas
// séries da tela (Selic e IPCA acumulado 12m) via `formatValue`, já que a
// escala/formatação difere entre elas (pontos percentuais vs. razão 0–1).
export function IndicatorLineChart({
    title,
    entries,
    ranges,
    activeDays,
    onRangeChange,
    formatValue,
    emptyMessage,
}: IndicatorLineChartProps) {
    const gradientId = useId()
    const patternId = useId()
    const layout = useMemo(() => computeIndicatorChartLayout(entries), [entries])
    const color = 'var(--color-brand-500)'

    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const hoveredPoint = layout && hoveredIndex !== null ? layout.points[hoveredIndex] : null

    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        if (!layout) return
        const rect = event.currentTarget.getBoundingClientRect()
        const fraction = (event.clientX - rect.left) / rect.width
        const clamped = Math.min(1, Math.max(0, fraction))
        setHoveredIndex(Math.round(clamped * (layout.points.length - 1)))
    }

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <span className={styles.title}>{title}</span>
                <div className={styles.tabs}>
                    {ranges.map((range) => (
                        <button
                            key={range.days}
                            type="button"
                            className={[styles.tab, range.days === activeDays && styles.tabActive].filter(Boolean).join(' ')}
                            onClick={() => onRangeChange(range.days)}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>
            </div>

            <div
                className={styles.chart}
                data-testid="indicator-line-chart"
                onPointerMove={layout ? handlePointerMove : undefined}
                onPointerLeave={() => setHoveredIndex(null)}
            >
                <div className={styles.canvas}>
                    {layout ? (
                        <>
                            <svg
                                viewBox={`0 0 ${INDICATOR_CHART_WIDTH} ${INDICATOR_CHART_HEIGHT}`}
                                className={styles.svg}
                                preserveAspectRatio="none"
                                aria-hidden="true"
                            >
                                <defs>
                                    <pattern id={patternId} width="28" height="28" patternUnits="userSpaceOnUse">
                                        <path d="M28 0 L0 0 0 28" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth={1} />
                                    </pattern>
                                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <rect
                                    x={0}
                                    y={0}
                                    width={INDICATOR_CHART_WIDTH}
                                    height={INDICATOR_CHART_HEIGHT}
                                    fill={`url(#${patternId})`}
                                />
                                <path d={layout.fillPath} fill={`url(#${gradientId})`} />
                                <path
                                    d={layout.linePath}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={3}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                {hoveredPoint && (
                                    <>
                                        <line
                                            className={styles.guideLine}
                                            x1={hoveredPoint.x}
                                            y1={0}
                                            x2={hoveredPoint.x}
                                            y2={INDICATOR_CHART_HEIGHT}
                                        />
                                        <circle className={styles.marker} cx={hoveredPoint.x} cy={hoveredPoint.y} r={7} fill={color} />
                                    </>
                                )}
                            </svg>
                            <span className={styles.maxLabel}>{formatValue(layout.maxValue)}</span>
                            <span className={styles.minLabel}>{formatValue(layout.minValue)}</span>
                        </>
                    ) : (
                        <p className={styles.empty}>{emptyMessage ?? 'Aguardando histórico suficiente pra desenhar o gráfico.'}</p>
                    )}
                </div>

                {hoveredPoint && (
                    <div
                        className={styles.tooltip}
                        data-testid="indicator-line-chart-tooltip"
                        style={{ left: `${Math.min(94, Math.max(6, (hoveredPoint.x / INDICATOR_CHART_WIDTH) * 100))}%` }}
                        aria-hidden="true"
                    >
                        <span className={styles.tooltipDay}>Dia {hoveredPoint.simulatedDay}</span>
                        <span className={styles.tooltipValue}>{formatValue(hoveredPoint.value)}</span>
                    </div>
                )}
            </div>
        </div>
    )
}
