export interface Window {
  start: Date
  end: Date
}

export type WindowKind = 'week' | 'month'

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Janela alinhada ao calendário (decisão confirmada com o usuário em
// 2026-08-23, ver backlog tarefa 5.5), não uma janela móvel de N dias
// corridos. Timezone fixado em UTC — mesma decisão de `gamification/domain/streak.ts`
// (5.3): sem conceito de fuso do usuário no modelo hoje.

// Semana ISO: segunda 00:00:00.000 UTC (inclusive) até domingo 23:59:59.999
// UTC (inclusive).
export function weekWindow(now: Date): Window {
  const dayOfWeek = now.getUTCDay() // 0=domingo..6=sábado
  const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek // 1=segunda..7=domingo
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - (isoDayOfWeek - 1))
  const end = new Date(start.getTime() + 7 * MS_PER_DAY - 1)
  return { start, end }
}

// Mês calendário: dia 1 00:00:00.000 UTC até o último dia do mês,
// 23:59:59.999 UTC.
export function monthWindow(now: Date): Window {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1)
  return { start, end }
}

export function windowFor(kind: WindowKind, now: Date): Window {
  return kind === 'week' ? weekWindow(now) : monthWindow(now)
}
