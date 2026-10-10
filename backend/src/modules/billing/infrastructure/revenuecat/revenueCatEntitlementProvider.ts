import { z } from 'zod'
import { BillingProviderError } from '../../domain/errors'
import type { EntitlementProvider } from '../../application/ports/entitlementProvider'
import type { EntitlementState, SubscriptionStore } from '../../domain/subscription'

// Resposta de `GET /v1/subscribers/{app_user_id}` (API REST v1 do RevenueCat). Só os campos que
// usamos; o resto é ignorado. Datas vêm em ISO 8601 ou nulas.
const date = z.string().nullable().optional()

const entitlementSchema = z.object({
  product_identifier: z.string(),
  purchase_date: date,
  expires_date: date,
  grace_period_expires_date: date,
})

const subscriptionSchema = z.object({
  store: z.string().optional(),
  is_sandbox: z.boolean().optional(),
  billing_issues_detected_at: date,
  unsubscribe_detected_at: date,
  refunded_at: date,
})

const subscriberResponseSchema = z.object({
  subscriber: z.object({
    entitlements: z.record(z.string(), entitlementSchema).default({}),
    subscriptions: z.record(z.string(), subscriptionSchema).default({}),
    management_url: z.string().nullable().optional(),
  }),
})

export interface RevenueCatProviderOptions {
  secretKey: string
  entitlementId: string
  apiBaseUrl: string
  requestTimeoutMs: number
  // Injetável pra teste; padrão é o `fetch` global.
  fetchFn?: typeof fetch
}

const STORE_BY_REVENUECAT: Record<string, SubscriptionStore> = {
  app_store: 'app_store',
  mac_app_store: 'app_store',
  play_store: 'play_store',
  stripe: 'stripe',
  rc_billing: 'rc_billing',
  promotional: 'promotional',
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function createRevenueCatEntitlementProvider(
  options: RevenueCatProviderOptions,
): EntitlementProvider {
  const doFetch = options.fetchFn ?? fetch

  return {
    async getEntitlement(userId) {
      const url = `${options.apiBaseUrl}/subscribers/${encodeURIComponent(userId)}`
      let response: Response
      try {
        response = await doFetch(url, {
          headers: {
            Authorization: `Bearer ${options.secretKey}`,
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(options.requestTimeoutMs),
        })
      } catch (err) {
        throw new BillingProviderError(
          `RevenueCat inacessível: ${err instanceof Error ? err.message : String(err)}`,
        )
      }

      if (!response.ok) {
        throw new BillingProviderError(`RevenueCat respondeu ${response.status}`)
      }

      const parsed = subscriberResponseSchema.safeParse(await response.json().catch(() => null))
      if (!parsed.success) {
        throw new BillingProviderError('resposta do RevenueCat fora do formato esperado')
      }

      const { entitlements, subscriptions, management_url } = parsed.data.subscriber
      const entitlement = entitlements[options.entitlementId]
      if (!entitlement) return null

      const subscription = subscriptions[entitlement.product_identifier]
      const state: EntitlementState = {
        productId: entitlement.product_identifier,
        store: STORE_BY_REVENUECAT[subscription?.store ?? ''] ?? 'other',
        purchasedAt: toDate(entitlement.purchase_date),
        expiresAt: toDate(entitlement.expires_date),
        graceExpiresAt: toDate(entitlement.grace_period_expires_date),
        billingIssueDetectedAt: toDate(subscription?.billing_issues_detected_at),
        unsubscribeDetectedAt: toDate(subscription?.unsubscribe_detected_at),
        refundedAt: toDate(subscription?.refunded_at),
        isSandbox: subscription?.is_sandbox ?? false,
        managementUrl: management_url ?? null,
      }
      return state
    },
  }
}
