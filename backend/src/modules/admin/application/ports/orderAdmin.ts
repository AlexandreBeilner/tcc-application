// Espelha GET /admin/orders do motor (tarefa N.10) — mesmos nomes de campo
// (snake_case), sem tradução.
export interface AdminOrder {
  order_id: string
  asset_id: string
  ticker: string
  user_id: string
  is_bot: boolean
  bot_archetype: string | null
  side: 'buy' | 'sell'
  type: 'market' | 'limit'
  quantity: number
  filled_quantity: number
  price: number
  status: 'pending' | 'partially_filled' | 'filled' | 'cancelled'
  cancel_reason: string | null
  simulated_day: number
  created_at: string
}

export interface ListAdminOrdersQuery {
  user_id?: string
  asset_id?: string
  side?: 'buy' | 'sell'
  // 'open' = pending + partially_filled.
  status?: 'open' | 'pending' | 'partially_filled' | 'filled' | 'cancelled'
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export interface ListAdminOrdersResult {
  orders: AdminOrder[]
  total: number
}

// Filtro do cancelamento em lote: pelo menos um dos dois (validado na borda).
export interface CancelBatchFilter {
  assetId?: string
  userId?: string
}

export interface CancelBatchResult {
  cancelled_count: number
  cancelled_ids: string[]
}

// Consulta e cancelamento por intervenção de ordens no motor (N.10): o book e as
// regras de cancelamento vivem no banco "market", dono é o motor.
export interface OrderAdmin {
  list(query: ListAdminOrdersQuery): Promise<ListAdminOrdersResult>
  cancel(orderId: string): Promise<void>
  cancelBatch(filter: CancelBatchFilter): Promise<CancelBatchResult>
}
