// Espelha `.docs/engine/account.md` (tarefa 4.7) campo a campo, em
// snake_case — `listAccountEvents`/posições são consumidos crus pelo
// router (proxy) e só `getMyAccount.ts` (agregação) traduz pra camelCase.
export interface AccountBalance {
  user_id: string
  current_balance: number
  total_invested: number
  total_dividends_received: number
}

interface BasePositionRecord {
  asset_id: string
  ticker: string
  name: string
  type: string
  is_sandbox: boolean
  quantity: number
  average_price: number
}

// dividends_received (tarefa S.15) só existe em GET /positions (renda
// variável) — GET /fixed-income/positions não paga dividend_payment, por
// isso FixedIncomePositionRecord não herda de PositionRecord.
export interface PositionRecord extends BasePositionRecord {
  dividends_received: number
}

export interface FixedIncomePositionRecord extends BasePositionRecord {
  average_rate: number
  // Só com `valuation: true` e fora do sandbox (MO.8.1): valor BRUTO de hoje e líquido de IR (o que
  // o resgate creditaria). Ausentes quando a avaliação dessa posição falhou no motor.
  current_value?: number
  net_value?: number
}

export interface ListFixedIncomePositionsOptions {
  valuation?: boolean
}

export interface AccountEventRecord {
  id: string
  event_type: string
  asset_id?: string
  quantity?: number
  unit_value?: number
  timestamp: string
}

export interface ListAccountEventsQuery {
  limit?: number
  offset?: number
}

// Lê o estado de conta do usuário no motor de simulação — accounts/
// positions/market_events vivem no banco "market", dono é o motor.
// Nenhum método aceita listar todos os usuários — sempre um `userId`
// explícito (mesma garantia de `.docs/engine/account.md`: quem decide
// quem pode pedir o quê é o backend, não o motor).
export interface AccountReader {
  getAccount(userId: string): Promise<AccountBalance>
  listPositions(userId: string): Promise<PositionRecord[]>
  listFixedIncomePositions(
    userId: string,
    options?: ListFixedIncomePositionsOptions,
  ): Promise<FixedIncomePositionRecord[]>
  listAccountEvents(userId: string, query: ListAccountEventsQuery): Promise<AccountEventRecord[]>
}
