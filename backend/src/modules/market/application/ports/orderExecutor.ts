// Espelha `.docs/engine/orders.md` (tarefas 3.2/3.12/4.11) — payload e
// resposta em snake_case, sem tradução. `user_id` nunca vem do cliente:
// quem injeta é o caso de uso, a partir de `req.auth.userId` (tarefa
// 6.0.3), nunca do corpo repassado pelo router.
export interface PlaceOrderInput {
  user_id: string
  asset_id: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit'
  price?: number
  quantity: number
}

export interface OrderFill {
  price: number
  quantity: number
  synthetic: boolean
}

export interface OrderResult {
  filled_quantity: number
  remaining_quantity: number
  fills: OrderFill[]
}

// Executa uma ordem de renda variável no motor de simulação —
// orderbook/positions/market_events vivem no banco "market", dono é o
// motor (matching, liquidez sintética, Event Sourcing).
export interface OrderExecutor {
  submit(input: PlaceOrderInput): Promise<OrderResult>
}
