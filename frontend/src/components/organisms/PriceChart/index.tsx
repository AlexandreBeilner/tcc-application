import { useId, useMemo } from 'react'
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

            <div className={styles.chart}>
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
                        </svg>
                        <span className={styles.maxLabel}>{formatCurrency(layout.maxPrice)}</span>
                        <span className={styles.minLabel}>{formatCurrency(layout.minPrice)}</span>
                    </>
                ) : (
                    <p className={styles.empty}>Aguardando cotações suficientes pra desenhar o gráfico.</p>
                )}
            </div>
        </div>
    )
}
