// Espelha GET /admin/catalog e PATCH /admin/catalog/{id} do motor (tarefa N.12) — mesmos
// nomes de campo (snake_case), sem tradução.
export type CatalogEditableField =
  'name' | 'base_growth_pct' | 'quality_multiplier' | 'methodology_summary'

export interface CatalogCompany {
  company_id: string
  name: string
  sector: string
  report_frequency_days: number
  base_growth_pct: number
  quality_multiplier: number
}

export interface CatalogETF {
  benchmark_index: string
  methodology_summary: string | null
  expense_ratio_pct: number
  rebalance_frequency_days: number
  holdings: Array<{ name: string; weight_pct: number }>
  holdings_total_weight_pct: number
}

export interface CatalogFII {
  fii_type: string
  segment: string | null
  vacancy_rate: number | null
  indexador: string | null
}

export interface CatalogFixedIncome {
  interest_rate: number | null
  maturity_date: string | null
  issuer_type: string
  tax_exempt: boolean
  credit_risk_rating: string | null
  minimum_investment: number
}

export interface CatalogAsset {
  asset_id: string
  ticker: string
  name: string
  type: string
  risk_class: string | null
  is_sandbox: boolean
  share_class: string | null
  outstanding_shares: number | null
  editable: CatalogEditableField[]
  company: CatalogCompany | null
  etf: CatalogETF | null
  fii: CatalogFII | null
  fixed_income: CatalogFixedIncome | null
}

// Alteração parcial: só os campos presentes mudam.
export interface CatalogPatch {
  name?: string
  base_growth_pct?: number
  quality_multiplier?: number
  methodology_summary?: string
}

// Catálogo de ativos no banco "market" (dono é o motor). A lista de campos editáveis e a
// validação de cada um são do domínio do motor; `adminId` vai pra ele registrar quem pediu.
export interface CatalogAdmin {
  list(): Promise<CatalogAsset[]>
  update(assetId: string, patch: CatalogPatch, adminId: string): Promise<CatalogAsset>
}
