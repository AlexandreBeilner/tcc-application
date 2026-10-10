import { apiRequest } from '../client'
import type { BillingConversion, BillingStatus, ConversionWindow, FunnelEventInput } from './types'

export type {
    BillingConversion,
    BillingStatus,
    ConversionWindow,
    FunnelEvent,
    FunnelEventInput,
    FunnelSource,
    FunnelSteps,
    SourceConversion,
    SubscriptionPlan,
    SubscriptionState,
    SubscriptionStore,
} from './types'

// Plano atual da conta (MO.2.3). A verdade é sempre o servidor: nunca deduzir PRO de outra coisa.
export function getBillingStatus(token: string): Promise<BillingStatus> {
    return apiRequest<BillingStatus>('/billing/status', { token })
}

// Passo do funil de conversão (MO.7.1). Só nomes e ponto de origem, nunca valor.
export function reportFunnelEvent(token: string, input: FunnelEventInput): Promise<void> {
    return apiRequest<void>('/billing/funnel', { method: 'POST', token, body: input })
}

// Painel de conversão do admin (MO.7.1).
export function getBillingConversion(token: string, days: ConversionWindow): Promise<BillingConversion> {
    return apiRequest<BillingConversion>(`/admin/billing/conversion?days=${days}`, { token })
}
