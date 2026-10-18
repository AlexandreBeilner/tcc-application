// Regras puras do painel de retenção (RT.1.2). Datas são sempre texto AAAA-MM-DD no calendário UTC,
// a mesma convenção do streak, de `daily_activity` e de `daily_presence`.

const DAY_MS = 24 * 60 * 60 * 1000

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(day: string, days: number): string {
  return utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS))
}

// Segunda-feira da semana (UTC) que contém o dia: o mesmo corte de `date_trunc('week')` do Postgres.
export function weekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay() // 0 = domingo
  return addDays(day, -((weekday + 6) % 7))
}

// Dias de retenção medidos nas coortes (RP2).
export const COHORT_OFFSETS = [1, 7, 30] as const
export type CohortOffset = (typeof COHORT_OFFSETS)[number]

// Quanto da coorte já dá para medir em um dado dia depois do cadastro, numa medida (voltou ou estudou).
export interface MeasureCounts {
  // Pessoas cujo dia N ainda não fechou (hoje ou futuro).
  open: number
  // Pessoas cujo dia N é anterior ao início do registro da medida (sem dado, não é zero).
  beforeTracking: number
  // Pessoas com o dia N fechado e dentro do período registrado.
  measurable: number
  // Das mensuráveis, quantas apareceram exatamente no dia N.
  active: number
}

// - complete: todo mundo da coorte foi medido;
// - partial: só parte foi medida (o resto ainda está em andamento ou é anterior ao registro);
// - in_progress: ninguém foi medido porque o dia N ainda não chegou. NUNCA é zero;
// - no_data: ninguém foi medido porque o dia N é anterior ao registro dessa medida.
export type CellStatus = 'complete' | 'partial' | 'in_progress' | 'no_data'

export interface RetentionCell {
  status: CellStatus
  // 0 a 1; nulo quando ninguém foi medido.
  rate: number | null
  measured: number
  size: number
}

export function retentionCell(size: number, counts: MeasureCounts): RetentionCell {
  if (counts.measurable === 0) {
    return {
      status: counts.open > 0 ? 'in_progress' : 'no_data',
      rate: null,
      measured: 0,
      size,
    }
  }
  return {
    status: counts.measurable === size ? 'complete' : 'partial',
    rate: counts.active / counts.measurable,
    measured: counts.measurable,
    size,
  }
}

// Mediana é calculada no banco; este é o formato dela por marco.
export const MILESTONE_KEYS = [
  'first_return',
  'first_lesson',
  'first_trade',
  'first_fixed_income',
  'first_daily',
] as const
export type MilestoneKey = (typeof MILESTONE_KEYS)[number]

// "Primeiro acesso depois do cadastro" só tem precisão de dia (sai de `daily_presence`); os outros
// marcos têm a hora exata em `user_milestones`.
export const MILESTONE_GRANULARITY: Record<MilestoneKey, 'day' | 'second'> = {
  first_return: 'day',
  first_lesson: 'second',
  first_trade: 'second',
  first_fixed_income: 'second',
  first_daily: 'second',
}

// Coorte "madura" para os marcos: 30 dias depois do último dia da semana de cadastro. Antes disso a
// % ainda está subindo e não deve ser comparada com a de coortes antigas.
export const MILESTONE_MATURITY_DAYS = 30

export function isCohortMatured(cohortWeek: string, today: string): boolean {
  return addDays(cohortWeek, 6 + MILESTONE_MATURITY_DAYS) < today
}
