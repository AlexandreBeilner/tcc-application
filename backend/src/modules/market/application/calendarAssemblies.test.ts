import { describe, expect, it } from 'vitest'
import type { AssemblyCalendarFact } from './ports/assemblyCalendarSource'
import type { MarketCalendar } from './ports/marketCalendarReader'
import { mergeAssemblyEvents, realWindowOf, simulatedDayOf } from './calendarAssemblies'

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-10-10T12:00:00Z')
const clock = { simulated_day: 100, days_per_real_day: 1 }

function calendar(): MarketCalendar {
  return {
    from_day: 98,
    to_day: 104,
    market_total: 2,
    market_shown: 2,
    days: Array.from({ length: 7 }, (_, i) => ({
      simulated_day: 98 + i,
      date: `d${98 + i}`,
      weekday: 'mon',
      market_open: true,
      summary: { mine_count: 0, market_count: 0 },
      events: [],
    })),
  }
}

const fact = (
  milestone: AssemblyCalendarFact['milestone'],
  daysFromNow: number,
): AssemblyCalendarFact => ({
  milestone,
  at: new Date(now.getTime() + daysFromNow * DAY),
  title: 'Acme: Orçamento de capital',
})

describe('simulatedDayOf', () => {
  it('converte pelo relógio do motor', () => {
    expect(simulatedDayOf(now, now, clock)).toBe(100)
    expect(simulatedDayOf(new Date(now.getTime() + 3 * DAY), now, clock)).toBe(103)
    expect(simulatedDayOf(new Date(now.getTime() - 2 * DAY), now, clock)).toBe(98)
    expect(
      simulatedDayOf(new Date(now.getTime() + 1 * DAY), now, { ...clock, days_per_real_day: 5 }),
    ).toBe(105)
  })
})

describe('realWindowOf', () => {
  it('cobre os dias simulados com folga de um dia', () => {
    const { from, to } = realWindowOf(calendar(), now, clock)
    expect(from.getTime()).toBe(now.getTime() - 3 * DAY)
    expect(to.getTime()).toBe(now.getTime() + 5 * DAY)
  })
})

describe('mergeAssemblyEvents', () => {
  it('põe cada marco no dia certo como fato global de mercado e marca o que ainda vai acontecer', () => {
    const merged = mergeAssemblyEvents(
      calendar(),
      [fact('assembly_open', -1), fact('assembly_close', 2)],
      now,
      clock,
    )
    const past = merged.days.find((d) => d.simulated_day === 99)
    const future = merged.days.find((d) => d.simulated_day === 102)
    expect(past?.events[0]).toMatchObject({
      kind: 'assembly_open',
      scope: 'global',
      relevance: 'market',
      future: false,
      title: 'Acme: Orçamento de capital',
    })
    expect(future?.events[0]).toMatchObject({ kind: 'assembly_close', future: true })
    expect(past?.summary.market_count).toBe(1)
    expect(merged.market_total).toBe(4)
    expect(merged.market_shown).toBe(4)
  })

  it('ignora marco fora da janela e não muta o calendário recebido', () => {
    const original = calendar()
    expect(mergeAssemblyEvents(original, [fact('assembly_effect', 30)], now, clock)).toBe(original)
    const merged = mergeAssemblyEvents(original, [fact('assembly_effect', 1)], now, clock)
    expect(merged).not.toBe(original)
    expect(original.days.every((d) => d.events.length === 0)).toBe(true)
  })

  it('sem marcos devolve o mesmo calendário', () => {
    const original = calendar()
    expect(mergeAssemblyEvents(original, [], now, clock)).toBe(original)
  })
})
