import { useEffect, useRef } from 'react'
import { Lock } from 'lucide-react'
import { describeReopening, formatDuration } from '../../../features/market/marketClosedReason'
import { formatDayMonth, weekdayShort } from '../../../features/market/calendarFormat'
import { useClockProgress } from '../../../features/market/useClockProgress'
import { useDayFlipReveal } from '../../../features/market/useDayFlipReveal'
import { useMarketClockQuery } from '../../../features/market/useMarketClockQuery'
import styles from './index.module.css'

interface MarketClockChipProps {
    open: boolean
    onToggle: () => void
    panelId: string
}

const DIAL_RADIUS = 11
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS

function Dial({ closed, progress, flipping }: { closed: boolean; progress: number | null; flipping: boolean }) {
    const fraction = progress ?? 0
    return (
        <svg
            className={flipping ? `${styles.dial} ${styles.dialFlip}` : styles.dial}
            width="32"
            height="32"
            viewBox="0 0 32 32"
            aria-hidden="true"
        >
            <circle
                cx="16"
                cy="16"
                r={DIAL_RADIUS}
                fill="none"
                stroke="var(--color-border-strong)"
                strokeWidth="3"
                strokeDasharray={closed ? '3 3' : undefined}
            />
            <circle
                cx="16"
                cy="16"
                r={DIAL_RADIUS}
                fill="none"
                stroke={closed ? 'var(--color-text-secondary)' : 'var(--color-brand-500)'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${DIAL_CIRCUMFERENCE * fraction} ${DIAL_CIRCUMFERENCE}`}
                transform="rotate(-90 16 16)"
            />
            <line
                x1="16"
                y1="16"
                x2="16"
                y2="9"
                stroke="var(--color-text-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                transform={`rotate(${fraction * 360} 16 16)`}
            />
        </svg>
    )
}

// Chip fixo do TopBar com o relógio do mercado simulado (tarefa S.12): dia,
// data, quanto falta pro próximo dia e, no fim de semana, o selo "Mercado
// fechado" (tracejado + cadeado + texto, nunca só cor). É o único ponto de
// abertura do Calendário (decisão do autor). Em mobile vira duas linhas curtas (dia / data).
// Sem relógio (carregando/falha) não renderiza: o motor pode estar fora do ar.
export function MarketClockChip({ open, onToggle, panelId }: MarketClockChipProps) {
    const clockQuery = useMarketClockQuery()
    const clock = clockQuery.data
    const { progress, now } = useClockProgress(clock)
    const flipping = useDayFlipReveal(clock)

    const buttonRef = useRef<HTMLButtonElement>(null)
    const wasOpen = useRef(open)
    useEffect(() => {
        // Devolve o foco ao chip quando o painel fecha (Esc, botão ou fundo).
        if (wasOpen.current && !open) buttonRef.current?.focus()
        wasOpen.current = open
    }, [open])

    if (!clock) return null

    const closed = !clock.market_open
    const dayDate = `${weekdayShort(clock.weekday)} ${formatDayMonth(clock.date)}`
    // Texto completo (tablet e desktop) e curto (mobile, 375px): a barra já leva
    // logo, dois sinos e avatar, então em mobile são duas linhas curtas.
    const fullLine1 = closed ? 'Mercado fechado' : `Dia ${clock.simulated_day} · ${dayDate}`
    const shortLine1 = closed ? 'Fechado' : `Dia ${clock.simulated_day}`
    const nextTickAt = clock.next_tick_at ? new Date(clock.next_tick_at) : null
    const fullLine2 = closed
        ? describeReopening(clock, now)
        : nextTickAt
          ? `próximo dia em ${formatDuration(Math.max(0, nextTickAt.getTime() - now.getTime()))}`
          : null

    const className = [styles.chip, closed ? styles.closed : '', open ? styles.open : ''].filter(Boolean).join(' ')
    const closedDay = closed ? `Dia ${clock.simulated_day}, ${dayDate}. ` : ''

    return (
        <button
            ref={buttonRef}
            type="button"
            className={className}
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={panelId}
            aria-haspopup="dialog"
            aria-label={`${open ? 'Fechar' : 'Abrir'} calendário do mercado. ${closedDay}${fullLine1}${fullLine2 ? `. ${fullLine2}` : ''}`}
        >
            <Dial closed={closed} progress={progress} flipping={flipping} />
            <span className={styles.text}>
                <span className={styles.line1}>
                    {closed && <Lock size={12} strokeWidth={2.4} aria-hidden="true" />}
                    <span className={styles.full}>{fullLine1}</span>
                    <span className={styles.short}>{shortLine1}</span>
                </span>
                <span className={styles.line2}>
                    <span className={styles.short}>{dayDate}</span>
                    {fullLine2 && <span className={styles.full}>{fullLine2}</span>}
                </span>
            </span>
        </button>
    )
}
