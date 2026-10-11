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

// Funil de conversão (MO.7.1, `.docs/backend/billing.md`). O app só reporta estes três passos;
// "assinou" e "cancelou" o servidor grava sozinho.
export type FunnelEvent = 'invite_viewed' | 'plans_opened' | 'purchase_started'
export type FunnelSource = 'league' | 'duel' | 'cosmetics' | 'retrospective' | 'assembly' | 'direct'

export interface FunnelEventInput {
    event: FunnelEvent
    source?: FunnelSource
    plan?: 'monthly' | 'annual'
}

export interface FunnelSteps {
    lessonCompleted: number
    inviteViewed: number
    plansOpened: number
    purchaseStarted: number
    subscribed: number
    cancelled: number
}

export interface SourceConversion {
    source: FunnelSource
    reached: number
    inviteViewed: number
    plansOpened: number
    purchaseStarted: number
    subscribed: number
    conversionRate: number | null
}

// Resposta de `GET /admin/billing/conversion`.
export interface BillingConversion {
    windowDays: number
    generatedAt: string
    subscribers: { active: number; monthly: number; annual: number; unknown: number }
    // Centavos; `null` quando os preços não estão configurados no backend.
    recurringRevenueCents: number | null
    churn: { cancelled: number; startOfWindow: number; rate: number | null }
    funnel: FunnelSteps
    bySource: SourceConversion[]
}

export type ConversionWindow = 7 | 30 | 90
