import type {
  PauseTradingInput,
  TradingHalt,
  TradingHaltAdmin,
} from '../../application/ports/tradingHaltAdmin'

export interface FakeTradingHaltAdmin extends TradingHaltAdmin {
  calls: string[]
  paused: Array<{ input: PauseTradingInput; adminId: string }>
  lifted: Array<{ haltId: string; adminId: string }>
  errorToThrow?: Error
}

export const sampleHalt: TradingHalt = {
  id: '9d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a99',
  scope: 'global',
  asset_id: null,
  ticker: null,
  reason: 'manutenção',
  created_by: 'admin-1',
  created_at: '2026-10-03T12:00:00Z',
  lifted_at: null,
  lifted_by: null,
}

export function createFakeTradingHaltAdmin(): FakeTradingHaltAdmin {
  const fake: FakeTradingHaltAdmin = {
    calls: [],
    paused: [],
    lifted: [],
    errorToThrow: undefined,
    async list() {
      fake.calls.push('list')
      if (fake.errorToThrow) throw fake.errorToThrow
      return { active: [sampleHalt], recent: [] }
    },
    async pause(input, adminId) {
      fake.calls.push('pause')
      fake.paused.push({ input, adminId })
      if (fake.errorToThrow) throw fake.errorToThrow
      return {
        ...sampleHalt,
        scope: input.scope,
        asset_id: input.assetId ?? null,
        reason: input.reason,
      }
    },
    async lift(haltId, adminId) {
      fake.calls.push('lift')
      fake.lifted.push({ haltId, adminId })
      if (fake.errorToThrow) throw fake.errorToThrow
      return { ...sampleHalt, id: haltId, lifted_at: '2026-10-03T13:00:00Z', lifted_by: adminId }
    },
  }
  return fake
}
