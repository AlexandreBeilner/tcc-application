// Retrospectiva mensal (MO.5.4): resumo da jornada do mês, calculado só de dados que já existem.
// Nunca patrimônio absoluto (RNF09): só contagens, nível, dias de atividade e rentabilidade
// percentual.

export type MonthKey = string // 'AAAA-MM'

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

export function isMonthKey(value: string): value is MonthKey {
  return MONTH_RE.test(value)
}

export function monthKeyOf(date: Date): MonthKey {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

// Mês fechado imediatamente anterior ao de `now` (a retrospectiva só existe para meses acabados).
export function previousMonth(now: Date): MonthKey {
  return monthKeyOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)))
}

export interface MonthRange {
  // Primeiro instante do mês (inclusive) e primeiro instante do mês seguinte (exclusivo), em UTC,
  // a mesma convenção de dia do streak e da janela do ranking.
  start: Date
  endExclusive: Date
  daysInMonth: number
  // Primeiro e último dia como 'AAAA-MM-DD'.
  firstDay: string
  lastDay: string
}

export function monthRange(month: MonthKey): MonthRange {
  const [year, mon] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, mon - 1, 1))
  const endExclusive = new Date(Date.UTC(year, mon, 1))
  const daysInMonth = Math.round((endExclusive.getTime() - start.getTime()) / 86_400_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start,
    endExclusive,
    daysInMonth,
    firstDay: `${year}-${pad(mon)}-01`,
    lastDay: `${year}-${pad(mon)}-${pad(daysInMonth)}`,
  }
}

// Meses (mais recentes primeiro) com retrospectiva possível: do mês da criação da conta até o
// mês anterior ao de agora, no máximo `limit`.
export function availableMonths(createdAt: Date, now: Date, limit = 12): MonthKey[] {
  const last = previousMonth(now)
  const first = monthKeyOf(createdAt)
  const months: MonthKey[] = []
  let cursor = last
  while (cursor >= first && months.length < limit) {
    months.push(cursor)
    const [y, m] = cursor.split('-').map(Number)
    cursor = monthKeyOf(new Date(Date.UTC(y, m - 2, 1)))
  }
  return months
}

// Maior sequência de dias consecutivos dentro do mês, a partir dos dias do mês com atividade
// (números de 1 a 31, qualquer ordem).
export function longestRun(days: number[]): number {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  let best = 0
  let run = 0
  let previous = -Infinity
  for (const day of sorted) {
    run = day === previous + 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }
  return best
}

export interface RetrospectiveData {
  month: MonthKey
  lessonsCompleted: number
  achievementsUnlocked: number
  achievementNames: string[]
  level: number
  activeDays: number[] // dias do mês (1 a 31) com atividade; o resto é dia off
  daysInMonth: number
  longestStreak: number
  // Rentabilidade percentual do mês (a mesma do ranking); `null` se não deu para medir.
  bestReturnPct: number | null
  duelsPlayed: number
  duelsWon: number
  leaguesActive: number
}

export interface RetrospectiveView extends RetrospectiveData {
  // Nada de relevante no mês: a tela mostra um texto acolhedor, nunca cobrança.
  empty: boolean
}

export function toView(data: RetrospectiveData): RetrospectiveView {
  return {
    ...data,
    empty:
      data.lessonsCompleted === 0 &&
      data.achievementsUnlocked === 0 &&
      data.activeDays.length === 0 &&
      data.duelsPlayed === 0,
  }
}
