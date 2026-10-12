import type { GrantPromotionalProUseCase } from '../../../billing/application/useCases/grantPromotionalPro'
import type { PromotionalPro } from '../../application/ports/promotionalPro'

export function createInProcessPromotionalPro(
  grant: Pick<GrantPromotionalProUseCase, 'currentAccessEnd' | 'grantUntil'>,
): PromotionalPro {
  return {
    currentAccessEnd: (userId) => grant.currentAccessEnd(userId),
    grantUntil: (userId, endsAt) => grant.grantUntil(userId, endsAt),
  }
}
