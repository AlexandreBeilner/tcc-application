import { BillingDisabledError } from '../../domain/errors'
import type { EntitlementProvider } from '../../application/ports/entitlementProvider'

// Entra quando `BILLING_PROVIDER=disabled`: qualquer tentativa de falar com o provedor falha com
// uma mensagem clara em vez de chamar uma API sem credencial.
export function createDisabledEntitlementProvider(): EntitlementProvider {
  return {
    async getEntitlement() {
      throw new BillingDisabledError()
    },
  }
}
