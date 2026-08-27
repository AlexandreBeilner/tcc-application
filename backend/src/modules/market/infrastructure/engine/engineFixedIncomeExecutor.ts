import type {
  FixedIncomeExecutor,
  PurchaseFixedIncomeInput,
  PurchaseFixedIncomeResult,
  RedeemFixedIncomeInput,
  RedeemFixedIncomeResult,
  SimulateFixedIncomeInput,
  SimulateFixedIncomeResult,
} from '../../application/ports/fixedIncomeExecutor'
import { engineFetch } from './engineHttp'

export function createEngineFixedIncomeExecutor(engineUrl: string): FixedIncomeExecutor {
  return {
    purchase(input: PurchaseFixedIncomeInput) {
      return engineFetch<PurchaseFixedIncomeResult>(`${engineUrl}/fixed-income/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    },

    redeem(input: RedeemFixedIncomeInput) {
      return engineFetch<RedeemFixedIncomeResult>(`${engineUrl}/fixed-income/redemptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    },

    simulate(input: SimulateFixedIncomeInput) {
      const qs = new URLSearchParams({
        asset_id: input.asset_id,
        amount: String(input.amount),
        days_held: String(input.days_held),
      })
      return engineFetch<SimulateFixedIncomeResult>(
        `${engineUrl}/fixed-income/simulate?${qs.toString()}`,
      )
    },
  }
}
