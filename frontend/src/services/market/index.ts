import { apiRequest } from '../client'
import type {
    AssetBook,
    AssetDetail,
    AssetSummary,
    AssetType,
    Company,
    IndicatorHistoryEntry,
    MarketCalendar,
    MarketCalendarOptions,
    MarketClock,
    TradingHaltStatus,
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
    CalendarDay,
    CalendarDaySummary,
    CalendarEvent,
    CalendarEventKind,
    CalendarRelevance,
    CalendarRelevanceReason,
    CalendarScope,
    MarketCalendar,
    MarketCalendarOptions,
    MarketClock,
    TradingHaltStatus,
} from './types'

export type {
    AssetBook,
    AssetDetail,
    AssetSummary,
    AssetType,
    BookLevel,
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

// Sandbox (Modo Aprendizado) fica fora do mercado real por padrão (S.8);
// só lição e extrato passam `includeSandbox`.
export function listAssets(token: string, type?: AssetType, includeSandbox?: boolean): Promise<{ assets: AssetSummary[] }> {
    const params = new URLSearchParams()
    if (type) params.set('type', type)
    if (includeSandbox) params.set('include_sandbox', 'true')
    const query = params.size > 0 ? `?${params.toString()}` : ''
    return apiRequest<{ assets: AssetSummary[] }>(`/market/assets${query}`, { token })
}

export function getAsset(token: string, id: string): Promise<{ asset: AssetDetail }> {
    return apiRequest<{ asset: AssetDetail }>(`/market/assets/${id}`, { token })
}

export function getAssetQuotes(token: string, id: string, days?: number): Promise<{ quotes: QuoteHistoryEntry[] }> {
    const query = days ? `?days=${days}` : ''
    return apiRequest<{ quotes: QuoteHistoryEntry[] }>(`/market/assets/${id}/quotes${query}`, { token })
}

// Melhor bid/ask e profundidade resumida (tarefa S.5) — insumo do diálogo
// de ordem (S.7, custo estimado e "comprar o máximo") e da marcação a
// ponto médio (S.6, `getMyAccount`). O backend sempre injeta o `userId` do
// token, nunca aceita um `user_id` da requisição.
export function getAssetBook(token: string, id: string): Promise<{ book: AssetBook }> {
    return apiRequest<{ book: AssetBook }>(`/market/assets/${id}/book`, { token })
}

// Tela "Indicadores Econômicos" (tarefa M.4). Sem default próprio aqui —
// omitido, o backend/motor decide (`defaultIndicatorHistoryDays = 90`,
// `.docs/backend/market.md`).
export function getIndicatorHistory(token: string, days?: number): Promise<{ indicators: IndicatorHistoryEntry[] }> {
    const query = days ? `?days=${days}` : ''
    return apiRequest<{ indicators: IndicatorHistoryEntry[] }>(`/market/indicators${query}`, { token })
}

// Relógio do mercado simulado (tarefa S.10/S.11): dia simulado, mercado aberto
// ou fechado (fim de semana simulado) e quando vem o próximo tick.
export function getMarketClock(token: string): Promise<MarketClock> {
    return apiRequest<MarketClock>('/market/clock', { token })
}

// Linha do tempo do calendário (tarefa S.10/S.12). `from`/`to` em `AAAA-MM-DD`,
// janela máxima de 92 dias; o backend sempre injeta o usuário do token.
// `scope=mine` devolve só o que afeta o usuário; sem `scope` o motor devolve tudo,
// e sem `marketLimit` usa o padrão dele (50 fatos de mercado, os mais próximos de hoje).
export function getMarketCalendar(token: string, from?: string, to?: string, options: MarketCalendarOptions = {}): Promise<MarketCalendar> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (options.scope) params.set('scope', options.scope)
    if (options.marketLimit !== undefined) params.set('market_limit', String(options.marketLimit))
    const query = params.size > 0 ? `?${params.toString()}` : ''
    return apiRequest<MarketCalendar>(`/market/calendar${query}`, { token })
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

// Pausa de negociação vigente (tarefa N.9): alimenta o aviso "Negociação pausada".
export function getTradingHalts(token: string): Promise<TradingHaltStatus> {
    return apiRequest<TradingHaltStatus>('/market/halts', { token })
}
