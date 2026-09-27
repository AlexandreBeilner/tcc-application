import { describe, expect, it } from 'vitest'
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

  it('propaga erro do motor', async () => {
    const reader = createFakeMarketCalendarReader({})
    reader.errorToThrow = new Error('boom')
    await expect(new GetMarketCalendarUseCase(reader).execute({ userId: 'u-1' })).rejects.toThrow(
      'boom',
    )
  })
})
