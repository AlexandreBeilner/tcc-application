// Detecção do 5º dia útil do mês-calendário real (Fase T, salário mensal —
// cadência de pagamento). Nunca duplica `simcalendar.IsBusinessDay` do motor
// (Go) — só conta os códigos de `weekday` que `GET /market/calendar` já
// devolve por dia (`sun`/`mon`/`tue`/`wed`/`thu`/`fri`/`sat`, tarefa S.10).
const WEEKEND_CODES = new Set(['sat', 'sun'])

export interface CalendarDaySummary {
  date: string
  weekday: string
}

// Quantos dias úteis já se passaram (incluindo hoje, se hoje for útil) desde
// o 1º dia do mês até o último elemento de `days` — usada pela T.5 pra saber
// se o mês corrente já "venceu" o pagamento (>= 5), não só se hoje é
// exatamente o 5º.
export function businessDaysElapsed(days: CalendarDaySummary[]): number {
  return days.filter((day) => !WEEKEND_CODES.has(day.weekday)).length
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
  return businessDaysElapsed(days) === 5
}
