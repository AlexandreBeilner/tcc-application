// Direito ao PRO (MO.2.1). Função pura: nenhuma dependência de banco, HTTP ou do RevenueCat. É o
// ÚNICO lugar que decide o que conta como "PRO ativo"; toda feature gateada consulta o caso de uso
// de status (que usa isto), nunca recalcula a regra por conta própria.

export type SubscriptionStore =
  'app_store' | 'play_store' | 'stripe' | 'rc_billing' | 'promotional' | 'other'

export type SubscriptionPeriod = 'monthly' | 'annual' | 'unknown'

export type SubscriptionState = 'none' | 'active' | 'billing_issue' | 'expired'

// O que o provedor de assinatura (RevenueCat) diz sobre o entitlement `pro` de alguém.
export interface EntitlementState {
  productId: string
  store: SubscriptionStore
  purchasedAt: Date | null
  // `null` = sem vencimento (concessão promocional vitalícia).
  expiresAt: Date | null
  graceExpiresAt: Date | null
  billingIssueDetectedAt: Date | null
  unsubscribeDetectedAt: Date | null
  refundedAt: Date | null
  isSandbox: boolean
  managementUrl: string | null
}

// A projeção local: os fatos acima mais o que a nossa tabela acrescenta.
export interface Subscription extends EntitlementState {
  userId: string
  period: SubscriptionPeriod
  lastEventAt: Date | null
  updatedAt: Date
}

// Vista que sai pela API (`GET /billing/status`). Só o necessário pra tela; nada de dado de
// cobrança além disso.
export interface SubscriptionStatus {
  isPro: boolean
  state: SubscriptionState
  plan: SubscriptionPeriod | null
  store: SubscriptionStore | null
  expiresAt: string | null
  willRenew: boolean
  managementUrl: string | null
}

const DAY_MS = 86_400_000

// Descobre mensal/anual pela duração do período atual. Assinatura de teste das lojas (sandbox)
// tem períodos encurtados e concessão promocional não é periódica: nesses casos devolve
// 'unknown' em vez de chutar.
export function inferPeriod(
  purchasedAt: Date | null,
  expiresAt: Date | null,
  store: SubscriptionStore,
  isSandbox: boolean,
): SubscriptionPeriod {
  if (isSandbox || store === 'promotional' || !purchasedAt || !expiresAt) return 'unknown'
  const days = (expiresAt.getTime() - purchasedAt.getTime()) / DAY_MS
  if (days >= 300 && days <= 400) return 'annual'
  if (days >= 20 && days <= 45) return 'monthly'
  return 'unknown'
}

export function buildSubscription(
  userId: string,
  state: EntitlementState,
  now: Date,
  lastEventAt: Date | null,
): Subscription {
  return {
    ...state,
    userId,
    period: inferPeriod(state.purchasedAt, state.expiresAt, state.store, state.isSandbox),
    lastEventAt,
    updatedAt: now,
  }
}

// PRO se não foi reembolsado e ainda não venceu (a carência de pagamento conta como vigência).
// Sem vencimento = ativo. Um webhook de expiração que nunca chegou não deixa ninguém PRO pra
// sempre, porque a decisão olha a data, não um estado gravado.
export function isActive(subscription: Subscription, now: Date): boolean {
  if (subscription.refundedAt && subscription.refundedAt <= now) return false
  if (subscription.expiresAt === null) return true
  const end =
    subscription.graceExpiresAt && subscription.graceExpiresAt > subscription.expiresAt
      ? subscription.graceExpiresAt
      : subscription.expiresAt
  return end > now
}

export function subscriptionState(subscription: Subscription | null, now: Date): SubscriptionState {
  if (!subscription) return 'none'
  if (!isActive(subscription, now)) return 'expired'
  // Cobrança falhou e já passou do vencimento: segue ativo só pela carência.
  const inGrace = subscription.expiresAt !== null && subscription.expiresAt <= now
  return subscription.billingIssueDetectedAt && inGrace ? 'billing_issue' : 'active'
}

// Vai renovar sozinha: ativa, com vencimento, sem cancelamento, falha de cobrança nem reembolso.
// Concessão promocional não renova.
export function willRenew(subscription: Subscription, now: Date): boolean {
  return (
    isActive(subscription, now) &&
    subscription.expiresAt !== null &&
    subscription.store !== 'promotional' &&
    subscription.unsubscribeDetectedAt === null &&
    subscription.billingIssueDetectedAt === null &&
    subscription.refundedAt === null
  )
}

export function toStatus(subscription: Subscription | null, now: Date): SubscriptionStatus {
  const state = subscriptionState(subscription, now)
  if (!subscription || state === 'none') {
    return {
      isPro: false,
      state: 'none',
      plan: null,
      store: null,
      expiresAt: null,
      willRenew: false,
      managementUrl: null,
    }
  }
  return {
    isPro: state === 'active' || state === 'billing_issue',
    state,
    plan: subscription.period,
    store: subscription.store,
    expiresAt: subscription.expiresAt ? subscription.expiresAt.toISOString() : null,
    willRenew: willRenew(subscription, now),
    managementUrl: subscription.managementUrl,
  }
}
