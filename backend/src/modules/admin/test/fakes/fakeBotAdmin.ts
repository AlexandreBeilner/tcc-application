import type {
  AdminBot,
  BotAdmin,
  CreateBotInput,
  UpdateBotInput,
} from '../../application/ports/botAdmin'

export interface FakeBotAdmin extends BotAdmin {
  calls: string[]
  created: CreateBotInput[]
  updated: Array<{ botId: string; input: UpdateBotInput }>
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

export function createFakeBotAdmin(): FakeBotAdmin {
  const fake: FakeBotAdmin = {
    calls: [],
    created: [],
    updated: [],
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
  }
  return fake
}
