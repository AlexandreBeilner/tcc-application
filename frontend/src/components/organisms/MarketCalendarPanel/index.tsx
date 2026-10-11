import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, FastForward, FileText, Info, Lock, X } from 'lucide-react'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { formatDayMonth, formatWeekdayDate, shiftIsoDate, weekdayLong, weekdayShort } from '../../../features/market/calendarFormat'
import { calendarRelevance } from '../../../features/market/calendarRelevance'
import { formatCurrency } from '../../../features/portfolio/format'
import { quarterCells } from '../../../features/market/quarterCells'
import { useCalendarScope } from '../../../features/market/useCalendarScope'
import { useMarketCalendarQuery } from '../../../features/market/useMarketCalendarQuery'
import { useMarketClockQuery } from '../../../features/market/useMarketClockQuery'
import type { CalendarDay, CalendarEvent, CalendarEventKind, CalendarScope, MarketCalendar, MarketClock } from '../../../services/market'
import { CalendarKindIcon } from '../../atoms/CalendarKindIcon'
import { CalendarDayStrip } from '../../molecules/CalendarDayStrip'
import { CalendarEventItem } from '../../molecules/CalendarEventItem'
import { CalendarScopeToggle } from '../../molecules/CalendarScopeToggle'
import { QuarterGrid } from '../../molecules/QuarterGrid'
import styles from './index.module.css'

export const MARKET_CALENDAR_PANEL_ID = 'market-calendar-panel'

interface MarketCalendarPanelProps {
    onClose: () => void
}

const LEGEND_ID = 'market-calendar-legend'

const DAYS_BEFORE = 7
const DAYS_AFTER = 14
const STRIP_DAYS_AFTER = 6
const UPCOMING_LIMIT = 4

const LEGEND: { kind: CalendarEventKind; label: string }[] = [
    { kind: 'macro_event', label: 'Evento' },
    { kind: 'copom', label: 'Copom' },
    { kind: 'report', label: 'Balanço' },
    { kind: 'dividend_payment_date', label: 'Provento' },
    { kind: 'order_executed', label: 'Suas ordens' },
    { kind: 'fixed_income_purchase', label: 'Renda fixa' },
    { kind: 'salary_payment', label: 'Salário' },
    { kind: 'assembly_open', label: 'Assembleia' },
]

function daysLabel(days: number): string {
    return `em ${days} ${days === 1 ? 'dia' : 'dias'}`
}

interface Entry {
    event: CalendarEvent
    // Dia do fato, quando ele vem de fora do dia selecionado ("Vem aí" de hoje).
    day: CalendarDay | null
}

function isMine(event: CalendarEvent): boolean {
    return event.relevance === 'mine'
}

function upcomingFrom(days: CalendarDay[], todayDay: number, mine: boolean): Entry[] {
    return days
        .filter((day) => day.simulated_day >= todayDay)
        .flatMap((day) => day.events.filter((event) => event.future && isMine(event) === mine).map((event) => ({ event, day })))
        .slice(0, UPCOMING_LIMIT)
}

// Painel do Calendário (tela 4.11, S.12), aberto só pelo chip do relógio. A
// composição é de CSS, uma só árvore: bottom sheet com fundo em mobile, painel
// abaixo da barra em tablet, coluna lateral fixa com a visão geral dos dias em
// desktop. Não fala de dinheiro (sem patrimônio, sem ganho/perda), só de datas.
export function MarketCalendarPanel({ onClose }: MarketCalendarPanelProps) {
    const clockQuery = useMarketClockQuery()
    const clock = clockQuery.data
    const isDesktop = useMediaQuery('(min-width: 1024px)')
    const [selectedDay, setSelectedDay] = useState<number | null>(null)
    const [scope, setScope] = useCalendarScope()
    const [legendOpen, setLegendOpen] = useState(false)
    const closeRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        closeRef.current?.focus()
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [onClose])

    const cells = useMemo(() => (clock ? quarterCells(clock) : []), [clock])
    const range = clock ? { from: shiftIsoDate(clock.date, -DAYS_BEFORE), to: shiftIsoDate(clock.date, DAYS_AFTER) } : null
    const calendarQuery = useMarketCalendarQuery(range?.from ?? null, range?.to ?? null, clock !== undefined, scope)
    const quarterQuery = useMarketCalendarQuery(
        cells[0]?.date ?? null,
        cells[cells.length - 1]?.date ?? null,
        isDesktop && cells.length > 0,
        scope,
    )

    const windowDays = useMemo(() => calendarQuery.data?.days ?? [], [calendarQuery.data])
    const eventsByDay = useMemo(() => {
        const map = new Map<number, CalendarEvent[]>()
        for (const day of quarterQuery.data?.days ?? []) map.set(day.simulated_day, day.events)
        for (const day of windowDays) map.set(day.simulated_day, day.events)
        return map
    }, [quarterQuery.data, windowDays])

    return (
        <>
            <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
            <section id={MARKET_CALENDAR_PANEL_ID} className={styles.panel} role="dialog" aria-label="Calendário do mercado">
                <div className={styles.grabber} aria-hidden="true" />
                <div className={styles.head}>
                    <div>
                        <h2 className={styles.title}>Calendário do mercado</h2>
                        {clock && (
                            <p className={styles.subtitle}>
                                Dia {clock.simulated_day} · {formatWeekdayDate(clock.weekday, clock.date)}/{clock.date.slice(0, 4)}
                            </p>
                        )}
                    </div>
                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => setLegendOpen((open) => !open)}
                            aria-expanded={legendOpen}
                            aria-controls={LEGEND_ID}
                            aria-label="Legenda do calendário"
                        >
                            <Info size={18} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button ref={closeRef} type="button" className={styles.iconButton} onClick={onClose} aria-label="Fechar calendário">
                            <X size={18} strokeWidth={2} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {legendOpen && <Legend />}

                <CalendarScopeToggle scope={scope} onChange={setScope} />

                {clock ? (
                    <PanelBody
                        clock={clock}
                        windowDays={windowDays}
                        loading={calendarQuery.isPending}
                        failed={calendarQuery.isError}
                        eventsByDay={eventsByDay}
                        cells={cells}
                        showGrid={isDesktop}
                        selectedDay={selectedDay ?? clock.simulated_day}
                        onSelect={setSelectedDay}
                        scope={scope}
                        onScopeChange={setScope}
                        calendar={calendarQuery.data}
                    />
                ) : (
                    <p className={styles.empty} role="status">
                        {clockQuery.isError ? 'Não foi possível carregar o relógio do mercado.' : 'Carregando o relógio do mercado...'}
                    </p>
                )}

                <Footer daysPerRealDay={clock?.days_per_real_day} />
            </section>
        </>
    )
}

interface PanelBodyProps {
    clock: MarketClock
    windowDays: CalendarDay[]
    loading: boolean
    failed: boolean
    eventsByDay: Map<number, CalendarEvent[]>
    cells: ReturnType<typeof quarterCells>
    showGrid: boolean
    selectedDay: number
    onSelect: (day: number) => void
    scope: CalendarScope
    onScopeChange: (scope: CalendarScope) => void
    calendar: MarketCalendar | undefined
}

function PanelBody({
    clock,
    windowDays,
    loading,
    failed,
    eventsByDay,
    cells,
    showGrid,
    selectedDay,
    onSelect,
    scope,
    onScopeChange,
    calendar,
}: PanelBodyProps) {
    const today = clock.simulated_day
    // Último dia do trimestre (dia de relatório): vira um bloco dourado, sem barra de progresso.
    const reportDay = today + (clock.quarter_length - clock.quarter_day)
    const stripDays = windowDays.filter((day) => day.simulated_day <= today + STRIP_DAYS_AFTER)
    const selectedCell = cells.find((cell) => cell.simulatedDay === selectedDay)
    const selectedWindowDay = windowDays.find((day) => day.simulated_day === selectedDay)
    const selectedEvents = eventsByDay.get(selectedDay) ?? []
    const selectedIsToday = selectedDay === today
    const selectedIsFuture = selectedDay > today

    const weekday = selectedWindowDay?.weekday ?? selectedCell?.weekday ?? clock.weekday
    const date = selectedWindowDay?.date ?? selectedCell?.date ?? clock.date
    const open = selectedWindowDay?.market_open ?? selectedCell?.open ?? clock.market_open

    const dayEntries = (mine: boolean): { happened: Entry[]; coming: Entry[] } => {
        const own = selectedEvents.filter((event) => isMine(event) === mine)
        return {
            happened: own.filter((event) => !event.future).map((event) => ({ event, day: null })),
            coming: selectedIsToday
                ? upcomingFrom(windowDays, today, mine)
                : own.filter((event) => event.future).map((event) => ({ event, day: null })),
        }
    }
    const mineGroup = dayEntries(true)
    const marketGroup = dayEntries(false)
    const { summary } = calendarRelevance(windowDays)
    const hiddenMarket = summary.marketCount

    return (
        <>
            {showGrid && (
                <QuarterGrid cells={cells} eventsByDay={eventsByDay} todayDay={today} selectedDay={selectedDay} onSelect={onSelect} />
            )}

            {failed ? (
                <p className={styles.empty} role="alert">
                    Não foi possível carregar os fatos do calendário. Tente abrir de novo em instantes.
                </p>
            ) : (
                <>
                    {loading ? (
                        <p className={styles.empty} role="status">
                            Carregando os dias...
                        </p>
                    ) : (
                        <CalendarDayStrip
                            days={stripDays}
                            todayDay={today}
                            reportDay={reportDay}
                            selectedDay={selectedDay}
                            onSelect={onSelect}
                        />
                    )}

                    <div className={styles.dayHead}>
                        <h3 className={styles.dayTitle}>
                            {selectedIsToday ? 'Hoje, ' : ''}
                            {weekdayLong(weekday)} {formatDayMonth(date)} · dia {selectedDay}
                        </h3>
                        {open ? (
                            <span className={`${styles.pill} ${styles.pillOpen}`}>
                                <Clock size={12} strokeWidth={2} aria-hidden="true" />
                                Mercado aberto
                            </span>
                        ) : (
                            <span className={`${styles.pill} ${styles.pillClosed}`}>
                                <Lock size={12} strokeWidth={2} aria-hidden="true" />
                                Mercado fechado
                            </span>
                        )}
                        {selectedDay === reportDay && (
                            <span className={`${styles.pill} ${styles.pillReport}`}>
                                <FileText size={12} strokeWidth={2} aria-hidden="true" />
                                Fim do trimestre
                            </span>
                        )}
                    </div>

                    <section className={styles.mine} aria-label="Para você">
                        <h4 className={styles.mineTitle}>
                            Para você
                            <span className={styles.count}>{summary.mineCount}</span>
                        </h4>
                        {summary.upcomingPayout > 0 && (
                            <p className={styles.payout}>
                                Proventos a receber nesta janela: <b>{formatCurrency(summary.upcomingPayout)}</b>
                                {summary.upcomingPayoutIsEstimate && ' (estimado)'}
                            </p>
                        )}
                        <EventColumns
                            group={mineGroup}
                            today={today}
                            selectedIsToday={selectedIsToday}
                            selectedIsFuture={selectedIsFuture}
                            nothing="Nada que afete você neste dia."
                        />
                    </section>

                    {scope === 'all' ? (
                        <details className={styles.market} open={marketGroup.happened.length + marketGroup.coming.length > 0}>
                            <summary className={styles.marketSummary}>No mercado</summary>
                            <EventColumns
                                group={marketGroup}
                                today={today}
                                selectedIsToday={selectedIsToday}
                                selectedIsFuture={selectedIsFuture}
                                nothing="Nenhum fato do mercado neste dia."
                            />
                            {calendar && calendar.market_total > calendar.market_shown && (
                                <p className={styles.note}>
                                    Mostrando {calendar.market_shown} de {calendar.market_total} fatos do mercado, os mais próximos de hoje.
                                </p>
                            )}
                        </details>
                    ) : (
                        <p className={styles.note}>
                            Mostrando só o que afeta você.{' '}
                            {hiddenMarket > 0 &&
                                `${hiddenMarket} ${hiddenMarket === 1 ? 'fato do mercado fica' : 'fatos do mercado ficam'} de fora. `}
                            <button type="button" className={styles.link} onClick={() => onScopeChange('all')}>
                                Ver o mercado
                            </button>
                        </p>
                    )}
                </>
            )}
        </>
    )
}

interface EventColumnsProps {
    group: { happened: Entry[]; coming: Entry[] }
    today: number
    selectedIsToday: boolean
    selectedIsFuture: boolean
    nothing: string
}

// As duas listas do dia, "Aconteceu" e "Vem aí", usadas tanto em "Para você"
// quanto em "No mercado".
function EventColumns({ group, today, selectedIsToday, selectedIsFuture, nothing }: EventColumnsProps) {
    const { happened, coming } = group
    if (happened.length === 0 && coming.length === 0) return <p className={styles.empty}>{nothing}</p>

    return (
        <div className={styles.lists}>
            <div>
                <h5 className={styles.groupTitle}>Aconteceu</h5>
                {happened.length > 0 ? (
                    <ul className={styles.list}>
                        {happened.map(({ event }, index) => (
                            <CalendarEventItem key={`${event.kind}-${index}`} event={event} />
                        ))}
                    </ul>
                ) : (
                    <p className={styles.empty}>{selectedIsFuture ? 'Ainda não aconteceu.' : 'Nada registrado neste dia.'}</p>
                )}
            </div>
            <div>
                <h5 className={styles.groupTitle}>Vem aí</h5>
                {coming.length > 0 ? (
                    <ul className={styles.list}>
                        {coming.map(({ event, day }, index) => (
                            <CalendarEventItem
                                key={`${event.kind}-${index}`}
                                event={event}
                                whenLabel={
                                    day && day.simulated_day > today
                                        ? `${weekdayShort(day.weekday)} ${formatDayMonth(day.date)} · ${daysLabel(day.simulated_day - today)}`
                                        : day
                                          ? 'hoje'
                                          : undefined
                                }
                            />
                        ))}
                    </ul>
                ) : (
                    <p className={styles.empty}>
                        {selectedIsFuture || selectedIsToday ? 'Nenhum fato previsto.' : 'Para ver o que vem depois, toque em hoje.'}
                    </p>
                )}
            </div>
        </div>
    )
}

function Footer({ daysPerRealDay }: { daysPerRealDay: number | undefined }) {
    return (
        <div className={styles.foot}>
            <p className={styles.accel}>
                <FastForward size={18} strokeWidth={2} aria-hidden="true" />
                <span>
                    Cada dia real equivale a <b>{daysPerRealDay ?? 5} dias de mercado</b>. Sábado e domingo o mercado fica fechado.
                </span>
            </p>
        </div>
    )
}

function Legend() {
    return (
        <ul id={LEGEND_ID} className={styles.legend} aria-label="Legenda">
            <li>
                <span className={`${styles.swatch} ${styles.swatchMine}`} aria-hidden="true" />
                Para você
            </li>
            <li>
                <span className={`${styles.swatch} ${styles.swatchDashed}`} aria-hidden="true" />
                No mercado
            </li>
            <li>
                <span className={styles.swatch} aria-hidden="true" />
                Aconteceu
            </li>
            <li>
                <span className={`${styles.swatch} ${styles.swatchDashed}`} aria-hidden="true" />
                Vem aí
            </li>
            <li>
                <span className={`${styles.swatch} ${styles.swatchReport}`} aria-hidden="true" />
                Fim do trimestre
            </li>
            {LEGEND.map((item) => (
                <li key={item.kind}>
                    <CalendarKindIcon kind={item.kind} size={13} />
                    {item.label}
                </li>
            ))}
        </ul>
    )
}
