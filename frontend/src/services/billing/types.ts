export type SubscriptionState = 'none' | 'active' | 'billing_issue' | 'expired'
export type SubscriptionPlan = 'monthly' | 'annual' | 'unknown'
export type SubscriptionStore = 'app_store' | 'play_store' | 'stripe' | 'rc_billing' | 'promotional' | 'other'

// Resposta de `GET /billing/status` (`.docs/backend/billing.md`).
export interface BillingStatus {
    isPro: boolean
    state: SubscriptionState
    plan: SubscriptionPlan | null
    store: SubscriptionStore | null
    expiresAt: string | null
    willRenew: boolean
    managementUrl: string | null
    billingEnabled: boolean
}
