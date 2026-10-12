import { BillingDisabledError } from '../../domain/errors'
import type { PromotionalEntitlementGranter } from '../../application/ports/promotionalEntitlementGranter'

export function createDisabledPromotionalGranter(): PromotionalEntitlementGranter {
  return {
    async grantUntil() {
      throw new BillingDisabledError()
    },
  }
}
