// Espelha `.docs/engine/fixedincome.md` (tarefas 3.13/4.11) — payload e
// resposta em snake_case, sem tradução. `user_id` nunca vem do cliente:
// quem injeta é o caso de uso, a partir de `req.auth.userId` (tarefa
// 6.0.3), nunca do corpo repassado pelo router.
export interface PurchaseFixedIncomeInput {
  user_id: string
  asset_id: string
  amount: number
}

export interface PurchaseFixedIncomeResult {
  unit_price: number
  quantity_purchased: number
  position: { quantity: number; average_price: number; average_rate: number }
}

export interface RedeemFixedIncomeInput {
  user_id: string
  asset_id: string
}

export interface RedeemFixedIncomeResult {
  total_value: number
  mark_to_market: {
    mark_to_market_price: number
    realized_return_pct: number
    vs_contracted_rate: number
  }
}

// Executa compra/resgate de renda fixa no motor de simulação —
// fixed_income_positions/market_events vivem no banco "market", dono é o
// motor (precificação por deságio, marcação a mercado, Event Sourcing).
export interface FixedIncomeExecutor {
  purchase(input: PurchaseFixedIncomeInput): Promise<PurchaseFixedIncomeResult>
  redeem(input: RedeemFixedIncomeInput): Promise<RedeemFixedIncomeResult>
}
