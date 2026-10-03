import type {
  AdminBot,
  BotActivity,
  BotAdmin,
  BotsSummary,
  CreateBotInput,
  FundBotInput,
  UpdateBotInput,
} from '../../application/ports/botAdmin'

export interface FakeBotAdmin extends BotAdmin {
  calls: string[]
  created: CreateBotInput[]
  updated: Array<{ botId: string; input: UpdateBotInput }>
  funded: Array<{ botId: string; input: FundBotInput }>
  activityAsks: Array<{ botId: string; days?: number }>
  summaryAsks: Array<number | undefined>
  errorToThrow?: Error
}

export const sampleBot: AdminBot = {
  account_id: '0d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a33',
  archetype: 'market_maker',
  is_active: true,
  cash: 80000,
  scope: {
    sectors: ['Bancário/Financeiro'],
    risk_classes: [],
    asset_classes: ['fii'],
    within_scope_pct: 0.9,
  },
  knowledge_level: null,
  risk_profile: {
    max_position_size_pct: 0.5,
    market_order_preference: 0.5,
    spread_width_pct: 0.02,
  },
  max_covered_assets: 10,
  covered_assets: [{ asset_id: 'asset-1', ticker: 'AAA3' }],
  holdings: [{ asset_id: 'asset-1', ticker: 'AAA3', quantity: 40, average_price: 12.5 }],
}

export const sampleActivity: BotActivity = {
  account_id: sampleBot.account_id,
  archetype: 'market_maker',
  is_active: true,
  from_day: 1,
  to_day: 30,
  period_days: 30,
  cash: 600,
  holdings_value: 500,
  net_worth: 1100,
  capital_contributed: 1000,
  pnl: 100,
  pnl_pct: 10,
  orders: {
    sent: 4,
    filled: 1,
    partially_filled: 0,
    open: 2,
    cancelled: 1,
    cancelled_by_reason: { requoted: 1 },
    fill_rate_pct: 25,
  },
  trades: 1,
  volume: 500,
  last_order_at: '2026-10-03T12:00:00Z',
  last_order_day: 30,
  quotes: [],
}

export const sampleSummary: BotsSummary = {
  simulated_day: 30,
  idle_days: 3,
  active_bots: 5,
  idle_bots: [{ account_id: sampleBot.account_id, archetype: 'ruido', last_order_day: null }],
  low_cash_bots: [],
  empty_inventory: [],
  liquidity: [],
  float_concentration: [],
}

export function createFakeBotAdmin(): FakeBotAdmin {
  const fake: FakeBotAdmin = {
    calls: [],
    created: [],
    updated: [],
    funded: [],
    activityAsks: [],
    summaryAsks: [],
    errorToThrow: undefined,
    async list() {
      fake.calls.push('list')
      if (fake.errorToThrow) throw fake.errorToThrow
      return { bots: [sampleBot], uncovered_assets: [{ asset_id: 'asset-2', ticker: 'BBB3' }] }
    },
    async create(input) {
      fake.calls.push('create')
      fake.created.push(input)
      if (fake.errorToThrow) throw fake.errorToThrow
      return { ...sampleBot, archetype: input.archetype, cash: input.initialCash }
    },
    async update(botId, input) {
      fake.calls.push('update')
      fake.updated.push({ botId, input })
      if (fake.errorToThrow) throw fake.errorToThrow
      return { ...sampleBot, account_id: botId, is_active: input.isActive ?? sampleBot.is_active }
    },
    async fund(botId, input) {
      fake.calls.push('fund')
      fake.funded.push({ botId, input })
      if (fake.errorToThrow) throw fake.errorToThrow
      return { ...sampleBot, account_id: botId, cash: sampleBot.cash + (input.cash ?? 0) }
    },
    async activity(botId, days) {
      fake.calls.push('activity')
      fake.activityAsks.push({ botId, days })
      if (fake.errorToThrow) throw fake.errorToThrow
      return { ...sampleActivity, account_id: botId }
    },
    async summary(idleDays) {
      fake.calls.push('summary')
      fake.summaryAsks.push(idleDays)
      if (fake.errorToThrow) throw fake.errorToThrow
      return sampleSummary
    },
  }
  return fake
}
