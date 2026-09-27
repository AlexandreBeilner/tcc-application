import type { CalendarDay, CalendarEvent, MarketCalendar, MarketClock } from '../services/market'

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
export function calendarFixture(events: Record<number, CalendarEvent[]> = {}): MarketCalendar {
    const days: CalendarDay[] = []
    for (let day = 128; day <= 149; day += 1) {
        const date = new Date(Date.UTC(2026, 6, 8 + (day - 135)))
        const weekday = WEEKDAYS[date.getUTCDay()]
        days.push({
            simulated_day: day,
            date: date.toISOString().slice(0, 10),
            weekday,
            market_open: weekday !== 'sat' && weekday !== 'sun',
            events: events[day] ?? [],
        })
    }
    return { from_day: 128, to_day: 149, days }
}

export const DEFAULT_EVENTS: Record<number, CalendarEvent[]> = {
    133: [{ kind: 'order_executed', scope: 'user', future: false, side: 'buy', ticker: 'BNDD3', quantity: 10, unit_value: 24.8 }],
    135: [
        { kind: 'copom', scope: 'global', future: false, selic_rate: 10.5, previous_selic_rate: 10.75 },
        { kind: 'report', scope: 'global', future: true },
    ],
    140: [{ kind: 'fixed_income_maturity', scope: 'user', future: true, ticker: 'LFT2029', quantity: 3 }],
    141: [{ kind: 'dividend_ex_date', scope: 'global', future: true, ticker: 'PAPL11', unit_value: 0.88 }],
}
