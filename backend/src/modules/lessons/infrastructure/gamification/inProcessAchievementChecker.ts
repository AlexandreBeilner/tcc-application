import type { CheckAndUnlockAchievementsUseCase } from '../../../achievements/application/useCases/checkAndUnlockAchievements'
import type { AchievementChecker } from '../../application/ports/achievementChecker'

export function createInProcessAchievementChecker(
  checkAndUnlockAchievements: CheckAndUnlockAchievementsUseCase,
): AchievementChecker {
  return {
    async checkAndUnlock(userId) {
      const unlocked = await checkAndUnlockAchievements.execute({ userId })
      return unlocked.map((achievement) => ({
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
      }))
    },
  }
}
