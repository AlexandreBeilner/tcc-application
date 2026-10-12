import { describe, expect, it, vi } from 'vitest'
import { createFakeMarketCalendarReader } from '../../test/fakes/fakeMarketCalendarReader'
import { GetMarketCalendarUseCase } from './getMarketCalendar'
import { GetMarketClockUseCase } from './getMarketClock'

describe('GetMarketClockUseCase', () => {
  it('devolve o relógio do motor', async () => {
    const reader = createFakeMarketCalendarReader({})
    const clock = await new GetMarketClockUseCase(reader).execute()
    expect(clock.market_open).toBe(true)
  })
})

describe('GetMarketCalendarUseCase', () => {
  it('repassa o usuário do token e a janela pedida', async () => {
    const reader = createFakeMarketCalendarReader({})
    await new GetMarketCalendarUseCase(reader).execute({
      userId: 'u-1',
      from: '2026-01-05',
      to: '2026-01-11',
    })
    expect(reader.getCalendarCalls).toEqual([
      { userId: 'u-1', query: { from: '2026-01-05', to: '2026-01-11' } },
    ])
  })

  it('repassa o escopo e o limite de mercado', async () => {
    const reader = createFakeMarketCalendarReader({})
    await new GetMarketCalendarUseCase(reader).execute({
      userId: 'u-1',
      scope: 'mine',
      marketLimit: 0,
    })
    expect(reader.getCalendarCalls).toEqual([
      {
        userId: 'u-1',
        query: { from: undefined, to: undefined, scope: 'mine', market_limit: 0 },
      },
    ])
  })

  it('propaga erro do motor', async () => {
    const reader = createFakeMarketCalendarReader({})
    reader.errorToThrow = new Error('boom')
    await expect(new GetMarketCalendarUseCase(reader).execute({ userId: 'u-1' })).rejects.toThrow(
      'boom',
    )
  })
})

describe('GetMarketCalendarUseCase com assembleias', () => {
  const now = new Date('2026-10-10T12:00:00Z')
  const calendar = {
    from_day: 99,
    to_day: 101,
    market_total: 0,
    market_shown: 0,
    days: [99, 100, 101].map((d) => ({
      simulated_day: d,
      date: `d${d}`,
      weekday: 'mon',
      market_open: true,
      summary: { mine_count: 0, market_count: 0 },
      events: [],
    })),
  }
  const clock = {
    simulated_day: 100,
    date: 'd100',
    weekday: 'mon',
    market_open: true,
    days_until_open: 0,
    days_per_real_day: 1,
    next_tick_at: null,
    quarter_day: 1,
    quarter_length: 91,
  }
  const source = {
    listBetween: async () => [
      { milestone: 'assembly_open' as const, at: now, title: 'Acme: Pauta' },
    ],
  }

  it('inclui os marcos das assembleias no dia correto', async () => {
    const reader = createFakeMarketCalendarReader({ calendar, clock })
    const result = await new GetMarketCalendarUseCase(reader, source, () => now).execute({
      userId: 'u-1',
    })
    expect(result.days[1].events).toMatchObject([{ kind: 'assembly_open', title: 'Acme: Pauta' }])
  })

  it('no recorte "só o meu" não inclui assembleias', async () => {
    const reader = createFakeMarketCalendarReader({ calendar, clock })
    const result = await new GetMarketCalendarUseCase(reader, source, () => now).execute({
      userId: 'u-1',
      scope: 'mine',
    })
    expect(result.days.every((d) => d.events.length === 0)).toBe(true)
  })

  it('o calendário nunca cai por causa das assembleias', async () => {
    const reader = createFakeMarketCalendarReader({ calendar, clock })
    const failing = { listBetween: async () => Promise.reject(new Error('banco fora')) }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const result = await new GetMarketCalendarUseCase(reader, failing, () => now).execute({
      userId: 'u-1',
    })
    expect(result).toEqual(calendar)
    spy.mockRestore()
  })

  it('sem fonte (assembleias desligadas) o calendário é o do motor e o relógio nem é consultado', async () => {
    const reader = createFakeMarketCalendarReader({ calendar, clock })
    const result = await new GetMarketCalendarUseCase(reader).execute({ userId: 'u-1' })
    expect(result).toBe(calendar)
  })
})
