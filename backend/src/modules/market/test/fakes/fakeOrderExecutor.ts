import type {
  OrderExecutor,
  OrderResult,
  PlaceOrderInput,
} from '../../application/ports/orderExecutor'

export interface FakeOrderExecutor extends OrderExecutor {
  calls: PlaceOrderInput[]
  cancelCalls: { orderId: string; userId: string }[]
  errorToThrow?: Error
}

export function createFakeOrderExecutor(result: OrderResult): FakeOrderExecutor {
  const calls: PlaceOrderInput[] = []
  const cancelCalls: { orderId: string; userId: string }[] = []
  const fake: FakeOrderExecutor = {
    calls,
    cancelCalls,
    errorToThrow: undefined,
    async submit(input) {
      calls.push(input)
      if (fake.errorToThrow) throw fake.errorToThrow
      return result
    },
    async cancel(orderId, userId) {
      cancelCalls.push({ orderId, userId })
      if (fake.errorToThrow) throw fake.errorToThrow
    },
  }
  return fake
}
