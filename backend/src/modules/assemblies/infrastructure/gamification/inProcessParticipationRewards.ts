import type { ParticipationRewards } from '../../application/ports/resultPublishers'

// Ponte em processo para `AwardXpUseCase` (dono único de XP e do teste de conquistas). O valor vem
// da configuração; o motivo carrega a assembleia, então cada crédito é rastreável.
export function createInProcessParticipationRewards(
  awardXp: {
    execute(input: { userId: string; amount: number; reason: string }): Promise<unknown>
  },
  amount: () => number,
): ParticipationRewards {
  return {
    async rewardFirstVote(userId, assemblyId) {
      const xp = amount()
      if (xp <= 0) return
      await awardXp.execute({ userId, amount: xp, reason: `assembly_vote:${assemblyId}` })
    },
  }
}
