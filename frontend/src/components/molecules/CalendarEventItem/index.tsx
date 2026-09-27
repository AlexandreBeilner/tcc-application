import { describeCalendarEvent } from '../../../features/market/calendarEvents'
import type { CalendarEvent } from '../../../services/market'
import { CalendarKindIcon } from '../../atoms/CalendarKindIcon'
import styles from './index.module.css'

interface CalendarEventItemProps {
    event: CalendarEvent
    // Quando dado, aparece no lugar do rótulo do tipo (ex: "sex 10/07 · em 2 dias").
    whenLabel?: string
}

// Um fato do calendário: ícone, título, tipo em texto e, se for do usuário, a
// etiqueta VOCÊ. Fato futuro é tracejado e leva "previsto" (cor nunca sozinha).
export function CalendarEventItem({ event, whenLabel }: CalendarEventItemProps) {
    const view = describeCalendarEvent(event)
    const detail = whenLabel ?? `${view.label} · ${view.subtitle}`

    return (
        <li
            className={[styles.item, event.future ? styles.future : '', event.kind === 'report' ? styles.report : '']
                .filter(Boolean)
                .join(' ')}
        >
            <span className={styles.icon}>
                <CalendarKindIcon kind={event.kind} />
            </span>
            <div className={styles.text}>
                <div className={styles.title}>
                    {view.title}
                    {view.mine && <span className={styles.tag}>VOCÊ</span>}
                </div>
                <div className={styles.subtitle}>
                    {detail}
                    {event.future && ' · previsto'}
                </div>
            </div>
        </li>
    )
}
