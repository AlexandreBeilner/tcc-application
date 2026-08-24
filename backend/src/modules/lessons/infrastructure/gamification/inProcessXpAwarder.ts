import type { AwardXpUseCase } from '../../../gamification/application/useCases/awardXp'
import type { XpAwarder } from '../../application/ports/xpAwarder'

// Adapter fino em processo (mesmo runtime Node, sem HTTP) sobre o caso de
// uso que `modules/gamification` (5.1) já expõe — ver `xpAwarder.ts`.
export function createInProcessXpAwarder(awardXp: AwardXpUseCase): XpAwarder {
  return {
    async award(userId, amount, reason) {
      await awardXp.execute({ userId, amount, reason })
    },
  }
}
