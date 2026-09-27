import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, FastForward, FileText, Lock, X } from 'lucide-react'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { formatDayMonth, formatWeekdayDate, shiftIsoDate, weekdayLong, weekdayShort } from '../../../features/market/calendarFormat'
import { quarterCells } from '../../../features/market/quarterCells'
import { useMarketCalendarQuery } from '../../../features/market/useMarketCalendarQuery'
import { useMarketClockQuery } from '../../../features/market/useMarketClockQuery'
import type { CalendarDay, CalendarEvent, CalendarEventKind, MarketClock } from '../../../services/market'
import { CalendarKindIcon } from '../../atoms/CalendarKindIcon'
import { CalendarDayStrip } from '../../molecules/CalendarDayStrip'
import { CalendarEventItem } from '../../molecules/CalendarEventItem'
import { QuarterGrid } from '../../molecules/QuarterGrid'
import styles from './index.module.css'

export const MARKET_CALENDAR_PANEL_ID = 'market-calendar-panel'

interface MarketCalendarPanelProps {
    onClose: () => void
}

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
]

function daysLabel(days: number): string {
    return `em ${days} ${days === 1 ? 'dia' : 'dias'}`
}

function upcomingFrom(days: CalendarDay[], todayDay: number): { event: CalendarEvent; day: CalendarDay }[] {
    return days
        .filter((day) => day.simulated_day >= todayDay)
        .flatMap((day) => day.events.filter((event) => event.future).map((event) => ({ event, day })))
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
    const calendarQuery = useMarketCalendarQuery(range?.from ?? null, range?.to ?? null, clock !== undefined)
    const quarterQuery = useMarketCalendarQuery(
        cells[0]?.date ?? null,
        cells[cells.length - 1]?.date ?? null,
        isDesktop && cells.length > 0,
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
                    <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Fechar calendário">
                        <X size={18} strokeWidth={2} aria-hidden="true" />
                    </button>
                </div>

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
}

function PanelBody({ clock, windowDays, loading, failed, eventsByDay, cells, showGrid, selectedDay, onSelect }: PanelBodyProps) {
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

    const happened = selectedEvents.filter((event) => !event.future)
    const coming = selectedIsToday
        ? upcomingFrom(windowDays, today)
        : selectedEvents.filter((event) => event.future).map((event) => ({ event, day: null }))

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

                    <div className={styles.lists}>
                        <div>
                            <h4 className={styles.groupTitle}>Aconteceu</h4>
                            {happened.length > 0 ? (
                                <ul className={styles.list}>
                                    {happened.map((event, index) => (
                                        <CalendarEventItem key={`${event.kind}-${index}`} event={event} />
                                    ))}
                                </ul>
                            ) : (
                                <p className={styles.empty}>{selectedIsFuture ? 'Ainda não aconteceu.' : 'Nada registrado neste dia.'}</p>
                            )}
                        </div>
                        <div>
                            <h4 className={styles.groupTitle}>Vem aí</h4>
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
                                    {selectedIsFuture || selectedIsToday
                                        ? 'Nenhum fato previsto.'
                                        : 'Para ver o que vem depois, toque em hoje.'}
                                </p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
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
            <ul className={styles.legend} aria-label="Legenda">
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
        </div>
    )
}
