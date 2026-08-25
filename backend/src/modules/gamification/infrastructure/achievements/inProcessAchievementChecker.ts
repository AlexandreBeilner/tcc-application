import type { CheckAndUnlockAchievementsUseCase } from '../../../achievements/application/useCases/checkAndUnlockAchievements'
import type { AchievementChecker } from '../../application/ports/achievementChecker'

export function createInProcessAchievementChecker(
  checkAndUnlockAchievements: CheckAndUnlockAchievementsUseCase,
): AchievementChecker {
  return {
    async checkAndUnlock(userId) {
      await checkAndUnlockAchievements.execute({ userId })
    },
  }
}
