// Espelha o payload de resposta do catálogo do motor (`.docs/engine/
// catalog.md`, tarefas 4.6/4.8/4.9/4.10) campo a campo, em snake_case, sem
// tradução — mesma convenção já usada por `modules/admin` pros eventos
// macro: este módulo é só o portão de autenticação na frente do motor, não
// dono do formato do dado.
export interface AssetSummary {
  id: string
  ticker: string
  name: string
  type: string
  risk_class?: string
  is_sandbox: boolean
  current_price?: number
  daily_change_pct?: number
}

export interface FixedIncomeDetails {
  interest_rate?: number
  maturity_date?: string
  issuer_type: string
  tax_exempt: boolean
  credit_risk_rating?: string
  minimum_investment: number
}

export interface EquityIndicators {
  price_to_earnings?: number
  price_to_book_value?: number
  earnings_per_share?: number
  book_value_per_share?: number
  roe?: number
  ebit_margin?: number
  net_margin?: number
  net_debt_to_ebit?: number
  dividend_yield?: number
}

export interface DividendEvent {
  payment_date: string
  value_per_share: number
}

export interface EquityDetails {
  company: { id: string; name: string; cnpj: string; sector: string }
  share_class?: string
  outstanding_shares?: number
  indicators?: EquityIndicators
  dividend_history: DividendEvent[]
}

export interface EtfDetails {
  benchmark_index: string
  methodology_summary?: string
  holdings: Array<{ constituent_name: string; weight_pct: number }>
}

export interface FiiDetails {
  fii_type: string
  segment?: string
  net_worth?: number
  vacancy_rate?: number
  indexador?: string
  portfolio_value?: number
  dividend_yield?: number
  dividend_history: DividendEvent[]
}

export interface AssetDetail extends AssetSummary {
  fixed_income?: FixedIncomeDetails
  equity?: EquityDetails
  etf?: EtfDetails
  fii?: FiiDetails
}

export interface QuotePoint {
  simulated_day: number
  price: number
}

export interface CompanyDetail {
  id: string
  name: string
  cnpj: string
  sector: string
  assets: Array<{ id: string; ticker: string; name: string; share_class?: string }>
  fundamentals: Array<{ period_date: string; net_revenue: number | null }>
}

// Lê o catálogo de mercado do motor de simulação — assets/companies vivem
// no banco "market", dono é o motor, nunca lidos direto por aqui.
export interface CatalogReader {
  listAssets(type?: string): Promise<AssetSummary[]>
  getAsset(id: string): Promise<AssetDetail>
  getAssetQuotes(id: string, days?: number): Promise<QuotePoint[]>
  getCompany(id: string): Promise<CompanyDetail>
}
