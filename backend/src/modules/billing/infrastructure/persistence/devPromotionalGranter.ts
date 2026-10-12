import { buildSubscription } from '../../domain/subscription'
import { DEV_PRODUCT_PREFIX } from '../../application/useCases/devSubscription'
import type { PromotionalEntitlementGranter } from '../../application/ports/promotionalEntitlementGranter'
import type { SubscriptionCache } from '../../application/ports/subscriptionCache'
import type { SubscriptionRepository } from '../../application/ports/subscriptionRepository'

// Só com `BILLING_PROVIDER=dev`: grava a concessão direto na projeção, sem RevenueCat, no mesmo
// formato de uma concessão real (`store: promotional`).
export function createDevPromotionalGranter(
  subscriptions: SubscriptionRepository,
  cache: SubscriptionCache,
  now: () => Date = () => new Date(),
): PromotionalEntitlementGranter {
  return {
    async grantUntil(userId, endsAt) {
      const at = now()
      await subscriptions.upsert(
        buildSubscription(
          userId,
          {
            productId: `${DEV_PRODUCT_PREFIX}promotional`,
            store: 'promotional',
            purchasedAt: at,
            expiresAt: endsAt,
            graceExpiresAt: null,
            billingIssueDetectedAt: null,
            unsubscribeDetectedAt: null,
            refundedAt: null,
            isSandbox: false,
            managementUrl: null,
          },
          at,
          at,
        ),
      )
      await cache.invalidate(userId)
    },
  }
}
