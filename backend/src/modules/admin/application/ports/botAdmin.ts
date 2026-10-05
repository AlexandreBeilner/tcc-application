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
  // Personalidade (N.15): campo ausente não muda; cada lista enviada substitui a atual. A
  // preferência por ordem a mercado não é editável (achado 001).
  sectors?: string[]
  riskClasses?: string[]
  assetClasses?: string[]
  withinScopePct?: number
  knowledgeLevel?: number
  maxPositionSizePct?: number
  spreadWidthPct?: number
}

// Aporte de caixa e/ou posição (N.15). Nunca remove nada do bot.
export interface FundBotInput {
  cash?: number
  holdings?: Array<{ assetId: string; quantity: number }>
}

// Espelha GET /admin/bots/{id}/activity do motor (tarefa N.14).
export interface BotQuote {
  asset_id: string
  ticker: string
  best_bid: number | null
  best_ask: number | null
  spread_pct: number | null
  held_quantity: number
  target_quantity: number
  inventory_pct: number | null
}

export interface BotActivity {
  account_id: string
  archetype: BotArchetype
  is_active: boolean
  from_day: number
  to_day: number
  period_days: number
  cash: number
  holdings_value: number
  net_worth: number
  capital_contributed: number
  pnl: number
  pnl_pct: number | null
  orders: {
    sent: number
    filled: number
    partially_filled: number
    open: number
    cancelled: number
    cancelled_by_reason: Record<string, number>
    fill_rate_pct: number | null
  }
  trades: number
  volume: number
  last_order_at: string | null
  last_order_day: number | null
  quotes: BotQuote[]
}

// Espelha GET /admin/bots/summary do motor (tarefa N.14).
export interface BotsSummary {
  simulated_day: number
  idle_days: number
  active_bots: number
  idle_bots: Array<{ account_id: string; archetype: BotArchetype; last_order_day: number | null }>
  low_cash_bots: Array<{
    account_id: string
    archetype: BotArchetype
    cash: number
    capital: number
  }>
  empty_inventory: Array<{ account_id: string; asset_id: string; ticker: string }>
  liquidity: Array<{
    asset_id: string
    ticker: string
    resting_by_provider: Record<string, number>
  }>
  float_concentration: Array<{
    asset_id: string
    ticker: string
    top_bot_id: string
    top_bot_archetype: BotArchetype
    top_bot_pct: number
    all_bots_pct: number
    outstanding_shares: number
  }>
}

// Gestão de bots no motor: personalidade, cobertura e interruptor vivem no banco
// "market", dono é o motor.
export interface BotAdmin {
  list(): Promise<AdminBotListing>
  create(input: CreateBotInput): Promise<AdminBot>
  update(botId: string, input: UpdateBotInput): Promise<AdminBot>
  fund(botId: string, input: FundBotInput): Promise<AdminBot>
  // `days` e `idleDays` ausentes usam o padrão do motor.
  activity(botId: string, days?: number): Promise<BotActivity>
  summary(idleDays?: number): Promise<BotsSummary>
}
