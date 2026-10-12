import type { AssemblyCalendarFact } from './ports/assemblyCalendarSource'
import type { MarketCalendar, MarketClock } from './ports/marketCalendarReader'

const DAY_MS = 24 * 60 * 60 * 1000

// Dia simulado de um instante real: o relógio do motor diz em que dia simulado estamos agora e
// quantos dias simulados passam por dia real (hoje 1, um tick por dia real).
export function simulatedDayOf(
  at: Date,
  now: Date,
  clock: Pick<MarketClock, 'simulated_day' | 'days_per_real_day'>,
): number {
  return (
    clock.simulated_day +
    Math.round(((at.getTime() - now.getTime()) / DAY_MS) * clock.days_per_real_day)
  )
}

// Janela real que cobre os dias simulados do calendário (com folga de um dia nas pontas).
export function realWindowOf(
  calendar: Pick<MarketCalendar, 'from_day' | 'to_day'>,
  now: Date,
  clock: Pick<MarketClock, 'simulated_day' | 'days_per_real_day'>,
): { from: Date; to: Date } {
  const perDay = clock.days_per_real_day > 0 ? clock.days_per_real_day : 1
  const at = (day: number) =>
    new Date(now.getTime() + ((day - clock.simulated_day) / perDay) * DAY_MS)
  return {
    from: new Date(at(calendar.from_day).getTime() - DAY_MS),
    to: new Date(at(calendar.to_day).getTime() + DAY_MS),
  }
}

// Acrescenta os marcos das assembleias ao calendário do motor como fatos globais de mercado
// (`relevance: 'market'`, nunca do usuário). Só entram os que caem nos dias da janela; os contadores
// do dia e do total acompanham, para a grade pintar o dia sem baixar tudo.
export function mergeAssemblyEvents(
  calendar: MarketCalendar,
  facts: readonly AssemblyCalendarFact[],
  now: Date,
  clock: Pick<MarketClock, 'simulated_day' | 'days_per_real_day'>,
): MarketCalendar {
  if (facts.length === 0) return calendar
  const days = calendar.days.map((d) => ({
    ...d,
    events: [...d.events],
    summary: { ...d.summary },
  }))
  let added = 0
  for (const fact of facts) {
    const day = days.find((d) => d.simulated_day === simulatedDayOf(fact.at, now, clock))
    if (!day) continue
    day.events.push({
      kind: fact.milestone,
      scope: 'global',
      future: day.simulated_day > clock.simulated_day,
      title: fact.title,
      relevance: 'market',
    })
    day.summary.market_count += 1
    added += 1
  }
  if (added === 0) return calendar
  return {
    ...calendar,
    days,
    market_total: calendar.market_total + added,
    market_shown: calendar.market_shown + added,
  }
}
