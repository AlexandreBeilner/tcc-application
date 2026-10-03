// Espelha GET/POST/PATCH /admin/bots do motor (tarefa N.1) — mesmos nomes de campo
// (snake_case), sem tradução.
export type BotArchetype = 'ruido' | 'market_maker' | 'chartista' | 'fundamentalista'

export interface AssetRef {
  asset_id: string
  ticker: string
}

export interface BotHolding extends AssetRef {
  quantity: number
  average_price: number
}

export interface AdminBot {
  account_id: string
  archetype: BotArchetype
  is_active: boolean
  cash: number
  scope: {
    sectors: string[]
    risk_classes: string[]
    asset_classes: string[]
    within_scope_pct: number
  }
  knowledge_level: number | null
  risk_profile: {
    max_position_size_pct: number
    market_order_preference: number
    spread_width_pct: number
  }
  // Só o Market Maker tem teto e cobertura.
  max_covered_assets: number | null
  covered_assets: AssetRef[]
  holdings: BotHolding[]
}

export interface AdminBotListing {
  bots: AdminBot[]
  uncovered_assets: AssetRef[]
}

export interface CreateBotInput {
  archetype: BotArchetype
  sectors: string[]
  riskClasses: string[]
  assetClasses: string[]
  withinScopePct: number
  knowledgeLevel?: number
  maxPositionSizePct: number
  marketOrderPreference: number
  spreadWidthPct: number
  maxCoveredAssets?: number
  initialCash: number
}

export interface UpdateBotInput {
  isActive?: boolean
  maxCoveredAssets?: number
  // Conjunto final de ativos do Market Maker (substitui o atual).
  coveredAssetIds?: string[]
}

// Gestão de bots no motor: personalidade, cobertura e interruptor vivem no banco
// "market", dono é o motor.
export interface BotAdmin {
  list(): Promise<AdminBotListing>
  create(input: CreateBotInput): Promise<AdminBot>
  update(botId: string, input: UpdateBotInput): Promise<AdminBot>
}
