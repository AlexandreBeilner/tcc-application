import { apiRequest } from '../client'
import type { BillingStatus } from './types'

export type { BillingStatus, SubscriptionPlan, SubscriptionState, SubscriptionStore } from './types'

// Plano atual da conta (MO.2.3). A verdade é sempre o servidor: nunca deduzir PRO de outra coisa.
export function getBillingStatus(token: string): Promise<BillingStatus> {
    return apiRequest<BillingStatus>('/billing/status', { token })
}
