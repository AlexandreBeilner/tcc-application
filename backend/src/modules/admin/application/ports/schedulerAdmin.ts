import type { TickResult } from './tickTrigger'

// Espelha GET /admin/scheduler do motor (tarefa N.6) — mesmos nomes de campo
// (snake_case), sem tradução, mesma convenção de TickTrigger. `enabled` é a
// agenda do processo (variável de ambiente, só leitura); `paused` é a pausa em
// runtime.
export interface SchedulerStatus {
  enabled: boolean
  paused: boolean
  resumed_at: string | null
  ticks_per_day: number
  timezone: string
  max_catch_up: number
  next_slot_at: string | null
  tick_in_progress: boolean
  last_tick_at: string | null
}

// Item de GET /admin/ticks (histórico em tick_runs).
export interface TickRun {
  simulated_day: number | null
  trigger: 'scheduled' | 'catchup' | 'manual'
  status: 'success' | 'failed'
  error_message: string | null
  started_at: string
  duration_ms: number
  catch_up_discarded: number
  selic_rate: number | null
  is_copom_day: boolean
  is_report_day: boolean
  quotes_count: number
  fundamentals_count: number
  dividends_generated_count: number
  dividends_paid_count: number
  bot_fills_count: number
  expired_orders_count: number
  uncovered_assets_count: number
  intraday_rounds_count: number
}

export interface ListTicksQuery {
  limit?: number
  offset?: number
}

export interface ListTicksResult {
  ticks: TickRun[]
  total_entries: number
}

export interface AdvanceTicksResult {
  requested: number
  ticks: TickResult[]
}

// Controle do Temporizador no motor de simulação: o estado da agenda, a pausa
// e o histórico de ticks vivem no banco "market", dono é o motor (mesmo
// raciocínio de TickTrigger e MacroEventReader).
export interface SchedulerAdmin {
  getStatus(): Promise<SchedulerStatus>
  pause(): Promise<SchedulerStatus>
  resume(): Promise<SchedulerStatus>
  listTicks(query: ListTicksQuery): Promise<ListTicksResult>
  advance(days: number): Promise<AdvanceTicksResult>
}
