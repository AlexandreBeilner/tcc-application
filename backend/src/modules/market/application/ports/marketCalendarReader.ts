// Espelham o payload de `GET /market/clock` e `GET /market/calendar` do motor
// (`.docs/engine/calendar.md`, tarefa S.10) campo a campo, em snake_case, sem
// tradução — mesma convenção de `indicatorHistoryReader.ts`.
export interface MarketClock {
  simulated_day: number
  date: string
  weekday: string
  market_open: boolean
  days_until_open: number
  days_per_real_day: number
  next_tick_at: string | null
  quarter_day: number
  quarter_length: number
}

export interface CalendarEvent {
  kind: string
  scope: 'global' | 'user'
  future: boolean
  title?: string
  direction?: string
  ticker?: string
  side?: string
  quantity?: number
  unit_value?: number
  selic_rate?: number
  previous_selic_rate?: number
}

export interface CalendarDay {
  simulated_day: number
  date: string
  weekday: string
  market_open: boolean
  events: CalendarEvent[]
}

export interface MarketCalendar {
  from_day: number
  to_day: number
  days: CalendarDay[]
}

export interface MarketCalendarQuery {
  from?: string
  to?: string
}

// Relógio e linha do tempo do mercado simulado. `userId` junta os fatos do
// próprio usuário na linha do tempo; o backend sempre passa o id do token,
// nunca um id vindo da requisição.
export interface MarketCalendarReader {
  getClock(): Promise<MarketClock>
  getCalendar(userId: string, query: MarketCalendarQuery): Promise<MarketCalendar>
}
