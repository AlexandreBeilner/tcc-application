import type { OrderExecutor, OrderResult, PlaceOrderInput } from '../ports/orderExecutor'

export class PlaceOrderUseCase {
  constructor(private readonly orderExecutor: OrderExecutor) {}

  execute(input: PlaceOrderInput): Promise<OrderResult> {
    return this.orderExecutor.submit(input)
  }
}
