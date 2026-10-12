import { formatCurrency } from '../../../features/portfolio/format'
import { formatDecimal, formatSignedPercent } from '../../../features/market/format'
import type { DeltaProps } from './types'
import styles from './index.module.css'

export type { DeltaProps } from './types'

type Direction = 'up' | 'down' | 'flat'

// Zero depois do arredondamento de 1 casa é "sem variação": "+0,0%" verde seria mentira.
function directionOf(value: number): Direction {
    const rounded = Math.round(value * 10) / 10
    if (rounded > 0) return 'up'
    if (rounded < 0) return 'down'
    return 'flat'
}

function formatSignedCurrency(value: number): string {
    const sign = value > 0 ? '+' : value < 0 ? '−' : ''
    return `${sign}${formatCurrency(Math.abs(value))}`
}

const ARROW: Record<Direction, string> = { up: '▲', down: '▼', flat: '' }
const SPOKEN: Record<NonNullable<DeltaProps['kind']>, Record<Direction, string>> = {
    change: { up: 'alta de', down: 'queda de', flat: 'sem variação,' },
    flow: { up: 'entrada de', down: 'saída de', flat: 'sem movimento,' },
}

// Variação ou retorno (MO.9.4): verde com ▲ e + para alta, vermelho com ▼ e − para queda, neutro
// para zero, `—` para indefinido. O sinal e a seta existem para a leitura não depender só da cor
// (daltonismo). O `aria-label` fala "alta de 2,0%" em vez de ler símbolos soltos.
export function Delta({ percent, amount, variant = 'chip', kind = 'change', className }: DeltaProps) {
    const reference = percent ?? amount
    if (reference === null || reference === undefined || !Number.isFinite(reference)) {
        return <span className={`${styles.delta} ${styles.undefined} tabular-nums ${className ?? ''}`}>—</span>
    }

    const direction = directionOf(reference)
    const parts: string[] = []
    const spokenParts: string[] = []
    if (percent !== null && percent !== undefined) {
        parts.push(formatSignedPercent(Math.round(percent * 10) / 10 === 0 ? 0 : percent))
        spokenParts.push(`${formatDecimal(Math.abs(percent))} por cento`)
    }
    if (amount !== null && amount !== undefined) {
        parts.push(formatSignedCurrency(amount))
        spokenParts.push(formatCurrency(Math.abs(amount)))
    }

    const classes = [styles.delta, styles[direction], variant === 'chip' ? styles.chip : '', 'tabular-nums', className ?? '']
        .filter(Boolean)
        .join(' ')

    return (
        <span className={classes} aria-label={`${SPOKEN[kind][direction]} ${spokenParts.join(', ')}`.trim()}>
            {ARROW[direction] && (
                <span className={styles.arrow} aria-hidden="true">
                    {ARROW[direction]}
                </span>
            )}
            <span aria-hidden="true">{parts.join(' · ')}</span>
        </span>
    )
}
