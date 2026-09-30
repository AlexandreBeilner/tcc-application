// Espelha `.docs/backend/market.md` (`GET /market/me/account`) — única
// rota do módulo `market` que não é proxy 1:1, já em camelCase. Cada
// posição já vem com `type`/`isSandbox` (tarefa 6.0.3), insumo direto do
// donut de distribuição e da separação visual "Mercado Ao Vivo vs.
// Sandbox" da tela 2.1 (tarefa 6.3) — o agrupamento acontece aqui no
// frontend, a resposta não separa em dois blocos.
interface BaseMyAccountPosition {
    assetId: string
    ticker: string
    name: string
    type: string
    isSandbox: boolean
    quantity: number
    averagePrice: number
}

// dividendsReceived (tarefa S.15) só existe em renda variável — renda fixa
// não gera provento (`dividend_payment`), por isso não fica na base
// compartilhada com MyAccountFixedIncomePosition.
export interface MyAccountPosition extends BaseMyAccountPosition {
    dividendsReceived: number
    // Preço de marcação a mercado (tarefa S.6) — ponto médio do book do
    // ativo, com fallback pro último negócio quando falta um dos lados.
    // Ausente pra posição sandbox (nunca teve book real).
    markPrice?: number
}

export interface MyAccountFixedIncomePosition extends BaseMyAccountPosition {
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

// Shape do 403 de `POST /market/orders`/`POST /market/fixed-income/purchases`
// (tarefa 7.0.1) — foge da convenção `{ error }` do resto do módulo,
// `.docs/backend/market.md`. `unlockingLesson` não traz `id` (só
// `code`/`title`), então um CTA construído a partir dele nunca linka direto
// pra `/trilha/:id` (tarefa J.3, `features/market/productLockedError`) —
// só o Mapa da Trilha genérico.
export interface ProductLockedErrorBody {
    error: string
    key: string
    unlockingLesson: { code: string; title: string } | null
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
    // Tarefa R.3/R.7/R.11: ausentes até a emissão inicial e o primeiro tick
    // seguinte (`nav`, `premium_pct`, `nav_day`, `shares_outstanding`) e
    // enquanto o fundo não tem índice teórico gravado (`tracking_error_pct`).
    // `premium_pct` e `tracking_error_pct` já vêm em pontos percentuais.
    nav?: number
    premium_pct?: number
    nav_day?: number
    shares_outstanding?: number
    tracking_error_pct?: number
    dividend_history: DividendHistoryEntry[]
}

export interface FiiDetail {
    fii_type: 'tijolo' | 'papel'
    segment?: string
    net_worth?: number
    vacancy_rate?: number
    indexador?: string
    portfolio_value?: number
    dividend_yield?: number
    price_to_book_value?: number
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

// `GET /market/assets/:id/book` (tarefa S.5) — proxy 1:1 do motor. Cada
// nível é a soma agregada de ordens `limit` pendentes naquele preço, do
// melhor preço pro pior (bids do maior pro menor, asks do menor pro
// maior), recortado aos 5 melhores de cada lado. Ativo do Mercado Ao Vivo:
// `bids`/`asks` vêm `null` (nunca `[]`) quando o lado está vazio;
// `mid_price` também é `null` com só um lado disponível. Ativo sandbox:
// só `price` vem preenchido (preço do roteiro), os 5 campos de book vêm
// `null` — sandbox nunca teve, nem vai ter, contraparte real (RF12/RNF08).
export interface BookLevel {
    price: number
    quantity: number
}

export interface AssetBook {
    is_sandbox: boolean
    price: number | null
    best_bid: number | null
    best_ask: number | null
    mid_price: number | null
    bids: BookLevel[] | null
    asks: BookLevel[] | null
}

// `GET /market/indicators` (tarefa M.3) — proxy 1:1 do motor
// (`GET /market/indicators/history`, `.docs/engine/tick.md`), snake_case
// sem tradução como o resto desta seção. `selic_rate` já vem em pontos
// percentuais (ex: `9.75` = 9,75% a.a., mesma convenção de
// `fixed_income.interest_rate` — `formatRatePercent`); `ipca_monthly_rate`/
// `ipca_accumulated_12m` vêm como razão 0–1 (mesma convenção de
// `roe`/`dividend_yield` — `formatPercentage`), não em pontos percentuais.
export interface IndicatorHistoryEntry {
    simulated_day: number
    selic_rate: number
    ipca_monthly_rate: number
    ipca_accumulated_12m: number
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
export type OrderStatus = 'pending' | 'partially_filled' | 'filled' | 'cancelled'
export type OrderCancelReason = 'user_cancelled' | 'expired' | 'no_liquidity' | 'requoted' | 'insufficient_funds'

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
    order_id: string
    filled_quantity: number
    remaining_quantity: number
    fills: OrderFill[]
}

// `GET /market/orders` (tarefa O.3) — proxy 1:1 de `GET /orders` do motor,
// já enriquecido com `ticker`/`name` pelo backend (`CatalogReader`,
// `.docs/backend/market.md`). `cancel_reason` só aparece (`omitempty`,
// backend) quando `status = cancelled`. Sustenta a tela "Minhas Ordens"
// (O.4) — o agrupamento em Pendentes/Executadas/Recusadas é client-side,
// não desta rota.
export interface MyOrderRecord {
    order_id: string
    asset_id: string
    ticker: string
    name: string
    side: OrderSide
    type: OrderType
    quantity: number
    filled_quantity: number
    price: number
    status: OrderStatus
    cancel_reason?: OrderCancelReason
    created_at: string
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

export interface FixedIncomeTaxRateResult {
    tax_rate: number
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

// Espelha `GET /market/clock` (`.docs/backend/market.md`, tarefa S.10), proxy 1:1
// do motor. `weekday` é o código estável (`sun`..`sat`); `next_tick_at` é
// `null` quando a agenda automática do motor está desligada.
export interface MarketClock {
    simulated_day: number
    date: string
    weekday: string
    market_open: boolean
    days_until_open: number
    days_per_real_day: number
    next_tick_at: string | null
    quarter_day: number
    quarter_length: number
}

// Linha do tempo do mercado (tarefa S.10/S.12): um item por dia da janela, dias
// sem fato vêm com `events: []`. Só os campos do tipo vêm preenchidos.
export type CalendarEventKind =
    | 'macro_event'
    | 'copom'
    | 'report'
    | 'dividend_ex_date'
    | 'dividend_payment_date'
    | 'order_executed'
    | 'dividend_received'
    | 'fixed_income_purchase'
    | 'fixed_income_redemption'
    | 'fixed_income_maturity'
    | 'salary_payment'

export interface CalendarEvent {
    kind: CalendarEventKind
    scope: 'global' | 'user'
    future: boolean
    title?: string
    direction?: string
    ticker?: string
    side?: 'buy' | 'sell'
    quantity?: number
    unit_value?: number
    selic_rate?: number
    previous_selic_rate?: number
    // reference_month ('AAAA-MM', achado 025) só vem em salary_payment — o mês
    // a que aquele salário se refere, que pode divergir do dia deste evento
    // num catch-up de vários meses atrasados de uma vez (backend, T.5).
    reference_month?: string
}

export interface CalendarDay {
    simulated_day: number
    date: string
    weekday: string
    market_open: boolean
    events: CalendarEvent[]
}

export interface MarketCalendar {
    from_day: number
    to_day: number
    days: CalendarDay[]
}
