// Espelham GET /admin/market/assets e /admin/market/assets/{id} do motor (tarefa N.8)
// — mesmos nomes de campo (snake_case), sem tradução, mesma convenção de SchedulerAdmin.
export interface MonitorIndicator {
  kind: 'price_to_earnings' | 'nav_premium_pct' | 'price_to_book'
  value: number
}

export interface MonitorAsset {
  asset_id: string
  ticker: string
  name: string
  type: 'acao' | 'etf' | 'fii'
  sector: string | null
  last_price: number | null
  daily_change_pct: number | null
  best_bid: number | null
  best_ask: number | null
  spread_pct: number | null
  resting_orders: number
  bot_resting_orders: number
  day_trades: number
  day_volume: number
  outstanding_shares: number | null
  held_by_bots: number
  held_by_users: number
  covered: boolean
  indicator: MonitorIndicator | null
}

export interface MonitorBookLevel {
  price: number
  quantity: number
  bot_quantity: number
}

export interface MonitorTrade {
  simulated_day: number
  price: number
  quantity: number
  buyer_is_bot: boolean
}

export interface MonitorAssetDetail extends MonitorAsset {
  bids: MonitorBookLevel[]
  asks: MonitorBookLevel[]
  trades: MonitorTrade[]
  quotes: Array<{ simulated_day: number; price: number }>
  nav_history: Array<{
    simulated_day: number
    nav: number
    close_price: number
    premium_pct: number
  }>
}

// Monitor do mercado ao vivo (somente leitura): tudo vive no banco "market", dono é o motor.
export interface MarketMonitorReader {
  listAssets(): Promise<MonitorAsset[]>
  // Rejeita com AdminAssetNotFoundError quando o ativo não existe ou não é negociável.
  getAsset(assetId: string): Promise<MonitorAssetDetail>
}
