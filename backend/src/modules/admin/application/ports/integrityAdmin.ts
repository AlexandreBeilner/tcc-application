// Espelha `/admin/integrity/check` do motor (tarefa N.21) — mesmos nomes de campo (snake_case).
export type IntegrityKind =
  | 'balance_mismatch'
  | 'position_mismatch'
  | 'negative_balance'
  | 'negative_position'
  | 'float_mismatch'
  | 'resting_order_unfunded'
  | 'unknown_event_type'

export interface IntegrityDivergence {
  kind: IntegrityKind
  user_id: string | null
  asset_id: string | null
  ticker: string | null
  order_id: string | null
  expected: string
  found: string
  detail: string
}

export interface IntegrityReport {
  checked: {
    events: number
    accounts: number
    positions: number
    assets: number
    resting_orders: number
  }
  total: number
  counts: Record<IntegrityKind, number>
  truncated: boolean
  divergences: IntegrityDivergence[]
}

export interface IntegrityRun {
  id: string
  status: 'running' | 'done' | 'failed'
  started_at: string
  finished_at: string | null
  error: string | null
  report: IntegrityReport | null
}

// Verificação de integridade no motor: o replay dos eventos e a comparação vivem lá (somente
// leitura, em segundo plano, uma por vez).
export interface IntegrityAdmin {
  start(): Promise<IntegrityRun>
  latest(): Promise<IntegrityRun | null>
}
