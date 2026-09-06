import { apiRequest } from '../client'
import type {
    AssetDetail,
    AssetSummary,
    AssetType,
    Company,
    MarketEvent,
    MyAccount,
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
    MarketEvent,
    MarkToMarket,
    MyAccount,
    MyAccountFixedIncomePosition,
    MyAccountPosition,
    OrderFill,
    OrderSide,
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
