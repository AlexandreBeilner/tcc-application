import { apiRequest } from '../client'
import type {
    AssetDetail,
    AssetSummary,
    AssetType,
    Company,
    IndicatorHistoryEntry,
    MarketEvent,
    MyAccount,
    MyOrderRecord,
    PlaceOrderInput,
    PlaceOrderResult,
    PurchaseFixedIncomeInput,
    PurchaseFixedIncomeResult,
    QuoteHistoryEntry,
    RedeemFixedIncomeInput,
    RedeemFixedIncomeResult,
    SimulateFixedIncomeInput,
    SimulateFixedIncomeResult,
    FixedIncomeTaxRateResult,
} from './types'

export type { ProductLockedErrorBody } from './types'

export type {
    AssetDetail,
    AssetSummary,
    AssetType,
    Company,
    CompanyAssetSummary,
    CompanyFundamentalEntry,
    DividendHistoryEntry,
    EquityCompany,
    EquityDetail,
    EquityIndicators,
    EtfDetail,
    EtfHolding,
    FiiDetail,
    FixedIncomeDetail,
    FixedIncomePositionSummary,
    IndicatorHistoryEntry,
    MarketEvent,
    MarkToMarket,
    MyAccount,
    MyAccountFixedIncomePosition,
    MyAccountPosition,
    MyOrderRecord,
    OrderCancelReason,
    OrderFill,
    OrderSide,
    OrderStatus,
    OrderType,
    PlaceOrderInput,
    PlaceOrderResult,
    PurchaseFixedIncomeInput,
    PurchaseFixedIncomeResult,
    QuoteHistoryEntry,
    RedeemFixedIncomeInput,
    RedeemFixedIncomeResult,
    SimulateFixedIncomeInput,
    SimulateFixedIncomeResult,
    FixedIncomeTaxRateResult,
} from './types'
export { ASSET_TYPES } from './types'

export function getMyAccount(token: string): Promise<MyAccount> {
    return apiRequest<MyAccount>('/market/me/account', { token })
}

export function listAssets(token: string, type?: AssetType): Promise<{ assets: AssetSummary[] }> {
    const query = type ? `?type=${type}` : ''
    return apiRequest<{ assets: AssetSummary[] }>(`/market/assets${query}`, { token })
}

export function getAsset(token: string, id: string): Promise<{ asset: AssetDetail }> {
    return apiRequest<{ asset: AssetDetail }>(`/market/assets/${id}`, { token })
}

export function getAssetQuotes(token: string, id: string, days?: number): Promise<{ quotes: QuoteHistoryEntry[] }> {
    const query = days ? `?days=${days}` : ''
    return apiRequest<{ quotes: QuoteHistoryEntry[] }>(`/market/assets/${id}/quotes${query}`, { token })
}

// Tela "Indicadores Econômicos" (tarefa M.4). Sem default próprio aqui —
// omitido, o backend/motor decide (`defaultIndicatorHistoryDays = 90`,
// `.docs/backend/market.md`).
export function getIndicatorHistory(token: string, days?: number): Promise<{ indicators: IndicatorHistoryEntry[] }> {
    const query = days ? `?days=${days}` : ''
    return apiRequest<{ indicators: IndicatorHistoryEntry[] }>(`/market/indicators${query}`, { token })
}

export function getCompany(token: string, id: string): Promise<{ company: Company }> {
    return apiRequest<{ company: Company }>(`/market/companies/${id}`, { token })
}

export function listMyEvents(token: string, limit?: number, offset?: number): Promise<{ events: MarketEvent[] }> {
    const params = new URLSearchParams()
    if (limit !== undefined) params.set('limit', String(limit))
    if (offset !== undefined) params.set('offset', String(offset))
    const query = params.toString()
    return apiRequest<{ events: MarketEvent[] }>(`/market/me/events${query ? `?${query}` : ''}`, { token })
}

export function placeOrder(token: string, input: PlaceOrderInput): Promise<PlaceOrderResult> {
    return apiRequest<PlaceOrderResult>('/market/orders', { token, method: 'POST', body: input })
}

// Tela "Minhas Ordens" (tarefa O.4) — sem paginação nem filtro de status
// (escopo de protótipo, `.docs/backend/market.md`), o agrupamento em
// Pendentes/Executadas/Recusadas é responsabilidade do cliente.
export function listMyOrders(token: string): Promise<{ orders: MyOrderRecord[] }> {
    return apiRequest<{ orders: MyOrderRecord[] }>('/market/orders', { token })
}

// `204` sem corpo (tarefa O.1) — `apiRequest` já devolve `undefined` nesse
// caso.
export function cancelOrder(token: string, orderId: string): Promise<void> {
    return apiRequest<void>(`/market/orders/${orderId}/cancel`, { token, method: 'POST' })
}

export function simulateFixedIncome(token: string, input: SimulateFixedIncomeInput): Promise<SimulateFixedIncomeResult> {
    const params = new URLSearchParams({
        asset_id: input.asset_id,
        amount: String(input.amount),
        days_held: String(input.days_held),
    })
    return apiRequest<SimulateFixedIncomeResult>(`/market/fixed-income/simulate?${params.toString()}`, { token })
}

// Sustenta a Calculadora, modo comparação (tarefa 6.7) — sem asset_id/
// amount, diferente de simulateFixedIncome acima.
export function getFixedIncomeTaxRate(token: string, daysHeld: number): Promise<FixedIncomeTaxRateResult> {
    return apiRequest<FixedIncomeTaxRateResult>(`/market/fixed-income/tax-rate?days_held=${daysHeld}`, { token })
}

export function purchaseFixedIncome(token: string, input: PurchaseFixedIncomeInput): Promise<PurchaseFixedIncomeResult> {
    return apiRequest<PurchaseFixedIncomeResult>('/market/fixed-income/purchases', { token, method: 'POST', body: input })
}

export function redeemFixedIncome(token: string, input: RedeemFixedIncomeInput): Promise<RedeemFixedIncomeResult> {
    return apiRequest<RedeemFixedIncomeResult>('/market/fixed-income/redemptions', { token, method: 'POST', body: input })
}
