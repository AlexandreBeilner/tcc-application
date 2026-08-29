import { useMemo, useState } from 'react'
import { StatementList, EVENT_TYPE_LABELS } from '../../components/organisms/StatementList'
import { useMyEventsQuery } from '../../features/market/useMyEventsQuery'
import styles from './index.module.css'

const PERIOD_OPTIONS = [
    { days: 0, label: 'Todo o período' },
    { days: 30, label: 'Últimos 30 dias' },
    { days: 90, label: 'Últimos 90 dias' },
    { days: 365, label: 'Último ano' },
]

// Tela 4.8 — extrato de `market_events` (RF05). Filtro por tipo e período
// é client-side (backlog 6.5: "o backend não filtra por tipo/data na
// query, só pagina" — `.docs/backend/market.md`).
export function Statement() {
    const eventsQuery = useMyEventsQuery()
    const [typeFilter, setTypeFilter] = useState('all')
    const [periodDays, setPeriodDays] = useState(0)
    // Lazy initializer: lido uma vez (montagem), não a cada render — evita
    // chamar `Date.now()` impuro direto no corpo de render.
    const [now] = useState(() => Date.now())

    const filtered = useMemo(() => {
        const events = eventsQuery.data?.events ?? []
        const cutoff = periodDays > 0 ? now - periodDays * 24 * 60 * 60 * 1000 : null
        return events.filter((event) => {
            if (typeFilter !== 'all' && event.event_type !== typeFilter) return false
            if (cutoff !== null && new Date(event.timestamp).getTime() < cutoff) return false
            return true
        })
    }, [eventsQuery.data, typeFilter, periodDays, now])

    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Extrato</h1>

            <div className={styles.filters}>
                <label className={styles.field}>
                    Tipo
                    <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                        <option value="all">Todos</option>
                        {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>

                <label className={styles.field}>
                    Período
                    <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))}>
                        {PERIOD_OPTIONS.map((option) => (
                            <option key={option.days} value={option.days}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {eventsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o extrato agora. Tente novamente em instantes.
                </p>
            )}

            {!eventsQuery.data && !eventsQuery.isError && <p className={styles.loading}>Carregando extrato…</p>}

            {eventsQuery.data && <StatementList events={filtered} />}
        </main>
    )
}
