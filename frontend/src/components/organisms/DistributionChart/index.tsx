import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import type { AssetCategory } from '../../../features/portfolio/distribution'
import { formatCurrency, formatPercentage } from '../../../features/portfolio/format'
import type { DistributionChartProps } from './types'
import styles from './index.module.css'

export type { DistributionChartProps } from './types'

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

const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// Respiro entre segmentos (mark spec da skill `dataviz`), em unidades do viewBox.
const SEGMENT_GAP = 1.2

interface Arc {
    category: AssetCategory
    dash: number
    offset: number
}

// Cada arco é um círculo com `stroke-dasharray`: comprimento visível + resto
// da circunferência, deslocado pelo acumulado das fatias anteriores. Sem lib
// de gráfico (decisão da Semana 6).
function buildArcs(slices: DistributionChartProps['slices']): Arc[] {
    const gap = slices.length > 1 ? SEGMENT_GAP : 0
    const arcs: Arc[] = []
    slices.reduce((cumulative, slice) => {
        const length = slice.percentage * CIRCUMFERENCE
        arcs.push({ category: slice.category, dash: Math.max(length - gap, 0.01), offset: -cumulative })
        return cumulative + length
    }, 0)
    return arcs
}

// Donut interativo: hover (desktop) e clique/toque/Enter (fixa a fatia) mostram
// R$ e % no furo. Nenhuma informação vive só no hover: a legenda sempre traz
// R$ e %, e o furo mostra o total quando nada está selecionado. Esc limpa a
// seleção; setas movem o foco entre as categorias da legenda.
export function DistributionChart({ slices, onSelect }: DistributionChartProps) {
    const [pinned, setPinned] = useState<AssetCategory | null>(null)
    const [hovered, setHovered] = useState<AssetCategory | null>(null)
    const legendRef = useRef<HTMLUListElement>(null)

    const arcs = buildArcs(slices)
    const total = slices.reduce((sum, slice) => sum + slice.value, 0)
    const activeCategory = hovered ?? pinned
    const active = slices.find((slice) => slice.category === activeCategory) ?? null

    function activate(category: AssetCategory) {
        if (onSelect) {
            onSelect(category)
            return
        }
        setPinned((current) => (current === category ? null : category))
    }

    function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
        if (event.key === 'Escape') {
            setPinned(null)
            setHovered(null)
            return
        }
        const step =
            event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
        if (step === 0) return
        event.preventDefault()
        const buttons = Array.from(legendRef.current?.querySelectorAll('button') ?? [])
        const index = buttons.findIndex((button) => button === document.activeElement)
        buttons[(index + step + buttons.length) % buttons.length]?.focus()
    }

    return (
        <div className={styles.root}>
            <div className={styles.wrapper} onKeyDown={handleKeyDown}>
                <div className={styles.ringBox}>
                    <svg
                        className={styles.ring}
                        viewBox="0 0 100 100"
                        role="img"
                        aria-label="Distribuição dos investimentos por categoria de ativo"
                    >
                        {arcs.map((arc) => (
                            <circle
                                key={arc.category}
                                className={`${styles.arc} ${activeCategory && activeCategory !== arc.category ? styles.arcDimmed : ''}`}
                                cx="50"
                                cy="50"
                                r={RADIUS}
                                stroke={SLICE_COLOR_VAR[arc.category]}
                                strokeDasharray={`${arc.dash} ${CIRCUMFERENCE - arc.dash}`}
                                strokeDashoffset={arc.offset}
                                transform="rotate(-90 50 50)"
                                onMouseEnter={() => setHovered(arc.category)}
                                onMouseLeave={() => setHovered(null)}
                                onClick={() => activate(arc.category)}
                            />
                        ))}
                    </svg>
                    <div className={styles.hole} aria-live="polite">
                        <span className={styles.holeLabel}>{active ? active.label : 'Total investido'}</span>
                        <span className={`${styles.holeValue} tabular-nums`}>{formatCurrency(active ? active.value : total)}</span>
                        {active && <span className={`${styles.holePercent} tabular-nums`}>{formatPercentage(active.percentage)}</span>}
                    </div>
                </div>
                <ul className={styles.legend} ref={legendRef}>
                    {slices.map((slice) => (
                        <li key={slice.category}>
                            <button
                                type="button"
                                className={`${styles.legendItem} ${activeCategory === slice.category ? styles.legendItemActive : ''}`}
                                aria-pressed={onSelect ? undefined : pinned === slice.category}
                                aria-label={`${slice.label}: ${formatCurrency(slice.value)}, ${formatPercentage(slice.percentage)} da carteira`}
                                onMouseEnter={() => setHovered(slice.category)}
                                onMouseLeave={() => setHovered(null)}
                                onClick={() => activate(slice.category)}
                                onFocus={() => setHovered(slice.category)}
                                onBlur={() => setHovered(null)}
                            >
                                <span
                                    className={styles.swatch}
                                    style={{ background: SLICE_COLOR_VAR[slice.category] }}
                                    aria-hidden="true"
                                />
                                <span className={styles.legendLabel}>{slice.label}</span>
                                <span className={`${styles.legendValue} tabular-nums`}>{formatCurrency(slice.value)}</span>
                                <span className={`${styles.legendPercent} tabular-nums`}>{formatPercentage(slice.percentage)}</span>
                                {onSelect && <ChevronRight size={16} strokeWidth={2} aria-hidden="true" className={styles.chevron} />}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    )
}
