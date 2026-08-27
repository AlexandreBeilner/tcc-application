import type {
  OrderExecutor,
  OrderResult,
  PlaceOrderInput,
} from '../../application/ports/orderExecutor'

export interface FakeOrderExecutor extends OrderExecutor {
  calls: PlaceOrderInput[]
  errorToThrow?: Error
}

export function createFakeOrderExecutor(result: OrderResult): FakeOrderExecutor {
  const calls: PlaceOrderInput[] = []
  const fake: FakeOrderExecutor = {
    calls,
    errorToThrow: undefined,
    async submit(input) {
      calls.push(input)
      if (fake.errorToThrow) throw fake.errorToThrow
      return result
    },
  }
  return fake
}
