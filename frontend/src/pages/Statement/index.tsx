import { useMemo, useState } from 'react'
import { Select } from '../../components/atoms/Select'
import { StatementList, EVENT_TYPE_LABELS } from '../../components/organisms/StatementList'
import { useAssetLabels } from '../../features/market/useAssetLabels'
import { useAssetsQuery } from '../../features/market/useAssetsQuery'
import { useMyEventsQuery } from '../../features/market/useMyEventsQuery'
import styles from './index.module.css'

const PERIOD_OPTIONS = [
    { days: 0, label: 'Todo o período' },
    { days: 30, label: 'Últimos 30 dias' },
    { days: 90, label: 'Últimos 90 dias' },
    { days: 365, label: 'Último ano' },
]

const periodOptions = PERIOD_OPTIONS.map((option) => ({ value: String(option.days), label: option.label }))

const typeOptions = [{ value: 'all', label: 'Todos' }, ...Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))]

// Tela 4.8 — extrato de `market_events` (RF05). Filtro por tipo e período
// é client-side (backlog 6.5: "o backend não filtra por tipo/data na
// query, só pagina" — `.docs/backend/market.md`).
export function Statement() {
    const eventsQuery = useMyEventsQuery()
    // `market_events` só traz `asset_id` (UUID) — busca todos os ativos
    // (sem filtro de `type`) só pra resolver UUID → "TICKER · Nome" na
    // exibição, sem tocar o motor (que não devolve esse dado no extrato).
    const assetsQuery = useAssetsQuery(undefined, { includeSandbox: true })
    const [typeFilter, setTypeFilter] = useState('all')
    const [periodDays, setPeriodDays] = useState(0)
    // Lazy initializer: lido uma vez (montagem), não a cada render — evita
    // chamar `Date.now()` impuro direto no corpo de render.
    const [now] = useState(() => Date.now())

    const assetLabels = useAssetLabels(assetsQuery.data?.assets)

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
                    <Select value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
                </label>

                <label className={styles.field}>
                    Período
                    <Select value={String(periodDays)} onChange={(value) => setPeriodDays(Number(value))} options={periodOptions} />
                </label>
            </div>

            {eventsQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar o extrato agora. Tente novamente em instantes.
                </p>
            )}

            {!eventsQuery.data && !eventsQuery.isError && <p className={styles.loading}>Carregando extrato…</p>}

            {eventsQuery.data && <StatementList events={filtered} assetLabels={assetLabels} />}
        </main>
    )
}
