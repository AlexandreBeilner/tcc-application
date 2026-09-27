// Detecção do 5º dia útil do mês-calendário real (Fase T, salário mensal —
// cadência de pagamento). Nunca duplica `simcalendar.IsBusinessDay` do motor
// (Go) — só conta os códigos de `weekday` que `GET /market/calendar` já
// devolve por dia (`sun`/`mon`/`tue`/`wed`/`thu`/`fri`/`sat`, tarefa S.10).
const WEEKEND_CODES = new Set(['sat', 'sun'])

export interface CalendarDaySummary {
  date: string
  weekday: string
}

// `days` é a sequência do 1º dia do mês-calendário real até hoje (nessa
// ordem — `GET /market/calendar?from=<1º dia do mês>&to=<hoje>`), cada
// elemento com o `weekday` que a API já devolve. Devolve se o último dia da
// lista (hoje) é o 5º dia útil desse mês.
export function isFifthBusinessDayOfMonth(days: CalendarDaySummary[]): boolean {
  const today = days[days.length - 1]
  if (!today || WEEKEND_CODES.has(today.weekday)) {
    return false
  }
  const businessDaysCount = days.filter((day) => !WEEKEND_CODES.has(day.weekday)).length
  return businessDaysCount === 5
}
