import { utcDateString } from '../../../shared/utcDate'

// Dia do Diário (DI5): exatamente a regra do streak (`todayUtc`), dia
// calendário em UTC. O jogo novo aparece às 21h de Brasília. O relógio
// sempre entra por parâmetro; nada aqui chama `new Date()`.
export function dailyDay(now: Date): string {
  return utcDateString(now)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY)
}

export function addDays(date: string, days: number): string {
  return utcDateString(new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY))
}

// `startDate` null = desligado. Agendado e no ar saem da comparação com o
// dia de hoje, então o estado nunca contradiz o relógio.
export type DailyStatus =
  | { status: 'off' }
  | { status: 'scheduled'; startDate: string }
  | { status: 'live'; startDate: string }

export function resolveStatus(startDate: string | null, today: string): DailyStatus {
  if (startDate === null) return { status: 'off' }
  return today < startDate ? { status: 'scheduled', startDate } : { status: 'live', startDate }
}

// #1 = dia da estreia (seção 3.5). Antes da estreia não há número.
export function gameNumberFor(startDate: string, day: string): number | null {
  return day < startDate ? null : daysBetween(startDate, day) + 1
}

export function gameDateFor(startDate: string, gameNumber: number): string {
  return addDays(startDate, gameNumber - 1)
}

export type GameAccess =
  | { kind: 'off' }
  | { kind: 'not_started'; startDate: string }
  // Número inexistente ou futuro: o mesmo resultado para os dois, para não
  // revelar se o jogo de amanhã já está pronto (seção 3.6).
  | { kind: 'not_found' }
  | { kind: 'ok'; number: number; date: string; isToday: boolean; awardsXp: boolean }

export function resolveGameAccess(
  startDate: string | null,
  today: string,
  requestedNumber: number,
): GameAccess {
  const state = resolveStatus(startDate, today)
  if (state.status === 'off') return { kind: 'off' }
  if (state.status === 'scheduled') return { kind: 'not_started', startDate: state.startDate }

  const todayNumber = gameNumberFor(state.startDate, today) as number
  if (!Number.isInteger(requestedNumber) || requestedNumber < 1 || requestedNumber > todayNumber) {
    return { kind: 'not_found' }
  }
  const isToday = requestedNumber === todayNumber
  // Só o jogo do dia vale XP e streak (seção 3.6).
  return {
    kind: 'ok',
    number: requestedNumber,
    date: gameDateFor(state.startDate, requestedNumber),
    isToday,
    awardsXp: isToday,
  }
}
