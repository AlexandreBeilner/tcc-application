import { isActive, subscriptionState } from './subscription'
import type { Subscription, SubscriptionPeriod, SubscriptionStore } from './subscription'

// E-mails do ciclo de vida do PRO (MO.3.4). Função pura: dada a projeção anterior e a nova, diz
// quais avisos o fato merece. Cada aviso carrega a chave do FATO (não do envio), então repetir a
// sincronização, receber o webhook duas vezes ou reconciliar não manda e-mail em dobro.

export type ProLifecycleEmail =
  | { kind: 'welcome'; key: string; plan: SubscriptionPeriod }
  | {
      kind: 'billing_issue'
      key: string
      store: SubscriptionStore
      manageUrl: string | null
    }
  | { kind: 'ended'; key: string }

// Quem volta depois de mais que isto sem PRO é recebido de novo; uma renovação cujo webhook
// atrasou (vencida por poucas horas ou dias, dentro da carência das lojas) não é boas-vindas.
export const RESUBSCRIBE_AFTER_MS = 7 * 86_400_000

// Páginas oficiais de assinaturas, usadas quando o provedor não manda um `managementUrl`.
export const APP_STORE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions'
export const PLAY_STORE_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions'

export function manageUrlFor(subscription: Subscription): string | null {
  if (subscription.managementUrl) return subscription.managementUrl
  if (subscription.store === 'app_store') return APP_STORE_SUBSCRIPTIONS_URL
  if (subscription.store === 'play_store') return PLAY_STORE_SUBSCRIPTIONS_URL
  return null
}

function endOfAccess(subscription: Subscription): Date | null {
  if (subscription.expiresAt === null) return null
  return subscription.graceExpiresAt && subscription.graceExpiresAt > subscription.expiresAt
    ? subscription.graceExpiresAt
    : subscription.expiresAt
}

function stamp(date: Date | null): string {
  return date ? String(date.getTime()) : 'none'
}

export function lifecycleEmails(
  previous: Subscription | null,
  next: Subscription,
  now: Date,
): ProLifecycleEmail[] {
  const emails: ProLifecycleEmail[] = []
  const state = subscriptionState(next, now)

  if (state === 'active' || state === 'billing_issue') {
    const previousEnd = previous ? endOfAccess(previous) : null
    const wasProRecently =
      previous !== null &&
      (isActive(previous, now) ||
        (previousEnd !== null && now.getTime() - previousEnd.getTime() < RESUBSCRIBE_AFTER_MS))
    if (!wasProRecently) {
      emails.push({
        kind: 'welcome',
        key: `pro-welcome:${next.userId}:${stamp(next.purchasedAt ?? next.expiresAt)}`,
        plan: next.period,
      })
    }

    const issueAt = next.billingIssueDetectedAt
    const alreadyKnown = previous?.billingIssueDetectedAt?.getTime() === issueAt?.getTime()
    if (issueAt && !alreadyKnown) {
      emails.push({
        kind: 'billing_issue',
        key: `pro-billing-issue:${next.userId}:${stamp(issueAt)}`,
        store: next.store,
        manageUrl: manageUrlFor(next),
      })
    }
  }

  // Só quem já tinha uma assinatura gravada: uma conta que nunca vimos ativa não recebe "encerrada".
  if (state === 'expired' && previous !== null) {
    emails.push({ kind: 'ended', key: `pro-ended:${next.userId}:${stamp(next.expiresAt)}` })
  }

  return emails
}
