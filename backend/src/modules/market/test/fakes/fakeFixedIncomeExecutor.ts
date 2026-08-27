import type {
  FixedIncomeExecutor,
  PurchaseFixedIncomeInput,
  PurchaseFixedIncomeResult,
  RedeemFixedIncomeInput,
  RedeemFixedIncomeResult,
  SimulateFixedIncomeInput,
  SimulateFixedIncomeResult,
} from '../../application/ports/fixedIncomeExecutor'

export interface FakeFixedIncomeExecutor extends FixedIncomeExecutor {
  purchaseCalls: PurchaseFixedIncomeInput[]
  redeemCalls: RedeemFixedIncomeInput[]
  simulateCalls: SimulateFixedIncomeInput[]
  errorToThrow?: Error
}

export function createFakeFixedIncomeExecutor(results: {
  purchase?: PurchaseFixedIncomeResult
  redeem?: RedeemFixedIncomeResult
  simulate?: SimulateFixedIncomeResult
}): FakeFixedIncomeExecutor {
  const fake: FakeFixedIncomeExecutor = {
    purchaseCalls: [],
    redeemCalls: [],
    simulateCalls: [],
    errorToThrow: undefined,
    async purchase(input) {
      fake.purchaseCalls.push(input)
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.purchase as PurchaseFixedIncomeResult
    },
    async redeem(input) {
      fake.redeemCalls.push(input)
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.redeem as RedeemFixedIncomeResult
    },
    async simulate(input) {
      fake.simulateCalls.push(input)
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.simulate as SimulateFixedIncomeResult
    },
  }
  return fake
}
