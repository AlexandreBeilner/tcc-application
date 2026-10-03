import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Select } from '../../components/atoms/Select'
import { CalendarEventItem } from '../../components/molecules/CalendarEventItem'
import { IndicatorLineChart } from '../../components/organisms/IndicatorLineChart'
import { IndicatorSummaryCards } from '../../components/organisms/IndicatorSummaryCards'
import { MarketMonitorTable } from '../../components/organisms/MarketMonitorTable'
import {
    filterMonitorAssets,
    monitorSectors,
    sortMonitorAssets,
    TYPE_LABELS,
    type MonitorFilters,
    type MonitorSortDirection,
    type MonitorSortKey,
} from '../../features/admin/marketMonitor'
import { useMarketMonitorQuery } from '../../features/admin/useMarketMonitorQuery'
import { formatDayMonth, shiftIsoDate } from '../../features/market/calendarFormat'
import { formatRatePercent } from '../../features/market/format'
import { nextCopomSimulatedDay } from '../../features/market/nextCopomDay'
import { useIndicatorHistoryQuery } from '../../features/market/useIndicatorHistoryQuery'
import { useMarketCalendarQuery } from '../../features/market/useMarketCalendarQuery'
import { useMarketClockQuery } from '../../features/market/useMarketClockQuery'
import type { CalendarEvent } from '../../services/market'
import styles from './index.module.css'

const RANGES = [
    { days: 90, label: '3M' },
    { days: 180, label: '6M' },
    { days: 365, label: '1A' },
]

const CALENDAR_DAYS_AHEAD = 30
const UPCOMING_LIMIT = 8

// Primeira ordenação: ticker. Clicar de novo na mesma coluna inverte; numa coluna nova,
// começa do mais relevante (maior valor primeiro), exceto o ticker, que começa de A a Z.
function nextSort(current: { key: MonitorSortKey; direction: MonitorSortDirection }, key: MonitorSortKey) {
    if (current.key === key) return { key, direction: current.direction === 'asc' ? ('desc' as const) : ('asc' as const) }
    return { key, direction: key === 'ticker' ? ('asc' as const) : ('desc' as const) }
}

// Tela 10.6 (N.8) — seção "Mercado" do painel: monitor ao vivo de todos os ativos
// negociáveis, indicadores macro e próximos eventos. Só leitura: nada aqui muda o mercado
// (preço só se forma por negociação). O histórico e o disparo de eventos macro seguem em 10.3.
export function AdminMercado() {
    const [filters, setFilters] = useState<MonitorFilters>({ type: 'all', sector: 'all', query: '' })
    const [sort, setSort] = useState<{ key: MonitorSortKey; direction: MonitorSortDirection }>({ key: 'ticker', direction: 'asc' })
    const [rangeDays, setRangeDays] = useState(RANGES[0].days)

    const monitorQuery = useMarketMonitorQuery()
    const indicatorsQuery = useIndicatorHistoryQuery(rangeDays)
    const clockQuery = useMarketClockQuery()
    const clock = clockQuery.data
    const calendarQuery = useMarketCalendarQuery(
        clock?.date ?? null,
        clock ? shiftIsoDate(clock.date, CALENDAR_DAYS_AHEAD) : null,
        clock !== undefined,
    )

    const assets = monitorQuery.data
    const visible = useMemo(
        () => (assets ? sortMonitorAssets(filterMonitorAssets(assets, filters), sort.key, sort.direction) : []),
        [assets, filters, sort],
    )
    const sectors = useMemo(() => (assets ? monitorSectors(assets) : []), [assets])

    const upcoming = useMemo(() => {
        const items: { event: CalendarEvent; when: string }[] = []
        for (const day of calendarQuery.data?.days ?? []) {
            for (const event of day.events) {
                if (event.scope === 'global' && event.future) items.push({ event, when: formatDayMonth(day.date) })
            }
        }
        return items.slice(0, UPCOMING_LIMIT)
    }, [calendarQuery.data])

    const indicators = indicatorsQuery.data?.indicators ?? []
    const latest = indicators[indicators.length - 1]
    const selicEntries = indicators.map((entry) => ({ simulatedDay: entry.simulated_day, value: entry.selic_rate }))
    const uncovered = assets?.filter((a) => !a.covered).length ?? 0

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Mercado</h1>
                    <p className={styles.subtitle}>
                        Monitor ao vivo. O preço só muda por negociação; para criar condições, dispare um evento macro ou cancele ordens na
                        tela de Ordens.
                    </p>
                </div>
                <div className={styles.links}>
                    <Link to="/admin/mercado/ordens" className={styles.link}>
                        Ordens
                    </Link>
                    <Link to="/admin/eventos" className={styles.link}>
                        Eventos macro
                    </Link>
                </div>
            </header>

            <section className={styles.section} aria-label="Ativos">
                <div className={styles.filters}>
                    <label className={styles.filterField}>
                        <span>Classe</span>
                        <Select
                            value={filters.type}
                            onChange={(value) => setFilters({ ...filters, type: value as MonitorFilters['type'] })}
                            options={[
                                { value: 'all', label: 'Todas' },
                                ...(Object.keys(TYPE_LABELS) as Array<keyof typeof TYPE_LABELS>).map((type) => ({
                                    value: type,
                                    label: TYPE_LABELS[type],
                                })),
                            ]}
                            aria-label="Filtrar por classe"
                        />
                    </label>
                    <label className={styles.filterField}>
                        <span>Setor</span>
                        <Select
                            value={filters.sector}
                            onChange={(value) => setFilters({ ...filters, sector: value })}
                            options={[{ value: 'all', label: 'Todos' }, ...sectors.map((sector) => ({ value: sector, label: sector }))]}
                            aria-label="Filtrar por setor"
                        />
                    </label>
                    <label className={styles.filterField}>
                        <span>Buscar</span>
                        <input
                            className={styles.search}
                            type="search"
                            value={filters.query}
                            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
                            placeholder="Ticker ou nome"
                        />
                    </label>
                </div>

                {uncovered > 0 && (
                    <p className={styles.warning} role="status">
                        {uncovered} {uncovered === 1 ? 'ativo está' : 'ativos estão'} sem Market Maker ativo cobrindo.
                    </p>
                )}

                {monitorQuery.isError ? (
                    <p className={styles.error} role="alert">
                        Não foi possível carregar o mercado agora. O motor pode estar fora do ar.
                    </p>
                ) : !assets ? (
                    <p className={styles.loading}>Carregando o mercado…</p>
                ) : (
                    <MarketMonitorTable
                        assets={visible}
                        sortKey={sort.key}
                        sortDirection={sort.direction}
                        onSort={(key) => setSort((current) => nextSort(current, key))}
                        emptyMessage="Nenhum ativo para esses filtros."
                    />
                )}
            </section>

            <section className={styles.macro} aria-label="Indicadores macro">
                <div className={styles.macroMain}>
                    <h2 className={styles.sectionTitle}>Indicadores macro</h2>
                    {indicatorsQuery.isError ? (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar os indicadores.
                        </p>
                    ) : (
                        <>
                            <IndicatorSummaryCards
                                latest={latest}
                                nextCopomSimulatedDay={nextCopomSimulatedDay(latest?.simulated_day ?? 0)}
                            />
                            <IndicatorLineChart
                                title="Selic (meta anual)"
                                entries={selicEntries}
                                ranges={RANGES}
                                activeDays={rangeDays}
                                onRangeChange={setRangeDays}
                                formatValue={formatRatePercent}
                            />
                        </>
                    )}
                </div>

                <aside className={styles.calendar} aria-label="Próximos eventos">
                    <h2 className={styles.sectionTitle}>Próximos eventos</h2>
                    {calendarQuery.isError ? (
                        <p className={styles.error} role="alert">
                            Não foi possível carregar o calendário.
                        </p>
                    ) : upcoming.length === 0 ? (
                        <p className={styles.loading}>Nenhum evento previsto nos próximos {CALENDAR_DAYS_AHEAD} dias.</p>
                    ) : (
                        <ul className={styles.events}>
                            {upcoming.map(({ event, when }, index) => (
                                <CalendarEventItem key={`${event.kind}-${when}-${index}`} event={event} whenLabel={when} />
                            ))}
                        </ul>
                    )}
                </aside>
            </section>
        </main>
    )
}
