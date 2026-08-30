import { useId, useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { computePriceChartLayout, PRICE_CHART_HEIGHT, PRICE_CHART_WIDTH } from '../../../features/market/priceChartLayout'
import { formatCurrency } from '../../../features/portfolio/format'
import type { PriceChartProps } from './types'
import styles from './index.module.css'

export type { PriceChartProps, PriceChartRange } from './types'

// Gráfico de preço da tela 4.5 (mockup vivo, identidade-visual-padroes.md
// §0/§2) — grid "papel de gráfico" de fundo + área preenchida com
// gradiente, cor de ganho/perda pelo sinal da variação no período (nunca
// preenche projeção nenhuma: cotação histórica é sempre "já aconteceu").
// Não há granularidade "1D" real (o motor simula 1 tick por dia, sem
// intraday) — os intervalos disponíveis (`ranges`, escolhidos pela tela
// que usa este componente) refletem dias simulados, não janelas de day
// trading.
export function PriceChart({ quotes, ranges, activeDays, onRangeChange }: PriceChartProps) {
    const gradientId = useId()
    const patternId = useId()
    const layout = useMemo(() => computePriceChartLayout(quotes), [quotes])
    const color = layout?.isGain ? 'var(--color-gain-500)' : 'var(--color-loss-500)'

    // Hover/toque mostra o valor exato de cada cotação do período (não só
    // min/max) via tooltip estilizado — nunca `title` nativo do navegador,
    // que não segue tema. `pointer` unifica mouse (hover) e toque (arrastar
    // o dedo sobre o gráfico), já que o motor não tem granularidade
    // intraday pra distinguir os dois casos de uso.
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

            <div
                className={styles.chart}
                data-testid="price-chart"
                onPointerMove={layout ? handlePointerMove : undefined}
                onPointerLeave={() => setHoveredIndex(null)}
            >
                <div className={styles.canvas}>
                    {layout ? (
                        <>
                            <svg
                                viewBox={`0 0 ${PRICE_CHART_WIDTH} ${PRICE_CHART_HEIGHT}`}
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
                                <rect x={0} y={0} width={PRICE_CHART_WIDTH} height={PRICE_CHART_HEIGHT} fill={`url(#${patternId})`} />
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
                                            y2={PRICE_CHART_HEIGHT}
                                        />
                                        <circle className={styles.marker} cx={hoveredPoint.x} cy={hoveredPoint.y} r={7} fill={color} />
                                    </>
                                )}
                            </svg>
                            <span className={styles.maxLabel}>{formatCurrency(layout.maxPrice)}</span>
                            <span className={styles.minLabel}>{formatCurrency(layout.minPrice)}</span>
                        </>
                    ) : (
                        <p className={styles.empty}>Aguardando cotações suficientes pra desenhar o gráfico.</p>
                    )}
                </div>

                {hoveredPoint && (
                    <div
                        className={styles.tooltip}
                        data-testid="price-chart-tooltip"
                        style={{ left: `${Math.min(94, Math.max(6, (hoveredPoint.x / PRICE_CHART_WIDTH) * 100))}%` }}
                        aria-hidden="true"
                    >
                        <span className={styles.tooltipDay}>Dia {hoveredPoint.simulatedDay}</span>
                        <span className={styles.tooltipPrice}>{formatCurrency(hoveredPoint.price)}</span>
                    </div>
                )}
            </div>
        </div>
    )
}
