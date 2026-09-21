import type {
  EngineOrderRecord,
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
    cancel(orderId: string, userId: string) {
      return engineFetch<void>(`${engineUrl}/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
    },
    list(userId: string) {
      return engineFetch<EngineOrderRecord[]>(
        `${engineUrl}/orders?user_id=${encodeURIComponent(userId)}`,
      )
    },
  }
}
