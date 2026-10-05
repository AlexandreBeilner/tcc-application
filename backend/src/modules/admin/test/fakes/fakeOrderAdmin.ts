import type {
  AdminOrder,
  CancelBatchFilter,
  CancelBatchResult,
  ListAdminOrdersQuery,
  OrderAdmin,
} from '../../application/ports/orderAdmin'

export interface FakeOrderAdmin extends OrderAdmin {
  orders: AdminOrder[]
  calls: string[]
  listQueries: ListAdminOrdersQuery[]
  batchFilters: CancelBatchFilter[]
  batchResult: CancelBatchResult
  errorToThrow?: Error
}

export const sampleAdminOrder: AdminOrder = {
  order_id: '7d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a11',
  asset_id: '0d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a22',
  ticker: 'ACME3',
  user_id: '1d0b8f1e-3c1a-4a52-9b0e-2f6f5f0d1a33',
  is_bot: false,
  bot_archetype: null,
  side: 'buy',
  type: 'limit',
  quantity: 100,
  filled_quantity: 0,
  price: 10,
  status: 'pending',
  cancel_reason: null,
  simulated_day: 7,
  created_at: '2026-10-03T12:00:00Z',
}

export function createFakeOrderAdmin(): FakeOrderAdmin {
  const fake: FakeOrderAdmin = {
    orders: [sampleAdminOrder],
    calls: [],
    listQueries: [],
    batchFilters: [],
    batchResult: { cancelled_count: 2, cancelled_ids: ['a', 'b'] },
    errorToThrow: undefined,
    async list(query) {
      fake.calls.push('list')
      fake.listQueries.push(query)
      if (fake.errorToThrow) throw fake.errorToThrow
      return { orders: fake.orders, total: fake.orders.length }
    },
    async cancel(orderId) {
      fake.calls.push(`cancel:${orderId}`)
      if (fake.errorToThrow) throw fake.errorToThrow
    },
    async cancelBatch(filter) {
      fake.calls.push('cancelBatch')
      fake.batchFilters.push(filter)
      if (fake.errorToThrow) throw fake.errorToThrow
      return fake.batchResult
    },
  }
  return fake
}
