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
  // net_value/tax_rate (tarefa 6.0.5) — líquido de IR regressivo sobre o
  // ganho desde a aplicação; net_value = total_value sempre que o ativo é
  // isento ou não houve lucro no resgate.
  net_value: number
  tax_rate: number
  mark_to_market: {
    mark_to_market_price: number
    realized_return_pct: number
    vs_contracted_rate: number
  }
}

// SimulateFixedIncomeInput/Result (tarefa 6.0.5) — sem user_id: a
// simulação não depende de conta nem posição do usuário, só do catálogo
// (asset_id) e dos parâmetros hipotéticos de aporte.
export interface SimulateFixedIncomeInput {
  asset_id: string
  amount: number
  days_held: number
}

export interface SimulateFixedIncomeResult {
  unit_price: number
  quantity_purchased: number
  gross_projected_value: number
  tax_rate: number
  net_projected_value: number
}

// FixedIncomeTaxRateInput/Result (tarefa 6.7) — sem asset_id/amount,
// diferente de Simulate: sustenta o modo comparação da Calculadora (6.2),
// que usa produtos hipotéticos digitados pelo usuário (decisão (b) do
// backlog), não um ativo real do catálogo.
export interface FixedIncomeTaxRateInput {
  days_held: number
}

export interface FixedIncomeTaxRateResult {
  tax_rate: number
}

// Executa compra/resgate de renda fixa no motor de simulação —
// fixed_income_positions/market_events vivem no banco "market", dono é o
// motor (precificação por deságio, marcação a mercado, Event Sourcing).
// simulate (tarefa 6.0.5) nunca escreve nada — projeção pura, sem efeito
// colateral. getTaxRate (tarefa 6.7) idem, ainda mais leve (sem catálogo).
export interface FixedIncomeExecutor {
  purchase(input: PurchaseFixedIncomeInput): Promise<PurchaseFixedIncomeResult>
  redeem(input: RedeemFixedIncomeInput): Promise<RedeemFixedIncomeResult>
  simulate(input: SimulateFixedIncomeInput): Promise<SimulateFixedIncomeResult>
  getTaxRate(input: FixedIncomeTaxRateInput): Promise<FixedIncomeTaxRateResult>
}
