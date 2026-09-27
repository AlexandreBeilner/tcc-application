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

const MAX_MARKS = 2

function dayLabel(day: CalendarDay, todayDay: number, reportDay: number): string {
    const parts = [`${weekdayLong(day.weekday)} ${formatDayMonth(day.date)}`]
    if (day.simulated_day === todayDay) parts.push('hoje')
    if (!day.market_open) parts.push('mercado fechado')
    if (day.simulated_day === reportDay) parts.push('fim do trimestre')
    if (day.events.length > 0) parts.push(`${day.events.length} ${day.events.length === 1 ? 'fato' : 'fatos'}`)
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
                const marks = day.events.slice(0, MAX_MARKS)
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
                            {marks.map((event, index) => (
                                <CalendarKindIcon key={`${event.kind}-${index}`} kind={event.kind} size={13} />
                            ))}
                            {day.events.length > MAX_MARKS && <span className={styles.more}>+{day.events.length - MAX_MARKS}</span>}
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
