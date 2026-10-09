import type { CSSProperties } from 'react'
import { formatDayMonth, weekdayLong, weekdayShort, WEEKDAY_ORDER } from '../../../features/market/calendarFormat'
import type { QuarterCell } from '../../../features/market/quarterCells'
import type { CalendarEvent } from '../../../services/market'
import { CalendarKindIcon } from '../../atoms/CalendarKindIcon'
import styles from './index.module.css'

interface QuarterGridProps {
    cells: QuarterCell[]
    eventsByDay: Map<number, CalendarEvent[]>
    todayDay: number
    selectedDay: number
    onSelect: (day: number) => void
}

// Visão geral dos dias numa grade (uma coluna por semana, segunda a domingo), só no
// desktop: ali o painel lateral tem espaço pra mostrar todos os dias de uma vez.
// Sólido é passado, tracejado é o que vem; o bloco dourado marca o fim do trimestre.
export function QuarterGrid({ cells, eventsByDay, todayDay, selectedDay, onSelect }: QuarterGridProps) {
    return (
        <section className={styles.grid} aria-label="Visão geral dos dias">
            <h3 className={styles.title}>Visão geral dos dias</h3>
            <p className={styles.hint}>
                Uma coluna por semana. Sólido é passado, tracejado é o que vem. A barra embaixo marca o que é para você. O bloco dourado
                marca o fim do trimestre.
            </p>
            <div className={styles.wrap}>
                <div className={styles.weekdays} aria-hidden="true">
                    {WEEKDAY_ORDER.map((weekday) => (
                        <span key={weekday}>{weekdayShort(weekday)}</span>
                    ))}
                </div>
                <div className={styles.cells}>
                    {cells.map((cell, index) => {
                        const events = eventsByDay.get(cell.simulatedDay) ?? []
                        const mineEvents = events.filter((event) => event.relevance === 'mine')
                        const marketCount = events.length - mineEvents.length
                        const isToday = cell.simulatedDay === todayDay
                        const classes = [
                            styles.cell,
                            cell.simulatedDay > todayDay ? styles.future : '',
                            marketCount > 0 && cell.simulatedDay <= todayDay ? styles.hasEvents : '',
                            mineEvents.length > 0 ? styles.hasMine : '',
                            !cell.open ? styles.weekend : '',
                            isToday ? styles.today : '',
                            cell.isReportDay ? styles.report : '',
                        ]
                            .filter(Boolean)
                            .join(' ')
                        // Só a primeira célula precisa da linha inicial: o resto flui por coluna.
                        const style: CSSProperties | undefined =
                            index === 0
                                ? { gridRowStart: WEEKDAY_ORDER.indexOf(cell.weekday as (typeof WEEKDAY_ORDER)[number]) + 1 }
                                : undefined
                        const label = [
                            `dia ${cell.simulatedDay}, ${weekdayLong(cell.weekday)} ${formatDayMonth(cell.date)}`,
                            isToday ? 'hoje' : '',
                            !cell.open ? 'mercado fechado' : '',
                            cell.isReportDay ? 'fim do trimestre' : '',
                            mineEvents.length > 0 ? `${mineEvents.length} para você` : '',
                            marketCount > 0 ? `${marketCount} no mercado` : '',
                        ]
                            .filter(Boolean)
                            .join(', ')
                        return (
                            <button
                                key={cell.simulatedDay}
                                type="button"
                                className={classes}
                                style={style}
                                aria-pressed={cell.simulatedDay === selectedDay}
                                aria-label={label}
                                onClick={() => onSelect(cell.simulatedDay)}
                            >
                                {events.length > 0 && <CalendarKindIcon kind={(mineEvents[0] ?? events[0]).kind} size={13} />}
                            </button>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
