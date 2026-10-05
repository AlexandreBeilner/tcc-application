import type {
  MarketOverview,
  MarketOverviewReader,
} from '../../application/ports/marketOverviewReader'

export const sampleMarketOverview: MarketOverview = {
  simulated_day: 120,
  selic_rate: 10.75,
  ipca_monthly: 0.42,
  ipca_accumulated_12m: 4.8,
  pending_macro_events: 1,
  uncovered_assets: 0,
  tradable_assets: 5,
  active_bots: 3,
  total_bots: 4,
  day_trades: 9,
  day_volume: 1234.5,
  resting_orders: 17,
}

export interface FakeMarketOverviewReader extends MarketOverviewReader {
  errorToThrow?: Error
  calls: number
}

export function createFakeMarketOverviewReader(
  overview: MarketOverview = sampleMarketOverview,
): FakeMarketOverviewReader {
  const fake: FakeMarketOverviewReader = {
    errorToThrow: undefined,
    calls: 0,
    async get() {
      fake.calls += 1
      if (fake.errorToThrow) throw fake.errorToThrow
      return overview
    },
  }
  return fake
}
