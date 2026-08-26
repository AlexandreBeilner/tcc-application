import type {
  FixedIncomeExecutor,
  PurchaseFixedIncomeInput,
  PurchaseFixedIncomeResult,
  RedeemFixedIncomeInput,
  RedeemFixedIncomeResult,
} from '../../application/ports/fixedIncomeExecutor'

export interface FakeFixedIncomeExecutor extends FixedIncomeExecutor {
  purchaseCalls: PurchaseFixedIncomeInput[]
  redeemCalls: RedeemFixedIncomeInput[]
  errorToThrow?: Error
}

export function createFakeFixedIncomeExecutor(results: {
  purchase?: PurchaseFixedIncomeResult
  redeem?: RedeemFixedIncomeResult
}): FakeFixedIncomeExecutor {
  const fake: FakeFixedIncomeExecutor = {
    purchaseCalls: [],
    redeemCalls: [],
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
  }
  return fake
}
