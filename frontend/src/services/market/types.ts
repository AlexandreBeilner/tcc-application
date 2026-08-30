// Espelha `.docs/backend/market.md` (`GET /market/me/account`) — única
// rota do módulo `market` que não é proxy 1:1, já em camelCase. Cada
// posição já vem com `type`/`isSandbox` (tarefa 6.0.3), insumo direto do
// donut de distribuição e da separação visual "Mercado Ao Vivo vs.
// Sandbox" da tela 2.1 (tarefa 6.3) — o agrupamento acontece aqui no
// frontend, a resposta não separa em dois blocos.
export interface MyAccountPosition {
    assetId: string
    ticker: string
    name: string
    type: string
    isSandbox: boolean
    quantity: number
    averagePrice: number
}

export interface MyAccountFixedIncomePosition extends MyAccountPosition {
    averageRate: number
}

export interface MyAccount {
    cashBalance: number
    totalInvested: number
    totalDividendsReceived: number
    positions: MyAccountPosition[]
    fixedIncomePositions: MyAccountFixedIncomePosition[]
}

// Os demais tipos abaixo espelham rotas proxy 1:1 (`.docs/engine/catalog.md`,
// `fixedincome.md`, `orders.md`, `account.md`) — snake_case, sem tradução,
// mesma convenção já usada pelo módulo `admin` (tarefa 6.5).
export const ASSET_TYPES = [
    'tesouro_selic',
    'tesouro_prefixado',
    'tesouro_ipca',
    'cdb',
    'lci',
    'lca',
    'cri',
    'cra',
    'acao',
    'etf',
    'fii',
] as const

export type AssetType = (typeof ASSET_TYPES)[number]

export interface AssetSummary {
    id: string
    ticker: string
    name: string
    type: AssetType
    risk_class?: string
    is_sandbox: boolean
    current_price?: number
    daily_change_pct?: number
}

export interface FixedIncomeDetail {
    interest_rate?: number
    maturity_date?: string
    issuer_type: string
    tax_exempt: boolean
    credit_risk_rating?: string
    minimum_investment: number
}

export interface EquityCompany {
    id: string
    name: string
    cnpj: string
    sector: string
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

export interface DividendHistoryEntry {
    value_per_share: number
    ex_date: string
    payment_date: string
}

export interface EquityDetail {
    company: EquityCompany
    share_class?: string
    outstanding_shares?: number
    indicators?: EquityIndicators
    dividend_history: DividendHistoryEntry[]
}

export interface EtfHolding {
    constituent_name: string
    weight_pct: number
}

export interface EtfDetail {
    benchmark_index: string
    methodology_summary?: string
    holdings: EtfHolding[]
}

export interface FiiDetail {
    fii_type: 'tijolo' | 'papel'
    segment?: string
    net_worth?: number
    vacancy_rate?: number
    indexador?: string
    portfolio_value?: number
    dividend_yield?: number
    dividend_history: DividendHistoryEntry[]
}

export interface AssetDetail extends AssetSummary {
    fixed_income?: FixedIncomeDetail
    equity?: EquityDetail
    etf?: EtfDetail
    fii?: FiiDetail
}

export interface QuoteHistoryEntry {
    simulated_day: number
    price: number
}

export interface CompanyAssetSummary {
    id: string
    ticker: string
    name: string
    share_class?: string
}

export interface CompanyFundamentalEntry {
    period_date: string
    net_revenue: number | null
}

export interface Company {
    id: string
    name: string
    cnpj: string
    sector: string
    assets: CompanyAssetSummary[]
    fundamentals: CompanyFundamentalEntry[]
}

export interface MarketEvent {
    id: string
    event_type: string
    asset_id?: string
    quantity?: number
    unit_value?: number
    timestamp: string
}

export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit'

export interface PlaceOrderInput {
    asset_id: string
    side: OrderSide
    type: OrderType
    price?: number
    quantity: number
}

export interface OrderFill {
    price: number
    quantity: number
    synthetic: boolean
}

export interface PlaceOrderResult {
    filled_quantity: number
    remaining_quantity: number
    fills: OrderFill[]
}

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

export interface PurchaseFixedIncomeInput {
    asset_id: string
    amount: number
}

export interface FixedIncomePositionSummary {
    quantity: number
    average_price: number
    average_rate: number
}

export interface PurchaseFixedIncomeResult {
    unit_price: number
    quantity_purchased: number
    position: FixedIncomePositionSummary
}

export interface RedeemFixedIncomeInput {
    asset_id: string
}

export interface MarkToMarket {
    mark_to_market_price: number
    realized_return_pct: number
    vs_contracted_rate: number
}

export interface RedeemFixedIncomeResult {
    total_value: number
    net_value: number
    tax_rate: number
    mark_to_market: MarkToMarket
}
