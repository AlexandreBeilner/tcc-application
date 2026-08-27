import type {
  OrderExecutor,
  OrderResult,
  PlaceOrderInput,
} from '../../application/ports/orderExecutor'
import { engineFetch } from './engineHttp'

export function createEngineOrderExecutor(engineUrl: string): OrderExecutor {
  return {
    submit(input: PlaceOrderInput) {
      return engineFetch<OrderResult>(`${engineUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    },
  }
}
