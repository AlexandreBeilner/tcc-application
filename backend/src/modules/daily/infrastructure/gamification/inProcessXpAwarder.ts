import type { AwardXpUseCase } from '../../../gamification/application/useCases/awardXp'
import type { XpAwarder } from '../../application/ports/xpAwarder'

export function createInProcessXpAwarder(awardXp: AwardXpUseCase): XpAwarder {
  return {
    async award(userId, amount, reason) {
      const result = await awardXp.execute({ userId, amount, reason })
      return {
        xp: result.xp,
        level: result.level,
        leveledUp: result.leveledUp,
        unlockedAchievements: result.unlockedAchievements,
      }
    },
  }
}
