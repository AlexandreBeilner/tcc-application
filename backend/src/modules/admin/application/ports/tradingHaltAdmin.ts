// Espelha GET/POST /admin/halts do motor (tarefa N.9) — mesmos nomes de campo
// (snake_case), sem tradução.
export type HaltScope = 'global' | 'asset'

export interface TradingHalt {
  id: string
  scope: HaltScope
  asset_id: string | null
  ticker: string | null
  reason: string
  created_by: string
  created_at: string
  lifted_at: string | null
  lifted_by: string | null
}

export interface TradingHaltListing {
  active: TradingHalt[]
  recent: TradingHalt[]
}

export interface PauseTradingInput {
  scope: HaltScope
  assetId?: string
  reason: string
}

// Pausa de negociação no motor: a tabela e a regra (global vence, uma vigente por
// escopo) vivem no banco "market", dono é o motor. `adminId` vai pro motor gravar
// quem pausou e quem retomou.
export interface TradingHaltAdmin {
  list(): Promise<TradingHaltListing>
  pause(input: PauseTradingInput, adminId: string): Promise<TradingHalt>
  lift(haltId: string, adminId: string): Promise<TradingHalt>
}
