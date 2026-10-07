import type { CalendarDay, CalendarEvent, MarketCalendar, MarketClock } from '../services/market'

type EventInput = Omit<CalendarEvent, 'relevance'> & Partial<Pick<CalendarEvent, 'relevance'>>

// Fato do calendário de teste: sem `relevance` explícita, fato do usuário é
// `mine` e fato global é `market`, como o motor classifica nos casos simples.
export function calendarEvent(input: EventInput): CalendarEvent {
    return { relevance: input.scope === 'user' ? 'mine' : 'market', ...input }
}

// Dia do calendário de teste com o `summary` calculado dos próprios fatos.
export function calendarDay(fields: Omit<CalendarDay, 'summary' | 'events'>, events: EventInput[] = []): CalendarDay {
    const built = events.map(calendarEvent)
    const mine = built.filter((event) => event.relevance === 'mine').length
    return { ...fields, summary: { mine_count: mine, market_count: built.length - mine }, events: built }
}

export function calendarWindow(fromDay: number, toDay: number, days: CalendarDay[] = []): MarketCalendar {
    const market = days.reduce((total, day) => total + day.summary.market_count, 0)
    return { from_day: fromDay, to_day: toDay, market_total: market, market_shown: market, days }
}

export const WEDNESDAY_CLOCK: MarketClock = {
    simulated_day: 135,
    date: '2026-07-08',
    weekday: 'wed',
    market_open: true,
    days_until_open: 0,
    days_per_real_day: 5,
    next_tick_at: '2026-07-08T14:14:00Z',
    quarter_day: 44,
    quarter_length: 91,
}

export const SATURDAY_CLOCK: MarketClock = {
    ...WEDNESDAY_CLOCK,
    simulated_day: 138,
    date: '2026-07-11',
    weekday: 'sat',
    market_open: false,
    days_until_open: 2,
    quarter_day: 47,
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// Janela de 128 a 149 (hoje 135) com fatos de exemplo espalhados.
export function calendarFixture(events: Record<number, EventInput[]> = {}): MarketCalendar {
    const days: CalendarDay[] = []
    for (let day = 128; day <= 149; day += 1) {
        const date = new Date(Date.UTC(2026, 6, 8 + (day - 135)))
        const weekday = WEEKDAYS[date.getUTCDay()]
        days.push(
            calendarDay(
                {
                    simulated_day: day,
                    date: date.toISOString().slice(0, 10),
                    weekday,
                    market_open: weekday !== 'sat' && weekday !== 'sun',
                },
                events[day],
            ),
        )
    }
    return calendarWindow(128, 149, days)
}

export const DEFAULT_EVENTS: Record<number, EventInput[]> = {
    133: [{ kind: 'order_executed', scope: 'user', future: false, side: 'buy', ticker: 'BNDD3', quantity: 10, unit_value: 24.8 }],
    135: [
        { kind: 'copom', scope: 'global', future: false, selic_rate: 10.5, previous_selic_rate: 10.75 },
        { kind: 'report', scope: 'global', future: true },
    ],
    140: [{ kind: 'fixed_income_maturity', scope: 'user', future: true, ticker: 'LFT2029', quantity: 3 }],
    141: [{ kind: 'dividend_ex_date', scope: 'global', future: true, ticker: 'PAPL11', unit_value: 0.88 }],
}
