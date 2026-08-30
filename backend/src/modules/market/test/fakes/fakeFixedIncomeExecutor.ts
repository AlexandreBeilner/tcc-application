import type {
  FixedIncomeExecutor,
  FixedIncomeTaxRateInput,
  FixedIncomeTaxRateResult,
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
  getTaxRateCalls: FixedIncomeTaxRateInput[]
  errorToThrow?: Error
}

export function createFakeFixedIncomeExecutor(results: {
  purchase?: PurchaseFixedIncomeResult
  redeem?: RedeemFixedIncomeResult
  simulate?: SimulateFixedIncomeResult
  getTaxRate?: FixedIncomeTaxRateResult
}): FakeFixedIncomeExecutor {
  const fake: FakeFixedIncomeExecutor = {
    purchaseCalls: [],
    redeemCalls: [],
    simulateCalls: [],
    getTaxRateCalls: [],
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
    async getTaxRate(input) {
      fake.getTaxRateCalls.push(input)
      if (fake.errorToThrow) throw fake.errorToThrow
      return results.getTaxRate as FixedIncomeTaxRateResult
    },
  }
  return fake
}
