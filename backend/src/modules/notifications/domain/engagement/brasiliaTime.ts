// Calendário de Brasília (UTC-3, sem horário de verão desde 2019) para as janelas dos e-mails de
// engajamento: o usuário pensa em "segunda de manhã", não em UTC.
const FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
})

export interface BrasiliaParts {
  // `2026-10-12`
  date: string
  // 0 = domingo ... 6 = sábado
  weekday: number
  hour: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function brasiliaParts(instant: Date): BrasiliaParts {
  const parts = FORMAT.formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAYS.indexOf(get('weekday')),
    hour: Number(get('hour')),
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

// Dia (`YYYY-MM-DD`) deslocado `days` dias, sem passar por fuso (aritmética de calendário).
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10)
}
