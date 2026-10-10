import styles from './index.module.css'

export interface ActivityCalendarProps {
    // Dias do mês (1 a 31) com atividade.
    activeDays: number[]
    daysInMonth: number
}

// Calendário do mês (MO.5.4): dia cheio = manteve a sequência, dia vazado = dia off. Sem culpa:
// os dias off aparecem em tom neutro, nunca em vermelho.
export function ActivityCalendar({ activeDays, daysInMonth }: ActivityCalendarProps) {
    const active = new Set(activeDays)
    return (
        <div>
            <ol className={styles.grid} aria-label="Dias do mês">
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                    <li
                        key={day}
                        className={[styles.day, active.has(day) && styles.active].filter(Boolean).join(' ')}
                        aria-label={`Dia ${day}: ${active.has(day) ? 'manteve a sequência' : 'sem atividade'}`}
                    >
                        {day}
                    </li>
                ))}
            </ol>
            <p className={styles.legend}>
                <span className={`${styles.dot} ${styles.dotActive}`} aria-hidden="true" /> manteve a sequência
                <span className={styles.dot} aria-hidden="true" /> dia off
            </p>
        </div>
    )
}
