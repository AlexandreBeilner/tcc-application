import { BillingDisabledError, BillingProviderError } from '../../../billing/domain/errors'
import type { GetSubscriptionStatusUseCase } from '../../../billing/application/useCases/getSubscriptionStatus'
import type { GrantPromotionalProUseCase } from '../../../billing/application/useCases/grantPromotionalPro'
import { ProGrantProviderError, ProGrantUnavailableError } from '../../domain/errors'
import type { UserProGrants } from '../../application/ports/userProGrants'

// Liga o painel ao módulo `billing`: mesma concessão da indicação (RevenueCat, ou a projeção local
// no provedor `dev`), traduzindo os erros do billing para erros do painel.
export function createInProcessUserProGrants(deps: {
  getSubscriptionStatus: Pick<GetSubscriptionStatusUseCase, 'execute'>
  grantPromotionalPro: Pick<GrantPromotionalProUseCase, 'currentAccessEnd' | 'grantUntil'>
}): UserProGrants {
  return {
    async statusOf(userId) {
      const status = await deps.getSubscriptionStatus.execute(userId)
      return {
        isPro: status.isPro,
        state: status.state,
        plan: status.plan,
        store: status.store,
        expiresAt: status.expiresAt,
      }
    },
    currentAccessEnd: (userId) => deps.grantPromotionalPro.currentAccessEnd(userId),
    async grantUntil(userId, endsAt) {
      try {
        await deps.grantPromotionalPro.grantUntil(userId, endsAt)
      } catch (err) {
        if (err instanceof BillingDisabledError) throw new ProGrantUnavailableError(err.message)
        if (err instanceof BillingProviderError) throw new ProGrantProviderError(err.message)
        throw err
      }
    },
  }
}
