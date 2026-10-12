import type { CheckAndUnlockAchievementsUseCase } from '../../../achievements/application/useCases/checkAndUnlockAchievements'
import type { AchievementUnlocker } from '../../application/ports/achievementUnlocker'

export function createInProcessAchievementUnlocker(
  check: Pick<CheckAndUnlockAchievementsUseCase, 'execute'>,
): AchievementUnlocker {
  return {
    async check(userId) {
      await check.execute({ userId })
    },
  }
}
