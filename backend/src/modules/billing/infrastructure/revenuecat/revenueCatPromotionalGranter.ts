import { BillingProviderError } from '../../domain/errors'
import type { PromotionalEntitlementGranter } from '../../application/ports/promotionalEntitlementGranter'

export interface RevenueCatGranterOptions {
  secretKey: string
  entitlementId: string
  apiBaseUrl: string
  requestTimeoutMs: number
  // Reconsulta o estado depois da concessão, pra projeção local já enxergá-la.
  afterGrant: (userId: string) => Promise<void>
  fetchFn?: typeof fetch
}

// `POST /v1/subscribers/{app_user_id}/entitlements/{entitlement}/promotional` com `end_time_ms`
// (conferido na documentação atual do RevenueCat em 2026-10-11; `duration` e `start_time_ms` são
// os campos descontinuados). Resposta 201.
export function createRevenueCatPromotionalGranter(
  options: RevenueCatGranterOptions,
): PromotionalEntitlementGranter {
  const doFetch = options.fetchFn ?? fetch
  return {
    async grantUntil(userId, endsAt) {
      const url =
        `${options.apiBaseUrl}/subscribers/${encodeURIComponent(userId)}` +
        `/entitlements/${encodeURIComponent(options.entitlementId)}/promotional`
      let response: Response
      try {
        response = await doFetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.secretKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ end_time_ms: endsAt.getTime() }),
          signal: AbortSignal.timeout(options.requestTimeoutMs),
        })
      } catch (err) {
        throw new BillingProviderError(
          `RevenueCat inacessível: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
      if (!response.ok) {
        throw new BillingProviderError(`RevenueCat recusou a concessão (${response.status})`)
      }
      await options.afterGrant(userId)
    },
  }
}
