import type {
  MarketCalendar,
  MarketCalendarQuery,
  MarketCalendarReader,
  MarketClock,
} from '../../application/ports/marketCalendarReader'

export interface FakeMarketCalendarReader extends MarketCalendarReader {
  getCalendarCalls: Array<{ userId: string; query: MarketCalendarQuery }>
  errorToThrow?: Error
}

export function createFakeMarketCalendarReader(results: {
  clock?: MarketClock
  calendar?: MarketCalendar
}): FakeMarketCalendarReader {
  const fake: FakeMarketCalendarReader = {
    getCalendarCalls: [],
    errorToThrow: undefined,
    async getClock() {
      if (fake.errorToThrow) throw fake.errorToThrow
      return (
        results.clock ?? {
          simulated_day: 0,
          date: '2026-01-05',
          weekday: 'mon',
          market_open: true,
          days_until_open: 0,
          days_per_real_day: 5,
          next_tick_at: null,
          quarter_day: 1,
          quarter_length: 91,
        }
      )
    },
    async getCalendar(userId, query) {
      fake.getCalendarCalls.push({ userId, query })
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.calendar ?? { from_day: 0, to_day: 0, days: [] }
    },
  }
  return fake
}
