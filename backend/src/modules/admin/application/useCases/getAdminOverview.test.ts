import { describe, expect, it } from 'vitest'
import {
  createFakeMarketOverviewReader,
  sampleMarketOverview,
} from '../../test/fakes/fakeMarketOverviewReader'
import { createFakeSchedulerAdmin, sampleStatus } from '../../test/fakes/fakeSchedulerAdmin'
import { createFakeUserStatsReader, sampleUserStats } from '../../test/fakes/fakeUserStatsReader'
import { GetAdminOverviewUseCase } from './getAdminOverview'

const tick = {
  simulated_day: 120,
  trigger: 'scheduled' as const,
  status: 'success' as const,
  error_message: null,
  started_at: '2026-10-03T12:00:00Z',
  duration_ms: 900,
  catch_up_discarded: 0,
  selic_rate: 10.75,
  is_copom_day: false,
  is_report_day: false,
  quotes_count: 5,
  fundamentals_count: 0,
  dividends_generated_count: 0,
  dividends_paid_count: 0,
  bot_fills_count: 4,
  expired_orders_count: 0,
  uncovered_assets_count: 0,
  intraday_rounds_count: 2,
}

function build() {
  const market = createFakeMarketOverviewReader()
  const scheduler = createFakeSchedulerAdmin({ ticks: [tick], total_entries: 1 })
  const users = createFakeUserStatsReader()
  const now = new Date('2026-10-03T12:00:00Z')
  return {
    market,
    scheduler,
    users,
    now,
    useCase: new GetAdminOverviewUseCase(market, scheduler, users, () => now),
  }
}

describe('GetAdminOverviewUseCase', () => {
  it('junta mercado, agenda, último tick e usuários', async () => {
    const { useCase, users, now } = build()
    const overview = await useCase.execute()

    expect(overview).toEqual({
      market: sampleMarketOverview,
      scheduler: sampleStatus,
      last_tick: tick,
      users: sampleUserStats,
      errors: {},
    })
    expect(users.lastNow).toEqual(now)
  })

  it('pede só o último tick ao histórico', async () => {
    const { useCase, scheduler } = build()
    await useCase.execute()
    expect(scheduler.listQueries).toEqual([{ limit: 1 }])
  })

  it('uma fonte fora vira null com o motivo e as outras seguem', async () => {
    const { useCase, market } = build()
    market.errorToThrow = new Error('motor fora')

    const overview = await useCase.execute()

    expect(overview.market).toBeNull()
    expect(overview.errors).toEqual({ market: 'motor fora' })
    expect(overview.scheduler).toEqual(sampleStatus)
    expect(overview.users).toEqual(sampleUserStats)
  })

  it('sem nenhum tick gravado, last_tick é null sem erro', async () => {
    const market = createFakeMarketOverviewReader()
    const scheduler = createFakeSchedulerAdmin({ ticks: [], total_entries: 0 })
    const overview = await new GetAdminOverviewUseCase(
      market,
      scheduler,
      createFakeUserStatsReader(),
    ).execute()
    expect(overview.last_tick).toBeNull()
    expect(overview.errors).toEqual({})
  })
})
