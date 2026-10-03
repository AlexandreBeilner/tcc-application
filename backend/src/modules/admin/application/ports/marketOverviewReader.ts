// Espelha GET /admin/overview do motor (tarefa N.5) — mesmos nomes de campo
// (snake_case), sem tradução, mesma convenção de SchedulerAdmin.
export interface MarketOverview {
  simulated_day: number
  selic_rate: number
  ipca_monthly: number | null
  ipca_accumulated_12m: number | null
  pending_macro_events: number
  uncovered_assets: number
  tradable_assets: number
  active_bots: number
  total_bots: number
  day_trades: number
  day_volume: number
  resting_orders: number
}

// O recorte do mercado vive no banco "market", dono é o motor.
export interface MarketOverviewReader {
  get(): Promise<MarketOverview>
}
