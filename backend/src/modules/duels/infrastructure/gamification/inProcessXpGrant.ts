import type { XpGrant } from '../../application/ports/duelSideEffects'

// Ponte em processo para `AwardXpUseCase` (dono único de XP). Só o crédito atravessa: nível e
// conquistas seguem as regras do próprio módulo de gamificação.
export function createInProcessXpGrant(awardXp: {
  execute(input: { userId: string; amount: number; reason: string }): Promise<unknown>
}): XpGrant {
  return {
    async award(userId, amount, reason) {
      await awardXp.execute({ userId, amount, reason })
    },
  }
}
