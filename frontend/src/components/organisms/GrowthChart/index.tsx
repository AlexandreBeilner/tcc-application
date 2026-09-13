import { useId, useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { computeGrowthChartLayout, GROWTH_CHART_HEIGHT, GROWTH_CHART_WIDTH } from '../../../features/calculator/growthChartLayout'
import { formatCurrency } from '../../../features/portfolio/format'
import type { GrowthChartProps } from './types'
import styles from './index.module.css'

export type { GrowthChartProps } from './types'

// Gráfico "total vs. investido" da tela 6.1 (inventário — wireframe
// original Fig. 7). Convenção sólido/tracejado (identidade-visual-
// padroes.md §3) aplicada de um jeito diferente do gráfico de preço: as
// duas linhas aqui são a mesma projeção matemática do início ao fim, sem
// trecho "já aconteceu" — "investido" (capital que o usuário efetivamente
// aportaria) é a linha sólida preenchida por ser um fato do cálculo,
// "total" (aportado + juros projetados) é tracejada e sem preenchimento
// por cima, marcando que o ganho é só uma expectativa, nunca "pintada"
// como se já fosse patrimônio real (mesma lógica do Mapa da Trilha, que
// preenche só o trecho concluído). Ver `features/calculator/
// growthChartLayout` pro porquê de não ter ruído sintético (§4).
//
// Hover/toque (tarefa 6.7.1) mostra os dois valores intermediários (mês,
// investido, total) do ponto mais próximo do cursor — mesmo padrão de
// `PriceChart` (guia vertical + marcador + tooltip próprio, nunca `title`
// nativo do navegador).
export function GrowthChart({ points }: GrowthChartProps) {
    const gradientId = useId()
    const patternId = useId()
    const layout = useMemo(() => computeGrowthChartLayout(points), [points])

    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const hoveredPoint = layout && hoveredIndex !== null ? layout.points[hoveredIndex] : null

    if (!layout) return null

    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        if (!layout) return
        const rect = event.currentTarget.getBoundingClientRect()
        const fraction = (event.clientX - rect.left) / rect.width
        const clamped = Math.min(1, Math.max(0, fraction))
        setHoveredIndex(Math.round(clamped * (layout.points.length - 1)))
    }

    return (
        <div className={styles.card}>
            <div className={styles.legend}>
                <span className={styles.legendItem}>
                    <span className={styles.legendSwatchInvested} />
                    Total investido
                </span>
                <span className={styles.legendItem}>
                    <span className={styles.legendSwatchTotal} />
                    Total com juros
                </span>
            </div>

            <div
                className={styles.chart}
                data-testid="growth-chart"
                onPointerMove={handlePointerMove}
                onPointerLeave={() => setHoveredIndex(null)}
            >
                <div className={styles.canvas}>
                    <svg
                        viewBox={`0 0 ${GROWTH_CHART_WIDTH} ${GROWTH_CHART_HEIGHT}`}
                        className={styles.svg}
                        preserveAspectRatio="none"
                        aria-hidden="true"
                    >
                        <defs>
                            <pattern id={patternId} width="28" height="28" patternUnits="userSpaceOnUse">
                                <path d="M28 0 L0 0 0 28" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth={1} />
                            </pattern>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <rect x={0} y={0} width={GROWTH_CHART_WIDTH} height={GROWTH_CHART_HEIGHT} fill={`url(#${patternId})`} />
                        <path d={layout.investedFillPath} fill={`url(#${gradientId})`} />
                        <path
                            d={layout.investedPath}
                            fill="none"
                            stroke="var(--color-brand-500)"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <path
                            d={layout.totalPath}
                            fill="none"
                            stroke="var(--color-gain-500)"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="10 8"
                        />
                        {hoveredPoint && (
                            <>
                                <line
                                    className={styles.guideLine}
                                    x1={hoveredPoint.x}
                                    y1={0}
                                    x2={hoveredPoint.x}
                                    y2={GROWTH_CHART_HEIGHT}
                                />
                                <circle
                                    className={styles.marker}
                                    cx={hoveredPoint.x}
                                    cy={hoveredPoint.investedY}
                                    r={6}
                                    fill="var(--color-brand-500)"
                                />
                                <circle
                                    className={styles.marker}
                                    cx={hoveredPoint.x}
                                    cy={hoveredPoint.totalY}
                                    r={6}
                                    fill="var(--color-gain-500)"
                                />
                            </>
                        )}
                    </svg>
                    <span className={styles.maxLabel}>{formatCurrency(layout.maxValue)}</span>
                    <span className={styles.minLabel}>{formatCurrency(layout.minValue)}</span>
                </div>

                {hoveredPoint && (
                    <div
                        className={styles.tooltip}
                        data-testid="growth-chart-tooltip"
                        style={{ left: `${Math.min(94, Math.max(6, (hoveredPoint.x / GROWTH_CHART_WIDTH) * 100))}%` }}
                        aria-hidden="true"
                    >
                        <span className={styles.tooltipMonth}>Mês {hoveredPoint.month}</span>
                        <span className={styles.tooltipRow}>
                            <span className={styles.tooltipDotInvested} />
                            Investido: {formatCurrency(hoveredPoint.invested)}
                        </span>
                        <span className={styles.tooltipRow}>
                            <span className={styles.tooltipDotTotal} />
                            Total: {formatCurrency(hoveredPoint.total)}
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}
