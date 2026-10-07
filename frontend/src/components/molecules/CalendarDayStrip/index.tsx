import { useLayoutEffect, useRef } from 'react'
import { formatDayMonth, formatDayOfMonth, weekdayLong, weekdayShort } from '../../../features/market/calendarFormat'
import type { CalendarDay } from '../../../services/market'
import { CalendarKindIcon } from '../../atoms/CalendarKindIcon'
import styles from './index.module.css'

interface CalendarDayStripProps {
    days: CalendarDay[]
    todayDay: number
    // Último dia do trimestre: bloco dourado.
    reportDay: number
    selectedDay: number
    onSelect: (day: number) => void
}

// Um marcador do usuário (número em pílula cheia) e um do mercado (ícone vazado):
// formas diferentes, para a relevância nunca depender só da cor.

function dayLabel(day: CalendarDay, todayDay: number, reportDay: number): string {
    const parts = [`${weekdayLong(day.weekday)} ${formatDayMonth(day.date)}`]
    if (day.simulated_day === todayDay) parts.push('hoje')
    if (!day.market_open) parts.push('mercado fechado')
    if (day.simulated_day === reportDay) parts.push('fim do trimestre')
    const { mine_count: mine, market_count: market } = day.summary
    if (mine > 0) parts.push(`${mine} para você`)
    if (market > 0) parts.push(`${market} no mercado`)
    return parts.join(', ')
}

// Faixa horizontal de dias (S.12): passado sólido, futuro tracejado, fim de
// semana cinza com o texto "fechado", hoje com borda de destaque. Cada dia é um
// botão de 58px (alvo >= 44px). A faixa nunca rola na vertical: `overflow-y:
// hidden` no CSS, porque `overflow-x: auto` sozinho promove o outro eixo a auto
// e a borda de hoje ou o foco geram uma barra vertical (armadilha 0 da S.12).
export function CalendarDayStrip({ days, todayDay, reportDay, selectedDay, onSelect }: CalendarDayStripProps) {
    const stripRef = useRef<HTMLDivElement>(null)
    const hasDays = days.length > 0

    // Centraliza hoje na abertura, só no eixo horizontal (scrollIntoView mexeria
    // no vertical da folha inteira).
    useLayoutEffect(() => {
        const strip = stripRef.current
        const today = strip?.querySelector<HTMLElement>('[data-today="true"]')
        if (!strip || !today) return
        strip.scrollLeft = today.offsetLeft - (strip.clientWidth - today.offsetWidth) / 2
    }, [hasDays])

    return (
        <div ref={stripRef} className={styles.strip} role="group" aria-label="Dias do calendário">
            {days.map((day) => {
                const isToday = day.simulated_day === todayDay
                const classes = [
                    styles.day,
                    day.simulated_day > todayDay ? styles.future : '',
                    !day.market_open ? styles.weekend : '',
                    day.simulated_day === reportDay ? styles.report : '',
                    isToday ? styles.today : '',
                ]
                    .filter(Boolean)
                    .join(' ')
                const marketEvent = day.events.find((event) => event.relevance !== 'mine')
                const mineEvent = day.events.find((event) => event.relevance === 'mine')
                return (
                    <button
                        key={day.simulated_day}
                        type="button"
                        className={classes}
                        data-today={isToday}
                        aria-pressed={day.simulated_day === selectedDay}
                        aria-label={dayLabel(day, todayDay, reportDay)}
                        onClick={() => onSelect(day.simulated_day)}
                    >
                        <span className={styles.weekday}>{weekdayShort(day.weekday)}</span>
                        <span className={styles.dayNumber}>{formatDayOfMonth(day.date)}</span>
                        <span className={styles.marks}>
                            {day.summary.mine_count > 0 && (
                                <span className={styles.mineMark} data-testid="mine-mark">
                                    {mineEvent && <CalendarKindIcon kind={mineEvent.kind} size={11} />}
                                    {day.summary.mine_count}
                                </span>
                            )}
                            {day.summary.market_count > 0 && (
                                <span className={styles.marketMark} data-testid="market-mark">
                                    {marketEvent ? <CalendarKindIcon kind={marketEvent.kind} size={12} /> : '·'}
                                </span>
                            )}
                        </span>
                        <span className={styles.status}>
                            {isToday ? 'hoje' : day.simulated_day === reportDay ? 'fim do trim.' : !day.market_open ? 'fechado' : ''}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
