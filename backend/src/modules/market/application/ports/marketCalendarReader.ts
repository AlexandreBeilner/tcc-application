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
  // Só em `salary_payment`: mês-calendário a que o salário se refere (achado 025).
  reference_month?: string
  // Relevância pro usuário do token (RC.6.1), calculada no motor. `relevance_reason`,
  // `estimated_amount`, `amount_is_estimate` e `user_quantity` só vêm em `mine`
  // com valor do próprio usuário (nunca de terceiros, RNF09).
  relevance: CalendarRelevance
  relevance_reason?: CalendarRelevanceReason
  estimated_amount?: number
  amount_is_estimate?: boolean
  user_quantity?: number
}

export type CalendarRelevance = 'mine' | 'market'
export type CalendarRelevanceReason = 'position' | 'own_fact' | 'fixed_income_position' | 'salary'

// Contagem de fatos do dia por relevância, antes do corte por `market_limit`.
export interface CalendarDaySummary {
  mine_count: number
  market_count: number
}

export interface CalendarDay {
  simulated_day: number
  date: string
  weekday: string
  market_open: boolean
  summary: CalendarDaySummary
  events: CalendarEvent[]
}

export interface MarketCalendar {
  from_day: number
  to_day: number
  // Total de fatos de mercado na janela antes do corte e quantos vieram (RC.6.1).
  market_total: number
  market_shown: number
  days: CalendarDay[]
}

export type CalendarScope = 'mine' | 'all'

export interface MarketCalendarQuery {
  from?: string
  to?: string
  // Sem `scope` o motor devolve tudo (`all`); sem `market_limit`, o padrão dele (50).
  scope?: CalendarScope
  market_limit?: number
}

// Pausa de negociação vigente (N.9), só o que o usuário pode saber: se é global e em
// quais ativos. Nunca o motivo interno nem quem pausou.
export interface TradingHaltStatus {
  global: boolean
  asset_ids: string[]
}

// Relógio e linha do tempo do mercado simulado. `userId` junta os fatos do
// próprio usuário na linha do tempo; o backend sempre passa o id do token,
// nunca um id vindo da requisição.
export interface MarketCalendarReader {
  getClock(): Promise<MarketClock>
  getCalendar(userId: string, query: MarketCalendarQuery): Promise<MarketCalendar>
  getTradingHalts(): Promise<TradingHaltStatus>
}
