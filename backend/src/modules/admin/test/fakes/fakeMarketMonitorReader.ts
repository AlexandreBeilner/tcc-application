import { AdminAssetNotFoundError } from '../../domain/errors'
import type {
  MarketMonitorReader,
  MonitorAsset,
  MonitorAssetDetail,
} from '../../application/ports/marketMonitorReader'

export const sampleMonitorAsset: MonitorAsset = {
  asset_id: '11111111-1111-4111-8111-111111111111',
  ticker: 'ACME3',
  name: 'Acme ON',
  type: 'acao',
  sector: 'Energia',
  last_price: 22,
  daily_change_pct: 10,
  best_bid: 21.8,
  best_ask: 22.2,
  spread_pct: 1.8,
  resting_orders: 3,
  bot_resting_orders: 2,
  day_trades: 1,
  day_volume: 10,
  outstanding_shares: 1000,
  held_by_bots: 300,
  held_by_users: 40,
  covered: true,
  indicator: { kind: 'price_to_earnings', value: 11 },
}

export const sampleMonitorDetail: MonitorAssetDetail = {
  ...sampleMonitorAsset,
  bids: [{ price: 21.8, quantity: 100, bot_quantity: 80 }],
  asks: [{ price: 22.2, quantity: 100, bot_quantity: 100 }],
  trades: [{ simulated_day: 7, price: 22, quantity: 10, buyer_is_bot: false }],
  quotes: [{ simulated_day: 7, price: 22 }],
  nav_history: [],
}

export interface FakeMarketMonitorReader extends MarketMonitorReader {
  errorToThrow?: Error
  askedIds: string[]
}

export function createFakeMarketMonitorReader(): FakeMarketMonitorReader {
  const fake: FakeMarketMonitorReader = {
    errorToThrow: undefined,
    askedIds: [],
    async listAssets() {
      if (fake.errorToThrow) throw fake.errorToThrow
      return [sampleMonitorAsset]
    },
    async getAsset(assetId) {
      fake.askedIds.push(assetId)
      if (fake.errorToThrow) throw fake.errorToThrow
      if (assetId !== sampleMonitorAsset.asset_id) {
        throw new AdminAssetNotFoundError('ativo não encontrado')
      }
      return sampleMonitorDetail
    },
  }
  return fake
}
